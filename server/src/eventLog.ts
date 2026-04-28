import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { nimiqIdenticonDataUrl } from "./nimiqIdenticonServer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LOG_DIR = process.env.EVENT_LOG_DIR
  ? path.resolve(process.env.EVENT_LOG_DIR)
  : path.join(__dirname, "..", "data", "events");

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
  claimBlock: "claim_block",
  nimPayoutSent: "nim_payout_sent",
  nimPayoutDeadLetter: "nim_payout_dead_letter",
  placeBlock: "place_block",
  chat: "chat",
} as const;

export type LoginHourBucket = {
  hourUtc: number;
  starts: number;
  ends: number;
  /**
   * Wallets whose **first** `session_start` in the processed log window occurs in this UTC hour
   * (lifetime-first within the report’s retention slice, not “returning users only this hour”).
   */
  firstStarts: number;
  uniquePlayers: number;
  startUsers: AnalyticsUserCountRow[];
  endUsers: AnalyticsUserCountRow[];
  firstStartUsers: AnalyticsUserCountRow[];
};

/** Same shape as hourly login buckets, keyed by UTC calendar day `YYYY-MM-DD`. */
export type LoginDayBucket = {
  dayUtc: string;
  starts: number;
  ends: number;
  /**
   * Same semantics as {@link LoginHourBucket.firstStarts}: first-ever `session_start` in the report,
   * bucketed by the UTC date of that first event.
   */
  firstStarts: number;
  uniquePlayers: number;
  startUsers: AnalyticsUserCountRow[];
  endUsers: AnalyticsUserCountRow[];
  firstStartUsers: AnalyticsUserCountRow[];
};

export type SessionTimelineRow = {
  sessionId: string;
  address: string;
  roomId: string;
  startedAt: number;
  endedAt: number | null;
  durationMs: number | null;
};

export type NimTimelineRow = {
  sentAt: number;
  recipient: string;
  txHash: string;
  claimId: string;
  amountLuna: string | null;
  amountNim: string | null;
  enqueuedAt: number | null;
  queueToSendMs: number | null;
};

export type DailyAnalyticsRow = {
  dayUtc: string;
  activePlayers: number;
  sessionStarts: number;
  sessionEnds: number;
  claimBlocks: number;
  payoutsSent: number;
  deadLetters: number;
  payoutLunaTotal: string;
  placeBlocks: number;
  chats: number;
};

export type AnalyticsUserCountRow = {
  walletId: string;
  identicon: string;
  count: number;
};

export type AnalyticsUniqueVisitorRow = {
  walletId: string;
  identicon: string;
  sessionStarts: number;
  sessionEnds: number;
  totalPayoutLuna: string;
  totalPayoutNim: string;
};

export type PayoutHourBucket = {
  hourUtc: number;
  payouts: number;
  totalLuna: string;
  totalNim: string;
  users: {
    walletId: string;
    identicon: string;
    payouts: number;
    totalLuna: string;
    totalNim: string;
  }[];
};

export type PayoutDayBucket = {
  dayUtc: string;
  payouts: number;
  totalLuna: string;
  totalNim: string;
  users: {
    walletId: string;
    identicon: string;
    payouts: number;
    totalLuna: string;
    totalNim: string;
  }[];
};

/** Optional UTC window on event timestamps (inclusive). */
export type AnalyticsTimeWindow = {
  fromTs?: number;
  toTs?: number;
};

