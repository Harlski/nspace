import { randomBytes, randomInt } from "node:crypto";
import type { WebSocket } from "ws";
import {
  isValidTeleporterLandingHint,
  resolveTeleporterLanding,
  parsePlacedKey,
  type TeleporterLandingContext,
} from "./teleporterLanding.js";
import {
  blockKey,
  canPlaceTeleporterFoot,
  floorWalkableTerrain,
  floorWalkableTerrainForMover,
  type FloorBrushSize,
  floorBrushTiles,
  inTileBounds,
  inferTerrainStartLayer,
  isBaseTile,
  isOrthogonallyAdjacentToTile,
  isWalkableTile,
  cubeRotationForPlainCube,
  clampHexRadiusScale,
  clampSphereRadiusScale,
  clampPyramidBaseScale,
  GATE_AUTH_MAX,
  gateWirePayload,
  normalizeBlockPrismParts,
  normalizeGateConfig,
  pathfindTiles,
  pathfindTerrain,
  level1SurfaceOpen,
  snapToTile,
  terrainObstacleHeight,
  tileKey,
  type PathfindMoverContext,
  type TerrainProps,
  type ExtraWalkableRef,
} from "./grid.js";
import {
  DEFAULT_INTEREST_HALF_TILES,
  interestChunksFromRect,
  NON_ADMIN_MAX_INTEREST_HALF_TILES,
  parseTileKeyXZ,
  roomUsesSpatialInterest,
  tileInInterestChunks,
  type ViewInterestRect,
} from "./interestChunks.js";
import {
  createOfficialRoomWithSize,
  createRoomWithSize,
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
  registerPlaySpaceRoomRuntime,
  clearPlaySpaceRoomRuntime,
  getPlaySpaceRoomRuntime,
  type RoomBounds,
} from "./roomLayouts.js";
import {
  getBuiltinRoomBackgroundState,
  isBuiltinRoomBuilder,
  patchBuiltinRoomSettings,
} from "./builtinRoomNames.js";
import {
  allowActorRoomBackgroundHueEdit,
  allowActorRoomJoinSpawnEdit,
  getDynamicRoomBackgroundState,
  getDynamicRoomJoinSpawn,
  getDynamicRoomOwnerAddress,
  isDynamicRoomBuilder,
  normalizeBackgroundHuePatch,
  normalizeBackgroundNeutralPatch,
  restoreDynamicRoom,
  softDeleteDynamicRoom,
  updateDynamicRoomMetadata,
  getDynamicRoomDeployablesAllowed,
  type RoomBackgroundNeutral,
} from "./roomRegistry.js";
import {
  deployRejectMessage,
  recordCosmeticDeploy,
  validateCosmeticDeploy,
} from "./cosmeticDeploy.js";
import {
  ensureAchievementRewardEntitlements,
  ensureOnboardingCompleteAchievements,
  evaluateLoginStreakAchievements,
  fireAchievementEvent,
  getAchievementCounterValue,
  recordBlockMined,
  recordBlockPlaced,
  recordBillboardDwellMs,
  recordChatMessageSent,
  recordDistinctTileWalked,
  recordExplorationDoorFromSpawn,
  recordExplorationRoomEntry,
  recordFieldGoalPayout,
  recordFieldGoalScored,
  recordFloorRecolored,
  recordGatekeeperOpen,
  recordImpatientMiner,
  recordMatchChallengeStarted,
  recordMatchEnd,
  recordMineCooldownAttempt,
  recordOutfieldTilesWalked,
  recordOwnedRoomBlockPlaced,
  recordPixelPaintAchievements,
  recordPixelPainted,
  recordPrefabPublished,
  recordPrefabStampedByOther,
  recordRoomCreatedForDeluxe,
  recordRoomJoinSpawnForDeluxe,
  recordSignboardOpened,
  recordSignpostPlaced,
  recordTeleporterActivated,
  recordTerrainShapePlaced,
  recordTeleporterWarp,
  recordTrustCircleWalk,
  tickExplorationDailyRollover,
  type AchievementUnlockWire,
  type MatchEndParticipantInput,
} from "./achievementStore.js";
import {
  isRushHourFieldGoal,
  isUnderdogCountryAtGoalTime,
} from "./fieldGoalAchievementEvaluator.js";
import { achievementCelebrationCount } from "./achievementCelebration.js";
import { getPublicLoadoutForWallet } from "./cosmeticStore.js";
import {
  COSMETIC_GALLERY_DEFAULT_SPAWN,
  cosmeticGalleryWelcomeExtras,
  isCosmeticGalleryRoom,
  resolveCosmeticGalleryJoinCode,
} from "./cosmeticGallery.js";
import {
  isJoinCode,
  isLegacyPlaySpaceSlug,
  normalizeJoinCode,
  walletRoomIdFromJoinCode,
} from "./joinCode.js";
import { generateMaze } from "./mazeGenerator.js";
import {
  loadWorldState,
  registerWorldStateRefs,
  hasPixelCheckerboardFloorMigration,
  hasPixelImplicitFloorMigration,
  hasPixelNeutralFloorMigration,
  markPixelCheckerboardFloorMigration,
  markPixelImplicitFloorMigration,
  markPixelNeutralFloorMigration,
  schedulePersistWorldState,
} from "./worldPersistence.js";
import {
  enqueueBlockClaimPayIntent,
  enqueuePayIntent,
  getPayoutWalletBalanceLuna,
  isPayoutSenderConfigured,
  peekPayoutBalanceCacheLuna,
  LUNA_PER_NIM,
} from "./payoutGateway.js";
import {
  CAMPAIGN_IMPRESSION_BATCH_MAX,
  recordCampaignImpressions,
  recordCampaignLinkClick,
} from "./campaignAnalyticsStore.js";
import {
  ANALYTICS_EVENT_KINDS,
  beginSession,
  endSession,
  logGameplayEvent,
} from "./eventLog.js";
import { censorChat, isEmptyAfterCensor } from "./profanityFilter.js";
import {
  getPlayerLastSession,
  PLAYER_RECONNECT_GRACE_MS,
  setPlayerLastSession,
} from "./playerLastSessionStore.js";
import { ensurePixelPaintBaseline, logPixelPaint } from "./pixelPaintLog.js";
import {
  invalidatePixelBoardPngCache,
  setPixelBoardColorSource,
} from "./pixelBoardImage.js";
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
  blockClaimAccessDeniedReason,
  BLOCK_CLAIM_MSG_GUEST,
} from "./blockClaimAccess.js";
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
  PIXEL_ROOM_ID,
  PIXEL_DEFAULT_SPAWN,
} from "./roomLayouts.js";
// worldcup: seasonal soccer (feature-flagged, deletable - grep "worldcup")
import {
  WORLDCUP_ENABLED,
  FIELD_ROOM_ID as WORLDCUP_FIELD_ROOM_ID,
  FIELD_BOUNDS as WORLDCUP_FIELD_BOUNDS,
  FIELD_OUTFIELD_MARGIN as WORLDCUP_FIELD_OUTFIELD_MARGIN,
  FIELD_GOALS as WORLDCUP_FIELD_GOALS,
  GOALIE as WORLDCUP_GOALIE,
  GOALIE_SENTINEL_ADDRESS as WORLDCUP_GOALIE_SENTINEL,
  GOAL_REWARD as WORLDCUP_GOAL_REWARD,
  MATCH as WORLDCUP_MATCH,
  WORLDCUP_GOALIE_MODE,
  isMatchPitchRoomId as worldcupIsMatchPitch,
  makeMatchPitchRoomId as worldcupMakeMatchPitchRoomId,
  type GoalZone as WorldcupGoalZone,
} from "./worldcup/config.js";
import {
  DIRECT_INVITE_ENABLED,
  buildInviteStateWire,
  closeInvite,
  generateGuestId,
  getInviteBySlug,
  getParticipant,
  getParticipantByWallet,
  isInviteLobbyRoomId,
  joinInviteAsWallet,
  markGuestJoinedLobby,
  markHostJoinedLobby,
  markHostLeftLobby,
  removeInviteParticipant,
  expireInvitePastTtl,
  listOpenInvites,
  type DirectInviteRecord,
} from "./directInvite/index.js";
import {
  INVITE_LOBBY_PREFIX,
} from "./directInvite/config.js";
import {
  applyBuildShell,
  buildShellFromLayoutSnapshot,
  getDefaultPlaySpaceTemplate,
  getPlaySpaceTemplate,
  initPlaySpaceTemplateStore,
  type BuildShell,
} from "./playSpaceTemplate/index.js";
import {
  PLAY_SPACE_BACKGROUND_HUE_DEG,
  PLAY_SPACE_SPAWN,
} from "./directInvite/playSpaceLayout.js";
import {
  initMatchState as worldcupInitMatchState,
  matchTimeRemainingMs as worldcupMatchTimeRemainingMs,
  reduceMatch as worldcupReduceMatch,
  type MatchConfig as WorldcupMatchConfig,
  type MatchOutcome as WorldcupMatchOutcome,
  type MatchPhase as WorldcupMatchPhase,
  type MatchSide as WorldcupMatchSide,
  type MatchState as WorldcupMatchState,
} from "./worldcup/match.js";
import {
  matchSpawn as worldcupMatchSpawn,
  scoringSideForGoal as worldcupScoringSideForGoal,
} from "./worldcup/matchPitch.js";
import {
  decideAndCommitGoalReward as worldcupDecideGoalReward,
  loadGoalRewards as loadWorldcupGoalRewards,
} from "./worldcup/goalReward.js";
import type { GoalRewardDecision } from "./worldcup/goalReward.js";
import {
  goalieCollider as worldcupGoalieCollider,
  goalieLineX as worldcupGoalieLineX,
  initGoalieState as worldcupInitGoalieState,
  stepGoalie as worldcupStepGoalie,
  type GoalieState as WorldcupGoalieState,
} from "./worldcup/goalie.js";
import {
  addPlacedBall as worldcupAddPlacedBall,
  ballsToWire as worldcupBallsToWire,
  clearRoomBalls as worldcupClearRoomBalls,
  getBalls as worldcupGetBalls,
  loadBalls as loadWorldcupBalls,
  removeBall as worldcupRemoveBall,
  roomHasBalls as worldcupRoomHasBalls,
  spawnMatchBall as worldcupSpawnMatchBall,
  type BallWire as WorldcupBallWire,
} from "./worldcup/ballStore.js";
import {
  forgetRoomBallBroadcast as worldcupForgetRoomBallBroadcast,
  tickRoomBalls as worldcupTickRoomBalls,
} from "./worldcup/ballTick.js";
import {
  getPlayerCountry as worldcupGetPlayerCountry,
  getPreviousDayWinner as worldcupGetPreviousDayWinner,
  getTopCountries as worldcupGetTopCountries,
  isValidCountryCode as worldcupIsValidCountryCode,
  loadScores as loadWorldcupScores,
  recordGoal as worldcupRecordGoal,
  rolloverIfNeeded as worldcupRolloverIfNeeded,
  setCountry as worldcupSetCountry,
} from "./worldcup/scoreStore.js";
import {
  deleteDesign,
  designToWire,
  loadDesigns,
  publishDesign,
  updateDesignVisibility,
} from "./designs.js";
import { planDesignStampInRoom } from "./designPlacement.js";
import type { DesignKind } from "./designSnapshot.js";
import {
  createSignboard,
  deleteSignboard,
  getSignboardAt,
  getSignboardById,
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
  isManagedCampaignBillboard,
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
import { compileRotationSet } from "./rotationSetCompile.js";
import { getRotationSetById } from "./rotationSetStore.js";
import { isWithinBillboardProximity } from "./miningPixelAchievementEvaluator.js";
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
import {
  BLOCK_COLOR_BILLBOARD_SLAB_RGB,
  BLOCK_COLOR_EXIT_PORTAL_RGB,
  BLOCK_COLOR_MAZE_RGB,
  BLOCK_COLOR_SIGNPOST_RGB,
  clampColorRgb,
  DEFAULT_BLOCK_COLOR_RGB,
  DEFAULT_EXTRA_FLOOR_COLOR_RGB,
  DEFAULT_GATE_BLOCK_COLOR_RGB,
  DEFAULT_PIXEL_CENTRAL_DARK_COLOR_RGB,
  pixelImplicitFloorColorRgb,
  resolveBlockColorRgb,
  resolveExtraFloorColorRgb,
} from "./blockColors.js";

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
    (a.chatTyping ?? false) === (b.chatTyping ?? false) &&
    (a.challengeOpen ?? false) === (b.challengeOpen ?? false) &&
    (a.worldcupCountry ?? null) === (b.worldcupCountry ?? null) &&
    (a.cosmeticAura ?? null) === (b.cosmeticAura ?? null) &&
    (a.cosmeticNameplate ?? null) === (b.cosmeticNameplate ?? null) &&
    (a.cosmeticChatBubble ?? null) === (b.cosmeticChatBubble ?? null) &&
    (a.cosmeticTrail ?? null) === (b.cosmeticTrail ?? null)
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
/** Room-scoped chat replayed on `welcome` (lines that also hit `broadcast` as non-bubble chat). */
const CHAT_BACKLOG_MAX_LINES = 50;
const CHAT_BACKLOG_WINDOW_MS = 10 * 60 * 1000;

type ChatBacklogLine = {
  from: string;
  fromAddress: string;
  text: string;
  at: number;
};

const chatBacklogByNormalizedRoom = new Map<string, ChatBacklogLine[]>();

function appendChatBacklogLine(roomId: string, line: ChatBacklogLine): void {
  const key = normalizeRoomId(roomId);
  let buf = chatBacklogByNormalizedRoom.get(key);
  if (!buf) {
    buf = [];
    chatBacklogByNormalizedRoom.set(key, buf);
  }
  buf.push(line);
  const cutoff = line.at - CHAT_BACKLOG_WINDOW_MS;
  while (buf.length > 0 && buf[0]!.at < cutoff) {
    buf.shift();
  }
  while (buf.length > CHAT_BACKLOG_MAX_LINES) {
    buf.shift();
  }
}

function chatBacklogSnapshotForWelcome(roomId: string, now: number): ChatBacklogLine[] {
  const key = normalizeRoomId(roomId);
  const buf = chatBacklogByNormalizedRoom.get(key);
  if (!buf?.length) return [];
  const cutoff = now - CHAT_BACKLOG_WINDOW_MS;
  return buf.filter((l) => l.at >= cutoff);
}

/** Recent chat lines from one wallet (server backlog, ~10 min window) for moderation reports. */
export function snapshotChatHistoryForWallet(
  wallet: string,
  roomId?: string
): ChatBacklogLine[] {
  const key = compactAddress(wallet);
  if (!key) return [];
  const now = Date.now();
  const cutoff = now - CHAT_BACKLOG_WINDOW_MS;
  const out: ChatBacklogLine[] = [];
  const collect = (buf: ChatBacklogLine[] | undefined): void => {
    if (!buf?.length) return;
    for (const line of buf) {
      if (line.at < cutoff) continue;
      if (compactAddress(line.fromAddress) !== key) continue;
      out.push({ ...line });
    }
  };
  if (roomId) {
    collect(chatBacklogByNormalizedRoom.get(normalizeRoomId(roomId)));
  } else {
    for (const buf of chatBacklogByNormalizedRoom.values()) {
      collect(buf);
    }
  }
  out.sort((a, b) => a.at - b.at);
  return out;
}
const RATE_MOVE_TO_MS = 120;
/** worldcup: pitch free-move (joystick / any-angle) needs faster heading updates than tap-to-walk. */
const RATE_MOVE_TO_FIELD_MS = TICK_MS;
/** Gate stays open for the opener to cross; then server clears `gateOpen`. */
const GATE_OPEN_PASS_MS = 1_000;

const CARDINAL_DIRS: readonly [number, number][] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];
/** Set `NSPACE_DEBUG_MOVEMENT=1` on the server for `[movement]` path and tile-crossing logs. */
const DEBUG_MOVEMENT =
  process.env.NSPACE_DEBUG_MOVEMENT === "1" ||
  String(process.env.NSPACE_DEBUG_MOVEMENT ?? "").toLowerCase() === "true";
const RATE_CHAT_MS = 800;
const RATE_PLACE_MS = 200;
const RATE_PUBLISH_DESIGN_MS = 1200;
const RATE_DESIGN_STAMP_MS = 800;
const ARRIVE_EPS = 0.04;
/** If idle (no path) and farther than this from the nearest legal stance, snap to that stance (unstick). */
const STANCE_SNAP_DRIFT_EPS = 0.48;
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
  Math.min(64, Number(process.env.PLACE_RADIUS_BLOCKS ?? "9"))
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
/** `beginBlockClaim.claimIntent` values from the world context menu Mine action - longer required adjacent hold. */
const BLOCK_CLAIM_CONTEXT_MENU_MINE_INTENTS = new Set([
  "world_ctx_adjacent",
  "world_ctx_auto_walk",
]);
const BLOCK_CLAIM_SESSION_MS = 45_000;
const RATE_BEGIN_BLOCK_CLAIM_MS = 600;
const RATE_BLOCK_CLAIM_TICK_MS = 170;
const RATE_COMPLETE_BLOCK_CLAIM_MS = 450;
const CLAIM_ACCUM_GAP_BREAK_MS = 950;
const CLAIM_ACCUM_DT_CAP_MS = 480;

/**
 * When > 0, `completeBlockClaim` uses any in-memory payout balance cache (`peek…`) for the
 * funds gate if it shows enough for the minimum reward - **without** an age check - so the
 * claim path does not await Nimiq behind in-flight payouts. Payout jobs still send on-chain
 * asynchronously; a stale-high cache is rare for a dedicated hot wallet. Set `0` to always
 * `await getPayoutWalletBalanceLuna()` on each complete (blocks on the Nimiq mutex).
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
  /** worldcup: this player has an open 1v1 Challenge floating above them (click to accept). */
  challengeOpen?: boolean;
  /** worldcup: this player's chosen country (ISO alpha-2), so the field crowd can wave their flag. */
  worldcupCountry?: string | null;
  /** Equipped passive cosmetic preset ids (compact; client renders VFX). */
  cosmeticAura?: string | null;
  cosmeticNameplate?: string | null;
  cosmeticChatBubble?: string | null;
  cosmeticTrail?: string | null;
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
  /** When `hex`: inscribed radius multiplier (1 = default; lower = thinner prism). */
  hexRadiusScale: number;
  /** Sphere column inscribed in tile; mutually exclusive with hex / pyramid / ramp. */
  sphere: boolean;
  /** When `sphere`: radius multiplier (1 = default). */
  sphereRadiusScale: number;
  /** Sloped ramp (walkable floor); `rampDir` 0–3 = +X,+Z,−X,−Z toward climbed block. */
  ramp: boolean;
  rampDir: number;
  /** Plain cube only: 0–3 = 90° steps per axis (visual). */
  cubeRotX: number;
  cubeRotY: number;
  cubeRotZ: number;
  /** Block tint 0xRRGGBB (hue ring). */
  colorRgb: number;
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
  gate?: {
    adminAddress: string;
    authorizedAddresses: string[];
    exitX: number;
    exitZ: number;
  };
  gateOpen?: {
    openedBy: string;
    untilMs: number;
  };
};

type PlacedProps = TerrainProps;

function colorRgbFromWire(msg: {
  colorRgb?: unknown;
  colorId?: unknown;
}): number {
  if (msg.colorRgb !== undefined && Number.isFinite(Number(msg.colorRgb))) {
    return clampColorRgb(Number(msg.colorRgb));
  }
  const legacyId = msg.colorId;
  if (legacyId !== undefined && Number.isFinite(Number(legacyId))) {
    return resolveBlockColorRgb({ colorId: Number(legacyId) });
  }
  return resolveBlockColorRgb({});
}

export type ExtraFloorTile = { x: number; z: number; colorRgb?: number };

