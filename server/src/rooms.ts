import type { WebSocket } from "ws";
import {
  inTileBounds,
  isBaseTile,
  isWalkableTile,
  pathfindTiles,
  pathfindTerrain,
  snapToTile,
  terrainObstacleHeight,
  tileKey,
  type TerrainProps,
} from "./grid.js";
import {
  getDoorsForRoom,
  getRoomBaseBounds,
  HUB_ROOM_ID,
  isHubSpawnSafeZone,
  normalizeRoomId,
  type RoomBounds,
} from "./roomLayouts.js";
import {
  loadWorldState,
  registerWorldStateRefs,
  schedulePersistWorldState,
} from "./worldPersistence.js";
import {
  beginSession,
  endSession,
  logGameplayEvent,
} from "./eventLog.js";
import {
  formatNpcDisplayName,
  npcDisplayNameBase,
  pickGuestDisplayName,
} from "./guestNames.js";
import { walletDisplayName } from "./walletDisplayName.js";

const MOVE_SPEED = 5;
/** NPCs move 20% slower than human path-follow speed. */
const NPC_MOVE_SPEED = MOVE_SPEED * 0.8;
const TICK_MS = 50;
const CHAT_MAX = 256;
const RATE_MOVE_TO_MS = 120;
const RATE_CHAT_MS = 800;
const RATE_PLACE_MS = 200;
const ARRIVE_EPS = 0.04;
/** Wandering NPCs per room (default `2`, half of the previous default; set `FAKE_PLAYER_COUNT=0` to disable). */
const FAKE_PLAYER_COUNT = Math.max(
  0,
  Math.min(32, Math.floor(Number(process.env.FAKE_PLAYER_COUNT ?? "2")))
);
/** Idle after finishing a path (or before retrying) before picking a new destination. */
const FAKE_IDLE_MS = 10_000;
/** Max tile waypoints per NPC path (short paths only). */
const FAKE_PATH_MAX_STEPS = 5;
/** Max distance on XZ (world units) from player to tile for block edit actions; enforced server-side. */
const PLACE_RADIUS_BLOCKS = Math.max(
  0,
  Math.min(64, Number(process.env.PLACE_RADIUS_BLOCKS ?? "5"))
);

export interface PlayerState {
  address: string;
  displayName: string;
  x: number;
  /** World vertical position (feet on floor or on block top). */
  y: number;
  z: number;
  vx: number;
  vz: number;
}

export type ObstacleTile = {
  x: number;
  z: number;
  passable: boolean;
  /** Shorter Y extent when `quarter` is false. */
  half: boolean;
  /** Quarter-unit height slab; wins over `half`. */
  quarter: boolean;
  /** Hexagonal prism footprint. */
  hex: boolean;
  /** Sloped ramp (walkable floor); `rampDir` 0–3 = +X,+Z,−X,−Z toward climbed block. */
  ramp: boolean;
  rampDir: number;
  /** Index into client color palette (0..9). */
  colorId: number;
};

const BLOCK_COLOR_MAX = 9;

type PlacedProps = TerrainProps;

function clampColorId(n: number): number {
  const k = Math.floor(Number(n));
  if (!Number.isFinite(k)) return 0;
  return Math.max(0, Math.min(BLOCK_COLOR_MAX, k));
}

export type ExtraFloorTile = { x: number; z: number };

interface ClientConn {
  ws: WebSocket;
  address: string;
  displayName: string;
  sessionId: string;
  sessionStartedAt: number;
  lastMoveToAt: number;
  lastChatAt: number;
  lastPlaceAt: number;
  player: PlayerState;
  pathQueue: { x: number; z: number; layer: 0 | 1 }[];
}

function withinBlockActionRange(
  player: PlayerState,
  tileX: number,
  tileZ: number
): boolean {
  if (PLACE_RADIUS_BLOCKS <= 0) return true;
  const dx = player.x - tileX;
  const dz = player.z - tileZ;
  return Math.hypot(dx, dz) <= PLACE_RADIUS_BLOCKS + 1e-6;
}

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

type OutMsg =
  | {
      type: "welcome";
      self: PlayerState;
      others: PlayerState[];
      roomId: string;
      roomBounds: RoomBounds;
      doors: {
        x: number;
        z: number;
        targetRoomId: string;
        spawnX: number;
        spawnZ: number;
      }[];
      /** Max horizontal distance (world units) from player to tile center for place/move actions; 0 = unlimited. */
      placeRadiusBlocks: number;
      obstacles: ObstacleTile[];
      extraFloorTiles: ExtraFloorTile[];
    }
  | { type: "playerJoined"; player: PlayerState }
  | { type: "playerLeft"; address: string }
  | { type: "state"; players: PlayerState[] }
  | { type: "obstacles"; roomId: string; tiles: ObstacleTile[] }
  | { type: "extraFloor"; roomId: string; tiles: ExtraFloorTile[] }
  | { type: "chat"; from: string; fromAddress: string; text: string; at: number }
  | { type: "error"; code: string };

