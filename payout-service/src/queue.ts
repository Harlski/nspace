import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { AppConfig } from "./config.js";
import { LUNA_PER_NIM } from "./config.js";
import type { ChainClient, TxLifecycleState } from "./chain/types.js";
import { isDeadState, isValueMovingState } from "./chain/types.js";
import { adjustBalanceCacheAfterPayout } from "./balance.js";
import {
  appendManualBulkPayoutLogEntry,
  appendSentHistoryLine,
  canonicalizeNimAddress,
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
import {
  notifyPayoutDeadLetterAnalytics,
  notifyPayoutSentAnalytics,
} from "./analyticsCallback.js";
import {
  isMiningPayoutHeldForBannedWallet,
  refreshMiningBannedWallets,
} from "./miningBanGate.js";

export type PayIntentBody = {
  claimId: string;
  recipientAddress: string;
  amountLuna?: string;
  roomId: string;
  tileKey: string;
  txMessage?: string;
};

export type PayoutJobStatus =
  | "pending"
  | "processing"
  /** Broadcast on-chain but not yet confirmed. Never re-sent; the reconciliation
   *  pass finalizes it once the transaction settles (or re-queues it only if the
   *  transaction provably died). */
  | "awaiting_confirmation"
  | "completed"
  | "dead_letter";

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
  /** Set when the job is broadcast as part of a combined bulk transaction, so the
   *  reconciliation pass can record it with bulk metadata on confirmation. */
  manualBulk?: boolean;
  bulkTotalLuna?: string;
};

type SerializedJob = Omit<PayoutJob, "amountLuna"> & { amountLuna: string };

const jobs: PayoutJob[] = [];
let processorTimer: ReturnType<typeof setTimeout> | null = null;
let autoBulkTimer: ReturnType<typeof setInterval> | null = null;
let reconcileTimer: ReturnType<typeof setInterval> | null = null;
let processing = false;
let autoBulkRunning = false;
let reconcileRunning = false;
let processorEnabled = false;
let chainClient: ChainClient | null = null;
let queueFile = "";
let acceptedClaimIdsFile = "";
/** Append-only companion; legacy full-array JSON is migrated once at load. */
let acceptedClaimIdsJsonlFile = "";
let deadLetterFile = "";
let needsReviewFile = "";
const acceptedClaimIds = new Set<string>();
let maxBackoffMs = 3_600_000;
let deadLetterAfterAttempts = 80;
let autoBulkAfterMs = 0;
let autoBulkCheckIntervalMs = 300_000;
let reconcileIntervalMs = 60_000;
let unconfirmedReviewMs = 10_800_000;

function ensureDataDir(): void {
  fs.mkdirSync(path.dirname(queueFile), { recursive: true });
}

function rewriteAcceptedClaimIdsJsonlFromSet(): void {
  const dest = acceptedClaimIdsJsonlFile;
  const tmp = `${dest}.${process.pid}.tmp`;
  const body =
    acceptedClaimIds.size === 0
      ? ""
      : `${[...acceptedClaimIds].join("\n")}\n`;
  fs.writeFileSync(tmp, body, "utf8");
  fs.renameSync(tmp, dest);
}

function loadAcceptedClaimIds(): void {
  acceptedClaimIds.clear();
  try {
    if (acceptedClaimIdsJsonlFile && fs.existsSync(acceptedClaimIdsJsonlFile)) {
      const raw = fs.readFileSync(acceptedClaimIdsJsonlFile, "utf8");
      for (const line of raw.split("\n")) {
        const id = line.trim();
        if (id) acceptedClaimIds.add(id);
      }
    }
    if (acceptedClaimIdsFile && fs.existsSync(acceptedClaimIdsFile)) {
      const raw = fs.readFileSync(acceptedClaimIdsFile, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        for (const id of parsed) {
          if (typeof id === "string" && id.trim()) {
            acceptedClaimIds.add(id.trim());
          }
        }
      }
      rewriteAcceptedClaimIdsJsonlFromSet();
      const bak = `${acceptedClaimIdsFile}.pre-jsonl.bak`;
      fs.renameSync(acceptedClaimIdsFile, bak);
      console.log(
        `[payout-service] Migrated accepted-claim-ids.json → .jsonl (${acceptedClaimIds.size} ids); legacy at ${path.basename(bak)}`
      );
    }
  } catch (e) {
    console.error("[payout-service] Failed to load accepted claim ids:", e);
  }
}

