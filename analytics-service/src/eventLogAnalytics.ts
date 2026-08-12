import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import {
  aggregateChosenFlags,
  type ChosenFlagsStats,
} from "./analyticsChosenFlags.js";
import {
  finalizeNimiqPayAnalytics,
  type NimiqPayAnalytics,
} from "./analyticsNimiqPay.js";
import { nimiqIdenticonDataUrl } from "./nimiqIdenticonServer.js";
import { walletDisplayName } from "./walletDisplayName.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function getEventLogDir(): string {
  return process.env.EVENT_LOG_DIR
    ? path.resolve(process.env.EVENT_LOG_DIR)
    : path.join(__dirname, "..", "..", "server", "data", "events");
}

/** Current Country for chosen-flags. Production game may enrich after proxy. */
const getChosenCountry: (wallet: string) => string | null | undefined = () => null;

export type EventRecord = {
  ts: number;
  kind: string;
  sessionId: string;
  address: string;
  roomId: string;
  durationMs?: number;
  payload?: Record<string, unknown>;
};

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
  displayName: string;
  roomId: string;
  startedAt: number;
  endedAt: number | null;
  durationMs: number | null;
  /** Capped-gap estimate from gameplay events; null when the session has not ended in logs. */
  activeDurationMs: number | null;
};

export type PlayTimeByRoomRow = {
  address: string;
  displayName: string;
  roomId: string;
  identicon: string;
  activeDurationMs: number;
  wallDurationMs: number;
  sessionCount: number;
};

export type NimTimelineRow = {
  sentAt: number;
  recipient: string;
  displayName: string;
  txHash: string;
  claimId: string;
  amountLuna: string | null;
  amountNim: string | null;
  enqueuedAt: number | null;
  queueToSendMs: number | null;
};

export type DailyAnalyticsRow = {
  dayUtc: string;
  /** Wallets with any gameplay event that UTC day (inflated vs login uniques). */
  activePlayers: number;
  /** Distinct wallets with at least one session_start that UTC day. */
  uniquePlayers: number;
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
  displayName: string;
  count: number;
};

export type AnalyticsUniqueVisitorRow = {
  walletId: string;
  identicon: string;
  displayName: string;
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
    displayName: string;
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
    displayName: string;
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
   * Distinct wallets whose **first-ever** `session_start` in the processed logs
   * (report window plus first-time lookback files) falls inside the current
   * analytics window. Bounded by retained event day-files and
   * `ANALYTICS_FIRST_TIME_LOOKBACK_DAYS` (not infinite pre-history).
   */
  firstTimeLogins: number;
  uniqueVisitors: number;
  visitors: AnalyticsUniqueVisitorRow[];
  /**
   * Every unique-visitor wallet in the window (not capped). The `visitors` table
   * is sliced to 250; the game uses this list to recompute chosen flags with live
   * Current Country.
   */
  visitorWalletIds: string[];
  /**
   * Distribution of **current** chosen Country among `uniqueVisitors` wallets
   * (profile flag / Flag Emote identity — not location, not emote usage).
   */
  chosenFlags: ChosenFlagsStats;
  /**
   * Nimiq Pay cohort in the window: activity (Pay-tagged sessions) and acquisition
   * (first-ever session was Pay). See {@link NimiqPayAnalytics}.
   */
  nimiqPay: NimiqPayAnalytics;
  loginByHourUtc: LoginHourBucket[];
  payoutByHourUtc: PayoutHourBucket[];
  /** Populated when `chartGranularity` is `day` (e.g. month view). */
  loginByDayUtc?: LoginDayBucket[];
  payoutByDayUtc?: PayoutDayBucket[];
  sessions: SessionTimelineRow[];
  /** Per wallet + room: summed active play time (capped gaps) across ended sessions in the window. */
  playTimeByRoom: PlayTimeByRoomRow[];
  nimPayouts: NimTimelineRow[];
  daily: DailyAnalyticsRow[];
};

