/**
 * Zero planar walk velocity when a path is abandoned mid-step (teleport, stop,
 * no_path snap). Leaving leftover vx/vz in welcome / stateDelta makes clients
 * soft-extrapolate up to their extrap cap without a real path.
 */
export function haltPathVelocity(player: { vx: number; vz: number }): void {
  player.vx = 0;
  player.vz = 0;
}
