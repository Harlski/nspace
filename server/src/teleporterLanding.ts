import type { RoomBounds } from "./roomLayouts.js";
import type { TerrainProps } from "./grid.js";
import { snapToTile } from "./grid.js";

export type TeleporterLandingContext = {
  normalizeRoomId: (roomId: string) => string;
  hubRoomId: string;
  getRoomBounds: (roomId: string) => RoomBounds;
  isWalkableForRoom: (roomId: string, x: number, z: number) => boolean;
  floorWalkableAt: (roomId: string, x: number, z: number) => boolean;
  resolveDefaultSpawnForPlayerRoom: (
    roomId: string
  ) => { x: number; z: number } | null;
};

/** In-bounds walkable floor tile suitable as a stored Landing Hint at configure time. */
export function isValidTeleporterLandingHint(
  roomId: string,
  x: number,
  z: number,
  ctx: Pick<
    TeleporterLandingContext,
    "getRoomBounds" | "isWalkableForRoom"
  >
): boolean {
  const b = ctx.getRoomBounds(roomId);
  if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) return false;
  return ctx.isWalkableForRoom(roomId, x, z);
}

/** Legal feet landing at warp time (walkable floor layer, passable floor obstacles OK). */
export function isLegalTeleporterLanding(
  roomId: string,
  x: number,
  z: number,
  ctx: Pick<TeleporterLandingContext, "floorWalkableAt">
): boolean {
  return ctx.floorWalkableAt(roomId, x, z);
}

/**
 * Resolve warp landing: Hub fixed spawn; else hint if legal; else owner Join Spawn chain
 * (via resolveDefaultSpawnForPlayerRoom) then room center. Does not use per-player saved spawn.
 */
export function resolveTeleporterLanding(
  targetRoomId: string,
  hintX: number,
  hintZ: number,
  ctx: TeleporterLandingContext
): { x: number; z: number } {
  const n = ctx.normalizeRoomId(targetRoomId);
  if (n === ctx.hubRoomId) {
    return { x: 0, z: 0 };
  }
  if (Number.isFinite(hintX) && Number.isFinite(hintZ)) {
    const t = snapToTile(hintX, hintZ);
    if (isLegalTeleporterLanding(n, t.x, t.z, ctx)) {
      return { x: t.x, z: t.z };
    }
  }
  const def = ctx.resolveDefaultSpawnForPlayerRoom(n);
  if (def) return def;
  const b = ctx.getRoomBounds(n);
  const c = snapToTile(
    Math.floor((b.minX + b.maxX) / 2),
    Math.floor((b.minZ + b.maxZ) / 2)
  );
  return { x: c.x, z: c.z };
}

/** Parse `blockKey` / legacy tile key into coordinates. */
export function parsePlacedKey(key: string): { x: number; z: number; y: number } | null {
  const parts = key.split(",").map(Number);
  const x = parts[0];
  const z = parts[1];
  const yRaw = parts[2];
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  const y = Number.isFinite(yRaw) ? Math.max(0, Math.min(2, Math.floor(yRaw))) : 0;
  return { x, z, y };
}

export type PlacedPropsWithTeleporter = TerrainProps & {
  teleporter?: NonNullable<TerrainProps["teleporter"]>;
};
