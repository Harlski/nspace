import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeTeleporterPropsForLoad,
  type TerrainProps,
} from "./grid.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Directory for `world-state.json`. Override with `WORLD_STATE_DIR`. */
const DATA_DIR = process.env.WORLD_STATE_DIR
  ? path.resolve(process.env.WORLD_STATE_DIR)
  : path.join(__dirname, "..", "data");

const STATE_FILE = path.join(DATA_DIR, "world-state.json");
const ROOMS_DIR = path.join(DATA_DIR, "rooms");
const SPAWNS_DIR = path.join(DATA_DIR, "spawns");

const STATE_VERSION = 1 as const;

type PersistedRoom = {
  obstacles: Array<{ tile: string; props: TerrainProps }>;
  extraFloor: string[];
  /** Carved-out base tiles in custom rooms (tileKey "x,z"). */
  removedBaseFloor?: string[];
  /** Last disconnect position; `y` is feet height (on block top or floor). */
  spawns: Record<string, { x: number; z: number; y?: number }>;
};

type PersistedFile = {
  version: typeof STATE_VERSION;
  rooms: Record<string, PersistedRoom>;
};

type PersistedRoomGeometry = {
  version: typeof STATE_VERSION;
  roomId: string;
  obstacles: Array<{ tile: string; props: TerrainProps }>;
  extraFloor: string[];
  removedBaseFloor?: string[];
};

type PersistedRoomSpawns = {
  version: typeof STATE_VERSION;
  roomId: string;
  spawns: Record<string, { x: number; z: number; y?: number }>;
};

function ensureDataDir(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function ensureSplitDirs(): void {
  ensureDataDir();
  fs.mkdirSync(ROOMS_DIR, { recursive: true });
  fs.mkdirSync(SPAWNS_DIR, { recursive: true });
}

function roomFilePath(roomId: string): string {
  return path.join(ROOMS_DIR, `${encodeURIComponent(roomId)}.json`);
}

function spawnFilePath(roomId: string): string {
  return path.join(SPAWNS_DIR, `${encodeURIComponent(roomId)}.json`);
}

function roomIdFromFileName(fileName: string): string | null {
  if (!fileName.endsWith(".json")) return null;
  try {
    return decodeURIComponent(fileName.slice(0, -5));
  } catch {
    return null;
  }
}

function writeJsonAtomically(filePath: string, payload: unknown): void {
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(payload), "utf8");
  fs.renameSync(tmp, filePath);
}

function loadLegacyWorldState(
  roomPlaced: Map<string, Map<string, TerrainProps>>,
  roomExtraFloor: Map<string, Set<string>>,
  roomBaseFloorRemoved: Map<string, Set<string>>,
  lastSpawnByRoom: Map<string, Map<string, { x: number; z: number; y?: number }>>,
  normalizeRoomId: (id: string) => string
): void {
  if (!fs.existsSync(STATE_FILE)) {
    console.log(`[world] no saved state (${STATE_FILE})`);
    return;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) as PersistedFile;
    if (raw.version !== 1 || !raw.rooms || typeof raw.rooms !== "object") {
      console.warn("[world] invalid state file, skipping load");
      return;
    }
    for (const [ridRaw, room] of Object.entries(raw.rooms)) {
      const roomId = normalizeRoomId(ridRaw);
      const placed = new Map<string, TerrainProps>();
      for (const o of room.obstacles ?? []) {
        if (typeof o?.tile === "string" && o.props && typeof o.props === "object") {
          const props = o.props as TerrainProps;
          placed.set(
            o.tile,
            normalizeTeleporterPropsForLoad({
              ...props,
              locked: props.locked ?? false,
            })
          );
        }
      }
      roomPlaced.set(roomId, placed);

      const ex = new Set<string>(room.extraFloor ?? []);
      roomExtraFloor.set(roomId, ex);

      const rb = new Set<string>(room.removedBaseFloor ?? []);
      roomBaseFloorRemoved.set(roomId, rb);

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
    console.log(`[world] loaded legacy state from ${STATE_FILE}`);
  } catch (e) {
    console.error("[world] failed to load legacy state", e);
  }
}

