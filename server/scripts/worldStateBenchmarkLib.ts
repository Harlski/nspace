import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { TerrainProps } from "../src/grid.ts";

type PersistedRoom = {
  obstacles?: Array<{ tile: string; props: TerrainProps }>;
  extraFloor?: string[];
  spawns?: Record<string, { x: number; z: number; y?: number }>;
};

type PersistedWorldState = {
  version: number;
  rooms: Record<string, PersistedRoom>;
};

type SignboardFile = {
  signboards?: Array<{
    id: string;
    roomId: string;
    x: number;
    z: number;
    message: string;
    createdBy: string;
    createdAt: number;
  }>;
};

type VoxelTextsFile = {
  voxelTexts?: Array<{
    id: string;
    text: string;
    roomId: string;
    x: number;
    y: number;
    z: number;
  }>;
};

export type WorldStateMetrics = {
  dataDir: string;
  roomId: string;
  fileBytes: number;
  roomCount: number;
  obstacleCount: number;
  extraFloorCount: number;
  spawnCount: number;
  signboardCount: number;
  voxelTextCount: number;
  welcomePayloadBytes: number;
  obstacleBroadcastBytes: number;
  obstacleDeltaBroadcastBytes: number;
  extraFloorBroadcastBytes: number;
  extraFloorDeltaBroadcastBytes: number;
  loadMs: number;
  persistMs: number;
};

