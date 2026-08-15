/**
 * Signpost-hint foreground occlusion helpers.
 *
 * Walk mode hides floating doc icons when another block sits between the
 * camera and the hint. Naively raycasting every placed block per hint is
 * O(hints × blocks) and tanks FPS on dense rooms (hub ~49 × ~9k).
 *
 * These helpers narrow candidates to tiles along the camera→hint XZ segment
 * (plus a pad), so cost stays near O(blocks + hints × segment length).
 */

/** Integer floor tiles visited along the segment (x0,z0)→(x1,z1), inclusive. */
export function forEachTileOnSegment(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  visit: (tx: number, tz: number) => void
): void {
  let tx0 = Math.floor(x0);
  let tz0 = Math.floor(z0);
  const tx1 = Math.floor(x1);
  const tz1 = Math.floor(z1);
  visit(tx0, tz0);
  if (tx0 === tx1 && tz0 === tz1) return;

  const dx = x1 - x0;
  const dz = z1 - z0;
  const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
  const stepZ = dz > 0 ? 1 : dz < 0 ? -1 : 0;
  const absDx = Math.abs(dx);
  const absDz = Math.abs(dz);

  // Parametric t where the ray crosses the next vertical / horizontal grid line.
  let tMaxX =
    stepX !== 0 ? (stepX > 0 ? tx0 + 1 - x0 : x0 - tx0) / absDx : Infinity;
  let tMaxZ =
    stepZ !== 0 ? (stepZ > 0 ? tz0 + 1 - z0 : z0 - tz0) / absDz : Infinity;
  const tDeltaX = stepX !== 0 ? 1 / absDx : Infinity;
  const tDeltaZ = stepZ !== 0 ? 1 / absDz : Infinity;

  // Bound iterations to segment Manhattan span + 2 (safety).
  const maxSteps = Math.abs(tx1 - tx0) + Math.abs(tz1 - tz0) + 2;
  for (let i = 0; i < maxSteps; i++) {
    if (tx0 === tx1 && tz0 === tz1) break;
    if (tMaxX < tMaxZ) {
      tx0 += stepX;
      tMaxX += tDeltaX;
    } else if (tMaxZ < tMaxX) {
      tz0 += stepZ;
      tMaxZ += tDeltaZ;
    } else {
      // Corner: advance both so we do not skip a diagonal tile.
      tx0 += stepX;
      tz0 += stepZ;
      tMaxX += tDeltaX;
      tMaxZ += tDeltaZ;
    }
    visit(tx0, tz0);
  }
}

/**
 * Visit every floor tile within Chebyshev `pad` of the segment
 * (x0,z0)→(x1,z1). Used to gather occlusion raycast candidates.
 */
export function forEachPaddedTileOnSegment(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  pad: number,
  visit: (tx: number, tz: number) => void
): void {
  const seen = new Set<string>();
  const p = Math.max(0, Math.floor(pad));
  forEachTileOnSegment(x0, z0, x1, z1, (tx, tz) => {
    for (let dz = -p; dz <= p; dz++) {
      for (let dx = -p; dx <= p; dx++) {
        const x = tx + dx;
        const z = tz + dz;
        const k = `${x},${z}`;
        if (seen.has(k)) continue;
        seen.add(k);
        visit(x, z);
      }
    }
  });
}