interface ClientConn {
  ws: WebSocket;
  address: string;
  displayName: string;
  sessionId: string;
  sessionStartedAt: number;
  lastMoveToAt: number;
  lastChatAt: number;
  lastPlaceAt: number;
  lastPublishDesignAt?: number;
  lastDesignStampAt?: number;
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
  /** worldcup: open 1v1 Challenge raised by this player (broadcast as `challengeOpen`). */
  challengeOpen: boolean;
  /** worldcup: when the open Challenge was raised (ms epoch), for the auto-clear timeout. */
  challengeRaisedAtMs: number;
  /** worldcup: normalized Match Pitch room id while this player is in a 1v1, else null. */
  matchId: string | null;
  /** worldcup: pending-match id while in the pre-teleport handshake countdown, else null. */
  pendingMatchId: string | null;
  /** worldcup: pitch room id this player is *spectating* (in the stands), else null. */
  spectatingMatchId: string | null;
  /** directInvite: slug while host or guest is in a Direct Invite lobby. */
  directInviteSlug: string | null;
  /** Camera / view interest for spatial sync in large rooms. */
  viewInterest: ViewInterestRect;
  /** Chunk keys (`cx,cz`) currently loaded for this client. */
  subscribedChunks: Set<string>;
  /** `?stream=1` cinema view - receives room sync but is not a visible participant. */
  streamObserver?: boolean;
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

/** Floor recolor: axis-aligned square from the player's tile (±R tiles on X and Z). */
function withinFloorActionRange(
  player: PlayerState,
  tileX: number,
  tileZ: number
): boolean {
  if (PLACE_RADIUS_BLOCKS <= 0) return true;
  const stand = snapToTile(player.x, player.z);
  return (
    Math.abs(tileX - stand.x) <= PLACE_RADIUS_BLOCKS &&
    Math.abs(tileZ - stand.z) <= PLACE_RADIUS_BLOCKS
  );
}

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

function compactAddress(addr: string): string {
  return String(addr).replace(/\s+/g, "").toUpperCase();
}

/** Placer or admin may change/remove/move/rotate/update a billboard (managed campaign boards: admin only). */
function canModifyOwnBillboard(bb: Billboard, address: string): boolean {
  if (isManagedCampaignBillboard(bb)) return isAdmin(address);
  if (isAdmin(address)) return true;
  const owner = String(bb.createdBy ?? "").trim();
  if (!owner) return false;
  return compactAddress(owner) === compactAddress(address);
}

function canPlaceMineableBlocks(address: string): boolean {
  if (isAdmin(address)) return true;
  return MINEABLE_BLOCK_PLACER_ALLOWLIST.has(compactAddress(address));
}

/**
 * Per-room edit permissions:
 * - Canvas: no edits for anyone (view-only).
 * - Chamber: admins only.
 * - Pixel: floor recolor only (no blocks).
 * - Wallet-created rooms: owner, admin, or a wallet on the room's builder allowlist.
 * - Official rooms (no owner): admin or a wallet on the builder allowlist.
 * - Hub and other built-ins: anyone may edit (subject to hub safe zone, etc.).
 */
function canEditRoomContent(roomId: string, address: string): boolean {
  const id = normalizeRoomId(roomId);
  if (isInviteLobbyRoomId(id)) return true;
  if (id === CANVAS_ROOM_ID) return false;
  if (id === CHAMBER_ROOM_ID) {
    return isAdmin(address) || isBuiltinRoomBuilder(id, address);
  }
  if (isPlayerCreatedRoom(id)) {
    if (isAdmin(address)) return true;
    if (isDynamicRoomBuilder(id, address)) return true;
    const owner = getDynamicRoomOwnerAddress(id);
    if (!owner) return false;
    return compactAddress(address) === owner;
  }
  return true;
}

function isPixelRoom(roomId: string): boolean {
  return normalizeRoomId(roomId) === PIXEL_ROOM_ID;
}

function isWalletOwnedRoomOwner(roomId: string, address: string): boolean {
  const id = normalizeRoomId(roomId);
  if (!isPlayerCreatedRoom(id)) return false;
  const owner = getDynamicRoomOwnerAddress(id);
  if (!owner) return false;
  return compactAddress(address) === owner;
}

function trackFloorRecolorAchievement(
  wallet: string,
  roomId: string,
  x: number,
  z: number,
  colorRgb: number,
  ws: WebSocket
): void {
  recordFloorRecolored(
    wallet,
    roomId,
    x,
    z,
    colorRgb,
    achievementUnlockHandler(ws),
    { ownedRoomDeluxe: isWalletOwnedRoomOwner(roomId, wallet) }
  );
}

function roomAllowsFakePlayers(roomId: string): boolean {
  if (isCosmeticGalleryRoom(roomId)) return false;
  if (isInviteLobbyRoomId(roomId)) return false;
  if (isPixelRoom(roomId)) return false;
  // worldcup: keep the pitch clear of wandering NPCs - the crowd lives in the
  // (client-only) stands instead, so the field is reserved for real players.
  if (WORLDCUP_ENABLED && normalizeRoomId(roomId) === WORLDCUP_FIELD_ROOM_ID) {
    return false;
  }
  return true;
}

export function canPlaceBlocksInRoom(roomId: string, address: string): boolean {
  if (isCosmeticGalleryRoom(roomId)) return false;
  if (isInviteLobbyRoomId(roomId)) return canEditRoomContent(roomId, address);
  if (isPixelRoom(roomId)) return false;
  // worldcup: keep field + 1v1 match pitches clear of placed blocks
  if (worldcupIsFieldLikeRoom(roomId)) return false;
  return canEditRoomContent(roomId, address);
}

function canRecolorFloorInRoom(roomId: string, address: string): boolean {
  const id = normalizeRoomId(roomId);
  if (isCosmeticGalleryRoom(id)) return false;
  if (isInviteLobbyRoomId(id)) return canEditRoomContent(roomId, address);
  if (id === CANVAS_ROOM_ID) return false;
  if (id === PIXEL_ROOM_ID) return true;
  // worldcup: no floor painting on field or match pitches
  if (worldcupIsFieldLikeRoom(roomId)) return false;
  return canEditRoomContent(roomId, address);
}

/** Same rooms where the wallet may place blocks (Hub, owned wallet room, etc.). */
function canPublishDesign(roomId: string, address: string): boolean {
  return canPlaceBlocksInRoom(roomId, address);
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
      /** Custom tint on core/base walkable floor tiles. */
      baseFloorColorTiles?: ExtraFloorTile[];
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
      /** Wallet-room owner may capture object/room prefabs from this room. */
      allowPublishDesign?: boolean;
      /** Client may show floor-expand mode only when true; server still enforces. */
      allowExtraFloor: boolean;
      /** Cinema `?stream=1` session - observer only, not listed as a player. */
      streamObserver?: boolean;
      /** Dynamic rooms: this player may PATCH `backgroundHueDeg` (sidebar hue ring). */
      allowRoomBackgroundHueEdit?: boolean;
      /** Dynamic rooms: custom sky hue (0–359); null when using neutral or default. */
      roomBackgroundHueDeg?: number | null;
      /** Dynamic rooms: solid black / white / gray sky; overrides hue when non-null. */
      roomBackgroundNeutral?: RoomBackgroundNeutral | null;
      /** Dynamic rooms: tile used for default visitor spawn (custom or room center). */
      roomJoinSpawn?: { x: number; z: number; customized: boolean };
      /** Dynamic rooms: this client may PATCH `joinSpawn` via `updateRoom`. */
      allowRoomJoinSpawnEdit?: boolean;
      /** Dynamic rooms: deployable cosmetics allowed (default true). */
      roomDeployablesAllowed?: boolean;
      /** When set, this wallet cannot earn NIM from block claims (guest or mining restriction). */
      blockClaimDeniedReason?: string;
      /** Dynamic rooms: owner may toggle deployables via `updateRoom`. */
      allowRoomDeployablesEdit?: boolean;
      /** Recent room chat (non-bubble); same order as live `chat` messages. */
      chatBacklog: ChatBacklogLine[];
      // worldcup: current balls in this room (seasonal soccer)
      balls?: WorldcupBallWire[];
      /** worldcup: this player's chosen country (null until picked). */
      worldcupSelfCountry?: string | null;
      /** worldcup: leading countries for the in-room scoreboard (today, UTC). */
      worldcupTopCountries?: Array<{ code: string; goals: number }>;
      /** worldcup: previous UTC day's winning country (crowd waves this flag). */
      worldcupPrevWinnerCountry?: string | null;
      /** worldcup: live 1v1 spectate portals in this room (click to watch the Match). */
      worldcupPortals?: WorldcupPortalWire[];
      /** Dev-only Preset Gallery (`cosmetic-gallery` / join code SPACER). */
      cosmeticGallery?: import("./cosmeticGallery.js").CosmeticGalleryWire;
    }
  | {
      type: "roomBackgroundHue";
      roomId: string;
      hueDeg: number | null;
      neutral?: RoomBackgroundNeutral | null;
    }
  | {
      type: "roomJoinSpawn";
      roomId: string;
      x: number;
      z: number;
      customized: boolean;
    }
  | {
      type: "roomDeployablesAllowed";
      roomId: string;
      allowed: boolean;
    }
  | {
      type: "cosmeticDeployed";
      cosmeticSku: string;
      presetId: string;
      x: number;
      z: number;
      by: string;
      expiresAt: number;
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
      type: "baseFloorColorDelta";
      roomId: string;
      add: ExtraFloorTile[];
      remove: string[];
      loadChunks?: string[];
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
  /** Opening player only: gate swung visually but they cannot walk onto exit/front (or no path). */
  | { type: "gateWalkBlocked"; x: number; z: number; y: number }
  | { type: "error"; code: string }
  | {
      type: "designPublished";
      design: ReturnType<typeof designToWire>;
    }
  | { type: "designDeleted"; designId: string }
  | {
      type: "designUpdated";
      design: ReturnType<typeof designToWire>;
    }
  | {
      type: "designStampResult";
      ok: boolean;
      code?: string;
      obstacleCount?: number;
    }
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
      type: "shaperReturnFailed";
      reason: "not_in_shaper";
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
  // worldcup: dynamic ball positions (throttled) + goal celebration
  | { type: "ballState"; roomId: string; balls: WorldcupBallWire[] }
  | { type: "goalieState"; roomId: string; goalies: WorldcupGoalieWire[] }
  | {
      type: "goalScored";
      roomId: string;
      goalId: string;
      scorerAddress: string | null;
      scorerName: string | null;
      /** ISO country code credited, or null if the scorer has not picked one yet. */
      country: string | null;
      /** Leading countries after this goal (code + total goals). */
      topCountries: Array<{ code: string; goals: number }>;
    }
  // worldcup: per-scorer NIM reward outcome for a Free Play Field goal (sent only to the
  // scorer, never broadcast - the reward cap/budget is personal, not public).
  | {
      type: "goalRewardOutcome";
      roomId: string;
      /** `ok` = NIM credited; `wallet_cap`/`budget_exhausted` = no NIM this time. */
      reason: "ok" | "wallet_cap" | "budget_exhausted";
      /** Set only when `reason === "ok"` - the NIM credited, e.g. "0.25". */
      amountNim?: string;
    }
  // worldcup: spawn / remove a 1v1 spectate portal in a room (room-scoped)
  | ({ type: "matchPortalSpawn"; roomId: string } & WorldcupPortalWire)
  | { type: "matchPortalRemove"; roomId: string; matchId: string }
  // worldcup: pre-teleport handshake countdown shown to both players in the origin room
  | {
      type: "matchCountdown";
      roomId: string;
      /** ms until both players are teleported into the Match Pitch. */
      durationMs: number;
      /** The other player's wallet + chosen country (ISO alpha-2) or null, for the overlay. */
      opponentAddress: string;
      opponentCountry: string | null;
      /** The receiving player's chosen country (ISO alpha-2) or null. */
      selfCountry: string | null;
    }
  // worldcup: 1v1 Match live state + terminal result (Match Pitch rooms only)
  | {
      type: "matchState";
      roomId: string;
      matchId: string;
      scoreA: number;
      scoreB: number;
      phase: WorldcupMatchPhase;
      /** Remaining ms in the current phase (regulation, then golden goal). */
      remainingMs: number;
      /** Post-goal kickoff freeze remaining (0 = movement allowed). */
      kickoffRemainingMs: number;
      /** Wallet of side a (challenger) / side b (accepter), so the client knows its side. */
      aAddress: string;
      bAddress: string;
      /** Chosen country (ISO alpha-2) of each side, or null; for the flag scoreboard + crowd. */
      aCountry: string | null;
      bCountry: string | null;
    }
  | {
      type: "matchEnded";
      roomId: string;
      matchId: string;
      outcome: WorldcupMatchOutcome;
      scoreA: number;
      scoreB: number;
      aAddress: string;
      bAddress: string;
      aCountry: string | null;
      bCountry: string | null;
      /** ms before entrants are returned home (drives the Match Result Overlay countdown). */
      resultLingerMs: number;
    }
  // worldcup: a goal was scored in a 1v1 Match - announce it + drive the kickoff reset countdown
  | {
      type: "matchGoal";
      roomId: string;
      matchId: string;
      /** Which side scored (after own-goal resolution). */
      side: WorldcupMatchSide;
      scoreA: number;
      scoreB: number;
      /** Chosen country (ISO alpha-2) of the scoring side, or null, for the goal banner flag. */
      country: string | null;
      /**
       * ms both players are reset + frozen before play resumes (0 when this goal ended the
       * Match, so the client just flashes "GOAL!" and lets `matchEnded` show the result).
       */
      kickoffMs: number;
    }
  | {
      type: "worldcupLeaderboard";
      roomId: string;
      /** The receiving player's chosen country (null until picked). */
      selfCountry: string | null;
      /** Leading countries today (UTC); empty right after a daily reset. */
      topCountries: Array<{ code: string; goals: number }>;
      /** Previous UTC day's winning country (crowd flag); null if none yet. */
      prevWinnerCountry?: string | null;
      /** True when this update was triggered by the daily UTC reset. */
      dailyReset?: boolean;
    }
  // directInvite: Play Space overlay state (roster + capacity) for every member
  | {
      type: "directInviteState";
      slug: string;
      phase: string;
      hostDisplayName: string;
      shareUrl: string;
      expiresAtMs: number;
      isHost: boolean;
      roster: Array<{ displayName: string }>;
      occupancy: number;
      capacity: number;
    }
  | {
      type: "directInviteError";
      code: "expired" | "full" | "closed" | "not_found" | "disabled";
      message?: string;
    }
  /** Echo for RTT / latency HUD (see `clientPing` inbound). */
  | { type: "clientPong"; id: number }
  | {
      type: "serverNotice";
      kind: "restart_pending";
      /** Seconds until the server process is expected to exit (operator-scheduled). */
      etaSeconds: number;
      message?: string;
      /** Monotonic per-process; higher values supersede older notices on the client. */
      seq: number;
    }
  | {
      type: "achievementUnlocked";
      achievementId: string;
      title: string;
      description: string;
      points: number;
      rewardSku: string | null;
      rewardDisplayName: string | null;
      totalPoints: number;
    }
  | {
      type: "achievementCelebration";
      address: string;
    };

function deliverAchievementUnlocks(
  ws: WebSocket,
  unlocks: AchievementUnlockWire[]
): void {
  for (const u of unlocks) {
    wsSafeSend(ws, {
      type: "achievementUnlocked",
      achievementId: u.achievementId,
      title: u.title,
      description: u.description,
      points: u.points,
      rewardSku: u.rewardSku,
      rewardDisplayName: u.rewardDisplayName,
      totalPoints: u.totalPoints,
    } satisfies OutMsg);
  }
}

function broadcastAchievementCelebrations(
  roomId: string,
  address: string,
  unlockCount: number
): void {
  const n = achievementCelebrationCount(unlockCount);
  for (let i = 0; i < n; i++) {
    broadcast(roomId, { type: "achievementCelebration", address });
  }
}

function findClientConnByWs(
  ws: WebSocket
): { roomId: string; conn: ClientConn } | null {
  for (const [roomId, room] of rooms) {
    for (const conn of room.values()) {
      if (conn.ws === ws) return { roomId, conn };
    }
  }
  return null;
}

function deliverAchievementUnlocksWithCelebration(
  unlocks: AchievementUnlockWire[],
  ctx: { ws: WebSocket; address: string; roomId: string } | null,
  wsFallback?: WebSocket
): void {
  if (unlocks.length === 0) return;
  const ws = ctx?.ws ?? wsFallback;
  if (!ws) return;
  deliverAchievementUnlocks(ws, unlocks);
  if (ctx) {
    broadcastAchievementCelebrations(ctx.roomId, ctx.address, unlocks.length);
  }
}

function achievementUnlockHandler(ws: WebSocket) {
  return (unlocks: AchievementUnlockWire[]) => {
    const found = findClientConnByWs(ws);
    deliverAchievementUnlocksWithCelebration(
      unlocks,
      found
        ? { ws, address: found.conn.address, roomId: found.roomId }
        : null,
      ws
    );
  };
}

function achievementUnlockHandlerForAddress(address: string) {
  const compact = compactAddress(address);
  return (unlocks: AchievementUnlockWire[]) => {
    if (unlocks.length === 0) return;
    for (const [roomId, room] of rooms) {
      for (const conn of room.values()) {
        if (compactAddress(conn.address) === compact) {
          deliverAchievementUnlocksWithCelebration(unlocks, {
            ws: conn.ws,
            address: conn.address,
            roomId,
          });
          return;
        }
      }
    }
  };
}

function onPlayerEnteredRoom(
  conn: ClientConn,
  roomId: string,
  opts?: {
    isRoomChange?: boolean;
    spawnHint?: { x: number; z: number };
    /** True when spawn came from an explicit door transition (not resume reconnect). */
    doorSpawn?: boolean;
  }
): void {
  if (conn.streamObserver) return;
  ensureAchievementRewardEntitlements(conn.player.address);
  const onUnlock = achievementUnlockHandler(conn.ws);
  evaluateLoginStreakAchievements(conn.player.address, onUnlock);
  if (normalizeRoomId(roomId) === HUB_ROOM_ID) {
    fireAchievementEvent(conn.player.address, "enter_commons", onUnlock);
  }
  recordExplorationRoomEntry(conn.player.address, roomId, onUnlock);
  if (opts?.doorSpawn && opts.spawnHint) {
    recordExplorationDoorFromSpawn(
      conn.player.address,
      roomId,
      opts.spawnHint.x,
      opts.spawnHint.z,
      onUnlock
    );
  }
  if (opts?.isRoomChange) {
    fireAchievementEvent(conn.player.address, "visit_room", onUnlock);
  }
}

function spatialFilteredOutMsgType(type: OutMsg["type"]): boolean {
  return (
    type === "obstaclesDelta" ||
    type === "baseFloorColorDelta" ||
    type === "extraFloorDelta" ||
    type === "removedBaseFloorDelta"
  );
}

const rooms = new Map<string, Map<string, ClientConn>>();

/** Server-authoritative Shaper return origin (room + tile when they entered The Shaper). */
const SHAPER_RETURN_TTL_MS = 30 * 60 * 1000;
type ShaperReturnOrigin = { roomId: string; x: number; z: number; ts: number };
const shaperReturnOrigins = new Map<string, ShaperReturnOrigin>();

function rememberShaperReturnOrigin(
  address: string,
  fromRoomId: string,
  x: number,
  z: number
): void {
  if (isCosmeticGalleryRoom(fromRoomId)) return;
  shaperReturnOrigins.set(address, {
    roomId: normalizeRoomId(fromRoomId),
    x,
    z,
    ts: Date.now(),
  });
}

function consumeShaperReturnOrigin(address: string): ShaperReturnOrigin | null {
  const stored = shaperReturnOrigins.get(address);
  shaperReturnOrigins.delete(address);
  if (!stored) return null;
  if (Date.now() - stored.ts > SHAPER_RETURN_TTL_MS) return null;
  return stored;
}

function isValidShaperReturnRoom(roomId: string): boolean {
  const n = normalizeRoomId(roomId);
  return (
    roomId.trim() !== "" &&
    hasRoom(roomId) &&
    !worldcupIsMatchPitch(n) &&
    !isInviteLobbyRoomId(n) &&
    !isCosmeticGalleryRoom(roomId)
  );
}

function humanCompactAddressesInRoom(roomId: string): Set<string> {
  const r = rooms.get(normalizeRoomId(roomId));
  const out = new Set<string>();
  if (!r) return out;
  for (const c of r.values()) {
    if (String(c.displayName || "").trimStart().startsWith("[NPC]")) continue;
    out.add(compactAddress(c.address));
  }
  return out;
}

/** Human wallets present for chat audience (excludes stream observers and NPC labels). */
function liveChatAudienceInRoom(roomId: string): string[] {
  const r = rooms.get(normalizeRoomId(roomId));
  const out: string[] = [];
  if (!r) return out;
  for (const c of r.values()) {
    if (c.streamObserver) continue;
    if (String(c.displayName || "").trimStart().startsWith("[NPC]")) continue;
    out.push(compactAddress(c.address));
  }
  return out.sort();
}

function logChatBacklogDelivered(
  sessionId: string,
  address: string,
  roomId: string,
  backlog: ChatBacklogLine[]
): void {
  if (!backlog.length) return;
  logGameplayEvent(
    sessionId,
    address,
    roomId,
    ANALYTICS_EVENT_KINDS.chatBacklogDelivered,
    {
      lines: backlog.map((l) => ({
        at: l.at,
        fromAddress: compactAddress(l.fromAddress),
      })),
    }
  );
}
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
const roomExtraFloor = new Map<string, Map<string, number>>();
/** Custom tint on core/base walkable floor tiles within the room grid. */
const roomBaseFloorColors = new Map<string, Map<string, number>>();
/** Base-room tiles carved away in custom (dynamic) rooms only; tileKey "x,z". */
const roomBaseFloorRemoved = new Map<string, Set<string>>();

loadWorldState(
  roomPlaced,
  roomExtraFloor,
  roomBaseFloorColors,
  roomBaseFloorRemoved,
  lastSpawnByRoom,
  normalizeRoomId
);
registerWorldStateRefs(
  roomPlaced,
  roomExtraFloor,
  roomBaseFloorColors,
  roomBaseFloorRemoved,
  lastSpawnByRoom,
  normalizeRoomId
);
initPlaySpaceTemplateStore();

/** One-time: replace Pixel random-color seed with uniform neutral gray; then fill gaps. */
function migratePixelRoomToNeutralBaseFloor(): void {
  if (hasPixelNeutralFloorMigration()) return;
  const id = normalizeRoomId(PIXEL_ROOM_ID);
  const colors = baseFloorColorMap(id);
  colors.clear();
  markPixelNeutralFloorMigration();
  schedulePersistWorldState();
  console.log("[pixel] cleared floor color map for neutral implicit default");
}

/** Drop persisted neutral-gray entries - only non-default paints are stored. */
function migratePixelRoomToImplicitDefaultFloor(): void {
  if (hasPixelImplicitFloorMigration()) return;
  const id = normalizeRoomId(PIXEL_ROOM_ID);
  const colors = baseFloorColorMap(id);
  let removed = 0;
  for (const [k, v] of [...colors]) {
    const [x, z] = k.split(",").map(Number);
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    if (
      pixelImplicitFloorColorRgb(x!, z!) === v ||
      v === DEFAULT_PIXEL_CENTRAL_DARK_COLOR_RGB
    ) {
      colors.delete(k);
      removed++;
    }
  }
  markPixelImplicitFloorMigration();
  if (removed > 0) schedulePersistWorldState();
  console.log(
    `[pixel] implicit default floor - removed ${removed} redundant entries, ${colors.size} painted tiles kept`
  );
}

/** Pixel room: only store player-painted tiles (checkerboard + spawn pad are implicit). */
function ensurePixelRoomCanvasSeeded(): void {
  const id = normalizeRoomId(PIXEL_ROOM_ID);
  const colors = baseFloorColorMap(id);
  if (colors.size > 0) return;
  // Empty map = full implicit canvas; no 250k persisted defaults.
}

/** One-time: drop persisted tiles that match checkerboard / spawn-square implicit colors. */
function migratePixelRoomCheckerboardFloor(): void {
  if (hasPixelCheckerboardFloorMigration()) return;
  const id = normalizeRoomId(PIXEL_ROOM_ID);
  const colors = baseFloorColorMap(id);
  let removed = 0;
  for (const [k, v] of [...colors]) {
    const [x, z] = k.split(",").map(Number);
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    if (
      pixelImplicitFloorColorRgb(x!, z!) === v ||
      v === DEFAULT_PIXEL_CENTRAL_DARK_COLOR_RGB
    ) {
      colors.delete(k);
      removed++;
    }
  }
  markPixelCheckerboardFloorMigration();
  if (removed > 0) schedulePersistWorldState();
  invalidatePixelBoardPngCache();
  console.log(
    `[pixel] checkerboard implicit floor - removed ${removed} redundant entries`
  );
}

migratePixelRoomToNeutralBaseFloor();
migratePixelRoomToImplicitDefaultFloor();
migratePixelRoomCheckerboardFloor();
ensurePixelRoomCanvasSeeded();

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
      hexRadiusScale: 1,
      sphere: false,
      sphereRadiusScale: 1,
      ramp: false,
      rampDir: 0,
      colorRgb: BLOCK_COLOR_MAZE_RGB,
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
    hexRadiusScale: 1,
    sphere: false,
    sphereRadiusScale: 1,
    ramp: false,
    rampDir: 0,
    colorRgb: BLOCK_COLOR_EXIT_PORTAL_RGB,
    locked: true, // Lock so players can't edit it
  });
  
  // Broadcast the new maze to all players in canvas room
  broadcast(CANVAS_ROOM_ID, {
    type: "obstacles",
    roomId: canvasId,
    tiles: obstaclesToList(canvasId),
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

/** Play Space rooms that already received a template seed. */
const playSpaceLayoutSeeded = new Set<string>();

function playSpaceJoinSpawn(roomId: string): { x: number; z: number } {
  const runtime = getPlaySpaceRoomRuntime(roomId);
  if (runtime?.joinSpawn) return runtime.joinSpawn;
  return { x: PLAY_SPACE_SPAWN.x, z: PLAY_SPACE_SPAWN.z };
}

function playSpaceBackgroundState(roomId: string): {
  hueDeg: number | null;
  neutral: RoomBackgroundNeutral | null;
} {
  const runtime = getPlaySpaceRoomRuntime(roomId);
  if (runtime) {
    return { hueDeg: runtime.backgroundHueDeg, neutral: runtime.backgroundNeutral };
  }
  return { hueDeg: PLAY_SPACE_BACKGROUND_HUE_DEG, neutral: null };
}

function templateIdForInviteLobbyRoom(roomId: string): string {
  if (!isInviteLobbyRoomId(roomId)) {
    return getDefaultPlaySpaceTemplate()?.id ?? "";
  }
  const slug = roomId.startsWith(INVITE_LOBBY_PREFIX)
    ? roomId.slice(INVITE_LOBBY_PREFIX.length)
    : roomId.replace("invite-lobby-", "");
  const inv = getInviteBySlug(slug);
  if (inv?.templateId) return inv.templateId;
  return getDefaultPlaySpaceTemplate()?.id ?? "";
}

function resolvePlaySpaceTemplateForRoom(roomId: string) {
  const templateId = templateIdForInviteLobbyRoom(roomId);
  return (
    getPlaySpaceTemplate(templateId) ??
    getDefaultPlaySpaceTemplate() ??
    null
  );
}

/** Apply the Play Space Template build shell once per invite-lobby room id. */
function ensurePlaySpaceLayout(roomId: string): void {
  if (!isInviteLobbyRoomId(roomId) || playSpaceLayoutSeeded.has(roomId)) return;
  playSpaceLayoutSeeded.add(roomId);
  const template = resolvePlaySpaceTemplateForRoom(roomId);
  if (!template) return;
  const shell = template.buildShell;
  registerPlaySpaceRoomRuntime(roomId, {
    bounds: shell.bounds,
    backgroundHueDeg: shell.backgroundHueDeg,
    backgroundNeutral: shell.backgroundNeutral,
    joinSpawn: shell.joinSpawn,
  });
  applyBuildShell(shell, {
    clearGeometry: () => {
      roomPlaced.delete(roomId);
      roomBaseFloorColors.delete(roomId);
      roomExtraFloor.delete(roomId);
      roomBaseFloorRemoved.delete(roomId);
    },
    setObstacle: (tile, props) => {
      placedMap(roomId).set(tile, { ...props, locked: false });
    },
    setExtraFloor: (x, z, colorRgb) => {
      extraFloorMap(roomId).set(tileKey(x, z), colorRgb);
    },
    setBaseFloorColor: (x, z, colorRgb) => {
      baseFloorColorMap(roomId).set(tileKey(x, z), colorRgb);
    },
    addRemovedBaseFloor: (key) => {
      baseFloorRemovedEnsure(roomId).add(key);
    },
  });
}

/** Drop ephemeral Play Space geometry when the room is torn down. */
function clearPlaySpaceLayout(roomId: string): void {
  if (!isInviteLobbyRoomId(roomId)) return;
  playSpaceLayoutSeeded.delete(roomId);
  clearPlaySpaceRoomRuntime(roomId);
  roomPlaced.delete(roomId);
  roomBaseFloorColors.delete(roomId);
  roomExtraFloor.delete(roomId);
  roomBaseFloorRemoved.delete(roomId);
  lastSpawnByRoom.delete(roomId);
}

/** Build Shell snapshot for admin Play Space Template authoring. */
export function extractBuildShellForPlaySpaceTemplate(
  roomIdRaw: string
): BuildShell | null {
  const roomId = normalizeRoomId(roomIdRaw);
  if (isInviteLobbyRoomId(roomId) || worldcupIsMatchPitch(roomId)) return null;
  const snap = getRoomLayoutSnapshot(roomId);
  if (!snap || snap.spatial) return null;
  const custom = getDynamicRoomJoinSpawn(roomId);
  const joinSpawn = custom ?? {
    x: Math.floor((snap.roomBounds.minX + snap.roomBounds.maxX) / 2),
    z: Math.floor((snap.roomBounds.minZ + snap.roomBounds.maxZ) / 2),
  };
  return buildShellFromLayoutSnapshot(snap, joinSpawn);
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
  /** Required contiguous adjacent time before `completeBlockClaim` succeeds. */
  holdMsRequired: number;
  accumAdjacentMs: number;
  /** Last wall-clock sample for contiguous adjacent-time accumulation (0 = none). */
  lastSampleAt: number;
  /** Client path that started the claim (`direct_adjacent_click`, etc.). */
  claimIntent?: string;
}

/** Pixel room: last painter wallet per floor tile key (`x,z`). */
const pixelTilePainters = new Map<string, Map<string, string>>();

function pixelTilePainterMap(roomId: string): Map<string, string> {
  const id = normalizeRoomId(roomId);
  let map = pixelTilePainters.get(id);
  if (!map) {
    map = new Map();
    pixelTilePainters.set(id, map);
  }
  return map;
}

function otherPresentWalletsInRoom(
  room: Map<string, ClientConn>,
  excludeAddress: string
): Set<string> {
  const exclude = compactAddress(excludeAddress);
  const out = new Set<string>();
  for (const c of room.values()) {
    if (c.streamObserver) continue;
    const w = compactAddress(c.address);
    if (!w || w === exclude) continue;
    out.add(w);
  }
  return out;
}

function tickBillboardAudienceDwell(
  roomId: string,
  room: Map<string, ClientConn>,
  deltaMs: number
): void {
  if (deltaMs <= 0) return;
  if (countRealPlayersInRoom(roomId) < 2) return;
  const billboards = getBillboardsForRoom(roomId).filter(isManagedCampaignBillboard);
  if (billboards.length === 0) return;
  for (const c of room.values()) {
    if (c.streamObserver) continue;
    const stand = snapToTile(c.player.x, c.player.z);
    let nearLive = false;
    for (const bb of billboards) {
      if (
        isWithinBillboardProximity(
          stand.x,
          stand.z,
          footprintTileCoords(bb)
        )
      ) {
        nearLive = true;
        break;
      }
    }
    if (!nearLive) continue;
    recordBillboardDwellMs(
      c.address,
      deltaMs,
      achievementUnlockHandlerForAddress(c.address)
    );
  }
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

  enqueueBlockClaimPayIntent({
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
  placed: ReadonlyMap<string, PlacedProps>,
  moverCtx: PathfindMoverContext | null | undefined,
  roomId: string
): 0 | 1 {
  return inferTerrainStartLayer(
    p.x,
    p.z,
    p.y,
    placed,
    moverCtx ?? undefined,
    roomId
  );
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

/**
 * Nearest legal floor or block-top stance in a 3×3 around `snapToTile(px,pz)` (for rounding
 * off ramp/solid edges and post-cancel snaps).
 */
function resolveNearestTerrainNode(
  roomId: string,
  px: number,
  py: number,
  pz: number,
  placed: ReadonlyMap<string, PlacedProps>,
  moverCtx?: PathfindMoverContext | null
): { x: number; z: number; layer: 0 | 1 } | null {
  const extra = extraFloorMap(roomId);
  const br = baseRemovedReadonly(roomId);
  const center = snapToTile(px, pz);
  let bestD = Number.POSITIVE_INFINITY;
  let best: { x: number; z: number; layer: 0 | 1 } | null = null;
  const floorOk = (x: number, z: number): boolean =>
    moverCtx
      ? floorWalkableTerrainForMover(
          x,
          z,
          placed,
          extra,
          roomId,
          br,
          moverCtx.address,
          moverCtx.nowMs
        )
      : floorWalkableTerrain(x, z, placed, extra, roomId, br);
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = center.x + dx;
      const z = center.z + dz;
      if (!inTileBounds(x, z)) continue;
      if (floorOk(x, z)) {
        const wy = waypointY(0, x, z, placed);
        const d =
          (px - x) ** 2 + (pz - z) ** 2 + (py - wy) ** 2;
        if (d < bestD) {
          bestD = d;
          best = { x, z, layer: 0 };
        }
      }
      if (level1SurfaceOpen(placed, x, z)) {
        const wy = waypointY(1, x, z, placed);
        const d =
          (px - x) ** 2 + (pz - z) ** 2 + (py - wy) ** 2;
        if (d < bestD) {
          bestD = d;
          best = { x, z, layer: 1 };
        }
      }
    }
  }
  return best;
}

/** Pathfind / moveTo start tile: snapped stance if valid, else nearest legal node (never a solid floor cell). */
function resolvePathfindStartNode(
  roomId: string,
  p: PlayerState,
  placed: ReadonlyMap<string, PlacedProps>,
  moverCtx?: PathfindMoverContext | null
): { x: number; z: number; layer: 0 | 1 } | null {
  const extra = extraFloorMap(roomId);
  const br = baseRemovedReadonly(roomId);
  const t = snapToTile(p.x, p.z);
  const layer = inferStartLayer(p, placed, moverCtx, roomId);
  const floorOk =
    layer === 0 &&
    (moverCtx
      ? floorWalkableTerrainForMover(
          t.x,
          t.z,
          placed,
          extra,
          roomId,
          br,
          moverCtx.address,
          moverCtx.nowMs
        )
      : floorWalkableTerrain(t.x, t.z, placed, extra, roomId, br));
  const ok =
    floorOk || (layer === 1 && level1SurfaceOpen(placed, t.x, t.z));
  if (ok) return { x: t.x, z: t.z, layer };
  return resolveNearestTerrainNode(roomId, p.x, p.y, p.z, placed, moverCtx);
}

/** When a path is cleared mid-walk, snap to the nearest legal terrain stance (never into a solid from bad rounding). */
function snapPlayerToTerrainGrid(
  p: PlayerState,
  placed: ReadonlyMap<string, PlacedProps>,
  roomId: string,
  moverCtx?: PathfindMoverContext | null
): void {
  const solved = resolveNearestTerrainNode(
    roomId,
    p.x,
    p.y,
    p.z,
    placed,
    moverCtx
  );
  if (solved) {
    p.x = solved.x;
    p.z = solved.z;
    p.y = waypointY(solved.layer, solved.x, solved.z, placed);
  } else {
    const t = snapToTile(p.x, p.z);
    p.x = t.x;
    p.z = t.z;
    const layer = inferStartLayer(p, placed, moverCtx, roomId);
    p.y = waypointY(layer, t.x, t.z, placed);
  }
  p.vx = 0;
  p.vz = 0;
}

function findRecoveryTerrainPath(
  roomId: string,
  player: PlayerState,
  dest: { x: number; z: number },
  goalLayer: 0 | 1,
  placed: ReadonlyMap<string, PlacedProps>,
  extra: ExtraWalkableRef,
  /** Layer already used in the failed primary `pathfindTerrain` from `snapToTile(player)`. */
  primaryStartLayer: 0 | 1,
  moverCtx?: PathfindMoverContext | null
):
  | {
      full: { x: number; z: number; layer: 0 | 1 }[];
      start: { x: number; z: number; layer: 0 | 1 };
    }
  | null {
  const center = snapToTile(player.x, player.z);
  if (!inTileBounds(center.x, center.z)) return null;

  const prop = placed.get(blockKey(center.x, center.z, 0));
  const alternateLayers: (0 | 1)[] = [];
  if (
    isWalkableForRoom(roomId, center.x, center.z) &&
    (!prop || prop.passable || prop.ramp)
  ) {
    alternateLayers.push(0);
  }
  if (
    prop &&
    !prop.passable &&
    !prop.ramp &&
    level1SurfaceOpen(placed, center.x, center.z) &&
    player.y >= terrainObstacleHeight(prop) - 0.2
  ) {
    alternateLayers.push(1);
  }
  const uniq: (0 | 1)[] = [];
  for (const L of alternateLayers) {
    if (!uniq.includes(L)) uniq.push(L);
  }
  for (const startLayer of uniq) {
    if (startLayer === primaryStartLayer) continue;
    const full = pathfindTerrain(
      center.x,
      center.z,
      startLayer,
      dest.x,
      dest.z,
      goalLayer,
      placed,
      extra,
      roomId,
      baseRemovedReadonly(roomId),
      moverCtx ?? undefined
    );
    if (full && full.length > 0) {
      return {
        full,
        start: { x: center.x, z: center.z, layer: startLayer },
      };
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
    hexRadiusScale: clampHexRadiusScale(
      v.hexRadiusScale ?? (v as { hexHeightScale?: number }).hexHeightScale ?? 1
    ),
    sphere: v.sphere ?? false,
    sphereRadiusScale: clampSphereRadiusScale(v.sphereRadiusScale ?? 1),
    ramp: v.ramp ?? false,
    rampDir: Math.max(0, Math.min(3, Math.floor(v.rampDir ?? 0))),
    ...cubeRotationForPlainCube(
      {
        hex: v.hex ?? false,
        pyramid: v.pyramid ?? false,
        sphere: v.sphere ?? false,
        ramp: v.ramp ?? false,
      },
      v
    ),
    colorRgb: resolveBlockColorRgb(v),
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
    gate: v.gate ? gateWirePayload(v.gate) : undefined,
    gateOpen: v.gateOpen,
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
      hexRadiusScale: clampHexRadiusScale(
      v.hexRadiusScale ?? (v as { hexHeightScale?: number }).hexHeightScale ?? 1
    ),
      sphere: v.sphere ?? false,
      sphereRadiusScale: clampSphereRadiusScale(v.sphereRadiusScale ?? 1),
      ramp: v.ramp ?? false,
      rampDir: Math.max(0, Math.min(3, Math.floor(v.rampDir ?? 0))),
      ...cubeRotationForPlainCube(
        {
          hex: v.hex ?? false,
          pyramid: v.pyramid ?? false,
          sphere: v.sphere ?? false,
          ramp: v.ramp ?? false,
        },
        v
      ),
      colorRgb: resolveBlockColorRgb(v),
      signboardId: signboardMap.get(tileKey(x!, z!)),
      locked: v.locked ?? false,
      // Experimental: claimable blocks
      claimable: v.claimable,
      active: v.active,
      cooldownMs: v.cooldownMs,
      lastClaimedAt: v.lastClaimedAt,
      claimReactivateAtMs: v.claimReactivateAtMs,
      claimedBy: v.claimedBy,
      teleporter: v.teleporter,
      gate: v.gate ? gateWirePayload(v.gate) : undefined,
      gateOpen: v.gateOpen,
    });
  }
  return out;
}

function extraFloorMap(roomId: string): Map<string, number> {
  let s = roomExtraFloor.get(roomId);
  if (!s) {
    s = new Map();
    roomExtraFloor.set(roomId, s);
  }
  return s;
}

function extraFloorToList(roomId: string): ExtraFloorTile[] {
  const s = roomExtraFloor.get(roomId);
  if (!s) return [];
  const out: ExtraFloorTile[] = [];
  for (const [k, colorRgb] of s) {
    const [x, z] = k.split(",").map(Number);
    out.push({ x: x!, z: z!, colorRgb });
  }
  return out;
}

function baseFloorColorMap(roomId: string): Map<string, number> {
  let s = roomBaseFloorColors.get(roomId);
  if (!s) {
    s = new Map();
    roomBaseFloorColors.set(roomId, s);
  }
  return s;
}

function baseFloorColorToList(roomId: string): ExtraFloorTile[] {
  const s = roomBaseFloorColors.get(roomId);
  if (!s) return [];
  const out: ExtraFloorTile[] = [];
  for (const [k, colorRgb] of s) {
    const [x, z] = k.split(",").map(Number);
    out.push({ x: x!, z: z!, colorRgb });
  }
  return out;
}

function initPixelPaintLogAndBoardImage(): void {
  const id = normalizeRoomId(PIXEL_ROOM_ID);
  setPixelBoardColorSource(() => baseFloorColorMap(id));
  const tiles = baseFloorColorToList(id).flatMap((t) =>
    t.colorRgb === undefined ? [] : [{ x: t.x, z: t.z, colorRgb: t.colorRgb }]
  );
  ensurePixelPaintBaseline(tiles);
}
initPixelPaintLogAndBoardImage();

function otherPlayerOnTile(
  room: Map<string, ClientConn>,
  tile: { x: number; z: number },
  selfAddress: string
): boolean {
  for (const c of room.values()) {
    if (c.address === selfAddress) continue;
    const st = snapToTile(c.player.x, c.player.z);
    if (st.x === tile.x && st.z === tile.z) return true;
  }
  return false;
}

function anyPlayerOnTile(
  room: Map<string, ClientConn>,
  tile: { x: number; z: number }
): boolean {
  for (const c of room.values()) {
    const st = snapToTile(c.player.x, c.player.z);
    if (st.x === tile.x && st.z === tile.z) return true;
  }
  return false;
}

function tileHasPlacedBlocks(
  placed: ReadonlyMap<string, PlacedProps>,
  x: number,
  z: number
): boolean {
  const prefix = `${x},${z},`;
  for (const key of placed.keys()) {
    if (key.startsWith(prefix)) return true;
  }
  return false;
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

function buildInitialFrontier(
  roomId: string,
  ex: ReadonlyMap<string, number>
): Set<string> {
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
  ex: ReadonlyMap<string, number>
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
  const ex = extraFloorMap(roomId);
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
    ex.set(pick, DEFAULT_EXTRA_FLOOR_COLOR_RGB);
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
    extraFloorMap(roomId),
    roomId,
    baseRemovedReadonly(roomId)
  );
}

/** New extra tile must be outside the core grid and orthogonally adjacent to some walkable tile. */
function canPlaceExtraFloor(roomId: string, x: number, z: number): boolean {
  if (isPlayerCreatedRoom(roomId)) return false;
  const ex = extraFloorMap(roomId);
  const br = baseRemovedReadonly(roomId);
  if (ex.has(tileKey(x, z))) return false;
  if (isBaseTile(x, z, roomId)) return false;
  for (const [dx, dz] of ADJ_DIRS) {
    if (isWalkableTile(x + dx, z + dz, ex, roomId, br)) return true;
  }
  return false;
}

type PlaceExtraFloorTileOutcome =
  | { kind: "none" }
  | { kind: "restore_base"; key: string; x: number; z: number }
  | { kind: "recolor_extra"; x: number; z: number; colorRgb: number }
  | { kind: "recolor_base"; x: number; z: number; colorRgb: number }
  | { kind: "place_extra"; x: number; z: number; colorRgb: number };

function applyPlaceExtraFloorAtTile(
  roomId: string,
  room: Map<string, ClientConn>,
  address: string,
  tile: { x: number; z: number },
  colorRgb: number
): PlaceExtraFloorTileOutcome {
  const k = tileKey(tile.x, tile.z);

  if (isPixelRoom(roomId)) {
    if (!isBaseTile(tile.x, tile.z, roomId)) return { kind: "none" };
    const br = baseRemovedReadonly(roomId);
    if (br?.has(k)) return { kind: "none" };
    if (otherPlayerOnTile(room, tile, address)) return { kind: "none" };
    const baseColors = baseFloorColorMap(roomId);
    if (baseColors.get(k) === colorRgb) return { kind: "none" };
    baseColors.set(k, colorRgb);
    return { kind: "recolor_base", x: tile.x, z: tile.z, colorRgb };
  }

  if (
    isPlayerCreatedRoom(roomId) &&
    baseFloorRemovedEnsure(roomId).has(k)
  ) {
    const placedRm = placedMap(roomId);
    if (tileHasPlacedBlocks(placedRm, tile.x, tile.z)) return { kind: "none" };
    if (anyPlayerOnTile(room, tile)) return { kind: "none" };
    const rm = baseFloorRemovedEnsure(roomId);
    rm.delete(k);
    if (rm.size === 0) {
      roomBaseFloorRemoved.delete(roomId);
    }
    return { kind: "restore_base", key: k, x: tile.x, z: tile.z };
  }

  const ex = extraFloorMap(roomId);

  if (ex.has(k)) {
    if (otherPlayerOnTile(room, tile, address)) return { kind: "none" };
    if (ex.get(k) === colorRgb) return { kind: "none" };
    ex.set(k, colorRgb);
    return { kind: "recolor_extra", x: tile.x, z: tile.z, colorRgb };
  }

  if (isBaseTile(tile.x, tile.z, roomId)) {
    const br = baseRemovedReadonly(roomId);
    if (br?.has(k)) return { kind: "none" };
    if (otherPlayerOnTile(room, tile, address)) return { kind: "none" };
    const baseColors = baseFloorColorMap(roomId);
    if (baseColors.get(k) === colorRgb) return { kind: "none" };
    baseColors.set(k, colorRgb);
    return { kind: "recolor_base", x: tile.x, z: tile.z, colorRgb };
  }

  if (!canPlaceExtraFloor(roomId, tile.x, tile.z)) return { kind: "none" };
  if (anyPlayerOnTile(room, tile)) return { kind: "none" };
  ex.set(k, colorRgb);
  return { kind: "place_extra", x: tile.x, z: tile.z, colorRgb };
}

function parseFloorBrushSize(raw: unknown): FloorBrushSize {
  const n = Math.floor(Number(raw));
  if (n === 2) return 2;
  return 1;
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
    for (const k of ex.keys()) {
      const [x, z] = k.split(",").map(Number);
      minX = Math.min(minX, x!);
      maxX = Math.max(maxX, x!);
      minZ = Math.min(minZ, z!);
      maxZ = Math.max(maxZ, z!);
    }
  }
  return { minX, maxX, minZ, maxZ };
}

/**
 * worldcup: player movement clamp for a room. Field-like rooms (the pitch / Match Pitches) widen
 * the base walk bounds by the outfield margin so a player can step just behind the ball; the
 * ball's own collision walls are unchanged. Non-field rooms use the plain walk bounds.
 */
function worldcupMoveClampBounds(roomId: string): {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
} {
  const wb = walkBounds(roomId);
  if (!worldcupIsFieldLikeRoom(roomId) || WORLDCUP_FIELD_OUTFIELD_MARGIN <= 0) {
    return wb;
  }
  const m = WORLDCUP_FIELD_OUTFIELD_MARGIN;
  return {
    minX: wb.minX - m,
    maxX: wb.maxX + m,
    minZ: wb.minZ - m,
    maxZ: wb.maxZ + m,
  };
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
  const layer = inferStartLayer(player, placed, undefined, roomId);
  player.y = waypointY(layer, t.x, t.z, placed);
}

/** First-time / no-saved spawn for wallet-created rooms: custom join tile, else center, else random walkable. */
function resolveDefaultSpawnForPlayerRoom(roomId: string): {
  x: number;
  z: number;
} | null {
  const n = normalizeRoomId(roomId);
  if (!isPlayerCreatedRoom(n)) return null;
  const b = getRoomBaseBounds(n);
  const cx = Math.floor((b.minX + b.maxX) / 2);
  const cz = Math.floor((b.minZ + b.maxZ) / 2);
  const custom = getDynamicRoomJoinSpawn(n);
  if (custom) {
    const s = snapToTile(custom.x, custom.z);
    if (isWalkableForRoom(n, s.x, s.z)) return { x: s.x, z: s.z };
  }
  const cSnap = snapToTile(cx, cz);
  if (isWalkableForRoom(n, cSnap.x, cSnap.z)) return { x: cSnap.x, z: cSnap.z };
  const seed =
    (n.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0) ^ 0x9e3779b9) >>>
    0;
  const rng = mulberry32(seed);
  return pickRandomWalkableTile(n, rng);
}

