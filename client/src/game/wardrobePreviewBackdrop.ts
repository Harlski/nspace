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

/** Void (non-walkable) - matches `Game.ts` terrain water tone. */
export const TERRAIN_WATER_COLOR = 0xa8d8ea;
export const TERRAIN_TILE_CORE_COLOR = 0x2d3340;
export const TERRAIN_TILE_EXTRA_COLOR = 0x3d5a4a;
export const TERRAIN_TILE_DOOR_COLOR = 0x06b6d4;

const CANVAS_DEFAULT_SPAWN = { x: 0, z: 14 } as const;

/** Matches `Game.ts` wardrobe preview isometric camera offset. */
export const WARDROBE_PREVIEW_CAMERA_OFFSET = 18;

/**
 * Inclusive view-local bounds for the preview patch. Avatar stands at (0, 0)
 * - the O in this grid (camera looks bottom-left → top-right; extra rows behind):
 *
 *     X X X X X   view Z = −3
 *     X X X X X   view Z = −2
 *     X X X X X   view Z = −1
 *     X O X X X   view Z =  0
 *     X X X X X   view Z = +1
 *
 * view X runs −2 … +2 on each row.
 */
export const WARDROBE_PREVIEW_PATCH_X_MIN = -2;
export const WARDROBE_PREVIEW_PATCH_X_MAX = 2;
export const WARDROBE_PREVIEW_PATCH_Z_MIN = -3;
export const WARDROBE_PREVIEW_PATCH_Z_MAX = 1;

export function isInWardrobePreviewPatch(localX: number, localZ: number): boolean {
  return (
    localX >= WARDROBE_PREVIEW_PATCH_X_MIN &&
    localX <= WARDROBE_PREVIEW_PATCH_X_MAX &&
    localZ >= WARDROBE_PREVIEW_PATCH_Z_MIN &&
    localZ <= WARDROBE_PREVIEW_PATCH_Z_MAX
  );
}

/** Snap orbit yaw to the nearest isometric corner (0, π/2, π, 3π/2). */
export function snapWardrobePreviewCameraOrbitYaw(yawRad: number): number {
  const twoPi = Math.PI * 2;
  const step = Math.PI / 2;
  const yn = ((yawRad % twoPi) + twoPi) % twoPi;
  let k = Math.round(yn / step);
  k = ((k % 4) + 4) % 4;
  return k * step;
}

function roundWardrobePreviewPatchTile(n: number): number {
  if (Math.abs(n) < 1e-9) return 0;
  return Math.round(n);
}

/** View-local patch tile → world XZ offset from anchor (integer tiles). */
export function rotateWardrobePreviewViewOffsetToWorld(
  viewX: number,
  viewZ: number,
  cameraOrbitYawRad: number
): { dx: number; dz: number } {
  const cos = Math.cos(cameraOrbitYawRad);
  const sin = Math.sin(cameraOrbitYawRad);
  const wx = viewX * cos + viewZ * sin;
  const wz = -viewX * sin + viewZ * cos;
  return {
    dx: roundWardrobePreviewPatchTile(wx),
    dz: roundWardrobePreviewPatchTile(wz),
  };
}

/** World XZ offset from anchor → view-local patch tile (integer tiles). */
export function rotateWardrobePreviewWorldOffsetToView(
  dx: number,
  dz: number,
  cameraOrbitYawRad: number
): { viewX: number; viewZ: number } {
  const cos = Math.cos(cameraOrbitYawRad);
  const sin = Math.sin(cameraOrbitYawRad);
  const vx = dx * cos - dz * sin;
  const vz = dx * sin + dz * cos;
  return {
    viewX: roundWardrobePreviewPatchTile(vx),
    viewZ: roundWardrobePreviewPatchTile(vz),
  };
}

export type WardrobePreviewBlockCandidate = {
  localX: number;
  localZ: number;
  worldX: number;
  worldZ: number;
  yLevel: number;
  blockKey: string;
};

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

