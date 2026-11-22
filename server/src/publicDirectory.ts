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
/** How many listings stand on the podium in front of the hall. */
export const DIRECTORY_PODIUM_COUNT = 5;
/** Likes are re-read on this interval. Occupancy still updates in between. */
export const DIRECTORY_PODIUM_REFRESH_MS = 30 * 60 * 1000;
/**
 * Rank 1 stands alone closest to the door. Ranks 2 and 3 flank one step back,
 * ranks 4 and 5 one step further. The rest of the hall starts behind a gap.
 */
export const DIRECTORY_PODIUM_SLOTS = [
  { x: 0, z: 2 },
  { x: -3, z: 4 },
  { x: 3, z: 4 },
  { x: -3, z: 6 },
  { x: 3, z: 6 },
] as const;
const BACK_FIRST_Z = 10;

export type DirectoryListing = {
  id: string;
  displayName: string;
  thumbsUpCount: number;
  playerCount: number;
  spawnX: number;
  spawnZ: number;
  /** Wallet that created the room, when one is recorded. */
  ownerAddress?: string | null;
};

export type DirectorySlot = { x: number; z: number };

export type DirectoryTeleporterSlot = {
  x: number;
  z: number;
  targetRoomId: string;
  targetX: number;
  targetZ: number;
  targetRoomDisplayName: string;
  /** Owner wallet, so the hall label can show their identicon. */
  targetRoomOwnerAddress?: string;
  /** Live occupants of the destination room (0 when empty). */
  playerCount: number;
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
 * Count drawn on a directory teleporter. Outside production, an empty room
 * gets a stable preview count from its id so the badge can be seen with no crowd.
 * A real occupant count always wins.
 */
export function directoryShownPlayerCount(
  roomId: string,
  realCount: number,
  devPreview: boolean
): number {
  const real = Math.max(0, Math.floor(realCount));
  if (!devPreview || real > 0) return real;
  let hash = 2166136261;
  for (let i = 0; i < roomId.length; i++) {
    hash ^= roomId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return 1 + ((hash >>> 0) % 12);
}

export type DirectoryPodiumHold = {
  assignedAtMs: number;
  /** Room ids on the podium, rank 1 first. */
  roomIds: string[];
};

/**
 * Top listings stay on the podium until the refresh interval. A room that
 * leaves the public list is replaced immediately. Likes are only re-ranked
 * when the interval has elapsed.
 */
export function nextDirectoryPodium(
  entries: readonly DirectoryListing[],
  hold: DirectoryPodiumHold | null,
  nowMs: number
): { hold: DirectoryPodiumHold; podium: DirectoryListing[]; rest: DirectoryListing[] } {
  const ranked = [...entries].sort(compareDirectoryListings);
  const byId = new Map(ranked.map((entry) => [entry.id, entry]));
  const refreshDue =
    hold === null || nowMs - hold.assignedAtMs >= DIRECTORY_PODIUM_REFRESH_MS;
  let roomIds: string[];
  let assignedAtMs: number;
  if (refreshDue) {
    roomIds = ranked.slice(0, DIRECTORY_PODIUM_COUNT).map((entry) => entry.id);
    assignedAtMs = nowMs;
  } else {
    roomIds = hold.roomIds.filter((id) => byId.has(id));
    if (roomIds.length < Math.min(DIRECTORY_PODIUM_COUNT, ranked.length)) {
      const seated = new Set(roomIds);
      for (const entry of ranked) {
        if (roomIds.length >= DIRECTORY_PODIUM_COUNT) break;
        if (seated.has(entry.id)) continue;
        roomIds.push(entry.id);
        seated.add(entry.id);
      }
    }
    assignedAtMs = hold.assignedAtMs;
  }
  const seated = new Set(roomIds);
  const podium = roomIds
    .map((id) => byId.get(id))
    .filter((entry): entry is DirectoryListing => entry !== undefined);
  const rest = ranked.filter((entry) => !seated.has(entry.id));
  return { hold: { assignedAtMs, roomIds }, podium, rest };
}

function listingSlot(
  entry: DirectoryListing,
  x: number,
  z: number
): DirectoryTeleporterSlot {
  const label = entry.displayName.trim() || entry.id;
  return {
    x,
    z,
    targetRoomId: entry.id,
    targetX: entry.spawnX,
    targetZ: entry.spawnZ,
    targetRoomDisplayName: label,
    ...(entry.ownerAddress ? { targetRoomOwnerAddress: entry.ownerAddress } : {}),
    playerCount: Math.max(0, Math.floor(entry.playerCount)),
  };
}

function isPodiumTile(x: number, z: number): boolean {
  return DIRECTORY_PODIUM_SLOTS.some((slot) => slot.x === x && slot.z === z);
}

function backSlotAt(index: number): DirectorySlot {
  const row = Math.floor(index / ROW_SIZE);
  const col = index % ROW_SIZE;
  return { x: COLUMN_X[col]!, z: BACK_FIRST_Z + row * ROW_STRIDE };
}

function buildDirectoryLayout(
  podium: readonly DirectoryListing[],
  rest: readonly DirectoryListing[],
  existingSlots: readonly DirectorySlot[],
  occupiedTiles?: ReadonlySet<string>
): { bounds: RoomBounds; teleporters: DirectoryTeleporterSlot[] } {
  const teleporters: DirectoryTeleporterSlot[] = [];
  const used = new Set<string>();
  const deferred: DirectoryListing[] = [];
  for (let i = 0; i < podium.length && i < DIRECTORY_PODIUM_SLOTS.length; i++) {
    const entry = podium[i]!;
    const slot = DIRECTORY_PODIUM_SLOTS[i]!;
    const key = `${slot.x},${slot.z}`;
    if (occupiedTiles?.has(key)) {
      deferred.push(entry);
      continue;
    }
    used.add(key);
    teleporters.push(listingSlot(entry, slot.x, slot.z));
  }

  const backEntries = [...deferred, ...rest];
  const backSlots: DirectorySlot[] = [];
  const seen = new Set<string>();
  for (const slot of existingSlots) {
    if (!Number.isInteger(slot.x) || !Number.isInteger(slot.z)) continue;
    if (isPodiumTile(slot.x, slot.z)) continue;
    const key = `${slot.x},${slot.z}`;
    if (seen.has(key) || used.has(key)) continue;
    seen.add(key);
    backSlots.push({ x: slot.x, z: slot.z });
  }
  backSlots.sort(compareDirectorySlots);
  if (backSlots.length > backEntries.length) backSlots.length = backEntries.length;

  const blocked = new Set<string>(occupiedTiles ?? []);
  for (const key of used) blocked.add(key);
  for (const slot of backSlots) blocked.add(`${slot.x},${slot.z}`);
  let index = 0;
  while (backSlots.length < backEntries.length && index < 10000) {
    const slot = backSlotAt(index);
    index += 1;
    const key = `${slot.x},${slot.z}`;
    if (blocked.has(key)) continue;
    blocked.add(key);
    backSlots.push({ x: slot.x, z: slot.z });
  }
  backSlots.sort(compareDirectorySlots);
  for (let i = 0; i < backEntries.length; i++) {
    const slot = backSlots[i];
    const entry = backEntries[i];
    if (!slot || !entry) break;
    teleporters.push(listingSlot(entry, slot.x, slot.z));
  }
  currentBounds = boundsForSlots(teleporters);
  return { bounds: { ...currentBounds }, teleporters };
}

/**
 * Top five stand on the podium. Everyone else fills the hall behind it.
 * Updates the bounds returned by {@link getPublicDirectoryBounds}.
 */
export function layoutPublicDirectory(entries: readonly DirectoryListing[]): {
  bounds: RoomBounds;
  teleporters: DirectoryTeleporterSlot[];
} {
  const { podium, rest } = nextDirectoryPodium(entries, null, 0);
  return buildDirectoryLayout(podium, rest, []);
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
 * Put `podium` on the front slots, in the given order. The rest keep
 * admin-moved tiles behind the podium, closest to the door first. New rooms
 * grow the back hall when no free tile is left. Surplus back slots are dropped.
 */
export function reconcilePublicDirectory(
  entries: readonly DirectoryListing[],
  existingSlots: readonly DirectorySlot[],
  occupiedTiles?: ReadonlySet<string>,
  podium?: readonly DirectoryListing[]
): { bounds: RoomBounds; teleporters: DirectoryTeleporterSlot[] } {
  const ranked = [...entries].sort(compareDirectoryListings);
  const front = podium
    ? podium.filter((entry) => ranked.some((item) => item.id === entry.id))
    : ranked.slice(0, DIRECTORY_PODIUM_COUNT);
  const seated = new Set(front.map((entry) => entry.id));
  const rest = ranked.filter((entry) => !seated.has(entry.id));
  return buildDirectoryLayout(front, rest, existingSlots, occupiedTiles);
}
