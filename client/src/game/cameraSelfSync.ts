/**
 * When `syncState` applies the local player's pose, decide whether to snap
 * `cameraLookAt` onto them (and mark camera follow ready).
 *
 * Room entry clears `selfTargetPos` via `setSelf`; the first sync must snap even
 * if a prior-room `selfMoveOrder` is still hanging, otherwise the look-at stays
 * in the previous room's coordinates.
 */
export function shouldSnapCameraOnSelfSync(args: {
  /** True when this sync creates `selfTargetPos` (fresh after setSelf / room entry). */
  establishingSelfTarget: boolean;
  hasSelfMoveOrder: boolean;
  cameraFollowReady: boolean;
  jumped: boolean;
}): boolean {
  if (args.establishingSelfTarget) return true;
  if (args.jumped) return true;
  // Lock follow onto the avatar once, but do not snap (and drop Path Playback) mid-walk.
  if (!args.cameraFollowReady && !args.hasSelfMoveOrder) return true;
  return false;
}
