import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { logGameplayEvent } from "../eventLog.js";
import { NIM_PAYOUT_DATA_DIR, NIM_PAYOUT_QUEUE_FILE } from "./paths.js";
import {
  isNimPayoutSenderConfigured,
  sendNimPayoutTransaction,
  LUNA_PER_NIM,
} from "./sender.js";

export type NimPayoutJobStatus =
  | "pending"
  | "processing"
  | "completed"
  | "dead_letter";

export type NimPayoutJob = {
  id: string;
  claimId: string;
  recipientAddress: string;
  /** Serialized as string in JSON; use BigInt(amountLuna) when loading. */
  amountLuna: bigint;
  createdAt: number;
  attempts: number;
  nextRetryAt: number;
  status: NimPayoutJobStatus;
  lastError?: string;
  txHash?: string;
  roomId: string;
  tileKey: string;
  txMessage?: string;
};

type SerializedJob = Omit<NimPayoutJob, "amountLuna"> & { amountLuna: string };

const jobs: NimPayoutJob[] = [];
let processorTimer: ReturnType<typeof setTimeout> | null = null;
let processing = false;
const PROCESS_INTERVAL_MS = Number(process.env.NIM_PAYOUT_PROCESS_INTERVAL_MS ?? 8000);
const MAX_BACKOFF_MS = Number(process.env.NIM_PAYOUT_MAX_BACKOFF_MS ?? 3_600_000);
const DEAD_LETTER_AFTER_ATTEMPTS = Number(
  process.env.NIM_PAYOUT_DEAD_LETTER_ATTEMPTS ?? 80
);

const DEAD_LETTER_FILE = path.join(NIM_PAYOUT_DATA_DIR, "nim-payout-dead-letter.jsonl");

function ensureDataDir(): void {
  fs.mkdirSync(path.dirname(NIM_PAYOUT_QUEUE_FILE), { recursive: true });
}

function serializeJob(j: NimPayoutJob): SerializedJob {
  return {
    ...j,
    amountLuna: j.amountLuna.toString(),
  };
}

function deserializeJob(s: SerializedJob): NimPayoutJob {
  return {
    ...s,
    amountLuna: BigInt(s.amountLuna),
  };
}

function loadQueueFromDisk(): void {
  try {
    if (!fs.existsSync(NIM_PAYOUT_QUEUE_FILE)) return;
    const raw = fs.readFileSync(NIM_PAYOUT_QUEUE_FILE, "utf8");
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
    console.error("[nim-payout] Failed to load queue:", e);
  }
}

export function flushNimPayoutQueueSync(): void {
  try {
    ensureDataDir();
    const pending = jobs.filter(
      (j) => j.status === "pending" || j.status === "processing"
    );
    fs.writeFileSync(
      NIM_PAYOUT_QUEUE_FILE,
      JSON.stringify(pending.map(serializeJob), null, 0),
      "utf8"
    );
  } catch (e) {
    console.error("[nim-payout] Failed to flush queue:", e);
  }
}

function saveQueue(): void {
  flushNimPayoutQueueSync();
}

function backoffMs(attempts: number): number {
  const base = 4000 * Math.pow(2, Math.min(attempts, 12));
  return Math.min(base, MAX_BACKOFF_MS);
}

/**
 * Enqueue a blockchain payout after a legitimate in-game claim.
 * Deduplicates by `claimId` (one chain payout per claim).
 */
export function enqueueNimPayout(opts: {
  claimId: string;
  recipientAddress: string;
  amountLuna?: bigint;
  roomId: string;
  tileKey: string;
  txMessage?: string;
}): void {
  const amountLuna = opts.amountLuna ?? LUNA_PER_NIM;
  if (
    jobs.some(
      (j) => j.claimId === opts.claimId && j.status !== "completed" && j.status !== "dead_letter"
    )
  ) {
    console.warn(
      `[nim-payout] Duplicate enqueue skipped for claimId=${opts.claimId.slice(0, 12)}…`
    );
    return;
  }

  const now = Date.now();
  const job: NimPayoutJob = {
    id: randomUUID(),
    claimId: opts.claimId,
    recipientAddress: opts.recipientAddress.trim(),
    amountLuna,
    createdAt: now,
    attempts: 0,
    nextRetryAt: now,
    status: "pending",
    roomId: opts.roomId,
    tileKey: opts.tileKey,
    txMessage: opts.txMessage?.trim() || undefined,
  };
  jobs.push(job);
  saveQueue();
  console.log(
    `[nim-payout] Enqueued job ${job.id} claim=${opts.claimId.slice(0, 10)}… → ${job.recipientAddress.slice(0, 12)}…`
  );
}

