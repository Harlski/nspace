import { randomBytes, randomInt } from "node:crypto";
import type { WebSocket } from "ws";
import {
  blockKey,
  canPlaceTeleporterFoot,
  inTileBounds,
  isBaseTile,
  isOrthogonallyAdjacentToTile,
  isWalkableTile,
  clampPyramidBaseScale,
  normalizeBlockPrismParts,
  pathfindTiles,
  pathfindTerrain,
  snapToTile,
  terrainObstacleHeight,
  tileKey,
  type TerrainProps,
} from "./grid.js";
import {
  createOfficialRoomWithSize,
  createRoomWithSize,
  defaultRoomDisplayName,
  getDoorsForRoom,
  getRoomBaseBounds,
  HUB_ROOM_ID,
  hasRoom,
  isHubSpawnSafeZone,
  isBuiltinRoomId,
  isPlayerCreatedRoom,
  listDeletedRoomDefinitions,
  listRoomDefinitions,
  normalizeRoomId,
  type RoomBounds,
} from "./roomLayouts.js";
import {
  getBuiltinRoomBackgroundState,
  patchBuiltinRoomSettings,
} from "./builtinRoomNames.js";
import {
  allowActorRoomBackgroundHueEdit,
  getDynamicRoomBackgroundState,
  getDynamicRoomOwnerAddress,
  normalizeBackgroundHuePatch,
  normalizeBackgroundNeutralPatch,
  restoreDynamicRoom,
  softDeleteDynamicRoom,
  updateDynamicRoomMetadata,
  type RoomBackgroundNeutral,
} from "./roomRegistry.js";
import { generateMaze } from "./mazeGenerator.js";
import {
  loadWorldState,
  registerWorldStateRefs,
  schedulePersistWorldState,
} from "./worldPersistence.js";
import {
  enqueueNimPayout,
  getNimPayoutWalletBalanceLuna,
  isNimPayoutSenderConfigured,
  peekNimPayoutBalanceCacheLuna,
  LUNA_PER_NIM,
} from "./nimPayout/index.js";
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
  getEffectivePlayerDisplayName,
  getRecentAliases,
} from "./playerProfileStore.js";
import { isChannelMuted } from "./moderationStore.js";
import {
  claimTile,
  getClaimsInBounds,
  loadCanvasClaims,
  clearAllClaims,
} from "./canvasCanvas.js";
import {
  CANVAS_ROOM_ID,
  CHAMBER_DEFAULT_SPAWN,
  CHAMBER_ROOM_ID,
  HUB_MAZE_EXIT_SPAWN,
} from "./roomLayouts.js";
import {
  createSignboard,
  deleteSignboard,
  getSignboardAt,
  getSignboardsForRoom,
  loadSignboards,
  SIGNBOARD_MESSAGE_MAX_LEN,
  updateSignboard,
  updateSignboardPosition,
} from "./signboards.js";
import {
  BILLBOARD_LIVE_CHART_PLACEHOLDER_SLIDE,
  parseBillboardLiveChartFromMessage,
} from "./billboardLiveChart.js";
import {
  billboardToWire,
  createBillboard,
  deleteBillboard,
  footprintTileCoords,
  getBillboardAtTile,
  getBillboardById,
  getBillboardsForRoom,
  hasBillboardFootprintConflict,
  isAllowedBillboardImageUrl,
  patchBillboardRecord,
  loadBillboards,
  setBillboardContent,
  type Billboard,
  type BillboardOrientation,
} from "./billboards.js";
import {
  getBillboardAdvertById,
  parseBillboardAdvertIdsFromMessage,
  validateAdvertRotationVisitHttps,
} from "./billboardAdvertsCatalog.js";
import {
  getVoxelTextsForRoom,
  loadVoxelTexts,
  removeVoxelText,
  upsertVoxelText,
  type VoxelTextSpec,
} from "./voxelTexts.js";
import { loadMazeRecords, recordMazeCompletion } from "./mazeRecords.js";
import { isAdmin } from "./config.js";
import {
  recordGameWsInbound,
  recordGameWsOutbound,
  utf8ByteLengthOfWsData,
} from "./gameWsMetrics.js";

function buildBillboardSlidesFromAdvertIds(
  ids: readonly string[]
): string[] | null {
  const slides: string[] = [];
  for (const id of ids) {
    const ad = getBillboardAdvertById(id);
    if (!ad) return null;
    let hit = "";
    for (const u of ad.slides) {
      const t = String(u).trim();
      if (isAllowedBillboardImageUrl(t)) {
        hit = t;
        break;
      }
    }
    if (!hit) return null;
    slides.push(hit);
  }
  return slides;
}

const MOVE_SPEED = 5;
/** NPCs move 20% slower than human path-follow speed. */
const NPC_MOVE_SPEED = MOVE_SPEED * 0.8;
const TICK_MS = 50;
/**
 * Min interval between tick-driven full-room `state` broadcasts (JSON over WS).
 * Simulation still runs every {@link TICK_MS}; this only limits how often clients
 * receive position snapshots. Override with `STATE_BROADCAST_MIN_MS` (e.g. 200).
 */
const STATE_BROADCAST_MIN_MS = Math.max(
  TICK_MS,
  Math.floor(Number(process.env.STATE_BROADCAST_MIN_MS ?? "120"))
);

/**
 * Temporary: refuse new vertical billboards and horizontal→vertical updates.
 * Match `BILLBOARD_VERTICAL_PLACEMENT_TEMP_DISABLED` in `client/src/game/billboardPlacementFlags.ts`.
 */
const BILLBOARD_VERTICAL_PLACEMENT_TEMP_DISABLED = true;

/** Set `STATE_BROADCAST_DELTA=0` to always send full `state` on ticks (debug / compat). */
const USE_STATE_TICK_DELTA = process.env.STATE_BROADCAST_DELTA !== "0";

const lastTickStateBroadcastAt = new Map<string, number>();
const pendingTickStateBroadcast = new Set<string>();
/** Last tick `state` / `stateDelta` payload per room (for delta tick sends). */
const lastTickBroadcastPlayers = new Map<string, PlayerState[]>();

function clonePlayerState(p: PlayerState): PlayerState {
  return { ...p };
}

/** Ignore sub-epsilon float noise when diffing tick snapshots (avoids pointless `stateDelta`). */
const TICK_STATE_EQ_POS_EPS = 1e-5;
const TICK_STATE_EQ_VEL_EPS = 1e-8;

function nearTickCoord(a: number, b: number, eps: number): boolean {
  return Math.abs(a - b) <= eps;
}

function tickPlayerStatesEqual(a: PlayerState, b: PlayerState): boolean {
  return (
    a.displayName === b.displayName &&
    nearTickCoord(a.x, b.x, TICK_STATE_EQ_POS_EPS) &&
    nearTickCoord(a.y, b.y, TICK_STATE_EQ_POS_EPS) &&
    nearTickCoord(a.z, b.z, TICK_STATE_EQ_POS_EPS) &&
    nearTickCoord(a.vx, b.vx, TICK_STATE_EQ_VEL_EPS) &&
    nearTickCoord(a.vz, b.vz, TICK_STATE_EQ_VEL_EPS) &&
    (a.nimiqPay ?? false) === (b.nimiqPay ?? false) &&
    (a.nimSendAway ?? false) === (b.nimSendAway ?? false) &&
    (a.chatTyping ?? false) === (b.chatTyping ?? false)
  );
}

function pruneTickBaselinePlayer(roomId: string, address: string): void {
  const cur = lastTickBroadcastPlayers.get(roomId);
  if (!cur) return;
  const next = cur.filter((p) => p.address !== address);
  if (next.length === 0) lastTickBroadcastPlayers.delete(roomId);
  else lastTickBroadcastPlayers.set(roomId, next);
}

/** Keep tick delta baseline aligned with joins so the next tick rarely needs a full `state`. */
function mergeTickBaselinePlayer(roomId: string, player: PlayerState): void {
  const cur = lastTickBroadcastPlayers.get(roomId);
  if (!cur) return;
  if (cur.some((p) => p.address === player.address)) return;
  cur.push(clonePlayerState(player));
}

function replaceTickBroadcastBaseline(roomId: string): void {
  lastTickBroadcastPlayers.set(
    roomId,
    snapshotPlayers(roomId).map(clonePlayerState)
  );
}

/** Full room snapshot + refresh tick delta baseline (use for non-tick `state` sends). */
function broadcastRoomStateFull(roomId: string): void {
  broadcast(roomId, {
    type: "state",
    players: snapshotPlayers(roomId),
  });
  replaceTickBroadcastBaseline(roomId);
}

function broadcastTickStateIfAllowed(
  roomId: string,
  room: Map<string, ClientConn>,
  now: number,
  dirty: boolean
): void {
  if (room.size === 0) {
    pendingTickStateBroadcast.delete(roomId);
    lastTickStateBroadcastAt.delete(roomId);
    lastTickBroadcastPlayers.delete(roomId);
    return;
  }
  const want = dirty || pendingTickStateBroadcast.has(roomId);
  if (!want) return;
  const last = lastTickStateBroadcastAt.get(roomId) ?? 0;
  if (now - last < STATE_BROADCAST_MIN_MS) {
    if (dirty) pendingTickStateBroadcast.add(roomId);
    return;
  }

  const full = snapshotPlayers(roomId);
  const prev = lastTickBroadcastPlayers.get(roomId);
  let sendFull =
    !USE_STATE_TICK_DELTA || !prev || prev.length !== full.length;

  if (!sendFull && prev) {
    const prevSet = new Set(prev.map((p) => p.address));
    for (const p of full) {
      if (!prevSet.has(p.address)) {
        sendFull = true;
        break;
      }
    }
  }

  const changed: PlayerState[] = [];
  if (!sendFull && prev) {
    const prevByAddr = new Map(prev.map((p) => [p.address, p]));
    for (const p of full) {
      const o = prevByAddr.get(p.address);
      if (!o || !tickPlayerStatesEqual(o, p)) changed.push(clonePlayerState(p));
    }
    if (changed.length === 0) {
      lastTickStateBroadcastAt.set(roomId, now);
      pendingTickStateBroadcast.delete(roomId);
      return;
    }
    if (changed.length === full.length) sendFull = true;
  }

  if (sendFull || !USE_STATE_TICK_DELTA) {
    broadcast(roomId, { type: "state", players: full });
  } else {
    broadcast(roomId, { type: "stateDelta", players: changed });
  }
  replaceTickBroadcastBaseline(roomId);
  lastTickStateBroadcastAt.set(roomId, now);
  pendingTickStateBroadcast.delete(roomId);
}

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

/**
 * Max custom rooms a single wallet may create (default 3).
 * Override with `MAX_OWNED_ROOMS_PER_PLAYER` (e.g. higher tiers for subscribers later).
 */
const MAX_OWNED_ROOMS_PER_PLAYER = ((): number => {
  const raw = process.env.MAX_OWNED_ROOMS_PER_PLAYER;
  if (raw === undefined || raw === "") return 3;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return 3;
  return Math.max(1, Math.min(256, n));
})();

/** Server-authoritative NIM / claimable-block flow (see beginBlockClaim / blockClaimTick / completeBlockClaim). */
const BLOCK_CLAIM_HOLD_MS = 3000;
const BLOCK_CLAIM_SESSION_MS = 45_000;
const RATE_BEGIN_BLOCK_CLAIM_MS = 600;
const RATE_BLOCK_CLAIM_TICK_MS = 170;
const RATE_COMPLETE_BLOCK_CLAIM_MS = 450;
const CLAIM_ACCUM_GAP_BREAK_MS = 950;
const CLAIM_ACCUM_DT_CAP_MS = 480;

/**
 * When > 0, `completeBlockClaim` uses any in-memory payout balance cache (`peek…`) for the
 * funds gate if it shows enough for the minimum reward — **without** an age check — so the
 * claim path does not await Nimiq behind in-flight payouts. Payout jobs still send on-chain
 * asynchronously; a stale-high cache is rare for a dedicated hot wallet. Set `0` to always
 * `await getNimPayoutWalletBalanceLuna()` on each complete (blocks on the Nimiq mutex).
 */
const NIM_CLAIM_BALANCE_PEEK_MAX_MS = Math.max(
  0,
  Number(process.env.NIM_CLAIM_BALANCE_PEEK_MAX_MS ?? 30_000)
);

const CLAIM_REWARD_MIN_LUNA = 2000; // 0.0200 NIM
const CLAIM_REWARD_MAX_LUNA = 200000; // 2.0000 NIM
const MINEABLE_BLOCK_PLACER_ALLOWLIST = new Set([
  "NQ974M1T4TGDVC7FLHLQY2DY425N5CVHM02Y",
]);

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
  /** Prior display names (newest first), for profile tooltip. */
  recentAliases?: string[];
  /** From session JWT when this client connected via Nimiq Pay mini-app (broadcast to room for profile UI). */
  nimiqPay?: boolean;
  /** Ephemeral: client tab hidden/background or NIM send / wallet flow. */
  nimSendAway?: boolean;
  /** Ephemeral: composing a chat message. */
  chatTyping?: boolean;
}

export type ObstacleTile = {
  x: number;
  z: number;
  /** Vertical stack level (0..2). */
  y: number;
  passable: boolean;
  /** Shorter Y extent when `quarter` is false. */
  half: boolean;
  /** Quarter-unit height slab; wins over `half`. */
  quarter: boolean;
  /** Hexagonal prism footprint. */
  hex: boolean;
  /** Square pyramid (apex up); mutually exclusive with hex / sphere / ramp. */
  pyramid: boolean;
  /** When `pyramid`: base radius multiplier (1 = default). */
  pyramidBaseScale: number;
  /** Sphere column inscribed in tile; mutually exclusive with hex / pyramid / ramp. */
  sphere: boolean;
  /** Sloped ramp (walkable floor); `rampDir` 0–3 = +X,+Z,−X,−Z toward climbed block. */
  ramp: boolean;
  rampDir: number;
  /** Index into client color palette (0..9). */
  colorId: number;
  /** Optional signboard ID if there's a signboard at this location. */
  signboardId?: string;
  /** Whether this obstacle is locked (admin-only editing). */
  locked?: boolean;
  // Experimental: Claimable/minable blocks
  claimable?: boolean;
  active?: boolean;
  cooldownMs?: number;
  lastClaimedAt?: number;
  claimReactivateAtMs?: number;
  claimedBy?: string;
  teleporter?:
    | { pending: true }
    | {
        targetRoomId: string;
        targetX: number;
        targetZ: number;
        /** Snapshot of destination room name when configured (private rooms may be absent from catalog). */
        targetRoomDisplayName?: string;
      };
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
  /** Single active claim session id for this connection (enforces one claim at a time). */
  pendingBlockClaimId: string | null;
  lastBlockClaimBeginAt: number;
  lastBlockClaimTickAt: number;
  lastBlockClaimCompleteAttemptAt: number;
  /** Client away from game tab or in NIM send / wallet flow (broadcast as nimSendAway). */
  nimSendIntent: boolean;
  /** Composing chat (broadcast as `chatTyping`). */
  chatTyping: boolean;
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

function compactAddress(addr: string): string {
  return String(addr).replace(/\s+/g, "").toUpperCase();
}

/** Placer or admin may change/remove/move/rotate/update a billboard. */
function canModifyOwnBillboard(bb: Billboard, address: string): boolean {
  if (isAdmin(address)) return true;
  const owner = String(bb.createdBy ?? "").trim();
  if (!owner) return false;
  return compactAddress(owner) === compactAddress(address);
}

function canPlaceMineableBlocks(address: string): boolean {
  return MINEABLE_BLOCK_PLACER_ALLOWLIST.has(compactAddress(address));
}

/**
 * Per-room edit permissions:
 * - Canvas: no edits for anyone (view-only).
 * - Chamber: admins only.
 * - Wallet-created rooms: owner or admin only; rooms with no owner on record: admin only.
 * - Hub and other built-ins: anyone may edit (subject to hub safe zone, etc.).
 */
function canEditRoomContent(roomId: string, address: string): boolean {
  const id = normalizeRoomId(roomId);
  if (id === CANVAS_ROOM_ID) return false;
  if (id === CHAMBER_ROOM_ID) return isAdmin(address);
  if (isPlayerCreatedRoom(id)) {
    if (isAdmin(address)) return true;
    const owner = getDynamicRoomOwnerAddress(id);
    if (!owner) return false;
    return compactAddress(address) === owner;
  }
  return true;
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
      /** Base tiles removed in custom rooms (same shape as extra floor coords). */
      removedBaseFloorTiles?: ExtraFloorTile[];
      canvasClaims?: Array<{ x: number; z: number; address: string }>;
      signboards: Array<{
        id: string;
        x: number;
        z: number;
        message: string;
        createdBy: string;
        createdAt: number;
      }>;
      billboards: Array<{
        id: string;
        anchorX: number;
        anchorZ: number;
        orientation: "horizontal" | "vertical";
        yawSteps: number;
        slides: string[];
        intervalMs: number;
        advertId: string;
        advertIds: string[];
        slideshowEpochMs: number;
        visitName: string;
        visitUrl: string;
        liveChart?: {
          range: "24h" | "7d";
          fallbackAdvertId: string;
          rangeCycle?: boolean;
          cycleIntervalSec?: number;
        };
        createdBy: string;
        createdAt: number;
      }>;
      voxelTexts: VoxelTextSpec[];
      /** Real players online across all rooms (NPCs excluded). */
      onlinePlayerCount: number;
      /** Client may show build mode only when true; server still enforces. */
      allowPlaceBlocks: boolean;
      /** Client may show floor-expand mode only when true; server still enforces. */
      allowExtraFloor: boolean;
      /** Dynamic rooms: this player may PATCH `backgroundHueDeg` (sidebar hue ring). */
      allowRoomBackgroundHueEdit?: boolean;
      /** Dynamic rooms: custom sky hue (0–359); null when using neutral or default. */
      roomBackgroundHueDeg?: number | null;
      /** Dynamic rooms: solid black / white / gray sky; overrides hue when non-null. */
      roomBackgroundNeutral?: RoomBackgroundNeutral | null;
    }
  | {
      type: "roomBackgroundHue";
      roomId: string;
      hueDeg: number | null;
      neutral?: RoomBackgroundNeutral | null;
    }
  | { type: "playerJoined"; player: PlayerState }
  | { type: "playerLeft"; address: string }
  | { type: "state"; players: PlayerState[] }
  /** Tick path only: subset of players that changed since last tick snapshot. */
  | { type: "stateDelta"; players: PlayerState[] }
  | { type: "onlineCount"; count: number }
  | { type: "obstacles"; roomId: string; tiles: ObstacleTile[] }
  | {
      type: "obstaclesDelta";
      roomId: string;
      add: ObstacleTile[];
      /** Tile keys ("x,z") that should be removed from the room. */
      remove: string[];
    }
  | { type: "extraFloor"; roomId: string; tiles: ExtraFloorTile[] }
  | {
      type: "extraFloorDelta";
      roomId: string;
      add: ExtraFloorTile[];
      /** Tile keys ("x,z") that should be removed from the room. */
      remove: string[];
    }
  | {
      type: "removedBaseFloorDelta";
      roomId: string;
      /** Tile keys added to the "removed base" set (floor hole). */
      add: string[];
      /** Tile keys removed from the set (restore base floor). */
      remove: string[];
    }
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
      type: "billboards";
      roomId: string;
      billboards: Array<{
        id: string;
        anchorX: number;
        anchorZ: number;
        orientation: "horizontal" | "vertical";
        yawSteps: number;
        slides: string[];
        intervalMs: number;
        advertId: string;
        advertIds: string[];
        slideshowEpochMs: number;
        visitName: string;
        visitUrl: string;
        liveChart?: {
          range: "24h" | "7d";
          fallbackAdvertId: string;
          rangeCycle?: boolean;
          cycleIntervalSec?: number;
        };
        createdBy: string;
        createdAt: number;
      }>;
    }
  | { type: "voxelTexts"; roomId: string; texts: VoxelTextSpec[] }
  | {
      type: "chat";
      from: string;
      fromAddress: string;
      text: string;
      at: number;
      bubbleOnly?: boolean; // If true, only show as bubble, not in chat log
    }
  | { type: "error"; code: string }
  | {
      type: "blockClaimOffered";
      claimId: string;
      x: number;
      z: number;
      /** Stack index in `blockKey` (0..2). Omitted or 0 for legacy floor blocks. */
      y?: number;
      holdMs: number;
      completeBy: number;
    }
  | {
      type: "blockClaimResult";
      ok: boolean;
      reason?: string;
      /** If true, keep the local claim UI; only the message is informational. */
      recoverable?: boolean;
      x?: number;
      z?: number;
      amountNim?: string;
    }
  | {
      type: "joinRoomFailed";
      roomId: string;
      reason: "not_found";
    }
  | {
      type: "roomCatalog";
      rooms: Array<{
        id: string;
        displayName: string;
        /** Wallet of the creator; null for built-in rooms. */
        ownerAddress: string | null;
        playerCount: number;
        isPublic: boolean;
        /** Hub / Chamber / Canvas vs player-created. */
        isBuiltin: boolean;
        /** Admin-created official (dynamic id); listed with built-ins when public. */
        isOfficial?: boolean;
        /** Server-side hint for showing edit UI (owner or admin). */
        canEdit: boolean;
        isDeleted?: boolean;
        canDelete?: boolean;
        canRestore?: boolean;
        backgroundHueDeg?: number | null;
      }>;
    }
  | {
      type: "roomActionResult";
      action: "deleteRoom" | "restoreRoom";
      ok: boolean;
      roomId?: string;
      reason?: string;
    }
  | { type: "canvasCountdown"; text: string; msRemaining: number }
  /** Echo for RTT / latency HUD (see `clientPing` inbound). */
  | { type: "clientPong"; id: number };

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
/** Placed objects per room: key = blockKey(x,z,y), value = props. */
const roomPlaced = new Map<string, Map<string, PlacedProps>>();
/** Walkable tiles outside the core room (must connect to core or another extra). */
const roomExtraFloor = new Map<string, Set<string>>();
/** Base-room tiles carved away in custom (dynamic) rooms only; tileKey "x,z". */
const roomBaseFloorRemoved = new Map<string, Set<string>>();

