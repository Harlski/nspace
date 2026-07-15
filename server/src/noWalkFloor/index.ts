/**
 * No-Walk Floor domain module — parallel tile-keyed walkability layer (ADR 0011).
 * Boolean set per (x, z): floor mesh stays; walk intents treat the tile as unwalkable.
 * Pure store ops; rooms.ts / Build Shell / persistence are adapters.
 */

export type NoWalkFloorTile = { x: number; z: number };

/** roomId → tileKey set (`${x},${z}`) */
export type NoWalkFloorStore = Map<string, Set<string>>;

export function createNoWalkFloorStore(): NoWalkFloorStore {
  return new Map();
}

export function noWalkFloorTileKey(x: number, z: number): string {
  return `${Math.floor(x)},${Math.floor(z)}`;
}

function parseTileKey(key: string): NoWalkFloorTile | null {
  const comma = key.indexOf(",");
  if (comma < 0) return null;
  const x = Number(key.slice(0, comma));
  const z = Number(key.slice(comma + 1));
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  return { x: Math.floor(x), z: Math.floor(z) };
}

function roomSet(store: NoWalkFloorStore, roomId: string): Set<string> {
  let s = store.get(roomId);
  if (!s) {
    s = new Set();
    store.set(roomId, s);
  }
  return s;
}

export function hasNoWalkFloor(
  store: NoWalkFloorStore,
  roomId: string,
  x: number,
  z: number
): boolean {
  return store.get(roomId)?.has(noWalkFloorTileKey(x, z)) === true;
}

/** @returns true if the tile was newly marked */
export function addNoWalkFloor(
  store: NoWalkFloorStore,
  roomId: string,
  x: number,
  z: number
): boolean {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  if (!Number.isFinite(xi) || !Number.isFinite(zi)) return false;
  const s = roomSet(store, roomId);
  const key = noWalkFloorTileKey(xi, zi);
  if (s.has(key)) return false;
  s.add(key);
  return true;
}

/** @returns true if the tile was cleared */
export function removeNoWalkFloor(
  store: NoWalkFloorStore,
  roomId: string,
  x: number,
  z: number
): boolean {
  const s = store.get(roomId);
  if (!s) return false;
  return s.delete(noWalkFloorTileKey(x, z));
}

export function listNoWalkFloorTiles(
  store: NoWalkFloorStore,
  roomId: string
): NoWalkFloorTile[] {
  const s = store.get(roomId);
  if (!s || s.size === 0) return [];
  const out: NoWalkFloorTile[] = [];
  for (const key of s) {
    const t = parseTileKey(key);
    if (t) out.push(t);
  }
  out.sort((a, b) => (a.z !== b.z ? a.z - b.z : a.x - b.x));
  return out;
}

export function listNoWalkFloorKeys(
  store: NoWalkFloorStore,
  roomId: string
): string[] {
  const s = store.get(roomId);
  if (!s || s.size === 0) return [];
  return [...s].sort();
}

/** Replace room layer from keys (`"x,z"`) or `{x,z}` tiles. Invalid entries skipped. */
export function replaceAllNoWalkFloor(
  store: NoWalkFloorStore,
  roomId: string,
  raw: unknown
): NoWalkFloorTile[] {
  const next = new Set<string>();
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === "string") {
        const t = parseTileKey(item);
        if (t) next.add(noWalkFloorTileKey(t.x, t.z));
        continue;
      }
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const x = Number(o.x);
      const z = Number(o.z);
      if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
      next.add(noWalkFloorTileKey(x, z));
    }
  }
  if (next.size === 0) {
    store.delete(roomId);
  } else {
    store.set(roomId, next);
  }
  return listNoWalkFloorTiles(store, roomId);
}

export function clearRoomNoWalkFloor(
  store: NoWalkFloorStore,
  roomId: string
): void {
  store.delete(roomId);
}

let globalStore: NoWalkFloorStore = createNoWalkFloorStore();

export function getNoWalkFloorStore(): NoWalkFloorStore {
  return globalStore;
}

export function listRoomNoWalkFloor(roomId: string): NoWalkFloorTile[] {
  return listNoWalkFloorTiles(globalStore, roomId);
}

export function listRoomNoWalkFloorKeys(roomId: string): string[] {
  return listNoWalkFloorKeys(globalStore, roomId);
}

export function hasRoomNoWalkFloor(roomId: string, x: number, z: number): boolean {
  return hasNoWalkFloor(globalStore, roomId, x, z);
}

export function addRoomNoWalkFloor(roomId: string, x: number, z: number): boolean {
  return addNoWalkFloor(globalStore, roomId, x, z);
}

export function removeRoomNoWalkFloor(
  roomId: string,
  x: number,
  z: number
): boolean {
  return removeNoWalkFloor(globalStore, roomId, x, z);
}

export function replaceRoomNoWalkFloor(
  roomId: string,
  raw: unknown
): NoWalkFloorTile[] {
  return replaceAllNoWalkFloor(globalStore, roomId, raw);
}

export function clearRoomNoWalkFloorGlobal(roomId: string): void {
  clearRoomNoWalkFloor(globalStore, roomId);
}

export function noWalkFloorReadonly(roomId: string): ReadonlySet<string> | null {
  const s = globalStore.get(roomId);
  return s && s.size > 0 ? s : null;
}

/** Test helper — wipe the process-global store. */
export function _resetNoWalkFloorStoreForTests(): void {
  globalStore = createNoWalkFloorStore();
}
