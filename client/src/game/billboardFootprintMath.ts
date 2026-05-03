/**
 * Floor footprint for billboards — matches Three.js `mesh.rotation.y = yaw * π/2`
 * applied to the plane width axis (local +X / face width).
 */

export function billboardWidthStepXZ(yawSteps: number): { dx: number; dz: number } {
  const q = ((Math.floor(yawSteps) % 4) + 4) % 4;
  const cos = [1, 0, -1, 0][q]!;
  const sin = [0, 1, 0, -1][q]!;
  const vx = cos;
  const vz = -sin;
  if (Math.abs(vx) >= Math.abs(vz)) {
    return { dx: vx > 0 ? 1 : -1, dz: 0 };
  }
  return { dx: 0, dz: vz > 0 ? 1 : -1 };
}

export function billboardFootprintWidthTiles(
  orientation: "horizontal" | "vertical"
): number {
  return orientation === "horizontal" ? 4 : 2;
}

export function billboardFootprintTilesXZ(
  anchorX: number,
  anchorZ: number,
  orientation: "horizontal" | "vertical",
  yawSteps: number
): { x: number; z: number }[] {
  const w = billboardFootprintWidthTiles(orientation);
  const { dx, dz } = billboardWidthStepXZ(yawSteps);
  const tiles: { x: number; z: number }[] = [];
  for (let i = 0; i < w; i++) {
    tiles.push({ x: anchorX + i * dx, z: anchorZ + i * dz });
  }
  return tiles;
}

export function billboardPlaneCenterXZ(
  anchorX: number,
  anchorZ: number,
  orientation: "horizontal" | "vertical",
  yawSteps: number
): { cx: number; cz: number } {
  const tiles = billboardFootprintTilesXZ(
    anchorX,
    anchorZ,
    orientation,
    yawSteps
  );
  let sx = 0;
  let sz = 0;
  for (const t of tiles) {
    sx += t.x;
    sz += t.z;
  }
  const n = tiles.length || 1;
  return { cx: sx / n, cz: sz / n };
}
