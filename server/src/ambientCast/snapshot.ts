import { isInviteLobbyRoomId } from "../directInvite/config.js";
import { faceTokenForWallet } from "./faceToken.js";

export type AmbientCastJoinRecord = {
  kind: string;
  address: string;
  roomId: string;
  ts: number;
};

export type AmbientCastFace = { token: string };

export type AmbientCastSnapshot = {
  day: string;
  refreshedAt: number;
  faces: AmbientCastFace[];
};

/** YYYY-MM-DD in UTC for a unix ms timestamp. */
export function utcDayKey(tsMs: number = Date.now()): string {
  const d = new Date(tsMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isPublicSharedAmbientRoom(roomId: string): boolean {
  return !isInviteLobbyRoomId(roomId);
}

/**
 * Unique wallets with a session_start into a public/shared room on the given UTC day.
 * Play Spaces (invite lobbies) are excluded.
 */
export function eligibleWalletsForAmbientCast(
  records: AmbientCastJoinRecord[],
  day: string
): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const rec of records) {
    if (rec.kind !== "session_start") continue;
    if (!rec.address || !rec.roomId) continue;
    if (utcDayKey(rec.ts) !== day) continue;
    if (!isPublicSharedAmbientRoom(rec.roomId)) continue;
    const key = rec.address.replace(/\s+/g, "").toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    order.push(rec.address);
  }
  return order;
}

export function buildAmbientCastSnapshot(opts: {
  day: string;
  refreshedAt?: number;
  records: AmbientCastJoinRecord[];
  tokenForWallet?: (address: string) => string;
}): AmbientCastSnapshot {
  const tokenForWallet = opts.tokenForWallet ?? faceTokenForWallet;
  const wallets = eligibleWalletsForAmbientCast(opts.records, opts.day);
  const faces: AmbientCastFace[] = [];
  for (const wallet of wallets) {
    const token = tokenForWallet(wallet);
    if (!token) continue;
    faces.push({ token });
  }
  return {
    day: opts.day,
    refreshedAt: opts.refreshedAt ?? Date.now(),
    faces,
  };
}
