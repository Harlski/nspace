import { PNG } from "pngjs";
import type { RoomBounds } from "./roomLayouts.js";

/** Largest thumbnail dimension in pixels (keeps admin card images light). */
const MAX_THUMB_PX = 256;
/** Background for tiles outside the room / carved-out base (matches dark sky). */
const THUMB_BG_RGB = 0x0f1622;

export type RoomThumbnailInput = {
  bounds: RoomBounds;
  /** Floor color (0xRRGGBB) for a tile, or null when there is no floor there. */
  colorAt: (x: number, z: number) => number | null;
  /** Placed objects; highest stack level wins for the top-down color. */
  obstacles?: ReadonlyArray<{ x: number; z: number; y: number; colorRgb: number }>;
};

function setRgba(data: Buffer, idx: number, rgb: number, alpha: number): void {
  data[idx] = (rgb >> 16) & 0xff;
  data[idx + 1] = (rgb >> 8) & 0xff;
  data[idx + 2] = rgb & 0xff;
  data[idx + 3] = alpha;
}

/**
 * Render a small top-down PNG of a room's floor with placed objects overlaid.
 * Generic version of the Pixel board rasterizer; works for any room bounds.
 */
export function renderRoomThumbnailPng(input: RoomThumbnailInput): Buffer {
  const { bounds, colorAt } = input;
  const tilesX = Math.max(1, bounds.maxX - bounds.minX + 1);
  const tilesZ = Math.max(1, bounds.maxZ - bounds.minZ + 1);
  const scale = Math.max(1, Math.floor(MAX_THUMB_PX / Math.max(tilesX, tilesZ)));
  const width = tilesX * scale;
  const height = tilesZ * scale;

  const png = new PNG({ width, height });

  // Highest obstacle per tile wins for the top-down color overlay.
  const topObstacle = new Map<string, { y: number; colorRgb: number }>();
  for (const o of input.obstacles ?? []) {
    const key = `${o.x},${o.z}`;
    const prev = topObstacle.get(key);
    if (!prev || o.y >= prev.y) {
      topObstacle.set(key, { y: o.y, colorRgb: o.colorRgb });
    }
  }

  for (let tz = 0; tz < tilesZ; tz++) {
    const worldZ = bounds.minZ + tz;
    for (let tx = 0; tx < tilesX; tx++) {
      const worldX = bounds.minX + tx;
      const floor = colorAt(worldX, worldZ);
      const obstacle = topObstacle.get(`${worldX},${worldZ}`);
      let rgb: number;
      let alpha = 255;
      if (obstacle) {
        rgb = obstacle.colorRgb;
      } else if (floor !== null) {
        rgb = floor;
      } else {
        rgb = THUMB_BG_RGB;
        alpha = 0;
      }
      const baseX = tx * scale;
      const baseZ = tz * scale;
      for (let dz = 0; dz < scale; dz++) {
        const rowStart = ((baseZ + dz) * width + baseX) * 4;
        for (let dx = 0; dx < scale; dx++) {
          setRgba(png.data, rowStart + dx * 4, rgb, alpha);
        }
      }
    }
  }

  return PNG.sync.write(png);
}
