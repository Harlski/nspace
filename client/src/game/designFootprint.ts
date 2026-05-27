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
