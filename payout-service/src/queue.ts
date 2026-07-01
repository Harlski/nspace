import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { AppConfig } from "./config.js";
import { LUNA_PER_NIM } from "./config.js";
import type { ChainClient } from "./chain/types.js";
import { adjustBalanceCacheAfterPayout } from "./balance.js";
import {
  appendManualBulkPayoutLogEntry,
  appendSentHistoryLine,
  getPendingPayoutQueueTotals as computePendingQueueTotals,
  getPendingPayoutSnapshotForWallet,
  getPublicPendingPayoutAdminPanelSnapshot,
  getPublicPendingPayoutSnapshot,
  getPublicPendingPayoutSummary,
  initHistoryPaths,
  MANUAL_BULK_PAYOUT_TX_MESSAGE,
  normalizeNimWalletId,
  type PublicPendingPayoutSnapshot,
  type PublicPendingPayoutSummary,
  type WalletPendingPayoutDetail,
} from "./history.js";

export type PayIntentBody = {
  claimId: string;
  recipientAddress: string;
  amountLuna?: string;
  roomId: string;
  tileKey: string;
  txMessage?: string;
};

export type PayoutJobStatus = "pending" | "processing" | "completed" | "dead_letter";

export type PayoutJob = {
  id: string;
  claimId: string;
  recipientAddress: string;
  amountLuna: bigint;
  createdAt: number;
  sentAt?: number;
  attempts: number;
  nextRetryAt: number;
  status: PayoutJobStatus;
  lastError?: string;
  txHash?: string;
  roomId: string;
  tileKey: string;
  txMessage?: string;
};

type SerializedJob = Omit<PayoutJob, "amountLuna"> & { amountLuna: string };

const jobs: PayoutJob[] = [];
let processorTimer: ReturnType<typeof setTimeout> | null = null;
let processing = false;
let processorEnabled = false;
let chainClient: ChainClient | null = null;
let queueFile = "";
let acceptedClaimIdsFile = "";
let deadLetterFile = "";
const acceptedClaimIds = new Set<string>();
let maxBackoffMs = 3_600_000;
let deadLetterAfterAttempts = 80;

function ensureDataDir(): void {
  fs.mkdirSync(path.dirname(queueFile), { recursive: true });
}

function loadAcceptedClaimIds(): void {
  acceptedClaimIds.clear();
  try {
    if (!fs.existsSync(acceptedClaimIdsFile)) return;
    const raw = fs.readFileSync(acceptedClaimIdsFile, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return;
    for (const id of parsed) {
      if (typeof id === "string" && id.trim()) {
        acceptedClaimIds.add(id.trim());
      }
    }
  } catch (e) {
    console.error("[payout-service] Failed to load accepted claim ids:", e);
  }
}

function persistAcceptedClaimIds(): void {
  try {
    ensureDataDir();
    const payload = JSON.stringify([...acceptedClaimIds]);
    const tmp = `${acceptedClaimIdsFile}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, payload, "utf8");
    fs.renameSync(tmp, acceptedClaimIdsFile);
  } catch (e) {
    console.error("[payout-service] Failed to persist accepted claim ids:", e);
  }
}

function rememberAcceptedClaimId(claimId: string): void {
  if (acceptedClaimIds.has(claimId)) return;
  acceptedClaimIds.add(claimId);
  persistAcceptedClaimIds();
}

function backoffMs(attempts: number): number {
  const base = 4000 * Math.pow(2, Math.min(attempts, 12));
  return Math.min(base, maxBackoffMs);
}

function appendDeadLetterAudit(job: PayoutJob, error: string): void {
  try {
    ensureDataDir();
    fs.appendFileSync(
      deadLetterFile,
      `${JSON.stringify({
        ts: Date.now(),
        enqueuedAt: job.createdAt,
        claimId: job.claimId,
        recipient: job.recipientAddress,
        error,
        attempts: job.attempts,
        jobId: job.id,
        roomId: job.roomId,
        tileKey: job.tileKey,
      })}\n`,
      "utf8"
    );
  } catch (e) {
    console.error("[payout-service] Failed to append dead-letter file:", e);
  }
}

function serializeJob(j: PayoutJob): SerializedJob {
  return { ...j, amountLuna: j.amountLuna.toString() };
}

function deserializeJob(s: SerializedJob): PayoutJob {
  const now = Date.now();
  return {
    ...s,
    amountLuna: BigInt(s.amountLuna),
    attempts: typeof s.attempts === "number" ? s.attempts : 0,
    nextRetryAt: typeof s.nextRetryAt === "number" ? s.nextRetryAt : now,
  };
}

export function loadQueueFromDisk(): void {
  try {
    if (!fs.existsSync(queueFile)) return;
    const raw = fs.readFileSync(queueFile, "utf8");
    const parsed = JSON.parse(raw) as SerializedJob[];
    if (!Array.isArray(parsed)) return;
    jobs.length = 0;
    for (const row of parsed) {
      if (row.status === "processing") {
        row.status = "pending";
      }
      jobs.push(deserializeJob(row));
    }
  } catch (e) {
    console.error("[payout-service] Failed to load queue:", e);
  }
}

export function saveQueue(): void {
  try {
    ensureDataDir();
    const pending = jobs.filter(
      (j) => j.status === "pending" || j.status === "processing"
    );
    const payload = JSON.stringify(pending.map(serializeJob));
    const tmp = `${queueFile}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, payload, "utf8");
    fs.renameSync(tmp, queueFile);
  } catch (e) {
    console.error("[payout-service] Failed to save queue:", e);
  }
}

