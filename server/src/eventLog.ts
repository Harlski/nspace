import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getLogDir(): string {
  return process.env.EVENT_LOG_DIR
    ? path.resolve(process.env.EVENT_LOG_DIR)
    : path.join(__dirname, "..", "data", "events");
}

export type EventRecord = {
  ts: number;
  kind: string;
  sessionId: string;
  address: string;
  roomId: string;
  durationMs?: number;
  payload?: Record<string, unknown>;
};

export type SessionSummary = {
  sessionId: string;
  address: string;
  roomId: string;
  startedAt: number;
  endedAt: number | null;
};

/**
 * Canonical event kinds consumed by analytics and dashboard surfaces.
 * Keep names stable to avoid breaking downstream aggregations.
 */
export const ANALYTICS_EVENT_KINDS = {
  sessionStart: "session_start",
  sessionEnd: "session_end",
  /** Fired when a client successfully starts a NIM block claim (adjacent to target). */
  beginBlockClaim: "begin_block_claim",
  claimBlock: "claim_block",
  nimPayoutSent: "nim_payout_sent",
  nimPayoutDeadLetter: "nim_payout_dead_letter",
  placeBlock: "place_block",
  chat: "chat",
  /** Private 1:1 whisper (logged for moderation; never broadcast). */
  whisper: "whisper",
  /** Player received room chat backlog lines on welcome. */
  chatBacklogDelivered: "chat_backlog_delivered",
} as const;

/**
 * When inferring active play time from gameplay events, wall time between events is credited only
 * up to this cap so long AFK stretches do not inflate totals.
 */
const ANALYTICS_ACTIVE_PLAY_IDLE_CAP_MS = 5 * 60 * 1000;

function kindContributesToActivePlay(kind: string): boolean {
  if (kind === ANALYTICS_EVENT_KINDS.sessionStart) return false;
  if (kind === ANALYTICS_EVENT_KINDS.sessionEnd) return false;
  if (kind === ANALYTICS_EVENT_KINDS.nimPayoutSent) return false;
  if (kind === ANALYTICS_EVENT_KINDS.nimPayoutDeadLetter) return false;
  return Boolean(kind);
}


function ensureLogDir(): void {
  fs.mkdirSync(getLogDir(), { recursive: true });
}

function todayFile(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return path.join(getLogDir(), `events-${y}-${m}-${day}.jsonl`);
}

function appendRecord(rec: EventRecord): void {
  ensureLogDir();
  const line = `${JSON.stringify(rec)}\n`;
  fs.appendFileSync(todayFile(), line, "utf8");
}

export function beginSession(
  address: string,
  roomId: string,
  opts?: { nimiqPay?: boolean }
): {
  sessionId: string;
  startedAt: number;
} {
  const sessionId = crypto.randomBytes(12).toString("hex");
  const startedAt = Date.now();
  appendRecord({
    ts: startedAt,
    kind: "session_start",
    sessionId,
    address,
    roomId,
    ...(opts?.nimiqPay ? { payload: { nimiqPay: true } } : {}),
  });
  return { sessionId, startedAt };
}

export function endSession(
  sessionId: string,
  address: string,
  roomId: string,
  startedAt: number
): void {
  const ts = Date.now();
  appendRecord({
    ts,
    kind: "session_end",
    sessionId,
    address,
    roomId,
    durationMs: ts - startedAt,
  });
}

export function logGameplayEvent(
  sessionId: string,
  address: string,
  roomId: string,
  kind: string,
  payload: Record<string, unknown>
): void {
  appendRecord({
    ts: Date.now(),
    kind,
    sessionId,
    address,
    roomId,
    payload,
  });
}

function listEventFiles(maxDays: number): string[] {
  if (!fs.existsSync(getLogDir())) return [];
  const files = fs
    .readdirSync(getLogDir())
    .filter((f) => f.startsWith("events-") && f.endsWith(".jsonl"));
  files.sort();
  return files.slice(-Math.max(1, maxDays)).map((f) => path.join(getLogDir(), f));
}

function parseLines(filePath: string): EventRecord[] {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf8");
  const out: EventRecord[] = [];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      out.push(JSON.parse(t) as EventRecord);
    } catch {
      /* skip corrupt */
    }
  }
  return out;
}

