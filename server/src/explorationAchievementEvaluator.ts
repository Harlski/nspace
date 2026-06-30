import { isCosmeticGalleryRoom } from "./cosmeticGallery.js";
import {
  CANVAS_ROOM_ID,
  CHAMBER_ROOM_ID,
  getDoorsForRoom,
  HUB_ROOM_ID,
  normalizeRoomId,
  PIXEL_ROOM_ID,
  type RoomBounds,
} from "./roomLayouts.js";
import { INVITE_LOBBY_PREFIX } from "./directInvite/config.js";
import {
  FIELD_BOUNDS,
  FIELD_OUTFIELD_MARGIN,
  FIELD_ROOM_ID,
  isMatchPitchRoomId,
} from "./worldcup/config.js";

/** Marathon Option A — grid-pathfinding rooms only; excludes field-like and maze rooms. */
export function isMarathonTileEligibleRoom(roomId: string): boolean {
  const id = normalizeRoomId(roomId).trim().toLowerCase();
  if (id === CANVAS_ROOM_ID) return false;
  if (isCosmeticGalleryRoom(id)) return false;
  if (id === FIELD_ROOM_ID) return false;
  if (isMatchPitchRoomId(id)) return false;
  return true;
}

export function marathonTileSeenKey(
  roomId: string,
  x: number,
  z: number
): string {
  return `tile:${normalizeRoomId(roomId).trim().toLowerCase()}:${Math.trunc(x)},${Math.trunc(z)}`;
}

export const MARATHON_TILE_SEEN_PREFIX = "tile:";

export const EXPLORATION_ROOM_SEEN_PREFIX = "room:";
export const EXPLORATION_DOOR_SEEN_PREFIX = "door:";
export const TELEPORTER_DEST_SEEN_PREFIX = "teleporter-dest:";
export const OUTFIELD_TILE_SEEN_PREFIX = "outfield:";

export const GRAND_TOUR_DAILY_STATE_KEY = "grand_tour";

/** Canonical room keys required for Grand Tour (one UTC calendar day). */
export const GRAND_TOUR_REQUIRED_KEYS = [
  CHAMBER_ROOM_ID,
  HUB_ROOM_ID,
  PIXEL_ROOM_ID,
  FIELD_ROOM_ID,
  "cosmetic-gallery",
] as const;

const BUILTIN_DOOR_SOURCE_ROOMS = [
  HUB_ROOM_ID,
  CHAMBER_ROOM_ID,
  CANVAS_ROOM_ID,
  PIXEL_ROOM_ID,
  FIELD_ROOM_ID,
] as const;

/**
 * Distinct-tile credit for one movement tick.
 * At most one new tile per path step; total credits never exceed path length.
 */
export function computeDistinctTileCredits(
  roomId: string,
  pathTiles: ReadonlyArray<{ x: number; z: number }>,
  isAlreadySeen: (seenKey: string) => boolean
): string[] {
  if (!isMarathonTileEligibleRoom(roomId)) return [];
  const credits: string[] = [];
  const creditedThisPath = new Set<string>();
  for (const tile of pathTiles) {
    const key = marathonTileSeenKey(roomId, tile.x, tile.z);
    if (creditedThisPath.has(key) || isAlreadySeen(key)) continue;
    credits.push(key);
    creditedThisPath.add(key);
  }
  return credits.slice(0, pathTiles.length);
}

/** Room identity for Room Tourist and Grand Tour (Play Space slug once per slug). */
export function explorationRoomCanonicalKey(roomId: string): string {
  const id = normalizeRoomId(roomId).trim().toLowerCase();
  if (id.startsWith(INVITE_LOBBY_PREFIX)) {
    return id.slice(INVITE_LOBBY_PREFIX.length);
  }
  return id;
}

export function explorationRoomSeenKey(roomId: string): string {
  return `${EXPLORATION_ROOM_SEEN_PREFIX}${explorationRoomCanonicalKey(roomId)}`;
}

/** Returns the Grand Tour key when `roomId` is one of the five canonical stops. */
export function grandTourKeyForRoom(roomId: string): string | null {
  const key = explorationRoomCanonicalKey(roomId);
  return (GRAND_TOUR_REQUIRED_KEYS as readonly string[]).includes(key)
    ? key
    : null;
}

export function parseGrandTourVisitedKeys(value: string | null | undefined): Set<string> {
  const out = new Set<string>();
  if (!value) return out;
  for (const part of value.split(",")) {
    const key = part.trim().toLowerCase();
    if (key) out.add(key);
  }
  return out;
}

export function formatGrandTourVisitedKeys(keys: ReadonlySet<string>): string {
  return [...keys].sort().join(",");
}

export function countGrandTourProgress(visited: ReadonlySet<string>): number {
  let count = 0;
  for (const key of GRAND_TOUR_REQUIRED_KEYS) {
    if (visited.has(key)) count += 1;
  }
  return count;
}