const rooms = new Map<string, Map<string, ClientConn>>();
/** Server-driven avatars (not WebSocket clients); merged into player snapshots / ticks. */
const roomFakePlayers = new Map<
  string,
  Map<
    string,
    {
      player: PlayerState;
      pathQueue: { x: number; z: number }[];
      /** When path is empty, wait until this time (ms) before choosing a new destination. */
      idleUntil: number;
    }
  >
>();
/** Last known spawn position per room + wallet (persists across sessions). */
const lastSpawnByRoom = new Map<
  string,
  Map<string, { x: number; z: number; y?: number }>
>();
/** Placed objects per room: key = tileKey(x,z), value = props. */
const roomPlaced = new Map<string, Map<string, PlacedProps>>();
/** Walkable tiles outside the core room (must connect to core or another extra). */
const roomExtraFloor = new Map<string, Set<string>>();

loadWorldState(roomPlaced, roomExtraFloor, lastSpawnByRoom, normalizeRoomId);
registerWorldStateRefs(
  roomPlaced,
  roomExtraFloor,
  lastSpawnByRoom,
  normalizeRoomId
);

function placedMap(roomId: string): Map<string, PlacedProps> {
  let m = roomPlaced.get(roomId);
  if (!m) {
    m = new Map();
    roomPlaced.set(roomId, m);
  }
  return m;
}

/** Tile keys that block floor movement (solid blocks; ramps are walkable). */
function blockingKeys(roomId: string): Set<string> {
  const m = roomPlaced.get(roomId);
  const s = new Set<string>();
  if (!m) return s;
  for (const [k, v] of m) {
    if (!v.passable && !v.ramp) s.add(k);
  }
  return s;
}

function inferStartLayer(
  p: PlayerState,
  placed: ReadonlyMap<string, PlacedProps>
): 0 | 1 {
  const t = snapToTile(p.x, p.z);
  const k = tileKey(t.x, t.z);
  const prop = placed.get(k);
  if (!prop) return 0;
  if (prop.passable || prop.ramp) return 0;
  const h = terrainObstacleHeight(prop);
  if (p.y >= h - 0.2) return 1;
  return 0;
}

function waypointY(
  layer: 0 | 1,
  gx: number,
  gz: number,
  placed: ReadonlyMap<string, PlacedProps>
): number {
  if (layer === 0) return 0;
  const p = placed.get(tileKey(gx, gz));
  if (!p || p.passable || p.ramp) return 0;
  return terrainObstacleHeight(p);
}

function obstaclesToList(roomId: string): ObstacleTile[] {
  const m = roomPlaced.get(roomId);
  if (!m) return [];
  const out: ObstacleTile[] = [];
  for (const [k, v] of m) {
    const [x, z] = k.split(",").map(Number);
    out.push({
      x: x!,
      z: z!,
      passable: v.passable,
      half: v.half ?? false,
      quarter: v.quarter ?? false,
      hex: v.hex ?? false,
      ramp: v.ramp ?? false,
      rampDir: Math.max(0, Math.min(3, Math.floor(v.rampDir ?? 0))),
      colorId: clampColorId(v.colorId ?? 0),
    });
  }
  return out;
}

function extraFloorSet(roomId: string): Set<string> {
  let s = roomExtraFloor.get(roomId);
  if (!s) {
    s = new Set();
    roomExtraFloor.set(roomId, s);
  }
  return s;
}

function extraFloorToList(roomId: string): ExtraFloorTile[] {
  const s = roomExtraFloor.get(roomId);
  if (!s) return [];
  const out: ExtraFloorTile[] = [];
  for (const k of s) {
    const [x, z] = k.split(",").map(Number);
    out.push({ x: x!, z: z! });
  }
  return out;
}