/** Append a single id — never rewrite the full set (was multi-MB sync I/O per claim). */
function appendAcceptedClaimId(claimId: string): void {
  try {
    ensureDataDir();
    fs.appendFileSync(acceptedClaimIdsJsonlFile, `${claimId}\n`, "utf8");
  } catch (e) {
    console.error("[payout-service] Failed to append accepted claim id:", e);
  }
}

function rememberAcceptedClaimId(claimId: string): void {
  if (acceptedClaimIds.has(claimId)) return;
  acceptedClaimIds.add(claimId);
  appendAcceptedClaimId(claimId);
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

function appendNeedsReviewAudit(job: PayoutJob, reason: string): void {
  try {
    ensureDataDir();
    fs.appendFileSync(
      needsReviewFile,
      `${JSON.stringify({
        ts: Date.now(),
        reason,
        claimId: job.claimId,
        recipient: job.recipientAddress,
        amountLuna: job.amountLuna.toString(),
        txHash: job.txHash,
        sentAt: job.sentAt,
        jobId: job.id,
        roomId: job.roomId,
        tileKey: job.tileKey,
      })}\n`,
      "utf8"
    );
  } catch (e) {
    console.error("[payout-service] Failed to append needs-review file:", e);
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
      // A job caught mid-send (processing) on shutdown was never confirmed broadcast,
      // so it is safe to retry. Jobs in awaiting_confirmation WERE broadcast and must
      // be preserved as-is so the reconciliation pass can settle them, not re-sent.
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
      (j) =>
        j.status === "pending" ||
        j.status === "processing" ||
        j.status === "awaiting_confirmation"
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
  acceptedClaimIdsJsonlFile = path.join(cfg.dataDir, "accepted-claim-ids.jsonl");
  deadLetterFile = path.join(cfg.dataDir, "nim-payout-dead-letter.jsonl");
  needsReviewFile = path.join(cfg.dataDir, "nim-payout-needs-review.jsonl");
  maxBackoffMs = cfg.maxBackoffMs;
  deadLetterAfterAttempts = cfg.deadLetterAfterAttempts;
  autoBulkAfterMs = cfg.autoBulkAfterMs;
  autoBulkCheckIntervalMs = cfg.autoBulkCheckIntervalMs;
  reconcileIntervalMs = cfg.reconcileIntervalMs;
  unconfirmedReviewMs = cfg.unconfirmedReviewMs;
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

  if (autoBulkAfterMs > 0 && !autoBulkTimer) {
    autoBulkTimer = setInterval(() => {
      void maybeAutoBulkStalePending(Date.now()).catch((e) => {
        console.error("[payout-service] Auto bulk scan error:", e);
      });
    }, autoBulkCheckIntervalMs);
    console.log(
      `[payout-service] Auto bulk payout enabled after ${autoBulkAfterMs}ms (check every ${autoBulkCheckIntervalMs}ms)`
    );
  }

  if (reconcileIntervalMs > 0 && !reconcileTimer) {
    reconcileTimer = setInterval(() => {
      void reconcileUnconfirmedSends(Date.now()).catch((e) => {
        console.error("[payout-service] Reconcile scan error:", e);
      });
    }, reconcileIntervalMs);
  }
}

export function stopPayoutProcessorForTests(): void {
  if (processorTimer) {
    clearTimeout(processorTimer);
    processorTimer = null;
  }
  if (autoBulkTimer) {
    clearInterval(autoBulkTimer);
    autoBulkTimer = null;
  }
  if (reconcileTimer) {
    clearInterval(reconcileTimer);
    reconcileTimer = null;
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
    (j) =>
      j.status === "pending" &&
      j.nextRetryAt <= now &&
      !isMiningPayoutHeldForBannedWallet(j.recipientAddress, j.tileKey)
  );
  return pickOldestReadyJob(ready);
}

async function processOne(job: PayoutJob, now: number = Date.now()): Promise<void> {
  const client = chainClient;
  if (!client) return;

  if (job.nextRetryAt > now) return;

  if (
    isMiningPayoutHeldForBannedWallet(job.recipientAddress, job.tileKey)
  ) {
    return;
  }

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
    const res = await client.sendPayout({
      recipientAddress: job.recipientAddress,
      amountLuna: job.amountLuna,
      txMessage: job.txMessage,
      claimId: job.claimId,
      jobId: job.id,
    });

    // The transaction is dead and moved no funds - safe to retry.
    if (isDeadState(res.state)) {
      revertJobForRetry(job, `tx ${res.state}`, now);
      saveQueue();
      return;
    }

    // The transaction was broadcast. Its funds are out (or in-flight) and it must
    // never be re-sent. Settle now if confirmed, otherwise park it for the
    // reconciliation pass.
    const sentAt = Date.now();
    if (res.state === "confirmed" || res.state === "included") {
      finalizeSentJob(job, res.txHash, sentAt, { state: res.state });
      console.log(
        `[payout-service] Sent ${res.txHash} state=${res.state} claim=${job.claimId.slice(0, 10)}…`
      );
    } else {
      job.status = "awaiting_confirmation";
      job.txHash = res.txHash;
      job.sentAt = sentAt;
      job.lastError = undefined;
      console.log(
        `[payout-service] Broadcast (unconfirmed) ${res.txHash} claim=${job.claimId.slice(0, 10)}… - awaiting confirmation`
      );
    }
    saveQueue();
  } catch (err) {
    // sendPayout only rejects when nothing was broadcast, so retrying is safe.
    const msg = err instanceof Error ? err.message : String(err);
    revertJobForRetry(job, msg, now);
    console.warn(
      `[payout-service] Send failed (attempt ${job.attempts}) claim=${job.claimId}: ${msg}`
    );
    saveQueue();
  }
}

/** Record a broadcast-and-settled job to history/analytics and remove it from the queue. */
function finalizeSentJob(
  job: PayoutJob,
  txHash: string,
  sentAt: number,
  extras: { state: TxLifecycleState; manualBulk?: boolean; bulkTotalLuna?: string }
): void {
  job.sentAt = sentAt;
  job.txHash = txHash;
  job.status = "completed";
  appendSentHistoryLine(job, txHash, sentAt, {
    state: String(extras.state),
    manualBulk: extras.manualBulk,
    bulkTotalLuna: extras.bulkTotalLuna,
  });
  notifyPayoutSentAnalytics({
    job,
    txHash,
    sentAt,
    state: String(extras.state),
    manualBulk: extras.manualBulk,
    bulkTotalLuna: extras.bulkTotalLuna,
  });
  adjustBalanceCacheAfterPayout(job.amountLuna);
  const idx = jobs.indexOf(job);
  if (idx >= 0) jobs.splice(idx, 1);
}

/** Move a not-yet-broadcast job back to pending with backoff, dead-lettering if exhausted. */
function revertJobForRetry(job: PayoutJob, error: string, now: number): void {
  job.status = "pending";
  job.attempts += 1;
  job.lastError = error;
  job.nextRetryAt = now + backoffMs(job.attempts);
  job.txHash = undefined;
  maybeDeadLetter(job, error);
}

function maybeDeadLetter(job: PayoutJob, error: string): void {
  if (job.attempts < deadLetterAfterAttempts) return;
  job.status = "dead_letter";
  console.error(
    `[payout-service] Dead letter after ${job.attempts} attempts claim=${job.claimId}:`,
    error
  );
  appendDeadLetterAudit(job, error);
  notifyPayoutDeadLetterAnalytics({ job, error });
  jobs.splice(jobs.indexOf(job), 1);
}

async function tick(now: number = Date.now()): Promise<void> {
  if (processing) return;
  processing = true;
  try {
    await refreshMiningBannedWallets();
    const next = findNextReadyJob(now);
    if (next) await processOne(next, now);
  } finally {
    processing = false;
  }
}

/**
 * Settle transactions that were broadcast but not confirmed within the send
 * timeout. For each distinct in-flight txHash we ask the chain once:
 *  - confirmed / included -> finalize every job on that tx (records history).
 *  - expired / invalidated -> the tx is provably dead, so re-queue its jobs.
 *  - still pending / unknown past the review window -> escalate to manual review
 *    (never auto re-queued, to guarantee we cannot double-pay a tx the node has
 *    merely pruned from its lookup index).
 */
export async function reconcileUnconfirmedSends(
  now: number = Date.now()
): Promise<{ finalized: number; reQueued: number; escalated: number }> {
  const result = { finalized: 0, reQueued: 0, escalated: 0 };
  const client = chainClient;
  if (!client || reconcileRunning) return result;

  const byTx = new Map<string, PayoutJob[]>();
  for (const j of jobs) {
    if (j.status !== "awaiting_confirmation" || !j.txHash) continue;
    const group = byTx.get(j.txHash);
    if (group) group.push(j);
    else byTx.set(j.txHash, [j]);
  }
  if (byTx.size === 0) return result;

  reconcileRunning = true;
  try {
    for (const [txHash, group] of byTx) {
      let state: TxLifecycleState;
      try {
        state = await client.getTransactionState(txHash);
      } catch {
        state = "unknown";
      }

      if (state === "confirmed" || state === "included") {
        const bulkJob = group.find((j) => j.manualBulk);
        const bulkRecipient = bulkJob?.recipientAddress.trim();
        const bulkSentAt = bulkJob?.sentAt ?? now;
        const bulkTotalLuna = bulkJob?.bulkTotalLuna;
        for (const job of group) {
          finalizeSentJob(job, txHash, job.sentAt ?? now, {
            state,
            manualBulk: job.manualBulk,
            bulkTotalLuna: job.bulkTotalLuna,
          });
          result.finalized += 1;
        }
        if (bulkJob && bulkRecipient && bulkTotalLuna) {
          appendManualBulkPayoutLogEntry({
            sentAt: bulkSentAt,
            recipient: bulkRecipient,
            txHash,
            totalLuna: bulkTotalLuna,
            jobsCleared: group.length,
            state: String(state),
            txMessage: MANUAL_BULK_PAYOUT_TX_MESSAGE,
          });
        }
        console.log(
          `[payout-service] Confirmed unconfirmed payout ${txHash.slice(0, 16)}… (${group.length} job(s))`
        );
        continue;
      }

      if (isDeadState(state)) {
        for (const job of group) {
          job.status = "pending";
          job.attempts += 1;
          job.lastError = `tx ${state} - re-queued`;
          job.nextRetryAt = now;
          job.txHash = undefined;
          job.sentAt = undefined;
          job.manualBulk = undefined;
          job.bulkTotalLuna = undefined;
          result.reQueued += 1;
        }
        console.warn(
          `[payout-service] Re-queued ${group.length} job(s) after tx ${state} ${txHash.slice(0, 16)}…`
        );
        continue;
      }

      // Still "new"/"pending"/"unknown": leave it for a future pass unless it has
      // been in-flight far longer than the on-chain validity window (~2h), which
      // means the node cannot resolve it either way and a human must decide.
      const broadcastAt = Math.min(...group.map((j) => j.sentAt ?? now));
      if (now - broadcastAt >= unconfirmedReviewMs) {
        for (const job of group) {
          appendNeedsReviewAudit(job, `unconfirmed tx state=${state}`);
          const idx = jobs.indexOf(job);
          if (idx >= 0) jobs.splice(idx, 1);
          result.escalated += 1;
        }
        console.error(
          `[payout-service] Escalated ${group.length} job(s) to manual review - tx ${txHash.slice(0, 16)}… still ${state} after ${Math.round((now - broadcastAt) / 60000)}m`
        );
      }
    }
    if (result.finalized || result.reQueued || result.escalated) saveQueue();
  } finally {
    reconcileRunning = false;
  }
  return result;
}

export function enqueuePayIntent(body: PayIntentBody): {
  accepted: true;
  claimId: string;
  duplicate: boolean;
} {
  const claimId = String(body.claimId ?? "").trim();
  const recipientAddress = canonicalizeNimAddress(
    String(body.recipientAddress ?? "")
  );
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
  autoBulkRunning = false;
  reconcileRunning = false;
  processorEnabled = false;
  stopPayoutProcessorForTests();
}

export async function runReconcileForTests(now?: number): Promise<{
  finalized: number;
  reQueued: number;
  escalated: number;
}> {
  return reconcileUnconfirmedSends(now);
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
    (j) =>
      j.status === "pending" &&
      normalizeNimWalletId(j.recipientAddress) === target &&
      !isMiningPayoutHeldForBannedWallet(j.recipientAddress, j.tileKey)
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
  const bulkTotalLuna = totalLuna.toString();

  const revertAll = (): void => {
    for (const job of pendingFor) {
      const live = jobs.find((x) => x.id === job.id);
      if (live && live.status === "processing") {
        live.status = "pending";
        live.nextRetryAt = Date.now();
      }
    }
    saveQueue();
  };

  let res;
  try {
    res = await client.sendPayout({
      recipientAddress: recipientAddr,
      amountLuna: totalLuna,
      txMessage: MANUAL_BULK_PAYOUT_TX_MESSAGE,
      claimId: pendingFor[0]!.claimId.slice(0, 12),
      jobId: "manual-bulk",
    });
  } catch (err) {
    // Nothing was broadcast - safe to retry.
    revertAll();
    throw err;
  }

  // The combined transaction is dead and moved no funds - safe to retry.
  if (isDeadState(res.state)) {
    revertAll();
    throw new Error(`tx_${res.state}`);
  }

  const txHash = res.txHash;
  const sentAt = Date.now();
  const targets = jobs.filter((j) => idSet.has(j.id));

  if (res.state === "confirmed" || res.state === "included") {
    for (const job of targets) {
      finalizeSentJob(job, txHash, sentAt, {
        state: res.state,
        manualBulk: true,
        bulkTotalLuna,
      });
    }
    saveQueue();
    appendManualBulkPayoutLogEntry({
      sentAt,
      recipient: recipientAddr,
      txHash,
      totalLuna: bulkTotalLuna,
      jobsCleared: pendingFor.length,
      state: String(res.state),
      txMessage: MANUAL_BULK_PAYOUT_TX_MESSAGE,
    });
  } else {
    // Broadcast but unconfirmed: park each job for the reconciliation pass. Never
    // re-sent; the manual-bulk log and balance adjust happen once it confirms.
    for (const job of targets) {
      job.status = "awaiting_confirmation";
      job.txHash = txHash;
      job.sentAt = sentAt;
      job.manualBulk = true;
      job.bulkTotalLuna = bulkTotalLuna;
      job.lastError = undefined;
    }
    saveQueue();
    console.log(
      `[payout-service] Bulk broadcast (unconfirmed) ${txHash.slice(0, 16)}… ${recipientAddr.slice(0, 12)}… - awaiting confirmation`
    );
  }

  return {
    txHash,
    jobsCleared: pendingFor.length,
    totalLuna: bulkTotalLuna,
  };
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

function recipientsWithStalePending(now: number): string[] {
  if (autoBulkAfterMs <= 0) return [];
  const cutoff = now - autoBulkAfterMs;
  const byRecipient = new Map<string, { oldest: number; address: string }>();
  for (const j of jobs) {
    if (j.status !== "pending") continue;
    if (isMiningPayoutHeldForBannedWallet(j.recipientAddress, j.tileKey)) {
      continue;
    }
    const k = normalizeNimWalletId(j.recipientAddress);
    if (!k) continue;
    const prev = byRecipient.get(k);
    const oldest = prev ? Math.min(prev.oldest, j.createdAt) : j.createdAt;
    byRecipient.set(k, {
      oldest,
      address: j.recipientAddress.trim(),
    });
  }
  const out: string[] = [];
  for (const row of byRecipient.values()) {
    if (row.oldest <= cutoff) out.push(row.address);
  }
  return out;
}

/** Bulk-settle recipients whose oldest pending job has waited at least `autoBulkAfterMs`. */
export async function maybeAutoBulkStalePending(
  now: number = Date.now()
): Promise<{ recipientsPaid: number; jobsCleared: number }> {
  const result = { recipientsPaid: 0, jobsCleared: 0 };
  if (autoBulkAfterMs <= 0 || autoBulkRunning || processing) return result;
  if (!chainClient?.isSignerConfigured()) return result;

  const recipients = recipientsWithStalePending(now);
  if (recipients.length === 0) return result;

  autoBulkRunning = true;
  try {
    for (const recipient of recipients) {
      try {
        const r = await manualBulkPayoutPendingForRecipient(recipient);
        result.recipientsPaid += 1;
        result.jobsCleared += r.jobsCleared;
        console.log(
          `[payout-service] Auto bulk payout (${autoBulkAfterMs}ms age) ${recipient.slice(0, 12)}…`,
          JSON.stringify({
            jobsCleared: r.jobsCleared,
            totalLuna: r.totalLuna,
            txHash: r.txHash.slice(0, 16) + "…",
          })
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === "no_pending_jobs" || msg === "wallet_payout_race_retry") continue;
        console.warn(
          `[payout-service] Auto bulk payout failed for ${recipient.slice(0, 12)}…: ${msg}`
        );
      }
    }
  } finally {
    autoBulkRunning = false;
  }
  return result;
}
