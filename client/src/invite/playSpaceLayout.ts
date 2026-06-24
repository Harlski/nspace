import { normalizeRoomId } from "../game/roomLayouts.js";

/** Client mirror of server Play Space bounds (see server/src/directInvite/playSpaceLayout.ts). */
export const PLAY_SPACE_BOUNDS = {
  minX: -8,
  maxX: 8,
  minZ: -6,
  maxZ: 6,
} as const;

export const INVITE_LOBBY_PREFIX = "invite-lobby-";

/** Shared join code length for wallet rooms and Play Spaces (must match server/src/joinCode.ts). */
export const JOIN_CODE_LENGTH = 6;

/** @deprecated Use JOIN_CODE_LENGTH — kept for call-site clarity. */
export const PLAY_SPACE_SLUG_LENGTH = JOIN_CODE_LENGTH;

/** @deprecated Use JOIN_CODE_LENGTH — kept for call-site clarity. */
export const WALLET_ROOM_CODE_LENGTH = JOIN_CODE_LENGTH;

/** Play Space slugs minted before unification (mixed case, 8 chars). */
export const LEGACY_PLAY_SPACE_SLUG_LENGTH = 8;

export function isPlaySpaceRoomId(roomId: string | null | undefined): boolean {
  return typeof roomId === "string" && roomId.startsWith(INVITE_LOBBY_PREFIX);
}

export function isJoinCodeInput(value: string): boolean {
  return (
    value.length === JOIN_CODE_LENGTH && /^[A-Za-z0-9]+$/.test(value)
  );
}

export function isLegacyPlaySpaceSlugInput(value: string): boolean {
  return (
    value.length === LEGACY_PLAY_SPACE_SLUG_LENGTH &&
    /^[A-Za-z0-9]+$/.test(value)
  );
}

export function normalizeJoinCodeInput(value: string): string {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

function walletRoomIdFromJoinCode(raw: string): string {
  return normalizeJoinCodeInput(raw).toLowerCase();
}

/** True when a pending join code matches the resolved room id from the server. */
export function joinCodeMatchesRoom(pending: string, roomId: string): boolean {
  const p = pending.trim();
  if (!p) return false;
  if (normalizeRoomId(p).toLowerCase() === normalizeRoomId(roomId).toLowerCase()) {
    return true;
  }
  if (isJoinCodeInput(p)) {
    const code = normalizeJoinCodeInput(p);
    if (walletRoomIdFromJoinCode(p) === normalizeRoomId(roomId).toLowerCase()) {
      return true;
    }
    if (isPlaySpaceRoomId(roomId)) {
      return roomId.slice(INVITE_LOBBY_PREFIX.length).toUpperCase() === code;
    }
  }
  return false;
}

/**
 * Strip invalid characters. Unified 6-char join codes are forced to uppercase;
 * legacy 8-char Play Space slugs keep mixed case.
 */
export function sanitizeRoomsJoinCodeInput(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32);
  if (isJoinCodeInput(cleaned)) return cleaned.toUpperCase();
  return cleaned;
}

/**
 * Map the Rooms modal “Join with code” field to a join target.
 * Six-character codes are sent uppercase; the server resolves wallet room vs Play Space.
 */
export function resolveRoomsJoinTarget(
  raw: string,
  knownRoomIds: readonly string[] = []
): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (isPlaySpaceRoomId(t)) return normalizeRoomId(t);
  if (isJoinCodeInput(t)) return normalizeJoinCodeInput(t);
  if (isLegacyPlaySpaceSlugInput(t)) {
    const lower = t.toLowerCase();
    if (
      knownRoomIds.some((id) => normalizeRoomId(id).toLowerCase() === lower)
    ) {
      return lower;
    }
    return `${INVITE_LOBBY_PREFIX}${t}`;
  }
  if (t.length >= 2) return normalizeRoomId(t.toLowerCase());
  return null;
}
