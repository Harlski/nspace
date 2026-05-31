/** Must match `server/src/blockColors.ts` Pixel implicit floor constants. */

export const PIXEL_CHECKER_LIGHT_RGB = 0xd4d4d4;
export const PIXEL_CHECKER_DARK_RGB = 0xbcbcbc;
export const PIXEL_SPAWN_SQUARE_COLOR_RGB = 0x000000;
export const PIXEL_SPAWN_SQUARE_HALF = 16;

export function isPixelSpawnSquareTile(tileX: number, tileZ: number): boolean {
  return (
    Math.abs(tileX) <= PIXEL_SPAWN_SQUARE_HALF &&
    Math.abs(tileZ) <= PIXEL_SPAWN_SQUARE_HALF
  );
}

export function pixelImplicitFloorColorRgb(tileX: number, tileZ: number): number {
  if (isPixelSpawnSquareTile(tileX, tileZ)) {
    return PIXEL_SPAWN_SQUARE_COLOR_RGB;
  }
  return (tileX + tileZ) % 2 === 0
    ? PIXEL_CHECKER_LIGHT_RGB
    : PIXEL_CHECKER_DARK_RGB;
}
