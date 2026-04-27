import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  logGameplayEvent,
  listRecentNimPayoutSentFromEventLog,
} from "../eventLog.js";
import {
  NIM_PAYOUT_DATA_DIR,
  NIM_PAYOUT_QUEUE_FILE,
  NIM_PAYOUT_SENT_HISTORY_FILE,
} from "./paths.js";
import {
  isNimPayoutSenderConfigured,
  getNimPayoutWalletBalanceLuna,
  sendNimPayoutTransaction,
  LUNA_PER_NIM,
} from "./sender.js";
import { nimiqIdenticonDataUrl } from "../nimiqIdenticonServer.js";

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
  /** Wall-clock ms when the job was enqueued (`Date.now()`). */
  createdAt: number;
  /** Wall-clock ms when the tx was broadcast and accepted as included/confirmed (set on success only). */
  sentAt?: number;
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
/** How many payout attempts to run back-to-back each wake-up (still one at a time, for hot-wallet nonce safety). */
const RAW_BURST = Number(process.env.NIM_PAYOUT_BURST_PER_TICK ?? 8);
const BURST_PER_TICK = Math.min(
  100,
  Math.max(1, Number.isFinite(RAW_BURST) ? Math.floor(RAW_BURST) : 8)
);
const MAX_BACKOFF_MS = Number(process.env.NIM_PAYOUT_MAX_BACKOFF_MS ?? 3_600_000);
const DEAD_LETTER_AFTER_ATTEMPTS = Number(
  process.env.NIM_PAYOUT_DEAD_LETTER_ATTEMPTS ?? 80
);

/** Background refresh so `peekNimPayoutBalanceCacheLuna` is usually non-null (claim gate avoids mutex). */
const NIM_BALANCE_BACKGROUND_REFRESH_MS = Math.max(
  10_000,
  Number(process.env.NIM_BALANCE_BACKGROUND_REFRESH_MS ?? 45_000)
);

const DEAD_LETTER_FILE = path.join(NIM_PAYOUT_DATA_DIR, "nim-payout-dead-letter.jsonl");

/** Per-recipient append-only log (last N lines read on wallet pending-payouts API). */
const RECIPIENT_SENT_DIR = path.join(NIM_PAYOUT_DATA_DIR, "nim-payout-recipient-sent");

/** When merging wallet history, scan up to this many **global** tail lines for older sends (pre per-wallet file). */
const WALLET_GLOBAL_SENT_TAIL_LINES = Math.min(
  2_000_000,
  Math.max(
    2000,
    Number(process.env.NIM_PAYOUT_WALLET_GLOBAL_SENT_TAIL_LINES ?? 250_000)
  )
);

const HISTORY_ROWS_CAP = Math.min(
  2000,
  Math.max(1, Number(process.env.NIM_PAYOUT_PUBLIC_HISTORY_LIMIT ?? 20))
);
const HISTORY_EVENT_DAYS = Math.min(
  90,
  Math.max(7, Number(process.env.NIM_PAYOUT_PUBLIC_HISTORY_EVENT_DAYS ?? 30))
);

type SentHistoryDiskLine = {
  sentAt: number;
  enqueuedAt: number;
  recipient: string;
  amountLuna: string;
  txHash: string;
  claimId: string;
};

type SentHistoryMerged = {
  sentAt: number;
  recipient: string;
  txHash: string;
  amountLuna?: string;
};

function readSentHistoryFromDisk(maxLines: number): SentHistoryDiskLine[] {
  try {
    if (!fs.existsSync(NIM_PAYOUT_SENT_HISTORY_FILE)) return [];
    const raw = fs.readFileSync(NIM_PAYOUT_SENT_HISTORY_FILE, "utf8");
    const lines = raw.split("\n").filter((l) => l.trim());
    const tail = lines.slice(Math.max(0, lines.length - maxLines));
    const out: SentHistoryDiskLine[] = [];
    for (const line of tail) {
      try {
        const o = JSON.parse(line) as SentHistoryDiskLine;
        if (
          typeof o.txHash === "string" &&
          o.txHash &&
          typeof o.sentAt === "number" &&
          typeof o.recipient === "string" &&
          typeof o.amountLuna === "string" &&
          /^\d+$/.test(o.amountLuna)
        ) {
          out.push(o);
        }
      } catch {
        /* skip bad line */
      }
    }
    return out;
  } catch {
    return [];
  }
}

function recipientSentHistoryPath(normalizedRecipient: string): string {
  const id = normalizeNimWalletId(normalizedRecipient);
  return path.join(RECIPIENT_SENT_DIR, `${id}.jsonl`);
}