async function processOne(job: NimPayoutJob): Promise<void> {
  const now = Date.now();
  if (job.nextRetryAt > now) return;

  if (!isNimPayoutSenderConfigured()) {
    job.lastError = "NIM_PAYOUT_PRIVATE_KEY not configured";
    job.nextRetryAt = now + backoffMs(job.attempts);
    job.attempts += 1;
    saveQueue();
    console.warn("[nim-payout] Payout sender not configured — will retry later");
    return;
  }

  job.status = "processing";
  saveQueue();

  try {
    const { txHash, details } = await sendNimPayoutTransaction(
      job.recipientAddress,
      job.amountLuna,
      job.txMessage
    );
    job.txHash = txHash;
    job.lastError = undefined;
    console.log(
      `[nim-payout] Sent ${txHash} state=${details.state} claim=${job.claimId.slice(0, 10)}…`
    );
    logGameplayEvent(
      "nim-payout-worker",
      job.recipientAddress,
      job.roomId,
      "nim_payout_sent",
      {
        claimId: job.claimId,
        txHash,
        state: details.state,
        tileKey: job.tileKey,
        jobId: job.id,
      }
    );
    jobs.splice(jobs.indexOf(job), 1);
    saveQueue();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    job.status = "pending";
    job.attempts += 1;
    job.lastError = msg;
    job.nextRetryAt = Date.now() + backoffMs(job.attempts);

    if (job.attempts >= DEAD_LETTER_AFTER_ATTEMPTS) {
      job.status = "dead_letter";
      console.error(
        `[nim-payout] Dead letter after ${job.attempts} attempts claim=${job.claimId}:`,
        msg
      );
      logGameplayEvent(
        "nim-payout-worker",
        job.recipientAddress,
        job.roomId,
        "nim_payout_dead_letter",
        {
          claimId: job.claimId,
          error: msg,
          attempts: job.attempts,
          tileKey: job.tileKey,
          jobId: job.id,
        }
      );
      try {
        ensureDataDir();
        fs.appendFileSync(
          DEAD_LETTER_FILE,
          `${JSON.stringify({
            ts: Date.now(),
            claimId: job.claimId,
            recipient: job.recipientAddress,
            error: msg,
            attempts: job.attempts,
          })}\n`,
          "utf8"
        );
      } catch (e) {
        console.error("[nim-payout] Failed to append dead-letter file:", e);
      }
      jobs.splice(jobs.indexOf(job), 1);
    } else {
      console.warn(
        `[nim-payout] Send failed (attempt ${job.attempts}): ${msg}`
      );
    }
    saveQueue();
  }
}

async function tick(): Promise<void> {
  if (processing) return;
  const next = jobs.find(
    (j) =>
      (j.status === "pending" || j.status === "processing") &&
      j.nextRetryAt <= Date.now()
  );
  if (!next) return;

  processing = true;
  try {
    await processOne(next);
  } finally {
    processing = false;
  }
}

function scheduleLoop(): void {
  if (processorTimer) return;
  const run = async (): Promise<void> => {
    try {
      await tick();
    } catch (e) {
      console.error("[nim-payout] Processor tick error:", e);
    }
    processorTimer = setTimeout(run, PROCESS_INTERVAL_MS);
  };
  processorTimer = setTimeout(run, PROCESS_INTERVAL_MS);
}

/**
 * Load persisted jobs and start the background processor (single-threaded queue).
 */
export function startNimPayoutProcessor(): void {
  loadQueueFromDisk();
  const n = jobs.filter((j) => j.status === "pending").length;
  if (n > 0) {
    console.log(`[nim-payout] Restored ${n} pending payout job(s)`);
  }
  scheduleLoop();
}