const ADJ_DIRS: readonly [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildInitialFrontier(roomId: string, ex: Set<string>): Set<string> {
  const b = getRoomBaseBounds(roomId);
  const frontier = new Set<string>();
  for (let x = b.minX - 1; x <= b.maxX + 1; x++) {
    for (let z = b.minZ - 1; z <= b.maxZ + 1; z++) {
      if (!inTileBounds(x, z)) continue;
      if (isBaseTile(x, z, roomId)) continue;
      if (ex.has(tileKey(x, z))) continue;
      if (canPlaceExtraFloor(roomId, x, z)) frontier.add(tileKey(x, z));
    }
  }
  return frontier;
}

function addNeighborsToFrontier(
  roomId: string,
  x: number,
  z: number,
  frontier: Set<string>,
  ex: Set<string>
): void {
  for (const [dx, dz] of ADJ_DIRS) {
    const nx = x + dx;
    const nz = z + dz;
    if (!inTileBounds(nx, nz)) continue;
    if (isBaseTile(nx, nz, roomId)) continue;
    if (ex.has(tileKey(nx, nz))) continue;
    if (canPlaceExtraFloor(roomId, nx, nz)) frontier.add(tileKey(nx, nz));
  }
}

const ADMIN_RANDOM_MAX_TILES = 5000;

/**
 * Grows extra walkable tiles by random frontier expansion (orthogonal connectivity to base).
 * Used by HTTP admin API; broadcasts `extraFloor` to connected clients.
 */
export function adminRandomExtraFloorLayout(
  roomId: string,
  opts: { targetCount: number; seed: number; clearExisting: boolean }
):
  | { ok: true; placed: number; totalExtra: number }
  | { ok: false; error: string } {
  const tc = Math.floor(Number(opts.targetCount));
  if (!Number.isFinite(tc) || tc < 1 || tc > ADMIN_RANDOM_MAX_TILES) {
    return { ok: false, error: "invalid_target_count" };
  }
  const seed = Math.floor(Number(opts.seed)) | 0;
  const ex = extraFloorSet(roomId);
  if (opts.clearExisting) {
    ex.clear();
  }
  const rng = mulberry32(seed);
  const frontier = buildInitialFrontier(roomId, ex);
  let placed = 0;
  while (placed < tc && frontier.size > 0) {
    const keys = [...frontier];
    const pick = keys[Math.floor(rng() * keys.length)]!;
    frontier.delete(pick);
    const [x, z] = pick.split(",").map(Number);
    ex.add(pick);
    addNeighborsToFrontier(roomId, x!, z!, frontier, ex);
    placed++;
  }
  const totalExtra = ex.size;
  broadcast(roomId, {
    type: "extraFloor",
    roomId,
    tiles: extraFloorToList(roomId),
  });
  schedulePersistWorldState();
  return { ok: true, placed, totalExtra };
}

function isWalkableForRoom(roomId: string, x: number, z: number): boolean {
  return isWalkableTile(x, z, extraFloorSet(roomId), roomId);
}

/** New extra tile must be outside the core grid and orthogonally adjacent to some walkable tile. */
function canPlaceExtraFloor(roomId: string, x: number, z: number): boolean {
  const ex = extraFloorSet(roomId);
  if (ex.has(tileKey(x, z))) return false;
  if (isBaseTile(x, z, roomId)) return false;
  for (const [dx, dz] of ADJ_DIRS) {
    if (isWalkableTile(x + dx, z + dz, ex, roomId)) return true;
  }
  return false;
}

function walkBounds(roomId: string): {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
} {
  const b = getRoomBaseBounds(roomId);
  let minX = b.minX;
  let maxX = b.maxX;
  let minZ = b.minZ;
  let maxZ = b.maxZ;
  const ex = roomExtraFloor.get(roomId);
  if (ex) {
    for (const k of ex) {
      const [x, z] = k.split(",").map(Number);
      minX = Math.min(minX, x!);
      maxX = Math.max(maxX, x!);
      minZ = Math.min(minZ, z!);
      maxZ = Math.max(maxZ, z!);
    }
  }
  return { minX, maxX, minZ, maxZ };
}

function spawnMap(roomId: string): Map<string, { x: number; z: number; y?: number }> {
  let m = lastSpawnByRoom.get(roomId);
  if (!m) {
    m = new Map();
    lastSpawnByRoom.set(roomId, m);
  }
  return m;
}

/** Feet height for avatar on this tile; aligns with pathfinding layer 0 / 1. */
function reconcileSpawnY(player: PlayerState, roomId: string): void {
  const placed = placedMap(roomId);
  const t = snapToTile(player.x, player.z);
  if (!isWalkableForRoom(roomId, t.x, t.z)) return;
  const prop = placed.get(tileKey(t.x, t.z));
  if (prop && !prop.passable && !prop.ramp) {
    const h = terrainObstacleHeight(prop);
    if (!Number.isFinite(player.y) || player.y < h - 0.2) {
      player.y = h;
    }
  }
  const layer = inferStartLayer(player, placed);
  player.y = waypointY(layer, t.x, t.z, placed);
}

function roomOf(roomId: string): Map<string, ClientConn> {
  let r = rooms.get(roomId);
  if (!r) {
    r = new Map();
    rooms.set(roomId, r);
  }
  return r;
}

function broadcast(roomId: string, msg: OutMsg, except?: string): void {
  const r = roomOf(roomId);
  const payload = JSON.stringify(msg);
  for (const [addr, c] of r) {
    if (except && addr === except) continue;
    if (c.ws.readyState === 1) c.ws.send(payload);
  }
}

function fakePlayersMap(roomId: string): Map<
  string,
  {
    player: PlayerState;
    pathQueue: { x: number; z: number }[];
    idleUntil: number;
  }
> {
  let m = roomFakePlayers.get(roomId);
  if (!m) {
    m = new Map();
    roomFakePlayers.set(roomId, m);
  }
  return m;
}

/** Synthetic id (for client identicons); not a real wallet. */
function fakePlayerAddress(roomId: string, index: number): string {
  const rid = normalizeRoomId(roomId).replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
  const r = (rid + "xxxxxxxx").slice(0, 8);
  const idx = String(index).padStart(2, "0");
  return `NQ07${r}${idx}FAKENPC000000000000`.slice(0, 36);
}

function pickRandomWalkableTile(
  roomId: string,
  rng: () => number
): { x: number; z: number } | null {
  const wb = walkBounds(roomId);
  for (let a = 0; a < 80; a++) {
    const x = Math.floor(wb.minX + rng() * (wb.maxX - wb.minX + 1));
    const z = Math.floor(wb.minZ + rng() * (wb.maxZ - wb.minZ + 1));
    if (isWalkableForRoom(roomId, x, z)) return { x, z };
  }
  for (let x = wb.minX; x <= wb.maxX; x++) {
    for (let z = wb.minZ; z <= wb.maxZ; z++) {
      if (isWalkableForRoom(roomId, x, z)) return { x, z };
    }
  }
  return null;
}

function ensureFakePlayers(roomId: string): void {
  if (FAKE_PLAYER_COUNT <= 0) return;
  const fakes = fakePlayersMap(roomId);
  const rng = mulberry32(
    normalizeRoomId(roomId).split("").reduce((s, ch) => s + ch.charCodeAt(0), 0) |
      fakes.size * 997
  );
  const usedGuestNames = new Set<string>();
  for (const { player } of fakes.values()) {
    usedGuestNames.add(npcDisplayNameBase(player.displayName));
  }
  let nextIndex = 0;
  while (fakes.size < FAKE_PLAYER_COUNT) {
    const address = fakePlayerAddress(roomId, nextIndex);
    nextIndex += 1;
    if (fakes.has(address)) continue;
    const spawn = pickRandomWalkableTile(roomId, rng);
    if (!spawn) break;
    const baseName = pickGuestDisplayName(rng, usedGuestNames);
    usedGuestNames.add(baseName);
    const displayName = formatNpcDisplayName(baseName);
    const player: PlayerState = {
      address,
      displayName,
      x: spawn.x,
      y: 0,
      z: spawn.z,
      vx: 0,
      vz: 0,
    };
    fakes.set(address, {
      player,
      pathQueue: [],
      idleUntil: Date.now() + Math.floor(rng() * FAKE_IDLE_MS),
    });
    broadcast(roomId, { type: "playerJoined", player: { ...player } });
  }
}

function clearFakePlayers(roomId: string): void {
  const fakes = roomFakePlayers.get(roomId);
  if (!fakes || fakes.size === 0) return;
  for (const address of fakes.keys()) {
    broadcast(roomId, { type: "playerLeft", address });
  }
  roomFakePlayers.delete(roomId);
}

function advanceAlongPathBot(
  roomId: string,
  p: PlayerState,
  pathQueue: { x: number; z: number }[],
  dt: number
): boolean {
  let changedThis = false;
  while (true) {
    if (pathQueue.length === 0) {
      p.vx = 0;
      p.vz = 0;
      p.y = 0;
      break;
    }
    const goal = pathQueue[0]!;
    const dx = goal.x - p.x;
    const dz = goal.z - p.z;
    const dist = Math.hypot(dx, dz);
    if (dist < ARRIVE_EPS) {
      p.x = goal.x;
      p.z = goal.z;
      p.y = 0;
      p.vx = 0;
      p.vz = 0;
      pathQueue.shift();
      changedThis = true;
      continue;
    }
    const step = NPC_MOVE_SPEED * dt;
    const t = Math.min(1, step / dist);
    const wb = walkBounds(roomId);
    const nx = clamp(p.x + dx * t, wb.minX, wb.maxX);
    const nz = clamp(p.z + dz * t, wb.minZ, wb.maxZ);
    p.vx = (dx / dist) * NPC_MOVE_SPEED;
    p.vz = (dz / dist) * NPC_MOVE_SPEED;
    p.x = nx;
    p.z = nz;
    p.y = 0;
    changedThis = true;
    break;
  }
  return changedThis;
}

function advanceAlongPathHuman(
  roomId: string,
  p: PlayerState,
  pathQueue: { x: number; z: number; layer: 0 | 1 }[],
  dt: number,
  placed: ReadonlyMap<string, PlacedProps>
): boolean {
  let changedThis = false;
  while (true) {
    if (pathQueue.length === 0) {
      p.vx = 0;
      p.vz = 0;
      break;
    }
    const goal = pathQueue[0]!;
    const gy = waypointY(goal.layer, goal.x, goal.z, placed);
    const dx = goal.x - p.x;
    const dy = gy - p.y;
    const dz = goal.z - p.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < ARRIVE_EPS) {
      p.x = goal.x;
      p.z = goal.z;
      p.y = gy;
      p.vx = 0;
      p.vz = 0;
      pathQueue.shift();
      changedThis = true;
      continue;
    }
    const step = MOVE_SPEED * dt;
    const t = Math.min(1, step / dist);
    const wb = walkBounds(roomId);
    const nx = clamp(p.x + dx * t, wb.minX, wb.maxX);
    const ny = p.y + dy * t;
    const nz = clamp(p.z + dz * t, wb.minZ, wb.maxZ);
    p.vx = (dx / dist) * MOVE_SPEED;
    p.vz = (dz / dist) * MOVE_SPEED;
    p.x = nx;
    p.y = ny;
    p.z = nz;
    changedThis = true;
    break;
  }
  return changedThis;
}