function normalizeRoomId(roomId: string): string {
  return roomId === "lobby" ? "hub" : roomId;
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function toObstacleTiles(entries: ReadonlyMap<string, TerrainProps>): Array<{
  x: number;
  z: number;
  passable: boolean;
  half: boolean;
  quarter: boolean;
  hex: boolean;
  ramp: boolean;
  rampDir: number;
  colorId: number;
  locked: boolean;
}> {
  const out: Array<{
    x: number;
    z: number;
    passable: boolean;
    half: boolean;
    quarter: boolean;
    hex: boolean;
    ramp: boolean;
    rampDir: number;
    colorId: number;
    locked: boolean;
  }> = [];
  for (const [tileKey, props] of entries) {
    const [x, z] = tileKey.split(",").map(Number);
    out.push({
      x: x ?? 0,
      z: z ?? 0,
      passable: Boolean(props.passable),
      half: Boolean(props.half),
      quarter: Boolean(props.quarter),
      hex: Boolean(props.hex),
      ramp: Boolean(props.ramp),
      rampDir: Number.isFinite(props.rampDir) ? Math.floor(props.rampDir) : 0,
      colorId: Number.isFinite(props.colorId) ? Math.floor(props.colorId) : 0,
      locked: Boolean(props.locked),
    });
  }
  return out;
}

function toExtraFloorTiles(entries: ReadonlySet<string>): Array<{ x: number; z: number }> {
  const out: Array<{ x: number; z: number }> = [];
  for (const tileKey of entries) {
    const [x, z] = tileKey.split(",").map(Number);
    out.push({ x: x ?? 0, z: z ?? 0 });
  }
  return out;
}

function utf8Bytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

export async function collectWorldStateMetrics(
  dataDir: string,
  roomIdInput: string
): Promise<WorldStateMetrics> {
  const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
  const worldPersistencePath = path.resolve(scriptsDir, "../src/worldPersistence.ts");
  const roomId = normalizeRoomId(roomIdInput);
  const stateFile = path.join(dataDir, "world-state.json");
  if (!fs.existsSync(stateFile)) {
    throw new Error(`Missing world state file: ${stateFile}`);
  }
  const rawState = readJsonFile<PersistedWorldState>(stateFile, { version: 1, rooms: {} });

  // Use an isolated temp dir for persist timing to avoid mutating fixture files.
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nspace-world-bench-"));
  const isolatedDataDir = path.join(tempRoot, "data");
  fs.mkdirSync(isolatedDataDir, { recursive: true });
  fs.copyFileSync(stateFile, path.join(isolatedDataDir, "world-state.json"));

  process.env.WORLD_STATE_DIR = isolatedDataDir;
  const importUrl = `${pathToFileURL(worldPersistencePath).href}?bench=${Date.now()}`;
  const persistence = await import(importUrl);
  const {
    loadWorldState,
    registerWorldStateRefs,
    flushPersistWorldStateSync,
  }: {
    loadWorldState: (
      roomPlaced: Map<string, Map<string, TerrainProps>>,
      roomExtraFloor: Map<string, Set<string>>,
      roomBaseFloorRemoved: Map<string, Set<string>>,
      lastSpawnByRoom: Map<string, Map<string, { x: number; z: number; y?: number }>>,
      normalize: (roomId: string) => string
    ) => void;
    registerWorldStateRefs: (
      roomPlaced: Map<string, Map<string, TerrainProps>>,
      roomExtraFloor: Map<string, Set<string>>,
      roomBaseFloorRemoved: Map<string, Set<string>>,
      lastSpawnByRoom: Map<string, Map<string, { x: number; z: number; y?: number }>>,
      normalize: (roomId: string) => string
    ) => void;
    flushPersistWorldStateSync: () => void;
  } = persistence;

  const roomPlaced = new Map<string, Map<string, TerrainProps>>();
  const roomExtraFloor = new Map<string, Set<string>>();
  const roomBaseFloorRemoved = new Map<string, Set<string>>();
  const lastSpawnByRoom = new Map<string, Map<string, { x: number; z: number; y?: number }>>();

  const loadStart = performance.now();
  loadWorldState(
    roomPlaced,
    roomExtraFloor,
    roomBaseFloorRemoved,
    lastSpawnByRoom,
    normalizeRoomId
  );
  const loadMs = performance.now() - loadStart;

  registerWorldStateRefs(
    roomPlaced,
    roomExtraFloor,
    roomBaseFloorRemoved,
    lastSpawnByRoom,
    normalizeRoomId
  );
  const persistStart = performance.now();
  flushPersistWorldStateSync();
  const persistMs = performance.now() - persistStart;

  const roomObstacles = roomPlaced.get(roomId) ?? new Map<string, TerrainProps>();
  const roomExtra = roomExtraFloor.get(roomId) ?? new Set<string>();
  const roomSpawns = lastSpawnByRoom.get(roomId) ?? new Map<string, { x: number; z: number; y?: number }>();

  const obstacles = toObstacleTiles(roomObstacles);
  const extraFloorTiles = toExtraFloorTiles(roomExtra);
  const signboardsData = readJsonFile<SignboardFile>(path.join(dataDir, "signboards.json"), {
    signboards: [],
  });
  const voxelData = readJsonFile<VoxelTextsFile>(path.join(dataDir, "voxel-texts.json"), {
    voxelTexts: [],
  });
  const signboards = (signboardsData.signboards ?? []).filter((s) => normalizeRoomId(s.roomId) === roomId);
  const voxelTexts = (voxelData.voxelTexts ?? []).filter((v) => normalizeRoomId(v.roomId) === roomId);

  const welcomePayload = {
    type: "welcome",
    roomId,
    obstacles,
    extraFloorTiles,
    signboards,
    voxelTexts,
  };

  const metrics: WorldStateMetrics = {
    dataDir,
    roomId,
    fileBytes: fs.statSync(stateFile).size,
    roomCount: Object.keys(rawState.rooms ?? {}).length,
    obstacleCount: obstacles.length,
    extraFloorCount: extraFloorTiles.length,
    spawnCount: roomSpawns.size,
    signboardCount: signboards.length,
    voxelTextCount: voxelTexts.length,
    welcomePayloadBytes: utf8Bytes(welcomePayload),
    obstacleBroadcastBytes: utf8Bytes({ type: "obstacles", roomId, tiles: obstacles }),
    obstacleDeltaBroadcastBytes: utf8Bytes({
      type: "obstaclesDelta",
      roomId,
      add: obstacles.length > 0 ? [obstacles[0]!] : [],
      remove: [],
    }),
    extraFloorBroadcastBytes: utf8Bytes({ type: "extraFloor", roomId, tiles: extraFloorTiles }),
    extraFloorDeltaBroadcastBytes: utf8Bytes({
      type: "extraFloorDelta",
      roomId,
      add: extraFloorTiles.length > 0 ? [extraFloorTiles[0]!] : [],
      remove: [],
    }),
    loadMs,
    persistMs,
  };

  fs.rmSync(tempRoot, { recursive: true, force: true });
  return metrics;
}
