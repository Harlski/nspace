import {
  ANALYTICS_ACTIVE_PLAY_IDLE_CAP_MS,
  ANALYTICS_EVENT_KINDS,
  forEachRecentEvent,
  kindContributesToActivePlay,
} from "./eventLogAnalytics.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const SESSION_ROW_LIMIT = 40;
const EARN_LIMIT = 200;

export type PlayerActivitySpan = {
  startMs: number;
  endMs: number;
};

export type PlayerActivityEarn = {
  atMs: number;
  amountLuna: string;
};

export type PlayerActivitySession = {
  sessionId: string;
  roomId: string;
  startedAt: number;
  endedAt: number | null;
  /** Wall clock inside the window. */
  connectedMs: number;
  /** Capped-gap play inside the window. */
  activeMs: number;
  nimEarnedLuna: string;
  /** No `session_end` in the log. */
  open: boolean;
  /**
   * Open in the log, and not the live session we extend to the window end.
   * The connected bar stops one idle cap after the last action.
   */
  closedWithoutSignOut: boolean;
};

export type PlayerActivity = {
  address: string;
  windowStartMs: number;
  windowEndMs: number;
  lookbackDays: number;
  /** Same cap the hourly digest uses when an action gap stops counting as play. */
  idleCapMs: number;
  treatLatestOpenAsConnected: boolean;
  /** Union of connected spans. Overlapping sessions are not double-counted. */
  connectedMs: number;
  /** Union of active spans. */
  activeMs: number;
  sessionCount: number;
  nimEarnedLuna: string;
  longestConnectedMs: number;
  connected: PlayerActivitySpan[];
  active: PlayerActivitySpan[];
  earns: PlayerActivityEarn[];
  earnsTruncated: boolean;
  sessions: PlayerActivitySession[];
  sessionsTruncated: boolean;
};

type LiveSession = {
  sessionId: string;
  startedAt: number;
  endedAt: number | null;
  lastTs: number;
  roomId: string;
  active: PlayerActivitySpan[];
  nimLuna: bigint;
};

type ClaimAcc = {
  luna: bigint;
  fromEarn: boolean;
  atMs: number;
  sessionId: string;
};

/**
 * How many trailing event-log day files to open so a session that began
 * shortly before the window is still visible.
 */
export function playerActivityLookbackDays(
  windowStartMs: number,
  windowEndMs: number
): number {
  const span = Math.max(0, windowEndMs - windowStartMs);
  const days = Math.ceil(span / DAY_MS);
  return Math.min(21, Math.max(3, days + 2));
}

function addressKey(address: string): string {
  const t = address.trim();
  if (!t) return "";
  if (t.startsWith("guest:")) return t;
  return t.toUpperCase();
}

function inWindow(ts: number, winStart: number, winEnd: number): boolean {
  return ts >= winStart && ts < winEnd;
}

function clipSpan(
  span: PlayerActivitySpan,
  winStart: number,
  winEnd: number
): PlayerActivitySpan | null {
  const startMs = Math.max(span.startMs, winStart);
  const endMs = Math.min(span.endMs, winEnd);
  if (!(endMs > startMs)) return null;
  return { startMs, endMs };
}

function mergeSpans(spans: PlayerActivitySpan[]): PlayerActivitySpan[] {
  const sorted = spans
    .filter((s) => s.endMs > s.startMs)
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
  const out: PlayerActivitySpan[] = [];
  for (const span of sorted) {
    const last = out[out.length - 1];
    if (!last || span.startMs > last.endMs) {
      out.push({ startMs: span.startMs, endMs: span.endMs });
    } else if (span.endMs > last.endMs) {
      last.endMs = span.endMs;
    }
  }
  return out;
}

function spanDuration(spans: PlayerActivitySpan[]): number {
  let total = 0;
  for (const span of spans) total += span.endMs - span.startMs;
  return total;
}

function lunaOf(payload: Record<string, unknown> | undefined): bigint {
  const raw = payload?.amountLuna;
  if (typeof raw === "string" && /^\d+$/.test(raw)) return BigInt(raw);
  return 0n;
}

