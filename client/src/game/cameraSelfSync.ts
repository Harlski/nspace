/**
 * When `syncState` applies the local player's pose, decide whether to snap
 * `cameraLookAt` onto them (and mark camera follow ready).
 *
 * Room entry clears `selfTargetPos` via `setSelf`; the first sync must snap even
 * if a prior-room `selfMoveOrder` is still hanging, otherwise the look-at stays
 * in the previous room's coordinates.
 *
 * While Path Playback owns the walk, tick `stateDelta` often omits live pose and
 * `lastPlayers` keeps the walk-start tile. That stale pose is easily >6 from the
 * mesh mid-walk — treating it as `jumped` would yank the camera back every
 * ~STATE_BROADCAST_MIN_MS (seen as periodic hitch in camjit captures).
 */
export function shouldSnapCameraOnSelfSync(args: {
  /** True when this sync creates `selfTargetPos` (fresh after setSelf / room entry). */
  establishingSelfTarget: boolean;
  hasSelfMoveOrder: boolean;
  cameraFollowReady: boolean;
  jumped: boolean;
}): boolean {
  if (args.establishingSelfTarget) return true;
  // Path Playback owns pose; ignore stale snapshot "jumps".
  if (args.hasSelfMoveOrder) {
    return false;
  }
  if (args.jumped) return true;
  // Lock follow onto the avatar once when idle.
  if (!args.cameraFollowReady) return true;
  return false;
}

/**
 * Whether `syncState` should teleport `selfMesh` onto the welcome / snapshot pose
 * instead of only updating the lerp target.
 *
 * Same-WS `joinRoom` can keep the old mesh. Hub spawn (-5, 0) to lounge center
 * (0, 0) is a 5-tile hop, under the ordinary jump threshold of 6, so without a
 * room-welcome flag the avatar (and debug overlay) stays in the previous room's
 * coordinates.
 *
 * Mid-walk: same stale-pose issue as {@link shouldSnapCameraOnSelfSync} — do not
 * hard-snap the mesh onto the omitted-pose walk-start tile.
 */
export function shouldHardSnapSelfMeshOnSync(args: {
  establishingSelfTarget: boolean;
  jumped: boolean;
  pendingRoomWelcomeSnap: boolean;
  hasSelfMoveOrder?: boolean;
}): boolean {
  if (args.pendingRoomWelcomeSnap) return true;
  if (args.establishingSelfTarget) return true;
  if (args.hasSelfMoveOrder) return false;
  return args.jumped;
}
