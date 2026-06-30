import { normalizeRoomId, PIXEL_ROOM_ID } from "./roomLayouts.js";

export const FLOOR_RECOLOR_SEEN_PREFIX = "recolor:";
export const RAINBOW_HUE_SEEN_PREFIX = "rainbow-hue:";
export const RAINBOW_FLOOR_HUE_THRESHOLD = 12;
export const SHAPE_SEEN_PREFIX = "shape:";
export const SIGNPOST_READ_SEEN_PREFIX = "signpost-read:";
export const PREFAB_ADOPTION_SEEN_PREFIX = "prefab-adoption:";
export const ROOM_DELUXE_LIFETIME_DAY = "_lifetime_";
export const ROOM_DELUXE_STATE_PREFIX = "room_deluxe:";

export const ROOM_DELUXE_BLOCK_THRESHOLD = 25;
export const ROOM_DELUXE_RECOLOR_THRESHOLD = 5;
export const ROOM_DELUXE_REQUIREMENT_COUNT = 4;

export type TerrainShapeKind = "cube" | "hex" | "pyramid" | "sphere" | "ramp";

export type RoomDeluxeProgress = {
  created: boolean;
  blocks: number;
  spawn: boolean;
  recolors: number;
};

export function terrainShapeKindFromPrism(parts: {
  hex: boolean;
  pyramid: boolean;
  sphere: boolean;
  ramp: boolean;
}): TerrainShapeKind {
  if (parts.ramp) return "ramp";
  if (parts.sphere) return "sphere";
  if (parts.pyramid) return "pyramid";
  if (parts.hex) return "hex";
  return "cube";
}

export function shapeSeenKey(kind: TerrainShapeKind): string {
  return `${SHAPE_SEEN_PREFIX}${kind}`;
}

/** Palette Painter excludes the Pixel room floor board. */
export function isPalettePainterEligibleRoom(roomId: string): boolean {
  return normalizeRoomId(roomId).trim().toLowerCase() !== PIXEL_ROOM_ID;
}

export function floorRecolorSeenKey(
  roomId: string,
  x: number,
  z: number
): string {
  return `${FLOOR_RECOLOR_SEEN_PREFIX}${normalizeRoomId(roomId).trim().toLowerCase()}:${Math.trunc(x)},${Math.trunc(z)}`;
}

/** Map RGB to one of 12 hue buckets (30° each). Returns -1 for near-neutral colors. */
export function hueBucketFromColorRgb(colorRgb: number): number {
  const r = (colorRgb >> 16) & 0xff;
  const g = (colorRgb >> 8) & 0xff;
  const b = colorRgb & 0xff;
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  if (max - min < 0.08) return -1;
  let h = 0;
  const d = max - min;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
  else if (max === gn) h = ((bn - rn) / d + 2) * 60;
  else h = ((rn - gn) / d + 4) * 60;
  const deg = ((h % 360) + 360) % 360;
  return Math.min(11, Math.floor(deg / 30));
}

export function rainbowHueSeenKey(roomId: string, hueBucket: number): string {
  return `${RAINBOW_HUE_SEEN_PREFIX}${normalizeRoomId(roomId).trim().toLowerCase()}:${hueBucket}`;
}

export function signpostReadSeenKey(signboardId: string): string {
  return `${SIGNPOST_READ_SEEN_PREFIX}${String(signboardId ?? "").trim()}`;
}

export function prefabAdoptionSeenKey(designId: string): string {
  return `${PREFAB_ADOPTION_SEEN_PREFIX}${String(designId ?? "").trim()}`;
}

export function roomDeluxeStateKey(roomId: string): string {
  return `${ROOM_DELUXE_STATE_PREFIX}${normalizeRoomId(roomId).trim().toLowerCase()}`;
}

export function parseRoomDeluxeProgress(
  value: string | null | undefined
): RoomDeluxeProgress {
  if (!value) {
    return { created: false, blocks: 0, spawn: false, recolors: 0 };
  }
  try {
    const o = JSON.parse(value) as Partial<RoomDeluxeProgress>;
    return {
      created: Boolean(o.created),
      blocks: Math.max(0, Math.floor(Number(o.blocks ?? 0))),
      spawn: Boolean(o.spawn),
      recolors: Math.max(0, Math.floor(Number(o.recolors ?? 0))),
    };
  } catch {
    return { created: false, blocks: 0, spawn: false, recolors: 0 };
  }
}

export function formatRoomDeluxeProgress(progress: RoomDeluxeProgress): string {
  return JSON.stringify(progress);
}

export function roomDeluxeMetRequirements(progress: RoomDeluxeProgress): number {
  let count = 0;
  if (progress.created) count += 1;
  if (progress.blocks >= ROOM_DELUXE_BLOCK_THRESHOLD) count += 1;
  if (progress.spawn) count += 1;
  if (progress.recolors >= ROOM_DELUXE_RECOLOR_THRESHOLD) count += 1;
  return count;
}

export function isRoomDeluxeComplete(progress: RoomDeluxeProgress): boolean {
  return roomDeluxeMetRequirements(progress) >= ROOM_DELUXE_REQUIREMENT_COUNT;
}

export function countRainbowHuesForRoom(
  seenKeys: ReadonlyArray<string>,
  roomId: string
): number {
  const prefix = `${RAINBOW_HUE_SEEN_PREFIX}${normalizeRoomId(roomId).trim().toLowerCase()}:`;
  let count = 0;
  for (const key of seenKeys) {
    if (key.startsWith(prefix)) count += 1;
  }
  return count;
}