function listEventFiles(maxDays: number): string[] {
  if (!fs.existsSync(getEventLogDir())) return [];
  const files = fs
    .readdirSync(getEventLogDir())
    .filter((f) => f.startsWith("events-") && f.endsWith(".jsonl"));
  files.sort();
  return files.slice(-Math.max(1, maxDays)).map((f) => path.join(getEventLogDir(), f));
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

/**
 * Extra calendar days of event files scanned *before* the analytics window so
 * first-time / returning detection can see prior `session_start`s.
 * Aligns with daily-stats lookback by default; override with
 * `ANALYTICS_FIRST_TIME_LOOKBACK_DAYS`.
 */
function analyticsFirstTimeLookbackDays(): number {
  const raw = Number(process.env.ANALYTICS_FIRST_TIME_LOOKBACK_DAYS);
  if (Number.isFinite(raw) && raw >= 0) return Math.floor(raw);
  const daily = Number(process.env.DAILY_STATS_LOOKBACK_DAYS);
  if (Number.isFinite(daily) && daily >= 1) return Math.floor(daily);
  return 400;
}

/**
 * How many trailing day-files to open for an overview snapshot.
 * Covers the report window plus first-time lookback so `seenBeforeWindow` is
 * populated (otherwise Pay returning stays 0 and FTU equals Pay unique).
 */
function computeAnalyticsFileDays(
  maxDays: number,
  fromTs?: number,
  toTs?: number
): number {
  const windowCap = 30;
  const windowDays = Math.min(windowCap, Math.max(1, maxDays));
  const lookback = analyticsFirstTimeLookbackDays();
  const now = Date.now();
  const end = toTs != null ? Math.min(toTs, now) : now;
  const windowStart =
    fromTs != null
      ? Math.min(fromTs, end)
      : end - (windowDays - 1) * 86_400_000;
  const historyStart = windowStart - lookback * 86_400_000;
  const spanDays = Math.ceil((now - historyStart) / 86_400_000) + 1;
  // Cap at window + lookback so a huge clock skew cannot open unbounded files.
  const hardCap = windowDays + lookback;
  return Math.max(1, Math.min(hardCap, Math.max(windowDays, spanDays)));
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

/**
 * Single-pass aggregate of one UTC day's sign-in and payout activity for the end-of-day report.
 *
 * Sign-in metrics are derived from `session_start` events. New-user detection scans up to
 * `lookbackDays` of event files (not bounded by the analytics snapshot's 30-day cap), so a wallet
 * counts as "new" only when its first-ever `session_start` within the lookback falls inside the day.
 * Active play time reuses the same capped-gap estimate as the analytics snapshot and only counts
 * sessions that both started in the day and have ended in the logs.
 */
export type DailyStatsAggregate = {
  dayUtc: string;
  dayStartMs: number;
  dayEndMs: number;
  lookbackDays: number;
  /** Distinct wallets with at least one `session_start` during the day. */
  uniqueSignedIn: number;
  /** Distinct wallets whose first-ever `session_start` within the lookback falls in the day. */
  newSignedIn: number;
  /** Day wallets whose sign-in came via Nimiq Pay (any of their day sessions flagged `nimiqPay`). */
  nimiqPaySignedIn: number;
  /** Day wallets without a Nimiq Pay sign-in (uniqueSignedIn - nimiqPaySignedIn). */
  nonNimiqPaySignedIn: number;
  /** Total `session_start` events in the day (includes repeat connects/reconnects). */
  sessionStarts: number;
  /** Successful NIM payouts (`nim_payout_sent`) whose `sentAt` falls in the day. */
  payoutsSent: number;
  /** Distinct payout recipients in the day. */
  payoutRecipients: number;
  payoutLunaTotal: string;
  payoutNimTotal: string | null;
  /** Summed capped-gap active play time for day-started sessions that ended in the logs (ms). */
  activePlayMsTotal: number;
  /** Number of day-started sessions counted toward `activePlayMsTotal`. */
  endedSessionsCounted: number;
};

export async function getDailyStatsAggregate(
  dayStartMs: number,
  dayEndMs: number,
  lookbackDays: number
): Promise<DailyStatsAggregate> {
  const scanDays = Math.max(1, Math.floor(lookbackDays));
  const seenBefore = new Set<string>();
  const dayWallets = new Set<string>();
  const dayWalletPay = new Map<string, boolean>();
  const payoutRecipients = new Set<string>();
  let sessionStarts = 0;
  let payoutsSent = 0;
  let payoutLunaTotal = 0n;
  let activePlayMsTotal = 0;
  let endedSessionsCounted = 0;
  type LiveSession = { lastTs: number; activeMs: number; ended: boolean };
  const liveSessions = new Map<string, LiveSession>();

  await forEachRecentEvent(scanDays, (rec) => {
    if (rec.sessionId) {
      const live = liveSessions.get(rec.sessionId);
      if (live && !live.ended && kindContributesToActivePlay(rec.kind)) {
        const gap = rec.ts - live.lastTs;
        if (gap >= 0) {
          live.activeMs += Math.min(gap, ANALYTICS_ACTIVE_PLAY_IDLE_CAP_MS);
        }
        live.lastTs = rec.ts;
      }
    }
    if (rec.kind === ANALYTICS_EVENT_KINDS.sessionStart) {
      if (!rec.address) return;
      if (rec.ts < dayStartMs) {
        seenBefore.add(rec.address);
        return;
      }
      if (rec.ts >= dayEndMs) return;
      sessionStarts += 1;
      dayWallets.add(rec.address);
      const pay = (rec.payload as { nimiqPay?: unknown } | undefined)?.nimiqPay === true;
      dayWalletPay.set(rec.address, (dayWalletPay.get(rec.address) ?? false) || pay);
      if (rec.sessionId) {
        liveSessions.set(rec.sessionId, { lastTs: rec.ts, activeMs: 0, ended: false });
      }
      return;
    }
    if (rec.kind === ANALYTICS_EVENT_KINDS.sessionEnd) {
      if (!rec.sessionId) return;
      const live = liveSessions.get(rec.sessionId);
      if (live && !live.ended) {
        const gap = rec.ts - live.lastTs;
        if (gap >= 0) {
          live.activeMs += Math.min(gap, ANALYTICS_ACTIVE_PLAY_IDLE_CAP_MS);
        }
        live.ended = true;
        activePlayMsTotal += live.activeMs;
        endedSessionsCounted += 1;
      }
      return;
    }
    if (rec.kind === ANALYTICS_EVENT_KINDS.nimPayoutSent) {
      const payload = rec.payload ?? {};
      const txHash = typeof payload.txHash === "string" ? payload.txHash : "";
      if (!txHash) return;
      const sentAt = typeof payload.sentAt === "number" ? payload.sentAt : rec.ts;
      if (sentAt < dayStartMs || sentAt >= dayEndMs) return;
      payoutsSent += 1;
      if (rec.address) payoutRecipients.add(rec.address);
      if (typeof payload.amountLuna === "string" && /^\d+$/.test(payload.amountLuna)) {
        payoutLunaTotal += BigInt(payload.amountLuna);
      }
    }
  });

  let newSignedIn = 0;
  for (const w of dayWallets) {
    if (!seenBefore.has(w)) newSignedIn += 1;
  }
  let nimiqPaySignedIn = 0;
  for (const pay of dayWalletPay.values()) {
    if (pay) nimiqPaySignedIn += 1;
  }
  const payoutLunaStr = payoutLunaTotal.toString();

  return {
    dayUtc: utcDayKey(dayStartMs),
    dayStartMs,
    dayEndMs,
    lookbackDays: scanDays,
    uniqueSignedIn: dayWallets.size,
    newSignedIn,
    nimiqPaySignedIn,
    nonNimiqPaySignedIn: dayWallets.size - nimiqPaySignedIn,
    sessionStarts,
    payoutsSent,
    payoutRecipients: payoutRecipients.size,
    payoutLunaTotal: payoutLunaStr,
    payoutNimTotal: formatLunaToNim(payoutLunaStr),
    activePlayMsTotal,
    endedSessionsCounted,
  };
}

/** In-memory TTL cache for `/api/analytics/overview` snapshots (JSONL scan is expensive). */
const analyticsOverviewCache = new Map<
  string,
  { expiresAt: number; value: EventLogAnalyticsSnapshot }
>();
const analyticsOverviewInflight = new Map<string, Promise<EventLogAnalyticsSnapshot>>();

function analyticsOverviewCacheTtlMs(): number {
  const raw = Number(process.env.ANALYTICS_OVERVIEW_CACHE_TTL_MS);
  if (Number.isFinite(raw) && raw >= 0) return Math.floor(raw);
  return 120_000;
}

function analyticsOverviewCacheKey(
  maxDays: number,
  sessionLimit: number,
  payoutLimit: number,
  timeWindow?: AnalyticsTimeWindow
): string {
  const fromTs = timeWindow?.fromTs ?? null;
  const toTs = timeWindow?.toTs ?? null;
  // Rolling windows share one key per UTC day; TTL refreshes within the day.
  const rollDay =
    fromTs == null && toTs == null ? utcDayKey(Date.now()) : null;
  return JSON.stringify({
    maxDays,
    sessionLimit,
    payoutLimit,
    fromTs,
    toTs,
    rollDay,
  });
}

/** Test helper: drop overview snapshot cache. */
export function clearAnalyticsOverviewCache(): void {
  analyticsOverviewCache.clear();
  analyticsOverviewInflight.clear();
}

export async function getEventLogAnalyticsSnapshot(
  maxDays: number,
  sessionLimit: number,
  payoutLimit: number,
  timeWindow?: AnalyticsTimeWindow
): Promise<EventLogAnalyticsSnapshot> {
  const ttlMs = analyticsOverviewCacheTtlMs();
  if (ttlMs <= 0) {
    return buildEventLogAnalyticsSnapshot(maxDays, sessionLimit, payoutLimit, timeWindow);
  }

  const key = analyticsOverviewCacheKey(maxDays, sessionLimit, payoutLimit, timeWindow);
  const hit = analyticsOverviewCache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return structuredClone(hit.value);
  }

  let pending = analyticsOverviewInflight.get(key);
  if (!pending) {
    pending = buildEventLogAnalyticsSnapshot(maxDays, sessionLimit, payoutLimit, timeWindow)
      .then((value) => {
        analyticsOverviewCache.set(key, { expiresAt: Date.now() + ttlMs, value });
        return value;
      })
      .finally(() => {
        analyticsOverviewInflight.delete(key);
      });
    analyticsOverviewInflight.set(key, pending);
  }
  return structuredClone(await pending);
}

async function buildEventLogAnalyticsSnapshot(
  maxDays: number,
  sessionLimit: number,
  payoutLimit: number,
  timeWindow?: AnalyticsTimeWindow
): Promise<EventLogAnalyticsSnapshot> {
  const fromTs = timeWindow?.fromTs;
  const toTs = timeWindow?.toTs;
  const nowMs = Date.now();
  /** Rolling N-day view (no `day` / `month` query): align charts with UI calendar span, UTC. */
  let filterFromMs: number | null | undefined = fromTs;
  let filterToMs: number | null | undefined = toTs;
  if (fromTs == null && toTs == null && maxDays > 1) {
    filterToMs = nowMs;
    const e = new Date(nowMs);
    const todayStartMs = Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate());
    filterFromMs = todayStartMs - (maxDays - 1) * 86_400_000;
  }
  const scanDays = computeAnalyticsFileDays(
    maxDays,
    filterFromMs ?? undefined,
    filterToMs ?? undefined
  );
  /** Wallets with session_start before the filtered window (for first-time login detection). */
  const seenBeforeWindow = new Set<string>();
  function inTimeWindow(ts: number): boolean {
    if (filterFromMs != null && ts < filterFromMs) return false;
    if (filterToMs != null && ts > filterToMs) return false;
    return true;
  }
  function analyticsWindowTs(rec: EventRecord): number {
    if (rec.kind === ANALYTICS_EVENT_KINDS.nimPayoutSent) {
      const p = rec.payload ?? {};
      if (typeof p.sentAt === "number" && Number.isFinite(p.sentAt)) return p.sentAt;
    }
    return rec.ts;
  }
  const useDayCharts =
    filterFromMs != null &&
    filterToMs != null &&
    utcDayKey(filterFromMs) !== utcDayKey(filterToMs);

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
    {
      address: string;
      roomId: string;
      startedAt: number;
      endedAt: number | null;
      lastActivityTs: number;
      activeMs: number;
      nimiqPay: boolean;
    }
  >();
  const payVisitors = new Set<string>();
  const payFirstTime = new Set<string>();
  let paySessionStarts = 0;
  const payUniqueByDay = new Map<string, Set<string>>();
  const payFirstByDay = new Map<string, Set<string>>();
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
    // Single pass: collect pre-window session_starts for first-time detection, then filter.
    if (
      filterFromMs != null &&
      rec.kind === ANALYTICS_EVENT_KINDS.sessionStart &&
      rec.address &&
      rec.ts < filterFromMs
    ) {
      seenBeforeWindow.add(rec.address);
    }
    if (!inTimeWindow(analyticsWindowTs(rec))) return;
    const day = utcDayKey(rec.ts);
    const ds = dayState(day);
    if (rec.address) ds.active.add(rec.address);
    if (rec.sessionId) {
      const live = bySession.get(rec.sessionId);
      if (live && live.endedAt === null && kindContributesToActivePlay(rec.kind)) {
        const gap = rec.ts - live.lastActivityTs;
        if (gap >= 0) {
          live.activeMs += Math.min(gap, ANALYTICS_ACTIVE_PLAY_IDLE_CAP_MS);
        }
        live.lastActivityTs = rec.ts;
      }
    }
    if (rec.kind === ANALYTICS_EVENT_KINDS.sessionStart) {
      const h = new Date(rec.ts).getUTCHours();
      let uset = uniqueByDay.get(day);
      if (!uset) {
        uset = new Set();
        uniqueByDay.set(day, uset);
      }
      uset.add(rec.address);
      const isFirstEver =
        !seenBeforeWindow.has(rec.address) && !firstSeenSessionStart.has(rec.address);
      const isPay =
        (rec.payload as { nimiqPay?: unknown } | undefined)?.nimiqPay === true;
      if (isPay) {
        paySessionStarts += 1;
        payVisitors.add(rec.address);
        let payDay = payUniqueByDay.get(day);
        if (!payDay) {
          payDay = new Set();
          payUniqueByDay.set(day, payDay);
        }
        payDay.add(rec.address);
      }
      if (useDayCharts) {
        startsByDay.set(day, (startsByDay.get(day) ?? 0) + 1);
        const sm = startByDayUser.get(day) ?? new Map<string, number>();
        sm.set(rec.address, (sm.get(rec.address) ?? 0) + 1);
        startByDayUser.set(day, sm);
        if (isFirstEver) {
          firstStartsByDay.set(day, (firstStartsByDay.get(day) ?? 0) + 1);
          const fm = firstByDayUser.get(day) ?? new Map<string, number>();
          fm.set(rec.address, (fm.get(rec.address) ?? 0) + 1);
          firstByDayUser.set(day, fm);
        }
      } else {
        startsByHour[h] += 1;
        uniqueByHour[h].add(rec.address);
        startByHourUser[h].set(rec.address, (startByHourUser[h].get(rec.address) ?? 0) + 1);
        if (isFirstEver) {
          firstStartsByHour[h] += 1;
          firstByHourUser[h].set(rec.address, (firstByHourUser[h].get(rec.address) ?? 0) + 1);
        }
      }
      if (isFirstEver) {
        firstSeenSessionStart.add(rec.address);
        if (isPay) {
          payFirstTime.add(rec.address);
          let payFirstDay = payFirstByDay.get(day);
          if (!payFirstDay) {
            payFirstDay = new Set();
            payFirstByDay.set(day, payFirstDay);
          }
          payFirstDay.add(rec.address);
        }
      }
      ds.sessionStarts += 1;
      visitorState(rec.address).sessionStarts += 1;
      bySession.set(rec.sessionId, {
        address: rec.address,
        roomId: rec.roomId,
        startedAt: rec.ts,
        endedAt: null,
        lastActivityTs: rec.ts,
        activeMs: 0,
        nimiqPay: isPay,
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
        const gapEnd = rec.ts - current.lastActivityTs;
        if (gapEnd >= 0) {
          current.activeMs += Math.min(gapEnd, ANALYTICS_ACTIVE_PLAY_IDLE_CAP_MS);
        }
        current.endedAt = rec.ts;
      } else {
        const startedAt = rec.ts - (rec.durationMs ?? 0);
        const wall = Math.max(0, rec.durationMs ?? 0);
        bySession.set(rec.sessionId, {
          address: rec.address,
          roomId: rec.roomId,
          startedAt,
          endedAt: rec.ts,
          lastActivityTs: startedAt,
          activeMs: Math.min(wall, ANALYTICS_ACTIVE_PLAY_IDLE_CAP_MS),
          nimiqPay: false,
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
        displayName: walletDisplayName(rec.address),
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
    const icon =
      process.env.ANALYTICS_IDENTICON_STUB === "1"
        ? ""
        : await nimiqIdenticonDataUrl(walletId);
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
        displayName: walletDisplayName(walletId),
        count,
      }))
    );
  }

  const sessions = [...bySession.entries()]
    .map(([sessionId, v]) => {
      const wallMs = v.endedAt ? Math.max(0, v.endedAt - v.startedAt) : null;
      const activeRaw = v.endedAt ? v.activeMs : null;
      const activeCapped =
        wallMs != null && activeRaw != null ? Math.min(activeRaw, wallMs) : activeRaw;
      return {
        sessionId,
        address: v.address,
        displayName: walletDisplayName(v.address),
        roomId: v.roomId,
        startedAt: v.startedAt,
        endedAt: v.endedAt,
        durationMs: wallMs,
        activeDurationMs: activeCapped,
      };
    })
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, Math.max(1, sessionLimit));

  const roomAgg = new Map<
    string,
    { address: string; roomId: string; activeMs: number; wallMs: number; sessionCount: number }
  >();
  let payActivePlayMs = 0;
  for (const v of bySession.values()) {
    if (!v.endedAt) continue;
    const wallMs = Math.max(0, v.endedAt - v.startedAt);
    const activeMs = Math.min(v.activeMs, wallMs);
    if (v.nimiqPay) payActivePlayMs += activeMs;
    const key = `${v.address}\t${v.roomId}`;
    const cur = roomAgg.get(key) ?? {
      address: v.address,
      roomId: v.roomId,
      activeMs: 0,
      wallMs: 0,
      sessionCount: 0,
    };
    cur.activeMs += activeMs;
    cur.wallMs += wallMs;
    cur.sessionCount += 1;
    roomAgg.set(key, cur);
  }
  const playTimeByRoom: PlayTimeByRoomRow[] = await Promise.all(
    [...roomAgg.values()]
      .sort((a, b) => b.activeMs - a.activeMs)
      .slice(0, Math.max(1, sessionLimit))
      .map(async (r) => ({
        address: r.address,
        displayName: walletDisplayName(r.address),
        roomId: r.roomId,
        identicon: await identiconFor(r.address),
        activeDurationMs: r.activeMs,
        wallDurationMs: r.wallMs,
        sessionCount: r.sessionCount,
      }))
  );

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
          displayName: walletDisplayName(walletId),
          payouts: v.payouts,
          totalLuna: v.totalLuna.toString(),
          totalNim: formatLunaToNim(v.totalLuna.toString()) ?? "0.00000",
        }))
      ),
    });
  }

  let loginByDayUtc: LoginDayBucket[] | undefined;
  let payoutByDayUtc: PayoutDayBucket[] | undefined;
  if (useDayCharts && filterFromMs != null && filterToMs != null) {
    const dayOrder = enumerateInclusiveUtcDays(filterFromMs, filterToMs);
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
            displayName: walletDisplayName(walletId),
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
      displayName: walletDisplayName(walletId),
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
      uniquePlayers: uniqueByDay.get(dayUtc)?.size ?? 0,
      sessionStarts: row.sessionStarts,
      sessionEnds: row.sessionEnds,
      claimBlocks: row.claimBlocks,
      payoutsSent: row.payoutsSent,
      deadLetters: row.deadLetters,
      payoutLunaTotal: row.payoutLunaTotal.toString(),
      placeBlocks: row.placeBlocks,
      chats: row.chats,
    }));

  const hasWindow = filterFromMs != null || filterToMs != null;
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
      ? { fromTs: filterFromMs ?? null, toTs: filterToMs ?? null }
      : undefined,
    firstTimeLogins: firstSeenSessionStart.size,
    uniqueVisitors: visitors.size,
    visitors: visitorOut,
    visitorWalletIds: [...visitors.keys()],
    chosenFlags: aggregateChosenFlags(visitors.keys(), getChosenCountry),
    nimiqPay: finalizeNimiqPayAnalytics({
      windowUniqueVisitors: visitors.size,
      payVisitors,
      payFirstTime,
      seenBeforeWindow,
      paySessionStarts,
      payActivePlayMs,
      visitorPayoutLuna: new Map(
        [...visitors.entries()].map(([w, row]) => [w, row.totalPayoutLuna])
      ),
      payUniqueByDay,
      payFirstByDay,
      formatLunaToNim,
    }),
    loginByHourUtc,
    payoutByHourUtc,
    loginByDayUtc,
    payoutByDayUtc,
    sessions,
    playTimeByRoom,
    nimPayouts,
    daily: dailyRows,
  };
}