function claimIdOf(payload: Record<string, unknown> | undefined): string {
  const raw = payload?.claimId;
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * One player's connected and active spans for an operator dossier.
 *
 * Connected is sign-in (`session_start`) through sign-out (`session_end`).
 * Active uses the same capped-gap rule as the hourly digest: wall time between
 * actions counts only up to {@link ANALYTICS_ACTIVE_PLAY_IDLE_CAP_MS}.
 * Headline totals are unions, so two overlapping sessions are not added twice.
 *
 * When `treatLatestOpenAsConnected` is set (the wallet is in a room now), the
 * newest session that has no sign-out runs to `windowEndMs`. Older open
 * sessions stop one idle cap after their last action.
 */
export async function getPlayerActivity(
  address: string,
  windowStartMs: number,
  windowEndMs: number,
  treatLatestOpenAsConnected: boolean
): Promise<PlayerActivity> {
  const key = addressKey(address);
  const lookbackDays = playerActivityLookbackDays(windowStartMs, windowEndMs);
  const sessions: LiveSession[] = [];
  const claims = new Map<string, ClaimAcc>();
  const loose: ClaimAcc[] = [];

  function openFor(sessionId: string): LiveSession | undefined {
    for (let i = sessions.length - 1; i >= 0; i--) {
      const live = sessions[i];
      if (live && live.sessionId === sessionId && live.endedAt == null) return live;
    }
    return undefined;
  }

  function pushActive(live: LiveSession, from: number, to: number): void {
    if (!(to > from)) return;
    const endMs = Math.min(to, from + ANALYTICS_ACTIVE_PLAY_IDLE_CAP_MS);
    if (endMs > from) live.active.push({ startMs: from, endMs });
  }

  function noteClaim(
    sessionId: string,
    claimId: string,
    luna: bigint,
    fromEarn: boolean,
    atMs: number
  ): void {
    if (luna <= 0n) return;
    if (!claimId) {
      loose.push({ luna, fromEarn, atMs, sessionId });
      return;
    }
    const cur = claims.get(claimId);
    if (!cur) {
      claims.set(claimId, { luna, fromEarn, atMs, sessionId });
      return;
    }
    if (fromEarn) {
      cur.luna = luna;
      cur.fromEarn = true;
      cur.atMs = atMs;
      cur.sessionId = sessionId || cur.sessionId;
    }
  }

  if (key) {
    await forEachRecentEvent(lookbackDays, (rec) => {
      if (addressKey(rec.address) !== key) return;
      const sessionId = typeof rec.sessionId === "string" ? rec.sessionId : "";
      const payload = rec.payload;

      if (
        inWindow(rec.ts, windowStartMs, windowEndMs) &&
        (rec.kind === ANALYTICS_EVENT_KINDS.claimBlock ||
          rec.kind === ANALYTICS_EVENT_KINDS.gameplayNimEarned)
      ) {
        noteClaim(
          sessionId,
          claimIdOf(payload),
          lunaOf(payload),
          rec.kind === ANALYTICS_EVENT_KINDS.gameplayNimEarned,
          rec.ts
        );
      }

      if (!sessionId) return;

      if (rec.kind === ANALYTICS_EVENT_KINDS.sessionStart) {
        const already = openFor(sessionId);
        if (already) {
          if (rec.ts > already.lastTs) {
            pushActive(already, already.lastTs, rec.ts);
            already.lastTs = rec.ts;
          }
          already.endedAt = Math.max(already.startedAt, rec.ts);
        }
        sessions.push({
          sessionId,
          startedAt: rec.ts,
          endedAt: null,
          lastTs: rec.ts,
          roomId: rec.roomId || "",
          active: [],
          nimLuna: 0n,
        });
        return;
      }

      let live = openFor(sessionId);
      if (!live && rec.kind !== ANALYTICS_EVENT_KINDS.sessionEnd) {
        live = {
          sessionId,
          startedAt: rec.ts,
          endedAt: null,
          lastTs: rec.ts,
          roomId: rec.roomId || "",
          active: [],
          nimLuna: 0n,
        };
        sessions.push(live);
      }
      if (!live) return;

      const extendsPlay =
        rec.kind === ANALYTICS_EVENT_KINDS.sessionEnd ||
        kindContributesToActivePlay(rec.kind);
      if (extendsPlay && rec.ts > live.lastTs) {
        pushActive(live, live.lastTs, rec.ts);
        live.lastTs = rec.ts;
      }
      if (rec.roomId && rec.ts >= live.lastTs) live.roomId = rec.roomId;
      if (rec.kind === ANALYTICS_EVENT_KINDS.sessionEnd && rec.ts >= live.startedAt) {
        live.endedAt = rec.ts;
      }
    });
  }

  let latestOpen: LiveSession | null = null;
  for (const live of sessions) {
    if (live.endedAt != null) continue;
    if (
      !latestOpen ||
      live.startedAt > latestOpen.startedAt ||
      (live.startedAt === latestOpen.startedAt && live.lastTs > latestOpen.lastTs)
    ) {
      latestOpen = live;
    }
  }

  const connectedPieces: PlayerActivitySpan[] = [];
  const activePieces: PlayerActivitySpan[] = [];
  const rows: PlayerActivitySession[] = [];

  for (const live of sessions) {
    const isLiveConnection =
      treatLatestOpenAsConnected && live.endedAt == null && live === latestOpen;
    let connectedEnd: number;
    let closedWithoutSignOut = false;
    if (live.endedAt != null) {
      connectedEnd = live.endedAt;
    } else if (isLiveConnection) {
      connectedEnd = windowEndMs;
      pushActive(live, live.lastTs, windowEndMs);
    } else {
      connectedEnd = Math.min(windowEndMs, live.lastTs + ANALYTICS_ACTIVE_PLAY_IDLE_CAP_MS);
      closedWithoutSignOut = true;
      pushActive(live, live.lastTs, connectedEnd);
    }

    const connected = clipSpan(
      { startMs: live.startedAt, endMs: connectedEnd },
      windowStartMs,
      windowEndMs
    );
    if (!connected) continue;

    const active = mergeSpans(
      live.active
        .map((span) => clipSpan(span, windowStartMs, windowEndMs))
        .filter((span): span is PlayerActivitySpan => span != null)
        .map((span) => clipSpan(span, connected.startMs, connected.endMs))
        .filter((span): span is PlayerActivitySpan => span != null)
    );

    connectedPieces.push(connected);
    activePieces.push(...active);
    rows.push({
      sessionId: live.sessionId,
      roomId: live.roomId,
      startedAt: live.startedAt,
      endedAt: live.endedAt,
      connectedMs: connected.endMs - connected.startMs,
      activeMs: spanDuration(active),
      nimEarnedLuna: "0",
      open: live.endedAt == null,
      closedWithoutSignOut,
    });
  }

  const rowNim = rows.map(() => 0n);
  const earns: PlayerActivityEarn[] = [];
  let nimEarned = 0n;

  function rowIndexFor(sessionId: string, atMs: number): number {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.sessionId !== sessionId) continue;
      const end = row.endedAt ?? Number.POSITIVE_INFINITY;
      if (atMs >= row.startedAt && atMs <= end) return i;
    }
    for (let i = 0; i < rows.length; i++) {
      if (rows[i]?.sessionId === sessionId) return i;
    }
    return -1;
  }

  function addNim(sessionId: string, luna: bigint, atMs: number): void {
    nimEarned += luna;
    const idx = rowIndexFor(sessionId, atMs);
    if (idx >= 0) rowNim[idx] = (rowNim[idx] ?? 0n) + luna;
    earns.push({ atMs, amountLuna: luna.toString() });
  }

  for (const claim of claims.values()) addNim(claim.sessionId, claim.luna, claim.atMs);
  for (const claim of loose) addNim(claim.sessionId, claim.luna, claim.atMs);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row) row.nimEarnedLuna = (rowNim[i] ?? 0n).toString();
  }

  rows.sort((a, b) => b.startedAt - a.startedAt || (a.sessionId < b.sessionId ? -1 : 1));
  earns.sort((a, b) => a.atMs - b.atMs);

  const connected = mergeSpans(connectedPieces);
  const active = mergeSpans(activePieces);
  let longestConnectedMs = 0;
  for (const row of rows) {
    if (row.connectedMs > longestConnectedMs) longestConnectedMs = row.connectedMs;
  }

  return {
    address: key,
    windowStartMs,
    windowEndMs,
    lookbackDays,
    idleCapMs: ANALYTICS_ACTIVE_PLAY_IDLE_CAP_MS,
    treatLatestOpenAsConnected,
    connectedMs: spanDuration(connected),
    activeMs: spanDuration(active),
    sessionCount: rows.length,
    nimEarnedLuna: nimEarned.toString(),
    longestConnectedMs,
    connected,
    active,
    earns: earns.slice(0, EARN_LIMIT),
    earnsTruncated: earns.length > EARN_LIMIT,
    sessions: rows.slice(0, SESSION_ROW_LIMIT),
    sessionsTruncated: rows.length > SESSION_ROW_LIMIT,
  };
}