loadWorldState(
  roomPlaced,
  roomExtraFloor,
  roomBaseFloorRemoved,
  lastSpawnByRoom,
  normalizeRoomId
);
registerWorldStateRefs(
  roomPlaced,
  roomExtraFloor,
  roomBaseFloorRemoved,
  lastSpawnByRoom,
  normalizeRoomId
);

/** Canvas room timer (in milliseconds) - 1 minute */
const CANVAS_TIMER_DURATION_MS = 1 * 60 * 1000;
const CANVAS_SPAWN_X = 0;
const CANVAS_SPAWN_Z = 14;
const CANVAS_COUNTDOWN_MS = 15_000;
/** Cooldown period between rounds (in milliseconds) - 10 seconds */
const CANVAS_COOLDOWN_MS = 10 * 1000;

// Initialize canvas room with maze layout
function generateCanvasMaze(): void {
  const canvasId = normalizeRoomId(CANVAS_ROOM_ID);
  const bounds = getRoomBaseBounds(canvasId);
  
  // Spawn point where players enter
  const spawnX = CANVAS_SPAWN_X;
  const spawnZ = CANVAS_SPAWN_Z;
  
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
      pyramid: false,
      pyramidBaseScale: 1,
      sphere: false,
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
    pyramid: false,
    pyramidBaseScale: 1,
    sphere: false,
    ramp: false,
    rampDir: 0,
    colorId: 4, // Blue color for exit portal
    locked: true, // Lock so players can't edit it
  });
  
  // Broadcast the new maze to all players in canvas room
  const obstaclesList = Array.from(placed.entries()).map(([k, v]) => {
    const [x, z] = k.split(",").map(Number);
    return {
      x: x!,
      z: z!,
      y: 0,
      ...v,
      pyramidBaseScale: clampPyramidBaseScale(v.pyramidBaseScale ?? 1),
    };
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

const STACK_MAX_LEVEL = 2;

function stackEntriesAt(
  placed: ReadonlyMap<string, PlacedProps>,
  x: number,
  z: number
): Array<{ y: number; key: string; props: PlacedProps }> {
  const out: Array<{ y: number; key: string; props: PlacedProps }> = [];
  for (const [k, props] of placed) {
    const [bx, bz, byRaw] = k.split(",").map(Number);
    const by = Number.isFinite(byRaw) ? Math.floor(byRaw) : 0;
    if (bx === x && bz === z && by >= 0 && by <= STACK_MAX_LEVEL) {
      out.push({ y: by, key: k, props });
    }
  }
  out.sort((a, b) => a.y - b.y);
  return out;
}

/**
 * Resolve a block at (x,z,y). Floor level (y=0) may be stored as legacy `tileKey(x,z)` or `blockKey(x,z,0)`.
 */
function getPlacedAtLevel(
  placed: ReadonlyMap<string, PlacedProps>,
  x: number,
  z: number,
  y: number
): { key: string; props: PlacedProps } | null {
  if (y === 0) {
    const k = getFloorLevelPlacedKey(placed, x, z);
    if (!k) return null;
    const props = placed.get(k);
    if (!props) return null;
    return { key: k, props };
  }
  const key = blockKey(x, z, y);
  const props = placed.get(key);
  if (!props) return null;
  return { key, props };
}

function isOccupiedAtLevel(
  placed: ReadonlyMap<string, PlacedProps>,
  x: number,
  z: number,
  y: number
): boolean {
  return getPlacedAtLevel(placed, x, z, y) !== null;
}

function getTopPlacedAtTile(
  placed: ReadonlyMap<string, PlacedProps>,
  x: number,
  z: number
): { y: number; key: string; props: PlacedProps } | null {
  const entries = stackEntriesAt(placed, x, z);
  if (!entries.length) return null;
  return entries[entries.length - 1]!;
}

function getFloorLevelPlacedAtTile(
  placed: ReadonlyMap<string, PlacedProps>,
  x: number,
  z: number
): PlacedProps | undefined {
  return placed.get(blockKey(x, z, 0)) ?? placed.get(tileKey(x, z));
}

/** Actual `roomPlaced` map key for floor-level block (stacking uses `blockKey(x,z,0)`; legacy uses `tileKey(x,z)`). */
function getFloorLevelPlacedKey(
  placed: ReadonlyMap<string, PlacedProps>,
  x: number,
  z: number
): string | undefined {
  const bk = blockKey(x, z, 0);
  if (placed.has(bk)) return bk;
  const tk = tileKey(x, z);
  if (placed.has(tk)) return tk;
  return undefined;
}

function nextOpenStackLevel(
  placed: ReadonlyMap<string, PlacedProps>,
  x: number,
  z: number
): number | null {
  const used = new Set(stackEntriesAt(placed, x, z).map((e) => e.y));
  for (let y = 0; y <= STACK_MAX_LEVEL; y++) {
    if (!used.has(y)) return y;
  }
  return null;
}

interface BlockClaimSession {
  address: string;
  roomId: string;
  tileX: number;
  tileZ: number;
  /** Stack level in `blockKey(x,z,y)` (0..2), not world Y. */
  tileY: number;
  startedAt: number;
  completeBy: number;
  accumAdjacentMs: number;
  /** Last wall-clock sample for contiguous adjacent-time accumulation (0 = none). */
  lastSampleAt: number;
}

const blockClaimSessions = new Map<string, BlockClaimSession>();
const blockClaimReservation = new Map<
  string,
  { claimId: string; address: string; until: number }
>();
const spentBlockClaimIds = new Map<string, number>();

function blockClaimResKey(roomId: string, tx: number, tz: number, ty: number): string {
  return `${roomId}|${blockKey(tx, tz, ty)}`;
}

function newBlockClaimId(): string {
  return randomBytes(21).toString("base64url");
}

function trimSpentBlockClaimIds(now: number): void {
  const maxAge = 86400_000;
  for (const [id, t] of spentBlockClaimIds) {
    if (now - t > maxAge) spentBlockClaimIds.delete(id);
  }
  while (spentBlockClaimIds.size > 8000) {
    const first = spentBlockClaimIds.keys().next().value;
    if (first === undefined) break;
    spentBlockClaimIds.delete(first);
  }
}

function clearConnPendingBlockClaim(
  roomId: string,
  address: string,
  claimId: string
): void {
  const room = rooms.get(roomId);
  const c = room?.get(address);
  if (c?.pendingBlockClaimId === claimId) {
    c.pendingBlockClaimId = null;
  }
}

function releaseBlockClaimSession(claimId: string): void {
  const s = blockClaimSessions.get(claimId);
  if (!s) return;
  blockClaimSessions.delete(claimId);
  const rk = blockClaimResKey(s.roomId, s.tileX, s.tileZ, s.tileY);
  const r = blockClaimReservation.get(rk);
  if (r?.claimId === claimId) {
    blockClaimReservation.delete(rk);
  }
  clearConnPendingBlockClaim(s.roomId, s.address, claimId);
}

function noteSpentBlockClaimId(claimId: string, now: number): void {
  spentBlockClaimIds.set(claimId, now);
  trimSpentBlockClaimIds(now);
}

function randomClaimRewardLuna(): bigint {
  const luna = randomInt(CLAIM_REWARD_MIN_LUNA, CLAIM_REWARD_MAX_LUNA + 1);
  return BigInt(luna);
}

function claimableCooldownMs(props: PlacedProps): number {
  const c = props.cooldownMs;
  return typeof c === "number" && c > 0 ? c : 60000;
}

/**
 * Re-enable claimable blocks after cooldown using persisted timestamps (in-memory
 * `setTimeout` is lost on restart; stale tile keys after moves also break timers).
 */
function tickClaimableBlockReactivations(now: number): void {
  let any = false;
  for (const [roomId, placed] of roomPlaced) {
    for (const [tileKeyStr, props] of placed) {
      if (!props.claimable || props.active !== false) continue;
      let due: number;
      if (
        typeof props.claimReactivateAtMs === "number" &&
        Number.isFinite(props.claimReactivateAtMs)
      ) {
        due = props.claimReactivateAtMs;
      } else if (
        typeof props.lastClaimedAt === "number" &&
        Number.isFinite(props.lastClaimedAt)
      ) {
        due = props.lastClaimedAt + claimableCooldownMs(props);
      } else {
        continue;
      }
      if (now < due) continue;
      props.active = true;
      delete props.claimReactivateAtMs;
      const tile = obstacleTileFromPlaced(roomId, tileKeyStr);
      if (tile) {
        broadcast(roomId, {
          type: "obstaclesDelta",
          roomId,
          add: [tile],
          remove: [],
        });
        any = true;
      }
    }
  }
  if (any) schedulePersistWorldState();
}

function finalizeClaimableBlockReward(
  roomId: string,
  tileKeyStr: string,
  props: PlacedProps,
  address: string,
  now: number,
  sessionId: string,
  claimId: string
): bigint {
  const rewardLuna = randomClaimRewardLuna();
  const cooldown = claimableCooldownMs(props);
  props.active = false;
  props.lastClaimedAt = now;
  props.claimReactivateAtMs = now + cooldown;
  props.claimedBy = address;
  const tile = obstacleTileFromPlaced(roomId, tileKeyStr);
  if (tile) {
    broadcast(roomId, {
      type: "obstaclesDelta",
      roomId,
      add: [tile],
      remove: [],
    });
  }
  const parts = tileKeyStr.split(",").map(Number);
  const tx = parts[0]!;
  const tz = parts[1]!;
  const ty =
    parts.length >= 3 && Number.isFinite(parts[2])
      ? Math.max(0, Math.min(STACK_MAX_LEVEL, Math.floor(parts[2]!)))
      : 0;
  logGameplayEvent(sessionId, address, roomId, "claim_block", {
    x: tx,
    z: tz,
    y: ty,
    claimId,
    amountLuna: rewardLuna.toString(),
  });

  enqueueNimPayout({
    claimId,
    recipientAddress: address,
    amountLuna: rewardLuna,
    roomId,
    tileKey: tileKeyStr,
  });
  return rewardLuna;
}

/** Tile keys that block floor movement (solid blocks; ramps are walkable). */
function blockingKeys(roomId: string): Set<string> {
  const m = roomPlaced.get(roomId);
  const s = new Set<string>();
  if (!m) return s;
  for (const [k, v] of m) {
    const parts = k.split(",").map(Number);
    const y = Number.isFinite(parts[2]) ? Math.floor(parts[2]!) : 0;
    if (y === 0 && !v.passable && !v.ramp) s.add(tileKey(parts[0]!, parts[1]!));
  }
  return s;
}

function inferStartLayer(
  p: PlayerState,
  placed: ReadonlyMap<string, PlacedProps>
): 0 | 1 {
  const t = snapToTile(p.x, p.z);
  const prop = getFloorLevelPlacedAtTile(placed, t.x, t.z);
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
  const p = getFloorLevelPlacedAtTile(placed, gx, gz);
  if (!p || p.passable || p.ramp) return 0;
  return terrainObstacleHeight(p);
}

function findRecoveryTerrainPath(
  roomId: string,
  player: PlayerState,
  dest: { x: number; z: number },
  goalLayer: 0 | 1,
  placed: ReadonlyMap<string, PlacedProps>,
  extra: ReadonlySet<string>
):
  | {
      full: { x: number; z: number; layer: 0 | 1 }[];
      start: { x: number; z: number; layer: 0 | 1 };
    }
  | null {
  const center = snapToTile(player.x, player.z);
  const seen = new Set<string>();
  const candidates: Array<{ x: number; z: number }> = [];
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = center.x + dx;
      const z = center.z + dz;
      if (!inTileBounds(x, z)) continue;
      const k = tileKey(x, z);
      if (seen.has(k)) continue;
      seen.add(k);
      candidates.push({ x, z });
    }
  }
  candidates.sort((a, b) => {
    const da = (a.x - player.x) ** 2 + (a.z - player.z) ** 2;
    const db = (b.x - player.x) ** 2 + (b.z - player.z) ** 2;
    return da - db;
  });
  // Recovery should only start on top of solids when the player is already
  // effectively at block-top height. This prevents floor-level "wall climb"
  // snaps caused by seam rounding near solid tiles.
  let canStartOnTop = false;
  for (const c of candidates) {
    const prop = placed.get(blockKey(c.x, c.z, 0));
    if (!prop || prop.passable || prop.ramp) continue;
    if (player.y >= terrainObstacleHeight(prop) - 0.2) {
      canStartOnTop = true;
      break;
    }
  }
  for (const c of candidates) {
    const prop = placed.get(blockKey(c.x, c.z, 0));
    const starts: (0 | 1)[] = [];
    if (isWalkableForRoom(roomId, c.x, c.z) && (!prop || prop.passable || prop.ramp)) {
      starts.push(0);
    }
    if (canStartOnTop && prop && !prop.passable && !prop.ramp) {
      starts.push(1);
    }
    for (const startLayer of starts) {
      const full = pathfindTerrain(
        c.x,
        c.z,
        startLayer,
        dest.x,
        dest.z,
        goalLayer,
        placed,
        extra,
        roomId,
        baseRemovedReadonly(roomId)
      );
      if (full && full.length > 0) {
        return { full, start: { x: c.x, z: c.z, layer: startLayer } };
      }
    }
  }
  return null;
}

function obstacleTileFromPlaced(roomId: string, tileKeyStr: string): ObstacleTile | null {
  const placed = roomPlaced.get(roomId);
  if (!placed) return null;
  const v = placed.get(tileKeyStr);
  if (!v) return null;
  const [x, z, yRaw] = tileKeyStr.split(",").map(Number);
  const y = Number.isFinite(yRaw) ? Math.max(0, Math.min(2, Math.floor(yRaw))) : 0;
  const signboard = getSignboardAt(roomId, x, z);
  return {
    x: x!,
    z: z!,
    y,
    passable: v.passable,
    half: v.half ?? false,
    quarter: v.quarter ?? false,
    hex: v.hex ?? false,
    pyramid: v.pyramid ?? false,
    pyramidBaseScale: clampPyramidBaseScale(v.pyramidBaseScale ?? 1),
    sphere: v.sphere ?? false,
    ramp: v.ramp ?? false,
    rampDir: Math.max(0, Math.min(3, Math.floor(v.rampDir ?? 0))),
    colorId: clampColorId(v.colorId ?? 0),
    signboardId: signboard?.id,
    locked: v.locked ?? false,
    // Experimental: claimable blocks
    claimable: v.claimable,
    active: v.active,
    cooldownMs: v.cooldownMs,
    lastClaimedAt: v.lastClaimedAt,
    claimReactivateAtMs: v.claimReactivateAtMs,
    claimedBy: v.claimedBy,
    teleporter: v.teleporter,
  };
}

