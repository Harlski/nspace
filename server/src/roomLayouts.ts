/** Per-room rectangular base floor (integer tile indices, inclusive). */
import {
  getBuiltinRoomDisplayName,
  getBuiltinRoomIsPublic,
} from "./builtinRoomNames.js";
import {
  createDynamicRoom,
  createOfficialDynamicRoom,
  getDynamicRoomBounds,
  hasDynamicRoom,
  listDeletedDynamicRooms,
  listDynamicRooms,
  loadRoomRegistry,
  type RoomBackgroundNeutral,
} from "./roomRegistry.js";
import { walletDisplayName } from "./walletDisplayName.js";

export type RoomBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export const HUB_ROOM_ID = "hub";
/** Smaller instance space reachable from the hub. */
export const CHAMBER_ROOM_ID = "chamber";
/** Collaborative canvas room where players claim tiles with their identicons. */
export const CANVAS_ROOM_ID = "canvas";

/**
 * Hub center 4×4 tiles (inclusive indices) — no blocks may be placed here.
 * Centered on spawn (0,0): x,z ∈ [-2, 1].
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

/** Default spawn for the chamber (hub east door arrival). All sessions start here. */
export const CHAMBER_DEFAULT_SPAWN = { x: -5, z: 0 } as const;

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
  /** Spawn tile in the destination room when using this door (inclusive base). */
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

/** Hub tile where players land when leaving the maze (also used when maze entry is denied). */
export const HUB_MAZE_EXIT_SPAWN = { x: -1, z: -11 } as const;

const CANVAS_DOORS: DoorDef[] = [
  {
    x: 0,
    z: 15,
    targetRoomId: HUB_ROOM_ID,
    spawnX: HUB_MAZE_EXIT_SPAWN.x,
    spawnZ: HUB_MAZE_EXIT_SPAWN.z,
  },
];

const BUILTIN_ROOM_IDS = new Set([
  HUB_ROOM_ID,
  CHAMBER_ROOM_ID,
  CANVAS_ROOM_ID,
]);
loadRoomRegistry(BUILTIN_ROOM_IDS);

/** Legacy default websocket room id maps to hub. */
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
      return getDynamicRoomBounds(id) ?? HUB_BOUNDS;
  }
}

/** Door tiles (walkable base cells); stepping on them triggers a client transfer. */
export function getDoorsForRoom(roomId: string): DoorDef[] {
  const id = normalizeRoomId(roomId);
  if (id === HUB_ROOM_ID) return HUB_DOORS;
  if (id === CHAMBER_ROOM_ID) return CHAMBER_DOORS;
  if (id === CANVAS_ROOM_ID) return CANVAS_DOORS;
  return [];
}

export function hasRoom(roomId: string): boolean {
  const id = normalizeRoomId(roomId);
  if (BUILTIN_ROOM_IDS.has(id)) return true;
  return hasDynamicRoom(id);
}

/** True for wallet-created rooms (registry), not Hub/Chamber/Canvas. */
export function isPlayerCreatedRoom(roomId: string): boolean {
  return hasDynamicRoom(normalizeRoomId(roomId));
}

export function isBuiltinRoomId(roomId: string): boolean {
  const id = normalizeRoomId(roomId);
  return BUILTIN_ROOM_IDS.has(id);
}

export type RoomDefinition = {
  id: string;
  bounds: RoomBounds;
  ownerAddress: string | null;
  displayName: string;
  isPublic: boolean;
  isBuiltin: boolean;
  /** Admin-created official room (dynamic id); not Hub/Chamber/Canvas. */
  isOfficial?: boolean;
  /** Soft-deleted rooms (admin restore list only). */
  isDeleted?: boolean;
  /** Dynamic rooms only: custom scene background hue, or null for default. */
  backgroundHueDeg?: number | null;
  /** Dynamic rooms only: solid neutral sky; overrides hue when non-null. */
  backgroundNeutral?: RoomBackgroundNeutral | null;
};

export function listDeletedRoomDefinitions(): RoomDefinition[] {
  return listDeletedDynamicRooms().map((r) => ({
    id: r.id,
    bounds: r.bounds,
    ownerAddress: r.ownerAddress,
    displayName: r.displayName,
    isPublic: r.isPublic,
    isBuiltin: false as const,
    isOfficial: r.isOfficial,
    isDeleted: true as const,
    backgroundHueDeg: r.backgroundHueDeg,
    backgroundNeutral: r.backgroundNeutral,
  }));
}

