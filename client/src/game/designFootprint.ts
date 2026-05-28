import type { ObstacleProps } from "../net/ws.js";

/** Footprint rotation helpers (mirrors server/src/designSnapshot.ts). */

export type DesignSnapshotObstacle = {
  dx: number;
  dz: number;
  y: number;
  props: ObstacleProps;
};

export type DesignSnapshotV1 = {
  schema: 1;
  obstacles: DesignSnapshotObstacle[];
};

export type DesignBbox = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export function footprintFromBbox(bbox: DesignBbox): { w: number; d: number } {
  return {
    w: bbox.maxX - bbox.minX + 1,
    d: bbox.maxZ - bbox.minZ + 1,
  };
}

/** Strip non-portable obstacle props (mirrors server/src/designSnapshot.ts). */
export function sanitizeObstaclePropsForExport(
  props: ObstacleProps
): ObstacleProps | null {
  if (props.teleporter) return null;
  if (props.gate) return null;
  if (props.claimable) return null;
  return {
    passable: props.passable,
    half: props.half,
    quarter: props.quarter,
    hex: props.hex,
    pyramid: props.pyramid,
    sphere: props.sphere,
    ramp: props.ramp,
    rampDir: props.rampDir,
    colorRgb: props.colorRgb,
    locked: props.locked,
    pyramidBaseScale: props.pyramidBaseScale,
    hexRadiusScale: props.hexRadiusScale,
    sphereRadiusScale: props.sphereRadiusScale,
    cubeRotX: props.cubeRotX,
    cubeRotY: props.cubeRotY,
    cubeRotZ: props.cubeRotZ,
  };
}

/** Capture portable snapshot from room blocks in bbox (matches server publish). */
export function captureDesignSnapshot(
  placed: ReadonlyMap<string, ObstacleProps>,
  bbox: DesignBbox
): { snapshot: DesignSnapshotV1; obstacleCount: number } {
  const obstacles: DesignSnapshotObstacle[] = [];
  for (const [key, props] of placed) {
    const parts = key.split(",").map(Number);
    if (parts.length < 3) continue;
    const x = parts[0]!;
    const z = parts[1]!;
    const y = parts[2]!;
    if (x < bbox.minX || x > bbox.maxX || z < bbox.minZ || z > bbox.maxZ) {
      continue;
    }
    const clean = sanitizeObstaclePropsForExport(props);
    if (!clean) continue;
    obstacles.push({
      dx: x - bbox.minX,
      dz: z - bbox.minZ,
      y,
      props: clean,
    });
  }
  return {
    snapshot: { schema: 1, obstacles },
    obstacleCount: obstacles.length,
  };
}

export function rotateDesignOffset(
  dx: number,
  dz: number,
  footprintW: number,
  footprintD: number,
  yawSteps: number
): { dx: number; dz: number } {
  const q = ((Math.floor(yawSteps) % 4) + 4) % 4;
  if (q === 0) return { dx, dz };
  if (q === 1) return { dx: dz, dz: footprintW - 1 - dx };
  if (q === 2) return { dx: footprintW - 1 - dx, dz: footprintD - 1 - dz };
  return { dx: footprintD - 1 - dz, dz: dx };
}

export function rotatedFootprint(
  w: number,
  d: number,
  yawSteps: number
): { w: number; d: number } {
  const q = ((Math.floor(yawSteps) % 4) + 4) % 4;
  if (q % 2 === 1) return { w: d, d: w };
  return { w, d };
}

/** Floor tiles covered by anchor + rotated footprint. */
export function footprintTiles(
  anchorX: number,
  anchorZ: number,
  footprintW: number,
  footprintD: number,
  yawSteps: number
): { x: number; z: number }[] {
  const ax = Math.floor(anchorX);
  const az = Math.floor(anchorZ);
  const { w: rotW, d: rotD } = rotatedFootprint(footprintW, footprintD, yawSteps);
  const tiles: { x: number; z: number }[] = [];
  for (let dx = 0; dx < rotW; dx++) {
    for (let dz = 0; dz < rotD; dz++) {
      tiles.push({ x: ax + dx, z: az + dz });
    }
  }
  return tiles;
}

/** World tile coords for each obstacle after stamp (matches server placement). */
export function designStampWorldObstacles(
  anchorX: number,
  anchorZ: number,
  snapshot: DesignSnapshotV1,
  footprintW: number,
  footprintD: number,
  yawSteps: number
): { x: number; z: number; y: number }[] {
  const ax = Math.floor(anchorX);
  const az = Math.floor(anchorZ);
  const yaw = ((Math.floor(yawSteps) % 4) + 4) % 4;
  return snapshot.obstacles.map((obs) => {
    const { dx, dz } = rotateDesignOffset(
      obs.dx,
      obs.dz,
      footprintW,
      footprintD,
      yaw
    );
    return {
      x: ax + dx,
      z: az + dz,
      y: Math.max(0, Math.min(2, Math.floor(obs.y))),
    };
  });
}