export function isGrandTourComplete(visited: ReadonlySet<string>): boolean {
  return countGrandTourProgress(visited) >= GRAND_TOUR_REQUIRED_KEYS.length;
}

export function builtinDoorSeenKey(
  fromRoomId: string,
  doorX: number,
  doorZ: number,
  toRoomId: string
): string {
  const from = normalizeRoomId(fromRoomId).trim().toLowerCase();
  const to = normalizeRoomId(toRoomId).trim().toLowerCase();
  return `${EXPLORATION_DOOR_SEEN_PREFIX}${from}:${Math.trunc(doorX)},${Math.trunc(doorZ)}→${to}`;
}

export function teleporterPortalDoorSeenKey(
  fromRoomId: string,
  fromX: number,
  fromZ: number,
  toRoomId: string
): string {
  const from = normalizeRoomId(fromRoomId).trim().toLowerCase();
  const to = normalizeRoomId(toRoomId).trim().toLowerCase();
  return `${EXPLORATION_DOOR_SEEN_PREFIX}tp:${from}:${Math.trunc(fromX)},${Math.trunc(fromZ)}→${to}`;
}

export function teleporterDestinationSeenKey(toRoomId: string): string {
  return `${TELEPORTER_DEST_SEEN_PREFIX}${normalizeRoomId(toRoomId).trim().toLowerCase()}`;
}

export function outfieldTileSeenKey(
  roomId: string,
  x: number,
  z: number
): string {
  return `${OUTFIELD_TILE_SEEN_PREFIX}${normalizeRoomId(roomId).trim().toLowerCase()}:${Math.trunc(x)},${Math.trunc(z)}`;
}

/**
 * True when the tile lies in the outfield margin band: outside the pitch rectangle but
 * within walk bounds widened by `margin` world units (Free Play Field only).
 */
export function isOutfieldMarginTile(
  x: number,
  z: number,
  pitchBounds: RoomBounds,
  margin: number,
  walkBounds: RoomBounds = pitchBounds
): boolean {
  const tx = Math.trunc(x);
  const tz = Math.trunc(z);
  const onPitch =
    tx >= pitchBounds.minX &&
    tx <= pitchBounds.maxX &&
    tz >= pitchBounds.minZ &&
    tz <= pitchBounds.maxZ;
  if (onPitch) return false;
  if (margin <= 0) return false;
  const m = margin;
  return (
    tx >= walkBounds.minX - m &&
    tx <= walkBounds.maxX + m &&
    tz >= walkBounds.minZ - m &&
    tz <= walkBounds.maxZ + m
  );
}

/** Reverse-lookup a built-in door from the destination spawn tile (door confirm reconnect). */
export function resolveBuiltinDoorSeenKeyFromSpawn(
  targetRoomId: string,
  spawnX: number,
  spawnZ: number
): string | null {
  const dest = normalizeRoomId(targetRoomId).trim().toLowerCase();
  const sx = Math.trunc(spawnX);
  const sz = Math.trunc(spawnZ);
  for (const fromRoom of BUILTIN_DOOR_SOURCE_ROOMS) {
    for (const door of getDoorsForRoom(fromRoom)) {
      const doorDest = normalizeRoomId(door.targetRoomId).trim().toLowerCase();
      if (doorDest !== dest) continue;
      if (door.spawnX !== sx || door.spawnZ !== sz) continue;
      return builtinDoorSeenKey(fromRoom, door.x, door.z, doorDest);
    }
  }
  return null;
}

export function computeOutfieldTileCredits(
  roomId: string,
  pathTiles: ReadonlyArray<{ x: number; z: number }>,
  isAlreadySeen: (seenKey: string) => boolean,
  opts?: {
    pitchBounds?: RoomBounds;
    margin?: number;
    walkBounds?: RoomBounds;
  }
): string[] {
  const id = normalizeRoomId(roomId).trim().toLowerCase();
  if (id !== FIELD_ROOM_ID) return [];
  const pitchBounds = opts?.pitchBounds ?? FIELD_BOUNDS;
  const margin = opts?.margin ?? FIELD_OUTFIELD_MARGIN;
  const walkBounds = opts?.walkBounds ?? pitchBounds;
  const credits: string[] = [];
  const creditedThisPath = new Set<string>();
  for (const tile of pathTiles) {
    if (
      !isOutfieldMarginTile(
        tile.x,
        tile.z,
        pitchBounds,
        margin,
        walkBounds
      )
    ) {
      continue;
    }
    const key = outfieldTileSeenKey(roomId, tile.x, tile.z);
    if (creditedThisPath.has(key) || isAlreadySeen(key)) continue;
    credits.push(key);
    creditedThisPath.add(key);
  }
  return credits.slice(0, pathTiles.length);
}