/** Event log path for a UTC calendar day (`YYYY-MM-DD`). */
export function eventLogFileForUtcDay(day: string): string {
  const safe = String(day || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(safe)) {
    throw new Error("invalid_utc_day");
  }
  return path.join(getLogDir(), `events-${safe}.jsonl`);
}

/** Parse all records from a single UTC day file (empty if missing). */
export function listEventRecordsForUtcDay(day: string): EventRecord[] {
  return parseLines(eventLogFileForUtcDay(day));
}


function formatLunaToNim(amountLuna: string): string | null {
  if (!/^\d+$/.test(amountLuna)) return null;
  const luna = BigInt(amountLuna);
  const whole = luna / 100000n;
  const frac = (luna % 100000n).toString().padStart(5, "0");
  return `${whole.toString()}.${frac}`;
}

/** Unique addresses seen in session_start within recent files. */
export function listRecentPlayerAddresses(
  maxDays: number,
  limit: number
): string[] {
  const files = listEventFiles(maxDays);
  const seen = new Set<string>();
  for (const fp of files) {
    for (const rec of parseLines(fp)) {
      if (rec.kind === "session_start" && rec.address) seen.add(rec.address);
    }
  }
  return [...seen].sort().slice(0, limit);
}

export function listSessionsForPlayer(
  address: string,
  maxDays: number
): SessionSummary[] {
  const files = listEventFiles(maxDays);
  const byId = new Map<
    string,
    { roomId: string; startedAt: number; endedAt: number | null }
  >();

  for (const fp of files) {
    for (const rec of parseLines(fp)) {
      if (rec.address !== address) continue;
      if (rec.kind === "session_start") {
        byId.set(rec.sessionId, {
          roomId: rec.roomId,
          startedAt: rec.ts,
          endedAt: null,
        });
      } else if (rec.kind === "session_end") {
        const cur = byId.get(rec.sessionId);
        if (cur) cur.endedAt = rec.ts;
        else {
          byId.set(rec.sessionId, {
            roomId: rec.roomId,
            startedAt: rec.ts - (rec.durationMs ?? 0),
            endedAt: rec.ts,
          });
        }
      }
    }
  }

  const out: SessionSummary[] = [];
  for (const [sessionId, v] of byId) {
    out.push({
      sessionId,
      address,
      roomId: v.roomId,
      startedAt: v.startedAt,
      endedAt: v.endedAt,
    });
  }
  out.sort((a, b) => b.startedAt - a.startedAt);
  return out;
}

export function getEventsForSession(sessionId: string, maxDays: number): EventRecord[] {
  const files = listEventFiles(maxDays);
  const out: EventRecord[] = [];
  for (const fp of files) {
    for (const rec of parseLines(fp)) {
      if (rec.sessionId === sessionId) out.push(rec);
    }
  }
  out.sort((a, b) => a.ts - b.ts);
  return out;
}

/** One successful on-chain payout as recorded in gameplay event logs. */
export type NimPayoutSentEventRow = {
  sentAt: number;
  enqueuedAt: number;
  recipient: string;
  txHash: string;
  claimId: string;
  /** Present on events logged after `amountLuna` was added to the payload. */
  amountLuna?: string;
};

/**
 * Recent `nim_payout_sent` events for public payout history (backfill before
 * `nim-payout-sent.jsonl` existed). Deduped by `txHash`; newest wins.
 */
export function listRecentNimPayoutSentFromEventLog(
  maxDays: number,
  limit: number
): NimPayoutSentEventRow[] {
  const files = listEventFiles(maxDays);
  const byTx = new Map<string, NimPayoutSentEventRow>();
  for (const fp of files) {
    for (const rec of parseLines(fp)) {
      if (rec.kind !== "nim_payout_sent") continue;
      const p = rec.payload || {};
      const txHash = typeof p.txHash === "string" ? p.txHash : "";
      if (!txHash) continue;
      const sentAt = typeof p.sentAt === "number" ? p.sentAt : rec.ts;
      const enqueuedAt = typeof p.enqueuedAt === "number" ? p.enqueuedAt : sentAt;
      const amountLuna =
        typeof p.amountLuna === "string" && /^\d+$/.test(p.amountLuna)
          ? p.amountLuna
          : undefined;
      byTx.set(txHash, {
        sentAt,
        enqueuedAt,
        recipient: rec.address,
        txHash,
        claimId: typeof p.claimId === "string" ? p.claimId : "",
        amountLuna,
      });
    }
  }
  const merged = [...byTx.values()].sort((a, b) => b.sentAt - a.sentAt);
  return merged.slice(0, Math.max(0, limit));
}

