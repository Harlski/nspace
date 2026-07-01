import { getRoomBaseBounds, PIXEL_ROOM_ID } from "./roomLayouts.js";

/** Lifetime dedupe keys for Pixel corner regions (`pixel-corner:nw`, …). */
export const PIXEL_CORNER_SEEN_PREFIX = "pixel-corner:";

/** Default corner band width - matches default `PLACE_RADIUS_BLOCKS`. */
export const PIXEL_CORNER_BAND_TILES = 9;

export const BILLBOARD_AUDIENCE_PROXIMITY_BLOCKS = 7;
export const BILLBOARD_AUDIENCE_DWELL_THRESHOLD_MS = 60_000;

export const MONOCHROME_DISCIPLINE_THRESHOLD = 64;

export type PixelCornerId = "nw" | "ne" | "sw" | "se";

const PIXEL_BOUNDS = getRoomBaseBounds(PIXEL_ROOM_ID);

export function pixelCornerIdForTile(
  x: number,
  z: number,
  bandTiles: number = PIXEL_CORNER_BAND_TILES,
  bounds = PIXEL_BOUNDS
): PixelCornerId | null {
  const tx = Math.trunc(x);
  const tz = Math.trunc(z);
  const inNorth = tz <= bounds.minZ + bandTiles - 1;
  const inSouth = tz >= bounds.maxZ - bandTiles + 1;
  const inWest = tx <= bounds.minX + bandTiles - 1;
  const inEast = tx >= bounds.maxX - bandTiles + 1;
  if (inNorth && inWest) return "nw";
  if (inNorth && inEast) return "ne";
  if (inSouth && inWest) return "sw";
  if (inSouth && inEast) return "se";
  return null;
}

export function pixelCornerSeenKey(cornerId: PixelCornerId): string {
  return `${PIXEL_CORNER_SEEN_PREFIX}${cornerId}`;
}

/** Chebyshev distance from a player tile to a billboard footprint tile. */
export function chebyshevTileDistance(
  px: number,
  pz: number,
  tx: number,
  tz: number
): number {
  return Math.max(Math.abs(Math.trunc(px) - Math.trunc(tx)), Math.abs(Math.trunc(pz) - Math.trunc(tz)));
}

export function isWithinBillboardProximity(
  px: number,
  pz: number,
  footprintTiles: ReadonlyArray<{ x: number; z: number }>,
  maxBlocks: number = BILLBOARD_AUDIENCE_PROXIMITY_BLOCKS
): boolean {
  for (const tile of footprintTiles) {
    if (chebyshevTileDistance(px, pz, tile.x, tile.z) <= maxBlocks) {
      return true;
    }
  }
  return false;
}

export function monochromeHueKey(colorRgb: number): string {
  const rgb = Math.trunc(colorRgb) & 0xffffff;
  return rgb.toString(16).padStart(6, "0");
}

export function parseMonochromeHueKey(
  value: string | null | undefined
): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value.trim(), 16);
  if (!Number.isFinite(parsed)) return null;
  return parsed & 0xffffff;
}

/** Orthogonal neighbours whose tile keys exist in `tilePainters`. */
export function adjacentPaintedTileKeys(x: number, z: number): string[] {
  const tx = Math.trunc(x);
  const tz = Math.trunc(z);
  return [
    `${tx + 1},${tz}`,
    `${tx - 1},${tz}`,
    `${tx},${tz + 1}`,
    `${tx},${tz - 1}`,
  ];
}

export function isPixelCollaboratorPaint(
  painterWallet: string,
  x: number,
  z: number,
  tilePainters: ReadonlyMap<string, string>,
  otherPresentWallets: ReadonlySet<string>
): boolean {
  const painter = painterWallet.replace(/\s+/g, "").toUpperCase();
  if (!painter || otherPresentWallets.size === 0) return false;
  for (const key of adjacentPaintedTileKeys(x, z)) {
    const author = tilePainters.get(key);
    if (!author) continue;
    if (author === painter) continue;
    if (otherPresentWallets.has(author)) return true;
  }
  return false;
}
