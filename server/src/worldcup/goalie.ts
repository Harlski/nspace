/**
 * World Cup soccer — pure Goalie behaviour (FEATURE-FLAGGED, DEPRECATABLE).
 *
 * A Goalie patrols the line just in front of a goal mouth, tracking the ball laterally
 * (along z) with a reaction lag and a capped move-speed. Two behaviour models share this
 * tracking; `rooms.ts` selects one at runtime via `WORLDCUP_GOALIE_MODE`:
 *
 *  - `kicker`  — the keeper is injected into the proximity-kick path as an extra "player"
 *                so the existing kick clears the ball; this module just gives its position.
 *  - `blocker` — the keeper is a `CircleCollider` the ball reflects off inside `stepBall`.
 *
 * Pure (no I/O): the lateral target tracks the ball, bounded by the goal-line limits and
 * the max move-speed, so it is unit-tested directly. Goal attribution treats a goalie
 * touch as uncredited via a sentinel address (see config) so it can never be farmed.
 */
import type { CircleCollider } from "./ballPhysics.js";
import type { GoalZone } from "./config.js";

export interface GoalieTuning {
  /** Lateral tracking speed along the goal line (units/sec). */
  moveSpeed: number;
  /** Collision / kick radius of the keeper. */
  radius: number;
  /** Reaction lag: time constant (ms) to lock onto the ball's z. */
  reactionMs: number;
  /**
   * Fraction (0..1) of the radius-inset mouth the keeper may patrol, centred on the mouth.
   * Below 1 it leaves a permanent gap at each corner so a well-placed shot can beat the
   * keeper. Defaults to 1 (the keeper can reach the whole mouth) when omitted.
   */
  coverage?: number;
}

export interface GoalieState {
  /** Current lateral position along the goal line. */
  z: number;
  /** Reaction-lagged perception of the ball's z (chases the true z). */
  trackedZ: number;
}

/** The fixed x the keeper patrols on — the pitch-facing edge of the goal mouth. */
export function goalieLineX(goal: GoalZone): number {
  return goal.id === "west" ? goal.maxX : goal.minX;
}

/**
 * Lateral z range the keeper centre can occupy: the mouth inset by its radius, then scaled
 * to `coverage` of that half-width around the mouth centre. `coverage` 1 keeps the keeper
 * able to reach both posts; a smaller value opens a fixed corner gap on each side.
 */
export function goalieZRange(
  goal: GoalZone,
  radius: number,
  coverage = 1
): { zMin: number; zMax: number } {
  const mid = (goal.minZ + goal.maxZ) / 2;
  const insetHalf = (goal.maxZ - goal.minZ + 1) / 2 - radius;
  const half = Math.max(0, insetHalf * coverage);
  return { zMin: mid - half, zMax: mid + half };
}

/** A keeper starts at the centre of its mouth. */
export function initGoalieState(goal: GoalZone): GoalieState {
  const mid = (goal.minZ + goal.maxZ) / 2;
  return { z: mid, trackedZ: mid };
}

/**
 * Advance the keeper one step toward the ball. Returns a NEW state (does not mutate).
 * Reaction lag is a first-order chase of the ball's z; the keeper then steps toward that
 * lagged target, clamped to the mouth and to `moveSpeed * dt` per step.
 */
export function stepGoalie(
  state: GoalieState,
  ballZ: number,
  dtMs: number,
  goal: GoalZone,
  cfg: GoalieTuning
): GoalieState {
  const dt = Math.max(0, dtMs) / 1000;
  const blend = cfg.reactionMs <= 0 ? 1 : Math.min(1, dtMs / cfg.reactionMs);
  const trackedZ = state.trackedZ + (ballZ - state.trackedZ) * blend;
  const { zMin, zMax } = goalieZRange(goal, cfg.radius, cfg.coverage ?? 1);
  const target = Math.max(zMin, Math.min(zMax, trackedZ));
  const maxStep = cfg.moveSpeed * dt;
  const delta = target - state.z;
  const z =
    Math.abs(delta) <= maxStep ? target : state.z + Math.sign(delta) * maxStep;
  return { z, trackedZ };
}

/** Blocker-mode collider for the keeper at its current position. */
export function goalieCollider(
  goal: GoalZone,
  state: GoalieState,
  radius: number
): CircleCollider {
  return { x: goalieLineX(goal), z: state.z, radius };
}