export function initPayoutQueue(cfg: AppConfig, client: ChainClient): void {
  queueFile = path.join(cfg.dataDir, "nim-payout-pending.json");
  acceptedClaimIdsFile = path.join(cfg.dataDir, "accepted-claim-ids.json");
  deadLetterFile = path.join(cfg.dataDir, "nim-payout-dead-letter.jsonl");
  maxBackoffMs = cfg.maxBackoffMs;
  deadLetterAfterAttempts = cfg.deadLetterAfterAttempts;
  chainClient = client;
  initHistoryPaths(cfg);
  loadAcceptedClaimIds();
  loadQueueFromDisk();
  for (const job of jobs) {
    acceptedClaimIds.add(job.claimId);
  }
}

export function startPayoutProcessor(intervalMs: number): void {
  if (processorTimer) return;
  processorEnabled = true;
  const run = async (): Promise<void> => {
    try {
      await tick();
    } catch (e) {
      console.error("[payout-service] Processor tick error:", e);
    }
    processorTimer = setTimeout(run, intervalMs);
  };
  processorTimer = setTimeout(run, intervalMs);
}

export function stopPayoutProcessorForTests(): void {
  if (processorTimer) {
    clearTimeout(processorTimer);
    processorTimer = null;
  }
  processorEnabled = false;
}

function pickOldestReadyJob(candidates: PayoutJob[]): PayoutJob | undefined {
  if (candidates.length === 0) return undefined;
  let best = candidates[0]!;
  for (let i = 1; i < candidates.length; i++) {
    const j = candidates[i]!;
    if (j.createdAt < best.createdAt) best = j;
    else if (j.createdAt === best.createdAt && j.id < best.id) best = j;
  }
  return best;
}

function findNextReadyJob(now: number = Date.now()): PayoutJob | undefined {
  const ready = jobs.filter(
    (j) => j.status === "pending" && j.nextRetryAt <= now
  );
  return pickOldestReadyJob(ready);
}

async function processOne(job: PayoutJob, now: number = Date.now()): Promise<void> {
  const client = chainClient;
  if (!client) return;

  if (job.nextRetryAt > now) return;

  if (!client.isSignerConfigured()) {
    job.lastError = "signer not configured";
    job.nextRetryAt = now + backoffMs(job.attempts);
    job.attempts += 1;
    saveQueue();
    console.warn("[payout-service] Signer not configured - will retry later");
    maybeDeadLetter(job, job.lastError);
    return;
  }

  job.status = "processing";
  saveQueue();

  try {
    const { txHash, state } = await client.sendPayout({
      recipientAddress: job.recipientAddress,
      amountLuna: job.amountLuna,
      txMessage: job.txMessage,
      claimId: job.claimId,
      jobId: job.id,
    });
    job.sentAt = Date.now();
    job.txHash = txHash;
    job.status = "completed";
    appendSentHistoryLine(job, txHash, job.sentAt);
    adjustBalanceCacheAfterPayout(job.amountLuna);
    console.log(
      `[payout-service] Sent ${txHash} state=${state} claim=${job.claimId.slice(0, 10)}…`
    );
    jobs.splice(jobs.indexOf(job), 1);
    saveQueue();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    job.status = "pending";
    job.attempts += 1;
    job.lastError = msg;
    job.nextRetryAt = now + backoffMs(job.attempts);
    console.warn(
      `[payout-service] Send failed (attempt ${job.attempts}) claim=${job.claimId}: ${msg}`
    );
    maybeDeadLetter(job, msg);
    saveQueue();
  }
}

