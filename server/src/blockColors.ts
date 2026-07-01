/** Legacy preset indices in persisted world state (migration only). */
const LEGACY_BLOCK_COLOR_PALETTE: readonly number[] = [
  0x5b6b8c,
  0xc94c4c,
  0x4caf50,
  0x2196f3,
  0xffc107,
  0x9c27b0,
  0x795548,
  0x00bcd4,
  0xff9800,
  0xe9b213,
  0xe91e63,
  0x8bc34a,
  0x3f51b5,
  0x009688,
  0x37474f,
  0xfff8e1,
];

export const DEFAULT_BLOCK_COLOR_RGB = 0x5b6b8c;

/** Default top color for player-placed extra floor tiles (matches client `TERRAIN_TILE_EXTRA_COLOR`). */
export const DEFAULT_EXTRA_FLOOR_COLOR_RGB = 0x3d5a4a;
/** Neutral canvas tint (legacy single-color Pixel seed / checker light square). */
export const DEFAULT_PIXEL_CANVAS_COLOR_RGB = 0xd4d4d4;
/** Checkerboard dark square on implicit Pixel floor. */
export const PIXEL_CHECKER_DARK_RGB = 0xbcbcbc;
/** Black hub spawn pad (origin-centered square). */
export const PIXEL_SPAWN_SQUARE_COLOR_RGB = 0x000000;
/** Half-size in tiles: spawn pad is `(2 × half + 1)²` centered on origin. */
export const PIXEL_SPAWN_SQUARE_HALF = 16;
/** @deprecated Legacy central disc color - cleaned up by checkerboard migration. */
export const DEFAULT_PIXEL_CENTRAL_DARK_COLOR_RGB = 0x2a2a2a;
/** @deprecated Legacy central disc radius. */
export const PIXEL_CENTRAL_DARK_RADIUS = 16;

export function isPixelSpawnSquareTile(tileX: number, tileZ: number): boolean {
  return (
    Math.abs(tileX) <= PIXEL_SPAWN_SQUARE_HALF &&
    Math.abs(tileZ) <= PIXEL_SPAWN_SQUARE_HALF
  );
}

/** Implicit Pixel floor tint when no explicit paint is stored for the tile. */
export function pixelImplicitFloorColorRgb(tileX: number, tileZ: number): number {
  if (isPixelSpawnSquareTile(tileX, tileZ)) {
    return PIXEL_SPAWN_SQUARE_COLOR_RGB;
  }
  return (tileX + tileZ) % 2 === 0
    ? DEFAULT_PIXEL_CANVAS_COLOR_RGB
    : PIXEL_CHECKER_DARK_RGB;
}
/** Default gate panel tint (legacy palette index 7). */
export const DEFAULT_GATE_BLOCK_COLOR_RGB = 0x795548;
export const BLOCK_COLOR_MAZE_RGB = 0x9c27b0;
/** Canvas maze exit / teleporter accent (legacy `colorId` 4). */
export const BLOCK_COLOR_EXIT_PORTAL_RGB = 0xffc107;
export const BLOCK_COLOR_SIGNPOST_RGB = 0xff9800;
export const BLOCK_COLOR_BILLBOARD_SLAB_RGB = 0x9c27b0;

export function clampColorRgb(v: number): number {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return DEFAULT_BLOCK_COLOR_RGB;
  return Math.max(0, Math.min(0xffffff, n));
}

export function legacyPaletteRgb(colorId: number): number {
  const id = Math.max(
    0,
    Math.min(LEGACY_BLOCK_COLOR_PALETTE.length - 1, Math.floor(colorId))
  );
  return LEGACY_BLOCK_COLOR_PALETTE[id]!;
}

/** Resolve wire/storage props to a single 0xRRGGBB value. */
export function resolveBlockColorRgb(props: {
  colorRgb?: number;
  colorId?: number;
}): number {
  const raw = props.colorRgb;
  if (raw !== undefined && Number.isFinite(Number(raw))) {
    return clampColorRgb(Number(raw));
  }
  return legacyPaletteRgb(props.colorId ?? 0);
}

export function resolveExtraFloorColorRgb(raw: unknown): number {
  const n = Math.floor(Number(raw));
  if (Number.isFinite(n)) {
    return Math.max(0, Math.min(0xffffff, n));
  }
  return DEFAULT_EXTRA_FLOOR_COLOR_RGB;
}

/**
 * Neutral RGB for Pixel room base tiles on first seed (uniform canvas).
 */
export function pixelSeedColorForTile(tileX: number, tileZ: number): number {
  return pixelImplicitFloorColorRgb(tileX, tileZ);
}
