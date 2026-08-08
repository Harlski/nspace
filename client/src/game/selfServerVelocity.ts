/**
 * Whether `syncState` should copy the server's `vx`/`vz` onto local soft-extrap.
 *
 * Mid-walk room changes must adopt welcome velocity (usually zero) even on the
 * first sync that establishes `selfTargetPos`. Leaving prior-room velocity in
 * place permanently offsets the mesh by {@code SELF_EXTRAP_MAX_OFFSET_XZ} (0.22).
 * Active `selfMoveOrder` playback owns velocity instead.
 */
export function shouldAdoptServerVelocityOnSelfSync(args: {
  hasSelfMoveOrder: boolean;
}): boolean {
  return !args.hasSelfMoveOrder;
}
