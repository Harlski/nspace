/** Per-room rectangular base floor — must match `server/src/roomLayouts.ts`. */

export type RoomBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export const HUB_ROOM_ID = "hub";
export const CHAMBER_ROOM_ID = "chamber";
export const CANVAS_ROOM_ID = "canvas";

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

const CANVAS_BOUNDS: RoomBounds = {
  minX: -15,
  maxX: 15,
  minZ: -15,
  maxZ: 15,
};

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
    spawnX: -5,
    spawnZ: 0,
  },
  {
    x: -1,
    z: -12,
    targetRoomId: CANVAS_ROOM_ID,
    spawnX: 0,
    spawnZ: 14,
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

export function normalizeRoomId(roomId: string): string {
  if (roomId === "lobby") return HUB_ROOM_ID;
  return roomId;
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
    default:
      return HUB_BOUNDS;
  }
}

export function getDoorsForRoom(roomId: string): DoorDef[] {
  const id = normalizeRoomId(roomId);
  if (id === HUB_ROOM_ID) return HUB_DOORS;
  if (id === CHAMBER_ROOM_ID) return CHAMBER_DOORS;
  if (id === CANVAS_ROOM_ID) return CANVAS_DOORS;
  return [];
}