export type EventLogAnalyticsSnapshot = {
  generatedAt: number;
  maxDays: number;
  /** Calendar files scanned (>= maxDays when a time filter needs older files). */
  fileDaysScanned: number;
  /** When the UTC filter spans more than one calendar day, chart APIs use daily buckets. */
  chartGranularity: "hour" | "day";
  rowLimits: {
    sessions: number;
    payouts: number;
  };
  /** Present when `fromTs` / `toTs` filter was applied. */
  timeRange?: {
    fromTs: number | null;
    toTs: number | null;
  };
  /**
   * Distinct wallets whose **first-ever** `session_start` in the processed logs falls inside the
   * current analytics window (bounded by log retention; not pre-history before logs existed).
   */
  firstTimeLogins: number;
  uniqueVisitors: number;
  visitors: AnalyticsUniqueVisitorRow[];
  loginByHourUtc: LoginHourBucket[];
  payoutByHourUtc: PayoutHourBucket[];
  /** Populated when `chartGranularity` is `day` (e.g. month view). */
  loginByDayUtc?: LoginDayBucket[];
  payoutByDayUtc?: PayoutDayBucket[];
  sessions: SessionTimelineRow[];
  nimPayouts: NimTimelineRow[];
  daily: DailyAnalyticsRow[];
};

function ensureLogDir(): void {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function todayFile(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return path.join(LOG_DIR, `events-${y}-${m}-${day}.jsonl`);
}

function appendRecord(rec: EventRecord): void {
  ensureLogDir();
  const line = `${JSON.stringify(rec)}\n`;
  fs.appendFileSync(todayFile(), line, "utf8");
}

export function beginSession(address: string, roomId: string): {
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
  if (!fs.existsSync(LOG_DIR)) return [];
  const files = fs
    .readdirSync(LOG_DIR)
    .filter((f) => f.startsWith("events-") && f.endsWith(".jsonl"));
  files.sort();
  return files.slice(-Math.max(1, maxDays)).map((f) => path.join(LOG_DIR, f));
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

function computeAnalyticsFileDays(
  maxDays: number,
  fromTs?: number,
  toTs?: number
): number {
  const cap = 30;
  const d = Math.min(cap, Math.max(1, maxDays));
  if (fromTs == null && toTs == null) return d;
  const now = Date.now();
  const end = toTs != null ? Math.min(toTs, now) : now;
  const start = fromTs != null ? Math.min(fromTs, end) : end - d * 86_400_000;
  const oldest = Math.min(start, end);
  const spanDays = Math.ceil((now - oldest) / 86_400_000) + 1;
  return Math.min(cap, Math.max(1, Math.max(d, spanDays)));
}

async function forEachRecentEvent(
  maxDays: number,
  visitor: (rec: EventRecord) => void
): Promise<void> {
  const files = listEventFiles(maxDays);
  for (const filePath of files) {
    if (!fs.existsSync(filePath)) continue;
    const stream = fs.createReadStream(filePath, { encoding: "utf8" });
    const rl = readline.createInterface({
      input: stream,
      crlfDelay: Infinity,
    });
    try {
      for await (const line of rl) {
        const t = line.trim();
        if (!t) continue;
        try {
          visitor(JSON.parse(t) as EventRecord);
        } catch {
          /* skip corrupt */
        }
      }
    } finally {
      rl.close();
      stream.close();
    }
  }
}

function formatLunaToNim(amountLuna: string): string | null {
  if (!/^\d+$/.test(amountLuna)) return null;
  const luna = BigInt(amountLuna);
  const whole = luna / 100000n;
  const frac = (luna % 100000n).toString().padStart(5, "0");
  return `${whole.toString()}.${frac}`;
}

function utcDayKey(ts: number): string {
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Every UTC calendar day from `fromMs` through `toMs` (inclusive), as `YYYY-MM-DD`. */
function enumerateInclusiveUtcDays(fromMs: number, toMs: number): string[] {
  const keys: string[] = [];
  const d0 = new Date(fromMs);
  let t = Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), d0.getUTCDate());
  const endKey = utcDayKey(toMs);
  for (let guard = 0; guard < 400; guard += 1) {
    const k = utcDayKey(t);
    keys.push(k);
    if (k >= endKey) break;
    t += 86_400_000;
  }
  return keys;
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
      state: v.state || "—",
    });
  }
  out.sort((a, b) => b.sentAt - a.sentAt);
  return out.slice(0, Math.max(0, limit));
}

