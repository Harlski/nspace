import { PNG } from "pngjs";
import { pixelImplicitFloorColorRgb } from "./blockColors.js";
import { PIXEL_ROOM_ID, getRoomBaseBounds } from "./roomLayouts.js";

type ColorSource = () => ReadonlyMap<string, number>;

/** PNG pixels per world tile (2 = 1000×1000 image for a 500×500 board). */
export const PIXEL_BOARD_PNG_SCALE = 2;

const bounds = getRoomBaseBounds(PIXEL_ROOM_ID);
const TILES_X = bounds.maxX - bounds.minX + 1;
const TILES_Z = bounds.maxZ - bounds.minZ + 1;
const WIDTH = TILES_X * PIXEL_BOARD_PNG_SCALE;
const HEIGHT = TILES_Z * PIXEL_BOARD_PNG_SCALE;

let colorSource: ColorSource = () => new Map();
let cachedPng: Buffer | null = null;
let cacheVersion = -1;
let boardVersion = 0;

export function setPixelBoardColorSource(source: ColorSource): void {
  colorSource = source;
}

export function invalidatePixelBoardPngCache(): void {
  boardVersion++;
  cachedPng = null;
}

function setPixelRgba(data: Buffer, px: number, py: number, colorRgb: number): void {
  const i = (py * WIDTH + px) * 4;
  data[i] = (colorRgb >> 16) & 0xff;
  data[i + 1] = (colorRgb >> 8) & 0xff;
  data[i + 2] = colorRgb & 0xff;
  data[i + 3] = 255;
}

function fillTileBlock(
  data: Buffer,
  tilePx: number,
  tilePz: number,
  colorRgb: number
): void {
  const s = PIXEL_BOARD_PNG_SCALE;
  const baseX = tilePx * s;
  const baseZ = tilePz * s;
  for (let dz = 0; dz < s; dz++) {
    for (let dx = 0; dx < s; dx++) {
      setPixelRgba(data, baseX + dx, baseZ + dz, colorRgb);
    }
  }
}

function renderPixelBoardPng(): Buffer {
  const png = new PNG({ width: WIDTH, height: HEIGHT });
  const painted = colorSource();
  for (let z = bounds.minZ; z <= bounds.maxZ; z++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const colorRgb =
        painted.get(`${x},${z}`) ?? pixelImplicitFloorColorRgb(x, z);
      fillTileBlock(png.data, x - bounds.minX, z - bounds.minZ, colorRgb);
    }
  }
  return PNG.sync.write(png);
}

export function getPixelBoardPngCached(): { body: Buffer; etag: string } {
  if (cachedPng && cacheVersion === boardVersion) {
    return { body: cachedPng, etag: `"${boardVersion}"` };
  }
  cachedPng = renderPixelBoardPng();
  cacheVersion = boardVersion;
  return { body: cachedPng, etag: `"${boardVersion}"` };
}

export function getPixelBoardPngDimensions(): { width: number; height: number } {
  return { width: WIDTH, height: HEIGHT };
}
