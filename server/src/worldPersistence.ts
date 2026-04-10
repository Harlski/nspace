import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { TerrainProps } from "./grid.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Directory for `world-state.json`. Override with `WORLD_STATE_DIR`. */
const DATA_DIR = process.env.WORLD_STATE_DIR
  ? path.resolve(process.env.WORLD_STATE_DIR)
  : path.join(__dirname, "..", "data");

const STATE_FILE = path.join(DATA_DIR, "world-state.json");

const STATE_VERSION = 1 as const;

type PersistedRoom = {
  obstacles: Array<{ tile: string; props: TerrainProps }>;
  extraFloor: string[];
  /** Last disconnect position; `y` is feet height (on block top or floor). */
  spawns: Record<string, { x: number; z: number; y?: number }>;
};

type PersistedFile = {
  version: typeof STATE_VERSION;
  rooms: Record<string, PersistedRoom>;
};

function ensureDataDir(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
const SAVE_DEBOUNCE_MS = 400;

let refs: {
  roomPlaced: Map<string, Map<string, TerrainProps>>;
  roomExtraFloor: Map<string, Set<string>>;
  lastSpawnByRoom: Map<string, Map<string, { x: number; z: number; y?: number }>>;
  normalizeRoomId: (id: string) => string;
} | null = null;

export function registerWorldStateRefs(
  roomPlaced: Map<string, Map<string, TerrainProps>>,
  roomExtraFloor: Map<string, Set<string>>,
  lastSpawnByRoom: Map<string, Map<string, { x: number; z: number; y?: number }>>,
  normalizeRoomId: (id: string) => string
): void {
  refs = { roomPlaced, roomExtraFloor, lastSpawnByRoom, normalizeRoomId };
}

/**
 * Load obstacles, extra floor tiles, and last spawn positions from disk.
 * Safe to call once at startup before clients connect.
 */
export function loadWorldState(
  roomPlaced: Map<string, Map<string, TerrainProps>>,
  roomExtraFloor: Map<string, Set<string>>,
  lastSpawnByRoom: Map<string, Map<string, { x: number; z: number; y?: number }>>,
  normalizeRoomId: (id: string) => string
): void {
  if (!fs.existsSync(STATE_FILE)) {
    console.log(`[world] no saved state (${STATE_FILE})`);
    return;
  }
  try {
    const raw = JSON.parse(
      fs.readFileSync(STATE_FILE, "utf8")
    ) as PersistedFile;
    if (raw.version !== 1 || !raw.rooms || typeof raw.rooms !== "object") {
      console.warn("[world] invalid state file, skipping load");
      return;
    }
    for (const [ridRaw, room] of Object.entries(raw.rooms)) {
      const roomId = normalizeRoomId(ridRaw);
      const placed = new Map<string, TerrainProps>();
      for (const o of room.obstacles ?? []) {
        if (
          typeof o?.tile === "string" &&
          o.props &&
          typeof o.props === "object"
        ) {
          placed.set(o.tile, o.props as TerrainProps);
        }
      }
      roomPlaced.set(roomId, placed);

      const ex = new Set<string>(room.extraFloor ?? []);
      roomExtraFloor.set(roomId, ex);

      const spawns = new Map<string, { x: number; z: number; y?: number }>();
      if (room.spawns && typeof room.spawns === "object") {
        for (const [addr, p] of Object.entries(room.spawns)) {
          if (
            p &&
            typeof p === "object" &&
            Number.isFinite(p.x) &&
            Number.isFinite(p.z)
          ) {
            const y =
              typeof p.y === "number" && Number.isFinite(p.y) ? p.y : undefined;
            spawns.set(addr, y !== undefined ? { x: p.x, z: p.z, y } : { x: p.x, z: p.z });
          }
        }
      }
      lastSpawnByRoom.set(roomId, spawns);
    }
    console.log(`[world] loaded state from ${STATE_FILE}`);
  } catch (e) {
    console.error("[world] failed to load state", e);
  }
}

export function schedulePersistWorldState(): void {
  if (!refs) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      persistWorldStateNow();
    } catch (e) {
      console.error("[world] save failed", e);
    }
  }, SAVE_DEBOUNCE_MS);
}

export function flushPersistWorldStateSync(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (refs) persistWorldStateNow();
}

function persistWorldStateNow(): void {
  if (!refs) return;
  const { roomPlaced, roomExtraFloor, lastSpawnByRoom, normalizeRoomId } =
    refs;
  const rooms: Record<string, PersistedRoom> = {};

  const roomIds = new Set<string>();
  for (const k of roomPlaced.keys()) roomIds.add(k);
  for (const k of roomExtraFloor.keys()) roomIds.add(k);
  for (const k of lastSpawnByRoom.keys()) roomIds.add(k);

  for (const roomId of roomIds) {
    const placed = roomPlaced.get(roomId);
    const ex = roomExtraFloor.get(roomId);
    const spawns = lastSpawnByRoom.get(roomId);
    const obstacles: PersistedRoom["obstacles"] = [];
    if (placed) {
      for (const [tile, props] of placed) {
        obstacles.push({ tile, props: { ...props } });
      }
    }
    const extraFloor = ex ? [...ex].sort() : [];
    const spawnObj: Record<string, { x: number; z: number; y?: number }> = {};
    if (spawns) {
      for (const [addr, p] of spawns) {
        if (typeof p.y === "number" && Number.isFinite(p.y)) {
          spawnObj[addr] = { x: p.x, z: p.z, y: p.y };
        } else {
          spawnObj[addr] = { x: p.x, z: p.z };
        }
      }
    }
    if (
      obstacles.length === 0 &&
      extraFloor.length === 0 &&
      Object.keys(spawnObj).length === 0
    ) {
      continue;
    }
    rooms[normalizeRoomId(roomId)] = {
      obstacles,
      extraFloor,
      spawns: spawnObj,
    };
  }

  ensureDataDir();
  const payload: PersistedFile = { version: STATE_VERSION, rooms };
  const tmp = `${STATE_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(payload), "utf8");
  fs.renameSync(tmp, STATE_FILE);
}
