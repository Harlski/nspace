import { normalizeRoomId } from "../game/roomLayouts.js";

/** Client mirror of server Play Space bounds (see server/src/directInvite/playSpaceLayout.ts). */
export const PLAY_SPACE_BOUNDS = {
  minX: -8,
  maxX: 8,
  minZ: -6,
  maxZ: 6,
} as const;

export const INVITE_LOBBY_PREFIX = "invite-lobby-";

/** Play Space slugs are 8 alphanumeric chars (mixed case). */
export const PLAY_SPACE_SLUG_LENGTH = 8;

const PLAY_SPACE_SLUG_RE = /^[A-Za-z0-9]{8}$/;

export function isPlaySpaceRoomId(roomId: string | null | undefined): boolean {
  return typeof roomId === "string" && roomId.startsWith(INVITE_LOBBY_PREFIX);
}

/** Strip invalid characters; preserve case (Play Space slugs are case-sensitive). */
export function sanitizeRoomsJoinCodeInput(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32);
}

/**
 * Map the Rooms modal “Join with code” field to a room id.
 * Six-character wallet room codes are case-insensitive; Play Space slugs are not.
 */
export function resolveRoomsJoinTarget(
  raw: string,
  knownRoomIds: readonly string[] = []
): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (isPlaySpaceRoomId(t)) return normalizeRoomId(t);
  if (/^[A-Za-z0-9]{6}$/.test(t)) return t.toLowerCase();
  if (PLAY_SPACE_SLUG_RE.test(t)) {
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
