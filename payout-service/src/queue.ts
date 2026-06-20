import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { AppConfig } from "./config.js";
import { LUNA_PER_NIM } from "./config.js";
import type { ChainClient } from "./chain/types.js";
import { adjustBalanceCacheAfterPayout } from "./balance.js";

export type PayIntentBody = {
  claimId: string;
  recipientAddress: string;
  amountLuna?: string;
  roomId: string;
  tileKey: string;
  txMessage?: string;
};

export type PayoutJobStatus = "pending" | "processing" | "completed";

export type PayoutJob = {
  id: string;
  claimId: string;
  recipientAddress: string;
  amountLuna: bigint;
  createdAt: number;
  sentAt?: number;
  status: PayoutJobStatus;
  txHash?: string;
  roomId: string;
  tileKey: string;
  txMessage?: string;
};

type SerializedJob = Omit<PayoutJob, "amountLuna"> & { amountLuna: string };

const jobs: PayoutJob[] = [];
let processorTimer: ReturnType<typeof setTimeout> | null = null;
let processing = false;
let chainClient: ChainClient | null = null;
let queueFile = "";
let acceptedClaimIdsFile = "";
const acceptedClaimIds = new Set<string>();

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

function serializeJob(j: PayoutJob): SerializedJob {
  return { ...j, amountLuna: j.amountLuna.toString() };
}

function deserializeJob(s: SerializedJob): PayoutJob {
  return { ...s, amountLuna: BigInt(s.amountLuna) };
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
  chainClient = client;
  loadAcceptedClaimIds();
  loadQueueFromDisk();
  for (const job of jobs) {
    acceptedClaimIds.add(job.claimId);
  }
}

export function startPayoutProcessor(intervalMs: number): void {
  if (processorTimer) return;
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
}

function findOldestPending(): PayoutJob | undefined {
  const pending = jobs.filter((j) => j.status === "pending");
  if (pending.length === 0) return undefined;
  let best = pending[0]!;
  for (let i = 1; i < pending.length; i++) {
    const j = pending[i]!;
    if (j.createdAt < best.createdAt) best = j;
  }
  return best;
}

async function processOne(job: PayoutJob): Promise<void> {
  const client = chainClient;
  if (!client) return;

  if (!client.isSignerConfigured()) {
    console.warn("[payout-service] Signer not configured — will retry later");
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
    adjustBalanceCacheAfterPayout(job.amountLuna);
    console.log(
      `[payout-service] Sent ${txHash} state=${state} claim=${job.claimId.slice(0, 10)}…`
    );
    jobs.splice(jobs.indexOf(job), 1);
    saveQueue();
  } catch (err) {
    job.status = "pending";
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[payout-service] Send failed claim=${job.claimId}: ${msg}`);
    saveQueue();
  }
}

async function tick(): Promise<void> {
  if (processing) return;
  processing = true;
  try {
    const next = findOldestPending();
    if (next) await processOne(next);
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
    (j) => j.claimId === claimId && j.status !== "completed"
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
  void tick();
  return { accepted: true, claimId, duplicate: false };
}

export function listPendingJobsForTests(): readonly PayoutJob[] {
  return jobs.filter((j) => j.status === "pending" || j.status === "processing");
}

export function getSendCountForTests(): number {
  return jobs.filter((j) => j.status === "completed").length;
}

export async function drainQueueForTests(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await tick();
    if (!findOldestPending()) break;
    await new Promise((r) => setTimeout(r, 10));
  }
}

export function resetQueueForTests(): void {
  jobs.length = 0;
  acceptedClaimIds.clear();
  processing = false;
  stopPayoutProcessorForTests();
}
