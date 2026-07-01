/**
 * World Cup soccer - pure 1v1 Match Pitch geometry helpers (FEATURE-FLAGGED, DEPRECATABLE).
 *
 * A Match Pitch reuses the Free Play Field bounds/goals. Side `"a"` (the challenger) defends
 * the WEST goal and attacks EAST; side `"b"` (the accepter) defends EAST and attacks WEST.
 * Scoring is decided by which net the ball enters (standard soccer): a goal in a side's own
 * net is the opponent's point. This is pure (no rooms/sockets) so it is unit-tested directly;
 * `rooms.ts` owns the room create/teardown, teleport, and broadcast I/O around it.
 */
import type { MatchSide } from "./match.js";

/** Which side scores when the ball enters `goalId`'s net (the net's defender concedes). */
export function scoringSideForGoal(goalId: "west" | "east"): MatchSide {
  // West net is side a's goal -> b scores; east net is side b's goal -> a scores.
  return goalId === "east" ? "a" : "b";
}

/** Kickoff spawn (world units) for a side, on its own half facing the centre ball. */
export function matchSpawn(side: MatchSide): { x: number; z: number } {
  return side === "a" ? { x: -5, z: 0 } : { x: 5, z: 0 };
}
