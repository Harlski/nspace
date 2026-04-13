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
import { generateMaze } from "./mazeGenerator.js";
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
import {
  claimTile,
  getClaimsInBounds,
  loadCanvasClaims,
  clearAllClaims,
} from "./canvasCanvas.js";
import { CANVAS_ROOM_ID } from "./roomLayouts.js";
import {
  createSignboard,
  deleteSignboard,
  getSignboardAt,
  getSignboardsForRoom,
  loadSignboards,
  updateSignboard,
  updateSignboardPosition,
} from "./signboards.js";
import { isAdmin } from "./config.js";

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

/** NPC chat messages - randomly displayed as bubbles only */
const NPC_MESSAGES = [
  "Thanks for playing Nimiq Space!",
  "Find us on Telegram and let us know what you think!",
  "Check out twitch.tv/nimiqlive - to earn NIM!",
];

/** Min/max time (ms) between NPC chat messages */
const NPC_CHAT_MIN_INTERVAL = 30_000; // 30 seconds
const NPC_CHAT_MAX_INTERVAL = 90_000; // 90 seconds

function getRandomNpcMessage(rng: () => number): string {
  return NPC_MESSAGES[Math.floor(rng() * NPC_MESSAGES.length)]!;
}

function getRandomNpcChatDelay(rng: () => number): number {
  return NPC_CHAT_MIN_INTERVAL + rng() * (NPC_CHAT_MAX_INTERVAL - NPC_CHAT_MIN_INTERVAL);
}

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
  /** Optional signboard ID if there's a signboard at this location. */
  signboardId?: string;
  /** Whether this obstacle is locked (admin-only editing). */
  locked?: boolean;
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
      canvasClaims?: Array<{ x: number; z: number; address: string }>;
      signboards: Array<{
        id: string;
        x: number;
        z: number;
        message: string;
        createdBy: string;
        createdAt: number;
      }>;
    }
  | { type: "playerJoined"; player: PlayerState }
  | { type: "playerLeft"; address: string }
  | { type: "state"; players: PlayerState[] }
  | { type: "obstacles"; roomId: string; tiles: ObstacleTile[] }
  | { type: "extraFloor"; roomId: string; tiles: ExtraFloorTile[] }
  | { type: "canvasClaim"; x: number; z: number; address: string }
  | { type: "canvasTimer"; timeRemaining: number }
  | {
      type: "signboards";
      roomId: string;
      signboards: Array<{
        id: string;
        x: number;
        z: number;
        message: string;
        createdBy: string;
        createdAt: number;
      }>;
    }
  | {
      type: "chat";
      from: string;
      fromAddress: string;
      text: string;
      at: number;
      bubbleOnly?: boolean; // If true, only show as bubble, not in chat log
    }
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
      /** Next time (ms) to say a random message. */
      nextChatTime: number;
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

// Initialize canvas room with maze layout
function generateCanvasMaze(): void {
  const canvasId = normalizeRoomId(CANVAS_ROOM_ID);
  const bounds = getRoomBaseBounds(canvasId);
  
  // Spawn point where players enter
  const spawnX = 0;
  const spawnZ = 14;
  
  // Pick a random exit portal location far from spawn
  // Generate random coordinates in the maze bounds, ensuring distance from spawn
  const minDistance = 15; // Minimum distance from spawn to ensure challenge
  let exitX: number;
  let exitZ: number;
  let attempts = 0;
  
  do {
    exitX = Math.floor(bounds.minX + Math.random() * (bounds.maxX - bounds.minX + 1));
    exitZ = Math.floor(bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ + 1));
    const distance = Math.sqrt((exitX - spawnX) ** 2 + (exitZ - spawnZ) ** 2);
    if (distance >= minDistance) break;
    attempts++;
  } while (attempts < 100); // Failsafe to prevent infinite loop
  
  // Fallback to far corner if we couldn't find a good spot
  if (attempts >= 100) {
    exitX = -14;
    exitZ = -14;
  }

  console.log(`[canvas] Generating maze from spawn (${spawnX}, ${spawnZ}) to exit portal (${exitX}, ${exitZ})`);

  // Generate maze with a random seed for variety each round
  const seed = Math.floor(Math.random() * 1000000);
  const walls = generateMaze(
    bounds.minX,
    bounds.maxX,
    bounds.minZ,
    bounds.maxZ,
    spawnX,
    spawnZ,
    exitX,
    exitZ,
    seed
  );

  // Get or create placed map for canvas room
  let placed = roomPlaced.get(canvasId);
  if (!placed) {
    placed = new Map();
    roomPlaced.set(canvasId, placed);
  }

  // Clear existing maze walls and portal (keep only non-maze blocks)
  const keysToRemove: string[] = [];
  for (const [key, props] of placed) {
    // Remove locked blocks (maze walls and portal from previous round)
    if (props.locked) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) {
    placed.delete(key);
  }

  // Place new maze walls
  for (const wallKey of walls) {
    placed.set(wallKey, {
      passable: false,
      half: false,
      quarter: false,
      hex: false,
      ramp: false,
      rampDir: 0,
      colorId: 5, // Purple color for maze walls
      locked: true, // Lock maze walls so they can't be edited
    });
  }

  // Always place a visible portal/teleport at the exit
  const exitKey = tileKey(exitX, exitZ);
  placed.set(exitKey, {
    passable: true, // Players can walk through it
    half: false,
    quarter: true, // Make it a quarter-height platform
    hex: true, // Hexagonal shape for visual distinction
    ramp: false,
    rampDir: 0,
    colorId: 4, // Blue color for exit portal
    locked: true, // Lock so players can't edit it
  });
  
  // Broadcast the new maze to all players in canvas room
  const obstaclesList = Array.from(placed.entries()).map(([k, v]) => {
    const [x, z] = k.split(",").map(Number);
    return { x: x!, z: z!, ...v };
  });
  
  broadcast(CANVAS_ROOM_ID, {
    type: "obstacles",
    roomId: canvasId,
    tiles: obstaclesList,
  });

  console.log(`[canvas] New maze generated with ${walls.size} wall blocks and exit portal at (${exitX}, ${exitZ}), seed: ${seed}`);
}

