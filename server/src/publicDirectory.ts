/**
 * Public Directory: one hallway of teleporters to every public player room.
 * Slot tiles are whatever an admin has placed or moved (saved with the room).
 * Popularity only chooses which public room a slot opens: closer to the door
 * is hotter. New rooms grow the default row-of-three grid when no slot is free.
 */

export const PUBLIC_DIRECTORY_ROOM_ID = "directory";

/** South edge of the hall. Stays put while the hall grows north. */
export const PUBLIC_DIRECTORY_DOOR = { x: 0, z: -2 } as const;
/** One tile inside the door, facing the first teleporter. */
export const PUBLIC_DIRECTORY_SPAWN = { x: 0, z: -1 } as const;
/** Commons (`hub`) west wall. Arrival back from the directory is one tile inside. */
export const HUB_TO_DIRECTORY_DOOR = { x: -12, z: 0 } as const;
export const DIRECTORY_HUB_RETURN = { x: -11, z: 0 } as const;

const ROW_SIZE = 3;
/**
 * Left, center, right. Two tiles of floor between pillars so all three sit
 * inside the default camera from the door (a wider spread left only the
 * center column on screen).
 */
const COLUMN_X = [-3, 0, 3] as const;
const HALL_HALF_WIDTH = 6;
const FIRST_SLOT_Z = 2;
const ROW_STRIDE = 4;
const END_PAD = 3;

export type DirectoryListing = {
  id: string;
  displayName: string;
  thumbsUpCount: number;
  playerCount: number;
  spawnX: number;
  spawnZ: number;
};

export type DirectorySlot = { x: number; z: number };

export type DirectoryTeleporterSlot = {
  x: number;
  z: number;
  targetRoomId: string;
  targetX: number;
  targetZ: number;
  targetRoomDisplayName: string;
};

export type RoomBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

const EMPTY_BOUNDS: RoomBounds = {
  minX: -HALL_HALF_WIDTH,
  maxX: HALL_HALF_WIDTH,
  minZ: PUBLIC_DIRECTORY_DOOR.z,
  maxZ: FIRST_SLOT_Z,
};

let currentBounds: RoomBounds = { ...EMPTY_BOUNDS };

export function getPublicDirectoryBounds(): RoomBounds {
  return { ...currentBounds };
}

function compareDirectoryListings(a: DirectoryListing, b: DirectoryListing): number {
  if (b.thumbsUpCount !== a.thumbsUpCount) {
    return b.thumbsUpCount - a.thumbsUpCount;
  }
  if (b.playerCount !== a.playerCount) return b.playerCount - a.playerCount;
  const name = a.displayName.localeCompare(b.displayName);
  if (name !== 0) return name;
  return a.id.localeCompare(b.id);
}

/**
 * Most popular listings fill the row nearest the door, left to right, then the
 * next row north. Updates the bounds returned by {@link getPublicDirectoryBounds}.
 */
export function layoutPublicDirectory(entries: readonly DirectoryListing[]): {
  bounds: RoomBounds;
  teleporters: DirectoryTeleporterSlot[];
} {
  const sorted = [...entries].sort(compareDirectoryListings);
  const teleporters: DirectoryTeleporterSlot[] = sorted.map((entry, index) => {
    const label = entry.displayName.trim() || entry.id;
    const row = Math.floor(index / ROW_SIZE);
    const col = index % ROW_SIZE;
    return {
      x: COLUMN_X[col]!,
      z: FIRST_SLOT_Z + row * ROW_STRIDE,
      targetRoomId: entry.id,
      targetX: entry.spawnX,
      targetZ: entry.spawnZ,
      targetRoomDisplayName: label,
    };
  });
  const lastZ =
    teleporters.length > 0
      ? teleporters[teleporters.length - 1]!.z + END_PAD
      : FIRST_SLOT_Z;
  currentBounds = {
    minX: -HALL_HALF_WIDTH,
    maxX: HALL_HALF_WIDTH,
    minZ: PUBLIC_DIRECTORY_DOOR.z,
    maxZ: lastZ,
  };
  return { bounds: { ...currentBounds }, teleporters };
}

function entranceDistanceSq(x: number, z: number): number {
  const dx = x - PUBLIC_DIRECTORY_DOOR.x;
  const dz = z - PUBLIC_DIRECTORY_DOOR.z;
  return dx * dx + dz * dz;
}

/** Closer to the door first. Equal distance prefers the southern tile, then the left. */
export function compareDirectorySlots(a: DirectorySlot, b: DirectorySlot): number {
  const da = entranceDistanceSq(a.x, a.z);
  const db = entranceDistanceSq(b.x, b.z);
  if (da !== db) return da - db;
  if (a.z !== b.z) return a.z - b.z;
  return a.x - b.x;
}

function boundsForSlots(slots: readonly DirectorySlot[]): RoomBounds {
  let minX = -HALL_HALF_WIDTH;
  let maxX = HALL_HALF_WIDTH;
  let maxZ = FIRST_SLOT_Z;
  for (const slot of slots) {
    minX = Math.min(minX, slot.x - 2);
    maxX = Math.max(maxX, slot.x + 2);
    maxZ = Math.max(maxZ, slot.z + END_PAD);
  }
  return {
    minX: Math.min(currentBounds.minX, minX),
    maxX: Math.max(currentBounds.maxX, maxX),
    minZ: PUBLIC_DIRECTORY_DOOR.z,
    maxZ: Math.max(currentBounds.maxZ, maxZ),
  };
}

/**
 * Keep admin-placed slot tiles. Bind the hottest listing to the slot closest
 * to the door. Extra listings append on the default row-of-three grid, skipping
 * tiles already occupied. Surplus slots (farthest from the door) are dropped.
 */
export function reconcilePublicDirectory(
  entries: readonly DirectoryListing[],
  existingSlots: readonly DirectorySlot[],
  occupiedTiles?: ReadonlySet<string>
): { bounds: RoomBounds; teleporters: DirectoryTeleporterSlot[] } {
  const sorted = [...entries].sort(compareDirectoryListings);
  const seen = new Set<string>();
  const slots: DirectorySlot[] = [];
  for (const slot of existingSlots) {
    if (!Number.isInteger(slot.x) || !Number.isInteger(slot.z)) continue;
    const key = `${slot.x},${slot.z}`;
    if (seen.has(key)) continue;
    seen.add(key);
    slots.push({ x: slot.x, z: slot.z });
  }
  slots.sort(compareDirectorySlots);
  if (slots.length > sorted.length) slots.length = sorted.length;

  const blocked = new Set<string>(occupiedTiles ?? []);
  for (const slot of slots) blocked.add(`${slot.x},${slot.z}`);
  let index = 0;
  while (slots.length < sorted.length && index < 10000) {
    const row = Math.floor(index / ROW_SIZE);
    const col = index % ROW_SIZE;
    const x = COLUMN_X[col]!;
    const z = FIRST_SLOT_Z + row * ROW_STRIDE;
    index += 1;
    const key = `${x},${z}`;
    if (blocked.has(key)) continue;
    blocked.add(key);
    slots.push({ x, z });
  }
  slots.sort(compareDirectorySlots);

  const teleporters: DirectoryTeleporterSlot[] = slots.map((slot, i) => {
    const entry = sorted[i]!;
    const label = entry.displayName.trim() || entry.id;
    return {
      x: slot.x,
      z: slot.z,
      targetRoomId: entry.id,
      targetX: entry.spawnX,
      targetZ: entry.spawnZ,
      targetRoomDisplayName: label,
    };
  });
  currentBounds = boundsForSlots(teleporters);
  return { bounds: { ...currentBounds }, teleporters };
}