/**
 * Resolve where a player lands when returning to `targetRoomId` (e.g. leaving The Shaper).
 * The caller's `(hintX, hintZ)` is an untrusted approximate position: it is used only if it
 * snaps to a walkable tile, otherwise we fall back to the player's saved spawn, the room's
 * default spawn, and finally the room center.
 */
function resolveReturnSpawn(
  targetRoomId: string,
  address: string,
  hintX: number,
  hintZ: number
): { x: number; z: number } {
  const n = normalizeRoomId(targetRoomId);
  if (Number.isFinite(hintX) && Number.isFinite(hintZ)) {
    const t = snapToTile(hintX, hintZ);
    if (isWalkableForRoom(n, t.x, t.z)) return { x: t.x, z: t.z };
  }
  const saved = spawnMap(n).get(address);
  if (saved) {
    const t = snapToTile(saved.x, saved.z);
    if (isWalkableForRoom(n, t.x, t.z)) return { x: t.x, z: t.z };
  }
  const def = resolveDefaultSpawnForPlayerRoom(n);
  if (def) return def;
  const b = getRoomBaseBounds(n);
  const c = snapToTile(
    Math.floor((b.minX + b.maxX) / 2),
    Math.floor((b.minZ + b.maxZ) / 2)
  );
  return { x: c.x, z: c.z };
}

function teleporterLandingContext(): TeleporterLandingContext {
  return {
    normalizeRoomId,
    hubRoomId: HUB_ROOM_ID,
    getRoomBounds: getRoomBaseBounds,
    isWalkableForRoom,
    floorWalkableAt: (roomId, x, z) =>
      floorWalkableTerrain(
        x,
        z,
        placedMap(roomId),
        extraFloorMap(roomId),
        roomId,
        baseRemovedReadonly(roomId)
      ),
    resolveDefaultSpawnForPlayerRoom,
  };
}

function resolveTeleporterLandingInRoom(
  targetRoomId: string,
  hintX: number,
  hintZ: number
): { x: number; z: number } {
  return resolveTeleporterLanding(
    targetRoomId,
    hintX,
    hintZ,
    teleporterLandingContext()
  );
}

function joinSpawnBroadcastPayload(roomId: string): {
  x: number;
  z: number;
  customized: boolean;
} {
  const n = normalizeRoomId(roomId);
  const b = getRoomBaseBounds(n);
  const cx = Math.floor((b.minX + b.maxX) / 2);
  const cz = Math.floor((b.minZ + b.maxZ) / 2);
  const custom = getDynamicRoomJoinSpawn(n);
  if (custom) {
    const s = snapToTile(custom.x, custom.z);
    return { x: s.x, z: s.z, customized: true };
  }
  const cSnap = snapToTile(cx, cz);
  return { x: cSnap.x, z: cSnap.z, customized: false };
}