// Initialize maze on server startup
generateCanvasMaze();

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
  const signboards = getSignboardsForRoom(roomId);
  const signboardMap = new Map(signboards.map((s) => [tileKey(s.x, s.z), s.id]));
  
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
      signboardId: signboardMap.get(k),
      locked: v.locked ?? false,
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

/** Find which room a player is currently in */
function findPlayerRoom(address: string): string | null {
  for (const [roomId, room] of rooms) {
    if (room.has(address)) {
      return roomId;
    }
  }
  return null;
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
    nextChatTime: number;
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
      nextChatTime: Date.now() + getRandomNpcChatDelay(rng),
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
): { changed: boolean; arrivedTiles: Array<{ x: number; z: number }> } {
  let changedThis = false;
  const arrivedTiles: Array<{ x: number; z: number }> = [];
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
      const prevTile = snapToTile(p.x, p.z);
      p.x = goal.x;
      p.z = goal.z;
      p.y = gy;
      p.vx = 0;
      p.vz = 0;
      pathQueue.shift();
      changedThis = true;
      const newTile = snapToTile(p.x, p.z);
      if (prevTile.x !== newTile.x || prevTile.z !== newTile.z) {
        arrivedTiles.push({ x: newTile.x, z: newTile.z });
      }
      continue;
    }
    const step = MOVE_SPEED * dt;
    const t = Math.min(1, step / dist);
    const wb = walkBounds(roomId);
    const prevTile = snapToTile(p.x, p.z);
    const nx = clamp(p.x + dx * t, wb.minX, wb.maxX);
    const ny = p.y + dy * t;
    const nz = clamp(p.z + dz * t, wb.minZ, wb.maxZ);
    p.vx = (dx / dist) * MOVE_SPEED;
    p.vz = (dz / dist) * MOVE_SPEED;
    p.x = nx;
    p.y = ny;
    p.z = nz;
    changedThis = true;
    const newTile = snapToTile(p.x, p.z);
    if (prevTile.x !== newTile.x || prevTile.z !== newTile.z) {
      arrivedTiles.push({ x: newTile.x, z: newTile.z });
    }
    break;
  }
  return { changed: changedThis, arrivedTiles };
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

/** Canvas room timer (in milliseconds) - 1 minute */
const CANVAS_TIMER_DURATION_MS = 1 * 60 * 1000;
/** Cooldown period between rounds (in milliseconds) - 10 seconds */
const CANVAS_COOLDOWN_MS = 10 * 1000;
/** Canvas room timer state */
let canvasTimerEndTime = 0;
let canvasTimerActive = false;
/** Canvas room cooldown state */
let canvasCooldownEndTime = 0;
let canvasCooldownActive = false;
/** Track steps taken by each player in canvas room */
const canvasPlayerSteps = new Map<string, number>();
/** Track players who have finished the maze, in order */
const canvasFinishers: Array<{ address: string; displayName: string; timestamp: number }> = [];

function startCanvasTimer(): void {
  canvasTimerEndTime = Date.now() + CANVAS_TIMER_DURATION_MS;
  canvasTimerActive = true;
  canvasCooldownActive = false; // Clear any cooldown when round starts
  canvasPlayerSteps.clear();
  canvasFinishers.length = 0; // Clear finishers for new round
  console.log(`[canvas] Timer started, ends at ${new Date(canvasTimerEndTime).toISOString()}`);
  
  // Announce round start to all players in canvas room
  broadcast(CANVAS_ROOM_ID, {
    type: "chat",
    from: "System",
    fromAddress: "",
    text: `🏁 Maze round started! 1 minute on the clock - find the blue portal!`,
    at: Date.now(),
  });
  
  // Broadcast timer start to all players in canvas room
  broadcast(CANVAS_ROOM_ID, {
    type: "canvasTimer",
    timeRemaining: CANVAS_TIMER_DURATION_MS,
  });
}