/** One combined manual payout (aggregated from multiple `nim_payout_sent` rows sharing `txHash`). */
export type ManualBulkEventHistoryAgg = {
  sentAt: number;
  walletId: string;
  txHash: string;
  totalLuna: string;
  jobsCleared: number;
  state: string;
};

/**
 * Manager "payout in full" leaves one `nim_payout_sent` per cleared job (`payload.manualBulk`),
 * same `txHash`. Used to populate admin manual payout history when JSONL is empty or older.
 */
export function listRecentManualBulkAggregatesFromEventLog(
  maxDays: number,
  limit: number
): ManualBulkEventHistoryAgg[] {
  const files = listEventFiles(maxDays);
  type Agg = {
    sentAt: number;
    walletId: string;
    totalLuna: string;
    state: string;
    jobs: number;
    sumLuna: bigint;
    txHash: string;
  };
  const byTx = new Map<string, Agg>();
  for (const fp of files) {
    for (const rec of parseLines(fp)) {
      if (rec.kind !== "nim_payout_sent") continue;
      const p = rec.payload || {};
      if (p.manualBulk !== true) continue;
      const txHashRaw = typeof p.txHash === "string" ? p.txHash.trim() : "";
      if (!txHashRaw) continue;
      const txKey = txHashRaw.toLowerCase();
      const sentAt = typeof p.sentAt === "number" ? p.sentAt : rec.ts;
      const state = typeof p.state === "string" ? p.state : "";
      const walletId = String(rec.address || "").trim();
      const bulkStr =
        typeof p.bulkTotalLuna === "string" && /^\d+$/.test(p.bulkTotalLuna)
          ? p.bulkTotalLuna
          : "";
      const amtStr =
        typeof p.amountLuna === "string" && /^\d+$/.test(p.amountLuna)
          ? p.amountLuna
          : "0";

      const prev = byTx.get(txKey);
      if (prev) {
        prev.jobs += 1;
        if (sentAt > prev.sentAt) prev.sentAt = sentAt;
        if (state && !prev.state) prev.state = state;
        prev.sumLuna += BigInt(amtStr);
      } else {
        byTx.set(txKey, {
          sentAt,
          walletId,
          totalLuna: bulkStr,
          state,
          jobs: 1,
          sumLuna: BigInt(amtStr),
          txHash: txHashRaw,
        });
      }
    }
  }
  const out: ManualBulkEventHistoryAgg[] = [];
  for (const v of byTx.values()) {
    const totalLuna =
      v.totalLuna && /^\d+$/.test(v.totalLuna) ? v.totalLuna : v.sumLuna.toString();
    if (!/^\d+$/.test(totalLuna) || v.jobs < 1) continue;
    out.push({
      sentAt: v.sentAt,
      walletId: v.walletId,
      txHash: v.txHash,
      totalLuna,
      jobsCleared: v.jobs,
      state: v.state || "-",
    });
  }
  out.sort((a, b) => b.sentAt - a.sentAt);
  return out.slice(0, Math.max(0, limit));
}

export type ConnectNoticeVisitStats = {
  nimEarnedLabel: string;
  activeMs: number;
  /** Present on lastVisit when known (session wall-clock). */
  startedAt?: number;
  endedAt?: number;
};

export type ConnectNoticePlayerStats = {
  lastVisit: ConnectNoticeVisitStats | null;
  today: ConnectNoticeVisitStats;
};

function nimEarnedLabelFromLuna(total: bigint): string {
  const raw = formatLunaToNim(total.toString());
  if (!raw) return "0 NIM";
  const trimmed = raw.replace(/0+$/, "").replace(/\.$/, "") || "0";
  return `${trimmed} NIM`;
}