function appendRecipientSentHistoryLine(
  normalizedRecipient: string,
  line: SentHistoryDiskLine
): void {
  try {
    ensureDataDir();
    fs.mkdirSync(RECIPIENT_SENT_DIR, { recursive: true });
    const fp = recipientSentHistoryPath(normalizedRecipient);
    fs.appendFileSync(fp, `${JSON.stringify(line)}\n`, "utf8");
  } catch (e) {
    console.error("[nim-payout] Failed to append recipient sent-history:", e);
  }
}

function readRecipientSentHistoryLines(
  normalizedRecipient: string,
  maxLines: number
): SentHistoryDiskLine[] {
  try {
    const fp = recipientSentHistoryPath(normalizedRecipient);
    if (!fs.existsSync(fp)) return [];
    const raw = fs.readFileSync(fp, "utf8");
    const lines = raw.split("\n").filter((l) => l.trim());
    const tail = lines.slice(Math.max(0, lines.length - maxLines));
    const out: SentHistoryDiskLine[] = [];
    for (const line of tail) {
      try {
        const o = JSON.parse(line) as SentHistoryDiskLine;
        if (
          typeof o.txHash === "string" &&
          o.txHash &&
          typeof o.sentAt === "number" &&
          typeof o.recipient === "string" &&
          typeof o.amountLuna === "string" &&
          /^\d+$/.test(o.amountLuna)
        ) {
          out.push(o);
        }
      } catch {
        /* skip */
      }
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Successful sends to one wallet: per-recipient log (survives restarts), tail of global
 * `nim-payout-sent.jsonl`, and gameplay event-log backfill — deduped by `txHash`.
 */
function collectWalletSentHistory(
  normalizedTarget: string,
  maxRecords: number
): SentHistoryMerged[] {
  const byTx = new Map<string, SentHistoryMerged>();
  const push = (r: SentHistoryMerged): void => {
    const prev = byTx.get(r.txHash);
    if (!prev || r.sentAt >= prev.sentAt) {
      byTx.set(r.txHash, r);
    }
  };
  for (const d of readRecipientSentHistoryLines(
    normalizedTarget,
    Math.max(maxRecords * 4, 500)
  )) {
    if (normalizeNimWalletId(d.recipient) !== normalizedTarget) continue;
    push({
      sentAt: d.sentAt,
      recipient: d.recipient,
      txHash: d.txHash,
      amountLuna: d.amountLuna,
    });
  }
  for (const d of readSentHistoryFromDisk(WALLET_GLOBAL_SENT_TAIL_LINES)) {
    if (normalizeNimWalletId(d.recipient) !== normalizedTarget) continue;
    push({
      sentAt: d.sentAt,
      recipient: d.recipient,
      txHash: d.txHash,
      amountLuna: d.amountLuna,
    });
  }
  for (const e of listRecentNimPayoutSentFromEventLog(
    HISTORY_EVENT_DAYS,
    Math.max(maxRecords * 2, 200)
  )) {
    if (normalizeNimWalletId(e.recipient) !== normalizedTarget) continue;
    push({
      sentAt: e.sentAt,
      recipient: e.recipient,
      txHash: e.txHash,
      amountLuna: e.amountLuna,
    });
  }
  return [...byTx.values()]
    .sort((a, b) => b.sentAt - a.sentAt)
    .slice(0, Math.max(1, maxRecords));
}

function appendSentHistoryLine(job: NimPayoutJob, txHash: string, sentAt: number): void {
  try {
    ensureDataDir();
    const line: SentHistoryDiskLine = {
      sentAt,
      enqueuedAt: job.createdAt,
      recipient: job.recipientAddress,
      amountLuna: job.amountLuna.toString(),
      txHash,
      claimId: job.claimId,
    };
    fs.appendFileSync(NIM_PAYOUT_SENT_HISTORY_FILE, `${JSON.stringify(line)}\n`, "utf8");
    appendRecipientSentHistoryLine(
      normalizeNimWalletId(job.recipientAddress),
      line
    );
  } catch (e) {
    console.error("[nim-payout] Failed to append sent-history file:", e);
  }
}

/** Newest sends first, capped at `limit`. Disk lines override same-tx event rows. */
function mergeSentHistoryRecords(limit: number): SentHistoryMerged[] {
  const fromDisk = readSentHistoryFromDisk(Math.min(limit * 4, 8000));
  const byTx = new Map<string, SentHistoryMerged>();
  for (const e of listRecentNimPayoutSentFromEventLog(HISTORY_EVENT_DAYS, limit * 3)) {
    byTx.set(e.txHash, {
      sentAt: e.sentAt,
      recipient: e.recipient,
      txHash: e.txHash,
      amountLuna: e.amountLuna,
    });
  }
  for (const d of fromDisk) {
    byTx.set(d.txHash, {
      sentAt: d.sentAt,
      recipient: d.recipient,
      txHash: d.txHash,
      amountLuna: d.amountLuna,
    });
  }
  return [...byTx.values()].sort((a, b) => b.sentAt - a.sentAt).slice(0, limit);
}

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
    `[nim-payout] Enqueued job ${job.id} enqueuedAt=${job.createdAt} claim=${opts.claimId.slice(0, 10)}… → ${job.recipientAddress.slice(0, 12)}…`
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
    if (process.env.NIM_PAYOUT_TX_TRACE === "1") {
      console.log(
        `[nim-payout-tx] worker_before_send job=${job.id.slice(0, 8)} claim=${job.claimId.slice(0, 10)}… sinceEnqueueMs=${Date.now() - job.createdAt} amountLuna=${job.amountLuna.toString()}`
      );
    }
    const { txHash, details } = await sendNimPayoutTransaction(
      job.recipientAddress,
      job.amountLuna,
      job.txMessage,
      { jobId: job.id, claimId: job.claimId }
    );
    const sentAt = Date.now();
    job.sentAt = sentAt;
    job.txHash = txHash;
    job.lastError = undefined;
    const queueToSendMs = sentAt - job.createdAt;
    console.log(
      `[nim-payout] Sent ${txHash} state=${details.state} enqueuedAt=${job.createdAt} sentAt=${sentAt} queueToSendMs=${queueToSendMs} claim=${job.claimId.slice(0, 10)}…`
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
        enqueuedAt: job.createdAt,
        sentAt,
        queueToSendMs,
        amountLuna: job.amountLuna.toString(),
      }
    );
    appendSentHistoryLine(job, txHash, sentAt);
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
            enqueuedAt: job.createdAt,
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

function findNextReadyJob(): NimPayoutJob | undefined {
  const now = Date.now();
  return jobs.find(
    (j) =>
      (j.status === "pending" || j.status === "processing") &&
      j.nextRetryAt <= now
  );
}

async function tick(): Promise<void> {
  if (processing) return;
  processing = true;
  try {
    for (let i = 0; i < BURST_PER_TICK; i++) {
      const next = findNextReadyJob();
      if (!next) break;
      await processOne(next);
    }
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

  if (isNimPayoutSenderConfigured()) {
    const tick = (): void => {
      void getNimPayoutWalletBalanceLuna().catch(() => {
        /* ignore — next interval or claim path will retry */
      });
    };
    setTimeout(tick, 3000);
    setInterval(tick, NIM_BALANCE_BACKGROUND_REFRESH_MS);
  }
}

/** Public API row: Nimiq `@nimiq/identicons` (SVG base64 data URL). */
export type PublicPendingPayoutRow = {
  /** ISO 8601 UTC when the payout was enqueued. */
  time: string;
  /** `data:image/svg+xml;base64,...` from `Identicons.toDataUrl` (see NIMIQDESIGN.md). */
  identicon: string;
  walletId: string;
  amountNim: string;
};

/** Successful send shown in public history (newest first in `historyRows`). */
export type PublicPayoutHistoryRow = {
  /** ISO 8601 UTC when the transaction was broadcast / confirmed (same as gameplay `sentAt`). */
  time: string;
  identicon: string;
  walletId: string;
  amountNim: string;
  txHash: string;
};

export type PublicPendingPayoutSnapshot = {
  allSent: boolean;
  /** Count of jobs still `pending` or `processing` (same as `rows.length` when not `allSent`). */
  pendingTotal: number;
  /** Non-null when `rows` is empty — friendly status for humans. */
  message: string | null;
  rows: PublicPendingPayoutRow[];
  /** Successful sends (disk log + gameplay events); capped by env (default 20). */
  historyRows: PublicPayoutHistoryRow[];
};

/** Anonymous API: queue size + sends completed today (UTC calendar day). */
export type PublicPendingPayoutSummary = {
  mode: "summary";
  pendingTotal: number;
  processedToday: number;
  allSent: boolean;
  message: string | null;
};

/** Authenticated API: same row shapes as {@link PublicPendingPayoutSnapshot}, scoped to one wallet. */
export type WalletPendingPayoutDetail = PublicPendingPayoutSnapshot & {
  mode: "wallet";
  processedToday: number;
};

const WALLET_PENDING_ROWS_CAP = 20;
const WALLET_HISTORY_ROWS_CAP = 20;

function normalizeNimWalletId(w: string): string {
  return String(w || "").replace(/\s+/g, "").toUpperCase();
}

function utcDayStartMs(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function formatLunaAsNim4(luna: bigint): string {
  return (Number(luna) / 100_000).toFixed(4);
}

/**
 * Snapshot for public dashboards: pending + processing jobs, plus recent
 * successful sends (no internal errors / retry metadata on pending rows).
 */
function countSendsOnUtcDay(
  records: SentHistoryMerged[],
  dayStartMs: number
): number {
  const dayEnd = dayStartMs + 86400000;
  return records.reduce((n, r) => {
    return r.sentAt >= dayStartMs && r.sentAt < dayEnd ? n + 1 : n;
  }, 0);
}

/**
 * Public aggregate only (no per-wallet rows). Used when the request has no valid session.
 */
export async function getPublicPendingPayoutSummary(): Promise<PublicPendingPayoutSummary> {
  const now = new Date();
  const day0 = utcDayStartMs(now);
  const historyForCount = mergeSentHistoryRecords(4000);
  const processedToday = countSendsOnUtcDay(historyForCount, day0);

  const pending = jobs.filter(
    (j) => j.status === "pending" || j.status === "processing"
  );
  if (pending.length === 0) {
    return {
      mode: "summary",
      pendingTotal: 0,
      processedToday,
      allSent: true,
      message: "All pending transactions have been sent.",
    };
  }
  return {
    mode: "summary",
    pendingTotal: pending.length,
    processedToday,
    allSent: false,
    message: null,
  };
}

/**
 * Full global queue + recent history (legacy / operator dashboards).
 * Prefer {@link getPublicPendingPayoutSummary} for unauthenticated clients.
 */
export async function getPublicPendingPayoutSnapshot(): Promise<PublicPendingPayoutSnapshot> {
  const historySource = mergeSentHistoryRecords(HISTORY_ROWS_CAP);
  const historyRows: PublicPayoutHistoryRow[] = await Promise.all(
    historySource.map(async (r) => ({
      time: new Date(r.sentAt).toISOString(),
      identicon: await nimiqIdenticonDataUrl(r.recipient),
      walletId: r.recipient,
      amountNim:
        r.amountLuna && /^\d+$/.test(r.amountLuna)
          ? formatLunaAsNim4(BigInt(r.amountLuna))
          : "—",
      txHash: r.txHash,
    }))
  );

  const pending = jobs.filter(
    (j) => j.status === "pending" || j.status === "processing"
  );
  pending.sort((a, b) => a.createdAt - b.createdAt);
  if (pending.length === 0) {
    return {
      allSent: true,
      pendingTotal: 0,
      message: "All pending transactions have been sent.",
      rows: [],
      historyRows,
    };
  }
  const rows: PublicPendingPayoutRow[] = await Promise.all(
    pending.map(async (j) => ({
      time: new Date(j.createdAt).toISOString(),
      identicon: await nimiqIdenticonDataUrl(j.recipientAddress),
      walletId: j.recipientAddress,
      amountNim: formatLunaAsNim4(j.amountLuna),
    }))
  );
  return {
    allSent: false,
    pendingTotal: pending.length,
    message: null,
    rows,
    historyRows,
  };
}

/**
 * Pending + recent completed rows for a single recipient (JWT `sub`), capped for UI.
 */
export async function getPendingPayoutSnapshotForWallet(
  walletRaw: string
): Promise<WalletPendingPayoutDetail> {
  const target = normalizeNimWalletId(walletRaw);
  const now = new Date();
  const day0 = utcDayStartMs(now);
  const historyMerged = collectWalletSentHistory(target, 20_000);
  const processedToday = countSendsOnUtcDay(historyMerged, day0);
  const historySlice = historyMerged.slice(0, WALLET_HISTORY_ROWS_CAP);
  const historyRows: PublicPayoutHistoryRow[] = await Promise.all(
    historySlice.map(async (r) => ({
      time: new Date(r.sentAt).toISOString(),
      identicon: await nimiqIdenticonDataUrl(r.recipient),
      walletId: r.recipient,
      amountNim:
        r.amountLuna && /^\d+$/.test(r.amountLuna)
          ? formatLunaAsNim4(BigInt(r.amountLuna))
          : "—",
      txHash: r.txHash,
    }))
  );

  const pending = jobs
    .filter(
      (j) =>
        (j.status === "pending" || j.status === "processing") &&
        normalizeNimWalletId(j.recipientAddress) === target
    )
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, WALLET_PENDING_ROWS_CAP);
  const rows: PublicPendingPayoutRow[] = await Promise.all(
    pending.map(async (j) => ({
      time: new Date(j.createdAt).toISOString(),
      identicon: await nimiqIdenticonDataUrl(j.recipientAddress),
      walletId: j.recipientAddress,
      amountNim: formatLunaAsNim4(j.amountLuna),
    }))
  );
  const allSent = pending.length === 0;
  return {
    mode: "wallet",
    allSent,
    pendingTotal: pending.length,
    message: null,
    rows,
    historyRows,
    processedToday,
  };
}
