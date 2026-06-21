import fs from "node:fs";
import path from "node:path";
import type { AppConfig } from "./config.js";
import { LUNA_PER_NIM } from "./config.js";
type SnapshotJob = {
  claimId: string;
  recipientAddress: string;
  amountLuna: bigint;
  createdAt: number;
  status: string;
};

export const MANUAL_BULK_PAYOUT_TX_MESSAGE =
  "Nimiq Space manual payout. Thanks for playing :)";

const MANUAL_BULK_LOG_TAIL_LINES = 800;
const MANUAL_BULK_HISTORY_API_CAP = 25;
const PENDING_PAYOUT_API_PENDING_ROW_CAP = 10;
const PENDING_PAYOUT_API_HISTORY_ROW_CAP = 5;

let sentHistoryFile = "";
let manualBulkLogFile = "";
let recipientSentDir = "";

export type SentHistoryDiskLine = {
  sentAt: number;
  enqueuedAt: number;
  recipient: string;
  amountLuna: string;
  txHash: string;
  claimId: string;
};

export type SentHistoryMerged = {
  sentAt: number;
  recipient: string;
  txHash: string;
  amountLuna?: string;
};

export type PublicPendingPayoutRow = {
  time: string;
  identicon: string;
  walletId: string;
  amountNim: string;
};

export type PublicPayoutHistoryRow = {
  time: string;
  identicon: string;
  walletId: string;
  amountNim: string;
  txHash: string;
};

export type PendingByRecipientSummaryRow = {
  walletId: string;
  jobCount: number;
  amountLuna: string;
  amountNim: string;
};

export type ManualBulkPayoutHistoryRow = {
  time: string;
  walletId: string;
  amountNim: string;
  jobsCleared: number;
  state: string;
  txHash: string;
  txMessage: string;
};

type ManualBulkLogDisk = {
  sentAt: number;
  recipient: string;
  txHash: string;
  totalLuna: string;
  jobsCleared: number;
  state: string;
  txMessage?: string;
};

export type PublicPendingPayoutSnapshot = {
  allSent: boolean;
  pendingTotal: number;
  message: string | null;
  rows: PublicPendingPayoutRow[];
  historyRows: PublicPayoutHistoryRow[];
  pendingByRecipient?: PendingByRecipientSummaryRow[];
  manualBulkHistory?: ManualBulkPayoutHistoryRow[];
};

export type PublicPendingPayoutSummary = {
  mode: "summary";
  pendingTotal: number;
  processedToday: number;
  allSent: boolean;
  message: string | null;
};

export type WalletPendingPayoutDetail = PublicPendingPayoutSnapshot & {
  mode: "wallet";
  processedToday: number;
};

export function initHistoryPaths(cfg: AppConfig): void {
  sentHistoryFile = path.join(cfg.dataDir, "nim-payout-sent.jsonl");
  manualBulkLogFile = path.join(cfg.dataDir, "nim-payout-manual-bulk.jsonl");
  recipientSentDir = path.join(cfg.dataDir, "nim-payout-recipient-sent");
}

function ensureDataDir(): void {
  fs.mkdirSync(path.dirname(sentHistoryFile), { recursive: true });
}

export function normalizeNimWalletId(w: string): string {
  return String(w || "").replace(/\s+/g, "").toUpperCase();
}

export function formatLunaAsNim4(luna: bigint): string {
  return (Number(luna) / 100_000).toFixed(4);
}