function utcDayStartMs(nowMs: number): number {
  const d = new Date(nowMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Previous ended session + today (UTC) NIM/active totals for Connect Notice copy. */
export function getConnectNoticeStatsForAddress(
  address: string,
  nowMs: number = Date.now()
): ConnectNoticePlayerStats {
  const addr = address.trim();
  const emptyToday: ConnectNoticeVisitStats = {
    nimEarnedLabel: "0 NIM",
    activeMs: 0,
  };
  if (!addr) {
    return { lastVisit: null, today: emptyToday };
  }

  const dayStart = utcDayStartMs(nowMs);
  const dayEnd = dayStart + 86_400_000;

  type SessionAcc = {
    startedAt: number;
    endedAt: number | null;
    lastActivityTs: number;
    activeMs: number;
    nimLuna: bigint;
  };
  const sessions = new Map<string, SessionAcc>();
  let todayNimLuna = 0n;
  let todayActiveMs = 0;

  for (const fp of listEventFiles(3)) {
    for (const rec of parseLines(fp)) {
      if (rec.sessionId && sessions.has(rec.sessionId)) {
        const live = sessions.get(rec.sessionId)!;
        if (live.endedAt == null && kindContributesToActivePlay(rec.kind)) {
          const gap = rec.ts - live.lastActivityTs;
          if (gap >= 0) {
            live.activeMs += Math.min(gap, ANALYTICS_ACTIVE_PLAY_IDLE_CAP_MS);
          }
          live.lastActivityTs = rec.ts;
        }
      }

      if (rec.address !== addr) continue;

      if (rec.kind === ANALYTICS_EVENT_KINDS.sessionStart) {
        sessions.set(rec.sessionId, {
          startedAt: rec.ts,
          endedAt: null,
          lastActivityTs: rec.ts,
          activeMs: 0,
          nimLuna: 0n,
        });
        continue;
      }

      if (rec.kind === ANALYTICS_EVENT_KINDS.sessionEnd) {
        const cur = sessions.get(rec.sessionId);
        if (cur) {
          const gap = rec.ts - cur.lastActivityTs;
          if (gap >= 0) {
            cur.activeMs += Math.min(gap, ANALYTICS_ACTIVE_PLAY_IDLE_CAP_MS);
          }
          cur.endedAt = rec.ts;
          cur.lastActivityTs = rec.ts;
        }
        continue;
      }

      if (rec.kind === ANALYTICS_EVENT_KINDS.nimPayoutSent) {
        const p = rec.payload ?? {};
        const amountLuna =
          typeof p.amountLuna === "string" && /^\d+$/.test(p.amountLuna)
            ? BigInt(p.amountLuna)
            : 0n;
        const sentAt =
          typeof p.sentAt === "number" && Number.isFinite(p.sentAt) ? p.sentAt : rec.ts;
        if (sentAt >= dayStart && sentAt < dayEnd) {
          todayNimLuna += amountLuna;
        }
        const cur = sessions.get(rec.sessionId);
        if (cur) cur.nimLuna += amountLuna;
      }
    }
  }

  let lastEnded: SessionAcc | null = null;
  let lastEndedAt = -1;
  for (const s of sessions.values()) {
    if (s.startedAt >= dayStart && s.startedAt < dayEnd && s.endedAt != null) {
      const wall = Math.max(0, s.endedAt - s.startedAt);
      todayActiveMs += Math.min(s.activeMs, wall);
    }
    if (s.endedAt != null && s.endedAt > lastEndedAt) {
      lastEndedAt = s.endedAt;
      lastEnded = s;
    }
  }

  const today: ConnectNoticeVisitStats = {
    nimEarnedLabel: nimEarnedLabelFromLuna(todayNimLuna),
    activeMs: todayActiveMs,
  };

  let lastVisit: ConnectNoticeVisitStats | null = null;
  if (lastEnded?.endedAt != null) {
    const wall = Math.max(0, lastEnded.endedAt - lastEnded.startedAt);
    lastVisit = {
      nimEarnedLabel: nimEarnedLabelFromLuna(lastEnded.nimLuna),
      activeMs: Math.min(lastEnded.activeMs, wall),
      startedAt: lastEnded.startedAt,
      endedAt: lastEnded.endedAt,
    };
  }

  return { lastVisit, today };
}

/** No-op for sync-per-line writer; hook for future buffering. */
export function flushEventLogSync(): void {
  /* sync append - nothing to flush */
}