function snapshotPlayers(roomId: string): PlayerState[] {
  const humans = [...roomOf(roomId).values()].map((c) => ({ ...c.player }));
  const fakes = roomFakePlayers.get(roomId);
  if (!fakes?.size) return humans;
  for (const { player } of fakes.values()) {
    humans.push({ ...player });
  }
  return humans;
}

export function startRoomTick(): void {
  setInterval(() => {
    const now = Date.now();
    for (const [roomId, room] of rooms) {
      const dt = TICK_MS / 1000;
      let changed = false;
      const placed = placedMap(roomId);
      for (const c of room.values()) {
        const changedThis = advanceAlongPathHuman(
          roomId,
          c.player,
          c.pathQueue,
          dt,
          placed
        );
        if (changedThis) changed = true;
      }
      const fakes = roomFakePlayers.get(roomId);
      if (fakes?.size) {
        const blocked = blockingKeys(roomId);
        const extra = extraFloorSet(roomId);
        const rng = mulberry32((now ^ roomId.length) | 0);
        for (const bot of fakes.values()) {
          const changedMove = advanceAlongPathBot(
            roomId,
            bot.player,
            bot.pathQueue,
            dt
          );
          if (changedMove) changed = true;
          const p = bot.player;
          if (bot.pathQueue.length === 0 && p.vx === 0 && p.vz === 0) {
            if (bot.idleUntil === 0) {
              bot.idleUntil = now + FAKE_IDLE_MS;
            } else if (now >= bot.idleUntil) {
              const dest = pickRandomWalkableTile(roomId, rng);
              if (dest) {
                const start = snapToTile(p.x, p.z);
                const full = pathfindTiles(
                  start.x,
                  start.z,
                  dest.x,
                  dest.z,
                  blocked,
                  extra,
                  roomId
                );
                if (full && full.length > 1) {
                  bot.pathQueue = full.slice(1, 1 + FAKE_PATH_MAX_STEPS);
                  bot.idleUntil = 0;
                } else {
                  bot.idleUntil = now + FAKE_IDLE_MS;
                }
              } else {
                bot.idleUntil = now + FAKE_IDLE_MS;
              }
            }
          }
        }
      }
      if (changed && room.size > 0) {
        broadcast(roomId, { type: "state", players: snapshotPlayers(roomId) });
      }
    }
  }, TICK_MS);
}

