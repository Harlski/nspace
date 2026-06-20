/** Per-room rectangular base floor — must match `server/src/roomLayouts.ts`. */
// worldcup: seasonal soccer field room (feature-flagged, deletable)
import {
  WORLDCUP_ENABLED as WORLDCUP_ENABLED_CLIENT,
  FIELD_ROOM_ID as WORLDCUP_FIELD_ROOM_ID,
  FIELD_BOUNDS as WORLDCUP_FIELD_BOUNDS,
  HUB_FIELD_DOOR as WORLDCUP_HUB_FIELD_DOOR,
  FIELD_HUB_DOOR as WORLDCUP_FIELD_HUB_DOOR,
} from "../worldcup/config.js";

export type RoomBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export const HUB_ROOM_ID = "hub";
export const CHAMBER_ROOM_ID = "chamber";
export const CANVAS_ROOM_ID = "canvas";
export const PIXEL_ROOM_ID = "pixel";

/**
 * Hub center 4×4 tiles (inclusive) — no blocks (must match server `roomLayouts`).
 */
export function isHubSpawnSafeZone(x: number, z: number): boolean {
  return x >= -2 && x <= 1 && z >= -2 && z <= 1;
}

const HUB_BOUNDS: RoomBounds = {
  minX: -12,
  maxX: 12,
  minZ: -12,
  maxZ: 12,
};

const CHAMBER_BOUNDS: RoomBounds = {
  minX: -6,
  maxX: 6,
  minZ: -6,
  maxZ: 6,
};

/** Max orthographic half-height when zoomed out in the chamber (world units). */
export const CHAMBER_MAX_ZOOM_FRUSTUM = 18.9;

/** Must match server `CHAMBER_DEFAULT_SPAWN` — session start / re-login arrival tile. */
export const CHAMBER_DEFAULT_SPAWN = { x: -5, z: 0 } as const;

const CANVAS_BOUNDS: RoomBounds = {
  minX: -15,
  maxX: 15,
  minZ: -15,
  maxZ: 15,
};

/** 500×500 floor canvas — full global grid (−250…249); stream pans across regions at partial zoom. */
const PIXEL_BOUNDS: RoomBounds = {
  minX: -250,
  maxX: 249,
  minZ: -250,
  maxZ: 249,
};

/** Hub return teleporter tile in Pixel; players spawn one tile toward +Z (in front of it). */
export const PIXEL_HUB_TELEPORTER = { x: 0, z: -12 } as const;
export const PIXEL_DEFAULT_SPAWN = { x: 0, z: -11 } as const;

export type DoorDef = {
  x: number;
  z: number;
  targetRoomId: string;
  spawnX: number;
  spawnZ: number;
};

const HUB_DOORS: DoorDef[] = [
  {
    x: 12,
    z: 0,
    targetRoomId: CHAMBER_ROOM_ID,
    spawnX: CHAMBER_DEFAULT_SPAWN.x,
    spawnZ: CHAMBER_DEFAULT_SPAWN.z,
  },
  {
    x: -1,
    z: -12,
    targetRoomId: CANVAS_ROOM_ID,
    spawnX: 0,
    spawnZ: 14,
  },
  {
    x: 0,
    z: 12,
    targetRoomId: PIXEL_ROOM_ID,
    spawnX: PIXEL_DEFAULT_SPAWN.x,
    spawnZ: PIXEL_DEFAULT_SPAWN.z,
  },
];

const CHAMBER_DOORS: DoorDef[] = [
  {
    x: -6,
    z: 0,
    targetRoomId: HUB_ROOM_ID,
    spawnX: 11,
    spawnZ: 0,
  },
];

const CANVAS_DOORS: DoorDef[] = [
  {
    x: 0,
    z: 15,
    targetRoomId: HUB_ROOM_ID,
    spawnX: -1,
    spawnZ: -11,
  },
];

const PIXEL_DOORS: DoorDef[] = [
  {
    x: PIXEL_HUB_TELEPORTER.x,
    z: PIXEL_HUB_TELEPORTER.z,
    targetRoomId: HUB_ROOM_ID,
    spawnX: 0,
    spawnZ: 11,
  },
];

export function normalizeRoomId(roomId: string): string {
  if (roomId === "lobby") return HUB_ROOM_ID;
  return roomId;
}

const clientRoomBoundsById = new Map<string, RoomBounds>();

/** Set from server `welcome.roomBounds` for non-built-in rooms (custom codes). */
export function registerClientRoomBounds(roomId: string, bounds: RoomBounds): void {
  clientRoomBoundsById.set(normalizeRoomId(roomId), { ...bounds });
}

export function isBuiltinRoomId(roomId: string): boolean {
  const id = normalizeRoomId(roomId);
  if (WORLDCUP_ENABLED_CLIENT && id === WORLDCUP_FIELD_ROOM_ID) return true;
  return id === HUB_ROOM_ID || id === CHAMBER_ROOM_ID || id === CANVAS_ROOM_ID || id === PIXEL_ROOM_ID;
}

export function getRoomBaseBounds(roomId: string): RoomBounds {
  const id = normalizeRoomId(roomId);
  switch (id) {
    case HUB_ROOM_ID:
      return HUB_BOUNDS;
    case CHAMBER_ROOM_ID:
      return CHAMBER_BOUNDS;
    case CANVAS_ROOM_ID:
      return CANVAS_BOUNDS;
    case PIXEL_ROOM_ID:
      return PIXEL_BOUNDS;
    default: {
      // worldcup: field room bounds when enabled
      if (WORLDCUP_ENABLED_CLIENT && id === WORLDCUP_FIELD_ROOM_ID) {
        return { ...WORLDCUP_FIELD_BOUNDS };
      }
      const b = clientRoomBoundsById.get(id);
      return b ? { ...b } : HUB_BOUNDS;
    }
  }
}

export function getDoorsForRoom(roomId: string): DoorDef[] {
  const id = normalizeRoomId(roomId);
  if (id === HUB_ROOM_ID) {
    // worldcup: add the field door to the hub when enabled
    return WORLDCUP_ENABLED_CLIENT
      ? [...HUB_DOORS, { ...WORLDCUP_HUB_FIELD_DOOR }]
      : HUB_DOORS;
  }
  if (id === CHAMBER_ROOM_ID) return CHAMBER_DOORS;
  if (id === CANVAS_ROOM_ID) return CANVAS_DOORS;
  if (id === PIXEL_ROOM_ID) return PIXEL_DOORS;
  // worldcup: field room door back to the hub
  if (WORLDCUP_ENABLED_CLIENT && id === WORLDCUP_FIELD_ROOM_ID) {
    return [{ ...WORLDCUP_FIELD_HUB_DOOR }];
  }
  return [];
}
