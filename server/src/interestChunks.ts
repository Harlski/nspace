import type { RoomBounds } from "./roomLayouts.js";

/** Matches client walkable floor visual chunks ([client/src/game/Game.ts](../client/src/game/Game.ts)). */
export const INTEREST_CHUNK_TILES = 32;
/** Rooms at or above this tile count use spatial interest filtering. */
export const INTEREST_ROOM_TILE_THRESHOLD = 10_000;
/** Default half-extent (tiles) before the client reports camera interest. */
export const DEFAULT_INTEREST_HALF_TILES = 64;
/** Matches client `VIEW_INTEREST_PADDING_TILES`. */
const VIEW_INTEREST_PADDING_TILES = 16;
/** Max orthographic frustum for non-admin zoom-out in spatial rooms (client debug HUD `zoom`). */
export const NON_ADMIN_MAX_ZOOM_FRUSTUM = 22.92;
/** Max view-interest half-extent (tiles); aligned with {@link NON_ADMIN_MAX_ZOOM_FRUSTUM}. */
export const NON_ADMIN_MAX_INTEREST_HALF_TILES =
  NON_ADMIN_MAX_ZOOM_FRUSTUM / 2 + VIEW_INTEREST_PADDING_TILES;
/** Extra chunk ring around the reported view rect. */
export const INTEREST_CHUNK_PADDING = 1;

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

export function tileChunkCoord(tile: number): number {
  return Math.floor(tile / INTEREST_CHUNK_TILES);
}

export function tileChunkKey(tx: number, tz: number): string {
  return `${tileChunkCoord(tx)},${tileChunkCoord(tz)}`;
}

export function interestChunksFromRect(
  rect: ViewInterestRect,
  paddingChunks = INTEREST_CHUNK_PADDING
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

export function tileInInterestChunks(
  tx: number,
  tz: number,
  chunks: ReadonlySet<string>
): boolean {
  return chunks.has(tileChunkKey(tx, tz));
}

export function parseTileKeyXZ(k: string): { x: number; z: number } | null {
  const parts = k.split(",");
  const x = Number(parts[0]);
  const z = Number(parts[1]);
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  return { x, z };
}