function startCanvasCooldown(): void {
  canvasCooldownEndTime = Date.now() + CANVAS_COOLDOWN_MS;
  canvasCooldownActive = true;
  console.log(`[canvas] Cooldown started, ends at ${new Date(canvasCooldownEndTime).toISOString()}`);
  
  // Broadcast cooldown to hub/lobby
  broadcast(HUB_ROOM_ID, {
    type: "chat",
    from: "System",
    fromAddress: "",
    text: `The Maze on cooldown for ${CANVAS_COOLDOWN_MS / 1000} seconds...`,
    at: Date.now(),
  });
}

function checkCanvasTimer(): void {
  if (!canvasTimerActive) return;
  
  const now = Date.now();
  const timeRemaining = canvasTimerEndTime - now;
  
  if (timeRemaining <= 0) {
    // Timer expired - end the round
    endCanvasRound();
  }
}

function checkCanvasCooldown(): void {
  if (!canvasCooldownActive) return;
  
  const now = Date.now();
  if (now >= canvasCooldownEndTime) {
    canvasCooldownActive = false;
    console.log(`[canvas] Cooldown ended, clearing old claims and generating new maze`);
    
    // Clear all canvas claims before opening the maze for the new round
    clearAllClaims();
    
    // Broadcast the cleared canvas to all players
    broadcast(CANVAS_ROOM_ID, {
      type: "canvasClaim",
      x: -1,
      z: -1,
      address: "",
    });
    broadcast(HUB_ROOM_ID, {
      type: "canvasClaim",
      x: -1,
      z: -1,
      address: "",
    });
    
    // Generate a new maze for the next round
    generateCanvasMaze();
    
    // Announce canvas is ready
    broadcast(HUB_ROOM_ID, {
      type: "chat",
      from: "System",
      fromAddress: "",
      text: `The Maze is now open! 🎮`,
      at: Date.now(),
    });
  }
}

function endCanvasRound(): void {
  canvasTimerActive = false;
  console.log(`[canvas] Round ended`);
  
  // Get canvas room
  const canvasRoom = rooms.get(CANVAS_ROOM_ID);
  if (!canvasRoom) return;
  
  // If there are finishers, announce the winner (first to finish)
  if (canvasFinishers.length > 0) {
    const winner = canvasFinishers[0];
    if (winner) {
      const message = `Time's up! ${winner.displayName} won by finishing first! Returning to hub...`;
      
      // Broadcast to canvas room
      broadcast(CANVAS_ROOM_ID, {
        type: "chat",
        from: "System",
        fromAddress: "",
        text: message,
        at: Date.now(),
      });
      
      // Announce overall winner in hub
      broadcast(HUB_ROOM_ID, {
        type: "chat",
        from: winner.displayName,
        fromAddress: winner.address,
        text: `won The Maze challenge! 🏆`,
        at: Date.now(),
      });
    }
  } else {
    // No one finished, announce player with most steps
    let topPlayer = "";
    let maxSteps = 0;
    for (const [address, steps] of canvasPlayerSteps) {
      if (steps > maxSteps) {
        maxSteps = steps;
        topPlayer = address;
      }
    }
    
    if (topPlayer) {
      const playerName = canvasRoom.get(topPlayer)?.player.displayName || walletDisplayName(topPlayer);
      const message = `Time's up! ${playerName} explored the most with ${maxSteps} steps! Returning to hub...`;
      
      broadcast(CANVAS_ROOM_ID, {
        type: "chat",
        from: "System",
        fromAddress: "",
        text: message,
        at: Date.now(),
      });
    } else {
      broadcast(CANVAS_ROOM_ID, {
        type: "chat",
        from: "System",
        fromAddress: "",
        text: "Time's up! Returning to hub...",
        at: Date.now(),
      });
    }
  }
  
  // Teleport all remaining players to hub after short delay
  setTimeout(() => {
    const playersToTeleport = Array.from(canvasRoom.values());
    for (const conn of playersToTeleport) {
      teleportPlayer(conn, HUB_ROOM_ID, 0, 0);
    }
    
    // Reset for next round
    canvasPlayerSteps.clear();
    canvasFinishers.length = 0;
    
    // Start cooldown period
    startCanvasCooldown();
  }, 2000);
}

