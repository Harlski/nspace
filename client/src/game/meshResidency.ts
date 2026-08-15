/**
 * Client mesh residency planner — which 32×32 chunks should have live meshes.
 *
 * Data (placedObjects, floor keys) stays in memory; only GPU/scene meshes follow
 * the client residency rect. Unload uses +1 chunk hysteresis so edge pans do not
 * thrash. See `.scratch/mesh-residency/PRD.md`.
 */

import {
  interestChunksFromRect,
  type ViewInterestRect,
} from "./interestChunks.js";

/** Chunks outside interest+this pad are eligible for mesh disposal. */
export const MESH_RESIDENCY_UNLOAD_PADDING_CHUNKS = 1;

/**
 * Next resident chunk set from the previous set and the current client
 * residency rect (same frustum math as view interest; always available).
 *
 * - Load: chunks intersecting the rect (no extra chunk pad).
 * - Keep: rect expanded by {@link MESH_RESIDENCY_UNLOAD_PADDING_CHUNKS}.
 * - Next: (previous ∩ keep) ∪ load.
 */
export function nextResidentChunks(
  previous: ReadonlySet<string>,
  rect: ViewInterestRect
): Set<string> {
  const load = interestChunksFromRect(rect, 0);
  const keep = interestChunksFromRect(
    rect,
    MESH_RESIDENCY_UNLOAD_PADDING_CHUNKS
  );
  const next = new Set<string>();
  for (const c of previous) {
    if (keep.has(c)) next.add(c);
  }
  for (const c of load) next.add(c);
  return next;
}

/** True when tile (tx, tz) lies in a resident chunk. */
export function tileInResidentChunks(
  tx: number,
  tz: number,
  resident: ReadonlySet<string>,
  chunkKeyOf: (tx: number, tz: number) => string
): boolean {
  return resident.has(chunkKeyOf(tx, tz));
}