function obstaclesToList(roomId: string): ObstacleTile[] {
  const m = roomPlaced.get(roomId);
  if (!m) return [];
  const out: ObstacleTile[] = [];
  const signboards = getSignboardsForRoom(roomId);
  const signboardMap = new Map(signboards.map((s) => [tileKey(s.x, s.z), s.id]));
  
  for (const [k, v] of m) {
    const [x, z, yRaw] = k.split(",").map(Number);
    const y = Number.isFinite(yRaw) ? Math.max(0, Math.min(2, Math.floor(yRaw))) : 0;
    out.push({
      x: x!,
      z: z!,
      y,
      passable: v.passable,
      half: v.half ?? false,
      quarter: v.quarter ?? false,
      hex: v.hex ?? false,
      pyramid: v.pyramid ?? false,
      pyramidBaseScale: clampPyramidBaseScale(v.pyramidBaseScale ?? 1),
      sphere: v.sphere ?? false,
      ramp: v.ramp ?? false,
      rampDir: Math.max(0, Math.min(3, Math.floor(v.rampDir ?? 0))),
      colorId: clampColorId(v.colorId ?? 0),
      signboardId: signboardMap.get(k),
      locked: v.locked ?? false,
      // Experimental: claimable blocks
      claimable: v.claimable,
      active: v.active,
      cooldownMs: v.cooldownMs,
      lastClaimedAt: v.lastClaimedAt,
      claimReactivateAtMs: v.claimReactivateAtMs,
      claimedBy: v.claimedBy,
      teleporter: v.teleporter,
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

function baseFloorRemovedEnsure(roomId: string): Set<string> {
  let s = roomBaseFloorRemoved.get(roomId);
  if (!s) {
    s = new Set();
    roomBaseFloorRemoved.set(roomId, s);
  }
  return s;
}

function baseRemovedReadonly(
  roomId: string
): ReadonlySet<string> | undefined {
  if (!isPlayerCreatedRoom(roomId)) return undefined;
  const s = roomBaseFloorRemoved.get(roomId);
  if (!s || s.size === 0) return undefined;
  return s;
}

function removedBaseFloorToList(roomId: string): ExtraFloorTile[] {
  const s = roomBaseFloorRemoved.get(roomId);
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
  return isWalkableTile(
    x,
    z,
    extraFloorSet(roomId),
    roomId,
    baseRemovedReadonly(roomId)
  );
}

/** New extra tile must be outside the core grid and orthogonally adjacent to some walkable tile. */
function canPlaceExtraFloor(roomId: string, x: number, z: number): boolean {
  if (isPlayerCreatedRoom(roomId)) return false;
  const ex = extraFloorSet(roomId);
  const br = baseRemovedReadonly(roomId);
  if (ex.has(tileKey(x, z))) return false;
  if (isBaseTile(x, z, roomId)) return false;
  for (const [dx, dz] of ADJ_DIRS) {
    if (isWalkableTile(x + dx, z + dz, ex, roomId, br)) return true;
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
  const prop = getFloorLevelPlacedAtTile(placed, t.x, t.z);
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
  let recipients = 0;
  for (const [addr, c] of r) {
    if (except && addr === except) continue;
    if (c.ws.readyState === 1) recipients += 1;
  }
  if (recipients > 0) {
    recordGameWsOutbound(
      msg.type,
      Buffer.byteLength(payload, "utf8"),
      recipients
    );
  }
  for (const [addr, c] of r) {
    if (except && addr === except) continue;
    if (c.ws.readyState === 1) c.ws.send(payload);
  }
  if (msg.type === "playerLeft") {
    pruneTickBaselinePlayer(roomId, msg.address);
  } else if (msg.type === "playerJoined") {
    mergeTickBaselinePlayer(roomId, msg.player);
  }
}

function broadcastAll(msg: OutMsg): void {
  const payload = JSON.stringify(msg);
  let recipients = 0;
  for (const room of rooms.values()) {
    for (const c of room.values()) {
      if (c.ws.readyState === 1) recipients += 1;
    }
  }
  if (recipients > 0) {
    recordGameWsOutbound(
      msg.type,
      Buffer.byteLength(payload, "utf8"),
      recipients
    );
  }
  for (const room of rooms.values()) {
    for (const c of room.values()) {
      if (c.ws.readyState === 1) c.ws.send(payload);
    }
  }
}

function countRealPlayersInRoom(roomId: string): number {
  const r = rooms.get(roomId);
  if (!r) return 0;
  let n = 0;
  for (const c of r.values()) {
    if (!c.displayName.startsWith("[NPC] ")) n += 1;
  }
  return n;
}

/** 6-char codes are case-insensitive; other ids use normal normalization. */
function normalizeJoinRoomId(raw: string): string {
  const t = String(raw).trim().replace(/\s+/g, "");
  if (/^[A-Za-z0-9]{6}$/.test(t)) return t.toLowerCase();
  return normalizeRoomId(raw);
}

function roomCatalogMessage(forAddress: string): Extract<OutMsg, { type: "roomCatalog" }> {
  const viewer = compactAddress(forAddress);
  const admin = isAdmin(forAddress);
  const defs = listRoomDefinitions();
  const catalogRooms: Array<{
    id: string;
    displayName: string;
    ownerAddress: string | null;
    playerCount: number;
    isPublic: boolean;
    isBuiltin: boolean;
    isOfficial: boolean;
    canEdit: boolean;
    isDeleted?: boolean;
    canDelete?: boolean;
    canRestore?: boolean;
    backgroundHueDeg?: number | null;
    backgroundNeutral?: RoomBackgroundNeutral | null;
  }> = [];
  for (const d of defs) {
    if (d.isBuiltin) {
      if (!d.isPublic && !admin) {
        continue;
      }
      const builtinBg = getBuiltinRoomBackgroundState(d.id);
      catalogRooms.push({
        id: d.id,
        displayName: d.displayName,
        ownerAddress: null,
        playerCount: countRealPlayersInRoom(d.id),
        isPublic: d.isPublic,
        isBuiltin: true,
        isOfficial: false,
        canEdit: admin,
        isDeleted: false,
        canDelete: false,
        canRestore: false,
        backgroundHueDeg: builtinBg.hueDeg,
        backgroundNeutral: builtinBg.neutral,
      });
      continue;
    }
    if (!d.isPublic) {
      const ownerC = d.ownerAddress ? compactAddress(d.ownerAddress) : "";
      if (!admin && viewer !== ownerC) continue;
    }
    const canEdit =
      admin ||
      (!!d.ownerAddress && compactAddress(d.ownerAddress) === viewer);
    const canDelete =
      admin ||
      (!!d.ownerAddress && compactAddress(d.ownerAddress) === viewer);
    catalogRooms.push({
      id: d.id,
      displayName: d.displayName,
      ownerAddress: d.ownerAddress,
      playerCount: countRealPlayersInRoom(d.id),
      isPublic: d.isPublic,
      isBuiltin: false,
      isOfficial: Boolean(d.isOfficial),
      canEdit,
      isDeleted: false,
      canDelete,
      canRestore: false,
      backgroundHueDeg:
        d.backgroundHueDeg === undefined ? null : d.backgroundHueDeg,
      backgroundNeutral:
        d.backgroundNeutral === undefined ? null : d.backgroundNeutral,
    });
  }
  if (admin) {
    for (const d of listDeletedRoomDefinitions()) {
      catalogRooms.push({
        id: d.id,
        displayName: d.displayName,
        ownerAddress: d.ownerAddress,
        playerCount: countRealPlayersInRoom(d.id),
        isPublic: d.isPublic,
        isBuiltin: false,
        isOfficial: Boolean(d.isOfficial),
        canEdit: false,
        isDeleted: true,
        canDelete: false,
        canRestore: true,
        backgroundHueDeg:
          d.backgroundHueDeg === undefined ? null : d.backgroundHueDeg,
        backgroundNeutral:
          d.backgroundNeutral === undefined ? null : d.backgroundNeutral,
      });
    }
  }
  return { type: "roomCatalog", rooms: catalogRooms };
}

function broadcastRoomCatalogToAll(): void {
  for (const room of rooms.values()) {
    for (const c of room.values()) {
      if (c.ws.readyState === 1) {
        wsSafeSend(c.ws, roomCatalogMessage(c.address));
      }
    }
  }
}

function sendRoomCatalog(ws: WebSocket, address: string): void {
  wsSafeSend(ws, roomCatalogMessage(address));
}

function countOnlineRealPlayers(): number {
  let total = 0;
  for (const room of rooms.values()) {
    for (const c of room.values()) {
      if (!c.displayName.startsWith("[NPC] ")) total += 1;
    }
  }
  return total;
}

function broadcastOnlineCount(): void {
  broadcastAll({ type: "onlineCount", count: countOnlineRealPlayers() });
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

function playerToOutState(conn: ClientConn): PlayerState {
  const base = conn.nimSendIntent
    ? { ...conn.player, nimSendAway: true }
    : { ...conn.player };
  if (!conn.chatTyping) return base;
  return { ...base, chatTyping: true };
}

function snapshotPlayers(roomId: string): PlayerState[] {
  const humans = [...roomOf(roomId).values()].map(playerToOutState);
  const fakes = roomFakePlayers.get(roomId);
  if (!fakes?.size) return humans;
  for (const { player } of fakes.values()) {
    humans.push({ ...player });
  }
  return humans;
}

/** Canvas room timer state */
let canvasTimerEndTime = 0;
let canvasTimerActive = false;
/** Canvas room cooldown state */
let canvasCooldownEndTime = 0;
let canvasCooldownActive = false;
let canvasCountdownEndTime = 0;
let canvasCountdownActive = false;
let canvasCountdownLastSecond = -1;
let canvasRoundEnding = false;
/** Track steps taken by each player in canvas room */
const canvasPlayerSteps = new Map<string, number>();
/** Track players who have finished the maze, in order */
const canvasFinishers: Array<{ address: string; displayName: string; timestamp: number }> = [];

function mazePortalBlockedSeconds(): number | null {
  if (canvasCooldownActive) {
    return Math.max(1, Math.ceil((canvasCooldownEndTime - Date.now()) / 1000));
  }
  if (canvasTimerActive) {
    return Math.max(1, Math.ceil((canvasTimerEndTime - Date.now()) / 1000));
  }
  /** Evacuating canvas → hub after round end; block entry until cooldown applies. */
  if (canvasRoundEnding) {
    if (canvasCooldownActive) {
      return Math.max(1, Math.ceil((canvasCooldownEndTime - Date.now()) / 1000));
    }
    return 1;
  }
  return null;
}

function sendMazePortalBlockedBubble(conn: ClientConn): void {
  const sec = mazePortalBlockedSeconds();
  if (sec === null) return;
  wsSafeSend(conn.ws, {
    type: "chat",
    from: "Maze",
    fromAddress: conn.address,
    text: `Portal to maze opens in ${sec} seconds`,
    at: Date.now(),
    bubbleOnly: true,
  });
}

function isExitPortalTile(tileProps: PlacedProps | undefined): boolean {
  return Boolean(
    tileProps &&
      tileProps.passable &&
      tileProps.quarter &&
      tileProps.hex &&
      tileProps.colorId === 4 &&
      tileProps.locked &&
      !tileProps.teleporter
  );
}

const TELEPORTER_VISUAL: PlacedProps = {
  passable: true,
  quarter: true,
  hex: true,
  pyramid: false,
  pyramidBaseScale: 1,
  sphere: false,
  half: false,
  ramp: false,
  rampDir: 0,
  colorId: 4,
  locked: true,
};

function placePendingTeleporterAt(
  conn: ClientConn,
  roomId: string,
  x: number,
  z: number
): boolean {
  const address = conn.address;
  if (!canEditRoomContent(roomId, address)) return false;
  if (normalizeRoomId(roomId) === CANVAS_ROOM_ID) return false;
  if (!hasRoom(roomId)) return false;

  const placed = placedMap(roomId);
  const extra = extraFloorSet(roomId);
  const yLevel = nextOpenStackLevel(placed, x, z);
  if (yLevel === null) return false;
  const k = blockKey(x, z, yLevel);
  if (
    yLevel === 0 &&
    !canPlaceTeleporterFoot(
      roomId,
      x,
      z,
      placed,
      extra,
      baseRemovedReadonly(roomId)
    )
  )
    return false;
  if (yLevel > 0 && !getPlacedAtLevel(placed, x, z, yLevel - 1)) return false;
  if (normalizeRoomId(roomId) === HUB_ROOM_ID && isHubSpawnSafeZone(x, z)) return false;
  if (yLevel === 0 && getSignboardAt(roomId, x, z)) return false;
  for (const [rid, r] of rooms) {
    for (const c of r.values()) {
      const st = snapToTile(c.player.x, c.player.z);
      if (yLevel === 0 && normalizeRoomId(rid) === normalizeRoomId(roomId) && st.x === x && st.z === z) {
        return false;
      }
    }
  }

  placed.set(k, {
    ...TELEPORTER_VISUAL,
    teleporter: { pending: true },
  });
  const nRoom = normalizeRoomId(roomId);
  const d = obstacleTileFromPlaced(nRoom, k);
  if (d) {
    broadcast(nRoom, {
      type: "obstaclesDelta",
      roomId: nRoom,
      add: [d],
      remove: [],
    });
  }
  schedulePersistWorldState();
  logGameplayEvent(conn.sessionId, address, nRoom, "place_pending_teleporter", { x, z, y: yLevel });
  return true;
}

function roomCatalogDisplayNameForTeleporter(roomId: string): string {
  const id = normalizeRoomId(roomId);
  const def = listRoomDefinitions().find((d) => normalizeRoomId(d.id) === id);
  const n = def?.displayName?.trim();
  return n && n.length > 0 ? n : id;
}

/** One-way teleporter: only the source tile is placed; destination is where the player warps. */
function configureTeleporterDestination(
  conn: ClientConn,
  srcRoomId: string,
  srcX: number,
  srcZ: number,
  srcY: number,
  destRoomId: string,
  destX: number,
  destZ: number
): boolean {
  const address = conn.address;
  if (!canEditRoomContent(srcRoomId, address)) return false;
  if (!canEditRoomContent(destRoomId, address)) return false;
  if (normalizeRoomId(srcRoomId) === CANVAS_ROOM_ID || normalizeRoomId(destRoomId) === CANVAS_ROOM_ID) {
    return false;
  }
  if (!hasRoom(destRoomId)) return false;

  const srcPlaced = placedMap(srcRoomId);
  const destPlaced = placedMap(destRoomId);
  const destExtra = extraFloorSet(destRoomId);

  const srcResolved = getPlacedAtLevel(srcPlaced, srcX, srcZ, srcY);
  if (!srcResolved?.props.teleporter) return false;
  const canonicalSrc = blockKey(srcX, srcZ, srcY);
  if (srcResolved.key !== canonicalSrc) {
    srcPlaced.delete(srcResolved.key);
  }

  const nDest = normalizeRoomId(destRoomId);
  const nSrc = normalizeRoomId(srcRoomId);
  let warpX = destX;
  let warpZ = destZ;
  if (nDest === HUB_ROOM_ID) {
    warpX = 0;
    warpZ = 0;
  }

  /* Hub destination is always (0,0); skip empty-floor check used for other rooms. */
  if (nDest !== HUB_ROOM_ID) {
    if (
      !canPlaceTeleporterFoot(
        destRoomId,
        warpX,
        warpZ,
        destPlaced,
        destExtra,
        baseRemovedReadonly(destRoomId)
      )
    )
      return false;
  }

  if (normalizeRoomId(srcRoomId) === HUB_ROOM_ID && isHubSpawnSafeZone(srcX, srcZ)) return false;

  if (nSrc === nDest && srcX === warpX && srcZ === warpZ) {
    return false;
  }

  if (getSignboardAt(destRoomId, warpX, warpZ)) return false;

  for (const [rid, r] of rooms) {
    for (const c of r.values()) {
      if (c.address === address) continue;
      const st = snapToTile(c.player.x, c.player.z);
      if (normalizeRoomId(rid) === normalizeRoomId(srcRoomId) && st.x === srcX && st.z === srcZ) {
        return false;
      }
      if (normalizeRoomId(rid) === normalizeRoomId(destRoomId) && st.x === warpX && st.z === warpZ) {
        return false;
      }
    }
  }

  srcPlaced.set(canonicalSrc, {
    ...TELEPORTER_VISUAL,
    teleporter: {
      targetRoomId: nDest,
      targetX: warpX,
      targetZ: warpZ,
      targetRoomDisplayName: roomCatalogDisplayNameForTeleporter(nDest),
    },
  });

  const d1 = obstacleTileFromPlaced(nSrc, canonicalSrc);
  if (d1) {
    broadcast(nSrc, {
      type: "obstaclesDelta",
      roomId: nSrc,
      add: [d1],
      remove: [],
    });
  }
  schedulePersistWorldState();
  logGameplayEvent(conn.sessionId, address, nSrc, "configure_teleporter", {
    srcX,
    srcZ,
    srcY,
    destRoomId: nDest,
    destX: warpX,
    destZ: warpZ,
  });
  return true;
}

function handleCanvasPortalEntry(conn: ClientConn, room: Map<string, ClientConn>): void {
  const alreadyFinished = canvasFinishers.some((f) => f.address === conn.address);
  if (alreadyFinished) return;
  const position = canvasFinishers.length + 1;
  const displayName = conn.displayName || walletDisplayName(conn.address);
  canvasFinishers.push({
    address: conn.address,
    displayName,
    timestamp: Date.now(),
  });
  const roundStartedAt = canvasTimerEndTime - CANVAS_TIMER_DURATION_MS;
  if (canvasTimerActive && Number.isFinite(roundStartedAt) && roundStartedAt > 0) {
    const elapsedMs = Math.max(1, Date.now() - roundStartedAt);
    const rec = recordMazeCompletion(conn.address, elapsedMs);
    if (rec.improved) {
      const sec = (rec.record.bestMs / 1000).toFixed(2);
      wsSafeSend(conn.ws, {
        type: "chat",
        from: "System",
        fromAddress: "",
        text: `New personal best in The Maze: ${sec}s`,
        at: Date.now(),
      });
    }
  }

  const suffix =
    position === 1 ? "st" : position === 2 ? "nd" : position === 3 ? "rd" : "th";

  broadcast(CANVAS_ROOM_ID, {
    type: "chat",
    from: "System",
    fromAddress: "",
    text: `${displayName} finished The Maze in ${position}${suffix} place!`,
    at: Date.now(),
  });

  if (position === 1) {
    const mazeRewardClaimId = `maze-first-${canvasTimerEndTime}-${conn.address}`;
    enqueueNimPayout({
      claimId: mazeRewardClaimId,
      recipientAddress: conn.address,
      amountLuna: LUNA_PER_NIM,
      roomId: CANVAS_ROOM_ID,
      tileKey: "maze-first-place",
      txMessage: "You won The Maze on Nimiq.Space!",
    });
    wsSafeSend(conn.ws, {
      type: "chat",
      from: "System",
      fromAddress: "",
      text: 'You earned 1.0000 NIM - "Reward for 1st place in The Maze Nimiq.Space"',
      at: Date.now(),
    });
  }

  console.log(`[canvas] Player ${displayName} finished in position ${position}`);

  setTimeout(() => {
    const current = room.get(conn.address);
    if (current) {
      teleportPlayer(current, HUB_ROOM_ID, 0, 0);
      if (position === 1) {
        broadcast(HUB_ROOM_ID, {
          type: "chat",
          from: displayName,
          fromAddress: conn.address,
          text: "Just won 1.0000 NIM from The Maze!",
          at: Date.now(),
        });
      }
    }
  }, 1500);
}

function wsSafeSend(ws: WebSocket, msg: OutMsg): void {
  if (ws.readyState !== 1) return;
  const payload = JSON.stringify(msg);
  recordGameWsOutbound(msg.type, Buffer.byteLength(payload, "utf8"), 1);
  ws.send(payload);
}

function startCanvasTimer(): void {
  canvasTimerEndTime = Date.now() + CANVAS_TIMER_DURATION_MS;
  canvasTimerActive = true;
  canvasCountdownActive = false;
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

function startCanvasCountdown(): void {
  if (canvasTimerActive || canvasCooldownActive || canvasCountdownActive) return;
  canvasCountdownEndTime = Date.now() + CANVAS_COUNTDOWN_MS;
  canvasCountdownActive = true;
  canvasCountdownLastSecond = Math.ceil(CANVAS_COUNTDOWN_MS / 1000);
  broadcast(CANVAS_ROOM_ID, {
    type: "canvasCountdown",
    text: String(canvasCountdownLastSecond),
    msRemaining: CANVAS_COUNTDOWN_MS,
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

function checkCanvasCountdown(): void {
  if (!canvasCountdownActive) return;
  const now = Date.now();
  const msRemaining = Math.max(0, canvasCountdownEndTime - now);
  if (msRemaining <= 0) {
    canvasCountdownActive = false;
    canvasCountdownLastSecond = -1;
    broadcast(CANVAS_ROOM_ID, {
      type: "canvasCountdown",
      text: "GO!",
      msRemaining: 0,
    });
    startCanvasTimer();
    return;
  }
  const sec = Math.ceil(msRemaining / 1000);
  if (sec === canvasCountdownLastSecond) return;
  canvasCountdownLastSecond = sec;
  const text = String(sec);
  broadcast(CANVAS_ROOM_ID, {
    type: "canvasCountdown",
    text,
    msRemaining,
  });
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
  canvasRoundEnding = true;
  console.log(`[canvas] Round ended`);

  const canvasRoom = rooms.get(CANVAS_ROOM_ID);
  if (!canvasRoom) {
    canvasRoundEnding = false;
    return;
  }

  /** Start cooldown immediately so hub players cannot enter during the evacuation delay. */
  startCanvasCooldown();
  
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

    canvasRoundEnding = false;
  }, 2000);
}

function teleportAllInRoomToHub(roomIdRaw: string): void {
  const roomId = normalizeRoomId(roomIdRaw);
  const room = rooms.get(roomId);
  if (!room || room.size === 0) return;
  const occupants = [...room.values()];
  for (const conn of occupants) {
    teleportPlayer(conn, HUB_ROOM_ID, 0, 0);
  }
}

function teleportPlayer(conn: ClientConn, targetRoomId: string, x: number, z: number): void {
  const address = conn.player.address;

  let currentRoomId: string | null = null;
  for (const [roomId, room] of rooms) {
    if (room.has(address)) {
      currentRoomId = roomId;
      break;
    }
  }

  const nTarget = normalizeRoomId(targetRoomId);
  const enteringCanvas =
    nTarget === CANVAS_ROOM_ID &&
    (currentRoomId === null ||
      normalizeRoomId(currentRoomId) !== CANVAS_ROOM_ID);
  if (enteringCanvas && mazePortalBlockedSeconds() !== null) {
    sendMazePortalBlockedBubble(conn);
    return;
  }

  if (conn.pendingBlockClaimId) {
    releaseBlockClaimSession(conn.pendingBlockClaimId);
  }

  if (
    currentRoomId !== null &&
    normalizeRoomId(currentRoomId) === nTarget
  ) {
    conn.player.x = x;
    conn.player.z = z;
    conn.player.y = 0;
    conn.pathQueue = [];
    broadcastRoomStateFull(currentRoomId);
    return;
  }

  if (currentRoomId !== null) {
    const room = rooms.get(currentRoomId);
    if (room) {
      room.delete(address);
      broadcast(currentRoomId, { type: "playerLeft", address }, address);
    }
  }

  conn.player.x = x;
  conn.player.z = z;
  conn.player.y = 0;
  conn.pathQueue = [];

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
    .map(playerToOutState);
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
  const billboardsWire = getBillboardsForRoom(targetRoomId).map(billboardToWire);
  
  const isCanvas = normalizeRoomId(targetRoomId) === CANVAS_ROOM_ID;
  const allowEdit = canEditRoomContent(targetRoomId, address);
  const allowFloorExpand = allowEdit && !isCanvas;
  const nWelcomeRoom = normalizeRoomId(targetRoomId);
  const welcomeBgState = isPlayerCreatedRoom(nWelcomeRoom)
    ? getDynamicRoomBackgroundState(nWelcomeRoom)
    : getBuiltinRoomBackgroundState(nWelcomeRoom);
  const allowRoomBackgroundHueEdit = isPlayerCreatedRoom(nWelcomeRoom)
    ? allowActorRoomBackgroundHueEdit(
        nWelcomeRoom,
        compactAddress(conn.address),
        isAdmin(conn.address)
      )
    : false;

  wsSafeSend(conn.ws, {
      type: "welcome",
      self: playerToOutState(conn),
      others,
      roomId: targetRoomId,
      roomBounds: rb,
      doors,
      placeRadiusBlocks: PLACE_RADIUS_BLOCKS,
      obstacles: obstaclesToList(targetRoomId),
      extraFloorTiles: extraFloorToList(targetRoomId),
      removedBaseFloorTiles: removedBaseFloorToList(targetRoomId),
      canvasClaims: isCanvas ? getClaimsInBounds(rb.minX, rb.maxX, rb.minZ, rb.maxZ) : undefined,
      signboards,
      billboards: billboardsWire,
      voxelTexts: getVoxelTextsForRoom(targetRoomId),
      onlinePlayerCount: countOnlineRealPlayers(),
      allowPlaceBlocks: allowEdit,
      allowExtraFloor: allowFloorExpand,
      allowRoomBackgroundHueEdit,
      roomBackgroundHueDeg: welcomeBgState.hueDeg,
      roomBackgroundNeutral: welcomeBgState.neutral,
    } satisfies OutMsg);
  sendRoomCatalog(conn.ws, address);

  // Notify others in new room
  broadcast(targetRoomId, { type: "playerJoined", player: playerToOutState(conn) }, address);
}

export function startRoomTick(): void {
  loadCanvasClaims();
  loadSignboards();
  loadBillboards();
  loadVoxelTexts();
  loadMazeRecords();
  tickClaimableBlockReactivations(Date.now());
  setInterval(() => {
    const now = Date.now();

    tickClaimableBlockReactivations(now);
    
    // Check canvas timer
    checkCanvasTimer();
    
    // Check canvas cooldown
    checkCanvasCooldown();
    checkCanvasCountdown();
    
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
          for (const tile of result.arrivedTiles) {
            // Check if player reached the exit portal (blue hexagonal quarter block)
            const tileKey_str = tileKey(tile.x, tile.z);
            const tileProps = placed.get(tileKey_str);
            const isExitPortal = isExitPortalTile(tileProps);
            
            if (isExitPortal) {
              handleCanvasPortalEntry(c, room);
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
                  roomId,
                  baseRemovedReadonly(roomId)
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
      broadcastTickStateIfAllowed(roomId, room, now, changed);

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
  spawnHint?: { x: number; z: number },
  sessionFlags?: { nimiqPay?: boolean }
): void {
  const requestedRoomId = normalizeRoomId(roomIdRaw);
  let roomId = requestedRoomId;
  let canvasGateRedirect = false;
  if (requestedRoomId === CANVAS_ROOM_ID) {
    if (canvasCooldownActive || canvasTimerActive || canvasRoundEnding) {
      canvasGateRedirect = true;
      roomId = HUB_ROOM_ID;
    }
  }

  const spawnHintForPlacement = canvasGateRedirect
    ? { x: HUB_MAZE_EXIT_SPAWN.x, z: HUB_MAZE_EXIT_SPAWN.z }
    : spawnHint;
  
  ensureFakePlayers(roomId);
  const room = roomOf(roomId);
  const compactSelf = compactAddress(address);
  const displayName = getEffectivePlayerDisplayName(compactSelf);
  const recentAliases = getRecentAliases(compactSelf);

  const player: PlayerState = {
    address,
    displayName,
    recentAliases,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vz: 0,
    ...(sessionFlags?.nimiqPay ? { nimiqPay: true } : {}),
  };

  let placedSpawn = false;
  let resolvedSpawnTile = false;
  const isCanvasRoom = normalizeRoomId(roomId) === CANVAS_ROOM_ID;
  const isChamberRoom = normalizeRoomId(roomId) === CHAMBER_ROOM_ID;
  if (isCanvasRoom) {
    const t = snapToTile(CANVAS_SPAWN_X, CANVAS_SPAWN_Z);
    if (isWalkableForRoom(roomId, t.x, t.z)) {
      player.x = t.x;
      player.z = t.z;
      placedSpawn = true;
      resolvedSpawnTile = true;
    }
  } else if (isChamberRoom) {
    const t = snapToTile(CHAMBER_DEFAULT_SPAWN.x, CHAMBER_DEFAULT_SPAWN.z);
    if (isWalkableForRoom(roomId, t.x, t.z)) {
      player.x = t.x;
      player.z = t.z;
      placedSpawn = true;
      resolvedSpawnTile = true;
    }
  } else if (
    spawnHintForPlacement &&
    Number.isFinite(spawnHintForPlacement.x) &&
    Number.isFinite(spawnHintForPlacement.z)
  ) {
    const t = snapToTile(spawnHintForPlacement.x, spawnHintForPlacement.z);
    if (isWalkableForRoom(roomId, t.x, t.z)) {
      player.x = t.x;
      player.z = t.z;
      placedSpawn = true;
      resolvedSpawnTile = true;
    }
  }
  if (!placedSpawn && !isCanvasRoom) {
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
    pendingBlockClaimId: null,
    lastBlockClaimBeginAt: 0,
    lastBlockClaimTickAt: 0,
    lastBlockClaimCompleteAttemptAt: 0,
    nimSendIntent: false,
    chatTyping: false,
  };

  room.set(address, conn);
  console.log(
    `[rooms] connect ${address.slice(0, 12)}… room=${roomId} name="${displayName}"`
  );

  const others = snapshotPlayers(roomId).filter((p) => p.address !== address);
  const selfOut = playerToOutState(conn);

  const rb = getRoomBaseBounds(roomId);
  const doors = getDoorsForRoom(roomId).map((d) => ({
    x: d.x,
    z: d.z,
    targetRoomId: normalizeRoomId(d.targetRoomId),
    spawnX: d.spawnX,
    spawnZ: d.spawnZ,
  }));

  const isCanvas = normalizeRoomId(roomId) === CANVAS_ROOM_ID;
  const allowEdit = canEditRoomContent(roomId, address);
  const allowFloorExpand = allowEdit && !isCanvas;
  const nJoinRoom = normalizeRoomId(roomId);
  const joinWelcomeBgState = isPlayerCreatedRoom(nJoinRoom)
    ? getDynamicRoomBackgroundState(nJoinRoom)
    : getBuiltinRoomBackgroundState(nJoinRoom);
  const joinAllowRoomBackgroundHueEdit = isPlayerCreatedRoom(nJoinRoom)
    ? allowActorRoomBackgroundHueEdit(
        nJoinRoom,
        compactAddress(address),
        isAdmin(address)
      )
    : false;

  // Always send a canvas timer snapshot on join:
  // - active round: real remaining time
  // - pre-round countdown: full round duration (1:00)
  if (isCanvas) {
    const timeRemaining = canvasTimerActive
      ? Math.max(0, canvasTimerEndTime - Date.now())
      : CANVAS_TIMER_DURATION_MS;
    setTimeout(() => {
      wsSafeSend(ws, {
          type: "canvasTimer",
          timeRemaining,
        } satisfies OutMsg);
    }, 100);
  }
  if (isCanvas && canvasCountdownActive) {
    const msRemaining = Math.max(0, canvasCountdownEndTime - Date.now());
    const text =
      msRemaining <= 0 ? "GO!" : String(Math.max(1, Math.ceil(msRemaining / 1000)));
    setTimeout(() => {
      wsSafeSend(ws, {
          type: "canvasCountdown",
          text,
          msRemaining,
        } satisfies OutMsg);
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
  const joinBillboardsWire = getBillboardsForRoom(roomId).map(billboardToWire);

  wsSafeSend(ws, {
      type: "welcome",
      self: selfOut,
      others,
      roomId,
      roomBounds: rb,
      doors,
      placeRadiusBlocks: PLACE_RADIUS_BLOCKS,
      obstacles: obstaclesToList(roomId),
      extraFloorTiles: extraFloorToList(roomId),
      removedBaseFloorTiles: removedBaseFloorToList(roomId),
      canvasClaims: isCanvas ? getClaimsInBounds(rb.minX, rb.maxX, rb.minZ, rb.maxZ) : undefined,
      signboards,
      billboards: joinBillboardsWire,
      voxelTexts: getVoxelTextsForRoom(roomId),
      onlinePlayerCount: countOnlineRealPlayers(),
      allowPlaceBlocks: allowEdit,
      allowExtraFloor: allowFloorExpand,
      allowRoomBackgroundHueEdit: joinAllowRoomBackgroundHueEdit,
      roomBackgroundHueDeg: joinWelcomeBgState.hueDeg,
      roomBackgroundNeutral: joinWelcomeBgState.neutral,
    } satisfies OutMsg);
  sendRoomCatalog(ws, address);

  broadcast(
    roomId,
    { type: "playerJoined", player: playerToOutState(conn) },
    address
  );
  broadcastOnlineCount();

  if (
    roomId === CANVAS_ROOM_ID &&
    !canvasTimerActive &&
    !canvasCountdownActive &&
    !canvasCooldownActive &&
    !canvasRoundEnding
  ) {
    startCanvasCountdown();
  }
  if (canvasGateRedirect) {
    sendMazePortalBlockedBubble(conn);
  }

  ws.on("message", async (raw) => {
    const rawInBytes = utf8ByteLengthOfWsData(raw);
    let data: unknown;
    try {
      data = JSON.parse(String(raw));
    } catch {
      recordGameWsInbound("json_parse_error", rawInBytes);
      return;
    }
    if (!data || typeof data !== "object") {
      recordGameWsInbound("invalid_shape", rawInBytes);
      return;
    }
    const msg = data as Record<string, unknown>;
    const inType = typeof msg.type === "string" ? msg.type : "unknown";
    recordGameWsInbound(inType, rawInBytes);

    if (msg.type === "clientPing") {
      const id = Number((msg as { id?: unknown }).id);
      if (Number.isFinite(id)) {
        wsSafeSend(ws, { type: "clientPong", id } satisfies OutMsg);
      }
      return;
    }

    // Dynamically look up which room the player is currently in
    const currentRoomId = findPlayerRoom(address);
    if (!currentRoomId) {
      console.log(`[rooms] Player ${address} not in any room, ignoring message`);
      return;
    }
    if (msg.type === "listRooms") {
      sendRoomCatalog(ws, address);
      return;
    }

    if (msg.type === "nimSendIntent") {
      conn.nimSendIntent = Boolean(msg.active);
      broadcastRoomStateFull(currentRoomId);
      return;
    }

    if (msg.type === "chatTyping") {
      const next = Boolean((msg as { active?: boolean }).active);
      if (conn.chatTyping === next) return;
      conn.chatTyping = next;
      broadcastRoomStateFull(currentRoomId);
      return;
    }

    if (msg.type === "createRoom") {
      const widthTiles = Number(msg.widthTiles);
      const heightTiles = Number(msg.heightTiles);
      const rawName =
        msg.displayName !== undefined ? String(msg.displayName) : "";
      const displayName =
        rawName.trim().length > 0
          ? rawName.trim()
          : defaultRoomDisplayName(address);
      const isPublic = msg.isPublic === false ? false : true;
      const created = createRoomWithSize(
        widthTiles,
        heightTiles,
        address,
        MAX_OWNED_ROOMS_PER_PLAYER,
        displayName,
        isPublic
      );
      if (!created.ok) {
        wsSafeSend(ws, {
            type: "chat",
            from: "System",
            fromAddress: "SYSTEM",
            text: created.reason,
            at: Date.now(),
          } satisfies OutMsg);
        return;
      }
      broadcastRoomCatalogToAll();
      const spawnX = Math.floor((created.bounds.minX + created.bounds.maxX) / 2);
      const spawnZ = Math.floor((created.bounds.minZ + created.bounds.maxZ) / 2);
      teleportPlayer(conn, created.id, spawnX, spawnZ);
      return;
    }

    if (msg.type === "createOfficialRoom") {
      if (!isAdmin(address)) {
        wsSafeSend(ws, {
            type: "chat",
            from: "System",
            fromAddress: "SYSTEM",
            text: "Only admins can create official rooms.",
            at: Date.now(),
          } satisfies OutMsg);
        return;
      }
      const widthTiles = Number(
        (msg as { widthTiles?: unknown }).widthTiles
      );
      const heightTiles = Number(
        (msg as { heightTiles?: unknown }).heightTiles
      );
      const rawName = String((msg as { displayName?: unknown }).displayName ?? "").trim();
      if (!rawName) {
        wsSafeSend(ws, {
            type: "chat",
            from: "System",
            fromAddress: "SYSTEM",
            text: "Official rooms require a display name.",
            at: Date.now(),
          } satisfies OutMsg);
        return;
      }
      const isPublic =
        (msg as { isPublic?: unknown }).isPublic === false ? false : true;
      const created = createOfficialRoomWithSize(
        widthTiles,
        heightTiles,
        rawName,
        isPublic
      );
      if (!created.ok) {
        wsSafeSend(ws, {
            type: "chat",
            from: "System",
            fromAddress: "SYSTEM",
            text: created.reason,
            at: Date.now(),
          } satisfies OutMsg);
        return;
      }
      broadcastRoomCatalogToAll();
      const spawnX = Math.floor((created.bounds.minX + created.bounds.maxX) / 2);
      const spawnZ = Math.floor((created.bounds.minZ + created.bounds.maxZ) / 2);
      teleportPlayer(conn, created.id, spawnX, spawnZ);
      return;
    }

    if (msg.type === "updateRoom") {
      const roomId = normalizeJoinRoomId(String(msg.roomId ?? ""));
      if (isBuiltinRoomId(roomId)) {
        if (!isAdmin(address)) {
          wsSafeSend(ws, {
              type: "chat",
              from: "System",
              fromAddress: "SYSTEM",
              text: "Only admins can edit official rooms.",
              at: Date.now(),
            } satisfies OutMsg);
          return;
        }
        const patch: {
          displayName?: string;
          isPublic?: boolean;
          backgroundHueDeg?: number | null;
          backgroundNeutral?: RoomBackgroundNeutral | null;
        } = {};
        if (msg.displayName !== undefined) {
          patch.displayName = String(msg.displayName);
        }
        if (msg.isPublic !== undefined) {
          patch.isPublic = Boolean(msg.isPublic);
        }
        if (msg.backgroundHueDeg !== undefined) {
          const norm = normalizeBackgroundHuePatch(
            (msg as { backgroundHueDeg?: unknown }).backgroundHueDeg
          );
          if (!norm.ok) {
            wsSafeSend(ws, {
                type: "chat",
                from: "System",
                fromAddress: "SYSTEM",
                text: norm.reason,
                at: Date.now(),
              } satisfies OutMsg);
            return;
          }
          patch.backgroundHueDeg = norm.hue;
        }
        if (msg.backgroundNeutral !== undefined) {
          const nn = normalizeBackgroundNeutralPatch(
            (msg as { backgroundNeutral?: unknown }).backgroundNeutral
          );
          if (!nn.ok) {
            wsSafeSend(ws, {
                type: "chat",
                from: "System",
                fromAddress: "SYSTEM",
                text: nn.reason,
                at: Date.now(),
              } satisfies OutMsg);
            return;
          }
          patch.backgroundNeutral = nn.neutral;
        }
        if (
          patch.displayName === undefined &&
          patch.isPublic === undefined &&
          patch.backgroundHueDeg === undefined &&
          patch.backgroundNeutral === undefined
        ) {
          wsSafeSend(ws, {
              type: "chat",
              from: "System",
              fromAddress: "SYSTEM",
              text: "Send a display name, public/private setting, and/or background options.",
              at: Date.now(),
            } satisfies OutMsg);
          return;
        }
        const updated = patchBuiltinRoomSettings(roomId, patch);
        if (!updated.ok) {
          wsSafeSend(ws, {
              type: "chat",
              from: "System",
              fromAddress: "SYSTEM",
              text: updated.reason,
              at: Date.now(),
            } satisfies OutMsg);
          return;
        }
        broadcastRoomCatalogToAll();
        if (
          patch.backgroundHueDeg !== undefined ||
          patch.backgroundNeutral !== undefined
        ) {
          const nR = normalizeRoomId(roomId);
          const st = getBuiltinRoomBackgroundState(nR);
          broadcast(nR, {
            type: "roomBackgroundHue",
            roomId: nR,
            hueDeg: st.hueDeg,
            neutral: st.neutral,
          });
        }
        return;
      }
      const patch: {
        displayName?: string;
        isPublic?: boolean;
        backgroundHueDeg?: number | null;
        backgroundNeutral?: RoomBackgroundNeutral | null;
      } = {};
      if (msg.displayName !== undefined) {
        patch.displayName = String(msg.displayName);
      }
      if (msg.isPublic !== undefined) {
        patch.isPublic = Boolean(msg.isPublic);
      }
      if (msg.backgroundHueDeg !== undefined) {
        const norm = normalizeBackgroundHuePatch(
          (msg as { backgroundHueDeg?: unknown }).backgroundHueDeg
        );
        if (!norm.ok) {
          wsSafeSend(ws, {
              type: "chat",
              from: "System",
              fromAddress: "SYSTEM",
              text: norm.reason,
              at: Date.now(),
            } satisfies OutMsg);
          return;
        }
        patch.backgroundHueDeg = norm.hue;
      }
      if (msg.backgroundNeutral !== undefined) {
        const nn = normalizeBackgroundNeutralPatch(
          (msg as { backgroundNeutral?: unknown }).backgroundNeutral
        );
        if (!nn.ok) {
          wsSafeSend(ws, {
              type: "chat",
              from: "System",
              fromAddress: "SYSTEM",
              text: nn.reason,
              at: Date.now(),
            } satisfies OutMsg);
          return;
        }
        patch.backgroundNeutral = nn.neutral;
      }
      if (
        patch.displayName === undefined &&
        patch.isPublic === undefined &&
        patch.backgroundHueDeg === undefined &&
        patch.backgroundNeutral === undefined
      ) {
        wsSafeSend(ws, {
            type: "chat",
            from: "System",
            fromAddress: "SYSTEM",
            text: "Send a display name, public/private setting, and/or background options.",
            at: Date.now(),
          } satisfies OutMsg);
        return;
      }
      const updated = updateDynamicRoomMetadata(
        roomId,
        patch,
        compactAddress(address),
        isAdmin(address)
      );
      if (!updated.ok) {
        wsSafeSend(ws, {
            type: "chat",
            from: "System",
            fromAddress: "SYSTEM",
            text: updated.reason,
            at: Date.now(),
          } satisfies OutMsg);
        return;
      }
      broadcastRoomCatalogToAll();
      if (
        patch.backgroundHueDeg !== undefined ||
        patch.backgroundNeutral !== undefined
      ) {
        const nR = normalizeRoomId(roomId);
        const st = getDynamicRoomBackgroundState(nR);
        broadcast(nR, {
          type: "roomBackgroundHue",
          roomId: nR,
          hueDeg: st.hueDeg,
          neutral: st.neutral,
        });
      }
      return;
    }

    if (msg.type === "deleteRoom") {
      const roomId = normalizeJoinRoomId(String(msg.roomId ?? ""));
      const result = softDeleteDynamicRoom(
        roomId,
        compactAddress(address),
        isAdmin(address)
      );
      if (!result.ok) {
        wsSafeSend(ws, {
            type: "roomActionResult",
            action: "deleteRoom",
            ok: false,
            roomId,
            reason: result.reason,
          } satisfies OutMsg);
        return;
      }
      teleportAllInRoomToHub(roomId);
      wsSafeSend(ws, {
          type: "roomActionResult",
          action: "deleteRoom",
          ok: true,
          roomId,
        } satisfies OutMsg);
      broadcastRoomCatalogToAll();
      return;
    }

    if (msg.type === "restoreRoom") {
      const roomId = normalizeJoinRoomId(String(msg.roomId ?? ""));
      const result = restoreDynamicRoom(roomId, isAdmin(address));
      if (!result.ok) {
        wsSafeSend(ws, {
            type: "roomActionResult",
            action: "restoreRoom",
            ok: false,
            roomId,
            reason: result.reason,
          } satisfies OutMsg);
        return;
      }
      wsSafeSend(ws, {
          type: "roomActionResult",
          action: "restoreRoom",
          ok: true,
          roomId,
        } satisfies OutMsg);
      broadcastRoomCatalogToAll();
      return;
    }

    if (msg.type === "joinRoom") {
      const targetRoomId = normalizeJoinRoomId(String(msg.roomId ?? ""));
      if (!hasRoom(targetRoomId)) {
        wsSafeSend(ws, {
            type: "joinRoomFailed",
            roomId: targetRoomId,
            reason: "not_found",
          } satisfies OutMsg);
        return;
      }
      const b = getRoomBaseBounds(targetRoomId);
      const spawnX = Math.floor((b.minX + b.maxX) / 2);
      const spawnZ = Math.floor((b.minZ + b.maxZ) / 2);
      teleportPlayer(conn, targetRoomId, spawnX, spawnZ);
      return;
    }

    if (msg.type === "moveTo") {
      if (
        normalizeRoomId(currentRoomId) === CANVAS_ROOM_ID &&
        (!canvasTimerActive || canvasCountdownActive)
      ) {
        if (
          !canvasCountdownActive &&
          !canvasCooldownActive &&
          !canvasRoundEnding
        ) {
          startCanvasCountdown();
        }
        return;
      }
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
        currentRoomId,
        baseRemovedReadonly(currentRoomId)
      );
      if (!full || full.length === 0) {
        const recovered = findRecoveryTerrainPath(
          currentRoomId,
          p,
          dest,
          goalLayer,
          placed,
          extra
        );
        if (!recovered) {
          conn.pathQueue = [];
          return;
        }
        // Snap to a nearby valid terrain node when seam rounding picked a bad start.
        p.x = recovered.start.x;
        p.z = recovered.start.z;
        p.y = waypointY(recovered.start.layer, recovered.start.x, recovered.start.z, placed);
        conn.pathQueue = recovered.full.slice(1);
      } else {
        conn.pathQueue = full.slice(1);
      }
      logGameplayEvent(conn.sessionId, address, currentRoomId, "move_to", {
        fromX: start.x,
        fromZ: start.z,
        toX: dest.x,
        toZ: dest.z,
        goalLayer,
      });
      return;
    }

    if (msg.type === "enterPortal") {
      const here = snapToTile(conn.player.x, conn.player.z);
      const tileProps = getTopPlacedAtTile(placedMap(currentRoomId), here.x, here.z)?.props;
      if (tileProps?.teleporter) {
        const t = tileProps.teleporter;
        if ("pending" in t && t.pending) {
          wsSafeSend(ws, {
              type: "chat",
              from: "System",
              fromAddress: "",
              text: "This teleporter has no destination yet. Select it in build mode to set where it goes.",
              at: Date.now(),
            } satisfies OutMsg);
          return;
        }
        if ("targetRoomId" in t) {
          teleportPlayer(conn, normalizeRoomId(t.targetRoomId), t.targetX, t.targetZ);
        }
        return;
      }
      if (normalizeRoomId(currentRoomId) !== CANVAS_ROOM_ID) return;
      if (!isExitPortalTile(tileProps)) return;
      console.log(
        `[canvas] Player ${address.slice(0, 8)}... entered portal from (${here.x}, ${here.z})`
      );
      handleCanvasPortalEntry(conn, room);
      return;
    }

    if (msg.type === "placeBlock") {
      if (!canEditRoomContent(currentRoomId, address)) {
        return;
      }
      
      const now = Date.now();
      if (now - conn.lastPlaceAt < RATE_PLACE_MS) return;
      conn.lastPlaceAt = now;
      const tx = Number(msg.x);
      const tz = Number(msg.z);
      if (!Number.isFinite(tx) || !Number.isFinite(tz)) return;
      const tile = snapToTile(tx, tz);
      if (!withinBlockActionRange(conn.player, tile.x, tile.z)) return;
      if (!isWalkableForRoom(currentRoomId, tile.x, tile.z)) return;
      const placed = placedMap(currentRoomId);
      const yLevel = nextOpenStackLevel(placed, tile.x, tile.z);
      if (yLevel === null) return;
      const k = blockKey(tile.x, tile.z, yLevel);
      for (const c of room.values()) {
        const st = snapToTile(c.player.x, c.player.z);
        if (st.x === tile.x && st.z === tile.z) return;
      }
      const quarter = Boolean(msg.quarter);
      let half = Boolean(msg.half);
      if (quarter) half = false;
      const ramp = Boolean(msg.ramp);
      const rampDir = Math.max(0, Math.min(3, Math.floor(Number(msg.rampDir ?? 0))));
      const prism = normalizeBlockPrismParts({
        hex: Boolean(msg.hex),
        pyramid: Boolean(msg.pyramid),
        sphere: Boolean(msg.sphere),
        ramp,
      });
      const pyramidBaseScale = prism.pyramid
        ? clampPyramidBaseScale(Number(msg.pyramidBaseScale ?? 1))
        : 1;
      const colorId = clampColorId(Number(msg.colorId ?? 0));
      const requestedClaimable = Boolean(msg.claimable);
      const claimable =
        requestedClaimable && canPlaceMineableBlocks(address);
      if (requestedClaimable && !claimable) {
        wsSafeSend(ws, {
            type: "chat",
            from: "System",
            fromAddress: "SYSTEM",
            text: "Only the authorized reward wallet can place mineable blocks.",
            at: now,
          } satisfies OutMsg);
      }
      
      placed.set(k, {
        passable: false,
        half,
        quarter,
        hex: prism.hex,
        pyramid: prism.pyramid,
        pyramidBaseScale,
        sphere: prism.sphere,
        ramp: prism.ramp,
        rampDir: prism.ramp ? rampDir : 0,
        colorId,
        locked: false,
        // Experimental: claimable blocks
        claimable: claimable || undefined,
        active: claimable ? true : undefined, // Start active
        cooldownMs: claimable ? 60000 : undefined, // 60 second cooldown
        lastClaimedAt: undefined,
        claimedBy: undefined,
      });
      const deltaTile = obstacleTileFromPlaced(currentRoomId, k);
      if (deltaTile) {
        broadcast(currentRoomId, {
          type: "obstaclesDelta",
          roomId: currentRoomId,
          add: [deltaTile],
          remove: [],
        });
      }
      schedulePersistWorldState();
      logGameplayEvent(conn.sessionId, address, currentRoomId, "place_block", {
        x: tile.x,
        z: tile.z,
        y: yLevel,
        half,
        quarter,
        hex: prism.hex,
        pyramid: prism.pyramid,
        sphere: prism.sphere,
        ramp: prism.ramp,
        rampDir: prism.ramp ? rampDir : 0,
        colorId,
      });
      return;
    }

    if (msg.type === "placePendingTeleporter") {
      if (!canEditRoomContent(currentRoomId, address)) {
        return;
      }
      const now = Date.now();
      if (now - conn.lastPlaceAt < RATE_PLACE_MS) return;
      conn.lastPlaceAt = now;
      const tx = Number(msg.x);
      const tz = Number(msg.z);
      if (!Number.isFinite(tx) || !Number.isFinite(tz)) return;
      const tile = snapToTile(tx, tz);
      if (!withinBlockActionRange(conn.player, tile.x, tile.z)) return;
      const ok = placePendingTeleporterAt(conn, currentRoomId, tile.x, tile.z);
      if (!ok) {
        wsSafeSend(ws, {
            type: "chat",
            from: "System",
            fromAddress: "",
            text: "Could not place teleporter. Use an empty walkable floor tile within build range (not canvas).",
            at: now,
          } satisfies OutMsg);
      }
      return;
    }

    if (msg.type === "configureTeleporter") {
      if (!canEditRoomContent(currentRoomId, address)) {
        return;
      }
      const now = Date.now();
      if (now - conn.lastPlaceAt < RATE_PLACE_MS) return;
      conn.lastPlaceAt = now;
      const tx = Number(msg.x);
      const tz = Number(msg.z);
      const ty = Math.max(0, Math.min(2, Math.floor(Number(msg.y ?? 0))));
      const destRoomId = normalizeRoomId(String(msg.destRoomId ?? ""));
      let destX = Number(msg.destX);
      let destZ = Number(msg.destZ);
      if (destRoomId === HUB_ROOM_ID) {
        destX = 0;
        destZ = 0;
      } else if (!Number.isFinite(destX) || !Number.isFinite(destZ)) {
        return;
      }
      if (!Number.isFinite(tx) || !Number.isFinite(tz)) {
        return;
      }
      const tile = snapToTile(tx, tz);
      const dt = snapToTile(destX, destZ);
      if (!withinBlockActionRange(conn.player, tile.x, tile.z)) return;
      const placed = placedMap(currentRoomId);
      const srcEntry = getPlacedAtLevel(placed, tile.x, tile.z, ty);
      if (!srcEntry?.props.teleporter) return;

      const ok = configureTeleporterDestination(
        conn,
        currentRoomId,
        tile.x,
        tile.z,
        ty,
        destRoomId,
        dt.x,
        dt.z
      );
      if (!ok) {
        wsSafeSend(ws, {
            type: "chat",
            from: "System",
            fromAddress: "",
            text: "Could not set teleporter destination. Check room id, empty walkable tile at X/Z, and that you can edit that room.",
            at: now,
          } satisfies OutMsg);
      }
      return;
    }

    if (msg.type === "setObstacleProps") {
      if (!canEditRoomContent(currentRoomId, address)) {
        return;
      }
      
      const now = Date.now();
      if (now - conn.lastPlaceAt < RATE_PLACE_MS) return;
      conn.lastPlaceAt = now;
      const tx = Number(msg.x);
      const tz = Number(msg.z);
      const ty = Math.max(0, Math.min(2, Math.floor(Number(msg.y ?? 0))));
      const passable = Boolean(msg.passable);
      const quarter = Boolean(msg.quarter);
      let half = Boolean(msg.half);
      if (quarter) half = false;
      const ramp = Boolean(msg.ramp);
      const rampDir = Math.max(0, Math.min(3, Math.floor(Number(msg.rampDir ?? 0))));
      const prism = normalizeBlockPrismParts({
        hex: Boolean(msg.hex),
        pyramid: Boolean(msg.pyramid),
        sphere: Boolean(msg.sphere),
        ramp,
      });
      const colorId = clampColorId(Number(msg.colorId ?? 0));
      const locked = Boolean(msg.locked);
      
      if (!Number.isFinite(tx) || !Number.isFinite(tz)) return;
      const tile = snapToTile(tx, tz);
      if (!withinBlockActionRange(conn.player, tile.x, tile.z)) return;
      const placed = placedMap(currentRoomId);
      const entry = getPlacedAtLevel(placed, tile.x, tile.z, ty);
      if (!entry) return;
      const { key: storageKey, props: existing } = entry;
      const pyramidBaseScale = prism.pyramid
        ? clampPyramidBaseScale(
            Number(msg.pyramidBaseScale ?? existing.pyramidBaseScale ?? 1)
          )
        : 1;
      const canonicalKey = blockKey(tile.x, tile.z, ty);
      if (storageKey !== canonicalKey) {
        placed.delete(storageKey);
      }
      
      // Check if object is locked and user is not admin
      if (existing.locked && !isAdmin(address)) {
        wsSafeSend(ws, { type: "error", code: "object_locked" });
        return;
      }
      
      // Only admins can change lock status
      const finalLocked = isAdmin(address) ? locked : (existing.locked || false);
      
      placed.set(canonicalKey, {
        passable,
        half,
        quarter,
        hex: prism.hex,
        pyramid: prism.pyramid,
        pyramidBaseScale,
        sphere: prism.sphere,
        ramp: prism.ramp,
        rampDir: prism.ramp ? rampDir : 0,
        colorId,
        locked: finalLocked,
        ...(existing.teleporter ? { teleporter: existing.teleporter } : {}),
        ...(existing.claimable !== undefined ? { claimable: existing.claimable } : {}),
        ...(existing.active !== undefined ? { active: existing.active } : {}),
        ...(existing.cooldownMs !== undefined ? { cooldownMs: existing.cooldownMs } : {}),
        ...(existing.lastClaimedAt !== undefined ? { lastClaimedAt: existing.lastClaimedAt } : {}),
        ...(existing.claimReactivateAtMs !== undefined
          ? { claimReactivateAtMs: existing.claimReactivateAtMs }
          : {}),
        ...(existing.claimedBy !== undefined ? { claimedBy: existing.claimedBy } : {}),
      });
      const deltaTile = obstacleTileFromPlaced(currentRoomId, canonicalKey);
      if (deltaTile) {
        broadcast(currentRoomId, {
          type: "obstaclesDelta",
          roomId: currentRoomId,
          add: [deltaTile],
          remove: storageKey !== canonicalKey ? [storageKey] : [],
        });
      }
      schedulePersistWorldState();
      logGameplayEvent(conn.sessionId, address, currentRoomId, "set_obstacle_props", {
        x: tile.x,
        z: tile.z,
        y: ty,
        passable,
        half,
        quarter,
        hex: prism.hex,
        pyramid: prism.pyramid,
        sphere: prism.sphere,
        ramp: prism.ramp,
        rampDir: prism.ramp ? rampDir : 0,
        colorId,
      });
      return;
    }

    if (msg.type === "removeObstacle") {
      if (!canEditRoomContent(currentRoomId, address)) {
        return;
      }
      
      const now = Date.now();
      if (now - conn.lastPlaceAt < RATE_PLACE_MS) return;
      conn.lastPlaceAt = now;
      const tx = Number(msg.x);
      const tz = Number(msg.z);
      const ty = Math.max(0, Math.min(2, Math.floor(Number(msg.y ?? 0))));
      if (!Number.isFinite(tx) || !Number.isFinite(tz)) return;
      const tile = snapToTile(tx, tz);
      if (!withinBlockActionRange(conn.player, tile.x, tile.z)) return;
      const placed = placedMap(currentRoomId);
      const entry = getPlacedAtLevel(placed, tile.x, tile.z, ty);
      if (!entry) return;
      const k = entry.key;
      const props = entry.props;
      const clientKey = blockKey(tile.x, tile.z, ty);
      
      // Locked objects are admin-only to remove, except teleporters (room editors may delete them).
      if (props.locked && !isAdmin(address) && !props.teleporter) {
        wsSafeSend(ws, { type: "error", code: "object_locked" });
        return;
      }

      if (ty === 0) {
        const billboard = getBillboardAtTile(currentRoomId, tile.x, tile.z);
        if (billboard) {
          if (!canModifyOwnBillboard(billboard, address)) {
            wsSafeSend(ws, { type: "error", code: "billboard_forbidden" });
            return;
          }
          const footprints = footprintTileCoords(billboard);
          const removeKeys: string[] = [];
          for (const { x: fx, z: fz } of footprints) {
            const fk = getFloorLevelPlacedKey(placed, fx, fz);
            if (fk) {
              placed.delete(fk);
              removeKeys.push(fk);
              const bc = blockKey(fx, fz, 0);
              if (bc !== fk) removeKeys.push(bc);
            }
          }
          deleteBillboard(billboard.id);
          const uniq = [...new Set(removeKeys)];
          broadcast(currentRoomId, {
            type: "obstaclesDelta",
            roomId: currentRoomId,
            add: [],
            remove: uniq,
          });
          broadcast(currentRoomId, {
            type: "billboards",
            roomId: currentRoomId,
            billboards: getBillboardsForRoom(currentRoomId).map(billboardToWire),
          });
          schedulePersistWorldState();
          logGameplayEvent(conn.sessionId, address, currentRoomId, "remove_billboard", {
            billboardId: billboard.id,
          });
          return;
        }
      }

      if (props.teleporter) {
        const signboard = ty === 0 ? getSignboardAt(currentRoomId, tile.x, tile.z) : null;
        let signboardDeleted = false;
        if (signboard) {
          deleteSignboard(signboard.id);
          signboardDeleted = true;
        }
        placed.delete(k);
        broadcast(currentRoomId, {
          type: "obstaclesDelta",
          roomId: currentRoomId,
          add: [],
          remove: k !== clientKey ? [k, clientKey] : [clientKey],
        });
        schedulePersistWorldState();
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
        logGameplayEvent(conn.sessionId, address, currentRoomId, "remove_teleporter", {
          x: tile.x,
          z: tile.z,
          y: ty,
        });
        return;
      }

      // Check if there's a signboard at this location and remove it
      const signboard = ty === 0 ? getSignboardAt(currentRoomId, tile.x, tile.z) : null;
      let signboardDeleted = false;
      if (signboard) {
        deleteSignboard(signboard.id);
        signboardDeleted = true;
      }
      
      placed.delete(k);
      broadcast(currentRoomId, {
        type: "obstaclesDelta",
        roomId: currentRoomId,
        add: [],
        remove: k !== clientKey ? [k, clientKey] : [clientKey],
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
        y: ty,
      });
      return;
    }

    if (msg.type === "moveObstacle") {
      if (!canEditRoomContent(currentRoomId, address)) {
        return;
      }

      const now = Date.now();
      if (now - conn.lastPlaceAt < RATE_PLACE_MS) return;
      conn.lastPlaceAt = now;
      const fx = Number(msg.fromX);
      const fz = Number(msg.fromZ);
      const fy = Math.max(0, Math.min(2, Math.floor(Number(msg.fromY ?? 0))));
      const tx = Number(msg.toX);
      const tz = Number(msg.toZ);
      const ty = Math.max(0, Math.min(2, Math.floor(Number(msg.toY ?? 0))));
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
      const destKey = blockKey(to.x, to.z, ty);
      const fromClientKey = blockKey(from.x, from.z, fy);
      const placed = placedMap(currentRoomId);
      const bbAtFrom =
        fy === 0 ? getBillboardAtTile(currentRoomId, from.x, from.z) : null;

      if (fromClientKey === destKey) {
        if (
          bbAtFrom &&
          fy === 0 &&
          ty === 0 &&
          msg.yawSteps !== undefined &&
          msg.yawSteps !== null
        ) {
          if (!canModifyOwnBillboard(bbAtFrom, address)) {
            wsSafeSend(ws, { type: "error", code: "billboard_forbidden" });
            return;
          }
          if (!withinBlockActionRange(conn.player, from.x, from.z)) return;
          const newYaw = Math.max(
            0,
            Math.min(3, Math.floor(Number(msg.yawSteps)))
          );
          if (newYaw === bbAtFrom.yawSteps) return;

          const oldTiles = footprintTileCoords(bbAtFrom);
          const yawProbe: Billboard = { ...bbAtFrom, yawSteps: newYaw };
          const newTiles = footprintTileCoords(yawProbe);
          const oldK = new Set(oldTiles.map((t) => `${t.x},${t.z}`));
          const newK = new Set(newTiles.map((t) => `${t.x},${t.z}`));
          const sameFootprint =
            oldK.size === newK.size && [...oldK].every((k) => newK.has(k));

          if (sameFootprint) {
            patchBillboardRecord(bbAtFrom.id, { yawSteps: newYaw });
            broadcast(currentRoomId, {
              type: "billboards",
              roomId: currentRoomId,
              billboards: getBillboardsForRoom(currentRoomId).map(billboardToWire),
            });
            schedulePersistWorldState();
            logGameplayEvent(conn.sessionId, address, currentRoomId, "rotate_billboard", {
              billboardId: bbAtFrom.id,
              yawSteps: newYaw,
            });
            return;
          }

          if (
            normalizeRoomId(currentRoomId) === HUB_ROOM_ID &&
            newTiles.some((t) => isHubSpawnSafeZone(t.x, t.z))
          ) {
            return;
          }
          for (const { x: px, z: pz } of newTiles) {
            if (!withinBlockActionRange(conn.player, px, pz)) {
              wsSafeSend(ws, {
                type: "chat",
                from: "System",
                fromAddress: "",
                text: "Too far! Rotate billboards within your build range.",
                at: Date.now(),
              });
              return;
            }
            if (!isWalkableForRoom(currentRoomId, px, pz)) return;
            const occ = getPlacedAtLevel(placed, px, pz, 0);
            if (occ && !oldK.has(`${px},${pz}`)) return;
            if (getSignboardAt(currentRoomId, px, pz)) return;
            const otherBb = getBillboardAtTile(
              currentRoomId,
              px,
              pz,
              bbAtFrom.id
            );
            if (otherBb) return;
          }
          if (
            hasBillboardFootprintConflict(
              currentRoomId,
              bbAtFrom.anchorX,
              bbAtFrom.anchorZ,
              bbAtFrom.orientation,
              bbAtFrom.id,
              newYaw
            )
          ) {
            return;
          }
          for (const c of room.values()) {
            const st = snapToTile(c.player.x, c.player.z);
            for (const { x: px, z: pz } of newTiles) {
              if (st.x === px && st.z === pz) return;
            }
          }

          const removeKeys: string[] = [];
          for (const { x: ox, z: oz } of oldTiles) {
            const fk0 = getFloorLevelPlacedKey(placed, ox, oz);
            if (fk0) {
              placed.delete(fk0);
              removeKeys.push(fk0);
              const bc = blockKey(ox, oz, 0);
              if (bc !== fk0) removeKeys.push(bc);
            }
          }
          patchBillboardRecord(bbAtFrom.id, { yawSteps: newYaw });
          const addTiles: ObstacleTile[] = [];
          for (const { x: fx, z: fz } of newTiles) {
            const k = blockKey(fx, fz, 0);
            placed.set(k, {
              passable: true,
              half: true,
              quarter: false,
              hex: false,
              pyramid: false,
              pyramidBaseScale: 1,
              sphere: false,
              ramp: false,
              rampDir: 0,
              colorId: 5,
            });
            const deltaTile = obstacleTileFromPlaced(currentRoomId, k);
            if (deltaTile) addTiles.push(deltaTile);
          }
          broadcast(currentRoomId, {
            type: "billboards",
            roomId: currentRoomId,
            billboards: getBillboardsForRoom(currentRoomId).map(billboardToWire),
          });
          broadcast(currentRoomId, {
            type: "obstaclesDelta",
            roomId: currentRoomId,
            add: addTiles,
            remove: [...new Set(removeKeys)],
          });
          schedulePersistWorldState();
          logGameplayEvent(conn.sessionId, address, currentRoomId, "rotate_billboard", {
            billboardId: bbAtFrom.id,
            yawSteps: newYaw,
          });
          return;
        }
        return;
      }
      if (
        !withinBlockActionRange(conn.player, from.x, from.z) ||
        !withinBlockActionRange(conn.player, to.x, to.z)
      ) {
        return;
      }
      const fromEntry = getPlacedAtLevel(placed, from.x, from.z, fy);
      if (!fromEntry) return;
      const fk = fromEntry.key;
      const props = fromEntry.props;

      if (bbAtFrom && fy === 0) {
        if (!canModifyOwnBillboard(bbAtFrom, address)) {
          wsSafeSend(ws, { type: "error", code: "billboard_forbidden" });
          return;
        }
        if (ty !== 0) return;
        const yawNext =
          msg.yawSteps !== undefined && msg.yawSteps !== null
            ? Math.max(0, Math.min(3, Math.floor(Number(msg.yawSteps))))
            : bbAtFrom.yawSteps;
        const dx = to.x - from.x;
        const dz = to.z - from.z;
        const newAx = bbAtFrom.anchorX + dx;
        const newAz = bbAtFrom.anchorZ + dz;
        if (
          newAx === bbAtFrom.anchorX &&
          newAz === bbAtFrom.anchorZ &&
          yawNext === bbAtFrom.yawSteps
        ) {
          return;
        }

        const orient = bbAtFrom.orientation;
        const movedProbe: Billboard = {
          ...bbAtFrom,
          anchorX: newAx,
          anchorZ: newAz,
          yawSteps: yawNext,
        };
        const newFootTiles = footprintTileCoords(movedProbe);

        if (
          normalizeRoomId(currentRoomId) === HUB_ROOM_ID &&
          newFootTiles.some((t) => isHubSpawnSafeZone(t.x, t.z))
        ) {
          return;
        }

        const oldFootKeys = new Set(
          footprintTileCoords(bbAtFrom).map((t) => `${t.x},${t.z}`)
        );

        for (const { x: px, z: pz } of newFootTiles) {
          if (!withinBlockActionRange(conn.player, px, pz)) {
            wsSafeSend(ws, {
              type: "chat",
              from: "System",
              fromAddress: "",
              text: "Too far! Move billboards within your build range.",
              at: Date.now(),
            });
            return;
          }
          if (!isWalkableForRoom(currentRoomId, px, pz)) return;
          const occ = getPlacedAtLevel(placed, px, pz, 0);
          if (occ && !oldFootKeys.has(`${px},${pz}`)) return;
          if (getSignboardAt(currentRoomId, px, pz)) return;
          const otherBb = getBillboardAtTile(
            currentRoomId,
            px,
            pz,
            bbAtFrom.id
          );
          if (otherBb) return;
        }

        if (
          hasBillboardFootprintConflict(
            currentRoomId,
            newAx,
            newAz,
            orient,
            bbAtFrom.id,
            yawNext
          )
        ) {
          return;
        }

        for (const c of room.values()) {
          const st = snapToTile(c.player.x, c.player.z);
          for (const { x: px, z: pz } of newFootTiles) {
            if (st.x === px && st.z === pz) return;
          }
        }

        const removeKeys: string[] = [];
        for (const { x: ox, z: oz } of footprintTileCoords(bbAtFrom)) {
          const fk0 = getFloorLevelPlacedKey(placed, ox, oz);
          if (fk0) {
            placed.delete(fk0);
            removeKeys.push(fk0);
            const bc = blockKey(ox, oz, 0);
            if (bc !== fk0) removeKeys.push(bc);
          }
        }

        patchBillboardRecord(bbAtFrom.id, {
          anchorX: newAx,
          anchorZ: newAz,
          yawSteps: yawNext,
        });

        const addTiles: ObstacleTile[] = [];
        for (const { x: fx, z: fz } of newFootTiles) {
          const k = blockKey(fx, fz, 0);
          placed.set(k, {
            passable: true,
            half: true,
            quarter: false,
            hex: false,
            pyramid: false,
            pyramidBaseScale: 1,
            sphere: false,
            ramp: false,
            rampDir: 0,
            colorId: 5,
          });
          const deltaTile = obstacleTileFromPlaced(currentRoomId, k);
          if (deltaTile) addTiles.push(deltaTile);
        }

        const uniqRemove = [...new Set(removeKeys)];
        broadcast(currentRoomId, {
          type: "billboards",
          roomId: currentRoomId,
          billboards: getBillboardsForRoom(currentRoomId).map(billboardToWire),
        });
        broadcast(currentRoomId, {
          type: "obstaclesDelta",
          roomId: currentRoomId,
          add: addTiles,
          remove: uniqRemove,
        });
        schedulePersistWorldState();
        logGameplayEvent(conn.sessionId, address, currentRoomId, "move_billboard", {
          billboardId: bbAtFrom.id,
          anchorX: newAx,
          anchorZ: newAz,
          yawSteps: yawNext,
        });
        return;
      }

      // Locked objects are admin-only to move, except teleporters (room editors may reposition).
      if (props.locked && !isAdmin(address) && !props.teleporter) {
        wsSafeSend(ws, { type: "error", code: "object_locked" });
        return;
      }

      if (isOccupiedAtLevel(placed, to.x, to.z, ty)) return;
      if (ty !== 0) {
        const below = getPlacedAtLevel(placed, to.x, to.z, ty - 1);
        if (!below) return;
      }
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
      placed.set(destKey, { ...props });

      // If there's a signboard at the old location, move it to the new location
      const signboard = fy === 0 ? getSignboardAt(currentRoomId, from.x, from.z) : null;
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

      const deltaTile = obstacleTileFromPlaced(currentRoomId, destKey);
      broadcast(currentRoomId, {
        type: "obstaclesDelta",
        roomId: currentRoomId,
        add: deltaTile ? [deltaTile] : [],
        remove: fk !== fromClientKey ? [fk, fromClientKey] : [fromClientKey],
      });
      schedulePersistWorldState();
      logGameplayEvent(conn.sessionId, address, currentRoomId, "move_obstacle", {
        fromX: from.x,
        fromZ: from.z,
        fromY: fy,
        toX: to.x,
        toZ: to.z,
        toY: ty,
      });
      return;
    }

    if (msg.type === "placeExtraFloor") {
      if (!canEditRoomContent(currentRoomId, address)) {
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
      if (isPlayerCreatedRoom(currentRoomId)) {
        const rm = baseFloorRemovedEnsure(currentRoomId);
        if (!rm.has(k)) return;
        const placedRm = placedMap(currentRoomId);
        if (placedRm.has(k)) return;
        for (const c of room.values()) {
          const st = snapToTile(c.player.x, c.player.z);
          if (st.x === tile.x && st.z === tile.z) return;
        }
        rm.delete(k);
        if (rm.size === 0) {
          roomBaseFloorRemoved.delete(currentRoomId);
        }
        broadcast(currentRoomId, {
          type: "removedBaseFloorDelta",
          roomId: currentRoomId,
          add: [],
          remove: [k],
        });
        schedulePersistWorldState();
        logGameplayEvent(conn.sessionId, address, currentRoomId, "restore_base_floor", {
          x: tile.x,
          z: tile.z,
        });
        return;
      }
      if (!canPlaceExtraFloor(currentRoomId, tile.x, tile.z)) return;
      for (const c of room.values()) {
        const st = snapToTile(c.player.x, c.player.z);
        if (st.x === tile.x && st.z === tile.z) return;
      }
      extraFloorSet(currentRoomId).add(tileKey(tile.x, tile.z));
      broadcast(currentRoomId, {
        type: "extraFloorDelta",
        roomId: currentRoomId,
        add: [{ x: tile.x, z: tile.z }],
        remove: [],
      });
      schedulePersistWorldState();
      logGameplayEvent(conn.sessionId, address, currentRoomId, "place_extra_floor", {
        x: tile.x,
        z: tile.z,
      });
      return;
    }

    if (msg.type === "removeExtraFloor") {
      if (!canEditRoomContent(currentRoomId, address)) {
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
      const ex = extraFloorSet(currentRoomId);
      if (ex.has(k)) {
        if (isBaseTile(tile.x, tile.z, currentRoomId)) return;
        const placed = placedMap(currentRoomId);
        if (placed.has(k)) return;
        for (const c of room.values()) {
          const st = snapToTile(c.player.x, c.player.z);
          if (st.x === tile.x && st.z === tile.z) return;
        }
        ex.delete(k);
        broadcast(currentRoomId, {
          type: "extraFloorDelta",
          roomId: currentRoomId,
          add: [],
          remove: [k],
        });
        schedulePersistWorldState();
        logGameplayEvent(conn.sessionId, address, currentRoomId, "remove_extra_floor", {
          x: tile.x,
          z: tile.z,
        });
        return;
      }
      if (
        isPlayerCreatedRoom(currentRoomId) &&
        isBaseTile(tile.x, tile.z, currentRoomId)
      ) {
        const rm = baseFloorRemovedEnsure(currentRoomId);
        if (rm.has(k)) return;
        const placedB = placedMap(currentRoomId);
        if (placedB.has(k)) return;
        for (const c of room.values()) {
          const st = snapToTile(c.player.x, c.player.z);
          if (st.x === tile.x && st.z === tile.z) return;
        }
        rm.add(k);
        broadcast(currentRoomId, {
          type: "removedBaseFloorDelta",
          roomId: currentRoomId,
          add: [k],
          remove: [],
        });
        schedulePersistWorldState();
        logGameplayEvent(conn.sessionId, address, currentRoomId, "remove_base_floor", {
          x: tile.x,
          z: tile.z,
        });
        return;
      }
      return;
    }

    if (msg.type === "chat") {
      const now = Date.now();
      if (now - conn.lastChatAt < RATE_CHAT_MS) return;
      conn.lastChatAt = now;
      if (isChannelMuted(compactAddress(address))) {
        wsSafeSend(ws, { type: "error", code: "channel_muted" } satisfies OutMsg);
        return;
      }
      let text = String(msg.text ?? "").slice(0, CHAT_MAX);
      text = text.replace(/[\u0000-\u001F\u007F]/g, "").trim();
      if (!text) return;
      const hadTyping = conn.chatTyping;
      conn.chatTyping = false;
      broadcast(currentRoomId, {
        type: "chat",
        from: conn.displayName,
        fromAddress: address,
        text,
        at: now,
      });
      if (hadTyping) {
        broadcastRoomStateFull(currentRoomId);
      }
      logGameplayEvent(conn.sessionId, address, currentRoomId, "chat", {
        text,
      });
      return;
    }

    if (msg.type === "claimBlock") {
      wsSafeSend(ws, {
          type: "blockClaimResult",
          ok: false,
          reason: "Claim protocol updated. Please refresh the page.",
        } satisfies OutMsg);
      return;
    }

    if (msg.type === "beginBlockClaim") {
      const now = Date.now();
      trimSpentBlockClaimIds(now);
      if (now - conn.lastBlockClaimBeginAt < RATE_BEGIN_BLOCK_CLAIM_MS) {
        wsSafeSend(ws, {
            type: "blockClaimResult",
            ok: false,
            recoverable: true,
            reason: "Wait a moment before starting another claim.",
          } satisfies OutMsg);
        return;
      }

      const tx = Number(msg.x);
      const tz = Number(msg.z);
      if (!Number.isFinite(tx) || !Number.isFinite(tz)) {
        wsSafeSend(ws, {
            type: "blockClaimResult",
            ok: false,
            reason: "Invalid block coordinates.",
          } satisfies OutMsg);
        return;
      }

      const tile = snapToTile(tx, tz);

      if (
        !isOrthogonallyAdjacentToTile(
          conn.player.x,
          conn.player.z,
          tile.x,
          tile.z
        )
      ) {
        wsSafeSend(ws, {
            type: "blockClaimResult",
            ok: false,
            reason:
              "Stand on a tile directly beside the block (edge, not diagonal) to start a claim.",
          } satisfies OutMsg);
        return;
      }

      const placed = placedMap(currentRoomId);
      const tyRaw = Number((msg as { y?: unknown }).y);
      const tileY = Number.isFinite(tyRaw)
        ? Math.max(0, Math.min(STACK_MAX_LEVEL, Math.floor(tyRaw)))
        : 0;
      const atLevel = getPlacedAtLevel(placed, tile.x, tile.z, tileY);
      if (!atLevel) {
        wsSafeSend(ws, {
            type: "blockClaimResult",
            ok: false,
            reason: "This block cannot be claimed.",
          } satisfies OutMsg);
        return;
      }
      const { props } = atLevel;
      if (!props.claimable) {
        wsSafeSend(ws, {
            type: "blockClaimResult",
            ok: false,
            reason: "This block cannot be claimed.",
          } satisfies OutMsg);
        return;
      }
      if (!props.active) {
        wsSafeSend(ws, {
            type: "blockClaimResult",
            ok: false,
            reason: "This block is on cooldown.",
          } satisfies OutMsg);
        return;
      }

      const rk = blockClaimResKey(currentRoomId, tile.x, tile.z, tileY);
      const res = blockClaimReservation.get(rk);
      if (res && res.until > now && res.address !== address) {
        wsSafeSend(ws, {
            type: "blockClaimResult",
            ok: false,
            reason: "Another player is already claiming this block.",
          } satisfies OutMsg);
        return;
      }

      if (conn.pendingBlockClaimId) {
        releaseBlockClaimSession(conn.pendingBlockClaimId);
      }

      conn.lastBlockClaimBeginAt = now;

      const claimId = newBlockClaimId();
      const completeBy = now + BLOCK_CLAIM_SESSION_MS;
      blockClaimSessions.set(claimId, {
        address,
        roomId: currentRoomId,
        tileX: tile.x,
        tileZ: tile.z,
        tileY,
        startedAt: now,
        completeBy,
        accumAdjacentMs: 0,
        lastSampleAt: 0,
      });
      blockClaimReservation.set(rk, {
        claimId,
        address,
        until: completeBy,
      });
      conn.pendingBlockClaimId = claimId;

      wsSafeSend(ws, {
          type: "blockClaimOffered",
          claimId,
          x: tile.x,
          z: tile.z,
          ...(tileY !== 0 ? { y: tileY } : {}),
          holdMs: BLOCK_CLAIM_HOLD_MS,
          completeBy,
        } satisfies OutMsg);
      return;
    }

    if (msg.type === "blockClaimTick") {
      const now = Date.now();
      if (now - conn.lastBlockClaimTickAt < RATE_BLOCK_CLAIM_TICK_MS) {
        return;
      }
      conn.lastBlockClaimTickAt = now;

      const claimId = String(msg.claimId ?? "");
      if (!claimId) return;

      const s = blockClaimSessions.get(claimId);
      if (
        !s ||
        s.address !== address ||
        s.roomId !== currentRoomId ||
        now > s.completeBy
      ) {
        return;
      }

      const adjacent = isOrthogonallyAdjacentToTile(
        conn.player.x,
        conn.player.z,
        s.tileX,
        s.tileZ
      );
      if (!adjacent) {
        s.accumAdjacentMs = 0;
        s.lastSampleAt = now;
        return;
      }

      if (s.lastSampleAt === 0) {
        s.lastSampleAt = now;
        return;
      }

      const dt = now - s.lastSampleAt;
      if (dt > CLAIM_ACCUM_GAP_BREAK_MS) {
        s.accumAdjacentMs = 0;
      } else {
        const add = Math.min(dt, CLAIM_ACCUM_DT_CAP_MS);
        s.accumAdjacentMs += add;
      }
      s.lastSampleAt = now;
      return;
    }

    if (msg.type === "completeBlockClaim") {
      const claimId = String(msg.claimId ?? "");
      const now = Date.now();

      if (now - conn.lastBlockClaimCompleteAttemptAt < RATE_COMPLETE_BLOCK_CLAIM_MS) {
        wsSafeSend(ws, {
            type: "blockClaimResult",
            ok: false,
            recoverable: true,
            reason: "Wait a moment before completing the claim.",
          } satisfies OutMsg);
        return;
      }

      if (!claimId) {
        wsSafeSend(ws, {
            type: "blockClaimResult",
            ok: false,
            reason: "Missing claim id.",
          } satisfies OutMsg);
        return;
      }

      conn.lastBlockClaimCompleteAttemptAt = now;

      if (spentBlockClaimIds.has(claimId)) {
        wsSafeSend(ws, {
            type: "blockClaimResult",
            ok: false,
            reason: "This claim was already used.",
          } satisfies OutMsg);
        return;
      }

      const s = blockClaimSessions.get(claimId);
      if (!s || s.address !== address || s.roomId !== currentRoomId) {
        wsSafeSend(ws, {
            type: "blockClaimResult",
            ok: false,
            reason: "Unknown or expired claim.",
          } satisfies OutMsg);
        return;
      }

      if (now > s.completeBy) {
        releaseBlockClaimSession(claimId);
        wsSafeSend(ws, {
            type: "blockClaimResult",
            ok: false,
            reason: "Claim session expired. Try again.",
          } satisfies OutMsg);
        return;
      }

      if (s.accumAdjacentMs < BLOCK_CLAIM_HOLD_MS) {
        wsSafeSend(ws, {
            type: "blockClaimResult",
            ok: false,
            recoverable: true,
            reason: "Keep standing beside the block until the bar is full.",
          } satisfies OutMsg);
        return;
      }

      if (
        !isOrthogonallyAdjacentToTile(
          conn.player.x,
          conn.player.z,
          s.tileX,
          s.tileZ
        )
      ) {
        wsSafeSend(ws, {
            type: "blockClaimResult",
            ok: false,
            recoverable: true,
            reason:
              "You must still be directly beside the block when completing the claim.",
          } satisfies OutMsg);
        return;
      }

      const placed = placedMap(currentRoomId);
      const atComplete = getPlacedAtLevel(placed, s.tileX, s.tileZ, s.tileY);
      if (!atComplete) {
        releaseBlockClaimSession(claimId);
        wsSafeSend(ws, {
            type: "blockClaimResult",
            ok: false,
            reason: "This block is no longer available.",
          } satisfies OutMsg);
        return;
      }
      const k = atComplete.key;
      const props = atComplete.props;
      if (!props.claimable || !props.active) {
        releaseBlockClaimSession(claimId);
        wsSafeSend(ws, {
            type: "blockClaimResult",
            ok: false,
            reason: "This block is no longer available.",
          } satisfies OutMsg);
        return;
      }

      const rk = blockClaimResKey(currentRoomId, s.tileX, s.tileZ, s.tileY);
      const res = blockClaimReservation.get(rk);
      if (!res || res.claimId !== claimId || res.address !== address) {
        releaseBlockClaimSession(claimId);
        wsSafeSend(ws, {
            type: "blockClaimResult",
            ok: false,
            reason: "Claim reservation no longer matches this block.",
          } satisfies OutMsg);
        return;
      }

      let payoutHasFunds = false;
      if (isNimPayoutSenderConfigured()) {
        try {
          const peek = peekNimPayoutBalanceCacheLuna();
          if (NIM_CLAIM_BALANCE_PEEK_MAX_MS > 0 && peek !== null) {
            payoutHasFunds = peek.luna >= CLAIM_REWARD_MIN_LUNA;
          } else {
            const payoutBalanceLuna = await getNimPayoutWalletBalanceLuna();
            payoutHasFunds = payoutBalanceLuna >= CLAIM_REWARD_MIN_LUNA;
          }
        } catch (err) {
          console.error("[claimBlock] Failed to check payout wallet balance:", err);
        }
      }
      if (!payoutHasFunds) {
        releaseBlockClaimSession(claimId);
        wsSafeSend(ws, {
            type: "blockClaimResult",
            ok: false,
            reason: "Nothing here :(",
            x: s.tileX,
            z: s.tileZ,
          } satisfies OutMsg);
        return;
      }

      noteSpentBlockClaimId(claimId, now);
      releaseBlockClaimSession(claimId);

      const rewardLuna = finalizeClaimableBlockReward(
        currentRoomId,
        k,
        props,
        address,
        now,
        conn.sessionId,
        claimId
      );
      wsSafeSend(ws, {
          type: "blockClaimResult",
          ok: true,
          x: s.tileX,
          z: s.tileZ,
          amountNim: (Number(rewardLuna) / 100_000).toFixed(4),
        } satisfies OutMsg);
      schedulePersistWorldState();
      return;
    }

    if (msg.type === "placeSignboard") {
      if (!canEditRoomContent(currentRoomId, address)) {
        return;
      }
      // Anyone can place a signboard/signpost
      const now = Date.now();
      if (now - conn.lastPlaceAt < RATE_PLACE_MS) return;
      conn.lastPlaceAt = now;
      const tx = Number(msg.x);
      const tz = Number(msg.z);
      const message = String(msg.message ?? "").trim();
      if (!Number.isFinite(tx) || !Number.isFinite(tz)) return;
      if (!message || message.length > SIGNBOARD_MESSAGE_MAX_LEN) {
        wsSafeSend(ws, { type: "error", code: "invalid_message" });
        return;
      }
      const tile = snapToTile(tx, tz);
      const k = tileKey(tile.x, tile.z);
      
      // Check if within build range
      if (!withinBlockActionRange(conn.player, tile.x, tile.z)) {
        wsSafeSend(ws, {
          type: "chat",
          from: "System",
          fromAddress: "",
          text: "Too far! You can only place signboards within your build range.",
          at: Date.now(),
        });
        return;
      }
      
      if (!isWalkableForRoom(currentRoomId, tile.x, tile.z)) return;
      const placed = placedMap(currentRoomId);
      if (placed.has(k)) return;
      
      // Check if signboard already exists at this location
      const existing = getSignboardAt(currentRoomId, tile.x, tile.z);
      if (existing) {
        wsSafeSend(ws, { type: "error", code: "signboard_exists" });
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
        pyramid: false,
        pyramidBaseScale: 1,
        sphere: false,
        ramp: false,
        rampDir: 0,
        colorId: 8, // Use a specific color for signboards (light gray/white)
      });
      const deltaTile = obstacleTileFromPlaced(currentRoomId, k);
      broadcast(currentRoomId, {
        type: "obstaclesDelta",
        roomId: currentRoomId,
        add: deltaTile ? [deltaTile] : [],
        remove: [],
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

    if (msg.type === "placeBillboard") {
      if (!canEditRoomContent(currentRoomId, address)) {
        return;
      }
      if (!isAdmin(address)) {
        wsSafeSend(ws, { type: "error", code: "billboard_admin_only" });
        return;
      }
      const now = Date.now();
      if (now - conn.lastPlaceAt < RATE_PLACE_MS) return;
      conn.lastPlaceAt = now;
      const tx = Number(msg.x);
      const tz = Number(msg.z);
      if (!Number.isFinite(tx) || !Number.isFinite(tz)) return;
      const tile = snapToTile(tx, tz);
      const orientRaw = String(msg.orientation ?? "horizontal").toLowerCase();
      const orientation: BillboardOrientation =
        orientRaw === "vertical" ? "vertical" : "horizontal";
      if (
        BILLBOARD_VERTICAL_PLACEMENT_TEMP_DISABLED &&
        orientation === "vertical"
      ) {
        wsSafeSend(ws, { type: "error", code: "billboard_vertical_disabled" });
        return;
      }
      /** Placement UI no longer sends yaw; keep 0 for a predictable default footprint axis. */
      const yawSteps = 0;
      const rawMsg = msg as Record<string, unknown>;
      const liveChart = parseBillboardLiveChartFromMessage(rawMsg);
      let advertIds: string[] = [];
      let slides: string[] = [];
      let intervalMs: number;
      let visitName: string;
      let visitUrl: string;

      if (liveChart) {
        slides = [BILLBOARD_LIVE_CHART_PLACEHOLDER_SLIDE];
        intervalMs = 60_000;
        visitName = "NIM (CoinGecko)";
        visitUrl = "https://www.coingecko.com/en/coins/nimiq-2";
      } else {
        const parsed = parseBillboardAdvertIdsFromMessage(rawMsg);
        if (!parsed) {
          wsSafeSend(ws, { type: "error", code: "invalid_billboard_advert" });
          return;
        }
        advertIds = parsed;
        if (!validateAdvertRotationVisitHttps(advertIds)) {
          wsSafeSend(ws, { type: "error", code: "invalid_billboard_visit_url" });
          return;
        }
        const built = buildBillboardSlidesFromAdvertIds(advertIds);
        if (!built || built.length === 0) {
          wsSafeSend(ws, { type: "error", code: "invalid_billboard_url" });
          return;
        }
        slides = built;
        let intervalFrom = Math.floor(Number(rawMsg.intervalMs));
        if (!Number.isFinite(intervalFrom)) intervalFrom = 8000;
        intervalMs = Math.max(1000, Math.min(300_000, intervalFrom));
        const first = getBillboardAdvertById(advertIds[0]!);
        visitName = String(first?.name ?? "").trim() || "Advertiser";
        visitUrl = String(first?.visitUrl ?? "").trim();
      }

      const footprintProbe: Billboard = {
        id: "_place_probe",
        roomId: currentRoomId,
        anchorX: tile.x,
        anchorZ: tile.z,
        orientation,
        yawSteps,
        slides: ["/"],
        intervalMs: 8000,
        visitName: "",
        visitUrl: "",
        createdBy: "",
        createdAt: 0,
        updatedAt: 0,
      };
      const footTiles = footprintTileCoords(footprintProbe);
      if (
        normalizeRoomId(currentRoomId) === HUB_ROOM_ID &&
        footTiles.some((t) => isHubSpawnSafeZone(t.x, t.z))
      ) {
        return;
      }
      const placed = placedMap(currentRoomId);
      for (const { x: fx, z: fz } of footTiles) {
        if (!withinBlockActionRange(conn.player, fx, fz)) {
          wsSafeSend(ws, {
            type: "chat",
            from: "System",
            fromAddress: "",
            text: "Too far! Place billboards within your build range.",
            at: Date.now(),
          });
          return;
        }
        if (!isWalkableForRoom(currentRoomId, fx, fz)) return;
        if (getPlacedAtLevel(placed, fx, fz, 0)) return;
        if (getSignboardAt(currentRoomId, fx, fz)) return;
        if (getBillboardAtTile(currentRoomId, fx, fz)) return;
      }
      if (
        hasBillboardFootprintConflict(
          currentRoomId,
          tile.x,
          tile.z,
          orientation,
          undefined,
          yawSteps
        )
      ) {
        wsSafeSend(ws, { type: "error", code: "billboard_footprint_blocked" });
        return;
      }
      for (const c of room.values()) {
        const st = snapToTile(c.player.x, c.player.z);
        for (const { x: fx, z: fz } of footTiles) {
          if (st.x === fx && st.z === fz) return;
        }
      }

      const billboard = createBillboard(
        currentRoomId,
        tile.x,
        tile.z,
        orientation,
        yawSteps,
        slides,
        intervalMs,
        address,
        liveChart
          ? {
              visitName,
              visitUrl,
              slideshowEpochMs: now,
              liveChart,
            }
          : {
              advertId: advertIds[0],
              advertIds,
              visitName,
              visitUrl,
              slideshowEpochMs: now,
            }
      );
      const addTiles: ObstacleTile[] = [];
      for (const { x: fx, z: fz } of footTiles) {
        const k = blockKey(fx, fz, 0);
        placed.set(k, {
          passable: true,
          half: true,
          quarter: false,
          hex: false,
          pyramid: false,
          pyramidBaseScale: 1,
          sphere: false,
          ramp: false,
          rampDir: 0,
          colorId: 5,
        });
        const deltaTile = obstacleTileFromPlaced(currentRoomId, k);
        if (deltaTile) addTiles.push(deltaTile);
      }
      broadcast(currentRoomId, {
        type: "billboards",
        roomId: currentRoomId,
        billboards: getBillboardsForRoom(currentRoomId).map(billboardToWire),
      });
      broadcast(currentRoomId, {
        type: "obstaclesDelta",
        roomId: currentRoomId,
        add: addTiles,
        remove: [],
      });
      schedulePersistWorldState();
      logGameplayEvent(conn.sessionId, address, currentRoomId, "place_billboard", {
        anchorX: tile.x,
        anchorZ: tile.z,
        orientation,
        billboardId: billboard.id,
      });
      return;
    }

    if (msg.type === "updateBillboard") {
      if (!canEditRoomContent(currentRoomId, address)) {
        return;
      }
      const now = Date.now();
      if (now - conn.lastPlaceAt < RATE_PLACE_MS) return;
      conn.lastPlaceAt = now;
      const billboardId = String(msg.billboardId ?? "").trim();
      if (!billboardId) return;
      const bb = getBillboardById(billboardId);
      if (!bb || normalizeRoomId(bb.roomId) !== normalizeRoomId(currentRoomId)) {
        return;
      }
      if (!canModifyOwnBillboard(bb, address)) {
        wsSafeSend(ws, { type: "error", code: "billboard_forbidden" });
        return;
      }
      const orientRaw = String(msg.orientation ?? bb.orientation).toLowerCase();
      const orientation: BillboardOrientation =
        orientRaw === "vertical" ? "vertical" : "horizontal";
      if (
        BILLBOARD_VERTICAL_PLACEMENT_TEMP_DISABLED &&
        orientation === "vertical" &&
        bb.orientation !== "vertical"
      ) {
        wsSafeSend(ws, { type: "error", code: "billboard_vertical_disabled" });
        return;
      }
      const yawSteps = Math.max(
        0,
        Math.min(3, Math.floor(Number(msg.yawSteps ?? bb.yawSteps)))
      );
      const rawMsg = msg as Record<string, unknown>;
      const liveChart = parseBillboardLiveChartFromMessage(rawMsg);
      let advertIds: string[] = [];
      let slides: string[] = [];
      let intervalMs: number;
      let visitName: string;
      let visitUrl: string;

      if (liveChart) {
        slides = [BILLBOARD_LIVE_CHART_PLACEHOLDER_SLIDE];
        intervalMs = 60_000;
        visitName = "NIM (CoinGecko)";
        visitUrl = "https://www.coingecko.com/en/coins/nimiq-2";
      } else {
        const parsed = parseBillboardAdvertIdsFromMessage(rawMsg);
        if (!parsed) {
          wsSafeSend(ws, { type: "error", code: "invalid_billboard_advert" });
          return;
        }
        advertIds = parsed;
        if (!validateAdvertRotationVisitHttps(advertIds)) {
          wsSafeSend(ws, { type: "error", code: "invalid_billboard_visit_url" });
          return;
        }
        const built = buildBillboardSlidesFromAdvertIds(advertIds);
        if (!built || built.length === 0) {
          wsSafeSend(ws, { type: "error", code: "invalid_billboard_url" });
          return;
        }
        slides = built;
        let intervalFrom = Math.floor(Number(rawMsg.intervalMs));
        if (!Number.isFinite(intervalFrom)) intervalFrom = bb.intervalMs;
        intervalMs = Math.max(1000, Math.min(300_000, intervalFrom));
        const first = getBillboardAdvertById(advertIds[0]!);
        visitName = String(first?.name ?? "").trim() || "Advertiser";
        visitUrl = String(first?.visitUrl ?? "").trim();
      }

      const liveChartRing = (
        lc: {
          range: string;
          rangeCycle?: boolean;
          cycleIntervalSec?: number;
        }
      ): string =>
        lc.rangeCycle
          ? `live:cycle:${lc.cycleIntervalSec ?? 20}`
          : `live:${lc.range}`;
      const prevRing = bb.liveChart
        ? liveChartRing(bb.liveChart)
        : bb.advertIds?.length
          ? bb.advertIds.join("\0")
          : bb.advertId
            ? bb.advertId
            : "";
      const nextRing = liveChart
        ? liveChartRing(liveChart)
        : advertIds.join("\0");
      const slideshowTicks =
        nextRing !== prevRing ||
        intervalMs !== bb.intervalMs ||
        Boolean(bb.liveChart) !== Boolean(liveChart) ||
        slides.join("\0") !== bb.slides.join("\0");
      const slideshowEpochMs = slideshowTicks
        ? now
        : (bb.slideshowEpochMs ?? bb.createdAt);

      const nextProbe: Billboard = {
        ...bb,
        orientation,
        yawSteps,
        slides: ["/"],
        intervalMs: 8000,
      };
      const oldTiles = footprintTileCoords(bb);
      const newTiles = footprintTileCoords(nextProbe);
      const oldK = new Set(oldTiles.map((t) => `${t.x},${t.z}`));
      const newK = new Set(newTiles.map((t) => `${t.x},${t.z}`));
      const sameFootprint =
        oldK.size === newK.size && [...oldK].every((k) => newK.has(k));

      const placed = placedMap(currentRoomId);

      const footprintOkForPlayers = (tiles: { x: number; z: number }[]): boolean => {
        for (const c of room.values()) {
          const st = snapToTile(c.player.x, c.player.z);
          for (const { x: px, z: pz } of tiles) {
            if (st.x === px && st.z === pz) return false;
          }
        }
        return true;
      };

      if (sameFootprint) {
        for (const { x: px, z: pz } of newTiles) {
          if (!withinBlockActionRange(conn.player, px, pz)) {
            wsSafeSend(ws, {
              type: "chat",
              from: "System",
              fromAddress: "",
              text: "Too far! Edit billboards within your build range.",
              at: Date.now(),
            });
            return;
          }
        }
        if (
          hasBillboardFootprintConflict(
            currentRoomId,
            bb.anchorX,
            bb.anchorZ,
            orientation,
            bb.id,
            yawSteps
          )
        ) {
          wsSafeSend(ws, { type: "error", code: "billboard_footprint_blocked" });
          return;
        }
        if (!footprintOkForPlayers(newTiles)) return;
        setBillboardContent(
          billboardId,
          liveChart
            ? {
                orientation,
                yawSteps,
                slides,
                intervalMs,
                slideshowEpochMs,
                visitName,
                visitUrl,
                liveChart,
              }
            : {
                orientation,
                yawSteps,
                slides,
                intervalMs,
                advertId: advertIds[0],
                advertIds,
                slideshowEpochMs,
                visitName,
                visitUrl,
              }
        );
        broadcast(currentRoomId, {
          type: "billboards",
          roomId: currentRoomId,
          billboards: getBillboardsForRoom(currentRoomId).map(billboardToWire),
        });
        schedulePersistWorldState();
        logGameplayEvent(conn.sessionId, address, currentRoomId, "update_billboard", {
          billboardId,
          orientation,
          yawSteps,
        });
        return;
      }

      if (
        normalizeRoomId(currentRoomId) === HUB_ROOM_ID &&
        newTiles.some((t) => isHubSpawnSafeZone(t.x, t.z))
      ) {
        return;
      }
      for (const { x: px, z: pz } of newTiles) {
        if (!withinBlockActionRange(conn.player, px, pz)) {
          wsSafeSend(ws, {
            type: "chat",
            from: "System",
            fromAddress: "",
            text: "Too far! Edit billboards within your build range.",
            at: Date.now(),
          });
          return;
        }
        if (!isWalkableForRoom(currentRoomId, px, pz)) return;
        if (getSignboardAt(currentRoomId, px, pz)) return;
        const occ = getPlacedAtLevel(placed, px, pz, 0);
        if (occ && !oldK.has(`${px},${pz}`)) return;
        const otherBb = getBillboardAtTile(currentRoomId, px, pz, bb.id);
        if (otherBb) return;
      }
      if (
        hasBillboardFootprintConflict(
          currentRoomId,
          bb.anchorX,
          bb.anchorZ,
          orientation,
          bb.id,
          yawSteps
        )
      ) {
        wsSafeSend(ws, { type: "error", code: "billboard_footprint_blocked" });
        return;
      }
      if (!footprintOkForPlayers(newTiles)) return;

      const removeKeys: string[] = [];
      for (const { x: ox, z: oz } of oldTiles) {
        if (newK.has(`${ox},${oz}`)) continue;
        const fk0 = getFloorLevelPlacedKey(placed, ox, oz);
        if (fk0) {
          placed.delete(fk0);
          removeKeys.push(fk0);
          const bc = blockKey(ox, oz, 0);
          if (bc !== fk0) removeKeys.push(bc);
        }
      }
      const addTiles: ObstacleTile[] = [];
      for (const { x: fx, z: fz } of newTiles) {
        if (oldK.has(`${fx},${fz}`)) continue;
        const k = blockKey(fx, fz, 0);
        placed.set(k, {
          passable: true,
          half: true,
          quarter: false,
          hex: false,
          pyramid: false,
          pyramidBaseScale: 1,
          sphere: false,
          ramp: false,
          rampDir: 0,
          colorId: 5,
        });
        const deltaTile = obstacleTileFromPlaced(currentRoomId, k);
        if (deltaTile) addTiles.push(deltaTile);
      }
      setBillboardContent(
        billboardId,
        liveChart
          ? {
              orientation,
              yawSteps,
              slides,
              intervalMs,
              slideshowEpochMs,
              visitName,
              visitUrl,
              liveChart,
            }
          : {
              orientation,
              yawSteps,
              slides,
              intervalMs,
              advertId: advertIds[0],
              advertIds,
              slideshowEpochMs,
              visitName,
              visitUrl,
            }
      );
      const uniqRemove = [...new Set(removeKeys)];
      broadcast(currentRoomId, {
        type: "billboards",
        roomId: currentRoomId,
        billboards: getBillboardsForRoom(currentRoomId).map(billboardToWire),
      });
      broadcast(currentRoomId, {
        type: "obstaclesDelta",
        roomId: currentRoomId,
        add: addTiles,
        remove: uniqRemove,
      });
      schedulePersistWorldState();
      logGameplayEvent(conn.sessionId, address, currentRoomId, "update_billboard", {
        billboardId,
        orientation,
        yawSteps,
        footprintChanged: true,
      });
      return;
    }

    if (msg.type === "updateSignboard") {
      if (!canEditRoomContent(currentRoomId, address)) {
        wsSafeSend(ws, { type: "error", code: "admin_required" });
        return;
      }
      // Admin-only: update a signboard's message
      if (!isAdmin(address)) {
        wsSafeSend(ws, { type: "error", code: "admin_required" });
        return;
      }
      const signboardId = String(msg.signboardId ?? "");
      const message = String(msg.message ?? "").trim();
      if (!signboardId || !message || message.length > SIGNBOARD_MESSAGE_MAX_LEN) {
        wsSafeSend(ws, { type: "error", code: "invalid_message" });
        return;
      }
      if (!updateSignboard(signboardId, message)) {
        wsSafeSend(ws, { type: "error", code: "signboard_not_found" });
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

    if (msg.type === "setVoxelText") {
      if (!canEditRoomContent(currentRoomId, address) || !isAdmin(address)) {
        wsSafeSend(ws, { type: "error", code: "admin_required" });
        return;
      }
      const next: VoxelTextSpec = {
        id: String(msg.id ?? "").trim(),
        text: String(msg.text ?? "").trim(),
        roomId: String(msg.roomId ?? currentRoomId).trim().toLowerCase(),
        x: Number(msg.x),
        y: Number(msg.y),
        z: Number(msg.z),
        yawDeg: Number(msg.yawDeg),
        unit: Number(msg.unit),
        letterSpacing: Number(msg.letterSpacing),
        color: Number(msg.color),
        emissive: Number(msg.emissive),
        emissiveIntensity: Number(msg.emissiveIntensity),
        zTween: Boolean(msg.zTween),
        zTweenAmp: Number(msg.zTweenAmp),
        zTweenSpeed: Number(msg.zTweenSpeed),
      };
      const saved = upsertVoxelText(next);
      if (!saved) {
        wsSafeSend(ws, { type: "error", code: "invalid_voxel_text" });
        return;
      }
      broadcast(saved.roomId, {
        type: "voxelTexts",
        roomId: saved.roomId,
        texts: getVoxelTextsForRoom(saved.roomId),
      });
      return;
    }

    if (msg.type === "removeVoxelText") {
      if (!canEditRoomContent(currentRoomId, address) || !isAdmin(address)) {
        wsSafeSend(ws, { type: "error", code: "admin_required" });
        return;
      }
      const rid = String(msg.roomId ?? currentRoomId).trim().toLowerCase();
      const id = String(msg.id ?? "").trim();
      if (!id) return;
      const removed = removeVoxelText(rid, id);
      if (!removed) return;
      broadcast(rid, {
        type: "voxelTexts",
        roomId: rid,
        texts: getVoxelTextsForRoom(rid),
      });
      return;
    }

    if (msg.type === "removeSignboard") {
      if (!canEditRoomContent(currentRoomId, address)) {
        wsSafeSend(ws, { type: "error", code: "admin_required" });
        return;
      }
      // Admin-only: remove a signboard
      if (!isAdmin(address)) {
        wsSafeSend(ws, { type: "error", code: "admin_required" });
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
        wsSafeSend(ws, { type: "error", code: "signboard_not_found" });
        return;
      }
      
      // Remove the signboard data
      if (!deleteSignboard(signboardId)) return;
      
      // Remove the obstacle block
      const k = tileKey(signboard.x, signboard.z);
      const placed = placedMap(currentRoomId);
      placed.delete(k);
      broadcast(currentRoomId, {
        type: "obstaclesDelta",
        roomId: currentRoomId,
        add: [],
        remove: [k],
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
    if (conn.pendingBlockClaimId) {
      releaseBlockClaimSession(conn.pendingBlockClaimId);
    }
    // Find which room the player is currently in
    const playerCurrentRoom = findPlayerRoom(address);
    if (playerCurrentRoom) {
      endSession(conn.sessionId, address, playerCurrentRoom, conn.sessionStartedAt);
      if (normalizeRoomId(playerCurrentRoom) !== CHAMBER_ROOM_ID) {
        spawnMap(playerCurrentRoom).set(address, {
          x: conn.player.x,
          z: conn.player.z,
          y: conn.player.y,
        });
        schedulePersistWorldState();
      }
      const room = roomOf(playerCurrentRoom);
      room.delete(address);
      console.log(
        `[rooms] disconnect ${address.slice(0, 12)}… room=${playerCurrentRoom}`
      );
      broadcast(playerCurrentRoom, { type: "playerLeft", address });
      broadcastOnlineCount();
      if (room.size === 0) clearFakePlayers(playerCurrentRoom);
    }
  });
}

/** Apply profile store display name + alias list to any live connection for this wallet. */
export function syncPlayerProfileDisplayNameForWallet(walletRaw: string): void {
  const key = compactAddress(walletRaw);
  if (!key) return;
  const name = getEffectivePlayerDisplayName(key);
  const aliases = getRecentAliases(key);
  for (const [roomId, room] of rooms) {
    for (const [addr, conn] of room) {
      if (compactAddress(addr) !== key) continue;
      conn.displayName = name;
      conn.player.displayName = name;
      conn.player.recentAliases = aliases;
      broadcastRoomStateFull(roomId);
      return;
    }
  }
}