/** 4×4 patch with the anchor tile at view-local (0, 0). */
export function buildWardrobePreviewFloorPatch(
  anchorX: number,
  anchorZ: number,
  floorCtx: WardrobePreviewFloorContext,
  cameraOrbitYawRad = 0
): WardrobePreviewFloorCell[] {
  const cells: WardrobePreviewFloorCell[] = [];
  for (let viewZ = WARDROBE_PREVIEW_PATCH_Z_MIN; viewZ <= WARDROBE_PREVIEW_PATCH_Z_MAX; viewZ++) {
    for (let viewX = WARDROBE_PREVIEW_PATCH_X_MIN; viewX <= WARDROBE_PREVIEW_PATCH_X_MAX; viewX++) {
      const { dx, dz } = rotateWardrobePreviewViewOffsetToWorld(
        viewX,
        viewZ,
        cameraOrbitYawRad
      );
      const worldX = anchorX + dx;
      const worldZ = anchorZ + dz;
      const { walkable, colorRgb } = resolveFloorCellColor(
        worldX,
        worldZ,
        floorCtx
      );
      cells.push({
        localX: viewX,
        localZ: viewZ,
        worldX,
        worldZ,
        walkable,
        colorRgb,
      });
    }
  }
  return cells;
}

export function parsePlacedBlockKey(
  key: string
): { worldX: number; worldZ: number; yLevel: number } | null {
  const parts = key.split(",").map(Number);
  if (parts.length < 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) {
    return null;
  }
  return {
    worldX: parts[0]!,
    worldZ: parts[1]!,
    yLevel: Number.isFinite(parts[2]) ? Math.floor(parts[2]!) : 0,
  };
}

/** Blocks in the 4×4 patch around the anchor tile (every stack level). */
export function collectWardrobePreviewBlocksInPatch(
  anchorX: number,
  anchorZ: number,
  placedKeys: Iterable<string>,
  cameraOrbitYawRad = 0
): WardrobePreviewBlockCandidate[] {
  const blocks: WardrobePreviewBlockCandidate[] = [];
  for (const blockKeyStr of placedKeys) {
    const parsed = parsePlacedBlockKey(blockKeyStr);
    if (!parsed) continue;
    const dx = parsed.worldX - anchorX;
    const dz = parsed.worldZ - anchorZ;
    const { viewX, viewZ } = rotateWardrobePreviewWorldOffsetToView(
      dx,
      dz,
      cameraOrbitYawRad
    );
    if (!isInWardrobePreviewPatch(viewX, viewZ)) continue;
    blocks.push({
      localX: viewX,
      localZ: viewZ,
      worldX: parsed.worldX,
      worldZ: parsed.worldZ,
      yLevel: parsed.yLevel,
      blockKey: blockKeyStr,
    });
  }
  return blocks;
}

/**
 * True when a block sits between the isometric camera and the avatar (or on the
 * avatar tile) and would hide the doll. Uses world XZ offset from the anchor tile.
 */
export function wardrobePreviewBlockOccludesAvatar(opts: {
  worldDx: number;
  worldDz: number;
  cameraOrbitYawRad?: number;
}): boolean {
  if (opts.worldDx === 0 && opts.worldDz === 0) return true;

  const cameraOrbitYawRad = opts.cameraOrbitYawRad ?? 0;
  const cosCam = Math.cos(cameraOrbitYawRad);
  const sinCam = Math.sin(cameraOrbitYawRad);
  const offX = WARDROBE_PREVIEW_CAMERA_OFFSET * (cosCam + sinCam);
  const offZ = WARDROBE_PREVIEW_CAMERA_OFFSET * (-sinCam + cosCam);

  return opts.worldDx * offX + opts.worldDz * offZ > 0.05;
}

export function shouldRenderWardrobePreviewBlock(opts: {
  worldDx: number;
  worldDz: number;
  cameraOrbitYawRad?: number;
}): boolean {
  return !wardrobePreviewBlockOccludesAvatar(opts);
}
