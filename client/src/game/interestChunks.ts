import type { RoomBounds } from "./roomLayouts.js";

export const INTEREST_CHUNK_TILES = 32;
export const INTEREST_ROOM_TILE_THRESHOLD = 10_000;
/** Matches server default before the client reports camera interest. */
export const DEFAULT_INTEREST_HALF_TILES = 64;
/** Max half-extent (tiles) for non-admin players in spatial rooms (server-enforced). */
export const NON_ADMIN_MAX_INTEREST_HALF_TILES = 96;
export const VIEW_INTEREST_PADDING_TILES = 16;

export type ViewInterestRect = {
  centerX: number;
  centerZ: number;
  halfW: number;
  halfH: number;
};

export function roomUsesSpatialInterest(bounds: RoomBounds): boolean {
  const w = bounds.maxX - bounds.minX + 1;
  const h = bounds.maxZ - bounds.minZ + 1;
  return w * h >= INTEREST_ROOM_TILE_THRESHOLD;
}

export function walkableFloorVisualChunkKey(wx: number, wz: number): string {
  const c = INTEREST_CHUNK_TILES;
  return `${Math.floor(wx / c)},${Math.floor(wz / c)}`;
}

export function tileChunkKey(tx: number, tz: number): string {
  return walkableFloorVisualChunkKey(tx, tz);
}

export function interestChunksForTileKeys(keys: Iterable<string>): Set<string> {
  const out = new Set<string>();
  for (const k of keys) {
    const parts = k.split(",").map(Number);
    const x = parts[0];
    const z = parts[1];
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    out.add(tileChunkKey(x!, z!));
  }
  return out;
}

export function tileChunkCoord(tile: number): number {
  return Math.floor(tile / INTEREST_CHUNK_TILES);
}

/** Same chunk coverage as server `interestChunksFromRect`. */
export function interestChunksFromRect(
  rect: ViewInterestRect,
  paddingChunks = 1
): Set<string> {
  const minTx = Math.floor(rect.centerX - rect.halfW);
  const maxTx = Math.ceil(rect.centerX + rect.halfW);
  const minTz = Math.floor(rect.centerZ - rect.halfH);
  const maxTz = Math.ceil(rect.centerZ + rect.halfH);
  let minCx = tileChunkCoord(minTx);
  let maxCx = tileChunkCoord(maxTx);
  let minCz = tileChunkCoord(minTz);
  let maxCz = tileChunkCoord(maxTz);
  minCx -= paddingChunks;
  maxCx += paddingChunks;
  minCz -= paddingChunks;
  maxCz += paddingChunks;
  const out = new Set<string>();
  for (let cx = minCx; cx <= maxCx; cx++) {
    for (let cz = minCz; cz <= maxCz; cz++) {
      out.add(`${cx},${cz}`);
    }
  }
  return out;
}
