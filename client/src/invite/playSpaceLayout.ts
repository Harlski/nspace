/** Client mirror of server Play Space bounds (see server/src/directInvite/playSpaceLayout.ts). */
export const PLAY_SPACE_BOUNDS = {
  minX: -8,
  maxX: 8,
  minZ: -6,
  maxZ: 6,
} as const;

export const INVITE_LOBBY_PREFIX = "invite-lobby-";

export function isPlaySpaceRoomId(roomId: string | null | undefined): boolean {
  return typeof roomId === "string" && roomId.startsWith(INVITE_LOBBY_PREFIX);
}