function joinSpawnWelcomeExtras(
  roomId: string,
  address: string
): {
  roomJoinSpawn?: { x: number; z: number; customized: boolean };
  allowRoomJoinSpawnEdit?: boolean;
  roomDeployablesAllowed?: boolean;
  allowRoomDeployablesEdit?: boolean;
} {
  const n = normalizeRoomId(roomId);
  if (!isPlayerCreatedRoom(n)) return {};
  const owner = getDynamicRoomOwnerAddress(n);
  const actor = compactAddress(address);
  const canEdit =
    isAdmin(address) || (owner != null && compactAddress(owner) === actor);
  return {
    roomJoinSpawn: joinSpawnBroadcastPayload(n),
    allowRoomJoinSpawnEdit: allowActorRoomJoinSpawnEdit(
      n,
      actor,
      isAdmin(address)
    ),
    roomDeployablesAllowed: getDynamicRoomDeployablesAllowed(n),
    allowRoomDeployablesEdit: canEdit,
  };
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

function initClientViewInterest(
  conn: ClientConn,
  centerX: number,
  centerZ: number
): void {
  conn.viewInterest = {
    centerX,
    centerZ,
    halfW: DEFAULT_INTEREST_HALF_TILES,
    halfH: DEFAULT_INTEREST_HALF_TILES,
  };
  conn.subscribedChunks = interestChunksFromRect(conn.viewInterest);
}

function tileInClientInterest(conn: ClientConn, tx: number, tz: number): boolean {
  return tileInInterestChunks(tx, tz, conn.subscribedChunks);
}

function filterSpatialOutMsgForClient(
  conn: ClientConn,
  msg: OutMsg
): OutMsg | null {
  switch (msg.type) {
    case "obstaclesDelta": {
      const add = msg.add.filter((t) => tileInClientInterest(conn, t.x, t.z));
      const remove = msg.remove.filter((k) => {
        const p = parseTileKeyXZ(k);
        return p ? tileInClientInterest(conn, p.x, p.z) : false;
      });
      if (add.length === 0 && remove.length === 0) return null;
      return { ...msg, add, remove };
    }
    case "baseFloorColorDelta": {
      const add = msg.add.filter((t) => tileInClientInterest(conn, t.x, t.z));
      const remove = msg.remove.filter((k) => {
        const p = parseTileKeyXZ(k);
        return p ? tileInClientInterest(conn, p.x, p.z) : false;
      });
      if (add.length === 0 && remove.length === 0) return null;
      return { ...msg, add, remove };
    }
    case "extraFloorDelta": {
      const add = msg.add.filter((t) => tileInClientInterest(conn, t.x, t.z));
      const remove = msg.remove.filter((k) => {
        const p = parseTileKeyXZ(k);
        return p ? tileInClientInterest(conn, p.x, p.z) : false;
      });
      if (add.length === 0 && remove.length === 0) return null;
      return { ...msg, add, remove };
    }
    case "removedBaseFloorDelta": {
      const add = msg.add.filter((k) => {
        const p = parseTileKeyXZ(k);
        return p ? tileInClientInterest(conn, p.x, p.z) : false;
      });
      const remove = msg.remove.filter((k) => {
        const p = parseTileKeyXZ(k);
        return p ? tileInClientInterest(conn, p.x, p.z) : false;
      });
      if (add.length === 0 && remove.length === 0) return null;
      return { ...msg, add, remove };
    }
    default:
      return msg;
  }
}

function obstaclesInChunks(
  roomId: string,
  chunks: ReadonlySet<string>
): ObstacleTile[] {
  return obstaclesToList(roomId).filter((t) =>
    tileInInterestChunks(t.x, t.z, chunks)
  );
}

function baseFloorColorInChunks(
  roomId: string,
  chunks: ReadonlySet<string>
): ExtraFloorTile[] {
  const s = roomBaseFloorColors.get(roomId);
  if (!s || s.size === 0) return [];
  const out: ExtraFloorTile[] = [];
  for (const [k, colorRgb] of s) {
    const [x, z] = k.split(",").map(Number);
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    if (!tileInInterestChunks(x!, z!, chunks)) continue;
    out.push({ x: x!, z: z!, colorRgb });
  }
  return out;
}

function extraFloorInChunks(
  roomId: string,
  chunks: ReadonlySet<string>
): ExtraFloorTile[] {
  return extraFloorToList(roomId).filter((t) =>
    tileInInterestChunks(t.x, t.z, chunks)
  );
}

function removedBaseFloorInChunks(
  roomId: string,
  chunks: ReadonlySet<string>
): ExtraFloorTile[] {
  return removedBaseFloorToList(roomId).filter((t) =>
    tileInInterestChunks(t.x, t.z, chunks)
  );
}

function obstacleKeysInChunks(
  roomId: string,
  chunks: ReadonlySet<string>
): string[] {
  const m = roomPlaced.get(roomId);
  if (!m) return [];
  const out: string[] = [];
  for (const k of m.keys()) {
    const p = parseTileKeyXZ(k);
    if (p && tileInInterestChunks(p.x, p.z, chunks)) out.push(k);
  }
  return out;
}

function tileKeysInChunks(
  keys: Iterable<string>,
  chunks: ReadonlySet<string>
): string[] {
  const out: string[] = [];
  for (const k of keys) {
    const p = parseTileKeyXZ(k);
    if (p && tileInInterestChunks(p.x, p.z, chunks)) out.push(k);
  }
  return out;
}

function sendInterestChunkLoad(
  conn: ClientConn,
  roomId: string,
  chunks: ReadonlySet<string>
): void {
  const addObs = obstaclesInChunks(roomId, chunks);
  if (addObs.length > 0) {
    wsSafeSend(conn.ws, {
      type: "obstaclesDelta",
      roomId,
      add: addObs,
      remove: [],
    });
  }
  const addBase = baseFloorColorInChunks(roomId, chunks);
  const rb = getRoomBaseBounds(roomId);
  if (roomUsesSpatialInterest(rb)) {
    wsSafeSend(conn.ws, {
      type: "baseFloorColorDelta",
      roomId,
      add: addBase,
      remove: [],
      loadChunks: [...chunks],
    });
  } else if (addBase.length > 0) {
    wsSafeSend(conn.ws, {
      type: "baseFloorColorDelta",
      roomId,
      add: addBase,
      remove: [],
    });
  }
  const addExtra = extraFloorInChunks(roomId, chunks);
  if (addExtra.length > 0) {
    wsSafeSend(conn.ws, {
      type: "extraFloorDelta",
      roomId,
      add: addExtra,
      remove: [],
    });
  }
  const addRemoved = removedBaseFloorInChunks(roomId, chunks);
  if (addRemoved.length > 0) {
    wsSafeSend(conn.ws, {
      type: "removedBaseFloorDelta",
      roomId,
      add: addRemoved.map((t) => tileKey(t.x, t.z)),
      remove: [],
    });
  }
}

function sendInterestChunkUnload(
  conn: ClientConn,
  roomId: string,
  chunks: ReadonlySet<string>
): void {
  const remObs = obstacleKeysInChunks(roomId, chunks);
  if (remObs.length > 0) {
    wsSafeSend(conn.ws, {
      type: "obstaclesDelta",
      roomId,
      add: [],
      remove: remObs,
    });
  }
  const baseMap = roomBaseFloorColors.get(roomId);
  const remBase = baseMap
    ? tileKeysInChunks(baseMap.keys(), chunks)
    : [];
  if (remBase.length > 0) {
    wsSafeSend(conn.ws, {
      type: "baseFloorColorDelta",
      roomId,
      add: [],
      remove: remBase,
    });
  }
  const extraMap = roomExtraFloor.get(roomId);
  const remExtra = extraMap
    ? tileKeysInChunks(extraMap.keys(), chunks)
    : [];
  if (remExtra.length > 0) {
    wsSafeSend(conn.ws, {
      type: "extraFloorDelta",
      roomId,
      add: [],
      remove: remExtra,
    });
  }
  const removedSet = roomBaseFloorRemoved.get(roomId);
  const remRemoved = removedSet
    ? tileKeysInChunks(removedSet, chunks)
    : [];
  if (remRemoved.length > 0) {
    wsSafeSend(conn.ws, {
      type: "removedBaseFloorDelta",
      roomId,
      add: [],
      remove: remRemoved,
    });
  }
}

function updateClientViewInterest(
  conn: ClientConn,
  roomId: string,
  rect: ViewInterestRect,
  retainLoaded?: boolean
): void {
  conn.viewInterest = rect;
  const newChunks = interestChunksFromRect(rect);
  const oldChunks = conn.subscribedChunks;
  const added = new Set<string>();
  if (retainLoaded) {
    for (const c of newChunks) {
      if (!oldChunks.has(c)) {
        added.add(c);
        oldChunks.add(c);
      }
    }
  } else {
    const removed = new Set<string>();
    for (const c of newChunks) {
      if (!oldChunks.has(c)) added.add(c);
    }
    for (const c of oldChunks) {
      if (!newChunks.has(c)) removed.add(c);
    }
    conn.subscribedChunks = newChunks;
    if (removed.size > 0) sendInterestChunkUnload(conn, roomId, removed);
  }
  if (added.size > 0) sendInterestChunkLoad(conn, roomId, added);
}

function welcomeSpatialLists(
  roomId: string,
  conn: ClientConn
): {
  obstacles: ObstacleTile[];
  extraFloorTiles: ExtraFloorTile[];
  baseFloorColorTiles: ExtraFloorTile[];
  removedBaseFloorTiles: ExtraFloorTile[];
} {
  const chunks = conn.subscribedChunks;
  return {
    obstacles: obstaclesInChunks(roomId, chunks),
    extraFloorTiles: extraFloorInChunks(roomId, chunks),
    baseFloorColorTiles: baseFloorColorInChunks(roomId, chunks),
    removedBaseFloorTiles: removedBaseFloorInChunks(roomId, chunks),
  };
}

function broadcast(roomId: string, msg: OutMsg, except?: string): void {
  if (msg.type === "chat" && !msg.bubbleOnly) {
    appendChatBacklogLine(roomId, {
      from: msg.from,
      fromAddress: msg.fromAddress,
      text: msg.text,
      at: msg.at,
    });
  }
  const rb = getRoomBaseBounds(roomId);
  if (
    spatialFilteredOutMsgType(msg.type) &&
    roomUsesSpatialInterest(rb)
  ) {
    const r = roomOf(roomId);
    for (const [addr, c] of r) {
      if (except && addr === except) continue;
      if (c.ws.readyState !== 1) continue;
      const filtered = filterSpatialOutMsgForClient(c, msg);
      if (!filtered) continue;
      const payload = JSON.stringify(filtered);
      recordGameWsOutbound(
        filtered.type,
        Buffer.byteLength(payload, "utf8"),
        1
      );
      c.ws.send(payload);
    }
    return;
  }
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

/** Broadcast maintenance countdown to every connected game client (all rooms). */
export function broadcastRestartPendingNotice(
  etaSeconds: number,
  message: string | undefined,
  seq: number
): void {
  broadcastAll({
    type: "serverNotice",
    kind: "restart_pending",
    etaSeconds,
    message,
    seq,
  } satisfies OutMsg);
}

function countRealPlayersInRoom(roomId: string): number {
  const r = rooms.get(roomId);
  if (!r) return 0;
  let n = 0;
  for (const c of r.values()) {
    if (c.streamObserver) continue;
    if (!c.displayName.startsWith("[NPC] ")) n += 1;
  }
  return n;
}

/** Live non-NPC client count (HTTP profile, admin tools). */
export function getLiveRealPlayerCountInRoom(roomIdRaw: string): number {
  return countRealPlayersInRoom(normalizeRoomId(roomIdRaw));
}

/** Unified 6-char join codes (wallet rooms + Play Spaces) are case-insensitive. */
function normalizeJoinRoomId(raw: string): string {
  const t = String(raw).trim().replace(/\s+/g, "");
  if (isJoinCode(t)) return walletRoomIdFromJoinCode(t);
  return normalizeRoomId(raw);
}

/** Resolve join target; legacy 8-char Play Space slugs stay case-sensitive. */
function resolveJoinRoomTarget(raw: string): string {
  const trimmed = String(raw).trim().replace(/\s+/g, "");
  if (!trimmed) return "";
  const galleryTarget = resolveCosmeticGalleryJoinCode(trimmed);
  if (galleryTarget) return galleryTarget;
  const normalized = normalizeRoomId(trimmed);
  if (isInviteLobbyRoomId(normalized)) return normalized;

  if (isLegacyPlaySpaceSlug(trimmed)) {
    const invite = getInviteBySlug(trimmed);
    if (invite?.phase === "open" && hasRoom(invite.lobbyRoomId)) {
      return invite.lobbyRoomId;
    }
  }

  if (isJoinCode(trimmed)) {
    const walletId = walletRoomIdFromJoinCode(trimmed);
    if (hasRoom(walletId)) return walletId;
    const code = normalizeJoinCode(trimmed);
    const invite = getInviteBySlug(code);
    if (invite?.phase === "open" && hasRoom(invite.lobbyRoomId)) {
      return invite.lobbyRoomId;
    }
    return walletId;
  }

  if (hasRoom(normalized)) return normalized;
  const invite = getInviteBySlug(trimmed);
  if (invite?.phase === "open" && hasRoom(invite.lobbyRoomId)) {
    return invite.lobbyRoomId;
  }
  const lower = normalizeRoomId(trimmed.toLowerCase());
  if (hasRoom(lower)) return lower;
  return normalized;
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

/** Re-send the room catalog to every connected client (e.g. after admin edits a room). */
export function broadcastRoomCatalogRefresh(): void {
  broadcastRoomCatalogToAll();
}

export type RoomLayoutSnapshot = {
  roomId: string;
  displayName: string;
  isBuiltin: boolean;
  roomBounds: RoomBounds;
  doors: Array<{
    x: number;
    z: number;
    targetRoomId: string;
    spawnX: number;
    spawnZ: number;
  }>;
  placeRadiusBlocks: number;
  /** When true, this is a huge spatial room (e.g. Pixel); heavy tile lists are omitted. */
  spatial: boolean;
  obstacles: ObstacleTile[];
  extraFloorTiles: ExtraFloorTile[];
  baseFloorColorTiles: ExtraFloorTile[];
  removedBaseFloorTiles: ExtraFloorTile[];
  signboards: Array<{
    id: string;
    x: number;
    z: number;
    message: string;
    createdBy: string;
    createdAt: number;
  }>;
  billboards: ReturnType<typeof billboardToWire>[];
  voxelTexts: ReturnType<typeof getVoxelTextsForRoom>;
  roomBackgroundHueDeg: number | null;
  roomBackgroundNeutral: RoomBackgroundNeutral | null;
  joinSpawn: { x: number; z: number; customized: boolean };
};

/**
 * Full, non-spatial room layout for offscreen rendering (admin preview).
 * Mirrors the `welcome` geometry payload but with no player/connection context.
 * For huge spatial rooms (Pixel), heavy floor lists are omitted (`spatial: true`)
 * since a 2D raster (`/pixels.png`) is the appropriate preview.
 */
export function getRoomLayoutSnapshot(roomIdRaw: string): RoomLayoutSnapshot | null {
  const roomId = normalizeRoomId(roomIdRaw);
  const defs = listRoomDefinitions();
  const def =
    defs.find((d) => d.id === roomId) ??
    listDeletedRoomDefinitions().find((d) => d.id === roomId);
  if (!def) return null;
  const rb = getRoomBaseBounds(roomId);
  const doors = getDoorsForRoom(roomId).map((d) => ({
    x: d.x,
    z: d.z,
    targetRoomId: normalizeRoomId(d.targetRoomId),
    spawnX: d.spawnX,
    spawnZ: d.spawnZ,
  }));
  const spatial = roomUsesSpatialInterest(rb);
  const bgState = isPlayerCreatedRoom(roomId)
    ? getDynamicRoomBackgroundState(roomId)
    : getBuiltinRoomBackgroundState(roomId);
  const signboards = getSignboardsForRoom(roomId).map((s) => ({
    id: s.id,
    x: s.x,
    z: s.z,
    message: s.message,
    createdBy: s.createdBy,
    createdAt: s.createdAt,
  }));
  return {
    roomId,
    displayName: def.displayName,
    isBuiltin: def.isBuiltin,
    roomBounds: rb,
    doors,
    placeRadiusBlocks: PLACE_RADIUS_BLOCKS,
    spatial,
    obstacles: obstaclesToList(roomId),
    extraFloorTiles: spatial ? [] : extraFloorToList(roomId),
    baseFloorColorTiles: spatial ? [] : baseFloorColorToList(roomId),
    removedBaseFloorTiles: spatial ? [] : removedBaseFloorToList(roomId),
    signboards,
    billboards: getBillboardsForRoom(roomId).map(billboardToWire),
    voxelTexts: getVoxelTextsForRoom(roomId),
    roomBackgroundHueDeg: bgState.hueDeg,
    roomBackgroundNeutral: bgState.neutral,
    joinSpawn: joinSpawnBroadcastPayload(roomId),
  };
}

/** Top-down floor colors for a room (base + extra), for a 2D raster thumbnail. */
export function getRoomFloorColorMapForThumbnail(roomIdRaw: string): {
  bounds: RoomBounds;
  colorAt: (x: number, z: number) => number | null;
} | null {
  const roomId = normalizeRoomId(roomIdRaw);
  const defs = listRoomDefinitions();
  const def =
    defs.find((d) => d.id === roomId) ??
    listDeletedRoomDefinitions().find((d) => d.id === roomId);
  if (!def) return null;
  const bounds = getRoomBaseBounds(roomId);
  const baseColors = roomBaseFloorColors.get(roomId);
  const extraColors = roomExtraFloor.get(roomId);
  const removed = roomBaseFloorRemoved.get(roomId);
  const isPixel = roomId === PIXEL_ROOM_ID;
  /** Matches client `TERRAIN_TILE_CORE_COLOR` for un-painted base tiles. */
  const CORE_FLOOR_COLOR_RGB = 0x2d3340;
  return {
    bounds,
    colorAt: (x: number, z: number): number | null => {
      const key = `${x},${z}`;
      const extra = extraColors?.get(key);
      if (extra !== undefined) return extra;
      if (removed?.has(key)) return null;
      if (!isBaseTile(x, z, roomId)) return null;
      const base = baseColors?.get(key);
      if (base !== undefined) return base;
      return isPixel ? pixelImplicitFloorColorRgb(x, z) : CORE_FLOOR_COLOR_RGB;
    },
  };
}

export function countOnlineRealPlayers(): number {
  let total = 0;
  for (const room of rooms.values()) {
    for (const c of room.values()) {
      if (c.streamObserver) continue;
      if (!c.displayName.startsWith("[NPC] ")) total += 1;
    }
  }
  return total;
}

/** Display labels for other real players currently in the room (excludes self, NPCs, stream observers). */
export function getCoPresencePlayerLabelsInRoom(
  roomIdRaw: string,
  exceptAddress: string,
  limit = 8
): string[] {
  const roomId = normalizeRoomId(roomIdRaw);
  const r = rooms.get(roomId);
  if (!r) return [];
  const except = exceptAddress.trim().toUpperCase();
  const out: string[] = [];
  for (const c of r.values()) {
    if (c.streamObserver) continue;
    if (c.displayName.startsWith("[NPC] ")) continue;
    const addrKey =
      c.address.startsWith("guest:") ? c.address : c.address.trim().toUpperCase();
    const exceptKey =
      exceptAddress.startsWith("guest:") ? exceptAddress : except;
    if (addrKey === exceptKey) continue;
    const label = c.displayName.trim() || walletDisplayName(c.address);
    out.push(label);
    if (out.length >= limit) break;
  }
  return out;
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
  if (!roomAllowsFakePlayers(roomId)) {
    clearFakePlayers(roomId);
    return;
  }
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

function formatTerrainPathWaypoint(w: { x: number; z: number; layer: 0 | 1 }): string {
  return `${w.x},${w.z} L${w.layer}`;
}

function logMovementDebug(phase: string, data: Record<string, unknown>): void {
  if (!DEBUG_MOVEMENT) return;
  console.log(`[movement] ${phase}`, data);
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
    const wb = worldcupMoveClampBounds(roomId);
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

function applyCosmeticLoadoutToPlayer(player: PlayerState): void {
  const loadout = getPublicLoadoutForWallet(player.address);
  player.cosmeticAura = loadout.presetIds.aura ?? null;
  player.cosmeticNameplate = loadout.presetIds.nameplate ?? null;
  player.cosmeticChatBubble = loadout.presetIds.chatBubble ?? null;
  player.cosmeticTrail = loadout.presetIds.trail ?? null;
}

function playerToOutState(conn: ClientConn): PlayerState {
  const base = conn.nimSendIntent
    ? { ...conn.player, nimSendAway: true }
    : { ...conn.player };
  applyCosmeticLoadoutToPlayer(base);
  if (conn.chatTyping) base.chatTyping = true;
  if (conn.challengeOpen) base.challengeOpen = true;
  if (WORLDCUP_ENABLED) {
    const country = worldcupGetPlayerCountry(conn.address);
    if (country) base.worldcupCountry = country;
  }
  return base;
}

function snapshotPlayers(roomId: string): PlayerState[] {
  const humans = [...roomOf(roomId).values()]
    .filter((c) => !c.streamObserver)
    .map(playerToOutState);
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
      resolveBlockColorRgb(tileProps) === BLOCK_COLOR_EXIT_PORTAL_RGB &&
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
  hexRadiusScale: 1,
  sphere: false,
  sphereRadiusScale: 1,
  half: false,
  ramp: false,
  rampDir: 0,
  colorRgb: BLOCK_COLOR_EXIT_PORTAL_RGB,
  locked: true,
};

function placePendingTeleporterAt(
  conn: ClientConn,
  roomId: string,
  x: number,
  z: number
): boolean {
  const address = conn.address;
  if (isInviteLobbyRoomId(normalizeRoomId(roomId))) return false;
  if (!canPlaceBlocksInRoom(roomId, address)) return false;
  if (normalizeRoomId(roomId) === CANVAS_ROOM_ID) return false;
  if (!hasRoom(roomId)) return false;

  const placed = placedMap(roomId);
  const extra = extraFloorMap(roomId);
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

/** Keys to remove from `obstaclesDelta.remove` for a stored placed key (handles legacy vs blockKey). */
function obstacleRemovalKeysForPlacedKey(storageKey: string): string[] {
  const parts = storageKey.split(",").map(Number);
  const x = parts[0]!;
  const z = parts[1]!;
  const yRaw = parts[2];
  const ty = Number.isFinite(yRaw) ? Math.max(0, Math.min(2, Math.floor(yRaw))) : 0;
  const clientKey = blockKey(x, z, ty);
  return storageKey !== clientKey ? [storageKey, clientKey] : [clientKey];
}

function deleteTeleporterPeerIfLinked(
  placed: Map<string, PlacedProps>,
  tp: NonNullable<TerrainProps["teleporter"]>
): string[] {
  if (!("pairedPeerKey" in tp) || typeof tp.pairedPeerKey !== "string" || !tp.pairedPeerKey) {
    return [];
  }
  const pk = tp.pairedPeerKey;
  if (!placed.has(pk)) return [];
  const rem = obstacleRemovalKeysForPlacedKey(pk);
  placed.delete(pk);
  return rem;
}

function teleporterMoveTargetValid(
  roomId: string,
  room: Map<string, ClientConn>,
  toX: number,
  toZ: number,
  toY: number,
  vacatingKeys: ReadonlySet<string>
): boolean {
  const placed = placedMap(roomId);
  const atDest = getPlacedAtLevel(placed, toX, toZ, toY);
  if (atDest && !vacatingKeys.has(atDest.key)) return false;
  if (toY !== 0) {
    const below = getPlacedAtLevel(placed, toX, toZ, toY - 1);
    if (!below) return false;
  }
  if (!isWalkableForRoom(roomId, toX, toZ)) return false;
  if (
    normalizeRoomId(roomId) === HUB_ROOM_ID &&
    isHubSpawnSafeZone(toX, toZ)
  ) {
    return false;
  }
  for (const c of room.values()) {
    const st = snapToTile(c.player.x, c.player.z);
    if (st.x === toX && st.z === toZ) return false;
  }
  return true;
}

/** Move a linked same-room teleporter pair by the same floor delta; rejects if either end cannot move. */
function moveLinkedTeleporterPairAt(
  conn: ClientConn,
  roomId: string,
  room: Map<string, ClientConn>,
  fromX: number,
  fromZ: number,
  fromY: number,
  toX: number,
  toZ: number,
  toY: number,
  fk: string,
  fromClientKey: string,
  props: PlacedProps
): boolean {
  const tp = props.teleporter;
  if (
    !tp ||
    !("pairedPeerKey" in tp) ||
    typeof tp.pairedPeerKey !== "string" ||
    !tp.pairedPeerKey
  ) {
    return false;
  }
  const placed = placedMap(roomId);
  const peerKey = tp.pairedPeerKey;
  const peerProps = placed.get(peerKey);
  if (!peerProps?.teleporter) return false;

  const peerCoords = parsePlacedKey(peerKey);
  if (!peerCoords) return false;

  const dx = toX - fromX;
  const dz = toZ - fromZ;
  const peerToX = peerCoords.x + dx;
  const peerToZ = peerCoords.z + dz;
  const peerTy = peerCoords.y;

  const destKey = blockKey(toX, toZ, toY);
  const peerDestKey = blockKey(peerToX, peerToZ, peerTy);
  if (destKey === peerKey && peerDestKey === fk) {
    return false;
  }

  const ignoreKeys = new Set([fk, fromClientKey, peerKey]);
  if (
    !teleporterMoveTargetValid(roomId, room, toX, toZ, toY, ignoreKeys) ||
    !teleporterMoveTargetValid(
      roomId,
      room,
      peerToX,
      peerToZ,
      peerTy,
      ignoreKeys
    )
  ) {
    return false;
  }

  placed.delete(fk);
  if (fromClientKey !== fk) placed.delete(fromClientKey);
  placed.delete(peerKey);

  placed.set(destKey, {
    ...TELEPORTER_VISUAL,
    teleporter: {
      targetRoomId: normalizeRoomId(roomId),
      targetX: peerToX,
      targetZ: peerToZ,
      targetRoomDisplayName: roomCatalogDisplayNameForTeleporter(roomId),
      pairedPeerKey: peerDestKey,
    },
  });
  placed.set(peerDestKey, {
    ...TELEPORTER_VISUAL,
    teleporter: {
      targetRoomId: normalizeRoomId(roomId),
      targetX: toX,
      targetZ: toZ,
      targetRoomDisplayName: roomCatalogDisplayNameForTeleporter(roomId),
      pairedPeerKey: destKey,
    },
  });

  const add: ObstacleTile[] = [];
  const dSrc = obstacleTileFromPlaced(roomId, destKey);
  const dPeer = obstacleTileFromPlaced(roomId, peerDestKey);
  if (dSrc) add.push(dSrc);
  if (dPeer) add.push(dPeer);
  const remove = [
    ...new Set([
      ...obstacleRemovalKeysForPlacedKey(fk),
      ...(fromClientKey !== fk
        ? obstacleRemovalKeysForPlacedKey(fromClientKey)
        : []),
      ...obstacleRemovalKeysForPlacedKey(peerKey),
    ]),
  ];
  broadcast(roomId, {
    type: "obstaclesDelta",
    roomId: normalizeRoomId(roomId),
    add,
    remove,
  });
  schedulePersistWorldState();
  logGameplayEvent(conn.sessionId, conn.address, roomId, "move_obstacle", {
    fromX,
    fromZ,
    fromY,
    toX,
    toZ,
    toY,
    pairedMove: true,
    peerFromX: peerCoords.x,
    peerFromZ: peerCoords.z,
    peerToX,
    peerToZ,
  });
  return true;
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
  if (!canPlaceBlocksInRoom(srcRoomId, address)) return false;
  if (!canPlaceBlocksInRoom(destRoomId, address)) return false;
  if (
    normalizeRoomId(srcRoomId) === CANVAS_ROOM_ID ||
    normalizeRoomId(destRoomId) === CANVAS_ROOM_ID ||
    isPixelRoom(srcRoomId) ||
    isPixelRoom(destRoomId)
  ) {
    return false;
  }
  if (!hasRoom(destRoomId)) return false;

  const srcPlaced = placedMap(srcRoomId);

  const srcResolved = getPlacedAtLevel(srcPlaced, srcX, srcZ, srcY);
  if (!srcResolved?.props.teleporter) return false;
  const canonicalSrc = blockKey(srcX, srcZ, srcY);
  if (srcResolved.key !== canonicalSrc) {
    srcPlaced.delete(srcResolved.key);
  }

  const nDest = normalizeRoomId(destRoomId);
  const nSrc = normalizeRoomId(srcRoomId);

  const oldTp = srcResolved.props.teleporter;
  if (
    oldTp &&
    !("pending" in oldTp && oldTp.pending) &&
    "pairedPeerKey" in oldTp &&
    oldTp.pairedPeerKey
  ) {
    const peerRem = deleteTeleporterPeerIfLinked(srcPlaced, oldTp);
    if (peerRem.length > 0) {
      broadcast(nSrc, {
        type: "obstaclesDelta",
        roomId: nSrc,
        add: [],
        remove: peerRem,
      });
    }
  }

  let warpX = destX;
  let warpZ = destZ;
  if (nDest === HUB_ROOM_ID) {
    warpX = 0;
    warpZ = 0;
  }

  /* Hub destination is always (0,0); landing hint must be in bounds and walkable. */
  if (nDest !== HUB_ROOM_ID) {
    if (
      !isValidTeleporterLandingHint(
        destRoomId,
        warpX,
        warpZ,
        teleporterLandingContext()
      )
    ) {
      return false;
    }
  }

  if (normalizeRoomId(srcRoomId) === HUB_ROOM_ID && isHubSpawnSafeZone(srcX, srcZ)) return false;

  if (nSrc === nDest && srcX === warpX && srcZ === warpZ) {
    return false;
  }

  for (const [rid, r] of rooms) {
    for (const c of r.values()) {
      if (c.address === address) continue;
      const st = snapToTile(c.player.x, c.player.z);
      if (normalizeRoomId(rid) === normalizeRoomId(srcRoomId) && st.x === srcX && st.z === srcZ) {
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

/** Same-room bidirectional pair: place/update exit tile and link both teleporters. */
function placeBidirectionalTeleporterPairAt(
  conn: ClientConn,
  roomId: string,
  srcX: number,
  srcZ: number,
  srcY: number,
  destX: number,
  destZ: number
): boolean {
  const address = conn.address;
  if (!canPlaceBlocksInRoom(roomId, address)) return false;
  if (normalizeRoomId(roomId) === CANVAS_ROOM_ID) return false;
  if (!hasRoom(roomId)) return false;

  const placed = placedMap(roomId);
  const extra = extraFloorMap(roomId);
  const br = baseRemovedReadonly(roomId);
  const nRoom = normalizeRoomId(roomId);

  const srcResolved = getPlacedAtLevel(placed, srcX, srcZ, srcY);
  if (!srcResolved?.props.teleporter) return false;
  const canonicalSrc = blockKey(srcX, srcZ, srcY);
  if (srcResolved.key !== canonicalSrc) {
    placed.delete(srcResolved.key);
  }

  const oldTp = srcResolved.props.teleporter;
  if (
    oldTp &&
    !("pending" in oldTp && oldTp.pending) &&
    "pairedPeerKey" in oldTp &&
    oldTp.pairedPeerKey
  ) {
    const peerRem = deleteTeleporterPeerIfLinked(placed, oldTp);
    if (peerRem.length > 0) {
      broadcast(nRoom, {
        type: "obstaclesDelta",
        roomId: nRoom,
        add: [],
        remove: peerRem,
      });
    }
  }

  const st = snapToTile(srcX, srcZ);
  const dt = snapToTile(destX, destZ);
  const destY = nextOpenStackLevel(placed, dt.x, dt.z);
  if (destY === null) return false;
  if (
    destY === 0 &&
    !canPlaceTeleporterFoot(roomId, dt.x, dt.z, placed, extra, br)
  ) {
    return false;
  }
  if (destY > 0 && !getPlacedAtLevel(placed, dt.x, dt.z, destY - 1)) return false;
  if (normalizeRoomId(roomId) === HUB_ROOM_ID && isHubSpawnSafeZone(dt.x, dt.z)) return false;
  if (normalizeRoomId(roomId) === HUB_ROOM_ID && isHubSpawnSafeZone(st.x, st.z)) return false;

  const destKey = blockKey(dt.x, dt.z, destY);
  if (destKey === canonicalSrc) return false;

  if (getSignboardAt(roomId, dt.x, dt.z)) return false;
  if (getSignboardAt(roomId, st.x, st.z)) return false;

  for (const [rid, r] of rooms) {
    for (const c of r.values()) {
      if (c.address === address) continue;
      const snap = snapToTile(c.player.x, c.player.z);
      if (normalizeRoomId(rid) === nRoom && snap.x === st.x && snap.z === st.z) {
        return false;
      }
      if (normalizeRoomId(rid) === nRoom && snap.x === dt.x && snap.z === dt.z) {
        return false;
      }
    }
  }

  placed.set(destKey, {
    ...TELEPORTER_VISUAL,
    teleporter: {
      targetRoomId: nRoom,
      targetX: st.x,
      targetZ: st.z,
      targetRoomDisplayName: roomCatalogDisplayNameForTeleporter(nRoom),
      pairedPeerKey: canonicalSrc,
    },
  });

  placed.set(canonicalSrc, {
    ...TELEPORTER_VISUAL,
    teleporter: {
      targetRoomId: nRoom,
      targetX: dt.x,
      targetZ: dt.z,
      targetRoomDisplayName: roomCatalogDisplayNameForTeleporter(nRoom),
      pairedPeerKey: destKey,
    },
  });

  const dSrc = obstacleTileFromPlaced(nRoom, canonicalSrc);
  const dDest = obstacleTileFromPlaced(nRoom, destKey);
  const add: ObstacleTile[] = [];
  if (dSrc) add.push(dSrc);
  if (dDest) add.push(dDest);
  if (add.length > 0) {
    broadcast(nRoom, {
      type: "obstaclesDelta",
      roomId: nRoom,
      add,
      remove: [],
    });
  }
  schedulePersistWorldState();
  logGameplayEvent(conn.sessionId, address, nRoom, "place_teleporter_pair", {
    srcX: st.x,
    srcZ: st.z,
    srcY,
    destX: dt.x,
    destZ: dt.z,
    destY,
  });
  return true;
}

/**
 * True if some human occupies `(tx,tz)` in `roomId`, excluding `ignoreCompact` (empty = exclude nobody).
 * Used so the editor can stand on the exit or front tile while rotating a gate.
 */
function roomTileOccupiedByPlayerOtherThan(
  roomId: string,
  tx: number,
  tz: number,
  ignoreCompact: string | null
): boolean {
  for (const [rid, r] of rooms) {
    if (normalizeRoomId(rid) !== normalizeRoomId(roomId)) continue;
    for (const cl of r.values()) {
      const st = snapToTile(cl.player.x, cl.player.z);
      if (st.x !== tx || st.z !== tz) continue;
      if (ignoreCompact && compactAddress(cl.address) === ignoreCompact) continue;
      return true;
    }
  }
  return false;
}

/**
 * Shared rules for gate exit + front neighbors for **placement / exit edits** (not walkability).
 * Exit/front may be unwalkable by design; `openGate` still validates walking with `gateWalkBlocked` UX.
 */
function gateExitNeighborLayoutValid(
  roomId: string,
  gx: number,
  gz: number,
  ex: number,
  ez: number,
  /** Placer / editor may stand on exit or front while aiming the opening; they do not block those tiles. */
  neighborsIgnoreOccupantCompact: string | null
): boolean {
  if (!inTileBounds(ex, ez)) return false;
  if (Math.abs(ex - gx) + Math.abs(ez - gz) !== 1) return false;
  const frontX = gx * 2 - ex;
  const frontZ = gz * 2 - ez;
  if (Math.abs(frontX - gx) + Math.abs(frontZ - gz) !== 1) return false;
  if (!inTileBounds(frontX, frontZ)) return false;
  if (normalizeRoomId(roomId) === HUB_ROOM_ID && isHubSpawnSafeZone(gx, gz)) return false;
  if (normalizeRoomId(roomId) === HUB_ROOM_ID && isHubSpawnSafeZone(ex, ez)) return false;
  if (normalizeRoomId(roomId) === HUB_ROOM_ID && isHubSpawnSafeZone(frontX, frontZ))
    return false;
  if (getSignboardAt(roomId, gx, gz)) return false;
  if (roomTileOccupiedByPlayerOtherThan(roomId, gx, gz, null)) return false;
  if (roomTileOccupiedByPlayerOtherThan(roomId, ex, ez, neighborsIgnoreOccupantCompact))
    return false;
  if (
    roomTileOccupiedByPlayerOtherThan(
      roomId,
      frontX,
      frontZ,
      neighborsIgnoreOccupantCompact
    )
  ) {
    return false;
  }
  return true;
}

function placePendingGateAt(
  conn: ClientConn,
  roomId: string,
  x: number,
  z: number,
  exitDir: number,
  _faceDir: number,
  colorRgb: number
): boolean {
  const address = conn.address;
  if (isInviteLobbyRoomId(normalizeRoomId(roomId))) return false;
  if (!canPlaceBlocksInRoom(roomId, address)) return false;
  if (normalizeRoomId(roomId) === CANVAS_ROOM_ID) return false;
  if (!hasRoom(roomId)) return false;

  const placed = placedMap(roomId);
  const extra = extraFloorMap(roomId);
  const br = baseRemovedReadonly(roomId);

  const yLevel = nextOpenStackLevel(placed, x, z);
  if (yLevel !== 0) return false;

  if (!canPlaceTeleporterFoot(roomId, x, z, placed, extra, br)) return false;

  const dirIdx = Math.max(0, Math.min(3, Math.floor(exitDir)));
  /** Swing variant removed from UX; hinge direction is derived from exit side on the client. */
  const faceIdx = 0;
  const [dx, dz] = CARDINAL_DIRS[dirIdx]!;
  const ex = x + dx;
  const ez = z + dz;
  if (
    !gateExitNeighborLayoutValid(
      roomId,
      x,
      z,
      ex,
      ez,
      compactAddress(address)
    )
  ) {
    return false;
  }

  const k = blockKey(x, z, 0);
  const who = compactAddress(address);
  placed.set(k, {
    passable: false,
    half: false,
    quarter: false,
    hex: false,
    pyramid: false,
    pyramidBaseScale: 1,
    hexRadiusScale: 1,
    sphere: false,
    sphereRadiusScale: 1,
    ramp: false,
    rampDir: faceIdx,
    colorRgb: clampColorRgb(colorRgb),
    locked: false,
    gate: {
      adminAddress: who,
      authorizedAddresses: [who],
      exitX: ex,
      exitZ: ez,
    },
  });
  const nRoom = normalizeRoomId(roomId);
  const dTile = obstacleTileFromPlaced(nRoom, k);
  if (dTile) {
    broadcast(nRoom, {
      type: "obstaclesDelta",
      roomId: nRoom,
      add: [dTile],
      remove: [],
    });
  }
  schedulePersistWorldState();
  logGameplayEvent(conn.sessionId, address, nRoom, "place_gate", {
    x,
    z,
    exitX: ex,
    exitZ: ez,
    exitDir: dirIdx,
    faceDir: faceIdx,
    colorRgb: clampColorRgb(colorRgb),
  });
  return true;
}

function tickExpiredGatesForRoom(roomId: string, now: number): boolean {
  const placed = roomPlaced.get(roomId);
  if (!placed) return false;
  const addTiles: ObstacleTile[] = [];
  for (const [k, v] of placed) {
    if (!v.gateOpen || now < v.gateOpen.untilMs) continue;
    const { gateOpen: _go, ...rest } = v;
    placed.set(k, rest as PlacedProps);
    const d = obstacleTileFromPlaced(roomId, k);
    if (d) addTiles.push(d);
  }
  if (addTiles.length === 0) return false;
  broadcast(roomId, {
    type: "obstaclesDelta",
    roomId,
    add: addTiles,
    remove: [],
  });
  schedulePersistWorldState();
  return true;
}

/** Set `gateOpen`, broadcast obstacle delta, persist - shared by successful opens and blocked swing UX. */
function applyGateOpenForTile(
  roomId: string,
  tileKey: string,
  base: PlacedProps,
  openerCompact: string,
  now: number
): void {
  const placed = placedMap(roomId);
  placed.set(tileKey, {
    ...base,
    gateOpen: {
      openedBy: openerCompact,
      untilMs: now + GATE_OPEN_PASS_MS,
    },
  });
  const dTile = obstacleTileFromPlaced(roomId, tileKey);
  if (dTile) {
    broadcast(roomId, {
      type: "obstaclesDelta",
      roomId,
      add: [dTile],
      remove: [],
    });
  }
  schedulePersistWorldState();
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
    enqueuePayIntent({
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
      const message = `Time's up! ${winner.displayName} won by finishing first! Returning to the Commons...`;
      
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
      const message = `Time's up! ${playerName} explored the most with ${maxSteps} steps! Returning to the Commons...`;
      
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
        text: "Time's up! Returning to the Commons...",
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
  if (
    isCosmeticGalleryRoom(nTarget) &&
    currentRoomId !== null &&
    !isCosmeticGalleryRoom(normalizeRoomId(currentRoomId))
  ) {
    rememberShaperReturnOrigin(address, currentRoomId, conn.player.x, conn.player.z);
  }
  if (isInviteLobbyRoomId(nTarget)) {
    ensurePlaySpaceLayout(nTarget);
  }
  const enteringCanvas =
    nTarget === CANVAS_ROOM_ID &&
    (currentRoomId === null ||
      normalizeRoomId(currentRoomId) !== CANVAS_ROOM_ID);
  if (enteringCanvas && mazePortalBlockedSeconds() !== null) {
    sendMazePortalBlockedBubble(conn);
    return;
  }

  if (nTarget === PIXEL_ROOM_ID) {
    const t = snapToTile(PIXEL_DEFAULT_SPAWN.x, PIXEL_DEFAULT_SPAWN.z);
    x = t.x;
    z = t.z;
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
    if (isInviteLobbyRoomId(nTarget)) {
      directInviteOnLobbyConnect(conn, nTarget, address);
    }
    return;
  }

  if (currentRoomId !== null) {
    const room = rooms.get(currentRoomId);
    if (room) {
      room.delete(address);
      broadcast(currentRoomId, { type: "playerLeft", address }, address);
    }
  }

  // worldcup: a Challenge is room-scoped (accepted in the same room it was raised in), so a
  // real room change clears it - otherwise the flag follows the player and shows a stale
  // "Accept 1v1" option in a room (e.g. a field) where no Challenge actually exists.
  if (conn.challengeOpen) {
    conn.challengeOpen = false;
    conn.challengeRaisedAtMs = 0;
  }

  conn.player.x = x;
  conn.player.z = z;
  conn.player.y = 0;
  conn.pathQueue = [];
  initClientViewInterest(conn, x, z);

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
  const allowPlaceBlocks = canPlaceBlocksInRoom(targetRoomId, address);
  const allowFloorRecolor = canRecolorFloorInRoom(targetRoomId, address);
  const nWelcomeRoom = normalizeRoomId(targetRoomId);
  const welcomeBgState = isInviteLobbyRoomId(nWelcomeRoom)
    ? playSpaceBackgroundState(nWelcomeRoom)
    : isPlayerCreatedRoom(nWelcomeRoom)
    ? getDynamicRoomBackgroundState(nWelcomeRoom)
    : getBuiltinRoomBackgroundState(nWelcomeRoom);
  const allowRoomBackgroundHueEdit = isPlayerCreatedRoom(nWelcomeRoom)
    ? allowActorRoomBackgroundHueEdit(
        nWelcomeRoom,
        compactAddress(conn.address),
        isAdmin(conn.address)
      )
    : false;

  const allowPublishDesign = canPublishDesign(targetRoomId, address);
  const teleportSpatialWelcome = roomUsesSpatialInterest(rb)
    ? welcomeSpatialLists(targetRoomId, conn)
    : null;
  const chatBacklog = chatBacklogSnapshotForWelcome(targetRoomId, Date.now());

  wsSafeSend(conn.ws, {
      type: "welcome",
      self: playerToOutState(conn),
      others,
      roomId: targetRoomId,
      roomBounds: rb,
      doors,
      placeRadiusBlocks: PLACE_RADIUS_BLOCKS,
      obstacles: teleportSpatialWelcome
        ? teleportSpatialWelcome.obstacles
        : obstaclesToList(targetRoomId),
      extraFloorTiles: teleportSpatialWelcome
        ? teleportSpatialWelcome.extraFloorTiles
        : extraFloorToList(targetRoomId),
      baseFloorColorTiles: teleportSpatialWelcome
        ? teleportSpatialWelcome.baseFloorColorTiles
        : baseFloorColorToList(targetRoomId),
      removedBaseFloorTiles: teleportSpatialWelcome
        ? teleportSpatialWelcome.removedBaseFloorTiles
        : removedBaseFloorToList(targetRoomId),
      canvasClaims: isCanvas ? getClaimsInBounds(rb.minX, rb.maxX, rb.minZ, rb.maxZ) : undefined,
      signboards,
      billboards: billboardsWire,
      voxelTexts: getVoxelTextsForRoom(targetRoomId),
      onlinePlayerCount: countOnlineRealPlayers(),
      allowPlaceBlocks,
      allowPublishDesign,
      allowExtraFloor: allowFloorRecolor,
      allowRoomBackgroundHueEdit,
      roomBackgroundHueDeg: welcomeBgState.hueDeg,
      roomBackgroundNeutral: welcomeBgState.neutral,
      ...joinSpawnWelcomeExtras(targetRoomId, address),
      ...( (): { blockClaimDeniedReason?: string } => {
        const r = blockClaimAccessDeniedReason(address);
        return r ? { blockClaimDeniedReason: r } : {};
      })(),
      chatBacklog,
      // worldcup: include any balls in this room
      balls:
        WORLDCUP_ENABLED && worldcupRoomHasBalls(targetRoomId)
          ? worldcupBallsToWire(targetRoomId)
          : undefined,
      ...worldcupWelcomeExtras(targetRoomId, address),
      worldcupPortals: WORLDCUP_ENABLED
        ? worldcupPortalsForRoom(targetRoomId)
        : undefined,
      ...cosmeticGalleryWelcomeExtras(targetRoomId),
    } satisfies OutMsg);
  logChatBacklogDelivered(conn.sessionId, address, targetRoomId, chatBacklog);
  sendRoomCatalog(conn.ws, address);
  onPlayerEnteredRoom(conn, targetRoomId, {
    isRoomChange: true,
    spawnHint: { x, z },
    doorSpawn: true,
  });

  // Notify others in new room
  broadcast(targetRoomId, { type: "playerJoined", player: playerToOutState(conn) }, address);

  if (isInviteLobbyRoomId(nTarget)) {
    directInviteOnLobbyConnect(conn, nTarget, address);
  }
}

// worldcup: who may drop a kickable ball in a room (builders; never the pitch/canvas/pixel).
function canPlaceBallInRoom(roomId: string, address: string): boolean {
  const id = normalizeRoomId(roomId);
  if (isCosmeticGalleryRoom(id)) return false;
  if (isInviteLobbyRoomId(id)) return false;
  if (worldcupIsFieldLikeRoom(roomId)) return false; // pitch has its own ball
  if (id === CANVAS_ROOM_ID || id === PIXEL_ROOM_ID) return false;
  return canEditRoomContent(roomId, address);
}

// worldcup: welcome extras for the field room (self country + scoreboard snapshot).
function worldcupWelcomeExtras(
  roomId: string,
  address: string
): {
  worldcupSelfCountry?: string | null;
  worldcupTopCountries?: Array<{ code: string; goals: number }>;
  worldcupPrevWinnerCountry?: string | null;
} {
  // The self country backs the profile flag + Flag Emote in every room, so it is always
  // sent. The seasonal scoreboard extras stay gated to the field room while in-season.
  const selfCountry = worldcupGetPlayerCountry(address);
  if (!WORLDCUP_ENABLED || normalizeRoomId(roomId) !== WORLDCUP_FIELD_ROOM_ID) {
    return { worldcupSelfCountry: selfCountry };
  }
  return {
    worldcupSelfCountry: selfCountry,
    worldcupTopCountries: worldcupGetTopCountries(8),
    worldcupPrevWinnerCountry: worldcupGetPreviousDayWinner()?.country ?? null,
  };
}

/**
 * worldcup: live Goalie state per room, one keeper per goal. Created lazily and stepped each
 * tick from the room's primary ball z. The field room is persistent so no teardown is needed.
 */
const worldcupGoalies = new Map<
  string,
  Map<WorldcupGoalZone["id"], WorldcupGoalieState>
>();
/** Throttle Goalie position broadcasts (slow movers - no need for every 50ms tick). */
const worldcupGoalieBroadcastAt = new Map<string, number>();
const WORLDCUP_GOALIE_BROADCAST_MIN_MS = 100;

/** worldcup: lightweight Goalie position for the client (alongside the ball-state stream). */
type WorldcupGoalieWire = { id: WorldcupGoalZone["id"]; x: number; z: number };

function worldcupGoalieMapForRoom(
  roomId: string
): Map<WorldcupGoalZone["id"], WorldcupGoalieState> {
  const id = normalizeRoomId(roomId);
  let m = worldcupGoalies.get(id);
  if (!m) {
    m = new Map();
    worldcupGoalies.set(id, m);
  }
  return m;
}

/**
 * Step each goal's keeper toward the room's primary ball and return their wire positions
 * plus (mode-dependent) the kicker pseudo-players / blocker colliders to feed the ball tick.
 */
function worldcupStepGoaliesForRoom(
  roomId: string,
  goals: readonly WorldcupGoalZone[]
): {
  wire: WorldcupGoalieWire[];
  kickers: Array<{
    x: number;
    z: number;
    vx: number;
    vz: number;
    address: string;
    kickReach: number;
  }>;
  colliders: Array<{ x: number; z: number; radius: number }>;
} {
  const balls = worldcupGetBalls(roomId);
  const primary = balls.find((b) => b.id === "field") ?? balls[0];
  const ballZ = primary ? primary.z : 0;
  const states = worldcupGoalieMapForRoom(roomId);
  const dtSec = TICK_MS / 1000;
  const wire: WorldcupGoalieWire[] = [];
  const kickers: Array<{
    x: number;
    z: number;
    vx: number;
    vz: number;
    address: string;
    kickReach: number;
  }> = [];
  const colliders: Array<{ x: number; z: number; radius: number }> = [];

  for (const goal of goals) {
    const prev = states.get(goal.id) ?? worldcupInitGoalieState(goal);
    const next = worldcupStepGoalie(prev, ballZ, TICK_MS, goal, WORLDCUP_GOALIE);
    states.set(goal.id, next);
    const lineX = worldcupGoalieLineX(goal);
    if (WORLDCUP_GOALIE_MODE === "kicker") {
      kickers.push({
        x: lineX,
        z: next.z,
        vx: 0,
        vz: dtSec > 0 ? (next.z - prev.z) / dtSec : 0,
        address: WORLDCUP_GOALIE_SENTINEL,
        kickReach: WORLDCUP_GOALIE.kickReach,
      });
    } else {
      colliders.push(worldcupGoalieCollider(goal, next, WORLDCUP_GOALIE.radius));
    }
    wire.push({ id: goal.id, x: lineX, z: Math.round(next.z * 1000) / 1000 });
  }
  return { wire, kickers, colliders };
}

/** Distinct real (non-observer) players currently in a room - Solo vs Contested rate input. */
function worldcupDistinctPlayersInRoom(roomId: string): number {
  const seen = new Set<string>();
  for (const c of roomOf(roomId).values()) {
    if (c.streamObserver) continue;
    seen.add(compactAddress(c.address));
  }
  return seen.size;
}

/**
 * worldcup: a Free Play Field goal queues a small NIM payout to the credited scorer,
 * wrapped in env-tunable guards (see worldcup/adr/0002). Matches never call this. Goals
 * that fail a guard still count for the leaderboard - only the payout stops.
 */
function maybeQueueGoalReward(
  roomId: string,
  goalId: string,
  scorerAddress: string | null
): GoalRewardDecision | null {
  if (normalizeRoomId(roomId) !== WORLDCUP_FIELD_ROOM_ID) return null;
  const decision = worldcupDecideGoalReward(
    {
      scorerWallet: scorerAddress,
      distinctPlayersInField: worldcupDistinctPlayersInRoom(roomId),
    },
    {
      minRewardLuna: WORLDCUP_GOAL_REWARD.minRewardLuna,
      maxRewardLuna: WORLDCUP_GOAL_REWARD.maxRewardLuna,
      dailyCapPerWallet: WORLDCUP_GOAL_REWARD.dailyCapPerWallet,
      dailyBudgetLuna: WORLDCUP_GOAL_REWARD.dailyBudgetLuna,
      minPlayers: WORLDCUP_GOAL_REWARD.minPlayers,
    }
  );
  if (
    !decision.pay ||
    !decision.claimId ||
    !decision.recipientWallet ||
    decision.amountLuna === undefined
  ) {
    return decision;
  }
  // Use the normalized recipient the decision built the claimId from, so the payout target
  // and the idempotency key can never disagree.
  enqueuePayIntent({
    claimId: decision.claimId,
    recipientAddress: decision.recipientWallet,
    amountLuna: decision.amountLuna,
    roomId,
    tileKey: `wc-goal-${goalId}`,
    txMessage: "Scored a goal on Nimiq Space!",
  });
  return decision;
}

/** Format a luna reward as a compact NIM string (e.g. 25000 → "0.25", 100000 → "1"). */
function formatGoalRewardNim(luna: bigint): string {
  const nim = Number(luna) / Number(LUNA_PER_NIM);
  return nim.toFixed(2).replace(/\.?0+$/, "");
}

/**
 * worldcup: tell the scorer (and only the scorer) how their Free Play goal was rewarded -
 * either the NIM they earned, or that they've hit their personal daily cap / the pool is
 * spent. Other reasons (no credited kicker) stay silent.
 */
function sendGoalRewardOutcomeToScorer(
  roomId: string,
  scorerAddress: string,
  decision: GoalRewardDecision
): void {
  let payload: Extract<OutMsg, { type: "goalRewardOutcome" }> | null = null;
  if (decision.pay && decision.amountLuna !== undefined) {
    payload = {
      type: "goalRewardOutcome",
      roomId,
      reason: "ok",
      amountNim: formatGoalRewardNim(decision.amountLuna),
    };
    recordFieldGoalPayout(
      scorerAddress,
      achievementUnlockHandlerForAddress(scorerAddress)
    );
  } else if (decision.reason === "wallet_cap") {
    payload = { type: "goalRewardOutcome", roomId, reason: "wallet_cap" };
  } else if (decision.reason === "budget_exhausted") {
    payload = { type: "goalRewardOutcome", roomId, reason: "budget_exhausted" };
  }
  if (!payload) return;
  const want = compactAddress(scorerAddress);
  for (const c of roomOf(roomId).values()) {
    if (compactAddress(c.address) === want) {
      wsSafeSend(c.ws, payload);
    }
  }
}

// worldcup: credit a goal to the last kicker's country + broadcast the celebration.
function handleWorldcupGoal(
  roomId: string,
  goalId: string,
  scorerAddress: string | null
): void {
  let country: string | null = null;
  let scorerName: string | null = null;
  const topBeforeGoal =
    scorerAddress && normalizeRoomId(roomId) === WORLDCUP_FIELD_ROOM_ID
      ? worldcupGetTopCountries(8)
      : [];
  if (scorerAddress) {
    const compact = compactAddress(scorerAddress);
    scorerName = getEffectivePlayerDisplayName(compact);
    const res = worldcupRecordGoal(scorerAddress, scorerName ?? undefined);
    country = res.country;
  }
  // Free Play Field only: queue the NIM reward (guards enforced inside).
  const rewardDecision = maybeQueueGoalReward(roomId, goalId, scorerAddress);
  broadcast(roomId, {
    type: "goalScored",
    roomId,
    goalId,
    scorerAddress: scorerAddress ?? null,
    scorerName,
    country,
    topCountries: worldcupGetTopCountries(8),
  });
  // Personal reward feedback to the scorer only (earned NIM / cap reached).
  if (scorerAddress && rewardDecision) {
    sendGoalRewardOutcomeToScorer(roomId, scorerAddress, rewardDecision);
  }
  if (
    scorerAddress &&
    normalizeRoomId(roomId) === WORLDCUP_FIELD_ROOM_ID
  ) {
    const distinct = worldcupDistinctPlayersInRoom(roomId);
    const contested = distinct >= WORLDCUP_GOAL_REWARD.minPlayers;
    recordFieldGoalScored(
      scorerAddress,
      {
        contested,
        solo: distinct === 1,
        rushHour: contested && isRushHourFieldGoal(distinct),
        underdog: isUnderdogCountryAtGoalTime(country, topBeforeGoal),
      },
      achievementUnlockHandlerForAddress(scorerAddress)
    );
  }
}

// ---------------------------------------------------------------------------
// worldcup: 1v1 Matches (ephemeral Match Pitches; see worldcup/adr/0001)
// ---------------------------------------------------------------------------

/** worldcup: a 1v1 spectate portal in a room - "{identicon} vs {identicon}", click to watch. */
interface WorldcupPortalWire {
  /** Spectate key = the pitch room id to drop into. */
  matchId: string;
  x: number;
  z: number;
  aAddress: string;
  bAddress: string;
  aCountry: string | null;
  bCountry: string | null;
  /** True once the Spectator soft-cap is reached (portal shows "full"). */
  full: boolean;
}

interface WorldcupMatchRuntime {
  id: string;
  /** Normalized pitch room id (`wc-match-<id>`). */
  pitchRoomId: string;
  /** Compact wallet of side a (challenger) and side b (accepter). */
  a: string;
  b: string;
  state: WorldcupMatchState;
  /** Where each entrant came from, to return them when the Match ends. */
  origins: Map<string, { roomId: string; x: number; z: number; y: number }>;
  /** Room the Match was started from (where its spectate portal lives). */
  originRoomId: string;
  /** Spectate portal position in the origin room (a walkable tile near the challenger). */
  portalX: number;
  portalZ: number;
  lastTickMs: number;
  /** Set once the Match reaches `ended`; entrants are returned after the result linger. */
  endedAtMs: number | null;
  /** Throttle live `matchState` broadcasts. */
  lastBroadcastMs: number;
  /** True when the Match ended because of a goal during Golden Goal. */
  endedByGoldenGoal?: boolean;
  /** Elapsed golden-phase ms when a golden goal ended the Match. */
  goldenElapsedMsAtWin?: number;
  /** True once regulation ended tied and golden phase began. */
  enteredGoldenPhase?: boolean;
  /** Largest goal deficit faced by each side during the Match. */
  maxDeficitA?: number;
  maxDeficitB?: number;
  /** True when a side scored at least one own goal. */
  ownGoalByA?: boolean;
  ownGoalByB?: boolean;
  /**
   * While > now, the Match is in a post-goal kickoff freeze: both players are reset to their
   * spawns, movement is rejected, and the Match clock is paused. 0 = live play.
   */
  kickoffUntilMs: number;
}

/** key: normalized pitch room id */
const worldcupMatches = new Map<string, WorldcupMatchRuntime>();
const WORLDCUP_MATCH_CFG: WorldcupMatchConfig = {
  durationMs: WORLDCUP_MATCH.durationMs,
  goldenGoalCapMs: WORLDCUP_MATCH.goldenGoalCapMs,
};
const WORLDCUP_MATCH_STATE_BROADCAST_MIN_MS = 250;
let worldcupMatchSeq = 0;

/** True for the Free Play Field or any ephemeral Match Pitch (field-like physics/goals). */
function worldcupIsFieldLikeRoom(roomId: string): boolean {
  if (!WORLDCUP_ENABLED) return false;
  const id = normalizeRoomId(roomId);
  return id === WORLDCUP_FIELD_ROOM_ID || worldcupIsMatchPitch(id);
}

function broadcastWorldcupMatchState(
  m: WorldcupMatchRuntime,
  force: boolean,
  now: number
): void {
  if (!force && now - m.lastBroadcastMs < WORLDCUP_MATCH_STATE_BROADCAST_MIN_MS) {
    return;
  }
  m.lastBroadcastMs = now;
  const kickoffRemainingMs =
    m.kickoffUntilMs > now ? Math.max(0, m.kickoffUntilMs - now) : 0;
  broadcast(m.pitchRoomId, {
    type: "matchState",
    roomId: m.pitchRoomId,
    matchId: m.id,
    scoreA: m.state.scoreA,
    scoreB: m.state.scoreB,
    phase: m.state.phase,
    remainingMs: worldcupMatchTimeRemainingMs(m.state, WORLDCUP_MATCH_CFG),
    kickoffRemainingMs,
    aAddress: m.a,
    bAddress: m.b,
    aCountry: worldcupGetPlayerCountry(m.a),
    bCountry: worldcupGetPlayerCountry(m.b),
  });
}

function worldcupSideForWallet(
  m: WorldcupMatchRuntime,
  wallet: string
): WorldcupMatchSide | null {
  const compact = compactAddress(wallet);
  if (compact === m.a) return "a";
  if (compact === m.b) return "b";
  return null;
}

function worldcupOwnGoalSideForGoal(
  m: WorldcupMatchRuntime,
  scoringSide: WorldcupMatchSide,
  lastKickerAddress: string | null
): WorldcupMatchSide | null {
  if (!lastKickerAddress) return null;
  const kickerSide = worldcupSideForWallet(m, lastKickerAddress);
  if (!kickerSide || kickerSide === scoringSide) return null;
  return kickerSide;
}

function worldcupUpdateMatchTracking(
  m: WorldcupMatchRuntime,
  ownGoalSide: WorldcupMatchSide | null
): void {
  if (m.state.phase === "golden" || (m.state.goldenElapsedMs ?? 0) > 0) {
    m.enteredGoldenPhase = true;
  }
  m.maxDeficitA = Math.max(
    m.maxDeficitA ?? 0,
    Math.max(0, m.state.scoreB - m.state.scoreA)
  );
  m.maxDeficitB = Math.max(
    m.maxDeficitB ?? 0,
    Math.max(0, m.state.scoreA - m.state.scoreB)
  );
  if (ownGoalSide === "a") m.ownGoalByA = true;
  if (ownGoalSide === "b") m.ownGoalByB = true;
}

function worldcupMatchEndParticipantInput(
  m: WorldcupMatchRuntime,
  side: WorldcupMatchSide
): MatchEndParticipantInput {
  const wallet = side === "a" ? m.a : m.b;
  const goalsScored = side === "a" ? m.state.scoreA : m.state.scoreB;
  const goalsConceded = side === "a" ? m.state.scoreB : m.state.scoreA;
  const priorWinStreak = getAchievementCounterValue(wallet, "match_win_streak");
  const maxTrailingDeficit =
    side === "a" ? (m.maxDeficitA ?? 0) : (m.maxDeficitB ?? 0);
  const scoredOwnGoal =
    side === "a" ? Boolean(m.ownGoalByA) : Boolean(m.ownGoalByB);
  const outcome = m.state.outcome;
  const shared = {
    wallet,
    goalsScored,
    goalsConceded,
    maxTrailingDeficit,
    priorWinStreak,
    enteredGoldenPhase: Boolean(m.enteredGoldenPhase),
    scoredOwnGoal,
    goldenElapsedMsAtWin:
      m.endedByGoldenGoal &&
      outcome?.result === "win" &&
      outcome.winner === side
        ? m.goldenElapsedMsAtWin
        : undefined,
  };
  if (!outcome || outcome.result === "draw") {
    return {
      ...shared,
      result: "draw",
      opponentWallet: side === "a" ? m.b : m.a,
    };
  }
  if (outcome.winner === side) {
    return {
      ...shared,
      result: "win",
      winReason: outcome.reason,
      goldenGoalWin: Boolean(m.endedByGoldenGoal && outcome.reason === "score"),
      opponentWallet: side === "a" ? m.b : m.a,
    };
  }
  return {
    ...shared,
    result: "loss",
    winReason:
      outcome.reason === "opponent_left" ? "opponent_left" : undefined,
    opponentWallet: side === "a" ? m.b : m.a,
  };
}

function worldcupRecordMatchAchievements(m: WorldcupMatchRuntime): void {
  if (!WORLDCUP_ENABLED || m.state.outcome == null) return;
  recordMatchEnd(
    worldcupMatchEndParticipantInput(m, "a"),
    worldcupMatchEndParticipantInput(m, "b"),
    (wallet, unlocks) => achievementUnlockHandlerForAddress(wallet)(unlocks)
  );
}

function worldcupOnMatchEnded(m: WorldcupMatchRuntime, now: number): void {
  if (m.endedAtMs !== null) return;
  m.endedAtMs = now;
  worldcupRecordMatchAchievements(m);
  // Freeze participants on the pitch until teardown (same gate as post-goal kickoff freeze).
  m.kickoffUntilMs = now + WORLDCUP_MATCH.resultLingerMs;
  // Pull the spectate portal immediately so onlookers can't drop into a finished Match.
  worldcupRemovePortal(m);
  broadcast(m.pitchRoomId, {
    type: "matchEnded",
    roomId: m.pitchRoomId,
    matchId: m.id,
    outcome: m.state.outcome,
    scoreA: m.state.scoreA,
    scoreB: m.state.scoreB,
    aAddress: m.a,
    bAddress: m.b,
    aCountry: worldcupGetPlayerCountry(m.a),
    bCountry: worldcupGetPlayerCountry(m.b),
    resultLingerMs: WORLDCUP_MATCH.resultLingerMs,
  });
}

// ---------------------------------------------------------------------------
// worldcup: Spectating - a "{identicon} vs {identicon}" portal in the origin room that
// onlookers click to drop into the stands and watch (PRD spectating; issue 80).
// ---------------------------------------------------------------------------

/** Count the Spectators currently in a Match's stands. */
function worldcupSpectatorCount(m: WorldcupMatchRuntime): number {
  let n = 0;
  for (const c of roomOf(m.pitchRoomId).values()) {
    if (c.spectatingMatchId === m.pitchRoomId) n += 1;
  }
  return n;
}

/** Wire form of a Match's spectate portal (full state computed live). */
function worldcupPortalWire(m: WorldcupMatchRuntime): WorldcupPortalWire {
  return {
    matchId: m.pitchRoomId,
    x: m.portalX,
    z: m.portalZ,
    aAddress: m.a,
    bAddress: m.b,
    aCountry: worldcupGetPlayerCountry(m.a),
    bCountry: worldcupGetPlayerCountry(m.b),
    full: worldcupSpectatorCount(m) >= WORLDCUP_MATCH.spectatorCap,
  };
}

/** All live spectate portals anchored in `roomId` (for the welcome payload). */
function worldcupPortalsForRoom(roomId: string): WorldcupPortalWire[] {
  if (!WORLDCUP_ENABLED) return [];
  const norm = normalizeRoomId(roomId);
  const out: WorldcupPortalWire[] = [];
  for (const m of worldcupMatches.values()) {
    if (m.state.phase === "ended") continue;
    if (normalizeRoomId(m.originRoomId) === norm) out.push(worldcupPortalWire(m));
  }
  return out;
}

/** (Re)broadcast a Match's spectate portal to its origin room (spawn / full-state refresh). */
function worldcupBroadcastPortal(m: WorldcupMatchRuntime): void {
  if (m.endedAtMs !== null) return;
  broadcast(m.originRoomId, {
    type: "matchPortalSpawn",
    roomId: m.originRoomId,
    ...worldcupPortalWire(m),
  });
}

/** Remove a Match's spectate portal from its origin room. */
function worldcupRemovePortal(m: WorldcupMatchRuntime): void {
  broadcast(m.originRoomId, {
    type: "matchPortalRemove",
    roomId: m.originRoomId,
    matchId: m.pitchRoomId,
  });
}

/**
 * A fixed stand seat (world units, outside the pitch) for the `index`-th Spectator. Seats
 * alternate between the north and south stands and spread along the touchline.
 */
function worldcupSpectatorSeat(index: number): { x: number; z: number } {
  const b = WORLDCUP_FIELD_BOUNDS;
  const perSide = Math.max(1, Math.ceil(WORLDCUP_MATCH.spectatorCap / 2));
  const south = index % 2 === 0;
  const i = Math.floor(index / 2);
  const z = south ? b.maxZ + 2 : b.minZ - 2;
  const span = b.maxX - b.minX;
  const x = b.minX + ((i + 0.5) / perSide) * span;
  return { x, z };
}

/** A goal in a Match Pitch: which net was scored decides the side (own goals count). */
function worldcupHandleMatchGoal(
  pitchRoomId: string,
  goalId: string,
  lastKickerAddress: string | null = null
): void {
  const m = worldcupMatches.get(normalizeRoomId(pitchRoomId));
  if (!m || m.state.phase === "ended") return;
  // Ignore goals during the post-goal kickoff freeze (players are frozen, ball just reset).
  if (m.kickoffUntilMs > Date.now()) return;
  if (goalId !== "west" && goalId !== "east") return;
  const wasGolden = m.state.phase === "golden";
  const side = worldcupScoringSideForGoal(goalId);
  const ownGoalSide = worldcupOwnGoalSideForGoal(m, side, lastKickerAddress);
  m.state = worldcupReduceMatch(m.state, { type: "goal", side }, WORLDCUP_MATCH_CFG);
  worldcupUpdateMatchTracking(m, ownGoalSide);
  const now = Date.now();
  broadcastWorldcupMatchState(m, true, now);
  const matchEnded = m.state.phase === "ended";
  if (matchEnded && wasGolden && m.state.outcome?.result === "win") {
    m.endedByGoldenGoal = true;
    m.goldenElapsedMsAtWin = m.state.goldenElapsedMs;
  }
  // If this goal didn't end the Match, reset both players to their kickoff spots and freeze
  // them for a short countdown before play resumes.
  const kickoffMs = matchEnded ? 0 : WORLDCUP_MATCH.goalResetMs;
  if (!matchEnded && kickoffMs > 0) worldcupKickoffReset(m, now);
  // Announce the goal so the client can flash "GOAL!" + erupt the crowd (+ run the countdown).
  broadcast(m.pitchRoomId, {
    type: "matchGoal",
    roomId: m.pitchRoomId,
    matchId: m.id,
    side,
    scoreA: m.state.scoreA,
    scoreB: m.state.scoreB,
    country: worldcupGetPlayerCountry(side === "a" ? m.a : m.b),
    kickoffMs,
  });
  if (matchEnded) worldcupOnMatchEnded(m, now);
}

/**
 * Post-goal kickoff reset: snap both participants back to their kickoff spawns, re-centre the
 * ball + keepers, and freeze movement for `MATCH.goalResetMs` while the client runs a countdown.
 */
function worldcupKickoffReset(m: WorldcupMatchRuntime, now: number): void {
  m.kickoffUntilMs = now + WORLDCUP_MATCH.goalResetMs;
  for (const conn of roomOf(m.pitchRoomId).values()) {
    if (conn.matchId !== m.pitchRoomId || conn.spectatingMatchId) continue;
    const compact = compactAddress(conn.address);
    const side: WorldcupMatchSide = compact === m.a ? "a" : "b";
    const spawn = worldcupMatchSpawn(side);
    conn.player.x = spawn.x;
    conn.player.z = spawn.z;
    conn.player.y = 0;
    conn.player.vx = 0;
    conn.player.vz = 0;
    conn.pathQueue = [];
  }
  // Fresh centre ball + recentred keepers for the restart.
  worldcupSpawnMatchBall(m.pitchRoomId);
  worldcupGoalies.delete(m.pitchRoomId);
  broadcastRoomStateFull(m.pitchRoomId);
}

// worldcup: pre-teleport handshake countdown. A Match starts a few seconds after a Challenge
// is accepted so both players see a 🤝 handshake and a "Match starting in 3…2…1" overlay in
// the origin room before the pitch loads. A disconnect/leave during the countdown aborts it.
interface WorldcupPendingMatch {
  id: string;
  /** Compact wallets of the challenger (side a) and accepter (side b). */
  a: string;
  b: string;
  /** Room where both players wait during the pre-teleport countdown. */
  originRoomId: string;
  /** Social room for the spectate portal (Direct Invite: host's room before the lobby). */
  spectateOriginRoomId?: string;
  /** When to teleport both into the freshly created Match Pitch (ms epoch). */
  startAtMs: number;
}
/** key: pending id */
const worldcupPending = new Map<string, WorldcupPendingMatch>();

/** Show a one-off 🤝 handshake bubble above a player to everyone in their room. */
function worldcupSendHandshake(conn: ClientConn, roomId: string): void {
  broadcast(roomId, {
    type: "chat",
    from: conn.displayName,
    fromAddress: conn.address,
    text: "🤝",
    at: Date.now(),
    bubbleOnly: true,
  });
}

/** Challenge accepted: lock both players, show the handshake + countdown, schedule the teleport. */
function worldcupBeginMatch(
  challenger: ClientConn,
  accepter: ClientConn,
  originRoomId: string,
  spectateOriginRoomId?: string
): void {
  // Both leave any open Challenge immediately so the bubble clears and they can't be re-grabbed.
  for (const c of [challenger, accepter]) {
    c.challengeOpen = false;
    c.challengeRaisedAtMs = 0;
  }
  const countdownMs = WORLDCUP_MATCH.countdownMs;
  if (countdownMs <= 0) {
    broadcastRoomStateFull(originRoomId);
    worldcupStartMatch(challenger, accepter, originRoomId);
    return;
  }
  worldcupMatchSeq += 1;
  const id = `pend_${Date.now().toString(36)}_${worldcupMatchSeq.toString(36)}`;
  challenger.pendingMatchId = id;
  accepter.pendingMatchId = id;
  worldcupPending.set(id, {
    id,
    a: compactAddress(challenger.address),
    b: compactAddress(accepter.address),
    originRoomId,
    ...(spectateOriginRoomId ? { spectateOriginRoomId } : {}),
    startAtMs: Date.now() + countdownMs,
  });
  // Re-render the origin room so the (now accepted) Challenge bubble disappears for onlookers.
  broadcastRoomStateFull(originRoomId);
  worldcupSendHandshake(challenger, originRoomId);
  worldcupSendHandshake(accepter, originRoomId);
  const aCountry = worldcupGetPlayerCountry(challenger.address);
  const bCountry = worldcupGetPlayerCountry(accepter.address);
  wsSafeSend(challenger.ws, {
    type: "matchCountdown",
    roomId: originRoomId,
    durationMs: countdownMs,
    opponentAddress: accepter.address,
    opponentCountry: bCountry,
    selfCountry: aCountry,
  } satisfies OutMsg);
  wsSafeSend(accepter.ws, {
    type: "matchCountdown",
    roomId: originRoomId,
    durationMs: countdownMs,
    opponentAddress: challenger.address,
    opponentCountry: aCountry,
    selfCountry: bCountry,
  } satisfies OutMsg);
}

/** Abort any pending Match a wallet is part of (it disconnected/left during the countdown). */
function worldcupAbortPending(address: string): void {
  const compact = compactAddress(address);
  for (const [id, p] of [...worldcupPending]) {
    if (p.a !== compact && p.b !== compact) continue;
    worldcupPending.delete(id);
    for (const r of rooms.values()) {
      for (const c of r.values()) {
        if (c.pendingMatchId === id) c.pendingMatchId = null;
      }
    }
  }
}

/** Resolve both still-connected, still-pending participants of a pending Match (null if broken). */
function worldcupResolvePending(
  p: WorldcupPendingMatch
): { challenger: ClientConn; accepter: ClientConn } | null {
  const room = rooms.get(p.originRoomId);
  if (!room) return null;
  let challenger: ClientConn | null = null;
  let accepter: ClientConn | null = null;
  for (const c of room.values()) {
    const k = compactAddress(c.address);
    if (k === p.a) challenger = c;
    else if (k === p.b) accepter = c;
  }
  if (!challenger || !accepter) return null;
  if (challenger.pendingMatchId !== p.id || accepter.pendingMatchId !== p.id) {
    return null;
  }
  return { challenger, accepter };
}

/** Per-interval: fire pending Matches whose countdown elapsed; drop ones that fell apart. */
function worldcupTickPending(now: number): void {
  if (worldcupPending.size === 0) return;
  for (const [id, p] of [...worldcupPending]) {
    if (now < p.startAtMs) continue;
    worldcupPending.delete(id);
    const pair = worldcupResolvePending(p);
    if (!pair) {
      worldcupAbortPending(p.a);
      worldcupAbortPending(p.b);
      continue;
    }
    pair.challenger.pendingMatchId = null;
    pair.accepter.pendingMatchId = null;
    worldcupStartMatch(
      pair.challenger,
      pair.accepter,
      p.originRoomId,
      p.spectateOriginRoomId
    );
  }
}

/** Start a 1v1: snapshot origins, spin up the pitch, teleport both in, clear challenges. */
function worldcupStartMatch(
  challenger: ClientConn,
  accepter: ClientConn,
  countdownRoomId: string,
  spectateOriginRoomId?: string
): void {
  worldcupMatchSeq += 1;
  const id = `${Date.now().toString(36)}_${worldcupMatchSeq.toString(36)}`;
  const pitchRoomId = normalizeRoomId(worldcupMakeMatchPitchRoomId(id));
  const now = Date.now();
  const portalRoomId = spectateOriginRoomId ?? countdownRoomId;

  const origins = new Map<string, { roomId: string; x: number; z: number; y: number }>();
  for (const c of [challenger, accepter]) {
    // Play Space guests must return to the space they came from, not the public chamber.
    const saved = spawnMap(portalRoomId).get(c.address);
    if (saved) {
      origins.set(compactAddress(c.address), {
        roomId: portalRoomId,
        x: saved.x,
        z: saved.z,
        y: typeof saved.y === "number" ? saved.y : 0,
      });
    } else {
      origins.set(compactAddress(c.address), {
        roomId: countdownRoomId,
        x: c.player.x,
        z: c.player.z,
        y: c.player.y,
      });
    }
  }

  // The spectate portal sits where the challenger was standing (snapped to a tile).
  let portalX = challenger.player.x;
  let portalZ = challenger.player.z;
  if (spectateOriginRoomId) {
    const saved = spawnMap(spectateOriginRoomId).get(challenger.address);
    if (saved) {
      const t = snapToTile(saved.x, saved.z);
      portalX = t.x;
      portalZ = t.z;
    }
  }
  const portalTile = snapToTile(portalX, portalZ);
  const runtime: WorldcupMatchRuntime = {
    id,
    pitchRoomId,
    a: compactAddress(challenger.address),
    b: compactAddress(accepter.address),
    state: worldcupInitMatchState(),
    origins,
    originRoomId: portalRoomId,
    portalX: portalTile.x,
    portalZ: portalTile.z,
    lastTickMs: now,
    endedAtMs: null,
    lastBroadcastMs: 0,
    kickoffUntilMs: 0,
  };
  worldcupMatches.set(pitchRoomId, runtime);

  // Fresh kickoff ball + clean keeper state for the new pitch.
  worldcupSpawnMatchBall(pitchRoomId);
  worldcupGoalies.delete(pitchRoomId);

  // Both leave any open Challenge and are flagged as in-Match.
  for (const c of [challenger, accepter]) {
    c.challengeOpen = false;
    c.challengeRaisedAtMs = 0;
    c.matchId = pitchRoomId;
  }

  const spawnA = worldcupMatchSpawn("a");
  const spawnB = worldcupMatchSpawn("b");
  teleportPlayer(challenger, pitchRoomId, spawnA.x, spawnA.z);
  teleportPlayer(accepter, pitchRoomId, spawnB.x, spawnB.z);

  // The countdown room should re-render so the (now cleared) Challenge bubble disappears.
  broadcastRoomStateFull(countdownRoomId);
  // Spawn the "{identicon} vs {identicon}" spectate portal where the match was started from.
  worldcupBroadcastPortal(runtime);
  broadcastWorldcupMatchState(runtime, true, now);
  recordMatchChallengeStarted(
    challenger.address,
    accepter.address,
    (wallet, unlocks) => achievementUnlockHandlerForAddress(wallet)(unlocks)
  );
}

/** Find the live (non-ended) Match a wallet is playing in, if any. */
function worldcupActiveMatchForWallet(address: string): WorldcupMatchRuntime | null {
  const compact = compactAddress(address);
  for (const m of worldcupMatches.values()) {
    if (m.state.phase === "ended") continue;
    if (m.a === compact || m.b === compact) return m;
  }
  return null;
}

/** A Match player left (disconnect / leaveMatch): the opponent wins immediately. */
function worldcupHandlePlayerDeparture(address: string): void {
  const m = worldcupActiveMatchForWallet(address);
  if (!m) return;
  const compact = compactAddress(address);
  const side: WorldcupMatchSide = m.a === compact ? "a" : "b";
  m.state = worldcupReduceMatch(
    m.state,
    { type: "playerLeft", side },
    WORLDCUP_MATCH_CFG
  );
  const now = Date.now();
  broadcastWorldcupMatchState(m, true, now);
  if (m.state.phase === "ended") worldcupOnMatchEnded(m, now);
}

/** Open Play Space lobbies are ephemeral - not in `hasRoom` / the dynamic registry. */
function directInviteLobbyIsLive(inv: DirectInviteRecord): boolean {
  return inv.phase === "open";
}

function worldcupReturnRoomReachable(roomId: string): boolean {
  if (hasRoom(roomId)) return true;
  if (!isInviteLobbyRoomId(roomId)) return false;
  const slug = roomId.slice("invite-lobby-".length);
  const inv = getInviteBySlug(slug);
  return inv?.phase === "open" && inv.lobbyRoomId === roomId;
}

function playSpaceMayEnter(
  inv: DirectInviteRecord,
  targetRoomId: string,
  address: string
): boolean {
  if (inv.phase !== "open" || inv.lobbyRoomId !== targetRoomId) return false;
  if (inv.hostWallet === address) return true;
  if (address.startsWith("guest:")) {
    return !!getParticipant(inv, address.slice("guest:".length));
  }
  return !!getParticipantByWallet(inv, address);
}

/** Return one entrant to where they came from (if still connected) and clear their Match flag. */
function worldcupReturnEntrant(m: WorldcupMatchRuntime, compact: string): void {
  for (const conn of roomOf(m.pitchRoomId).values()) {
    if (compactAddress(conn.address) !== compact) continue;
    conn.matchId = null;
    conn.spectatingMatchId = null;
    // Play Space members (players AND spectators) always return to their space - this keeps
    // guests confined and re-registers them so the roster overlay refreshes.
    if (conn.directInviteSlug) {
      const inv = getInviteBySlug(conn.directInviteSlug);
      if (inv && directInviteLobbyIsLive(inv)) {
        teleportPlayer(conn, inv.lobbyRoomId, conn.player.x, conn.player.z);
        directInviteOnLobbyConnect(conn, inv.lobbyRoomId, conn.address);
        return;
      }
    }
    const origin = m.origins.get(compact);
    if (origin && worldcupReturnRoomReachable(origin.roomId)) {
      teleportPlayer(conn, origin.roomId, origin.x, origin.z);
      if (isInviteLobbyRoomId(origin.roomId)) {
        directInviteOnLobbyConnect(conn, origin.roomId, conn.address);
      }
    } else if (conn.address.startsWith("guest:")) {
      const g = snapToTile(CHAMBER_DEFAULT_SPAWN.x, CHAMBER_DEFAULT_SPAWN.z);
      teleportPlayer(conn, CHAMBER_ROOM_ID, g.x, g.z);
    } else {
      teleportPlayer(conn, HUB_ROOM_ID, HUB_MAZE_EXIT_SPAWN.x, HUB_MAZE_EXIT_SPAWN.z);
    }
    return;
  }
}

/** Tear down a finished Match: return everyone still in the pitch, drop the room + ball + keepers. */
function worldcupTeardownMatch(m: WorldcupMatchRuntime): void {
  // Snapshot occupants before teleporting (teleport mutates the room map).
  const occupants = [...roomOf(m.pitchRoomId).values()].map((c) =>
    compactAddress(c.address)
  );
  for (const compact of occupants) {
    worldcupReturnEntrant(m, compact);
  }
  // Any flagged-but-absent players (already disconnected) lose their stale flag.
  for (const compact of [m.a, m.b]) {
    const conn = [...rooms.values()]
      .flatMap((r) => [...r.values()])
      .find((c) => compactAddress(c.address) === compact && c.matchId === m.pitchRoomId);
    if (conn) conn.matchId = null;
  }
  worldcupClearRoomBalls(m.pitchRoomId);
  worldcupForgetRoomBallBroadcast(m.pitchRoomId);
  worldcupGoalies.delete(m.pitchRoomId);
  worldcupGoalieBroadcastAt.delete(m.pitchRoomId);
  worldcupMatches.delete(m.pitchRoomId);
  const room = rooms.get(m.pitchRoomId);
  if (room && room.size === 0) rooms.delete(m.pitchRoomId);
}

/** Per-interval: advance live Match clocks, end them on time, and reclaim finished pitches. */
function worldcupTickMatches(now: number): void {
  if (worldcupMatches.size === 0) return;
  for (const m of [...worldcupMatches.values()]) {
    if (m.state.phase !== "ended") {
      // Post-goal kickoff freeze: clock paused; just keep lastTickMs current so it resumes
      // cleanly (no accumulated dt jump) when the countdown ends.
      if (m.kickoffUntilMs > now) {
        m.lastTickMs = now;
        broadcastWorldcupMatchState(m, false, now);
        continue;
      }
      if (m.kickoffUntilMs !== 0) m.kickoffUntilMs = 0;
      const dtMs = Math.max(0, now - m.lastTickMs);
      m.lastTickMs = now;
      m.state = worldcupReduceMatch(m.state, { type: "tick", dtMs }, WORLDCUP_MATCH_CFG);
      if (m.state.phase === "golden") m.enteredGoldenPhase = true;
      broadcastWorldcupMatchState(m, false, now);
      if (m.state.phase === "ended") worldcupOnMatchEnded(m, now);
    } else if (
      m.endedAtMs !== null &&
      now - m.endedAtMs >= WORLDCUP_MATCH.resultLingerMs
    ) {
      worldcupTeardownMatch(m);
    }
  }
}

/** Auto-clear stale open Challenges (no one accepted within the timeout). */
function worldcupSweepStaleChallenges(now: number): void {
  if (!WORLDCUP_ENABLED) return;
  const timeout = WORLDCUP_MATCH.challengeTimeoutMs;
  if (timeout <= 0) return;
  for (const [roomId, room] of rooms) {
    let changed = false;
    for (const conn of room.values()) {
      if (!conn.challengeOpen) continue;
      if (now - conn.challengeRaisedAtMs >= timeout) {
        conn.challengeOpen = false;
        conn.challengeRaisedAtMs = 0;
        changed = true;
      }
    }
    if (changed) broadcastRoomStateFull(roomId);
  }
}

// ---------------------------------------------------------------------------
// directInvite: virtual lobby + Match handoff (feature-flagged; grep "directInvite")
// ---------------------------------------------------------------------------

let directInvitePublicBaseUrl = "https://nimiq.space";

export function setDirectInvitePublicBaseUrl(url: string): void {
  directInvitePublicBaseUrl = url.replace(/\/$/, "") || "https://nimiq.space";
}

export function getWalletCurrentRoomId(wallet: string): string | null {
  return findPlayerRoom(wallet);
}

function findConnByWallet(wallet: string): ClientConn | null {
  const roomId = findPlayerRoom(wallet);
  if (!roomId) return null;
  return rooms.get(roomId)?.get(wallet) ?? null;
}

function directInviteShareUrl(slug: string): string {
  return `${directInvitePublicBaseUrl}/join/${slug}`;
}

function broadcastDirectInviteState(invite: DirectInviteRecord): void {
  const room = rooms.get(invite.lobbyRoomId);
  if (!room) return;
  const hostName = getEffectivePlayerDisplayName(compactAddress(invite.hostWallet));
  const shareUrl = directInviteShareUrl(invite.slug);
  // Everyone in a Play Space room is a participant, so the roster goes to all of them.
  for (const c of room.values()) {
    if (c.streamObserver) continue;
    const viewerKey = c.address.startsWith("guest:")
      ? c.address.slice("guest:".length)
      : c.address;
    const wire = buildInviteStateWire(invite, viewerKey, hostName, shareUrl);
    wsSafeSend(c.ws, { type: "directInviteState", ...wire } satisfies OutMsg);
  }
}

/** Count still-connected members of a Play Space (incl. those away at a Match Pitch). */
function directInviteConnectedCount(slug: string): number {
  let n = 0;
  for (const room of rooms.values()) {
    for (const c of room.values()) {
      if (c.directInviteSlug === slug) n += 1;
    }
  }
  return n;
}

/** Tear down a Play Space once nobody carries its slug anymore. */
function directInviteMaybeTeardown(slug: string): void {
  if (directInviteConnectedCount(slug) > 0) return;
  const invite = getInviteBySlug(slug);
  if (!invite) return;
  closeInvite(slug);
  clearPlaySpaceLayout(invite.lobbyRoomId);
  rooms.delete(invite.lobbyRoomId);
}

/** Detach a member from the Play Space store (host left / guest removed) + clear their flag. */
function directInviteUnregister(conn: ClientConn, slug: string): void {
  const invite = getInviteBySlug(slug);
  conn.directInviteSlug = null;
  if (!invite) return;
  if (conn.address === invite.hostWallet) {
    markHostLeftLobby(slug);
  } else if (conn.address.startsWith("guest:")) {
    removeInviteParticipant(slug, conn.address.slice("guest:".length));
  }
}

function directInviteReturnParticipant(
  conn: ClientConn,
  invite: DirectInviteRecord
): void {
  conn.directInviteSlug = null;
  const isHost = conn.address === invite.hostWallet;
  if (isHost) {
    const saved = spawnMap(invite.hostOriginRoomId).get(conn.address);
    if (saved) {
      teleportPlayer(conn, invite.hostOriginRoomId, saved.x, saved.z);
      return;
    }
    const def = resolveDefaultSpawnForPlayerRoom(invite.hostOriginRoomId);
    if (def) {
      teleportPlayer(conn, invite.hostOriginRoomId, def.x, def.z);
      return;
    }
    teleportPlayer(conn, invite.hostOriginRoomId, 0, 0);
    return;
  }
  const guestSpawn = snapToTile(CHAMBER_DEFAULT_SPAWN.x, CHAMBER_DEFAULT_SPAWN.z);
  teleportPlayer(conn, CHAMBER_ROOM_ID, guestSpawn.x, guestSpawn.z);
}

export function directInviteOnCreated(invite: DirectInviteRecord): void {
  if (!DIRECT_INVITE_ENABLED) return;
  const host = findConnByWallet(invite.hostWallet);
  if (!host) return;
  if (host.challengeOpen) {
    host.challengeOpen = false;
    host.challengeRaisedAtMs = 0;
  }
  // Snapshot where the host stood so leave/expiry can return them precisely. The client
  // joins the lobby over the existing WebSocket (`joinRoom`) - do not teleport here or a
  // follow-up `connectToRoom` disconnect would tear the space down before they land.
  spawnMap(invite.hostOriginRoomId).set(invite.hostWallet, {
    x: host.player.x,
    z: host.player.z,
    y: host.player.y,
  });
}

function directInviteOnLobbyConnect(
  conn: ClientConn,
  roomId: string,
  address: string
): void {
  if (!DIRECT_INVITE_ENABLED || !isInviteLobbyRoomId(roomId)) return;
  const slug = roomId.replace("invite-lobby-", "");
  const invite = getInviteBySlug(slug);
  // The space is gone (expired / torn down): don't strand the visitor here.
  if (!invite || invite.lobbyRoomId !== roomId || invite.phase !== "open") {
    conn.directInviteSlug = null;
    wsSafeSend(conn.ws, {
      type: "directInviteError",
      code: "expired",
      message: "This play space has closed.",
    } satisfies OutMsg);
    return;
  }
  if (address === invite.hostWallet) {
    conn.directInviteSlug = slug;
    markHostJoinedLobby(slug);
  } else if (address.startsWith("guest:")) {
    const gid = address.slice("guest:".length);
    if (!getParticipant(invite, gid)) {
      // Not an authorized member (e.g. the space filled up): bounce them.
      conn.directInviteSlug = null;
      wsSafeSend(conn.ws, {
        type: "directInviteError",
        code: "full",
        message: "This play space is full.",
      } satisfies OutMsg);
      return;
    }
    conn.directInviteSlug = slug;
    markGuestJoinedLobby(slug, gid);
  } else {
    const participant = getParticipantByWallet(invite, address);
    if (!participant) {
      conn.directInviteSlug = null;
      wsSafeSend(conn.ws, {
        type: "directInviteError",
        code: "full",
        message: "This play space is full.",
      } satisfies OutMsg);
      return;
    }
    conn.directInviteSlug = slug;
    markGuestJoinedLobby(slug, participant.guestId);
  }
  const updated = getInviteBySlug(slug);
  if (updated) broadcastDirectInviteState(updated);
}

function directInviteSweepExpired(now: number): void {
  if (!DIRECT_INVITE_ENABLED) return;
  for (const invite of listOpenInvites()) {
    if (now < invite.expiresAtMs) continue;
    // Active spaces keep their join code until close/teardown - not the creation TTL.
    if (invite.participants.length > 0) continue;
    if (directInviteConnectedCount(invite.slug) > 0) continue;
    if (rooms.has(invite.lobbyRoomId)) continue;
    // Abandoned create (never claimed, never joined): reclaim after TTL.
    expireInvitePastTtl(invite.slug);
    const expired = getInviteBySlug(invite.slug);
    if (!expired) continue;
    const room = rooms.get(expired.lobbyRoomId);
    if (room) {
      for (const c of [...room.values()]) {
        wsSafeSend(c.ws, {
          type: "directInviteError",
          code: "expired",
          message: "Play space expired",
        } satisfies OutMsg);
        directInviteReturnParticipant(c, expired);
      }
    }
    rooms.delete(expired.lobbyRoomId);
    clearPlaySpaceLayout(expired.lobbyRoomId);
  }
}

/** A member explicitly leaves the Play Space (host's Leave button, or a guest bailing out). */
function directInviteHandleLeave(conn: ClientConn): void {
  const slug = conn.directInviteSlug;
  if (!slug) return;
  const invite = getInviteBySlug(slug);
  const isHost = !!invite && conn.address === invite.hostWallet;
  directInviteUnregister(conn, slug);
  if (isHost && invite) {
    const saved = spawnMap(invite.hostOriginRoomId).get(conn.address);
    if (saved) {
      teleportPlayer(conn, invite.hostOriginRoomId, saved.x, saved.z);
    } else {
      const def = resolveDefaultSpawnForPlayerRoom(invite.hostOriginRoomId);
      teleportPlayer(conn, invite.hostOriginRoomId, def?.x ?? 0, def?.z ?? 0);
    }
  } else {
    const g = snapToTile(CHAMBER_DEFAULT_SPAWN.x, CHAMBER_DEFAULT_SPAWN.z);
    teleportPlayer(conn, CHAMBER_ROOM_ID, g.x, g.z);
  }
  const updated = getInviteBySlug(slug);
  if (updated) broadcastDirectInviteState(updated);
  directInviteMaybeTeardown(slug);
}

/** A member's socket closed: detach them and tear the space down if it is now empty. */
function directInviteOnDisconnect(conn: ClientConn): void {
  const slug = conn.directInviteSlug;
  if (!slug) return;
  directInviteUnregister(conn, slug);
  const updated = getInviteBySlug(slug);
  if (updated) broadcastDirectInviteState(updated);
  directInviteMaybeTeardown(slug);
}

// worldcup: at UTC midnight the daily tally resets - push the cleared scoreboard and the
// new champion flag to everyone on the pitch so the crowd starts celebrating yesterday's
// winner. Cheap to call every tick; only does work at the day boundary.
function worldcupCheckDailyReset(nowMs: number): void {
  if (!WORLDCUP_ENABLED) return;
  if (!worldcupRolloverIfNeeded(nowMs)) return;
  const topCountries = worldcupGetTopCountries(8);
  const prevWinnerCountry = worldcupGetPreviousDayWinner()?.country ?? null;
  for (const [roomId, room] of rooms) {
    if (normalizeRoomId(roomId) !== WORLDCUP_FIELD_ROOM_ID) continue;
    for (const c of room.values()) {
      if (c.ws.readyState !== 1) continue;
      wsSafeSend(c.ws, {
        type: "worldcupLeaderboard",
        roomId,
        selfCountry: worldcupGetPlayerCountry(c.address),
        topCountries,
        prevWinnerCountry,
        dailyReset: true,
      } satisfies OutMsg);
    }
  }
}

export function startRoomTick(): void {
  loadCanvasClaims();
  loadSignboards();
  loadBillboards();
  loadDesigns();
  loadVoxelTexts();
  loadMazeRecords();
  // worldcup: restore player-placed balls + the season tally + goal-reward counters
  if (WORLDCUP_ENABLED) {
    loadWorldcupBalls();
    loadWorldcupScores();
    loadWorldcupGoalRewards();
  }
  tickClaimableBlockReactivations(Date.now());
  setInterval(() => {
    const now = Date.now();

    tickClaimableBlockReactivations(now);

    // worldcup: daily UTC scoreboard reset (broadcasts cleared tally + new champion flag)
    worldcupCheckDailyReset(now);

    tickExplorationDailyRollover(
      now,
      () => {
        const explorationOnline: Array<{ wallet: string; roomId: string }> =
          [];
        for (const [roomId, room] of rooms) {
          for (const c of room.values()) {
            if (c.streamObserver) continue;
            explorationOnline.push({ wallet: c.address, roomId });
          }
        }
        return explorationOnline;
      },
      (wallet, unlocks) => {
        achievementUnlockHandlerForAddress(wallet)(unlocks);
      }
    );

    // Check canvas timer
    checkCanvasTimer();
    
    // Check canvas cooldown
    checkCanvasCooldown();
    checkCanvasCountdown();
    
    for (const [roomId, room] of rooms) {
      const dt = TICK_MS / 1000;
      let changed = false;
      const placed = placedMap(roomId);
      if (tickExpiredGatesForRoom(roomId, now)) changed = true;
      tickBillboardAudienceDwell(roomId, room, TICK_MS);
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
        if (result.arrivedTiles.length > 0) {
          recordDistinctTileWalked(
            c.address,
            roomId,
            result.arrivedTiles,
            achievementUnlockHandlerForAddress(c.address)
          );
          if (normalizeRoomId(roomId) === WORLDCUP_FIELD_ROOM_ID) {
            recordOutfieldTilesWalked(
              c.address,
              roomId,
              result.arrivedTiles,
              achievementUnlockHandlerForAddress(c.address)
            );
          }
        }
        if (DEBUG_MOVEMENT && result.arrivedTiles.length > 0) {
          const next = c.pathQueue[0];
          logMovementDebug("tick:tileCrossing", {
            address: c.address.slice(0, 14),
            roomId,
            enteredTiles: result.arrivedTiles,
            pos: {
              x: c.player.x,
              y: c.player.y,
              z: c.player.z,
            },
            nextGoal: next
              ? {
                  x: next.x,
                  z: next.z,
                  layer: next.layer,
                  y: waypointY(next.layer, next.x, next.z, placed),
                }
              : null,
            queueLen: c.pathQueue.length,
          });
        }
        // worldcup: on the pitch (field or Match Pitch), free movement rests at the exact
        // float point - skip the grid drift-snap that would pull players to a tile center.
        const isFieldFreeMove = worldcupIsFieldLikeRoom(roomId);
        if (c.pathQueue.length === 0 && !isFieldFreeMove) {
          const moverCtx: PathfindMoverContext = {
            address: compactAddress(c.address),
            nowMs: now,
          };
          const drift = resolveNearestTerrainNode(
            roomId,
            c.player.x,
            c.player.y,
            c.player.z,
            placed,
            moverCtx
          );
          if (drift) {
            const wy = waypointY(
              drift.layer,
              drift.x,
              drift.z,
              placed
            );
            const d = Math.hypot(
              c.player.x - drift.x,
              c.player.y - wy,
              c.player.z - drift.z
            );
            if (d > STANCE_SNAP_DRIFT_EPS) {
              snapPlayerToTerrainGrid(c.player, placed, roomId, moverCtx);
              changed = true;
            }
          }
        }

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
        const extra = extraFloorMap(roomId);
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

      // worldcup: simulate any balls in this room (single isolated hook)
      if (WORLDCUP_ENABLED && worldcupRoomHasBalls(roomId)) {
        const ballPlayers = [];
        for (const c of room.values()) {
          if (c.streamObserver) continue;
          if (c.spectatingMatchId) continue; // worldcup: Spectators can't touch the ball
          ballPlayers.push({
            x: c.player.x,
            z: c.player.z,
            vx: c.player.vx,
            vz: c.player.vz,
            address: c.address,
          });
        }
        const nRoom = normalizeRoomId(roomId);
        const isFieldRoom = nRoom === WORLDCUP_FIELD_ROOM_ID;
        const isMatchPitch = worldcupIsMatchPitch(nRoom);
        // The Free Play Field and every ephemeral Match Pitch share the same open pitch:
        // fixed field bounds (+ goal openings), Goalies on each goal, and goal scoring.
        const isFieldLike = isFieldRoom || isMatchPitch;
        // Non-field-like rooms: bounce balls off solid blocks and off the edge of the
        // walkable floor, so a ball rolls across extra-floor tiles that extend the room
        // past its base bounds instead of stopping at the original wall.
        const ballBlocked = isFieldLike ? null : blockingKeys(roomId);
        // worldcup: Goalies defend every goal. Step them, then either inject them as
        // kicker pseudo-players (clear the ball) or as blocker colliders.
        let goalieColliders: Array<{ x: number; z: number; radius: number }> | undefined;
        if (isFieldLike) {
          const g = worldcupStepGoaliesForRoom(roomId, WORLDCUP_FIELD_GOALS);
          if (g.kickers.length > 0) ballPlayers.push(...g.kickers);
          if (g.colliders.length > 0) goalieColliders = g.colliders;
          const lastG = worldcupGoalieBroadcastAt.get(nRoom) ?? 0;
          if (now - lastG >= WORLDCUP_GOALIE_BROADCAST_MIN_MS) {
            broadcast(roomId, { type: "goalieState", roomId, goalies: g.wire });
            worldcupGoalieBroadcastAt.set(nRoom, now);
          }
        }
        worldcupTickRoomBalls({
          roomId,
          bounds: isFieldLike ? getRoomBaseBounds(roomId) : walkBounds(roomId),
          players: ballPlayers,
          now,
          dt,
          isSolidTile: ballBlocked
            ? (tx, tz) =>
                ballBlocked.has(tileKey(tx, tz)) ||
                !isWalkableForRoom(roomId, tx, tz)
            : undefined,
          // goal scoring on the field (rewards + leaderboard) and in Match Pitches (score only)
          goals: isFieldLike ? WORLDCUP_FIELD_GOALS : undefined,
          onGoal: isFieldRoom
            ? (_ball, goalId, scorer) => handleWorldcupGoal(roomId, goalId, scorer)
            : isMatchPitch
              ? (ball, goalId) =>
                  worldcupHandleMatchGoal(nRoom, goalId, ball.lastKickerAddress)
              : undefined,
          colliders: goalieColliders,
          broadcastBallState: (balls) =>
            broadcast(roomId, { type: "ballState", roomId, balls }),
        });
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

    // worldcup: advance live 1v1 Match clocks / reclaim finished pitches + expire stale challenges
    if (WORLDCUP_ENABLED) {
      worldcupTickPending(now);
      worldcupTickMatches(now);
      worldcupSweepStaleChallenges(now);
    }
    if (DIRECT_INVITE_ENABLED) {
      directInviteSweepExpired(now);
    }
  }, TICK_MS);
}

export function walletHasOpenChallenge(wallet: string): boolean {
  const c = findConnByWallet(wallet);
  return c?.challengeOpen === true;
}

export function getHostDisplayNameForInvite(wallet: string): string {
  return getEffectivePlayerDisplayName(compactAddress(wallet));
}

/** Login / reconnect placement when client sends `resume=1` (within grace window). */
export function resolveResumeLogin(address: string): {
  roomId: string;
  spawn: { x: number; z: number; y?: number };
} {
  const fallback = {
    roomId: CHAMBER_ROOM_ID,
    spawn: {
      x: CHAMBER_DEFAULT_SPAWN.x,
      z: CHAMBER_DEFAULT_SPAWN.z,
    },
  };
  const last = getPlayerLastSession(compactAddress(address));
  if (!last) return fallback;
  if (Date.now() - last.disconnectedAt > PLAYER_RECONNECT_GRACE_MS) {
    return fallback;
  }
  const roomId = normalizeRoomId(last.roomId);
  if (!hasRoom(roomId)) return fallback;
  const t = snapToTile(last.x, last.z);
  if (!isWalkableForRoom(roomId, t.x, t.z)) return fallback;
  return {
    roomId,
    spawn: {
      x: t.x,
      z: t.z,
      ...(typeof last.y === "number" && Number.isFinite(last.y) ? { y: last.y } : {}),
    },
  };
}

export function addClient(
  roomIdRaw: string,
  ws: WebSocket,
  address: string,
  spawnHint?: { x: number; z: number },
  sessionFlags?: {
    nimiqPay?: boolean;
    streamObserver?: boolean;
    guestDisplayName?: string;
    guestId?: string;
    /** Credit Door Crasher when spawn came from explicit door URL params. */
    explorationDoorSpawn?: boolean;
  }
): void {
  const streamObserver = sessionFlags?.streamObserver === true;
  const requestedRoomId = normalizeRoomId(roomIdRaw);
  let roomId = requestedRoomId;
  let canvasGateRedirect = false;

  if (
    address.startsWith("guest:") &&
    isInviteLobbyRoomId(normalizeRoomId(roomId))
  ) {
    const slug = roomId.slice("invite-lobby-".length);
    const invite = getInviteBySlug(slug);
    const guestId = address.slice("guest:".length);
    let denied: { code: "expired" | "full" | "closed"; message: string } | null =
      null;
    if (!invite || invite.lobbyRoomId !== roomId || invite.phase !== "open") {
      denied = {
        code: invite?.phase === "expired" ? "expired" : "closed",
        message: "This play space has closed.",
      };
    } else if (!getParticipant(invite, guestId)) {
      denied = { code: "closed", message: "This play space has closed." };
    }
    if (denied) {
      wsSafeSend(ws, {
        type: "directInviteError",
        code: denied.code,
        message: denied.message,
      } satisfies OutMsg);
      ws.close(4004, "play_space_unavailable");
      return;
    }
  }

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
  if (isInviteLobbyRoomId(normalizeRoomId(roomId))) {
    ensurePlaySpaceLayout(roomId);
  }
  const room = roomOf(roomId);
  const compactSelf = compactAddress(address);
  const displayName =
    sessionFlags?.guestDisplayName?.trim() ||
    getEffectivePlayerDisplayName(compactSelf);
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
  const isPixelRoomConnect = normalizeRoomId(roomId) === PIXEL_ROOM_ID;
  const isGalleryRoomConnect = isCosmeticGalleryRoom(roomId);

  const applySpawnHint = (): boolean => {
    if (
      !spawnHintForPlacement ||
      !Number.isFinite(spawnHintForPlacement.x) ||
      !Number.isFinite(spawnHintForPlacement.z)
    ) {
      return false;
    }
    const t = snapToTile(spawnHintForPlacement.x, spawnHintForPlacement.z);
    if (!isWalkableForRoom(roomId, t.x, t.z)) return false;
    player.x = t.x;
    player.z = t.z;
    placedSpawn = true;
    resolvedSpawnTile = true;
    return true;
  };

  if (isCanvasRoom) {
    if (!applySpawnHint()) {
      const t = snapToTile(CANVAS_SPAWN_X, CANVAS_SPAWN_Z);
      if (isWalkableForRoom(roomId, t.x, t.z)) {
        player.x = t.x;
        player.z = t.z;
        placedSpawn = true;
        resolvedSpawnTile = true;
      }
    }
  } else if (isPixelRoomConnect) {
    if (!applySpawnHint()) {
      const t = snapToTile(PIXEL_DEFAULT_SPAWN.x, PIXEL_DEFAULT_SPAWN.z);
      if (isWalkableForRoom(roomId, t.x, t.z)) {
        player.x = t.x;
        player.z = t.z;
        player.y = 0;
        placedSpawn = true;
        resolvedSpawnTile = true;
      }
    }
  } else if (isChamberRoom) {
    if (!applySpawnHint()) {
      const t = snapToTile(CHAMBER_DEFAULT_SPAWN.x, CHAMBER_DEFAULT_SPAWN.z);
      if (isWalkableForRoom(roomId, t.x, t.z)) {
        player.x = t.x;
        player.z = t.z;
        placedSpawn = true;
        resolvedSpawnTile = true;
      }
    }
  } else if (isGalleryRoomConnect) {
    if (!applySpawnHint()) {
      const t = snapToTile(
        COSMETIC_GALLERY_DEFAULT_SPAWN.x,
        COSMETIC_GALLERY_DEFAULT_SPAWN.z
      );
      if (isWalkableForRoom(roomId, t.x, t.z)) {
        player.x = t.x;
        player.z = t.z;
        player.y = 0;
        placedSpawn = true;
        resolvedSpawnTile = true;
      }
    }
  } else if (isInviteLobbyRoomId(normalizeRoomId(roomId))) {
    if (!applySpawnHint()) {
      const ps = playSpaceJoinSpawn(roomId);
      const t = snapToTile(ps.x, ps.z);
      if (isWalkableForRoom(roomId, t.x, t.z)) {
        player.x = t.x;
        player.z = t.z;
        placedSpawn = true;
        resolvedSpawnTile = true;
      }
    }
  } else if (applySpawnHint()) {
    /* explicit spawn hint for this room */
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
  if (!resolvedSpawnTile && !isCanvasRoom) {
    const def = resolveDefaultSpawnForPlayerRoom(roomId);
    if (def) {
      player.x = def.x;
      player.z = def.z;
      resolvedSpawnTile = true;
    }
  }

  if (resolvedSpawnTile) {
    reconcileSpawnY(player, roomId);
  }

  const { sessionId, startedAt: sessionStartedAt } = beginSession(
    address,
    roomId,
    { nimiqPay: sessionFlags?.nimiqPay === true }
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
    challengeOpen: false,
    challengeRaisedAtMs: 0,
    matchId: null,
    pendingMatchId: null,
    spectatingMatchId: null,
    directInviteSlug: null,
    viewInterest: {
      centerX: player.x,
      centerZ: player.z,
      halfW: DEFAULT_INTEREST_HALF_TILES,
      halfH: DEFAULT_INTEREST_HALF_TILES,
    },
    subscribedChunks: new Set<string>(),
    ...(streamObserver ? { streamObserver: true } : {}),
  };
  initClientViewInterest(conn, player.x, player.z);

  room.set(address, conn);
  console.log(
    `[rooms] connect ${address.slice(0, 12)}… room=${roomId} name="${displayName}"${streamObserver ? " streamObserver" : ""}`
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
  const allowPlaceBlocks =
    !streamObserver && canPlaceBlocksInRoom(roomId, address);
  const allowFloorRecolor =
    !streamObserver && canRecolorFloorInRoom(roomId, address);
  const nJoinRoom = normalizeRoomId(roomId);
  const joinWelcomeBgState = isInviteLobbyRoomId(nJoinRoom)
    ? playSpaceBackgroundState(nJoinRoom)
    : isPlayerCreatedRoom(nJoinRoom)
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
  const spatialWelcome = roomUsesSpatialInterest(rb)
    ? welcomeSpatialLists(roomId, conn)
    : null;
  const chatBacklog = chatBacklogSnapshotForWelcome(roomId, Date.now());

  wsSafeSend(ws, {
      type: "welcome",
      self: selfOut,
      others,
      roomId,
      roomBounds: rb,
      doors,
      placeRadiusBlocks: PLACE_RADIUS_BLOCKS,
      obstacles: spatialWelcome
        ? spatialWelcome.obstacles
        : obstaclesToList(roomId),
      extraFloorTiles: spatialWelcome
        ? spatialWelcome.extraFloorTiles
        : extraFloorToList(roomId),
      baseFloorColorTiles: spatialWelcome
        ? spatialWelcome.baseFloorColorTiles
        : baseFloorColorToList(roomId),
      removedBaseFloorTiles: spatialWelcome
        ? spatialWelcome.removedBaseFloorTiles
        : removedBaseFloorToList(roomId),
      canvasClaims: isCanvas ? getClaimsInBounds(rb.minX, rb.maxX, rb.minZ, rb.maxZ) : undefined,
      signboards,
      billboards: joinBillboardsWire,
      voxelTexts: getVoxelTextsForRoom(roomId),
      onlinePlayerCount: countOnlineRealPlayers(),
      allowPlaceBlocks,
      allowPublishDesign: canPublishDesign(roomId, address),
      allowExtraFloor: allowFloorRecolor,
      allowRoomBackgroundHueEdit: joinAllowRoomBackgroundHueEdit,
      streamObserver: streamObserver || undefined,
      roomBackgroundHueDeg: joinWelcomeBgState.hueDeg,
      roomBackgroundNeutral: joinWelcomeBgState.neutral,
      ...joinSpawnWelcomeExtras(roomId, address),
      ...( (): { blockClaimDeniedReason?: string } => {
        const r = blockClaimAccessDeniedReason(address);
        return r ? { blockClaimDeniedReason: r } : {};
      })(),
      chatBacklog,
      // worldcup: include any balls in this room
      balls:
        WORLDCUP_ENABLED && worldcupRoomHasBalls(roomId)
          ? worldcupBallsToWire(roomId)
          : undefined,
      ...worldcupWelcomeExtras(roomId, address),
      worldcupPortals: WORLDCUP_ENABLED
        ? worldcupPortalsForRoom(roomId)
        : undefined,
      ...cosmeticGalleryWelcomeExtras(roomId),
    } satisfies OutMsg);
  logChatBacklogDelivered(conn.sessionId, address, roomId, chatBacklog);
  sendRoomCatalog(ws, address);
  onPlayerEnteredRoom(conn, roomId, {
    spawnHint: spawnHintForPlacement,
    doorSpawn: sessionFlags?.explorationDoorSpawn === true,
  });
  ensureOnboardingCompleteAchievements(
    address,
    achievementUnlockHandler(conn.ws)
  );

  if (!streamObserver) {
    broadcast(
      roomId,
      { type: "playerJoined", player: playerToOutState(conn) },
      address
    );
    broadcastOnlineCount();
  }

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

  directInviteOnLobbyConnect(conn, roomId, address);

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

    if (msg.type === "setViewInterest") {
      const centerX = Number((msg as { centerX?: unknown }).centerX);
      const centerZ = Number((msg as { centerZ?: unknown }).centerZ);
      const halfW = Number((msg as { halfW?: unknown }).halfW);
      const halfH = Number((msg as { halfH?: unknown }).halfH);
      if (
        !Number.isFinite(centerX) ||
        !Number.isFinite(centerZ) ||
        !Number.isFinite(halfW) ||
        !Number.isFinite(halfH)
      ) {
        return;
      }
      const currentRoomId = findPlayerRoom(address);
      if (!currentRoomId) return;
      const conn = roomOf(currentRoomId).get(address);
      if (!conn) return;
      if (!roomUsesSpatialInterest(getRoomBaseBounds(currentRoomId))) return;
      const retainLoaded =
        (msg as { retainLoaded?: unknown }).retainLoaded === true &&
        conn.streamObserver === true;
      const maxHalf = conn.streamObserver
        ? 400
        : isAdmin(address)
          ? 400
          : NON_ADMIN_MAX_INTEREST_HALF_TILES;
      updateClientViewInterest(conn, currentRoomId, {
        centerX,
        centerZ,
        halfW: Math.max(8, Math.min(maxHalf, halfW)),
        halfH: Math.max(8, Math.min(maxHalf, halfH)),
      }, retainLoaded);
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

    // worldcup: raise / cancel an open 1v1 Challenge (the donut "Open to 1v1" toggle).
    if (msg.type === "setChallenge") {
      if (!WORLDCUP_ENABLED) return;
      if (conn.streamObserver) return;
      const active = Boolean((msg as { active?: unknown }).active);
      if (active) {
        // Not inside a live Match, a Match Pitch, or a pending match. Challenges ARE allowed
        // inside a Play Space (members start their own 1v1s there).
        if (worldcupIsMatchPitch(currentRoomId)) return;
        if (conn.matchId || conn.pendingMatchId) return;
        if (conn.challengeOpen) return;
        conn.challengeOpen = true;
        conn.challengeRaisedAtMs = Date.now();
        fireAchievementEvent(
          address,
          "challenge_raised",
          achievementUnlockHandler(ws)
        );
      } else {
        if (!conn.challengeOpen) return;
        conn.challengeOpen = false;
        conn.challengeRaisedAtMs = 0;
      }
      broadcastRoomStateFull(currentRoomId);
      return;
    }

    // worldcup: accept another player's open Challenge (first-accept-wins -> start the Match).
    if (msg.type === "acceptChallenge") {
      if (!WORLDCUP_ENABLED) return;
      if (conn.streamObserver) return;
      if (conn.matchId || conn.pendingMatchId) return;
      const targetAddress = String(
        (msg as { targetAddress?: unknown }).targetAddress ?? ""
      ).trim();
      if (!targetAddress) return;
      const targetCompact = compactAddress(targetAddress);
      if (targetCompact === compactAddress(address)) return;
      const room = roomOf(currentRoomId);
      let challenger: ClientConn | null = null;
      for (const c of room.values()) {
        if (compactAddress(c.address) === targetCompact) {
          challenger = c;
          break;
        }
      }
      if (!challenger) return;
      if (!challenger.challengeOpen || challenger.matchId || challenger.pendingMatchId) {
        return;
      }
      worldcupBeginMatch(challenger, conn, currentRoomId);
      fireAchievementEvent(
        address,
        "challenge_accepted",
        achievementUnlockHandler(ws)
      );
      return;
    }

    // A Play Space member explicitly leaving (host's Leave button). Guests are confined, so
    // this is the host path in practice; either way the sender departs their space.
    if (msg.type === "cancelDirectInvite") {
      if (!DIRECT_INVITE_ENABLED) return;
      if (conn.streamObserver) return;
      directInviteHandleLeave(conn);
      return;
    }

    // worldcup: leave the current 1v1 (forfeits to the opponent, returns the leaver home).
    // For a Spectator this just stops watching and returns them home (no forfeit).
    if (msg.type === "leaveMatch") {
      if (!WORLDCUP_ENABLED) return;
      if (conn.spectatingMatchId) {
        const sm = worldcupMatches.get(conn.spectatingMatchId);
        if (sm) {
          worldcupReturnEntrant(sm, compactAddress(address));
          worldcupBroadcastPortal(sm);
        } else {
          conn.spectatingMatchId = null;
        }
        return;
      }
      const m = conn.matchId ? worldcupMatches.get(conn.matchId) : null;
      worldcupHandlePlayerDeparture(address);
      if (m) worldcupReturnEntrant(m, compactAddress(address));
      return;
    }

    // worldcup: drop into a live Match's stands to watch it (Spectator).
    if (msg.type === "requestSpectate") {
      if (!WORLDCUP_ENABLED) return;
      if (conn.streamObserver) return;
      if (conn.matchId || conn.pendingMatchId || conn.spectatingMatchId) return;
      const matchId = normalizeRoomId(
        String((msg as { matchId?: unknown }).matchId ?? "").trim()
      );
      if (!matchId) return;
      const m = worldcupMatches.get(matchId);
      if (!m || m.state.phase === "ended") return;
      if (worldcupSpectatorCount(m) >= WORLDCUP_MATCH.spectatorCap) {
        // Portal is full - tell this onlooker (and refresh the portal's full state).
        wsSafeSend(ws, { type: "error", code: "spectate_full" } satisfies OutMsg);
        worldcupBroadcastPortal(m);
        return;
      }
      // Snapshot where they came from so they're returned when the Match ends.
      m.origins.set(compactAddress(address), {
        roomId: currentRoomId,
        x: conn.player.x,
        z: conn.player.z,
        y: conn.player.y,
      });
      conn.spectatingMatchId = matchId;
      const seat = worldcupSpectatorSeat(worldcupSpectatorCount(m));
      teleportPlayer(conn, matchId, seat.x, seat.z);
      worldcupBroadcastPortal(m);
      broadcastWorldcupMatchState(m, true, Date.now());
      return;
    }

    // Player picks/changes their country. This is the single per-player country: it both
    // credits World Cup goals (in-season) AND backs the profile flag + Flag Emote, so it is
    // accepted regardless of WORLDCUP_ENABLED. Only the seasonal leaderboard/crowd extras
    // are gated behind the season flag.
    if (msg.type === "setCountry") {
      const code = String((msg as { code?: unknown }).code ?? "")
        .trim()
        .toUpperCase();
      if (!worldcupIsValidCountryCode(code)) return;
      const hadCountry = worldcupGetPlayerCountry(address) != null;
      worldcupSetCountry(address, code, conn.player.displayName);
      if (!hadCountry) {
        fireAchievementEvent(
          address,
          "country_picked",
          achievementUnlockHandler(ws)
        );
      }
      wsSafeSend(ws, {
        type: "worldcupLeaderboard",
        roomId: currentRoomId,
        selfCountry: code,
        topCountries: WORLDCUP_ENABLED ? worldcupGetTopCountries(8) : [],
        prevWinnerCountry: WORLDCUP_ENABLED
          ? worldcupGetPreviousDayWinner()?.country ?? null
          : null,
      } satisfies OutMsg);
      // Re-broadcast so others (and the field crowd) pick up this player's new flag.
      if (WORLDCUP_ENABLED && worldcupIsFieldLikeRoom(currentRoomId))
        broadcastRoomStateFull(currentRoomId);
      return;
    }

    // worldcup: place a kickable ball in the current room (builders only)
    if (msg.type === "placeBall") {
      if (!WORLDCUP_ENABLED) return;
      if (conn.streamObserver) return;
      if (!canPlaceBallInRoom(currentRoomId, address)) {
        wsSafeSend(ws, { type: "error", code: "ball_place_forbidden" } satisfies OutMsg);
        return;
      }
      const tx = Number((msg as { x?: unknown }).x);
      const tz = Number((msg as { z?: unknown }).z);
      if (!Number.isFinite(tx) || !Number.isFinite(tz)) return;
      const t = snapToTile(tx, tz);
      if (!isWalkableForRoom(currentRoomId, t.x, t.z)) {
        wsSafeSend(ws, { type: "error", code: "ball_place_blocked" } satisfies OutMsg);
        return;
      }
      const ball = worldcupAddPlacedBall(currentRoomId, t.x, t.z, address);
      if (!ball) {
        wsSafeSend(ws, { type: "error", code: "ball_limit_reached" } satisfies OutMsg);
        return;
      }
      broadcast(currentRoomId, {
        type: "ballState",
        roomId: currentRoomId,
        balls: worldcupBallsToWire(currentRoomId),
      } satisfies OutMsg);
      return;
    }

    // worldcup: remove a player-placed ball (builders only)
    if (msg.type === "removeBall") {
      if (!WORLDCUP_ENABLED) return;
      if (conn.streamObserver) return;
      if (!canPlaceBallInRoom(currentRoomId, address)) return;
      const ballId = String((msg as { ballId?: unknown }).ballId ?? "").trim();
      if (!ballId) return;
      if (worldcupRemoveBall(currentRoomId, ballId)) {
        broadcast(currentRoomId, {
          type: "ballState",
          roomId: currentRoomId,
          balls: worldcupBallsToWire(currentRoomId),
        } satisfies OutMsg);
      }
      return;
    }

    if (msg.type === "campaignImpression") {
      if (conn.streamObserver || conn.nimSendIntent) return;
      const rawItems = (msg as { items?: unknown }).items;
      if (!Array.isArray(rawItems)) return;
      const items: Array<{ campaignId: string; visibleMs: number }> = [];
      for (const raw of rawItems.slice(0, CAMPAIGN_IMPRESSION_BATCH_MAX)) {
        if (!raw || typeof raw !== "object") continue;
        const o = raw as Record<string, unknown>;
        const campaignId = String(o.campaignId ?? "").trim();
        const visibleMs = Number(o.visibleMs);
        if (!campaignId || !Number.isFinite(visibleMs) || visibleMs < 1) continue;
        items.push({ campaignId, visibleMs });
      }
      if (items.length === 0) return;
      recordCampaignImpressions({ wallet: address, items });
      return;
    }

    if (msg.type === "campaignLinkClick") {
      if (conn.streamObserver) return;
      const campaignId = String(
        (msg as { campaignId?: unknown }).campaignId ?? ""
      ).trim();
      if (!campaignId) return;
      recordCampaignLinkClick({ wallet: address, campaignId });
      return;
    }

    if (msg.type === "achievementSignal") {
      if (conn.streamObserver) return;
      const kind = String((msg as { kind?: unknown }).kind ?? "").trim();
      const onUnlock = achievementUnlockHandler(ws);
      if (kind === "open_profile") {
        fireAchievementEvent(address, "open_profile", onUnlock);
      } else if (kind === "open_wardrobe") {
        fireAchievementEvent(address, "open_wardrobe", onUnlock);
      } else if (kind === "send_emote") {
        fireAchievementEvent(address, "send_emote", onUnlock);
      } else if (kind === "flag_emote") {
        fireAchievementEvent(address, "flag_emote_sent", onUnlock);
      } else if (kind === "open_signboard") {
        const signboardId = String(
          (msg as { signboardId?: unknown }).signboardId ?? ""
        ).trim();
        const authorAddress = String(
          (msg as { authorAddress?: unknown }).authorAddress ?? ""
        ).trim();
        if (!signboardId || !authorAddress) return;
        const signboard = getSignboardById(signboardId);
        if (!signboard) return;
        if (compactAddress(signboard.createdBy) !== compactAddress(authorAddress)) {
          return;
        }
        recordSignboardOpened(
          address,
          signboard.id,
          signboard.createdBy,
          onUnlock
        );
      } else if (kind === "mine_cooldown_attempt") {
        recordMineCooldownAttempt(address, onUnlock);
      }
      return;
    }

    if (msg.type === "createRoom") {
      const widthTiles = Number(msg.widthTiles);
      const heightTiles = Number(msg.heightTiles);
      const displayName = String(msg.displayName ?? "").trim();
      if (!displayName) {
        wsSafeSend(ws, {
            type: "chat",
            from: "System",
            fromAddress: "SYSTEM",
            text: "Choose a room name before creating a room.",
            at: Date.now(),
          } satisfies OutMsg);
        return;
      }
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
      fireAchievementEvent(
        address,
        "create_room",
        achievementUnlockHandler(ws)
      );
      recordRoomCreatedForDeluxe(
        address,
        created.id,
        achievementUnlockHandler(ws)
      );
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
        joinSpawn?: { x: number; z: number } | null;
        deployablesAllowed?: boolean;
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
      const rawJoinSpawn = (msg as { joinSpawn?: unknown }).joinSpawn;
      if (rawJoinSpawn !== undefined) {
        if (rawJoinSpawn === null) {
          patch.joinSpawn = null;
        } else if (rawJoinSpawn && typeof rawJoinSpawn === "object") {
          const ox = Number((rawJoinSpawn as { x?: unknown }).x);
          const oz = Number((rawJoinSpawn as { z?: unknown }).z);
          if (!Number.isFinite(ox) || !Number.isFinite(oz)) {
            wsSafeSend(ws, {
                type: "chat",
                from: "System",
                fromAddress: "SYSTEM",
                text: "Entry spawn needs numeric x and z.",
                at: Date.now(),
              } satisfies OutMsg);
            return;
          }
          const st = snapToTile(ox, oz);
          if (!isWalkableForRoom(roomId, st.x, st.z)) {
            wsSafeSend(ws, {
                type: "chat",
                from: "System",
                fromAddress: "SYSTEM",
                text: "Entry spawn must be a walkable floor tile.",
                at: Date.now(),
              } satisfies OutMsg);
            return;
          }
          patch.joinSpawn = { x: st.x, z: st.z };
        } else {
          wsSafeSend(ws, {
              type: "chat",
              from: "System",
              fromAddress: "SYSTEM",
              text: "joinSpawn must be null or { x, z }.",
              at: Date.now(),
            } satisfies OutMsg);
          return;
        }
      }
      if ((msg as { deployablesAllowed?: unknown }).deployablesAllowed !== undefined) {
        patch.deployablesAllowed = Boolean(
          (msg as { deployablesAllowed?: unknown }).deployablesAllowed
        );
      }
      if (
        patch.displayName === undefined &&
        patch.isPublic === undefined &&
        patch.backgroundHueDeg === undefined &&
        patch.backgroundNeutral === undefined &&
        patch.joinSpawn === undefined &&
        patch.deployablesAllowed === undefined
      ) {
        wsSafeSend(ws, {
            type: "chat",
            from: "System",
            fromAddress: "SYSTEM",
            text: "Send a room field to update (name, visibility, background, entry spawn, or deployables).",
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
      const nR = normalizeRoomId(roomId);
      if (
        patch.backgroundHueDeg !== undefined ||
        patch.backgroundNeutral !== undefined
      ) {
        const st = getDynamicRoomBackgroundState(nR);
        broadcast(nR, {
          type: "roomBackgroundHue",
          roomId: nR,
          hueDeg: st.hueDeg,
          neutral: st.neutral,
        });
      }
      if (patch.joinSpawn !== undefined) {
        const p = joinSpawnBroadcastPayload(nR);
        broadcast(nR, {
          type: "roomJoinSpawn",
          roomId: nR,
          x: p.x,
          z: p.z,
          customized: p.customized,
        });
        if (patch.joinSpawn !== null && isWalletOwnedRoomOwner(nR, address)) {
          recordRoomJoinSpawnForDeluxe(
            address,
            nR,
            achievementUnlockHandler(ws)
          );
        }
      }
      if (patch.deployablesAllowed !== undefined) {
        broadcast(nR, {
          type: "roomDeployablesAllowed",
          roomId: nR,
          allowed: getDynamicRoomDeployablesAllowed(nR),
        });
      }
      return;
    }

    if (msg.type === "deployCosmetic") {
      const deployRoomId = normalizeRoomId(roomId);
      const cosmeticSku = String(
        (msg as { cosmeticSku?: string }).cosmeticSku ?? ""
      ).trim();
      const tx = Math.floor(Number((msg as { x?: unknown }).x));
      const tz = Math.floor(Number((msg as { z?: unknown }).z));
      if (!cosmeticSku || !Number.isFinite(tx) || !Number.isFinite(tz)) return;
      const playerTile = snapToTile(conn.player.x, conn.player.z);
      const validated = validateCosmeticDeploy({
        wallet: address,
        roomId: deployRoomId,
        cosmeticSku,
        playerX: playerTile.x,
        playerZ: playerTile.z,
        tileX: tx,
        tileZ: tz,
        deployablesAllowed: getDynamicRoomDeployablesAllowed(deployRoomId),
        isWalkable: (x, z) => isWalkableForRoom(deployRoomId, x, z),
      });
      if (!validated.ok) {
        wsSafeSend(ws, {
          type: "chat",
          from: "System",
          fromAddress: "SYSTEM",
          text: deployRejectMessage(validated.reason),
          at: Date.now(),
        } satisfies OutMsg);
        return;
      }
      recordCosmeticDeploy({
        roomId: deployRoomId,
        wallet: address,
        cosmeticSku,
        presetId: validated.presetId,
        x: tx,
        z: tz,
        expiresAtMs: validated.expiresAtMs,
      });
      broadcast(deployRoomId, {
        type: "cosmeticDeployed",
        cosmeticSku,
        presetId: validated.presetId,
        x: tx,
        z: tz,
        by: address,
        expiresAt: validated.expiresAtMs,
      } satisfies OutMsg);
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
      if (conn.streamObserver) return;
      // Guests are confined to their Play Space; they cannot navigate to other rooms.
      if (address.startsWith("guest:")) {
        wsSafeSend(ws, {
          type: "joinRoomFailed",
          roomId: String(msg.roomId ?? ""),
          reason: "not_found",
        } satisfies OutMsg);
        return;
      }
      const targetRoomId = resolveJoinRoomTarget(String(msg.roomId ?? ""));
      // worldcup: Match Pitches are server-managed and never directly joinable.
      if (worldcupIsMatchPitch(normalizeRoomId(targetRoomId))) return;
      // worldcup: navigating to another room mid-Match forfeits to the opponent (same as
      // pressing Leave), then proceeds to the requested room - e.g. leaving a 1v1 to go
      // straight to the Free Play Field. A Spectator simply stops watching.
      if (conn.matchId) {
        worldcupHandlePlayerDeparture(address);
        conn.matchId = null;
      }
      conn.spectatingMatchId = null;
      const inviteLobby = isInviteLobbyRoomId(targetRoomId);
      if (inviteLobby) {
        const slug = targetRoomId.slice("invite-lobby-".length);
        let inv = getInviteBySlug(slug);
        if (!inv || inv.phase !== "open" || inv.lobbyRoomId !== targetRoomId) {
          wsSafeSend(ws, {
            type: "joinRoomFailed",
            roomId: targetRoomId,
            reason: "not_found",
          } satisfies OutMsg);
          return;
        }
        if (!playSpaceMayEnter(inv, targetRoomId, address)) {
          const joined = joinInviteAsWallet(
            slug,
            generateGuestId(),
            address,
            getEffectivePlayerDisplayName(compactAddress(address))
          );
          if (!joined.ok) {
            wsSafeSend(ws, {
              type: "joinRoomFailed",
              roomId: targetRoomId,
              reason: "not_found",
            } satisfies OutMsg);
            return;
          }
          inv = joined.invite;
          broadcastDirectInviteState(inv);
        }
      } else if (!hasRoom(targetRoomId)) {
        wsSafeSend(ws, {
            type: "joinRoomFailed",
            roomId: targetRoomId,
            reason: "not_found",
          } satisfies OutMsg);
        return;
      }
      const b = getRoomBaseBounds(targetRoomId);
      let spawnX = Math.floor((b.minX + b.maxX) / 2);
      let spawnZ = Math.floor((b.minZ + b.maxZ) / 2);
      if (normalizeRoomId(targetRoomId) === PIXEL_ROOM_ID) {
        spawnX = PIXEL_DEFAULT_SPAWN.x;
        spawnZ = PIXEL_DEFAULT_SPAWN.z;
      } else if (isCosmeticGalleryRoom(targetRoomId)) {
        spawnX = COSMETIC_GALLERY_DEFAULT_SPAWN.x;
        spawnZ = COSMETIC_GALLERY_DEFAULT_SPAWN.z;
      } else if (isInviteLobbyRoomId(targetRoomId)) {
        const ps = playSpaceJoinSpawn(targetRoomId);
        spawnX = ps.x;
        spawnZ = ps.z;
      } else if (isPlayerCreatedRoom(targetRoomId)) {
        const t = resolveDefaultSpawnForPlayerRoom(targetRoomId);
        if (t) {
          spawnX = t.x;
          spawnZ = t.z;
        }
      }
      teleportPlayer(conn, targetRoomId, spawnX, spawnZ);
      return;
    }

    if (msg.type === "returnFromShaper") {
      if (conn.streamObserver) return;
      if (address.startsWith("guest:")) return;
      // Constrained leave path: only while inside The Shaper, and only to the room/tile the
      // server recorded when they entered (not client-supplied coordinates - those would be a
      // generic teleport API). Hub fallback when origin is missing, expired, or no longer valid.
      let currentRoomId: string | null = null;
      for (const [rid, room] of rooms) {
        if (room.has(address)) {
          currentRoomId = rid;
          break;
        }
      }
      if (currentRoomId === null || !isCosmeticGalleryRoom(currentRoomId)) {
        wsSafeSend(conn.ws, { type: "shaperReturnFailed", reason: "not_in_shaper" });
        return;
      }
      if (conn.matchId) {
        worldcupHandlePlayerDeparture(address);
        conn.matchId = null;
      }
      conn.spectatingMatchId = null;

      const stored = consumeShaperReturnOrigin(address);
      let returnRoomId = CHAMBER_ROOM_ID;
      let hintX: number = CHAMBER_DEFAULT_SPAWN.x;
      let hintZ: number = CHAMBER_DEFAULT_SPAWN.z;
      if (stored && isValidShaperReturnRoom(stored.roomId)) {
        returnRoomId = stored.roomId;
        hintX = stored.x;
        hintZ = stored.z;
      }
      const spawn = resolveReturnSpawn(returnRoomId, address, hintX, hintZ);
      teleportPlayer(conn, returnRoomId, spawn.x, spawn.z);
      return;
    }

    if (msg.type === "moveTo") {
      if (conn.streamObserver) return;
      if (conn.spectatingMatchId) return; // worldcup: Spectators are fixed in the stands
      // worldcup: during the post-goal kickoff freeze, both players are locked in place until
      // the countdown ends (the server already snapped them to their kickoff spots).
      if (conn.matchId) {
        const m = worldcupMatches.get(normalizeRoomId(conn.matchId));
        if (m && m.kickoffUntilMs > Date.now()) return;
      }
      // A "stop" intent (e.g. releasing the touch joystick) clears the path immediately and is
      // never rate-limited, so the player halts the instant the finger lifts instead of gliding
      // on toward the last (far) joystick target - which the 120ms move rate limit would drop.
      if (msg.stop === true) {
        if (conn.pathQueue.length > 0) {
          conn.pathQueue = [];
          pendingTickStateBroadcast.add(currentRoomId);
        }
        return;
      }
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
      const tx = Number(msg.x);
      const tz = Number(msg.z);
      if (!Number.isFinite(tx) || !Number.isFinite(tz)) return;
      const fieldFreeMove = worldcupIsFieldLikeRoom(currentRoomId);
      const moveRateMs = fieldFreeMove ? RATE_MOVE_TO_FIELD_MS : RATE_MOVE_TO_MS;
      if (now - conn.lastMoveToAt < moveRateMs) return;
      conn.lastMoveToAt = now;
      // worldcup: the soccer pitch uses free (any-direction) movement - go in a straight
      // line to the exact clicked float point (no tile snap, no grid pathfinding) so the
      // ball can be kicked at any angle. The pitch is an open rectangle with no obstacles,
      // so a clamped straight line is always safe; walls clamp in advanceAlongPathHuman.
      if (fieldFreeMove) {
        const wb = worldcupMoveClampBounds(currentRoomId);
        const fx = clamp(tx, wb.minX, wb.maxX);
        const fz = clamp(tz, wb.minZ, wb.maxZ);
        const from = { x: conn.player.x, z: conn.player.z };
        conn.player.y = 0;
        conn.pathQueue = [{ x: fx, z: fz, layer: 0 }];
        logGameplayEvent(conn.sessionId, address, currentRoomId, "move_to", {
          fromX: from.x,
          fromZ: from.z,
          toX: fx,
          toZ: fz,
          goalLayer: 0,
        });
        return;
      }
      const dest = snapToTile(tx, tz);
      const p = conn.player;
      const placed = placedMap(currentRoomId);
      const extra = extraFloorMap(currentRoomId);
      const moverCtx: PathfindMoverContext = {
        address: compactAddress(address),
        nowMs: now,
      };
      const startNode = resolvePathfindStartNode(
        currentRoomId,
        p,
        placed,
        moverCtx
      );
      if (!startNode) {
        snapPlayerToTerrainGrid(p, placed, currentRoomId, moverCtx);
        conn.pathQueue = [];
        pendingTickStateBroadcast.add(currentRoomId);
        return;
      }
      const gl = msg.layer;
      const goalLayer: 0 | 1 =
        gl === 1 || gl === "1" ? 1 : 0;
      const full = pathfindTerrain(
        startNode.x,
        startNode.z,
        startNode.layer,
        dest.x,
        dest.z,
        goalLayer,
        placed,
        extra,
        currentRoomId,
        baseRemovedReadonly(currentRoomId),
        moverCtx
      );
      if (!full || full.length === 0) {
        const prevWorld = { x: p.x, y: p.y, z: p.z };
        const recovered = findRecoveryTerrainPath(
          currentRoomId,
          p,
          dest,
          goalLayer,
          placed,
          extra,
          startNode.layer,
          moverCtx
        );
        if (!recovered) {
          logMovementDebug("moveTo:noPath", {
            address: address.slice(0, 14),
            roomId: currentRoomId,
            world: prevWorld,
            snapStart: { x: startNode.x, z: startNode.z },
            startLayer: startNode.layer,
            dest,
            goalLayer,
          });
          snapPlayerToTerrainGrid(p, placed, currentRoomId, moverCtx);
          conn.pathQueue = [];
          pendingTickStateBroadcast.add(currentRoomId);
          return;
        }
        logMovementDebug("moveTo:recoveryPath", {
          address: address.slice(0, 14),
          roomId: currentRoomId,
          worldBefore: prevWorld,
          snapStart: { x: startNode.x, z: startNode.z },
          startLayer: startNode.layer,
          recoveryStart: recovered.start,
          recoveryStartLayer: recovered.start.layer,
          dest,
          goalLayer,
          fullPath: recovered.full.map(formatTerrainPathWaypoint),
          queueRemaining: recovered.full.length - 1,
        });
        // Snap to a nearby valid terrain node when seam rounding picked a bad start.
        p.x = recovered.start.x;
        p.z = recovered.start.z;
        p.y = waypointY(recovered.start.layer, recovered.start.x, recovered.start.z, placed);
        conn.pathQueue = recovered.full.slice(1);
      } else {
        logMovementDebug("moveTo:path", {
          address: address.slice(0, 14),
          roomId: currentRoomId,
          world: { x: p.x, y: p.y, z: p.z },
          snapStart: { x: startNode.x, z: startNode.z },
          startLayer: startNode.layer,
          dest,
          goalLayer,
          fullPath: full.map(formatTerrainPathWaypoint),
          queueRemaining: full.length - 1,
        });
        conn.pathQueue = full.slice(1);
      }
      logGameplayEvent(conn.sessionId, address, currentRoomId, "move_to", {
        fromX: startNode.x,
        fromZ: startNode.z,
        toX: dest.x,
        toZ: dest.z,
        goalLayer,
      });
      return;
    }

    if (msg.type === "enterPortal") {
      // Guests are confined to their Play Space; teleporters are off-limits to them.
      if (address.startsWith("guest:")) return;
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
          recordTeleporterWarp(
            address,
            currentRoomId,
            here.x,
            here.z,
            normalizeRoomId(t.targetRoomId),
            achievementUnlockHandler(ws)
          );
          const landing = resolveTeleporterLandingInRoom(
            normalizeRoomId(t.targetRoomId),
            t.targetX,
            t.targetZ
          );
          teleportPlayer(
            conn,
            normalizeRoomId(t.targetRoomId),
            landing.x,
            landing.z
          );
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
      if (!canPlaceBlocksInRoom(currentRoomId, address)) {
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
      const hexRadiusScale = prism.hex
        ? clampHexRadiusScale(
            Number(
              msg.hexRadiusScale ??
                (msg as { hexHeightScale?: number }).hexHeightScale ??
                1
            )
          )
        : 1;
      const sphereRadiusScale = prism.sphere
        ? clampSphereRadiusScale(Number(msg.sphereRadiusScale ?? 1))
        : 1;
      const cubeRot = cubeRotationForPlainCube(prism, msg as TerrainProps);
      const colorRgb = colorRgbFromWire(msg);
      const requestedClaimable = Boolean(msg.claimable);
      const claimable =
        requestedClaimable && canPlaceMineableBlocks(address);
      if (requestedClaimable && !claimable) {
        wsSafeSend(ws, {
            type: "chat",
            from: "System",
            fromAddress: "SYSTEM",
            text: "Only admins or the authorized reward wallet can place mineable blocks.",
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
        hexRadiusScale,
        sphere: prism.sphere,
        sphereRadiusScale,
        ramp: prism.ramp,
        rampDir: prism.ramp ? rampDir : 0,
        ...cubeRot,
        colorRgb,
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
        colorRgb,
      });
      recordTerrainShapePlaced(
        address,
        {
          hex: prism.hex,
          pyramid: prism.pyramid,
          sphere: prism.sphere,
          ramp: prism.ramp,
        },
        achievementUnlockHandler(ws)
      );
      recordBlockPlaced(
        address,
        currentRoomId,
        achievementUnlockHandler(ws)
      );
      if (isWalletOwnedRoomOwner(currentRoomId, address)) {
        recordOwnedRoomBlockPlaced(
          address,
          currentRoomId,
          colorRgb,
          achievementUnlockHandler(ws)
        );
      }
      return;
    }


    if (msg.type === "publishDesign") {
      if (!canPlaceBlocksInRoom(currentRoomId, address)) return;
      if (!canPublishDesign(currentRoomId, address)) {
        wsSafeSend(ws, { type: "error", code: "publish_design_forbidden" } satisfies OutMsg);
        return;
      }
      const now = Date.now();
      if (now - (conn.lastPublishDesignAt ?? 0) < RATE_PUBLISH_DESIGN_MS) return;
      conn.lastPublishDesignAt = now;
      const kindRaw = String(msg.kind ?? "object");
      const kind: DesignKind = kindRaw === "room" ? "room" : "object";
      const minX = Number(msg.minX);
      const maxX = Number(msg.maxX);
      const minZ = Number(msg.minZ);
      const maxZ = Number(msg.maxZ);
      if (![minX, maxX, minZ, maxZ].every(Number.isFinite)) return;
      let priceLuna = 0n;
      if (msg.priceLuna !== undefined && msg.priceLuna !== null) {
        try {
          priceLuna = BigInt(String(msg.priceLuna));
          if (priceLuna < 0n) priceLuna = 0n;
        } catch {
          wsSafeSend(ws, { type: "error", code: "invalid_price" } satisfies OutMsg);
          return;
        }
      }
      const visibilityRaw = String(msg.visibility ?? "private");
      const visibility = visibilityRaw === "public" ? "public" : "private";
      const placed = placedMap(currentRoomId);
      const result = publishDesign({
        kind,
        creatorWallet: address,
        sourceRoomId: currentRoomId,
        minX,
        maxX,
        minZ,
        maxZ,
        name: String(msg.name ?? ""),
        description: String(msg.description ?? ""),
        tags: Array.isArray(msg.tags) ? (msg.tags as unknown[]).map((x) => String(x)) : [],
        visibility,
        priceLuna,
        hubStampAllowed: Boolean(msg.hubStampAllowed),
        placed,
        extraFloor: extraFloorMap(currentRoomId),
        baseFloorColors: baseFloorColorMap(currentRoomId),
      });
      if (!result.ok) {
        wsSafeSend(ws, { type: "error", code: result.code } satisfies OutMsg);
        return;
      }
      logGameplayEvent(conn.sessionId, address, currentRoomId, "design_published", {
        designId: result.design.id,
        kind: result.design.kind,
        footprintW: result.design.footprintW,
        footprintD: result.design.footprintD,
      });
      recordPrefabPublished(
        address,
        result.design.visibility,
        result.design.kind,
        achievementUnlockHandler(ws)
      );
      wsSafeSend(ws, {
        type: "designPublished",
        design: designToWire(result.design),
      } satisfies OutMsg);
      return;
    }

    if (msg.type === "deleteDesign") {
      const now = Date.now();
      if (now - (conn.lastPublishDesignAt ?? 0) < RATE_PUBLISH_DESIGN_MS) return;
      conn.lastPublishDesignAt = now;
      const designId = String(msg.designId ?? "").trim();
      if (!designId) return;
      const result = deleteDesign(address, designId);
      if (!result.ok) {
        wsSafeSend(ws, {
          type: "error",
          code: result.code === "forbidden" ? "design_delete_forbidden" : "design_not_found",
        } satisfies OutMsg);
        return;
      }
      logGameplayEvent(conn.sessionId, address, currentRoomId, "design_deleted", {
        designId,
      });
      wsSafeSend(ws, { type: "designDeleted", designId } satisfies OutMsg);
      return;
    }

    if (msg.type === "updateDesignVisibility") {
      const now = Date.now();
      if (now - (conn.lastPublishDesignAt ?? 0) < RATE_PUBLISH_DESIGN_MS) return;
      conn.lastPublishDesignAt = now;
      const designId = String(msg.designId ?? "").trim();
      const visibilityRaw = String(msg.visibility ?? "private");
      const visibility = visibilityRaw === "public" ? "public" : "private";
      if (!designId) return;
      const result = updateDesignVisibility(address, designId, visibility);
      if (!result.ok) {
        wsSafeSend(ws, {
          type: "error",
          code:
            result.code === "forbidden"
              ? "design_visibility_forbidden"
              : "design_not_found",
        } satisfies OutMsg);
        return;
      }
      logGameplayEvent(
        conn.sessionId,
        address,
        currentRoomId,
        "design_visibility_updated",
        { designId, visibility: result.design.visibility }
      );
      wsSafeSend(ws, {
        type: "designUpdated",
        design: designToWire(result.design),
      } satisfies OutMsg);
      return;
    }

    if (msg.type === "placeDesignInRoom") {
      if (!canPlaceBlocksInRoom(currentRoomId, address)) return;
      const now = Date.now();
      if (now - (conn.lastDesignStampAt ?? 0) < RATE_DESIGN_STAMP_MS) return;
      conn.lastDesignStampAt = now;
      const designId = String(msg.designId ?? "");
      const anchorX = Number(msg.anchorX);
      const anchorZ = Number(msg.anchorZ);
      const yawSteps = Math.floor(Number(msg.yawSteps ?? 0));
      if (!designId || !Number.isFinite(anchorX) || !Number.isFinite(anchorZ)) return;
      if (!withinBlockActionRange(conn.player, anchorX, anchorZ)) {
        wsSafeSend(ws, {
          type: "designStampResult",
          ok: false,
          code: "out_of_range",
        } satisfies OutMsg);
        return;
      }
      const placed = placedMap(currentRoomId);
      const plan = planDesignStampInRoom({
        designId,
        wallet: address,
        roomId: currentRoomId,
        bounds: walkBounds(currentRoomId),
        anchorX,
        anchorZ,
        yawSteps,
        placed,
        isWalkable: (x, z) => isWalkableForRoom(currentRoomId, x, z),
        playerOnTile: (x, z) => {
          for (const c of room.values()) {
            const st = snapToTile(c.player.x, c.player.z);
            if (st.x === x && st.z === z) return true;
          }
          return false;
        },
      });
      if (!plan.ok) {
        wsSafeSend(ws, {
          type: "designStampResult",
          ok: false,
          code: plan.code,
        } satisfies OutMsg);
        return;
      }
      for (const key of plan.removals) {
        placed.delete(key);
      }
      const add: ObstacleTile[] = [];
      for (const p of plan.placements) {
        placed.set(p.key, p.props);
        const deltaTile = obstacleTileFromPlaced(currentRoomId, p.key);
        if (deltaTile) add.push(deltaTile);
      }
      if (plan.removals.length > 0 || add.length > 0) {
        broadcast(currentRoomId, {
          type: "obstaclesDelta",
          roomId: currentRoomId,
          add,
          remove: plan.removals,
        });
      }
      schedulePersistWorldState();
      logGameplayEvent(conn.sessionId, address, currentRoomId, "design_stamped", {
        designId: plan.design.id,
        kind: plan.design.kind,
        anchorX,
        anchorZ,
        obstacleCount: add.length,
      });
      recordPrefabStampedByOther(
        plan.design.creatorWallet,
        address,
        plan.design.id,
        plan.design.visibility,
        (wallet, unlocks) => {
          achievementUnlockHandlerForAddress(wallet)(unlocks);
        }
      );
      wsSafeSend(ws, {
        type: "designStampResult",
        ok: true,
        obstacleCount: add.length,
      } satisfies OutMsg);
      return;
    }


    if (msg.type === "placePendingTeleporter") {
      if (!canPlaceBlocksInRoom(currentRoomId, address)) {
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

    if (msg.type === "placePendingGate") {
      if (!canPlaceBlocksInRoom(currentRoomId, address)) {
        return;
      }
      const now = Date.now();
      if (now - conn.lastPlaceAt < RATE_PLACE_MS) return;
      conn.lastPlaceAt = now;
      const tx = Number(msg.x);
      const tz = Number(msg.z);
      const exitDir = Number(msg.exitDir ?? 0);
      const faceDir = Number(msg.faceDir ?? 0);
      const gateColorRgb = colorRgbFromWire({
        colorRgb: msg.colorRgb,
        colorId: msg.colorId ?? 7,
      });
      if (!Number.isFinite(tx) || !Number.isFinite(tz)) return;
      const tile = snapToTile(tx, tz);
      if (!withinBlockActionRange(conn.player, tile.x, tile.z)) return;
      const ok = placePendingGateAt(
        conn,
        currentRoomId,
        tile.x,
        tile.z,
        exitDir,
        faceDir,
        gateColorRgb === DEFAULT_BLOCK_COLOR_RGB
          ? DEFAULT_GATE_BLOCK_COLOR_RGB
          : gateColorRgb
      );
      if (!ok) {
        wsSafeSend(ws, {
          type: "chat",
          from: "System",
          fromAddress: "",
          text: "Could not place gate. Use an empty floor tile on layer 0 within build rules (not canvas); avoid hub spawn tiles, signposts on the gate tile, or other players on the gate or its two neighbor tiles.",
          at: now,
        } satisfies OutMsg);
      }
      return;
    }

    if (msg.type === "openGate") {
      const now = Date.now();
      const gx = Math.round(Number(msg.x));
      const gz = Math.round(Number(msg.z));
      const gy = Math.max(0, Math.min(2, Math.floor(Number(msg.y ?? 0))));
      if (!Number.isFinite(gx) || !Number.isFinite(gz)) return;
      if (!withinBlockActionRange(conn.player, gx, gz)) return;
      if (!isOrthogonallyAdjacentToTile(conn.player.x, conn.player.z, gx, gz)) {
        wsSafeSend(ws, {
          type: "chat",
          from: "System",
          fromAddress: "",
          text: "Stand next to the gate to open it.",
          at: now,
        } satisfies OutMsg);
        return;
      }
      const placed = placedMap(currentRoomId);
      const k = blockKey(gx, gz, gy);
      const v = placed.get(k);
      if (!v?.gate) return;
      const gNorm = normalizeGateConfig(v.gate);
      if (!gNorm) return;
      const whoC = compactAddress(address);
      const inHub = normalizeRoomId(currentRoomId) === HUB_ROOM_ID;
      const authOk =
        inHub ||
        isAdmin(address) ||
        gNorm.authorizedAddresses.some((a) => compactAddress(a) === whoC);
      if (!authOk) {
        wsSafeSend(ws, {
          type: "chat",
          from: "System",
          fromAddress: "",
          text: "You are not allowed to open this gate.",
          at: now,
        } satisfies OutMsg);
        return;
      }
      if (v.gateOpen && now < v.gateOpen.untilMs) return;

      const ex = v.gate.exitX;
      const ez = v.gate.exitZ;
      if (Math.abs(ex - gx) + Math.abs(ez - gz) !== 1) return;
      const frontX = gx * 2 - ex;
      const frontZ = gz * 2 - ez;
      if (Math.abs(frontX - gx) + Math.abs(frontZ - gz) !== 1) return;
      const extra = extraFloorMap(currentRoomId);
      const br = baseRemovedReadonly(currentRoomId);
      const exitWalkable = floorWalkableTerrain(
        ex,
        ez,
        placed,
        extra,
        currentRoomId,
        br
      );
      const frontWalkable = floorWalkableTerrain(
        frontX,
        frontZ,
        placed,
        extra,
        currentRoomId,
        br
      );
      const who = compactAddress(address);

      if (!exitWalkable || !frontWalkable) {
        applyGateOpenForTile(currentRoomId, k, v, who, now);
        recordGatekeeperOpen(
          address,
          gNorm.adminAddress,
          inHub,
          achievementUnlockHandler(ws)
        );
        wsSafeSend(ws, {
          type: "gateWalkBlocked",
          x: gx,
          z: gz,
          y: gy,
        } satisfies OutMsg);
        return;
      }

      applyGateOpenForTile(currentRoomId, k, v, who, now);

      recordGatekeeperOpen(
        address,
        gNorm.adminAddress,
        inHub,
        achievementUnlockHandler(ws)
      );

      const p = conn.player;
      const moverCtx: PathfindMoverContext = { address: who, nowMs: now };
      const startNode = resolvePathfindStartNode(
        currentRoomId,
        p,
        placed,
        moverCtx
      );
      if (!startNode) {
        const cur = placed.get(k);
        if (cur) {
          const { gateOpen: _go, ...rest } = cur;
          placed.set(k, rest as PlacedProps);
          const rb = obstacleTileFromPlaced(currentRoomId, k);
          if (rb) {
            broadcast(currentRoomId, {
              type: "obstaclesDelta",
              roomId: currentRoomId,
              add: [rb],
              remove: [],
            });
          }
          schedulePersistWorldState();
        }
        return;
      }
      const ps = snapToTile(p.x, p.z);
      const onBack = ps.x === ex && ps.z === ez;
      const onFront = ps.x === frontX && ps.z === frontZ;
      const goalX = onBack && !onFront ? frontX : ex;
      const goalZ = onBack && !onFront ? frontZ : ez;

      const full = pathfindTerrain(
        startNode.x,
        startNode.z,
        startNode.layer,
        goalX,
        goalZ,
        0,
        placed,
        extra,
        currentRoomId,
        br,
        moverCtx
      );
      if (!full || full.length < 1) {
        wsSafeSend(ws, {
          type: "gateWalkBlocked",
          x: gx,
          z: gz,
          y: gy,
        } satisfies OutMsg);
        return;
      }
      if (full.length < 2) {
        conn.pathQueue = [];
      } else {
        conn.pathQueue = full.slice(1);
        const onAcl = gNorm.authorizedAddresses.some(
          (a) => compactAddress(a) === whoC
        );
        recordTrustCircleWalk(
          address,
          gNorm.adminAddress,
          onAcl,
          inHub,
          achievementUnlockHandler(ws)
        );
      }
      pendingTickStateBroadcast.add(currentRoomId);
      logGameplayEvent(conn.sessionId, address, currentRoomId, "open_gate", {
        gx,
        gz,
        gy,
        exitX: ex,
        exitZ: ez,
        goalX,
        goalZ,
      });
      return;
    }

    if (msg.type === "setGateAuthorizedAddresses") {
      if (!canPlaceBlocksInRoom(currentRoomId, address)) return;
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
      if (!entry?.props.gate) return;
      const existing = entry.props;
      if (existing.locked && !isAdmin(address)) {
        wsSafeSend(ws, { type: "error", code: "object_locked" });
        return;
      }
      const gateRaw = existing.gate;
      if (!gateRaw) return;
      const gPrev = normalizeGateConfig(gateRaw);
      if (!gPrev) return;
      const requesterC = compactAddress(address);
      const canEditAcl =
        isAdmin(address) || requesterC === gPrev.adminAddress;
      if (!canEditAcl) {
        wsSafeSend(ws, {
          type: "chat",
          from: "System",
          fromAddress: "",
          text: "Only the gate owner or a server admin can change who may open this gate.",
          at: now,
        } satisfies OutMsg);
        return;
      }
      const raw = msg.addresses;
      if (!Array.isArray(raw) || raw.length === 0) {
        wsSafeSend(ws, {
          type: "chat",
          from: "System",
          fromAddress: "",
          text: "Provide at least one wallet allowed to open the gate.",
          at: now,
        } satisfies OutMsg);
        return;
      }
      let next: string[] = [];
      for (const a of raw) {
        const c = compactAddress(String(a));
        if (c) next.push(c);
      }
      next = [...new Set(next)].slice(0, GATE_AUTH_MAX);
      if (next.length === 0) return;
      if (!next.includes(gPrev.adminAddress)) {
        wsSafeSend(ws, {
          type: "chat",
          from: "System",
          fromAddress: "",
          text: "The gate owner must stay on the access list.",
          at: now,
        } satisfies OutMsg);
        return;
      }
      const inRoom = humanCompactAddressesInRoom(currentRoomId);
      const prevSet = new Set(gPrev.authorizedAddresses);
      const strictRoom = !isAdmin(address);
      for (const a of next) {
        if (prevSet.has(a)) continue;
        if (strictRoom && !inRoom.has(a)) {
          wsSafeSend(ws, {
            type: "chat",
            from: "System",
            fromAddress: "",
            text: "You can only add players who are currently in this room.",
            at: now,
          } satisfies OutMsg);
          return;
        }
      }
      const { key: storageKey } = entry;
      const canonicalKey = blockKey(tile.x, tile.z, ty);
      if (storageKey !== canonicalKey) {
        placed.delete(storageKey);
      }
      const nextProps: PlacedProps = {
        ...existing,
        gate: {
          adminAddress: gPrev.adminAddress,
          authorizedAddresses: next,
          exitX: gPrev.exitX,
          exitZ: gPrev.exitZ,
        },
      };
      placed.set(canonicalKey, nextProps);
      const deltaGate = obstacleTileFromPlaced(currentRoomId, canonicalKey);
      if (deltaGate) {
        broadcast(currentRoomId, {
          type: "obstaclesDelta",
          roomId: currentRoomId,
          add: [deltaGate],
          remove: storageKey !== canonicalKey ? [storageKey] : [],
        });
      }
      schedulePersistWorldState();
      logGameplayEvent(conn.sessionId, address, currentRoomId, "set_gate_acl", {
        x: tile.x,
        z: tile.z,
        y: ty,
        count: next.length,
      });
      return;
    }

    if (msg.type === "configureTeleporter") {
      if (!canPlaceBlocksInRoom(currentRoomId, address)) {
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
            text: "Could not set teleporter destination. Check room id, walkable tile in bounds, and that you can edit that room.",
            at: now,
          } satisfies OutMsg);
      } else {
        recordTeleporterActivated(address, achievementUnlockHandler(ws));
      }
      return;
    }

    if (msg.type === "placeTeleporterBidirectionalPair") {
      if (!canPlaceBlocksInRoom(currentRoomId, address)) {
        return;
      }
      const now = Date.now();
      if (now - conn.lastPlaceAt < RATE_PLACE_MS) return;
      conn.lastPlaceAt = now;
      const tx = Number(msg.x);
      const tz = Number(msg.z);
      const ty = Math.max(0, Math.min(2, Math.floor(Number(msg.y ?? 0))));
      let destX = Number(msg.destX);
      let destZ = Number(msg.destZ);
      if (!Number.isFinite(tx) || !Number.isFinite(tz)) return;
      if (!Number.isFinite(destX) || !Number.isFinite(destZ)) return;
      const tile = snapToTile(tx, tz);
      const dt = snapToTile(destX, destZ);
      if (!withinBlockActionRange(conn.player, tile.x, tile.z)) return;
      if (!withinBlockActionRange(conn.player, dt.x, dt.z)) return;
      const ok = placeBidirectionalTeleporterPairAt(
        conn,
        currentRoomId,
        tile.x,
        tile.z,
        ty,
        dt.x,
        dt.z
      );
      if (!ok) {
        wsSafeSend(ws, {
          type: "chat",
          from: "System",
          fromAddress: "",
          text: "Could not place linked teleporter. Use a different empty walkable floor tile in this room (not on a player).",
          at: now,
        } satisfies OutMsg);
      } else {
        recordTeleporterActivated(address, achievementUnlockHandler(ws));
      }
      return;
    }

    if (msg.type === "setObstacleProps") {
      if (!canPlaceBlocksInRoom(currentRoomId, address)) {
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
      const colorRgb = colorRgbFromWire(msg);
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
      const hexRadiusScale = prism.hex
        ? clampHexRadiusScale(
            Number(
              msg.hexRadiusScale ??
                (msg as { hexHeightScale?: number }).hexHeightScale ??
                existing.hexRadiusScale ??
                (existing as { hexHeightScale?: number }).hexHeightScale ??
                1
            )
          )
        : 1;
      const sphereRadiusScale = prism.sphere
        ? clampSphereRadiusScale(
            Number(msg.sphereRadiusScale ?? existing.sphereRadiusScale ?? 1)
          )
        : 1;
      const cubeRot = cubeRotationForPlainCube(prism, {
        ...existing,
        ...(msg as TerrainProps),
      });
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

      if (existing.gate && ty === 0) {
        const gx = tile.x;
        const gz = tile.z;
        const rawExit = Number(msg.gateExitDir);
        let exitIdx = 0;
        if (Number.isFinite(rawExit)) {
          exitIdx = Math.max(0, Math.min(3, Math.floor(rawExit)));
        } else {
          const g = existing.gate;
          const edx = g.exitX - gx;
          const edz = g.exitZ - gz;
          for (let i = 0; i < 4; i++) {
            const d = CARDINAL_DIRS[i]!;
            if (d[0] === edx && d[1] === edz) {
              exitIdx = i;
              break;
            }
          }
        }
        const [gdx, gdz] = CARDINAL_DIRS[exitIdx]!;
        const ex = gx + gdx;
        const ez = gz + gdz;
        if (
          !gateExitNeighborLayoutValid(
            currentRoomId,
            gx,
            gz,
            ex,
            ez,
            compactAddress(address)
          )
        ) {
          wsSafeSend(ws, {
            type: "chat",
            from: "System",
            fromAddress: "",
            text: "Could not update gate. Keep a cardinal opening direction; avoid hub spawn tiles, a signpost on the gate tile, or other players on the gate or its exit/front tiles.",
            at: now,
          } satisfies OutMsg);
          return;
        }
        const swingDir = Math.max(
          0,
          Math.min(3, Math.floor(Number(msg.rampDir ?? existing.rampDir ?? 0)))
        );
        const nextColor = colorRgbFromWire({
          colorRgb: msg.colorRgb,
          colorId:
            msg.colorId !== undefined
              ? msg.colorId
              : existing.colorId,
        });
        const gNorm = normalizeGateConfig(existing.gate);
        if (!gNorm) return;
        const nextProps: PlacedProps = {
          passable: false,
          half: false,
          quarter: false,
          hex: false,
          pyramid: false,
          pyramidBaseScale: 1,
          hexRadiusScale: 1,
          sphere: false,
          sphereRadiusScale: 1,
          ramp: false,
          rampDir: swingDir,
          colorRgb: nextColor,
          locked: finalLocked,
          gate: {
            adminAddress: gNorm.adminAddress,
            authorizedAddresses: [...gNorm.authorizedAddresses],
            exitX: ex,
            exitZ: ez,
          },
          ...(existing.claimable !== undefined ? { claimable: existing.claimable } : {}),
          ...(existing.active !== undefined ? { active: existing.active } : {}),
          ...(existing.cooldownMs !== undefined ? { cooldownMs: existing.cooldownMs } : {}),
          ...(existing.lastClaimedAt !== undefined ? { lastClaimedAt: existing.lastClaimedAt } : {}),
          ...(existing.claimReactivateAtMs !== undefined
            ? { claimReactivateAtMs: existing.claimReactivateAtMs }
            : {}),
          ...(existing.claimedBy !== undefined ? { claimedBy: existing.claimedBy } : {}),
        };
        placed.set(canonicalKey, nextProps);
        const deltaGate = obstacleTileFromPlaced(currentRoomId, canonicalKey);
        if (deltaGate) {
          broadcast(currentRoomId, {
            type: "obstaclesDelta",
            roomId: currentRoomId,
            add: [deltaGate],
            remove: storageKey !== canonicalKey ? [storageKey] : [],
          });
        }
        schedulePersistWorldState();
        logGameplayEvent(conn.sessionId, address, currentRoomId, "set_gate_props", {
          x: tile.x,
          z: tile.z,
          y: ty,
          exitX: ex,
          exitZ: ez,
          swingDir,
          colorRgb: nextColor,
        });
        return;
      }

      // Claimable (gold / mineable) edit. By default preserve the block's claim
      // state so unrelated edits (color, shape, collision) don't disturb it.
      // Turning it on or off is gated like placement (admins / reward wallet).
      const preserveClaim: Partial<PlacedProps> = {
        ...(existing.claimable !== undefined ? { claimable: existing.claimable } : {}),
        ...(existing.active !== undefined ? { active: existing.active } : {}),
        ...(existing.cooldownMs !== undefined ? { cooldownMs: existing.cooldownMs } : {}),
        ...(existing.lastClaimedAt !== undefined ? { lastClaimedAt: existing.lastClaimedAt } : {}),
        ...(existing.claimReactivateAtMs !== undefined
          ? { claimReactivateAtMs: existing.claimReactivateAtMs }
          : {}),
        ...(existing.claimedBy !== undefined ? { claimedBy: existing.claimedBy } : {}),
      };
      let claimFields: Partial<PlacedProps> = preserveClaim;
      let finalPassable = passable;
      if (msg.claimable === true && !existing.claimable) {
        if (canPlaceMineableBlocks(address)) {
          claimFields = { claimable: true, active: true, cooldownMs: 60000 };
        } else {
          wsSafeSend(ws, {
            type: "chat",
            from: "System",
            fromAddress: "SYSTEM",
            text: "Only admins or the authorized reward wallet can place mineable blocks.",
            at: now,
          } satisfies OutMsg);
        }
      } else if (msg.claimable === false && existing.claimable) {
        // Only authorized wallets may strip a block's gold/mineable state.
        if (canPlaceMineableBlocks(address)) {
          claimFields = {};
        }
      }
      // Mineable blocks must stay solid so they can be mined.
      if (claimFields.claimable) finalPassable = false;

      placed.set(canonicalKey, {
        passable: finalPassable,
        half,
        quarter,
        hex: prism.hex,
        pyramid: prism.pyramid,
        pyramidBaseScale,
        hexRadiusScale,
        sphere: prism.sphere,
        sphereRadiusScale,
        ramp: prism.ramp,
        rampDir: prism.ramp ? rampDir : 0,
        ...cubeRot,
        colorRgb,
        locked: finalLocked,
        ...(existing.teleporter ? { teleporter: existing.teleporter } : {}),
        ...claimFields,
        ...(existing.gate ? { gate: existing.gate } : {}),
        ...(existing.gateOpen ? { gateOpen: existing.gateOpen } : {}),
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
        colorRgb,
      });
      return;
    }

    if (msg.type === "removeObstacle") {
      if (!canPlaceBlocksInRoom(currentRoomId, address)) {
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
        const tp = props.teleporter;
        const peerRem =
          tp && !("pending" in tp && tp.pending)
            ? deleteTeleporterPeerIfLinked(placed, tp)
            : [];
        placed.delete(k);
        const baseRem = k !== clientKey ? [k, clientKey] : [clientKey];
        const remove = [...new Set([...baseRem, ...peerRem])];
        broadcast(currentRoomId, {
          type: "obstaclesDelta",
          roomId: currentRoomId,
          add: [],
          remove,
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
      if (!canPlaceBlocksInRoom(currentRoomId, address)) {
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
              hexRadiusScale: 1,
              sphere: false,
              sphereRadiusScale: 1,
              ramp: false,
              rampDir: 0,
              colorRgb: BLOCK_COLOR_BILLBOARD_SLAB_RGB,
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
            hexRadiusScale: 1,
            sphere: false,
            sphereRadiusScale: 1,
            ramp: false,
            rampDir: 0,
            colorRgb: BLOCK_COLOR_BILLBOARD_SLAB_RGB,
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

      if (props.teleporter) {
        const tp = props.teleporter;
        if (
          tp &&
          "pairedPeerKey" in tp &&
          typeof tp.pairedPeerKey === "string" &&
          tp.pairedPeerKey
        ) {
          const movedPair = moveLinkedTeleporterPairAt(
            conn,
            currentRoomId,
            room,
            from.x,
            from.z,
            fy,
            to.x,
            to.z,
            ty,
            fk,
            fromClientKey,
            props
          );
          if (movedPair) return;
          return;
        }
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
      let movedProps: PlacedProps = { ...props };
      if (movedProps.gate) {
        const dx = to.x - from.x;
        const dz = to.z - from.z;
        movedProps = {
          ...movedProps,
          gate: {
            ...movedProps.gate,
            exitX: movedProps.gate.exitX + dx,
            exitZ: movedProps.gate.exitZ + dz,
          },
        };
        const { gateOpen: _gone, ...noOpen } = movedProps;
        movedProps = noOpen;
      }
      placed.set(destKey, movedProps);

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
      if (conn.streamObserver) return;
      if (!canRecolorFloorInRoom(currentRoomId, address)) {
        return;
      }

      const now = Date.now();
      if (now - conn.lastPlaceAt < RATE_PLACE_MS) return;
      conn.lastPlaceAt = now;
      const tx = Number(msg.x);
      const tz = Number(msg.z);
      if (!Number.isFinite(tx) || !Number.isFinite(tz)) return;
      const anchor = snapToTile(tx, tz);
      const colorRgb = resolveExtraFloorColorRgb(
        (msg as { colorRgb?: unknown }).colorRgb
      );
      const brushSize = parseFloorBrushSize(
        (msg as { brushSize?: unknown }).brushSize
      );
      const tiles =
        brushSize === 1
          ? [anchor]
          : floorBrushTiles(anchor.x, anchor.z, brushSize);

      const extraAdds: { x: number; z: number; colorRgb: number }[] = [];
      const baseAdds: { x: number; z: number; colorRgb: number }[] = [];
      const restoredBase: string[] = [];
      let pixelsPainted = 0;

      for (const tile of tiles) {
        if (!withinFloorActionRange(conn.player, tile.x, tile.z)) continue;
        const outcome = applyPlaceExtraFloorAtTile(
          currentRoomId,
          room,
          address,
          tile,
          colorRgb
        );
        switch (outcome.kind) {
          case "none":
            break;
          case "restore_base":
            restoredBase.push(outcome.key);
            logGameplayEvent(
              conn.sessionId,
              address,
              currentRoomId,
              "restore_base_floor",
              { x: outcome.x, z: outcome.z }
            );
            break;
          case "recolor_extra":
            extraAdds.push({
              x: outcome.x,
              z: outcome.z,
              colorRgb: outcome.colorRgb,
            });
            logGameplayEvent(
              conn.sessionId,
              address,
              currentRoomId,
              "recolor_extra_floor",
              { x: outcome.x, z: outcome.z }
            );
            trackFloorRecolorAchievement(
              address,
              currentRoomId,
              outcome.x,
              outcome.z,
              outcome.colorRgb,
              ws
            );
            break;
          case "recolor_base":
            baseAdds.push({
              x: outcome.x,
              z: outcome.z,
              colorRgb: outcome.colorRgb,
            });
            logGameplayEvent(
              conn.sessionId,
              address,
              currentRoomId,
              "recolor_base_floor",
              { x: outcome.x, z: outcome.z, colorRgb: outcome.colorRgb }
            );
            if (isPixelRoom(currentRoomId)) {
              const painters = pixelTilePainterMap(currentRoomId);
              recordPixelPaintAchievements(
                address,
                outcome.x,
                outcome.z,
                outcome.colorRgb,
                painters,
                otherPresentWalletsInRoom(room, address),
                achievementUnlockHandler(ws)
              );
              painters.set(tileKey(outcome.x, outcome.z), compactAddress(address));
              logPixelPaint(outcome.x, outcome.z, outcome.colorRgb, address);
              invalidatePixelBoardPngCache();
              pixelsPainted += 1;
            } else {
              trackFloorRecolorAchievement(
                address,
                currentRoomId,
                outcome.x,
                outcome.z,
                outcome.colorRgb,
                ws
              );
            }
            break;
          case "place_extra":
            extraAdds.push({
              x: outcome.x,
              z: outcome.z,
              colorRgb: outcome.colorRgb,
            });
            logGameplayEvent(
              conn.sessionId,
              address,
              currentRoomId,
              "place_extra_floor",
              { x: outcome.x, z: outcome.z }
            );
            trackFloorRecolorAchievement(
              address,
              currentRoomId,
              outcome.x,
              outcome.z,
              outcome.colorRgb,
              ws
            );
            break;
        }
      }

      const changed =
        extraAdds.length > 0 ||
        baseAdds.length > 0 ||
        restoredBase.length > 0;
      if (!changed) return;

      if (pixelsPainted > 0) {
        recordPixelPainted(
          address,
          pixelsPainted,
          achievementUnlockHandler(ws)
        );
      }

      if (restoredBase.length > 0) {
        broadcast(currentRoomId, {
          type: "removedBaseFloorDelta",
          roomId: currentRoomId,
          add: [],
          remove: restoredBase,
        });
      }
      if (extraAdds.length > 0) {
        broadcast(currentRoomId, {
          type: "extraFloorDelta",
          roomId: currentRoomId,
          add: extraAdds,
          remove: [],
        });
      }
      if (baseAdds.length > 0) {
        broadcast(currentRoomId, {
          type: "baseFloorColorDelta",
          roomId: currentRoomId,
          add: baseAdds,
          remove: [],
        });
      }
      schedulePersistWorldState();
      return;
    }

    if (msg.type === "removeExtraFloor") {
      if (conn.streamObserver) return;
      if (isPixelRoom(currentRoomId)) return;
      if (!canRecolorFloorInRoom(currentRoomId, address)) {
        return;
      }
      const now = Date.now();
      if (now - conn.lastPlaceAt < RATE_PLACE_MS) return;
      conn.lastPlaceAt = now;
      const tx = Number(msg.x);
      const tz = Number(msg.z);
      if (!Number.isFinite(tx) || !Number.isFinite(tz)) return;
      const tile = snapToTile(tx, tz);
      if (!withinFloorActionRange(conn.player, tile.x, tile.z)) return;
      const k = tileKey(tile.x, tile.z);
      const ex = extraFloorMap(currentRoomId);
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
        baseFloorColorMap(currentRoomId).delete(k);
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
      if (msg.bubbleOnly) return;
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
      const censored = censorChat(text);
      if (isEmptyAfterCensor(censored.censored)) {
        wsSafeSend(ws, { type: "error", code: "chat_blocked_profanity" } satisfies OutMsg);
        return;
      }
      text = censored.censored;
      const hadTyping = conn.chatTyping;
      conn.chatTyping = false;
      const audienceLive = liveChatAudienceInRoom(currentRoomId);
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
      logGameplayEvent(conn.sessionId, address, currentRoomId, ANALYTICS_EVENT_KINDS.chat, {
        text,
        at: now,
        displayName: conn.displayName,
        audienceLive,
        ...(censored.wasFiltered && censored.original
          ? { textOriginal: censored.original }
          : {}),
      });
      recordChatMessageSent(address, achievementUnlockHandler(ws));
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

      const claimDenied = blockClaimAccessDeniedReason(address);
      if (claimDenied) {
        wsSafeSend(ws, {
            type: "blockClaimResult",
            ok: false,
            recoverable: claimDenied !== BLOCK_CLAIM_MSG_GUEST,
            reason: claimDenied,
          } satisfies OutMsg);
        return;
      }

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
        recordMineCooldownAttempt(address, achievementUnlockHandler(ws));
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

      const rawCi = (msg as { claimIntent?: unknown }).claimIntent;
      let claimIntent: string | undefined;
      if (typeof rawCi === "string") {
        const t = rawCi
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, "")
          .slice(0, 48);
        if (t) claimIntent = t;
      }

      const holdMs =
        claimIntent && BLOCK_CLAIM_CONTEXT_MENU_MINE_INTENTS.has(claimIntent)
          ? Math.round(BLOCK_CLAIM_HOLD_MS * 1.5)
          : BLOCK_CLAIM_HOLD_MS;

      blockClaimSessions.set(claimId, {
        address,
        roomId: currentRoomId,
        tileX: tile.x,
        tileZ: tile.z,
        tileY,
        startedAt: now,
        completeBy,
        holdMsRequired: holdMs,
        accumAdjacentMs: 0,
        lastSampleAt: 0,
        ...(claimIntent ? { claimIntent } : {}),
      });
      blockClaimReservation.set(rk, {
        claimId,
        address,
        until: completeBy,
      });
      conn.pendingBlockClaimId = claimId;

      logGameplayEvent(
        conn.sessionId,
        address,
        currentRoomId,
        ANALYTICS_EVENT_KINDS.beginBlockClaim,
        {
          x: tile.x,
          z: tile.z,
          y: tileY,
          claimId,
          ...(claimIntent ? { claimIntent } : {}),
        }
      );

      wsSafeSend(ws, {
        type: "blockClaimOffered",
        claimId,
        x: tile.x,
        z: tile.z,
        ...(tileY !== 0 ? { y: tileY } : {}),
        holdMs,
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

      const claimDenied = blockClaimAccessDeniedReason(address);
      if (claimDenied) {
        wsSafeSend(ws, {
            type: "blockClaimResult",
            ok: false,
            recoverable: claimDenied !== BLOCK_CLAIM_MSG_GUEST,
            reason: claimDenied,
          } satisfies OutMsg);
        return;
      }

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

      if (s.accumAdjacentMs < s.holdMsRequired) {
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
      if (isPayoutSenderConfigured()) {
        try {
          const peek = peekPayoutBalanceCacheLuna();
          if (NIM_CLAIM_BALANCE_PEEK_MAX_MS > 0 && peek !== null) {
            payoutHasFunds = peek.luna >= CLAIM_REWARD_MIN_LUNA;
          } else {
            const payoutBalanceLuna = await getPayoutWalletBalanceLuna();
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
      recordBlockMined(address, achievementUnlockHandler(ws));
      if (s.claimIntent === "direct_adjacent_click") {
        recordImpatientMiner(address, achievementUnlockHandler(ws));
      }
      schedulePersistWorldState();
      return;
    }

    if (msg.type === "placeSignboard") {
      if (!canPlaceBlocksInRoom(currentRoomId, address)) {
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
      recordSignpostPlaced(address, message, achievementUnlockHandler(ws));
      
      // Place a passable half-height block as the signboard visual
      placed.set(k, {
        passable: true,
        half: true,
        quarter: false,
        hex: false,
        pyramid: false,
        pyramidBaseScale: 1,
        hexRadiusScale: 1,
        sphere: false,
        sphereRadiusScale: 1,
        ramp: false,
        rampDir: 0,
        colorRgb: BLOCK_COLOR_SIGNPOST_RGB,
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
      if (!canPlaceBlocksInRoom(currentRoomId, address)) {
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
      const rotationSetId = String(rawMsg.rotationSetId ?? "").trim();
      let advertIds: string[] = [];
      let slides: string[] = [];
      let intervalMs: number;
      let visitName: string;
      let visitUrl: string;
      let miniappTargetUrl: string | undefined;
      let rotationMeta:
        | {
            rotationSetId: string;
            rotationRevision: number;
            slideDurationsMs: number[];
            slideVisitNames: string[];
            slideVisitUrls: string[];
            slideMiniappTargetUrls: string[];
            slideCampaignIds: string[];
            advertIds: string[];
            billboardKind: "rotation_set";
          }
        | undefined;

      if (rotationSetId) {
        if (!getRotationSetById(rotationSetId)) {
          wsSafeSend(ws, { type: "error", code: "invalid_rotation_set" });
          return;
        }
        const compiled = compileRotationSet(rotationSetId);
        if (!compiled) {
          wsSafeSend(ws, { type: "error", code: "invalid_rotation_set" });
          return;
        }
        slides = compiled.slides;
        advertIds = compiled.advertIds;
        intervalMs = compiled.intervalMs;
        visitName = compiled.visitName;
        visitUrl = compiled.visitUrl;
        miniappTargetUrl = compiled.miniappTargetUrl;
        rotationMeta = {
          rotationSetId: compiled.setId,
          rotationRevision: compiled.revision,
          slideDurationsMs: compiled.slideDurationsMs,
          slideVisitNames: compiled.slideVisitNames,
          slideVisitUrls: compiled.slideVisitUrls,
          slideMiniappTargetUrls: compiled.slideMiniappTargetUrls,
          slideCampaignIds: compiled.slideCampaignIds,
          advertIds: compiled.advertIds,
          billboardKind: "rotation_set",
        };
      } else if (liveChart) {
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
        miniappTargetUrl =
          String(first?.miniappTargetUrl ?? "").trim() || undefined;
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
        rotationMeta
          ? {
              advertId: rotationMeta.advertIds[0],
              advertIds: rotationMeta.advertIds,
              visitName,
              visitUrl,
              miniappTargetUrl,
              slideshowEpochMs: now,
              rotationSetId: rotationMeta.rotationSetId,
              rotationRevision: rotationMeta.rotationRevision,
              slideDurationsMs: rotationMeta.slideDurationsMs,
              slideVisitNames: rotationMeta.slideVisitNames,
              slideVisitUrls: rotationMeta.slideVisitUrls,
              slideMiniappTargetUrls: rotationMeta.slideMiniappTargetUrls,
              slideCampaignIds: rotationMeta.slideCampaignIds,
              billboardKind: rotationMeta.billboardKind,
            }
          : liveChart
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
              miniappTargetUrl,
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
          hexRadiusScale: 1,
          sphere: false,
          sphereRadiusScale: 1,
          ramp: false,
          rampDir: 0,
          colorRgb: BLOCK_COLOR_BILLBOARD_SLAB_RGB,
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
      if (!canPlaceBlocksInRoom(currentRoomId, address)) {
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
      let miniappTargetUrl: string | undefined;

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
        miniappTargetUrl =
          String(first?.miniappTargetUrl ?? "").trim() || undefined;
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
                miniappTargetUrl,
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
          hexRadiusScale: 1,
          sphere: false,
          sphereRadiusScale: 1,
          ramp: false,
          rampDir: 0,
          colorRgb: BLOCK_COLOR_BILLBOARD_SLAB_RGB,
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
              miniappTargetUrl,
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
      const signboardId = String(msg.signboardId ?? "");
      const message = String(msg.message ?? "").trim();
      if (!signboardId || !message || message.length > SIGNBOARD_MESSAGE_MAX_LEN) {
        wsSafeSend(ws, { type: "error", code: "invalid_message" });
        return;
      }
      const sb = getSignboardById(signboardId);
      if (!sb || sb.roomId !== currentRoomId) {
        wsSafeSend(ws, { type: "error", code: "signboard_not_found" });
        return;
      }
      const ownerKey = compactAddress(sb.createdBy);
      const signerKey = compactAddress(address);
      if (!isAdmin(address) && ownerKey !== signerKey) {
        wsSafeSend(ws, { type: "error", code: "not_signboard_owner" });
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
      if (!canPlaceBlocksInRoom(currentRoomId, address) || !isAdmin(address)) {
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
      if (!canPlaceBlocksInRoom(currentRoomId, address) || !isAdmin(address)) {
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
      if (!canPlaceBlocksInRoom(currentRoomId, address)) {
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
    // worldcup: leaving mid-Match forfeits to the opponent (declared the winner immediately).
    if (WORLDCUP_ENABLED && conn.matchId) {
      worldcupHandlePlayerDeparture(address);
      conn.matchId = null;
    }
    // worldcup: leaving during the pre-teleport countdown aborts the pending Match.
    if (WORLDCUP_ENABLED && conn.pendingMatchId) {
      worldcupAbortPending(address);
    }
    // worldcup: a Spectator disconnecting frees a stand slot - refresh the portal's full state.
    if (WORLDCUP_ENABLED && conn.spectatingMatchId) {
      const sm = worldcupMatches.get(conn.spectatingMatchId);
      conn.spectatingMatchId = null;
      if (sm) worldcupBroadcastPortal(sm);
    }
    // Find which room the player is currently in
    const playerCurrentRoom = findPlayerRoom(address);
    if (playerCurrentRoom) {
      endSession(conn.sessionId, address, playerCurrentRoom, conn.sessionStartedAt);
      if (!conn.streamObserver) {
        setPlayerLastSession(compactAddress(address), {
          roomId: playerCurrentRoom,
          x: conn.player.x,
          z: conn.player.z,
          y: conn.player.y,
          disconnectedAt: Date.now(),
        });
        if (normalizeRoomId(playerCurrentRoom) !== CHAMBER_ROOM_ID) {
          spawnMap(playerCurrentRoom).set(address, {
            x: conn.player.x,
            z: conn.player.z,
            y: conn.player.y,
          });
          schedulePersistWorldState();
        }
      }
      const room = roomOf(playerCurrentRoom);
      room.delete(address);
      console.log(
        `[rooms] disconnect ${address.slice(0, 12)}… room=${playerCurrentRoom}${conn.streamObserver ? " streamObserver" : ""}`
      );
      if (!conn.streamObserver) {
        broadcast(playerCurrentRoom, { type: "playerLeft", address });
        broadcastOnlineCount();
      }
      if (room.size === 0) clearFakePlayers(playerCurrentRoom);
    }
    // directInvite: detach from any Play Space (after the room delete above, so the empty
    // check sees this socket as gone) and tear the space down once it is empty.
    if (DIRECT_INVITE_ENABLED && conn.directInviteSlug) {
      directInviteOnDisconnect(conn);
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

/** Place a paid mini-app campaign billboard (server-side fulfillment; bypasses admin WS gate). */
export function placePaidCampaignBillboard(opts: {
  campaignId: string;
  ownerWallet: string;
  roomId: string;
  anchorX: number;
  anchorZ: number;
  projectName: string;
  miniappTargetUrl: string;
  imageUrl: string;
  durationMs: number;
}): { ok: true; billboardId: string } | { ok: false; error: string } {
  const roomId = normalizeRoomId(opts.roomId);
  const anchorX = Math.floor(opts.anchorX);
  const anchorZ = Math.floor(opts.anchorZ);
  const orientation: BillboardOrientation = "horizontal";
  const yawSteps = 0;
  const slides = [opts.imageUrl.trim()];
  if (!slides[0]) return { ok: false, error: "invalid_image_url" };

  const footprintProbe: Billboard = {
    id: "_campaign_probe",
    roomId,
    anchorX,
    anchorZ,
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
    normalizeRoomId(roomId) === HUB_ROOM_ID &&
    footTiles.some((t) => isHubSpawnSafeZone(t.x, t.z))
  ) {
    return { ok: false, error: "slot_in_spawn_safe_zone" };
  }
  const placed = placedMap(roomId);
  for (const { x: fx, z: fz } of footTiles) {
    if (!isWalkableForRoom(roomId, fx, fz)) {
      return { ok: false, error: "slot_not_walkable" };
    }
    if (getPlacedAtLevel(placed, fx, fz, 0)) {
      return { ok: false, error: "slot_occupied" };
    }
    if (getSignboardAt(roomId, fx, fz)) {
      return { ok: false, error: "slot_occupied" };
    }
    if (getBillboardAtTile(roomId, fx, fz)) {
      return { ok: false, error: "slot_occupied" };
    }
  }
  if (
    hasBillboardFootprintConflict(
      roomId,
      anchorX,
      anchorZ,
      orientation,
      undefined,
      yawSteps
    )
  ) {
    return { ok: false, error: "slot_footprint_conflict" };
  }

  const now = Date.now();
  const visitName = String(opts.projectName ?? "").trim() || "Mini-app";
  const miniappTargetUrl = String(opts.miniappTargetUrl ?? "").trim();
  const billboard = createBillboard(
    roomId,
    anchorX,
    anchorZ,
    orientation,
    yawSteps,
    slides,
    8000,
    opts.ownerWallet,
    {
      visitName,
      visitUrl: miniappTargetUrl,
      miniappTargetUrl,
      campaignId: opts.campaignId,
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
      hexRadiusScale: 1,
      sphere: false,
      sphereRadiusScale: 1,
      ramp: false,
      rampDir: 0,
      colorRgb: BLOCK_COLOR_BILLBOARD_SLAB_RGB,
    });
    const deltaTile = obstacleTileFromPlaced(roomId, k);
    if (deltaTile) addTiles.push(deltaTile);
  }
  broadcast(roomId, {
    type: "billboards",
    roomId,
    billboards: getBillboardsForRoom(roomId).map(billboardToWire),
  });
  broadcast(roomId, {
    type: "obstaclesDelta",
    roomId,
    add: addTiles,
    remove: [],
  });
  schedulePersistWorldState();
  return { ok: true, billboardId: billboard.id };
}

/** Remove a campaign-owned billboard and its floor footprint (expiry / admin). */
export function removePaidCampaignBillboardById(
  billboardId: string
): boolean {
  const bb = getBillboardById(billboardId);
  if (!bb) return false;
  const roomId = bb.roomId;
  const placed = placedMap(roomId);
  const footprints = footprintTileCoords(bb);
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
  deleteBillboard(bb.id);
  const uniq = [...new Set(removeKeys)];
  broadcast(roomId, {
    type: "obstaclesDelta",
    roomId,
    add: [],
    remove: uniq,
  });
  broadcast(roomId, {
    type: "billboards",
    roomId,
    billboards: getBillboardsForRoom(roomId).map(billboardToWire),
  });
  schedulePersistWorldState();
  return true;
}