function maybeDeadLetter(job: PayoutJob, error: string): void {
  if (job.attempts < deadLetterAfterAttempts) return;
  job.status = "dead_letter";
  console.error(
    `[payout-service] Dead letter after ${job.attempts} attempts claim=${job.claimId}:`,
    error
  );
  appendDeadLetterAudit(job, error);
  jobs.splice(jobs.indexOf(job), 1);
}

async function tick(now: number = Date.now()): Promise<void> {
  if (processing) return;
  processing = true;
  try {
    const next = findNextReadyJob(now);
    if (next) await processOne(next, now);
  } finally {
    processing = false;
  }
}

export function enqueuePayIntent(body: PayIntentBody): {
  accepted: true;
  claimId: string;
  duplicate: boolean;
} {
  const claimId = String(body.claimId ?? "").trim();
  const recipientAddress = String(body.recipientAddress ?? "").trim();
  const roomId = String(body.roomId ?? "").trim();
  const tileKey = String(body.tileKey ?? "").trim();
  if (!claimId || !recipientAddress || !roomId || !tileKey) {
    throw new Error("claimId, recipientAddress, roomId, and tileKey are required");
  }

  const existing = jobs.find(
    (j) => j.claimId === claimId && j.status !== "completed" && j.status !== "dead_letter"
  );
  if (existing || acceptedClaimIds.has(claimId)) {
    return { accepted: true, claimId, duplicate: true };
  }

  let amountLuna = LUNA_PER_NIM;
  if (body.amountLuna !== undefined && body.amountLuna !== "") {
    if (!/^\d+$/.test(String(body.amountLuna))) {
      throw new Error("amountLuna must be a decimal luna string");
    }
    amountLuna = BigInt(body.amountLuna);
  }

  const now = Date.now();
  const job: PayoutJob = {
    id: randomUUID(),
    claimId,
    recipientAddress,
    amountLuna,
    createdAt: now,
    attempts: 0,
    nextRetryAt: now,
    status: "pending",
    roomId,
    tileKey,
    txMessage: body.txMessage?.trim() || undefined,
  };
  jobs.push(job);
  rememberAcceptedClaimId(claimId);
  saveQueue();
  console.log(
    `[payout-service] Enqueued claim=${claimId.slice(0, 10)}… → ${recipientAddress.slice(0, 12)}…`
  );
  if (processorEnabled) void tick();
  return { accepted: true, claimId, duplicate: false };
}

export function listPendingJobsForTests(): readonly PayoutJob[] {
  return jobs.filter((j) => j.status === "pending" || j.status === "processing");
}

export function getSendCountForTests(): number {
  return jobs.filter((j) => j.status === "completed").length;
}

export async function runProcessorTickForTests(now?: number): Promise<void> {
  await tick(now);
}

export async function drainQueueForTests(opts?: {
  now?: number;
  maxTicks?: number;
}): Promise<void> {
  let now = opts?.now ?? Date.now();
  const maxTicks = opts?.maxTicks ?? 40;
  for (let i = 0; i < maxTicks; i++) {
    await tick(now);
    const pending = listPendingJobsForTests();
    if (pending.length === 0) break;
    const ready = pending.some((j) => j.nextRetryAt <= now);
    if (ready) continue;
    const earliestRetryAt = pending.reduce(
      (min, j) => (j.nextRetryAt < min ? j.nextRetryAt : min),
      pending[0]!.nextRetryAt
    );
    now = earliestRetryAt;
  }
}

export function resetQueueForTests(): void {
  jobs.length = 0;
  acceptedClaimIds.clear();
  processing = false;
  processorEnabled = false;
  stopPayoutProcessorForTests();
}

export type FlushAllPendingPayoutsResult = {
  recipientsAttempted: number;
  recipientsPaid: number;
  jobsCleared: number;
  totalLuna: string;
  totalNim: string;
  failures: { walletId: string; error: string }[];
  skippedNotConfigured: boolean;
};

function formatLunaAsNim4(luna: bigint): string {
  return (Number(luna) / 100_000).toFixed(4);
}

export function getPendingQueueTotals() {
  return computePendingQueueTotals(jobs);
}

export function getPublicSummary(): PublicPendingPayoutSummary {
  return getPublicPendingPayoutSummary(jobs);
}

export function getAdminPanelSnapshot(): PublicPendingPayoutSnapshot {
  return getPublicPendingPayoutAdminPanelSnapshot(jobs);
}

export function getGlobalSnapshot(): PublicPendingPayoutSnapshot {
  return getPublicPendingPayoutSnapshot(jobs);
}

export function getWalletSnapshot(walletRaw: string): WalletPendingPayoutDetail {
  return getPendingPayoutSnapshotForWallet(jobs, walletRaw);
}