export async function getEventLogAnalyticsSnapshot(
  maxDays: number,
  sessionLimit: number,
  payoutLimit: number,
  timeWindow?: AnalyticsTimeWindow
): Promise<EventLogAnalyticsSnapshot> {
  const fromTs = timeWindow?.fromTs;
  const toTs = timeWindow?.toTs;
  const scanDays = computeAnalyticsFileDays(maxDays, fromTs, toTs);
  function inTimeWindow(ts: number): boolean {
    if (fromTs != null && ts < fromTs) return false;
    if (toTs != null && ts > toTs) return false;
    return true;
  }
  const useDayCharts =
    fromTs != null && toTs != null && utcDayKey(fromTs) !== utcDayKey(toTs);

  type PayoutAcc = {
    payouts: number;
    totalLuna: bigint;
    users: Map<string, { payouts: number; totalLuna: bigint }>;
  };
  const startsByDay = new Map<string, number>();
  const endsByDay = new Map<string, number>();
  const firstStartsByDay = new Map<string, number>();
  const uniqueByDay = new Map<string, Set<string>>();
  const startByDayUser = new Map<string, Map<string, number>>();
  const endByDayUser = new Map<string, Map<string, number>>();
  const firstByDayUser = new Map<string, Map<string, number>>();
  const payoutByDay = new Map<string, PayoutAcc>();
  function payoutAccForDay(dk: string): PayoutAcc {
    let v = payoutByDay.get(dk);
    if (!v) {
      v = { payouts: 0, totalLuna: 0n, users: new Map() };
      payoutByDay.set(dk, v);
    }
    return v;
  }

  const startsByHour = Array.from({ length: 24 }, () => 0);
  const endsByHour = Array.from({ length: 24 }, () => 0);
  const firstStartsByHour = Array.from({ length: 24 }, () => 0);
  const uniqueByHour = Array.from({ length: 24 }, () => new Set<string>());
  const bySession = new Map<
    string,
    { address: string; roomId: string; startedAt: number; endedAt: number | null }
  >();
  const payouts: NimTimelineRow[] = [];
  const startByHourUser = Array.from({ length: 24 }, () => new Map<string, number>());
  const endByHourUser = Array.from({ length: 24 }, () => new Map<string, number>());
  const firstByHourUser = Array.from({ length: 24 }, () => new Map<string, number>());
  const firstSeenSessionStart = new Set<string>();
  const payoutByHour = Array.from(
    { length: 24 },
    () =>
      ({
        payouts: 0,
        totalLuna: 0n,
        users: new Map<string, { payouts: number; totalLuna: bigint }>(),
      }) as {
        payouts: number;
        totalLuna: bigint;
        users: Map<string, { payouts: number; totalLuna: bigint }>;
      }
  );
  const visitors = new Map<
    string,
    { sessionStarts: number; sessionEnds: number; totalPayoutLuna: bigint }
  >();
  const daily = new Map<
    string,
    {
      active: Set<string>;
      sessionStarts: number;
      sessionEnds: number;
      claimBlocks: number;
      payoutsSent: number;
      deadLetters: number;
      payoutLunaTotal: bigint;
      placeBlocks: number;
      chats: number;
    }
  >();

  function dayState(day: string) {
    const existing = daily.get(day);
    if (existing) return existing;
    const created = {
      active: new Set<string>(),
      sessionStarts: 0,
      sessionEnds: 0,
      claimBlocks: 0,
      payoutsSent: 0,
      deadLetters: 0,
      payoutLunaTotal: 0n,
      placeBlocks: 0,
      chats: 0,
    };
    daily.set(day, created);
    return created;
  }

  function visitorState(address: string): {
    sessionStarts: number;
    sessionEnds: number;
    totalPayoutLuna: bigint;
  } {
    const existing = visitors.get(address);
    if (existing) return existing;
    const created = { sessionStarts: 0, sessionEnds: 0, totalPayoutLuna: 0n };
    visitors.set(address, created);
    return created;
  }

  await forEachRecentEvent(scanDays, (rec) => {
    if (!inTimeWindow(rec.ts)) return;
    const day = utcDayKey(rec.ts);
    const ds = dayState(day);
    if (rec.address) ds.active.add(rec.address);
    if (rec.kind === ANALYTICS_EVENT_KINDS.sessionStart) {
      const h = new Date(rec.ts).getUTCHours();
      if (useDayCharts) {
        startsByDay.set(day, (startsByDay.get(day) ?? 0) + 1);
        let uset = uniqueByDay.get(day);
        if (!uset) {
          uset = new Set();
          uniqueByDay.set(day, uset);
        }
        uset.add(rec.address);
        const sm = startByDayUser.get(day) ?? new Map<string, number>();
        sm.set(rec.address, (sm.get(rec.address) ?? 0) + 1);
        startByDayUser.set(day, sm);
        if (!firstSeenSessionStart.has(rec.address)) {
          firstStartsByDay.set(day, (firstStartsByDay.get(day) ?? 0) + 1);
          const fm = firstByDayUser.get(day) ?? new Map<string, number>();
          fm.set(rec.address, (fm.get(rec.address) ?? 0) + 1);
          firstByDayUser.set(day, fm);
        }
      } else {
        startsByHour[h] += 1;
        uniqueByHour[h].add(rec.address);
        startByHourUser[h].set(rec.address, (startByHourUser[h].get(rec.address) ?? 0) + 1);
        if (!firstSeenSessionStart.has(rec.address)) {
          firstStartsByHour[h] += 1;
          firstByHourUser[h].set(rec.address, (firstByHourUser[h].get(rec.address) ?? 0) + 1);
        }
      }
      if (!firstSeenSessionStart.has(rec.address)) {
        firstSeenSessionStart.add(rec.address);
      }
      ds.sessionStarts += 1;
      visitorState(rec.address).sessionStarts += 1;
      bySession.set(rec.sessionId, {
        address: rec.address,
        roomId: rec.roomId,
        startedAt: rec.ts,
        endedAt: null,
      });
      return;
    }
    if (rec.kind === ANALYTICS_EVENT_KINDS.sessionEnd) {
      const h = new Date(rec.ts).getUTCHours();
      if (useDayCharts) {
        endsByDay.set(day, (endsByDay.get(day) ?? 0) + 1);
        const em = endByDayUser.get(day) ?? new Map<string, number>();
        em.set(rec.address, (em.get(rec.address) ?? 0) + 1);
        endByDayUser.set(day, em);
      } else {
        endsByHour[h] += 1;
        endByHourUser[h].set(rec.address, (endByHourUser[h].get(rec.address) ?? 0) + 1);
      }
      ds.sessionEnds += 1;
      visitorState(rec.address).sessionEnds += 1;
      const current = bySession.get(rec.sessionId);
      if (current) {
        current.endedAt = rec.ts;
      } else {
        bySession.set(rec.sessionId, {
          address: rec.address,
          roomId: rec.roomId,
          startedAt: rec.ts - (rec.durationMs ?? 0),
          endedAt: rec.ts,
        });
      }
      return;
    }
    if (rec.kind === ANALYTICS_EVENT_KINDS.claimBlock) {
      ds.claimBlocks += 1;
      return;
    }
    if (rec.kind === ANALYTICS_EVENT_KINDS.placeBlock) {
      ds.placeBlocks += 1;
      return;
    }
    if (rec.kind === ANALYTICS_EVENT_KINDS.chat) {
      ds.chats += 1;
      return;
    }
    if (rec.kind === ANALYTICS_EVENT_KINDS.nimPayoutDeadLetter) {
      ds.deadLetters += 1;
      return;
    }
    if (rec.kind === ANALYTICS_EVENT_KINDS.nimPayoutSent) {
      const payload = rec.payload ?? {};
      const txHash = typeof payload.txHash === "string" ? payload.txHash : "";
      if (!txHash) return;
      const sentAt = typeof payload.sentAt === "number" ? payload.sentAt : rec.ts;
      const amountLuna =
        typeof payload.amountLuna === "string" && /^\d+$/.test(payload.amountLuna)
          ? payload.amountLuna
          : null;
      const payoutHour = new Date(sentAt).getUTCHours();
      const payoutDayKey = utcDayKey(sentAt);
      const pb = useDayCharts ? payoutAccForDay(payoutDayKey) : payoutByHour[payoutHour];
      pb.payouts += 1;
      payouts.push({
        sentAt,
        recipient: rec.address,
        txHash,
        claimId: typeof payload.claimId === "string" ? payload.claimId : "",
        amountLuna,
        amountNim: amountLuna ? formatLunaToNim(amountLuna) : null,
        enqueuedAt: typeof payload.enqueuedAt === "number" ? payload.enqueuedAt : null,
        queueToSendMs:
          typeof payload.queueToSendMs === "number" ? payload.queueToSendMs : null,
      });
      ds.payoutsSent += 1;
      if (amountLuna) {
        const luna = BigInt(amountLuna);
        ds.payoutLunaTotal += luna;
        visitorState(rec.address).totalPayoutLuna += luna;
        pb.totalLuna += luna;
        const cur = pb.users.get(rec.address) ?? { payouts: 0, totalLuna: 0n };
        cur.payouts += 1;
        cur.totalLuna += luna;
        pb.users.set(rec.address, cur);
      }
    }
  });

  const identiconCache = new Map<string, string>();
  async function identiconFor(walletId: string): Promise<string> {
    const existing = identiconCache.get(walletId);
    if (existing) return existing;
    const icon = await nimiqIdenticonDataUrl(walletId);
    identiconCache.set(walletId, icon);
    return icon;
  }

  async function mapUserCounts(
    userMap: Map<string, number>,
    limit = 20
  ): Promise<AnalyticsUserCountRow[]> {
    const rows = [...userMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, Math.max(1, limit));
    return Promise.all(
      rows.map(async ([walletId, count]) => ({
        walletId,
        identicon: await identiconFor(walletId),
        count,
      }))
    );
  }

  const sessions = [...bySession.entries()]
    .map(([sessionId, v]) => ({
      sessionId,
      address: v.address,
      roomId: v.roomId,
      startedAt: v.startedAt,
      endedAt: v.endedAt,
      durationMs: v.endedAt ? Math.max(0, v.endedAt - v.startedAt) : null,
    }))
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, Math.max(1, sessionLimit));

  const nimPayouts = payouts
    .sort((a, b) => b.sentAt - a.sentAt)
    .slice(0, Math.max(1, payoutLimit));

  const loginByHourUtc: LoginHourBucket[] = [];
  for (let hourUtc = 0; hourUtc < 24; hourUtc += 1) {
    loginByHourUtc.push({
      hourUtc,
      starts: startsByHour[hourUtc],
      ends: endsByHour[hourUtc],
      firstStarts: firstStartsByHour[hourUtc],
      uniquePlayers: uniqueByHour[hourUtc].size,
      startUsers: await mapUserCounts(startByHourUser[hourUtc]),
      endUsers: await mapUserCounts(endByHourUser[hourUtc]),
      firstStartUsers: await mapUserCounts(firstByHourUser[hourUtc]),
    });
  }

  const payoutByHourUtc: PayoutHourBucket[] = [];
  for (let hourUtc = 0; hourUtc < 24; hourUtc += 1) {
    const pb = payoutByHour[hourUtc];
    const users = [...pb.users.entries()]
      .sort((a, b) => Number(b[1].totalLuna - a[1].totalLuna))
      .slice(0, 20);
    payoutByHourUtc.push({
      hourUtc,
      payouts: pb.payouts,
      totalLuna: pb.totalLuna.toString(),
      totalNim: formatLunaToNim(pb.totalLuna.toString()) ?? "0.00000",
      users: await Promise.all(
        users.map(async ([walletId, v]) => ({
          walletId,
          identicon: await identiconFor(walletId),
          payouts: v.payouts,
          totalLuna: v.totalLuna.toString(),
          totalNim: formatLunaToNim(v.totalLuna.toString()) ?? "0.00000",
        }))
      ),
    });
  }

  let loginByDayUtc: LoginDayBucket[] | undefined;
  let payoutByDayUtc: PayoutDayBucket[] | undefined;
  if (useDayCharts && fromTs != null && toTs != null) {
    const dayOrder = enumerateInclusiveUtcDays(fromTs, toTs);
    loginByDayUtc = [];
    for (const dk of dayOrder) {
      loginByDayUtc.push({
        dayUtc: dk,
        starts: startsByDay.get(dk) ?? 0,
        ends: endsByDay.get(dk) ?? 0,
        firstStarts: firstStartsByDay.get(dk) ?? 0,
        uniquePlayers: uniqueByDay.get(dk)?.size ?? 0,
        startUsers: await mapUserCounts(startByDayUser.get(dk) ?? new Map()),
        endUsers: await mapUserCounts(endByDayUser.get(dk) ?? new Map()),
        firstStartUsers: await mapUserCounts(firstByDayUser.get(dk) ?? new Map()),
      });
    }
    payoutByDayUtc = [];
    for (const dk of dayOrder) {
      const acc =
        payoutByDay.get(dk) ??
        ({ payouts: 0, totalLuna: 0n, users: new Map() } as PayoutAcc);
      const dayUsers = [...acc.users.entries()]
        .sort((a, b) => Number(b[1].totalLuna - a[1].totalLuna))
        .slice(0, 20);
      payoutByDayUtc.push({
        dayUtc: dk,
        payouts: acc.payouts,
        totalLuna: acc.totalLuna.toString(),
        totalNim: formatLunaToNim(acc.totalLuna.toString()) ?? "0.00000",
        users: await Promise.all(
          dayUsers.map(async ([walletId, v]) => ({
            walletId,
            identicon: await identiconFor(walletId),
            payouts: v.payouts,
            totalLuna: v.totalLuna.toString(),
            totalNim: formatLunaToNim(v.totalLuna.toString()) ?? "0.00000",
          }))
        ),
      });
    }
  }

  const visitorRows = [...visitors.entries()]
    .sort((a, b) => Number(b[1].totalPayoutLuna - a[1].totalPayoutLuna))
    .slice(0, 250);
  const visitorOut: AnalyticsUniqueVisitorRow[] = await Promise.all(
    visitorRows.map(async ([walletId, row]) => ({
      walletId,
      identicon: await identiconFor(walletId),
      sessionStarts: row.sessionStarts,
      sessionEnds: row.sessionEnds,
      totalPayoutLuna: row.totalPayoutLuna.toString(),
      totalPayoutNim: formatLunaToNim(row.totalPayoutLuna.toString()) ?? "0.00000",
    }))
  );

  const dailyRows: DailyAnalyticsRow[] = [...daily.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([dayUtc, row]) => ({
      dayUtc,
      activePlayers: row.active.size,
      sessionStarts: row.sessionStarts,
      sessionEnds: row.sessionEnds,
      claimBlocks: row.claimBlocks,
      payoutsSent: row.payoutsSent,
      deadLetters: row.deadLetters,
      payoutLunaTotal: row.payoutLunaTotal.toString(),
      placeBlocks: row.placeBlocks,
      chats: row.chats,
    }));

  const hasWindow = fromTs != null || toTs != null;
  return {
    generatedAt: Date.now(),
    maxDays,
    fileDaysScanned: scanDays,
    chartGranularity: useDayCharts ? "day" : "hour",
    rowLimits: {
      sessions: Math.max(1, sessionLimit),
      payouts: Math.max(1, payoutLimit),
    },
    timeRange: hasWindow
      ? { fromTs: fromTs ?? null, toTs: toTs ?? null }
      : undefined,
    firstTimeLogins: firstSeenSessionStart.size,
    uniqueVisitors: visitors.size,
    visitors: visitorOut,
    loginByHourUtc,
    payoutByHourUtc,
    loginByDayUtc,
    payoutByDayUtc,
    sessions,
    nimPayouts,
    daily: dailyRows,
  };
}

/** No-op for sync-per-line writer; hook for future buffering. */
export function flushEventLogSync(): void {
  /* sync append — nothing to flush */
}
