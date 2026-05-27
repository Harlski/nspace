/**
 * Portable design snapshots (object prefabs and room regions).
 */
import type { TerrainProps } from "./grid.js";
import { blockKey } from "./grid.js";

export const DESIGN_SNAPSHOT_SCHEMA = 1 as const;

export type DesignKind = "object" | "room";

export type DesignSnapshotObstacle = {
  dx: number;
  dz: number;
  y: number;
  props: TerrainProps;
};

export type DesignSnapshotV1 = {
  schema: typeof DESIGN_SNAPSHOT_SCHEMA;
  obstacles: DesignSnapshotObstacle[];
  extraFloor?: Array<{ dx: number; dz: number; colorRgb: number }>;
  baseFloorColors?: Array<{ dx: number; dz: number; colorRgb: number }>;
};

export type DesignBbox = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export const DESIGN_OBJECT_MAX_FOOTPRINT = ((): number => {
  const raw = process.env.DESIGN_OBJECT_MAX_FOOTPRINT;
  const n = raw !== undefined && raw !== "" ? Number(raw) : 6;
  return Number.isFinite(n) && n >= 2 ? Math.floor(n) : 6;
})();

export const DESIGN_OBJECT_MAX_OBSTACLES = 80;
export const DESIGN_ROOM_MAX_FOOTPRINT = 20;
export const DESIGN_ROOM_MAX_OBSTACLES = 500;

export function designCapsForKind(kind: DesignKind): {
  maxFootprint: number;
  maxObstacles: number;
} {
  if (kind === "object") {
    return {
      maxFootprint: DESIGN_OBJECT_MAX_FOOTPRINT,
      maxObstacles: DESIGN_OBJECT_MAX_OBSTACLES,
    };
  }
  return {
    maxFootprint: DESIGN_ROOM_MAX_FOOTPRINT,
    maxObstacles: DESIGN_ROOM_MAX_OBSTACLES,
  };
}

/** Strip gameplay-sensitive or non-portable props from exported obstacles. */
export function sanitizeObstaclePropsForExport(
  props: TerrainProps
): TerrainProps | null {
  if (props.teleporter) return null;
  if (props.gate) return null;
  if (props.claimable) return null;
  const out: TerrainProps = {
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
  return out;
}

export function normalizeDesignBbox(
  aX: number,
  aZ: number,
  bX: number,
  bZ: number
): DesignBbox {
  return {
    minX: Math.min(aX, bX),
    maxX: Math.max(aX, bX),
    minZ: Math.min(aZ, bZ),
    maxZ: Math.max(aZ, bZ),
  };
}

export function footprintFromBbox(bbox: DesignBbox): {
  w: number;
  d: number;
} {
  return {
    w: bbox.maxX - bbox.minX + 1,
    d: bbox.maxZ - bbox.minZ + 1,
  };
}

export function validateBboxForKind(
  bbox: DesignBbox,
  kind: DesignKind
): string | null {
  const { w, d } = footprintFromBbox(bbox);
  const caps = designCapsForKind(kind);
  if (w < 1 || d < 1) return "invalid_bbox";
  if (w > caps.maxFootprint || d > caps.maxFootprint) {
    return "footprint_too_large";
  }
  return null;
}

export type RoomPlacedMap = Map<string, TerrainProps>;
export type RoomExtraFloorMap = Map<string, number>;
export type RoomBaseFloorColorMap = Map<string, number>;

export function captureDesignSnapshot(
  placed: RoomPlacedMap,
  extraFloor: RoomExtraFloorMap | undefined,
  baseFloorColors: RoomBaseFloorColorMap | undefined,
  bbox: DesignBbox
): { snapshot: DesignSnapshotV1; obstacleCount: number } | { error: string } {
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
  const extraFloorOut: Array<{ dx: number; dz: number; colorRgb: number }> = [];
  if (extraFloor) {
    for (const [tk, v] of extraFloor) {
      const parts = tk.split(",").map(Number);
      if (parts.length < 2) continue;
      const x = parts[0]!;
      const z = parts[1]!;
      if (x < bbox.minX || x > bbox.maxX || z < bbox.minZ || z > bbox.maxZ) {
        continue;
      }
      extraFloorOut.push({
        dx: x - bbox.minX,
        dz: z - bbox.minZ,
        colorRgb: v,
      });
    }
  }
  const baseFloorOut: Array<{ dx: number; dz: number; colorRgb: number }> = [];
  if (baseFloorColors) {
    for (const [tk, v] of baseFloorColors) {
      const parts = tk.split(",").map(Number);
      if (parts.length < 2) continue;
      const x = parts[0]!;
      const z = parts[1]!;
      if (x < bbox.minX || x > bbox.maxX || z < bbox.minZ || z > bbox.maxZ) {
        continue;
      }
      baseFloorOut.push({
        dx: x - bbox.minX,
        dz: z - bbox.minZ,
        colorRgb: v,
      });
    }
  }
  const snapshot: DesignSnapshotV1 = {
    schema: DESIGN_SNAPSHOT_SCHEMA,
    obstacles,
    ...(extraFloorOut.length > 0 ? { extraFloor: extraFloorOut } : {}),
    ...(baseFloorOut.length > 0 ? { baseFloorColors: baseFloorOut } : {}),
  };
  return { snapshot, obstacleCount: obstacles.length };
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

export function absoluteObstacleKey(
  anchorX: number,
  anchorZ: number,
  dx: number,
  dz: number,
  y: number
): string {
  return blockKey(anchorX + dx, anchorZ + dz, y);
}
