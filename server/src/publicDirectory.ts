/**
 * Public Directory: one hallway of teleporters to every public player room.
 * Generated in memory (not saved with world geometry). The hall grows with the
 * list. Higher thumbs-up, then more people present, sit closer to the door.
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
/** Left, center, right. The door on x = 0 lines up with the middle column. */
const COLUMN_X = [-5, 0, 5] as const;
const HALL_HALF_WIDTH = 8;
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
