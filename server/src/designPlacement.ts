/**
 * Server-side validation and planning for stamping a design into a room.
 */
import type { RoomBounds } from "./roomLayouts.js";
import {
  getSnapshot,
  getDesignById,
  hasEntitlement,
  type DesignRecord,
} from "./designs.js";
import {
  rotateDesignOffset,
  rotatedFootprint,
  type DesignSnapshotV1,
  type RoomPlacedMap,
} from "./designSnapshot.js";
import { blockKey, type TerrainProps } from "./grid.js";

export type PlannedPlacement = {
  key: string;
  x: number;
  z: number;
  y: number;
  props: TerrainProps;
};

export type PlanDesignStampResult =
  | {
      ok: true;
      placements: PlannedPlacement[];
      /** Existing placed keys cleared inside the rotated footprint before stamp. */
      removals: string[];
      footprintW: number;
      footprintD: number;
      design: DesignRecord;
    }
  | { ok: false; code: string };

/** All stack levels at (x,z) inside the stamp footprint. */
function placedKeysInFootprint(
  placed: RoomPlacedMap,
  ax: number,
  az: number,
  rotW: number,
  rotD: number
): string[] {
  const removals: string[] = [];
  for (const key of placed.keys()) {
    const parts = key.split(",").map(Number);
    if (parts.length < 2) continue;
    const x = parts[0]!;
    const z = parts[1]!;
    if (x < ax || x > ax + rotW - 1 || z < az || z > az + rotD - 1) {
      continue;
    }
    removals.push(key);
  }
  return removals;
}

function snapshotForDesign(designId: string, version: number): DesignSnapshotV1 | null {
  const row = getSnapshot(designId, version);
  return row?.payload ?? null;
}

export function planDesignStampInRoom(opts: {
  designId: string;
  wallet: string;
  roomId: string;
  bounds: RoomBounds;
  anchorX: number;
  anchorZ: number;
  yawSteps: number;
  placed: RoomPlacedMap;
  isWalkable: (x: number, z: number) => boolean;
  playerOnTile: (x: number, z: number) => boolean;
}): PlanDesignStampResult {
  const design = getDesignById(opts.designId);
  if (!design) return { ok: false, code: "design_not_found" };
  if (!hasEntitlement(opts.wallet, design.id)) {
    return { ok: false, code: "not_entitled" };
  }
  const payload = snapshotForDesign(design.id, design.version);
  if (!payload) return { ok: false, code: "snapshot_missing" };

  const yaw = ((Math.floor(opts.yawSteps) % 4) + 4) % 4;
  const { w: rotW, d: rotD } = rotatedFootprint(
    design.footprintW,
    design.footprintD,
    yaw
  );
  const ax = Math.floor(opts.anchorX);
  const az = Math.floor(opts.anchorZ);

  for (let dx = 0; dx < rotW; dx++) {
    for (let dz = 0; dz < rotD; dz++) {
      const x = ax + dx;
      const z = az + dz;
      if (
        x < opts.bounds.minX ||
        x > opts.bounds.maxX ||
        z < opts.bounds.minZ ||
        z > opts.bounds.maxZ
      ) {
        return { ok: false, code: "out_of_bounds" };
      }
      if (!opts.isWalkable(x, z)) {
        return { ok: false, code: "unwalkable_tile" };
      }
      if (opts.playerOnTile(x, z)) {
        return { ok: false, code: "player_on_tile" };
      }
    }
  }

  const placements: PlannedPlacement[] = [];
  for (const obs of payload.obstacles) {
    const { dx, dz } = rotateDesignOffset(
      obs.dx,
      obs.dz,
      design.footprintW,
      design.footprintD,
      yaw
    );
    const x = ax + dx;
    const z = az + dz;
    const y = Math.max(0, Math.min(2, Math.floor(obs.y)));
    const key = blockKey(x, z, y);
    placements.push({ key, x, z, y, props: { ...obs.props } });
  }

  if (placements.length === 0) {
    return { ok: false, code: "empty_design" };
  }

  const removals = placedKeysInFootprint(opts.placed, ax, az, rotW, rotD);

  return {
    ok: true,
    placements,
    removals,
    footprintW: rotW,
    footprintD: rotD,
    design,
  };
}
