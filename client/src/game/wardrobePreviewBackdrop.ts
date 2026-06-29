import type { RoomBackgroundNeutral } from "../net/ws.js";
import {
  ROOM_BG_NEUTRAL_RGB,
  roomBgHueDegToRgb,
} from "./blockStyle.js";
import { isBaseTile, isWalkableTile, tileKey } from "./grid.js";
import { pixelImplicitFloorColorRgb } from "./pixelFloorColors.js";
import {
  CANVAS_ROOM_ID,
  CHAMBER_DEFAULT_SPAWN,
  CHAMBER_ROOM_ID,
  getRoomBaseBounds,
  HUB_ROOM_ID,
  normalizeRoomId,
  PIXEL_DEFAULT_SPAWN,
  PIXEL_ROOM_ID,
} from "./roomLayouts.js";

/** Void (non-walkable) — matches `Game.ts` terrain water tone. */
export const TERRAIN_WATER_COLOR = 0xa8d8ea;
export const TERRAIN_TILE_CORE_COLOR = 0x2d3340;
export const TERRAIN_TILE_EXTRA_COLOR = 0x3d5a4a;
export const TERRAIN_TILE_DOOR_COLOR = 0x06b6d4;

const CANVAS_DEFAULT_SPAWN = { x: 0, z: 14 } as const;

export type WardrobePreviewFloorContext = {
  roomId: string;
  extraFloorKeys: ReadonlySet<string>;
  extraFloorColorByKey: ReadonlyMap<string, number>;
  baseFloorColorByKey: ReadonlyMap<string, number>;
  removedBaseFloorKeys: ReadonlySet<string>;
  doorTileKeys: ReadonlySet<string>;
};

export type WardrobePreviewFloorCell = {
  localX: number;
  localZ: number;
  worldX: number;
  worldZ: number;
  walkable: boolean;
  colorRgb: number;
};

export function getRoomDefaultSpawnTile(roomId: string): { x: number; z: number } {
  const id = normalizeRoomId(roomId);
  switch (id) {
    case CHAMBER_ROOM_ID:
      return { ...CHAMBER_DEFAULT_SPAWN };
    case PIXEL_ROOM_ID:
      return { ...PIXEL_DEFAULT_SPAWN };
    case CANVAS_ROOM_ID:
      return { ...CANVAS_DEFAULT_SPAWN };
    case HUB_ROOM_ID:
      return { x: 0, z: 0 };
    default: {
      const b = getRoomBaseBounds(id);
      return {
        x: Math.floor((b.minX + b.maxX) / 2),
        z: Math.floor((b.minZ + b.maxZ) / 2),
      };
    }
  }
}

export function resolveWardrobePreviewAnchorTile(
  selfPosition: { x: number; z: number } | null,
  spawnFallback: { x: number; z: number }
): { x: number; z: number } {
  if (selfPosition) {
    return {
      x: Math.floor(selfPosition.x),
      z: Math.floor(selfPosition.z),
    };
  }
  return spawnFallback;
}

/** Matches `Game.setRoomSceneBackground` for snapshotting the room sky. */
export function roomSceneBackgroundToRgb(opts: {
  hueDeg?: number | null;
  neutral?: RoomBackgroundNeutral | null;
}): number {
  const n = opts.neutral;
  if (n === "black") return ROOM_BG_NEUTRAL_RGB.black;
  if (n === "white") return ROOM_BG_NEUTRAL_RGB.white;
  if (n === "gray") return ROOM_BG_NEUTRAL_RGB.gray;
  const hueDeg = opts.hueDeg;
  if (hueDeg == null || !Number.isFinite(Number(hueDeg))) {
    return TERRAIN_WATER_COLOR;
  }
  return roomBgHueDegToRgb(Number(hueDeg));
}

function implicitBaseFloorColorRgb(
  roomId: string,
  x: number,
  z: number
): number | undefined {
  if (normalizeRoomId(roomId) !== PIXEL_ROOM_ID) return undefined;
  if (!isBaseTile(x, z, roomId)) return undefined;
  return pixelImplicitFloorColorRgb(x, z);
}

function walkableFloorTopColor(
  isPortalGlow: boolean,
  isExtra: boolean,
  extraColorRgb: number | undefined,
  coreColorOverride: number | undefined
): number {
  if (isPortalGlow) return TERRAIN_TILE_DOOR_COLOR;
  if (coreColorOverride !== undefined) return coreColorOverride;
  if (isExtra) return extraColorRgb ?? TERRAIN_TILE_EXTRA_COLOR;
  return TERRAIN_TILE_CORE_COLOR;
}

function resolveFloorCellColor(
  worldX: number,
  worldZ: number,
  floorCtx: WardrobePreviewFloorContext
): { walkable: boolean; colorRgb: number } {
  const k = tileKey(worldX, worldZ);
  const walkable = isWalkableTile(
    worldX,
    worldZ,
    floorCtx.extraFloorKeys,
    floorCtx.roomId,
    floorCtx.removedBaseFloorKeys.size > 0
      ? floorCtx.removedBaseFloorKeys
      : undefined
  );
  if (!walkable) {
    return { walkable: false, colorRgb: TERRAIN_WATER_COLOR };
  }
  const isExtra = !isBaseTile(worldX, worldZ, floorCtx.roomId);
  const isPortalGlow = floorCtx.doorTileKeys.has(k);
  const extraColor = isExtra
    ? floorCtx.extraFloorColorByKey.get(k)
    : undefined;
  const coreColor = !isExtra
    ? (floorCtx.baseFloorColorByKey.get(k) ??
      implicitBaseFloorColorRgb(floorCtx.roomId, worldX, worldZ))
    : undefined;
  return {
    walkable: true,
    colorRgb: walkableFloorTopColor(
      isPortalGlow,
      isExtra,
      extraColor,
      coreColor
    ),
  };
}

/** Symmetric 3×3 patch with the anchor tile at local (0, 0). */
export function buildWardrobePreviewFloorPatch(
  anchorX: number,
  anchorZ: number,
  floorCtx: WardrobePreviewFloorContext
): WardrobePreviewFloorCell[] {
  const cells: WardrobePreviewFloorCell[] = [];
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const worldX = anchorX + dx;
      const worldZ = anchorZ + dz;
      const { walkable, colorRgb } = resolveFloorCellColor(
        worldX,
        worldZ,
        floorCtx
      );
      cells.push({
        localX: dx,
        localZ: dz,
        worldX,
        worldZ,
        walkable,
        colorRgb,
      });
    }
  }
  return cells;
}