export function listRoomDefinitions(): RoomDefinition[] {
  return [
    {
      id: HUB_ROOM_ID,
      bounds: HUB_BOUNDS,
      ownerAddress: null,
      displayName: getBuiltinRoomDisplayName(HUB_ROOM_ID, "Hub"),
      isPublic: getBuiltinRoomIsPublic(HUB_ROOM_ID),
      isBuiltin: true,
    },
    {
      id: CHAMBER_ROOM_ID,
      bounds: CHAMBER_BOUNDS,
      ownerAddress: null,
      displayName: getBuiltinRoomDisplayName(CHAMBER_ROOM_ID, "Chamber"),
      isPublic: getBuiltinRoomIsPublic(CHAMBER_ROOM_ID),
      isBuiltin: true,
    },
    {
      id: CANVAS_ROOM_ID,
      bounds: CANVAS_BOUNDS,
      ownerAddress: null,
      displayName: getBuiltinRoomDisplayName(CANVAS_ROOM_ID, "Canvas"),
      isPublic: getBuiltinRoomIsPublic(CANVAS_ROOM_ID),
      isBuiltin: true,
    },
    ...listDynamicRooms().map((r) => ({
      id: r.id,
      bounds: r.bounds,
      ownerAddress: r.ownerAddress,
      displayName: r.displayName,
      isPublic: r.isPublic,
      isBuiltin: false as const,
      isOfficial: r.isOfficial,
      backgroundHueDeg: r.backgroundHueDeg,
      backgroundNeutral: r.backgroundNeutral,
    })),
  ];
}

/** Default display name for a new player room, e.g. `NQ12ABCD's room`. */
export function defaultRoomDisplayName(ownerAddress: string): string {
  return `${walletDisplayName(ownerAddress)}'s room`;
}

export function createRoomWithSize(
  widthTiles: number,
  heightTiles: number,
  ownerAddress: string,
  maxOwnedRoomsPerPlayer: number,
  displayName: string,
  isPublic: boolean
): { ok: true; id: string; bounds: RoomBounds } | { ok: false; reason: string } {
  const width = Math.floor(widthTiles);
  const height = Math.floor(heightTiles);
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return { ok: false, reason: "Width/height must be numbers." };
  }
  if (width < 5 || height < 5 || width > 30 || height > 30) {
    return { ok: false, reason: "Width/height must be between 5 and 30 tiles." };
  }
  const halfW = Math.floor(width / 2);
  const halfH = Math.floor(height / 2);
  const bounds: RoomBounds = {
    minX: -halfW,
    maxX: -halfW + width - 1,
    minZ: -halfH,
    maxZ: -halfH + height - 1,
  };
  const created = createDynamicRoom(
    bounds,
    BUILTIN_ROOM_IDS,
    ownerAddress,
    maxOwnedRoomsPerPlayer,
    displayName,
    isPublic
  );
  if (!created.ok) return created;
  const id = created.id;
  return { ok: true, id, bounds };
}

/** Admin-only: same geometry rules as {@link createRoomWithSize}; no per-player cap; marked official. */
export function createOfficialRoomWithSize(
  widthTiles: number,
  heightTiles: number,
  displayName: string,
  isPublic: boolean
): { ok: true; id: string; bounds: RoomBounds } | { ok: false; reason: string } {
  const width = Math.floor(widthTiles);
  const height = Math.floor(heightTiles);
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return { ok: false, reason: "Width/height must be numbers." };
  }
  if (width < 5 || width > 30 || height < 5 || height > 30) {
    return { ok: false, reason: "Width/height must be between 5 and 30 tiles." };
  }
  const halfW = Math.floor(width / 2);
  const halfH = Math.floor(height / 2);
  const bounds: RoomBounds = {
    minX: -halfW,
    maxX: -halfW + width - 1,
    minZ: -halfH,
    maxZ: -halfH + height - 1,
  };
  const created = createOfficialDynamicRoom(
    bounds,
    BUILTIN_ROOM_IDS,
    displayName,
    isPublic
  );
  if (!created.ok) return created;
  return { ok: true, id: created.id, bounds };
}