function hasSplitState(): boolean {
  const hasRooms =
    fs.existsSync(ROOMS_DIR) &&
    fs.readdirSync(ROOMS_DIR).some((name) => name.endsWith(".json"));
  const hasSpawns =
    fs.existsSync(SPAWNS_DIR) &&
    fs.readdirSync(SPAWNS_DIR).some((name) => name.endsWith(".json"));
  return hasRooms || hasSpawns;
}

function loadSplitWorldState(
  roomPlaced: Map<string, Map<string, TerrainProps>>,
  roomExtraFloor: Map<string, Set<string>>,
  roomBaseFloorRemoved: Map<string, Set<string>>,
  lastSpawnByRoom: Map<string, Map<string, { x: number; z: number; y?: number }>>,
  normalizeRoomId: (id: string) => string
): void {
  if (fs.existsSync(ROOMS_DIR)) {
    for (const fileName of fs.readdirSync(ROOMS_DIR)) {
      const fileRoomId = roomIdFromFileName(fileName);
      if (!fileRoomId) continue;
      const roomId = normalizeRoomId(fileRoomId);
      const filePath = path.join(ROOMS_DIR, fileName);
      try {
        const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as PersistedRoomGeometry;
        if (raw.version !== 1) continue;
        const placed = new Map<string, TerrainProps>();
        for (const o of raw.obstacles ?? []) {
          if (typeof o?.tile !== "string" || !o.props || typeof o.props !== "object") {
            continue;
          }
          const props = o.props as TerrainProps;
          placed.set(
            o.tile,
            normalizeTeleporterPropsForLoad({
              ...props,
              locked: props.locked ?? false,
            })
          );
        }
        roomPlaced.set(roomId, placed);
        roomExtraFloor.set(roomId, new Set<string>(raw.extraFloor ?? []));
        roomBaseFloorRemoved.set(
          roomId,
          new Set<string>(raw.removedBaseFloor ?? [])
        );
      } catch (e) {
        console.error(`[world] failed to load room file ${filePath}`, e);
      }
    }
  }

  if (fs.existsSync(SPAWNS_DIR)) {
    for (const fileName of fs.readdirSync(SPAWNS_DIR)) {
      const fileRoomId = roomIdFromFileName(fileName);
      if (!fileRoomId) continue;
      const roomId = normalizeRoomId(fileRoomId);
      const filePath = path.join(SPAWNS_DIR, fileName);
      try {
        const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as PersistedRoomSpawns;
        if (raw.version !== 1 || !raw.spawns || typeof raw.spawns !== "object") continue;
        const spawns = new Map<string, { x: number; z: number; y?: number }>();
        for (const [addr, p] of Object.entries(raw.spawns)) {
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
        lastSpawnByRoom.set(roomId, spawns);
      } catch (e) {
        console.error(`[world] failed to load spawn file ${filePath}`, e);
      }
    }
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
const SAVE_DEBOUNCE_MS = 400;

let refs: {
  roomPlaced: Map<string, Map<string, TerrainProps>>;
  roomExtraFloor: Map<string, Set<string>>;
  roomBaseFloorRemoved: Map<string, Set<string>>;
  lastSpawnByRoom: Map<string, Map<string, { x: number; z: number; y?: number }>>;
  normalizeRoomId: (id: string) => string;
} | null = null;

export function registerWorldStateRefs(
  roomPlaced: Map<string, Map<string, TerrainProps>>,
  roomExtraFloor: Map<string, Set<string>>,
  roomBaseFloorRemoved: Map<string, Set<string>>,
  lastSpawnByRoom: Map<string, Map<string, { x: number; z: number; y?: number }>>,
  normalizeRoomId: (id: string) => string
): void {
  refs = { roomPlaced, roomExtraFloor, roomBaseFloorRemoved, lastSpawnByRoom, normalizeRoomId };
}

/**
 * Load obstacles, extra floor tiles, and last spawn positions from disk.
 * Safe to call once at startup before clients connect.
 */
export function loadWorldState(
  roomPlaced: Map<string, Map<string, TerrainProps>>,
  roomExtraFloor: Map<string, Set<string>>,
  roomBaseFloorRemoved: Map<string, Set<string>>,
  lastSpawnByRoom: Map<string, Map<string, { x: number; z: number; y?: number }>>,
  normalizeRoomId: (id: string) => string
): void {
  if (hasSplitState()) {
    loadSplitWorldState(
      roomPlaced,
      roomExtraFloor,
      roomBaseFloorRemoved,
      lastSpawnByRoom,
      normalizeRoomId
    );
    console.log(`[world] loaded split state from ${ROOMS_DIR} + ${SPAWNS_DIR}`);
    return;
  }
  loadLegacyWorldState(
    roomPlaced,
    roomExtraFloor,
    roomBaseFloorRemoved,
    lastSpawnByRoom,
    normalizeRoomId
  );
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
  const { roomPlaced, roomExtraFloor, roomBaseFloorRemoved, lastSpawnByRoom, normalizeRoomId } =
    refs;
  const roomIds = new Set<string>();
  for (const k of roomPlaced.keys()) roomIds.add(k);
  for (const k of roomExtraFloor.keys()) roomIds.add(k);
  for (const k of roomBaseFloorRemoved.keys()) roomIds.add(k);
  for (const k of lastSpawnByRoom.keys()) roomIds.add(k);

  ensureSplitDirs();
  const geometryRoomIds = new Set<string>();
  const spawnRoomIds = new Set<string>();

  for (const roomId of roomIds) {
    const placed = roomPlaced.get(roomId);
    const ex = roomExtraFloor.get(roomId);
    const rb = roomBaseFloorRemoved.get(roomId);
    const spawns = lastSpawnByRoom.get(roomId);
    const obstacles: PersistedRoom["obstacles"] = [];
    if (placed) {
      for (const [tile, props] of placed) {
        obstacles.push({ tile, props: { ...props } });
      }
    }
    const extraFloor = ex ? [...ex].sort() : [];
    const removedBaseFloor = rb && rb.size > 0 ? [...rb].sort() : [];
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
      removedBaseFloor.length === 0 &&
      Object.keys(spawnObj).length === 0
    ) {
      const normalized = normalizeRoomId(roomId);
      const geometryPath = roomFilePath(normalized);
      const spawnsPath = spawnFilePath(normalized);
      if (fs.existsSync(geometryPath)) fs.unlinkSync(geometryPath);
      if (fs.existsSync(spawnsPath)) fs.unlinkSync(spawnsPath);
      continue;
    }

    const normalizedRoomId = normalizeRoomId(roomId);
    if (obstacles.length > 0 || extraFloor.length > 0 || removedBaseFloor.length > 0) {
      geometryRoomIds.add(normalizedRoomId);
      const payload: PersistedRoomGeometry = {
        version: STATE_VERSION,
        roomId: normalizedRoomId,
        obstacles,
        extraFloor,
        ...(removedBaseFloor.length > 0 ? { removedBaseFloor } : {}),
      };
      writeJsonAtomically(roomFilePath(normalizedRoomId), payload);
    } else {
      const geometryPath = roomFilePath(normalizedRoomId);
      if (fs.existsSync(geometryPath)) fs.unlinkSync(geometryPath);
    }

    if (Object.keys(spawnObj).length > 0) {
      spawnRoomIds.add(normalizedRoomId);
      const payload: PersistedRoomSpawns = {
        version: STATE_VERSION,
        roomId: normalizedRoomId,
        spawns: spawnObj,
      };
      writeJsonAtomically(spawnFilePath(normalizedRoomId), payload);
    } else {
      const spawnsPath = spawnFilePath(normalizedRoomId);
      if (fs.existsSync(spawnsPath)) fs.unlinkSync(spawnsPath);
    }
  }

  for (const fileName of fs.readdirSync(ROOMS_DIR)) {
    const roomId = roomIdFromFileName(fileName);
    if (!roomId) continue;
    if (!geometryRoomIds.has(roomId)) {
      fs.unlinkSync(path.join(ROOMS_DIR, fileName));
    }
  }
  for (const fileName of fs.readdirSync(SPAWNS_DIR)) {
    const roomId = roomIdFromFileName(fileName);
    if (!roomId) continue;
    if (!spawnRoomIds.has(roomId)) {
      fs.unlinkSync(path.join(SPAWNS_DIR, fileName));
    }
  }
}
