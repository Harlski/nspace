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
  // Stale move-order from the previous room must not suppress a pending snap.
  if (!args.cameraFollowReady || args.jumped) return true;
  return false;
}
