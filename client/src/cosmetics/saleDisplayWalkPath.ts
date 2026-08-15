/** Pure helpers for Sale Display mannequin walk-path authoring. */

export type WalkPathTile = { x: number; z: number };

/**
 * Click a new tile to append; click an existing waypoint to drop it and every tile after
 * (so re-clicking the last tile undoes one step).
 */
export function toggleWalkPathTile(
  tiles: readonly WalkPathTile[],
  x: number,
  z: number
): WalkPathTile[] {
  const tx = Math.floor(x);
  const tz = Math.floor(z);
  const idx = tiles.findIndex((t) => t.x === tx && t.z === tz);
  if (idx >= 0) return tiles.slice(0, idx).map((t) => ({ x: t.x, z: t.z }));
  return [...tiles.map((t) => ({ x: t.x, z: t.z })), { x: tx, z: tz }];
}