export async function manualBulkPayoutPendingForRecipient(
  walletRaw: string
): Promise<{ txHash: string; jobsCleared: number; totalLuna: string }> {
  const client = chainClient;
  if (!client?.isSignerConfigured()) {
    throw new Error("nim_payout_not_configured");
  }
  const target = normalizeNimWalletId(walletRaw);
  if (!target) throw new Error("invalid_recipient");

  const pendingFor = jobs.filter(
    (j) => j.status === "pending" && normalizeNimWalletId(j.recipientAddress) === target
  );
  if (pendingFor.length === 0) {
    throw new Error("no_pending_jobs");
  }

  for (const j of pendingFor) {
    const live = jobs.find((x) => x.id === j.id);
    if (!live || live.status !== "pending") {
      throw new Error("wallet_payout_race_retry");
    }
  }

  let totalLuna = 0n;
  for (const j of pendingFor) totalLuna += j.amountLuna;

  const idSet = new Set(pendingFor.map((j) => j.id));
  for (const j of pendingFor) {
    const live = jobs.find((x) => x.id === j.id);
    if (live) live.status = "processing";
  }
  saveQueue();

  const recipientAddr = pendingFor[0]!.recipientAddress.trim();

  try {
    const { txHash, state } = await client.sendPayout({
      recipientAddress: recipientAddr,
      amountLuna: totalLuna,
      txMessage: MANUAL_BULK_PAYOUT_TX_MESSAGE,
      claimId: pendingFor[0]!.claimId.slice(0, 12),
      jobId: "manual-bulk",
    });
    const sentAt = Date.now();
    for (let i = jobs.length - 1; i >= 0; i--) {
      if (idSet.has(jobs[i]!.id)) {
        const job = jobs[i]!;
        appendSentHistoryLine(job, txHash, sentAt);
        jobs.splice(i, 1);
      }
    }
    saveQueue();
    adjustBalanceCacheAfterPayout(totalLuna);
    appendManualBulkPayoutLogEntry({
      sentAt,
      recipient: recipientAddr,
      txHash,
      totalLuna: totalLuna.toString(),
      jobsCleared: pendingFor.length,
      state: String(state),
      txMessage: MANUAL_BULK_PAYOUT_TX_MESSAGE,
    });
    return {
      txHash,
      jobsCleared: pendingFor.length,
      totalLuna: totalLuna.toString(),
    };
  } catch (err) {
    for (const job of pendingFor) {
      const live = jobs.find((x) => x.id === job.id);
      if (live) {
        live.status = "pending";
        live.nextRetryAt = Date.now();
      }
    }
    saveQueue();
    throw err;
  }
}

export async function flushAllPendingPayoutsNow(): Promise<FlushAllPendingPayoutsResult> {
  const result: FlushAllPendingPayoutsResult = {
    recipientsAttempted: 0,
    recipientsPaid: 0,
    jobsCleared: 0,
    totalLuna: "0",
    totalNim: formatLunaAsNim4(0n),
    failures: [],
    skippedNotConfigured: false,
  };
  if (!chainClient?.isSignerConfigured()) {
    result.skippedNotConfigured = true;
    console.warn(
      "[payout-service] Daily flush skipped - payout signer not configured"
    );
    return result;
  }

  const recipients: string[] = [];
  const seen = new Set<string>();
  for (const j of jobs) {
    if (j.status !== "pending") continue;
    const k = normalizeNimWalletId(j.recipientAddress);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    recipients.push(j.recipientAddress.trim());
  }

  let totalLuna = 0n;
  for (const recipient of recipients) {
    result.recipientsAttempted += 1;
    try {
      const r = await manualBulkPayoutPendingForRecipient(recipient);
      result.recipientsPaid += 1;
      result.jobsCleared += r.jobsCleared;
      totalLuna += BigInt(r.totalLuna);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "no_pending_jobs" || msg === "wallet_payout_race_retry") continue;
      result.failures.push({ walletId: recipient, error: msg });
      console.error(
        `[payout-service] Daily flush failed for ${recipient.slice(0, 12)}…: ${msg}`
      );
    }
  }
  result.totalLuna = totalLuna.toString();
  result.totalNim = formatLunaAsNim4(totalLuna);
  console.log(
    "[payout-service] Daily flush complete",
    JSON.stringify({
      recipientsAttempted: result.recipientsAttempted,
      recipientsPaid: result.recipientsPaid,
      jobsCleared: result.jobsCleared,
      totalNim: result.totalNim,
      failures: result.failures.length,
    })
  );
  return result;
}
