import {
  ANALYTICS_ACTIVE_PLAY_IDLE_CAP_MS,
  ANALYTICS_EVENT_KINDS,
  forEachRecentEvent,
  kindContributesToActivePlay,
} from "./eventLogAnalytics.js";

const HOUR_MS = 60 * 60 * 1000;
/** Rows returned for the operator table. Totals still cover every player in the window. */
const PLAYER_ROW_LIMIT = 40;
const TOP_ROOM_LIMIT = 3;

export type ActivityDigestPlayer = {
  address: string;
  activeMs: number;
  sessionStarts: number;
  /** Gameplay NIM credited in the window (luna, decimal string). Not on-chain sends. */
  nimEarnedLuna: string;
  chatCount: number;
  blocksPlaced: number;
  blocksClaimed: number;
  nimiqPay: boolean;
  /** First session_start in the lookback falls inside the window. */
  isNew: boolean;
  isGuest: boolean;
  lastRoomId: string;
  /** At least one session_start in the final hour of the window. */
  joinedLastHour: boolean;
};

export type ActivityDigestRoom = {
  roomId: string;
  activeMs: number;
  uniquePlayers: number;
};

export type ActivityDigest = {
  windowStartMs: number;
  windowEndMs: number;
  lookbackDays: number;
  uniquePlayers: number;
  newPlayers: number;
  guestPlayers: number;
  nimiqPayPlayers: number;
  activePlayMsTotal: number;
  nimEarnedLuna: string;
  sessionStarts: number;
  sessionStartsLastHour: number;
  chatLines: number;
  blocksPlaced: number;
  blocksClaimed: number;
  topRooms: ActivityDigestRoom[];
  /** Most active first, then NIM. Capped at {@link PLAYER_ROW_LIMIT}. */
  players: ActivityDigestPlayer[];
  /** Players with any play, earn, session, chat, or build in the window. */
  playerCount: number;
  /** Addresses with a session_start in the last hour of the window (capped). */
  joinedLastHourAddresses: string[];
};

type PlayerAcc = {
  address: string;
  activeMs: number;
  sessionStarts: number;
  nimLuna: bigint;
  chatCount: number;
  blocksPlaced: number;
  blocksClaimed: number;
  nimiqPay: boolean;
  isGuest: boolean;
  lastRoomId: string;
  lastRoomTs: number;
  joinedLastHour: boolean;
  hadSessionInWindow: boolean;
};

type LiveSession = {
  address: string;
  lastTs: number;
  ended: boolean;
  roomId: string;
};

type ClaimAcc = {
  address: string;
  luna: bigint;
  /** True once `gameplay_nim_earned` has set the amount (wins over `claim_block`). */
  fromEarn: boolean;
};

function addressKey(address: string): string {
  const t = address.trim();
  if (!t) return "";
  if (t.startsWith("guest:")) return t;
  return t.toUpperCase();
}

function inWindow(ts: number, winStart: number, winEnd: number): boolean {
  return ts >= winStart && ts < winEnd;
}

/**
 * Credit only the slice of a capped idle gap that falls inside the window.
 * A gap that went idle before the window contributes nothing.
 */