function teleportPlayer(conn: ClientConn, targetRoomId: string, x: number, z: number): void {
  const address = conn.player.address;
  
  // Find and remove from current room
  for (const [roomId, room] of rooms) {
    if (room.has(address)) {
      room.delete(address);
      broadcast(roomId, { type: "playerLeft", address }, address);
      break;
    }
  }
  
  // Update player position
  conn.player.x = x;
  conn.player.z = z;
  conn.player.y = 0;
  conn.pathQueue = [];
  
  // Add to new room
  let targetRoom = rooms.get(targetRoomId);
  if (!targetRoom) {
    targetRoom = new Map();
    rooms.set(targetRoomId, targetRoom);
  }
  targetRoom.set(address, conn);
  
  // Send welcome message for new room
  const targetRoomConns = roomOf(targetRoomId);
  const others = [...targetRoomConns.values()]
    .filter((c) => c.address !== address)
    .map((c) => ({ ...c.player }));
  const rb = getRoomBaseBounds(targetRoomId);
  const doors = getDoorsForRoom(targetRoomId).map((d) => ({
    x: d.x,
    z: d.z,
    targetRoomId: normalizeRoomId(d.targetRoomId),
    spawnX: d.spawnX,
    spawnZ: d.spawnZ,
  }));
  
  const signboards = getSignboardsForRoom(targetRoomId).map((s) => ({
    id: s.id,
    x: s.x,
    z: s.z,
    message: s.message,
    createdBy: s.createdBy,
    createdAt: s.createdAt,
  }));
  
  const isCanvas = normalizeRoomId(targetRoomId) === CANVAS_ROOM_ID;
  
  conn.ws.send(
    JSON.stringify({
      type: "welcome",
      self: conn.player,
      others,
      roomId: targetRoomId,
      roomBounds: rb,
      doors,
      placeRadiusBlocks: PLACE_RADIUS_BLOCKS,
      obstacles: obstaclesToList(targetRoomId),
      extraFloorTiles: extraFloorToList(targetRoomId),
      canvasClaims: isCanvas ? getClaimsInBounds(rb.minX, rb.maxX, rb.minZ, rb.maxZ) : undefined,
      signboards,
    } satisfies OutMsg)
  );
  
  // Notify others in new room
  broadcast(targetRoomId, { type: "playerJoined", player: { ...conn.player } }, address);
}