export function addClient(
  roomIdRaw: string,
  ws: WebSocket,
  address: string,
  spawnHint?: { x: number; z: number }
): void {
  const roomId = normalizeRoomId(roomIdRaw);
  ensureFakePlayers(roomId);
  const room = roomOf(roomId);
  const displayName = walletDisplayName(address);

  const player: PlayerState = {
    address,
    displayName,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vz: 0,
  };

  let placedSpawn = false;
  let resolvedSpawnTile = false;
  if (
    spawnHint &&
    Number.isFinite(spawnHint.x) &&
    Number.isFinite(spawnHint.z)
  ) {
    const t = snapToTile(spawnHint.x, spawnHint.z);
    if (isWalkableForRoom(roomId, t.x, t.z)) {
      player.x = t.x;
      player.z = t.z;
      placedSpawn = true;
      resolvedSpawnTile = true;
    }
  }
  if (!placedSpawn) {
    const saved = spawnMap(roomId).get(address);
    if (saved) {
      const t = snapToTile(saved.x, saved.z);
      if (isWalkableForRoom(roomId, t.x, t.z)) {
        player.x = t.x;
        player.z = t.z;
        if (typeof saved.y === "number" && Number.isFinite(saved.y)) {
          player.y = saved.y;
        }
        resolvedSpawnTile = true;
      }
    }
  }

  if (resolvedSpawnTile) {
    reconcileSpawnY(player, roomId);
  }

  const { sessionId, startedAt: sessionStartedAt } = beginSession(
    address,
    roomId
  );
  const conn: ClientConn = {
    ws,
    address,
    displayName,
    sessionId,
    sessionStartedAt,
    lastMoveToAt: 0,
    lastChatAt: 0,
    lastPlaceAt: 0,
    player,
    pathQueue: [],
  };

  room.set(address, conn);

  const others = snapshotPlayers(roomId).filter((p) => p.address !== address);

  const rb = getRoomBaseBounds(roomId);
  const doors = getDoorsForRoom(roomId).map((d) => ({
    x: d.x,
    z: d.z,
    targetRoomId: normalizeRoomId(d.targetRoomId),
    spawnX: d.spawnX,
    spawnZ: d.spawnZ,
  }));

  ws.send(
    JSON.stringify({
      type: "welcome",
      self: player,
      others,
      roomId,
      roomBounds: rb,
      doors,
      placeRadiusBlocks: PLACE_RADIUS_BLOCKS,
      obstacles: obstaclesToList(roomId),
      extraFloorTiles: extraFloorToList(roomId),
    } satisfies OutMsg)
  );

  broadcast(
    roomId,
    { type: "playerJoined", player: { ...player } },
    address
  );

  ws.on("message", (raw) => {
    let data: unknown;
    try {
      data = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (!data || typeof data !== "object") return;
    const msg = data as Record<string, unknown>;

    if (msg.type === "moveTo") {
      const now = Date.now();
      if (now - conn.lastMoveToAt < RATE_MOVE_TO_MS) return;
      conn.lastMoveToAt = now;
      const tx = Number(msg.x);
      const tz = Number(msg.z);
      if (!Number.isFinite(tx) || !Number.isFinite(tz)) return;
      const dest = snapToTile(tx, tz);
      const p = conn.player;
      const start = snapToTile(p.x, p.z);
      const placed = placedMap(roomId);
      const extra = extraFloorSet(roomId);
      const startLayer = inferStartLayer(p, placed);
      const gl = msg.layer;
      const goalLayer: 0 | 1 =
        gl === 1 || gl === "1" ? 1 : 0;
      const full = pathfindTerrain(
        start.x,
        start.z,
        startLayer,
        dest.x,
        dest.z,
        goalLayer,
        placed,
        extra,
        roomId
      );
      if (!full || full.length === 0) {
        conn.pathQueue = [];
        return;
      }
      conn.pathQueue = full.slice(1);
      logGameplayEvent(conn.sessionId, address, roomId, "move_to", {
        fromX: start.x,
        fromZ: start.z,
        toX: dest.x,
        toZ: dest.z,
        goalLayer,
      });
      return;
    }

    if (msg.type === "placeBlock") {
      const now = Date.now();
      if (now - conn.lastPlaceAt < RATE_PLACE_MS) return;
      conn.lastPlaceAt = now;
      const tx = Number(msg.x);
      const tz = Number(msg.z);
      if (!Number.isFinite(tx) || !Number.isFinite(tz)) return;
      const tile = snapToTile(tx, tz);
      const k = tileKey(tile.x, tile.z);
      if (!withinBlockActionRange(conn.player, tile.x, tile.z)) return;
      if (!isWalkableForRoom(roomId, tile.x, tile.z)) return;
      const placed = placedMap(roomId);
      if (placed.has(k)) return;
      for (const c of room.values()) {
        const st = snapToTile(c.player.x, c.player.z);
        if (st.x === tile.x && st.z === tile.z) return;
      }
      const quarter = Boolean(msg.quarter);
      let half = Boolean(msg.half);
      if (quarter) half = false;
      const ramp = Boolean(msg.ramp);
      const rampDir = Math.max(0, Math.min(3, Math.floor(Number(msg.rampDir ?? 0))));
      let hex = Boolean(msg.hex);
      if (ramp) hex = false;
      const colorId = clampColorId(Number(msg.colorId ?? 0));
      placed.set(k, {
        passable: false,
        half,
        quarter,
        hex,
        ramp,
        rampDir: ramp ? rampDir : 0,
        colorId,
      });
      broadcast(roomId, {
        type: "obstacles",
        roomId,
        tiles: obstaclesToList(roomId),
      });
      schedulePersistWorldState();
      logGameplayEvent(conn.sessionId, address, roomId, "place_block", {
        x: tile.x,
        z: tile.z,
        half,
        quarter,
        hex,
        ramp,
        rampDir: ramp ? rampDir : 0,
        colorId,
      });
      return;
    }

    if (msg.type === "setObstacleProps") {
      const now = Date.now();
      if (now - conn.lastPlaceAt < RATE_PLACE_MS) return;
      conn.lastPlaceAt = now;
      const tx = Number(msg.x);
      const tz = Number(msg.z);
      const passable = Boolean(msg.passable);
      const quarter = Boolean(msg.quarter);
      let half = Boolean(msg.half);
      if (quarter) half = false;
      const ramp = Boolean(msg.ramp);
      const rampDir = Math.max(0, Math.min(3, Math.floor(Number(msg.rampDir ?? 0))));
      let hex = Boolean(msg.hex);
      if (ramp) hex = false;
      const colorId = clampColorId(Number(msg.colorId ?? 0));
      if (!Number.isFinite(tx) || !Number.isFinite(tz)) return;
      const tile = snapToTile(tx, tz);
      const k = tileKey(tile.x, tile.z);
      if (!withinBlockActionRange(conn.player, tile.x, tile.z)) return;
      const placed = placedMap(roomId);
      if (!placed.has(k)) return;
      placed.set(k, {
        passable,
        half,
        quarter,
        hex,
        ramp,
        rampDir: ramp ? rampDir : 0,
        colorId,
      });
      broadcast(roomId, {
        type: "obstacles",
        roomId,
        tiles: obstaclesToList(roomId),
      });
      schedulePersistWorldState();
      logGameplayEvent(conn.sessionId, address, roomId, "set_obstacle_props", {
        x: tile.x,
        z: tile.z,
        passable,
        half,
        quarter,
        hex,
        ramp,
        rampDir: ramp ? rampDir : 0,
        colorId,
      });
      return;
    }

    if (msg.type === "removeObstacle") {
      const now = Date.now();
      if (now - conn.lastPlaceAt < RATE_PLACE_MS) return;
      conn.lastPlaceAt = now;
      const tx = Number(msg.x);
      const tz = Number(msg.z);
      if (!Number.isFinite(tx) || !Number.isFinite(tz)) return;
      const tile = snapToTile(tx, tz);
      const k = tileKey(tile.x, tile.z);
      if (!withinBlockActionRange(conn.player, tile.x, tile.z)) return;
      const placed = placedMap(roomId);
      if (!placed.delete(k)) return;
      broadcast(roomId, {
        type: "obstacles",
        roomId,
        tiles: obstaclesToList(roomId),
      });
      schedulePersistWorldState();
      /* Replay log: we only record tile coords. For richer replay / inference (e.g. undo,
         material audits), consider logging the obstacle props that existed immediately before
         delete (passable, half, quarter, hex, ramp, rampDir, colorId). */
      logGameplayEvent(conn.sessionId, address, roomId, "remove_obstacle", {
        x: tile.x,
        z: tile.z,
      });
      return;
    }

    if (msg.type === "moveObstacle") {
      const now = Date.now();
      if (now - conn.lastPlaceAt < RATE_PLACE_MS) return;
      conn.lastPlaceAt = now;
      const fx = Number(msg.fromX);
      const fz = Number(msg.fromZ);
      const tx = Number(msg.toX);
      const tz = Number(msg.toZ);
      if (
        !Number.isFinite(fx) ||
        !Number.isFinite(fz) ||
        !Number.isFinite(tx) ||
        !Number.isFinite(tz)
      ) {
        return;
      }
      const from = snapToTile(fx, fz);
      const to = snapToTile(tx, tz);
      const fk = tileKey(from.x, from.z);
      const tk = tileKey(to.x, to.z);
      if (fk === tk) return;
      if (
        !withinBlockActionRange(conn.player, from.x, from.z) ||
        !withinBlockActionRange(conn.player, to.x, to.z)
      ) {
        return;
      }
      const placed = placedMap(roomId);
      const props = placed.get(fk);
      if (!props) return;
      if (placed.has(tk)) return;
      if (!isWalkableForRoom(roomId, to.x, to.z)) return;
      if (
        normalizeRoomId(roomId) === HUB_ROOM_ID &&
        isHubSpawnSafeZone(to.x, to.z)
      ) {
        return;
      }
      for (const c of room.values()) {
        const st = snapToTile(c.player.x, c.player.z);
        if (st.x === to.x && st.z === to.z) return;
      }
      placed.delete(fk);
      placed.set(tk, { ...props });
      broadcast(roomId, {
        type: "obstacles",
        roomId,
        tiles: obstaclesToList(roomId),
      });
      schedulePersistWorldState();
      logGameplayEvent(conn.sessionId, address, roomId, "move_obstacle", {
        fromX: from.x,
        fromZ: from.z,
        toX: to.x,
        toZ: to.z,
      });
      return;
    }

    if (msg.type === "placeExtraFloor") {
      const now = Date.now();
      if (now - conn.lastPlaceAt < RATE_PLACE_MS) return;
      conn.lastPlaceAt = now;
      const tx = Number(msg.x);
      const tz = Number(msg.z);
      if (!Number.isFinite(tx) || !Number.isFinite(tz)) return;
      const tile = snapToTile(tx, tz);
      if (!canPlaceExtraFloor(roomId, tile.x, tile.z)) return;
      for (const c of room.values()) {
        const st = snapToTile(c.player.x, c.player.z);
        if (st.x === tile.x && st.z === tile.z) return;
      }
      extraFloorSet(roomId).add(tileKey(tile.x, tile.z));
      broadcast(roomId, {
        type: "extraFloor",
        roomId,
        tiles: extraFloorToList(roomId),
      });
      schedulePersistWorldState();
      logGameplayEvent(conn.sessionId, address, roomId, "place_extra_floor", {
        x: tile.x,
        z: tile.z,
      });
      return;
    }

    if (msg.type === "removeExtraFloor") {
      const now = Date.now();
      if (now - conn.lastPlaceAt < RATE_PLACE_MS) return;
      conn.lastPlaceAt = now;
      const tx = Number(msg.x);
      const tz = Number(msg.z);
      if (!Number.isFinite(tx) || !Number.isFinite(tz)) return;
      const tile = snapToTile(tx, tz);
      const k = tileKey(tile.x, tile.z);
      const ex = extraFloorSet(roomId);
      if (!ex.has(k)) return;
      if (isBaseTile(tile.x, tile.z, roomId)) return;
      const placed = placedMap(roomId);
      if (placed.has(k)) return;
      for (const c of room.values()) {
        const st = snapToTile(c.player.x, c.player.z);
        if (st.x === tile.x && st.z === tile.z) return;
      }
      ex.delete(k);
      broadcast(roomId, {
        type: "extraFloor",
        roomId,
        tiles: extraFloorToList(roomId),
      });
      schedulePersistWorldState();
      logGameplayEvent(conn.sessionId, address, roomId, "remove_extra_floor", {
        x: tile.x,
        z: tile.z,
      });
      return;
    }

    if (msg.type === "chat") {
      const now = Date.now();
      if (now - conn.lastChatAt < RATE_CHAT_MS) return;
      conn.lastChatAt = now;
      let text = String(msg.text ?? "").slice(0, CHAT_MAX);
      text = text.replace(/[\u0000-\u001F\u007F]/g, "").trim();
      if (!text) return;
      broadcast(roomId, {
        type: "chat",
        from: displayName,
        fromAddress: address,
        text,
        at: now,
      });
      logGameplayEvent(conn.sessionId, address, roomId, "chat", {
        text,
      });
    }
  });

  ws.on("close", () => {
    endSession(conn.sessionId, address, roomId, conn.sessionStartedAt);
    spawnMap(roomId).set(address, {
      x: conn.player.x,
      z: conn.player.z,
      y: conn.player.y,
    });
    schedulePersistWorldState();
    room.delete(address);
    broadcast(roomId, { type: "playerLeft", address });
    if (room.size === 0) clearFakePlayers(roomId);
  });
}