function utcDayStartMs(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function readSentHistoryFromDisk(maxLines: number): SentHistoryDiskLine[] {
  try {
    if (!fs.existsSync(sentHistoryFile)) return [];
    const raw = fs.readFileSync(sentHistoryFile, "utf8");
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

function recipientSentHistoryPath(normalizedRecipient: string): string {
  return path.join(recipientSentDir, `${normalizedRecipient}.jsonl`);
}

function appendRecipientSentHistoryLine(
  normalizedRecipient: string,
  line: SentHistoryDiskLine
): void {
  try {
    ensureDataDir();
    fs.mkdirSync(recipientSentDir, { recursive: true });
    fs.appendFileSync(
      recipientSentHistoryPath(normalizedRecipient),
      `${JSON.stringify(line)}\n`,
      "utf8"
    );
  } catch (e) {
    console.error("[payout-service] Failed to append recipient sent-history:", e);
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

export function appendSentHistoryLine(
  job: SnapshotJob,
  txHash: string,
  sentAt: number
): void {
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
    fs.appendFileSync(sentHistoryFile, `${JSON.stringify(line)}\n`, "utf8");
    appendRecipientSentHistoryLine(
      normalizeNimWalletId(job.recipientAddress),
      line
    );
  } catch (e) {
    console.error("[payout-service] Failed to append sent-history file:", e);
  }
}

export function appendManualBulkPayoutLogEntry(entry: ManualBulkLogDisk): void {
  try {
    ensureDataDir();
    fs.appendFileSync(manualBulkLogFile, `${JSON.stringify(entry)}\n`, "utf8");
  } catch (e) {
    console.error("[payout-service] Failed to append manual-bulk log:", e);
  }
}

function mergeSentHistoryRecords(limit: number): SentHistoryMerged[] {
  const fromDisk = readSentHistoryFromDisk(Math.min(limit * 4, 8000));
  const byTx = new Map<string, SentHistoryMerged>();
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
  for (const d of readSentHistoryFromDisk(250_000)) {
    if (normalizeNimWalletId(d.recipient) !== normalizedTarget) continue;
    push({
      sentAt: d.sentAt,
      recipient: d.recipient,
      txHash: d.txHash,
      amountLuna: d.amountLuna,
    });
  }
  return [...byTx.values()]
    .sort((a, b) => b.sentAt - a.sentAt)
    .slice(0, Math.max(1, maxRecords));
}

function countSendsOnUtcDay(
  records: SentHistoryMerged[],
  dayStartMs: number
): number {
  const dayEnd = dayStartMs + 86400000;
  return records.reduce((n, r) => {
    return r.sentAt >= dayStartMs && r.sentAt < dayEnd ? n + 1 : n;
  }, 0);
}

function historyRowsFromMerged(source: SentHistoryMerged[]): PublicPayoutHistoryRow[] {
  return source.map((r) => ({
    time: new Date(r.sentAt).toISOString(),
    identicon: "",
    walletId: r.recipient,
    amountNim:
      r.amountLuna && /^\d+$/.test(r.amountLuna)
        ? formatLunaAsNim4(BigInt(r.amountLuna))
        : "—",
    txHash: r.txHash,
  }));
}

function readManualBulkRowsFromJsonl(maxRows: number): ManualBulkPayoutHistoryRow[] {
  const cap = Math.min(100, Math.max(1, maxRows));
  try {
    if (!fs.existsSync(manualBulkLogFile)) return [];
    const raw = fs.readFileSync(manualBulkLogFile, "utf8");
    const lines = raw.split("\n").filter((l) => l.trim());
    const tail = lines.slice(Math.max(0, lines.length - MANUAL_BULK_LOG_TAIL_LINES));
    const parsed: ManualBulkLogDisk[] = [];
    for (const line of tail) {
      try {
        const o = JSON.parse(line) as ManualBulkLogDisk;
        if (
          typeof o.sentAt === "number" &&
          typeof o.recipient === "string" &&
          o.recipient &&
          typeof o.txHash === "string" &&
          o.txHash &&
          typeof o.totalLuna === "string" &&
          /^\d+$/.test(o.totalLuna) &&
          typeof o.jobsCleared === "number" &&
          o.jobsCleared >= 1 &&
          typeof o.state === "string"
        ) {
          parsed.push(o);
        }
      } catch {
        /* skip */
      }
    }
    parsed.sort((a, b) => b.sentAt - a.sentAt);
    return parsed.slice(0, cap).map((o) => ({
      time: new Date(o.sentAt).toISOString(),
      walletId: o.recipient.trim(),
      amountNim: formatLunaAsNim4(BigInt(o.totalLuna)),
      jobsCleared: o.jobsCleared,
      state: o.state,
      txHash: o.txHash,
      txMessage: String(o.txMessage || MANUAL_BULK_PAYOUT_TX_MESSAGE),
    }));
  } catch (e) {
    console.error("[payout-service] Failed to read manual-bulk log:", e);
    return [];
  }
}

function buildManualBulkHistoryForAdmin(limit: number): ManualBulkPayoutHistoryRow[] {
  return readManualBulkRowsFromJsonl(limit).slice(0, MANUAL_BULK_HISTORY_API_CAP);
}

function buildPendingByRecipientSummary(
  pendingJobs: SnapshotJob[]
): PendingByRecipientSummaryRow[] {
  const map = new Map<string, { sum: bigint; count: number; userFriendly: string }>();
  for (const j of pendingJobs) {
    if (j.status !== "pending" && j.status !== "processing") continue;
    const k = normalizeNimWalletId(j.recipientAddress);
    if (!k) continue;
    const prev = map.get(k);
    if (prev) {
      prev.sum += j.amountLuna;
      prev.count += 1;
    } else {
      map.set(k, {
        sum: j.amountLuna,
        count: 1,
        userFriendly: j.recipientAddress.trim(),
      });
    }
  }
  const rows: PendingByRecipientSummaryRow[] = [...map.values()].map((v) => ({
    walletId: v.userFriendly,
    jobCount: v.count,
    amountLuna: v.sum.toString(),
    amountNim: formatLunaAsNim4(v.sum),
  }));
  rows.sort((a, b) => {
    const d = BigInt(b.amountLuna) - BigInt(a.amountLuna);
    return d > 0n ? 1 : d < 0n ? -1 : 0;
  });
  return rows;
}

function pendingRowsFromJobs(pendingJobs: SnapshotJob[]): PublicPendingPayoutRow[] {
  const pending = [...pendingJobs].sort((a, b) => a.createdAt - b.createdAt);
  const slice = pending.slice(0, PENDING_PAYOUT_API_PENDING_ROW_CAP);
  return slice.map((j) => ({
    time: new Date(j.createdAt).toISOString(),
    identicon: "",
    walletId: j.recipientAddress,
    amountNim: formatLunaAsNim4(j.amountLuna),
  }));
}

export function getPublicPendingPayoutSummary(
  pendingJobs: SnapshotJob[]
): PublicPendingPayoutSummary {
  const now = new Date();
  const day0 = utcDayStartMs(now);
  const historyForCount = mergeSentHistoryRecords(4000);
  const processedToday = countSendsOnUtcDay(historyForCount, day0);

  const pending = pendingJobs.filter(
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

export function getPublicPendingPayoutAdminPanelSnapshot(
  pendingJobs: SnapshotJob[]
): PublicPendingPayoutSnapshot {
  const historySource = mergeSentHistoryRecords(PENDING_PAYOUT_API_HISTORY_ROW_CAP);
  const historyRows = historyRowsFromMerged(historySource);
  const manualBulkHistory = buildManualBulkHistoryForAdmin(MANUAL_BULK_HISTORY_API_CAP);

  const pending = pendingJobs.filter(
    (j) => j.status === "pending" || j.status === "processing"
  );
  if (pending.length === 0) {
    return {
      allSent: true,
      pendingTotal: 0,
      message: "All pending transactions have been sent.",
      rows: [],
      historyRows,
      pendingByRecipient: [],
      manualBulkHistory,
    };
  }
  return {
    allSent: false,
    pendingTotal: pending.length,
    message: null,
    rows: [],
    historyRows,
    pendingByRecipient: buildPendingByRecipientSummary(pendingJobs),
    manualBulkHistory,
  };
}

export function getPublicPendingPayoutSnapshot(
  pendingJobs: SnapshotJob[]
): PublicPendingPayoutSnapshot {
  const historySource = mergeSentHistoryRecords(PENDING_PAYOUT_API_HISTORY_ROW_CAP);
  const historyRows = historyRowsFromMerged(historySource);

  const pending = pendingJobs.filter(
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
  return {
    allSent: false,
    pendingTotal: pending.length,
    message: null,
    rows: pendingRowsFromJobs(pending),
    historyRows,
  };
}

export function getPendingPayoutSnapshotForWallet(
  pendingJobs: SnapshotJob[],
  walletRaw: string
): WalletPendingPayoutDetail {
  const target = normalizeNimWalletId(walletRaw);
  const now = new Date();
  const day0 = utcDayStartMs(now);
  const historyMerged = collectWalletSentHistory(target, 20_000);
  const processedToday = countSendsOnUtcDay(historyMerged, day0);
  const historySlice = historyMerged.slice(0, PENDING_PAYOUT_API_HISTORY_ROW_CAP);
  const historyRows = historyRowsFromMerged(historySlice);

  const pendingAll = pendingJobs
    .filter(
      (j) =>
        (j.status === "pending" || j.status === "processing") &&
        normalizeNimWalletId(j.recipientAddress) === target
    )
    .sort((a, b) => a.createdAt - b.createdAt);
  const pending = pendingAll.slice(0, PENDING_PAYOUT_API_PENDING_ROW_CAP);
  const rows = pending.map((j) => ({
    time: new Date(j.createdAt).toISOString(),
    identicon: "",
    walletId: j.recipientAddress,
    amountNim: formatLunaAsNim4(j.amountLuna),
  }));
  const allSent = pendingAll.length === 0;
  return {
    mode: "wallet",
    allSent,
    pendingTotal: pendingAll.length,
    message: null,
    rows,
    historyRows,
    processedToday,
  };
}

export function getPendingPayoutQueueTotals(pendingJobs: SnapshotJob[]): {
  jobCount: number;
  recipientCount: number;
  totalLuna: string;
  totalNim: string;
} {
  const recipients = new Set<string>();
  let totalLuna = 0n;
  let jobCount = 0;
  for (const j of pendingJobs) {
    if (j.status !== "pending" && j.status !== "processing") continue;
    jobCount += 1;
    totalLuna += j.amountLuna;
    const k = normalizeNimWalletId(j.recipientAddress);
    if (k) recipients.add(k);
  }
  return {
    jobCount,
    recipientCount: recipients.size,
    totalLuna: totalLuna.toString(),
    totalNim: formatLunaAsNim4(totalLuna),
  };
}

export { LUNA_PER_NIM };