function clippedCappedGap(
  prev: number,
  next: number,
  winStart: number,
  winEnd: number
): number {
  if (!(next > prev)) return 0;
  const gapEnd = Math.min(next, prev + ANALYTICS_ACTIVE_PLAY_IDLE_CAP_MS);
  const a = Math.max(prev, winStart);
  const b = Math.min(gapEnd, winEnd);
  if (b <= a) return 0;
  return b - a;
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
 * One pass over the event log for the operator hourly digest.
 *
 * Active time uses the same capped-gap rule as daily stats, clipped to the window,
 * including sessions still open at `windowEndMs`. NIM is gameplay credit
 * (`claim_block` and `gameplay_nim_earned`), deduped by `claimId`, not `nim_payout_sent`
 * (those land later, often in the end-of-day flush).
 */
export async function getActivityDigest(
  windowStartMs: number,
  windowEndMs: number,
  lookbackDays: number
): Promise<ActivityDigest> {
  const scanDays = Math.max(1, Math.floor(lookbackDays));
  const seenBefore = new Set<string>();
  const players = new Map<string, PlayerAcc>();
  const sessions = new Map<string, LiveSession>();
  const claims = new Map<string, ClaimAcc>();
  const looseNimByAddress = new Map<string, bigint>();
  let sessionStarts = 0;
  let sessionStartsLastHour = 0;
  let chatLines = 0;
  let blocksPlaced = 0;
  let blocksClaimed = 0;
  const rooms = new Map<string, { activeMs: number; players: Set<string> }>();
  const lastHourStart = windowEndMs - HOUR_MS;

  function ensure(address: string): PlayerAcc {
    const existing = players.get(address);
    if (existing) return existing;
    const row: PlayerAcc = {
      address,
      activeMs: 0,
      sessionStarts: 0,
      nimLuna: 0n,
      chatCount: 0,
      blocksPlaced: 0,
      blocksClaimed: 0,
      nimiqPay: false,
      isGuest: address.startsWith("guest:"),
      lastRoomId: "",
      lastRoomTs: -1,
      joinedLastHour: false,
      hadSessionInWindow: false,
    };
    players.set(address, row);
    return row;
  }

  function addActive(address: string, gap: number, roomId: string, atTs: number): void {
    if (!address || gap <= 0) return;
    const row = ensure(address);
    row.activeMs += gap;
    const room = roomId.trim();
    if (room) {
      const bucket = rooms.get(room) ?? { activeMs: 0, players: new Set<string>() };
      bucket.activeMs += gap;
      bucket.players.add(address);
      rooms.set(room, bucket);
      if (atTs >= row.lastRoomTs) {
        row.lastRoomId = room;
        row.lastRoomTs = atTs;
      }
    }
  }

  function noteClaim(address: string, claimId: string, luna: bigint, fromEarn: boolean): void {
    if (!address) return;
    if (!claimId) {
      if (luna > 0n) {
        looseNimByAddress.set(address, (looseNimByAddress.get(address) ?? 0n) + luna);
      }
      return;
    }
    const cur = claims.get(claimId);
    if (!cur) {
      claims.set(claimId, { address, luna, fromEarn });
      return;
    }
    if (fromEarn) {
      cur.luna = luna;
      cur.fromEarn = true;
      cur.address = address || cur.address;
    }
  }

  await forEachRecentEvent(scanDays, (rec) => {
    const key = rec.address ? addressKey(rec.address) : "";
    const payload = rec.payload;

    if (rec.kind === ANALYTICS_EVENT_KINDS.sessionStart) {
      if (!key) return;
      if (rec.ts < windowStartMs) seenBefore.add(key);
      if (rec.sessionId) {
        sessions.set(rec.sessionId, {
          address: key,
          lastTs: rec.ts,
          ended: false,
          roomId: rec.roomId || "",
        });
      }
      if (!inWindow(rec.ts, windowStartMs, windowEndMs)) return;
      const row = ensure(key);
      row.sessionStarts += 1;
      row.hadSessionInWindow = true;
      if (rec.ts >= lastHourStart) row.joinedLastHour = true;
      const pay = payload?.nimiqPay === true;
      if (pay) row.nimiqPay = true;
      if (rec.roomId && rec.ts >= row.lastRoomTs) {
        row.lastRoomId = rec.roomId;
        row.lastRoomTs = rec.ts;
      }
      sessionStarts += 1;
      if (rec.ts >= lastHourStart) sessionStartsLastHour += 1;
      return;
    }

    if (rec.kind === ANALYTICS_EVENT_KINDS.sessionEnd) {
      if (!rec.sessionId) return;
      const live = sessions.get(rec.sessionId);
      if (live && !live.ended) {
        const gap = clippedCappedGap(live.lastTs, rec.ts, windowStartMs, windowEndMs);
        addActive(live.address, gap, rec.roomId || live.roomId, rec.ts);
        live.lastTs = rec.ts;
        live.ended = true;
        if (rec.roomId) live.roomId = rec.roomId;
      }
      return;
    }

    if (rec.sessionId) {
      const live = sessions.get(rec.sessionId);
      if (live && !live.ended && kindContributesToActivePlay(rec.kind)) {
        const gap = clippedCappedGap(live.lastTs, rec.ts, windowStartMs, windowEndMs);
        addActive(live.address, gap, rec.roomId || live.roomId, rec.ts);
        live.lastTs = rec.ts;
        if (rec.roomId) live.roomId = rec.roomId;
      }
    }

    if (!inWindow(rec.ts, windowStartMs, windowEndMs) || !key) return;

    if (rec.kind === ANALYTICS_EVENT_KINDS.chat) {
      chatLines += 1;
      ensure(key).chatCount += 1;
      return;
    }
    if (rec.kind === ANALYTICS_EVENT_KINDS.placeBlock) {
      blocksPlaced += 1;
      ensure(key).blocksPlaced += 1;
      return;
    }
    if (rec.kind === ANALYTICS_EVENT_KINDS.claimBlock) {
      blocksClaimed += 1;
      ensure(key).blocksClaimed += 1;
      noteClaim(key, claimIdOf(payload), lunaOf(payload), false);
      return;
    }
    if (rec.kind === ANALYTICS_EVENT_KINDS.gameplayNimEarned) {
      noteClaim(key, claimIdOf(payload), lunaOf(payload), true);
    }
  });

  for (const live of sessions.values()) {
    if (live.ended) continue;
    const gap = clippedCappedGap(live.lastTs, windowEndMs, windowStartMs, windowEndMs);
    addActive(live.address, gap, live.roomId, windowEndMs);
  }

  for (const claim of claims.values()) {
    if (claim.luna <= 0n || !claim.address) continue;
    ensure(claim.address).nimLuna += claim.luna;
  }
  for (const [address, luna] of looseNimByAddress) {
    if (luna > 0n) ensure(address).nimLuna += luna;
  }

  let nimEarned = 0n;
  let activePlayMsTotal = 0;
  let newPlayers = 0;
  let guestPlayers = 0;
  let nimiqPayPlayers = 0;
  const included: PlayerAcc[] = [];

  for (const row of players.values()) {
    const meaningful =
      row.activeMs > 0 ||
      row.nimLuna > 0n ||
      row.sessionStarts > 0 ||
      row.chatCount > 0 ||
      row.blocksPlaced > 0 ||
      row.blocksClaimed > 0;
    if (!meaningful) continue;
    included.push(row);
    nimEarned += row.nimLuna;
    activePlayMsTotal += row.activeMs;
    if (row.hadSessionInWindow && !seenBefore.has(row.address)) newPlayers += 1;
    if (row.isGuest) guestPlayers += 1;
    if (row.nimiqPay) nimiqPayPlayers += 1;
  }

  included.sort((a, b) => {
    if (b.activeMs !== a.activeMs) return b.activeMs - a.activeMs;
    if (b.nimLuna !== a.nimLuna) return b.nimLuna > a.nimLuna ? 1 : -1;
    return a.address < b.address ? -1 : a.address > b.address ? 1 : 0;
  });

  const topRooms: ActivityDigestRoom[] = [...rooms.entries()]
    .map(([roomId, bucket]) => ({
      roomId,
      activeMs: bucket.activeMs,
      uniquePlayers: bucket.players.size,
    }))
    .sort((a, b) => b.activeMs - a.activeMs)
    .slice(0, TOP_ROOM_LIMIT);

  const joinedLastHourAddresses = included
    .filter((row) => row.joinedLastHour)
    .slice(0, 20)
    .map((row) => row.address);

  return {
    windowStartMs,
    windowEndMs,
    lookbackDays: scanDays,
    uniquePlayers: included.length,
    newPlayers,
    guestPlayers,
    nimiqPayPlayers,
    activePlayMsTotal,
    nimEarnedLuna: nimEarned.toString(),
    sessionStarts,
    sessionStartsLastHour,
    chatLines,
    blocksPlaced,
    blocksClaimed,
    topRooms,
    players: included.slice(0, PLAYER_ROW_LIMIT).map((row) => ({
      address: row.address,
      activeMs: row.activeMs,
      sessionStarts: row.sessionStarts,
      nimEarnedLuna: row.nimLuna.toString(),
      chatCount: row.chatCount,
      blocksPlaced: row.blocksPlaced,
      blocksClaimed: row.blocksClaimed,
      nimiqPay: row.nimiqPay,
      isNew: row.hadSessionInWindow && !seenBefore.has(row.address),
      isGuest: row.isGuest,
      lastRoomId: row.lastRoomId,
      joinedLastHour: row.joinedLastHour,
    })),
    playerCount: included.length,
    joinedLastHourAddresses,
  };
}