export function startRoomTick(): void {
  loadCanvasClaims();
  loadSignboards();
  setInterval(() => {
    const now = Date.now();
    
    // Check canvas timer
    checkCanvasTimer();
    
    // Check canvas cooldown
    checkCanvasCooldown();
    
    for (const [roomId, room] of rooms) {
      const dt = TICK_MS / 1000;
      let changed = false;
      const placed = placedMap(roomId);
      const isCanvas = normalizeRoomId(roomId) === CANVAS_ROOM_ID;
      for (const c of room.values()) {
        const result = advanceAlongPathHuman(
          roomId,
          c.player,
          c.pathQueue,
          dt,
          placed
        );
        if (result.changed) changed = true;
        
        // Canvas room: claim tiles as player moves
        if (isCanvas && result.arrivedTiles && result.arrivedTiles.length > 0) {
          // Start timer on first player movement if not already started
          if (!canvasTimerActive && room.size > 0) {
            startCanvasTimer();
          }
          
          for (const tile of result.arrivedTiles) {
            // Check if player reached the exit portal (blue hexagonal quarter block)
            const tileKey_str = tileKey(tile.x, tile.z);
            const tileProps = placed.get(tileKey_str);
            const isExitPortal = tileProps && 
                                 tileProps.passable && 
                                 tileProps.quarter && 
                                 tileProps.hex && 
                                 tileProps.colorId === 4 && 
                                 tileProps.locked;
            
            if (isExitPortal) {
              console.log(`[canvas] Player ${c.address.slice(0, 8)}... reached exit portal (${tile.x}, ${tile.z})`);
              
              // Check if player hasn't already finished
              const alreadyFinished = canvasFinishers.some(f => f.address === c.address);
              if (!alreadyFinished) {
                const position = canvasFinishers.length + 1;
                const displayName = c.displayName || walletDisplayName(c.address);
                canvasFinishers.push({
                  address: c.address,
                  displayName,
                  timestamp: Date.now()
                });
                
                // Get position suffix (1st, 2nd, 3rd, etc.)
                const suffix = position === 1 ? "st" : position === 2 ? "nd" : position === 3 ? "rd" : "th";
                
                // Announce in canvas room
                broadcast(CANVAS_ROOM_ID, {
                  type: "chat",
                  from: "System",
                  fromAddress: "",
                  text: `${displayName} finished The Maze in ${position}${suffix} place!`,
                  at: Date.now(),
                });
                
                // Announce in hub/lobby with identicon
                broadcast(HUB_ROOM_ID, {
                  type: "chat",
                  from: displayName,
                  fromAddress: c.address,
                  text: `completed The Maze in ${position}${suffix} place! 🏁`,
                  at: Date.now(),
                });
                
                console.log(`[canvas] Player ${displayName} finished in position ${position}`);
                
                // Teleport player back to hub after short delay
                setTimeout(() => {
                  const conn = room.get(c.address);
                  if (conn) {
                    teleportPlayer(conn, HUB_ROOM_ID, 0, 0);
                  }
                }, 1500);
              }
              continue;
            }
            
            // Track steps for tiles that aren't the exit portal
            const currentSteps = canvasPlayerSteps.get(c.address) || 0;
            canvasPlayerSteps.set(c.address, currentSteps + 1);
            
            console.log(`[canvas] Player ${c.address.slice(0, 8)}... claimed tile (${tile.x}, ${tile.z}), total steps: ${currentSteps + 1}`);
            const result = claimTile(tile.x, tile.z, c.address);
            
            // Broadcast the new claim
            broadcast(roomId, {
              type: "canvasClaim",
              x: tile.x,
              z: tile.z,
              address: c.address,
            });
            
            // If an old tile was removed due to 10-tile limit, broadcast its removal
            if (result.removedTile) {
              console.log(`[canvas] Broadcasting removal of oldest tile (${result.removedTile.x}, ${result.removedTile.z})`);
              broadcast(roomId, {
                type: "canvasClaim",
                x: result.removedTile.x,
                z: result.removedTile.z,
                address: "", // Empty address means unclaim
              });
            }
          }
        }
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
          
          // Check if it's time for the NPC to say something
          if (now >= bot.nextChatTime && room.size > 0) {
            const message = getRandomNpcMessage(rng);
            broadcast(roomId, {
              type: "chat",
              from: p.displayName,
              fromAddress: p.address,
              text: message,
              at: now,
              bubbleOnly: true,
            });
            bot.nextChatTime = now + getRandomNpcChatDelay(rng);
            console.log(`[npc] ${p.displayName} says: "${message}" (next in ${((bot.nextChatTime - now) / 1000).toFixed(1)}s)`);
          }
          
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
      
      // Send canvas timer updates every second
      if (isCanvas && canvasTimerActive && now % 1000 < TICK_MS) {
        const timeRemaining = Math.max(0, canvasTimerEndTime - now);
        broadcast(roomId, {
          type: "canvasTimer",
          timeRemaining,
        });
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

  const isCanvas = normalizeRoomId(roomId) === CANVAS_ROOM_ID;
  
  // Send current canvas timer if joining canvas room
  if (isCanvas && canvasTimerActive) {
    const timeRemaining = Math.max(0, canvasTimerEndTime - Date.now());
    setTimeout(() => {
      ws.send(JSON.stringify({
        type: "canvasTimer",
        timeRemaining,
      }));
    }, 100);
  }

  const signboards = getSignboardsForRoom(roomId).map((s) => ({
    id: s.id,
    x: s.x,
    z: s.z,
    message: s.message,
    createdBy: s.createdBy,
    createdAt: s.createdAt,
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
      canvasClaims: isCanvas ? getClaimsInBounds(rb.minX, rb.maxX, rb.minZ, rb.maxZ) : undefined,
      signboards,
    } satisfies OutMsg)
  );

  broadcast(
    roomId,
    { type: "playerJoined", player: { ...player } },
    address
  );

  // Check if player tried to enter canvas during cooldown - teleport them back
  if (roomId === CANVAS_ROOM_ID && canvasCooldownActive) {
    const remainingSeconds = Math.ceil((canvasCooldownEndTime - Date.now()) / 1000);
    
    // Send chat message explaining cooldown
    ws.send(JSON.stringify({
      type: "chat",
      from: "System",
      fromAddress: "",
      text: `The Maze is on cooldown. Please wait ${remainingSeconds} seconds before entering.`,
      at: Date.now(),
    } satisfies OutMsg));
    
    console.log(`[canvas] Teleporting ${address.slice(0, 8)}... back to hub - maze on cooldown (${remainingSeconds}s remaining)`);
    
    // Teleport them back to hub after a short delay to let the welcome message process
    setTimeout(() => {
      const currentConn = room.get(address);
      if (currentConn) {
        teleportPlayer(currentConn, HUB_ROOM_ID, 0, 0);
      }
    }, 100);
  }

  ws.on("message", (raw) => {
    let data: unknown;
    try {
      data = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (!data || typeof data !== "object") return;
    const msg = data as Record<string, unknown>;

    // Dynamically look up which room the player is currently in
    const currentRoomId = findPlayerRoom(address);
    if (!currentRoomId) {
      console.log(`[rooms] Player ${address} not in any room, ignoring message`);
      return;
    }

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
      const placed = placedMap(currentRoomId);
      const extra = extraFloorSet(currentRoomId);
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
        currentRoomId
      );
      if (!full || full.length === 0) {
        conn.pathQueue = [];
        return;
      }
      conn.pathQueue = full.slice(1);
      logGameplayEvent(conn.sessionId, address, currentRoomId, "move_to", {
        fromX: start.x,
        fromZ: start.z,
        toX: dest.x,
        toZ: dest.z,
        goalLayer,
      });
      return;
    }

    if (msg.type === "placeBlock") {
      // Canvas room is view-only, no building allowed
      if (normalizeRoomId(currentRoomId) === CANVAS_ROOM_ID) {
        return;
      }
      
      const now = Date.now();
      if (now - conn.lastPlaceAt < RATE_PLACE_MS) return;
      conn.lastPlaceAt = now;
      const tx = Number(msg.x);
      const tz = Number(msg.z);
      if (!Number.isFinite(tx) || !Number.isFinite(tz)) return;
      const tile = snapToTile(tx, tz);
      const k = tileKey(tile.x, tile.z);
      if (!withinBlockActionRange(conn.player, tile.x, tile.z)) return;
      if (!isWalkableForRoom(currentRoomId, tile.x, tile.z)) return;
      const placed = placedMap(currentRoomId);
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
        locked: false,
      });
      broadcast(currentRoomId, {
        type: "obstacles",
        roomId: currentRoomId,
        tiles: obstaclesToList(currentRoomId),
      });
      schedulePersistWorldState();
      logGameplayEvent(conn.sessionId, address, currentRoomId, "place_block", {
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
      // Canvas room is view-only, no editing allowed
      if (normalizeRoomId(currentRoomId) === CANVAS_ROOM_ID) {
        return;
      }
      
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
      const locked = Boolean(msg.locked);
      
      console.log(`[Server setObstacleProps] Received locked=${locked} for (${tx}, ${tz}) from ${address}`);
      
      if (!Number.isFinite(tx) || !Number.isFinite(tz)) return;
      const tile = snapToTile(tx, tz);
      const k = tileKey(tile.x, tile.z);
      if (!withinBlockActionRange(conn.player, tile.x, tile.z)) return;
      const placed = placedMap(currentRoomId);
      const existing = placed.get(k);
      if (!existing) return;
      
      // Check if object is locked and user is not admin
      if (existing.locked && !isAdmin(address)) {
        ws.send(JSON.stringify({ type: "error", code: "object_locked" }));
        return;
      }
      
      // Only admins can change lock status
      const finalLocked = isAdmin(address) ? locked : (existing.locked || false);
      
      console.log(`[Server setObstacleProps] Storing locked=${finalLocked} (isAdmin=${isAdmin(address)})`);
      
      placed.set(k, {
        passable,
        half,
        quarter,
        hex,
        ramp,
        rampDir: ramp ? rampDir : 0,
        colorId,
        locked: finalLocked,
      });
      broadcast(currentRoomId, {
        type: "obstacles",
        roomId: currentRoomId,
        tiles: obstaclesToList(currentRoomId),
      });
      schedulePersistWorldState();
      logGameplayEvent(conn.sessionId, address, currentRoomId, "set_obstacle_props", {
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
      // Canvas room is view-only, no deleting allowed
      if (normalizeRoomId(currentRoomId) === CANVAS_ROOM_ID) {
        return;
      }
      
      const now = Date.now();
      if (now - conn.lastPlaceAt < RATE_PLACE_MS) return;
      conn.lastPlaceAt = now;
      const tx = Number(msg.x);
      const tz = Number(msg.z);
      if (!Number.isFinite(tx) || !Number.isFinite(tz)) return;
      const tile = snapToTile(tx, tz);
      const k = tileKey(tile.x, tile.z);
      if (!withinBlockActionRange(conn.player, tile.x, tile.z)) return;
      const placed = placedMap(currentRoomId);
      const props = placed.get(k);
      if (!props) return;
      
      // Check if object is locked and user is not admin
      if (props.locked && !isAdmin(address)) {
        ws.send(JSON.stringify({ type: "error", code: "object_locked" }));
        return;
      }
      
      // Check if there's a signboard at this location and remove it
      const signboard = getSignboardAt(currentRoomId, tile.x, tile.z);
      let signboardDeleted = false;
      if (signboard) {
        deleteSignboard(signboard.id);
        signboardDeleted = true;
      }
      
      placed.delete(k);
      broadcast(currentRoomId, {
        type: "obstacles",
        roomId: currentRoomId,
        tiles: obstaclesToList(currentRoomId),
      });
      
      // If we deleted a signboard, broadcast the updated list
      if (signboardDeleted) {
        broadcast(currentRoomId, {
          type: "signboards",
          roomId: currentRoomId,
          signboards: getSignboardsForRoom(currentRoomId).map((s) => ({
            id: s.id,
            x: s.x,
            z: s.z,
            message: s.message,
            createdBy: s.createdBy,
            createdAt: s.createdAt,
          })),
        });
      }
      
      schedulePersistWorldState();
      /* Replay log: we only record tile coords. For richer replay / inference (e.g. undo,
         material audits), consider logging the obstacle props that existed immediately before
         delete (passable, half, quarter, hex, ramp, rampDir, colorId). */
      logGameplayEvent(conn.sessionId, address, currentRoomId, "remove_obstacle", {
        x: tile.x,
        z: tile.z,
      });
      return;
    }

    if (msg.type === "moveObstacle") {
      // Canvas room is view-only, no moving allowed
      if (normalizeRoomId(currentRoomId) === CANVAS_ROOM_ID) {
        return;
      }
      
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
      const placed = placedMap(currentRoomId);
      const props = placed.get(fk);
      if (!props) return;
      
      // Check if object is locked and user is not admin
      if (props.locked && !isAdmin(address)) {
        ws.send(JSON.stringify({ type: "error", code: "object_locked" }));
        return;
      }
      
      if (placed.has(tk)) return;
      if (!isWalkableForRoom(currentRoomId, to.x, to.z)) return;
      if (
        normalizeRoomId(currentRoomId) === HUB_ROOM_ID &&
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
      
      // If there's a signboard at the old location, move it to the new location
      const signboard = getSignboardAt(currentRoomId, from.x, from.z);
      if (signboard) {
        // Update signboard position
        updateSignboardPosition(signboard.id, to.x, to.z);
        // Broadcast updated signboards
        broadcast(currentRoomId, {
          type: "signboards",
          roomId: currentRoomId,
          signboards: getSignboardsForRoom(currentRoomId).map((s) => ({
            id: s.id,
            x: s.x,
            z: s.z,
            message: s.message,
            createdBy: s.createdBy,
            createdAt: s.createdAt,
          })),
        });
      }
      
      broadcast(currentRoomId, {
        type: "obstacles",
        roomId: currentRoomId,
        tiles: obstaclesToList(currentRoomId),
      });
      schedulePersistWorldState();
      logGameplayEvent(conn.sessionId, address, currentRoomId, "move_obstacle", {
        fromX: from.x,
        fromZ: from.z,
        toX: to.x,
        toZ: to.z,
      });
      return;
    }

    if (msg.type === "placeExtraFloor") {
      // Canvas room is view-only, no floor expansion allowed
      if (normalizeRoomId(currentRoomId) === CANVAS_ROOM_ID) {
        return;
      }
      
      const now = Date.now();
      if (now - conn.lastPlaceAt < RATE_PLACE_MS) return;
      conn.lastPlaceAt = now;
      const tx = Number(msg.x);
      const tz = Number(msg.z);
      if (!Number.isFinite(tx) || !Number.isFinite(tz)) return;
      const tile = snapToTile(tx, tz);
      if (!canPlaceExtraFloor(currentRoomId, tile.x, tile.z)) return;
      for (const c of room.values()) {
        const st = snapToTile(c.player.x, c.player.z);
        if (st.x === tile.x && st.z === tile.z) return;
      }
      extraFloorSet(currentRoomId).add(tileKey(tile.x, tile.z));
      broadcast(currentRoomId, {
        type: "extraFloor",
        roomId: currentRoomId,
        tiles: extraFloorToList(currentRoomId),
      });
      schedulePersistWorldState();
      logGameplayEvent(conn.sessionId, address, currentRoomId, "place_extra_floor", {
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
      const ex = extraFloorSet(currentRoomId);
      if (!ex.has(k)) return;
      if (isBaseTile(tile.x, tile.z, currentRoomId)) return;
      const placed = placedMap(currentRoomId);
      if (placed.has(k)) return;
      for (const c of room.values()) {
        const st = snapToTile(c.player.x, c.player.z);
        if (st.x === tile.x && st.z === tile.z) return;
      }
      ex.delete(k);
      broadcast(currentRoomId, {
        type: "extraFloor",
        roomId: currentRoomId,
        tiles: extraFloorToList(currentRoomId),
      });
      schedulePersistWorldState();
      logGameplayEvent(conn.sessionId, address, currentRoomId, "remove_extra_floor", {
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
      broadcast(currentRoomId, {
        type: "chat",
        from: displayName,
        fromAddress: address,
        text,
        at: now,
      });
      logGameplayEvent(conn.sessionId, address, currentRoomId, "chat", {
        text,
      });
      return;
    }

    if (msg.type === "placeSignboard") {
      // Anyone can place a signboard/signpost
      const now = Date.now();
      if (now - conn.lastPlaceAt < RATE_PLACE_MS) return;
      conn.lastPlaceAt = now;
      const tx = Number(msg.x);
      const tz = Number(msg.z);
      const message = String(msg.message ?? "").trim();
      if (!Number.isFinite(tx) || !Number.isFinite(tz)) return;
      if (!message || message.length > 500) {
        ws.send(JSON.stringify({ type: "error", code: "invalid_message" }));
        return;
      }
      const tile = snapToTile(tx, tz);
      const k = tileKey(tile.x, tile.z);
      
      // Check if within build range
      if (!withinBlockActionRange(conn.player, tile.x, tile.z)) {
        ws.send(JSON.stringify({ 
          type: "chat",
          from: "System",
          fromAddress: "",
          text: "Too far! You can only place signboards within your build range.",
          at: Date.now()
        }));
        return;
      }
      
      if (!isWalkableForRoom(currentRoomId, tile.x, tile.z)) return;
      const placed = placedMap(currentRoomId);
      if (placed.has(k)) return;
      
      // Check if signboard already exists at this location
      const existing = getSignboardAt(currentRoomId, tile.x, tile.z);
      if (existing) {
        ws.send(JSON.stringify({ type: "error", code: "signboard_exists" }));
        return;
      }
      
      // Create the signboard
      const signboard = createSignboard(currentRoomId, tile.x, tile.z, message, address);
      
      // Place a passable half-height block as the signboard visual
      placed.set(k, {
        passable: true,
        half: true,
        quarter: false,
        hex: false,
        ramp: false,
        rampDir: 0,
        colorId: 8, // Use a specific color for signboards (light gray/white)
      });
      
      broadcast(currentRoomId, {
        type: "obstacles",
        roomId: currentRoomId,
        tiles: obstaclesToList(currentRoomId),
      });
      broadcast(currentRoomId, {
        type: "signboards",
        roomId: currentRoomId,
        signboards: getSignboardsForRoom(currentRoomId).map((s) => ({
          id: s.id,
          x: s.x,
          z: s.z,
          message: s.message,
          createdBy: s.createdBy,
          createdAt: s.createdAt,
        })),
      });
      schedulePersistWorldState();
      logGameplayEvent(conn.sessionId, address, currentRoomId, "place_signboard", {
        x: tile.x,
        z: tile.z,
        signboardId: signboard.id,
      });
      return;
    }

    if (msg.type === "updateSignboard") {
      // Admin-only: update a signboard's message
      if (!isAdmin(address)) {
        ws.send(JSON.stringify({ type: "error", code: "admin_required" }));
        return;
      }
      const signboardId = String(msg.signboardId ?? "");
      const message = String(msg.message ?? "").trim();
      if (!signboardId || !message || message.length > 500) {
        ws.send(JSON.stringify({ type: "error", code: "invalid_message" }));
        return;
      }
      if (!updateSignboard(signboardId, message)) {
        ws.send(JSON.stringify({ type: "error", code: "signboard_not_found" }));
        return;
      }
      broadcast(currentRoomId, {
        type: "signboards",
        roomId: currentRoomId,
        signboards: getSignboardsForRoom(currentRoomId).map((s) => ({
          id: s.id,
          x: s.x,
          z: s.z,
          message: s.message,
          createdBy: s.createdBy,
          createdAt: s.createdAt,
        })),
      });
      logGameplayEvent(conn.sessionId, address, currentRoomId, "update_signboard", {
        signboardId,
      });
      return;
    }

    if (msg.type === "removeSignboard") {
      // Admin-only: remove a signboard
      if (!isAdmin(address)) {
        ws.send(JSON.stringify({ type: "error", code: "admin_required" }));
        return;
      }
      const now = Date.now();
      if (now - conn.lastPlaceAt < RATE_PLACE_MS) return;
      conn.lastPlaceAt = now;
      const signboardId = String(msg.signboardId ?? "");
      if (!signboardId) return;
      
      // Find the signboard to get its position
      const signboards = getSignboardsForRoom(currentRoomId);
      const signboard = signboards.find((s) => s.id === signboardId);
      if (!signboard) {
        ws.send(JSON.stringify({ type: "error", code: "signboard_not_found" }));
        return;
      }
      
      // Remove the signboard data
      if (!deleteSignboard(signboardId)) return;
      
      // Remove the obstacle block
      const k = tileKey(signboard.x, signboard.z);
      const placed = placedMap(currentRoomId);
      placed.delete(k);
      
      broadcast(currentRoomId, {
        type: "obstacles",
        roomId: currentRoomId,
        tiles: obstaclesToList(currentRoomId),
      });
      broadcast(currentRoomId, {
        type: "signboards",
        roomId: currentRoomId,
        signboards: getSignboardsForRoom(currentRoomId).map((s) => ({
          id: s.id,
          x: s.x,
          z: s.z,
          message: s.message,
          createdBy: s.createdBy,
          createdAt: s.createdAt,
        })),
      });
      schedulePersistWorldState();
      logGameplayEvent(conn.sessionId, address, currentRoomId, "remove_signboard", {
        signboardId,
      });
      return;
    }
  });

  ws.on("close", () => {
    // Find which room the player is currently in
    const playerCurrentRoom = findPlayerRoom(address);
    if (playerCurrentRoom) {
      endSession(conn.sessionId, address, playerCurrentRoom, conn.sessionStartedAt);
      spawnMap(playerCurrentRoom).set(address, {
        x: conn.player.x,
        z: conn.player.z,
        y: conn.player.y,
      });
      schedulePersistWorldState();
      const room = roomOf(playerCurrentRoom);
      room.delete(address);
      broadcast(playerCurrentRoom, { type: "playerLeft", address });
      if (room.size === 0) clearFakePlayers(playerCurrentRoom);
    }
  });
}
