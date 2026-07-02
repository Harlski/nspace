import type Database from "better-sqlite3";
import { initCampaignStore, getCampaignDatabase } from "./campaignStore.js";
import {
  ACHIEVEMENT_COLLECTION,
  ACHIEVEMENT_DEFINITIONS,
  ACHIEVEMENT_REWARD_CATALOG,
  COMMONS_ROOM_ID,
  type AchievementCounterKey,
  type AchievementDefinition,
  type AchievementEventKey,
  getAchievementDefinition,
  isWorldCupAchievementCounter,
  isWorldCupAchievementEvent,
  listAchievementsForCounter,
  listAchievementsForDedupePrefix,
  listAchievementsForEvent,
  listAchievementsForStreakCounter,
  listDailySetAchievements,
  listLoginStreakAchievements,
  listApThresholdAchievements,
  RAINBOW_FLOOR_ACHIEVEMENT_ID,
  ROOM_FURNISHER_ACHIEVEMENT_ID,
  ROOM_MAKER_DELUXE_ACHIEVEMENT_ID,
  SOCIAL_LOGIN_TOP_ACHIEVEMENT_ID,
  SUNNY_SIDE_UP_ACHIEVEMENT_ID,
} from "./achievementDefinitions.js";
import {
  evaluateMatchAchievementsForParticipant,
  type MatchEndParticipantInput,
  type MatchWinReason,
  type MatchParticipantResult,
} from "./matchAchievementEvaluator.js";
import {
  computeDistinctTileCredits,
  computeOutfieldTileCredits,
  countGrandTourProgress,
  EXPLORATION_DOOR_SEEN_PREFIX,
  EXPLORATION_ROOM_SEEN_PREFIX,
  formatGrandTourVisitedKeys,
  grandTourKeyForRoom,
  GRAND_TOUR_DAILY_STATE_KEY,
  MARATHON_TILE_SEEN_PREFIX,
  OUTFIELD_TILE_SEEN_PREFIX,
  parseGrandTourVisitedKeys,
  resolveBuiltinDoorSeenKeyFromSpawn,
  explorationRoomSeenKey,
  teleporterDestinationSeenKey,
  teleporterPortalDoorSeenKey,
  TELEPORTER_DEST_SEEN_PREFIX,
} from "./explorationAchievementEvaluator.js";
import {
  computeFieldGoalDailyStreakUpdate,
} from "./fieldGoalAchievementEvaluator.js";
import {
  FLOOR_RECOLOR_SEEN_PREFIX,
  floorRecolorSeenKey,
  formatRoomDeluxeProgress,
  formatRoomFurnisherProgress,
  hueBucketFromColorRgb,
  isPalettePainterEligibleRoom,
  isRoomDeluxeComplete,
  isRoomFurnisherComplete,
  parseRoomDeluxeProgress,
  parseRoomFurnisherProgress,
  PREFAB_ADOPTION_SEEN_PREFIX,
  prefabAdoptionSeenKey,
  RAINBOW_FLOOR_HUE_THRESHOLD,
  RAINBOW_HUE_SEEN_PREFIX,
  rainbowHueSeenKey,
  recordRoomFurnisherHueBucket,
  roomDeluxeMetRequirements,
  roomDeluxeStateKey,
  roomFurnisherMetRequirements,
  roomFurnisherStateKey,
  ROOM_DELUXE_LIFETIME_DAY,
  ROOM_DELUXE_REQUIREMENT_COUNT,
  shapeSeenKey,
  SIGNPOST_READ_SEEN_PREFIX,
  signpostReadSeenKey,
  terrainShapeKindFromPrism,
  type RoomDeluxeProgress,
} from "./worldcraftAchievementEvaluator.js";
import {
  isPixelCollaboratorPaint,
  monochromeHueKey,
  parseMonochromeHueKey,
  PIXEL_CORNER_SEEN_PREFIX,
  pixelCornerIdForTile,
  pixelCornerSeenKey,
} from "./miningPixelAchievementEvaluator.js";
import {
  countOnboardingPrerequisitesComplete,
  getTelescopeAchievementDefinition,
  isAllOnboardingPrerequisitesComplete,
  listOnboardingPrerequisiteDefinitions,
  TELESCOPE_ACHIEVEMENT_ID,
} from "./onboardingComplete.js";
import {
  createCatalogEntry,
  getCatalogEntry,
  grantEntitlement,
  hasEntitlement,
  initCosmeticStore,
  publishCatalogEntry,
  _resetCosmeticStoreForTests,
} from "./cosmeticStore.js";
import { getLoginStreakDaysForWallet, utcCalendarDay } from "./loginStreakStore.js";
import { normalizeRoomId } from "./roomLayouts.js";

let lastExplorationUtcDay: string | null = null;

/** Lifetime daily-state bucket for monochrome streak hue tracking. */
export const PIXEL_MONOCHROME_HUE_STATE_KEY = "pixel_mono_hue";
export const PIXEL_MONOCHROME_LIFETIME_DAY = "lifetime";
export const ACHIEVEMENT_LIFETIME_DAY = "lifetime";
export const FIELD_GOAL_LAST_SCORED_DAY_KEY = "field_goal_last_scored_day";
export const HANDSHAKE_CHALLENGER_VS_PREFIX = "handshake_challenger_vs:";

export function handshakeChallengerVsKey(opponentWallet: string): string {
  return `${HANDSHAKE_CHALLENGER_VS_PREFIX}${normalizeWallet(opponentWallet)}`;
}

const ACHIEVEMENT_ACTOR = "NQ07 ACHIEV0000000000000000000000001";

function envInt(name: string, dflt: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw.trim() === "") return dflt;
  const n = Math.floor(Number(raw.trim()));
  return Number.isFinite(n) && n >= 0 ? n : dflt;
}

/** Operator-configured top login-streak tier (Time of Kaan). Default 54 UTC days. */
export function getAchievementLoginStreakTopThreshold(): number {
  return Math.max(1, envInt("ACHIEVEMENT_LOGIN_STREAK_TOP", 54));
}

/** Sunny Side Up build milestone threshold. Default 7119 blocks. */
export function getAchievementSunnyBuildThreshold(): number {
  return Math.max(1, envInt("ACHIEVEMENT_SUNNY_BUILD_COUNT", 7119));
}

/** Reads env at call time so tests and operators can gate World Cup achievement progress. */
function isWorldCupAchievementProgressEnabled(): boolean {
  const raw = process.env.WORLDCUP_ENABLED;
  if (raw === undefined || raw === null || raw.trim() === "") return true;
  const v = raw.trim().toLowerCase();
  return !(v === "0" || v === "false" || v === "off" || v === "no");
}

export type { MatchEndParticipantInput, MatchParticipantResult, MatchWinReason };

export type AchievementUnlockWire = {
  achievementId: string;
  title: string;
  description: string;
  points: number;
  rewardSku: string | null;
  rewardDisplayName: string | null;
  totalPoints: number;
};

export type AchievementProgressPublic = {
  achievementId: string;
  title: string;
  description: string;
  category: string;
  categoryGroup: string | null;
  points: number;
  completed: boolean;
  completedAt: string | null;
  progress: number;
  threshold: number;
  rewardSku: string | null;
  rewardDisplayName: string | null;
  rewardPresetId: string | null;
  sortOrder: number;
};

export type AchievementHighlightPublic = {
  achievementId: string;
  title: string;
  points: number;
  completedAt: string;
};

export type AchievementMePayload = {
  totalPoints: number;
  achievements: AchievementProgressPublic[];
  telescopeUnlocked: boolean;
};

export type AchievementPublicSummary = {
  totalPoints: number;
  recentHighlights: AchievementHighlightPublic[];
};

export type AchievementUnlockCallback = (
  unlocks: AchievementUnlockWire[]
) => void;

export type AchievementUnlockForWalletCallback = (
  wallet: string,
  unlocks: AchievementUnlockWire[]
) => void;

let achievementTablesReady = false;

function normalizeWallet(v: string): string {
  return String(v || "").replace(/\s+/g, "").toUpperCase();
}

export function isAchievementEligibleWallet(address: string): boolean {
  if (address.startsWith("guest:")) return false;
  const w = normalizeWallet(address);
  if (!w || w.length < 4 || !w.startsWith("NQ")) return false;
  return true;
}

function requireDb(): Database.Database {
  initAchievementStore();
  return getCampaignDatabase();
}

function loginStreakThresholdForDef(def: AchievementDefinition): number {
  if (def.criteria.type !== "login_streak") return 1;
  if (def.id === SOCIAL_LOGIN_TOP_ACHIEVEMENT_ID) {
    return getAchievementLoginStreakTopThreshold();
  }
  return def.criteria.threshold;
}

function sunnyBuildThresholdForDef(def: AchievementDefinition): number {
  if (def.id === SUNNY_SIDE_UP_ACHIEVEMENT_ID) {
    return getAchievementSunnyBuildThreshold();
  }
  if (def.criteria.type === "counter") return def.criteria.threshold;
  return 1;
}

function achievementPublicDescription(def: AchievementDefinition): string {
  if (def.criteria.type === "login_streak" && def.id === SOCIAL_LOGIN_TOP_ACHIEVEMENT_ID) {
    const n = getAchievementLoginStreakTopThreshold();
    return `Log in on ${n} consecutive UTC calendar days.`;
  }
  if (def.id === SUNNY_SIDE_UP_ACHIEVEMENT_ID) {
    const n = getAchievementSunnyBuildThreshold();
    return `Place ${n} blocks.`;
  }
  return def.description;
}

function counterThreshold(def: AchievementDefinition): number {
  if (def.criteria.type === "counter") {
    return sunnyBuildThresholdForDef(def);
  }
  if (def.criteria.type === "login_streak") {
    return loginStreakThresholdForDef(def);
  }
  if (def.criteria.type === "onboarding_complete") {
    return listOnboardingPrerequisiteDefinitions().length;
  }
  if (def.criteria.type === "dedupe_count") {
    return def.criteria.threshold;
  }
  if (def.criteria.type === "daily_set") {
    return def.criteria.requiredKeys.length;
  }
  if (def.criteria.type === "streak_counter") {
    return def.criteria.threshold;
  }
  if (def.criteria.type === "ap_threshold") {
    return def.criteria.threshold;
  }
  if (def.criteria.type === "room_maker_deluxe") {
    return ROOM_DELUXE_REQUIREMENT_COUNT;
  }
  if (def.criteria.type === "owned_room_furnisher") {
    return 2;
  }
  if (def.criteria.type === "rainbow_floor") {
    return RAINBOW_FLOOR_HUE_THRESHOLD;
  }
  return 1;
}

function counterKeyForDef(def: AchievementDefinition): AchievementCounterKey | null {
  if (def.criteria.type === "counter") return def.criteria.counter;
  return null;
}

function rewardDisplayName(sku: string | undefined): string | null {
  if (!sku) return null;
  const entry = getCatalogEntry(sku);
  return entry?.displayName ?? null;
}

function rewardPresetId(sku: string | undefined): string | null {
  if (!sku) return null;
  const entry = getCatalogEntry(sku);
  return entry?.presetId ?? null;
}

function getCounterValue(wallet: string, counter: AchievementCounterKey): number {
  const w = normalizeWallet(wallet);
  const row = requireDb()
    .prepare(
      `SELECT value FROM achievement_counters WHERE wallet = ? AND counter_key = ?`
    )
    .get(w, counter) as { value: number } | undefined;
  return row?.value ?? 0;
}

function listSeenKeysWithPrefix(wallet: string, prefix: string): string[] {
  const w = normalizeWallet(wallet);
  const rows = requireDb()
    .prepare(
      `SELECT seen_key FROM achievement_seen
       WHERE wallet = ? AND seen_key LIKE ? || '%'`
    )
    .all(w, prefix) as Array<{ seen_key: string }>;
  return rows.map((r) => r.seen_key);
}

function maxRainbowHueProgress(wallet: string): number {
  const counts = new Map<string, number>();
  for (const key of listSeenKeysWithPrefix(wallet, RAINBOW_HUE_SEEN_PREFIX)) {
    const rest = key.slice(RAINBOW_HUE_SEEN_PREFIX.length);
    const colon = rest.lastIndexOf(":");
    if (colon <= 0) continue;
    const roomId = rest.slice(0, colon);
    counts.set(roomId, (counts.get(roomId) ?? 0) + 1);
  }
  let max = 0;
  for (const count of counts.values()) {
    if (count > max) max = count;
  }
  return max;
}

function maxRoomDeluxeProgress(wallet: string): number {
  const w = normalizeWallet(wallet);
  const rows = requireDb()
    .prepare(
      `SELECT value FROM achievement_daily_state
       WHERE wallet = ? AND utc_day = ? AND state_key LIKE ? || '%'`
    )
    .all(w, ROOM_DELUXE_LIFETIME_DAY, "room_deluxe:") as Array<{ value: string }>;
  let max = 0;
  for (const row of rows) {
    const met = roomDeluxeMetRequirements(parseRoomDeluxeProgress(row.value));
    if (met > max) max = met;
  }
  return max;
}

function getRoomDeluxeProgress(
  wallet: string,
  roomId: string
): RoomDeluxeProgress {
  return parseRoomDeluxeProgress(
    getAchievementDailyState(
      wallet,
      ROOM_DELUXE_LIFETIME_DAY,
      roomDeluxeStateKey(roomId)
    )
  );
}

function setRoomDeluxeProgress(
  wallet: string,
  roomId: string,
  progress: RoomDeluxeProgress
): void {
  setAchievementDailyState(
    wallet,
    ROOM_DELUXE_LIFETIME_DAY,
    roomDeluxeStateKey(roomId),
    formatRoomDeluxeProgress(progress)
  );
}

function evaluateRainbowFloorAchievements(
  wallet: string,
  roomId: string,
  unlocks: AchievementUnlockWire[]
): void {
  const def = getAchievementDefinition(RAINBOW_FLOOR_ACHIEVEMENT_ID);
  if (!def || def.criteria.type !== "rainbow_floor") return;
  if (hasCompletion(wallet, def.id)) return;
  const prefix = `${RAINBOW_HUE_SEEN_PREFIX}${normalizeRoomId(roomId).trim().toLowerCase()}:`;
  const count = listSeenKeysWithPrefix(wallet, prefix).length;
  if (count >= RAINBOW_FLOOR_HUE_THRESHOLD) {
    completeAchievement(wallet, def, unlocks);
  }
}

function maxRoomFurnisherProgress(wallet: string): number {
  const w = normalizeWallet(wallet);
  const rows = requireDb()
    .prepare(
      `SELECT value FROM achievement_daily_state
       WHERE wallet = ? AND utc_day = ? AND state_key LIKE ? || '%'`
    )
    .all(w, ROOM_DELUXE_LIFETIME_DAY, "room_furnisher:") as Array<{ value: string }>;
  let max = 0;
  for (const row of rows) {
    const met = roomFurnisherMetRequirements(parseRoomFurnisherProgress(row.value));
    if (met > max) max = met;
  }
  return max;
}

function getRoomFurnisherProgress(
  wallet: string,
  roomId: string
): ReturnType<typeof parseRoomFurnisherProgress> {
  return parseRoomFurnisherProgress(
    getAchievementDailyState(
      wallet,
      ROOM_DELUXE_LIFETIME_DAY,
      roomFurnisherStateKey(roomId)
    )
  );
}

function setRoomFurnisherProgress(
  wallet: string,
  roomId: string,
  progress: ReturnType<typeof parseRoomFurnisherProgress>
): void {
  setAchievementDailyState(
    wallet,
    ROOM_DELUXE_LIFETIME_DAY,
    roomFurnisherStateKey(roomId),
    formatRoomFurnisherProgress(progress)
  );
}

function evaluateRoomFurnisherAchievements(
  wallet: string,
  unlocks: AchievementUnlockWire[]
): void {
  const def = getAchievementDefinition(ROOM_FURNISHER_ACHIEVEMENT_ID);
  if (!def || def.criteria.type !== "owned_room_furnisher") return;
  if (hasCompletion(wallet, def.id)) return;
  const w = normalizeWallet(wallet);
  const rows = requireDb()
    .prepare(
      `SELECT value FROM achievement_daily_state
       WHERE wallet = ? AND utc_day = ? AND state_key LIKE ? || '%'`
    )
    .all(w, ROOM_DELUXE_LIFETIME_DAY, "room_furnisher:") as Array<{ value: string }>;
  for (const row of rows) {
    if (isRoomFurnisherComplete(parseRoomFurnisherProgress(row.value))) {
      completeAchievement(wallet, def, unlocks);
      return;
    }
  }
}

function evaluateApThresholdAchievements(
  wallet: string,
  unlocks: AchievementUnlockWire[]
): void {
  const total = totalPointsForWallet(wallet);
  for (const def of listApThresholdAchievements()) {
    if (def.criteria.type !== "ap_threshold") continue;
    if (hasCompletion(wallet, def.id)) continue;
    if (total >= def.criteria.threshold) {
      completeAchievement(wallet, def, unlocks);
    }
  }
}

function evaluateRoomMakerDeluxeAchievements(
  wallet: string,
  unlocks: AchievementUnlockWire[]
): void {
  const def = getAchievementDefinition(ROOM_MAKER_DELUXE_ACHIEVEMENT_ID);
  if (!def || def.criteria.type !== "room_maker_deluxe") return;
  if (hasCompletion(wallet, def.id)) return;
  const rows = requireDb()
    .prepare(
      `SELECT value FROM achievement_daily_state
       WHERE wallet = ? AND utc_day = ? AND state_key LIKE ? || '%'`
    )
    .all(
      normalizeWallet(wallet),
      ROOM_DELUXE_LIFETIME_DAY,
      "room_deluxe:"
    ) as Array<{ value: string }>;
  for (const row of rows) {
    if (isRoomDeluxeComplete(parseRoomDeluxeProgress(row.value))) {
      completeAchievement(wallet, def, unlocks);
      return;
    }
  }
}

function touchRoomDeluxeProgress(
  wallet: string,
  roomId: string,
  mutate: (progress: RoomDeluxeProgress) => void,
  onUnlock?: AchievementUnlockCallback
): void {
  if (!isAchievementEligibleWallet(wallet)) return;
  const w = normalizeWallet(wallet);
  const progress = getRoomDeluxeProgress(w, roomId);
  mutate(progress);
  setRoomDeluxeProgress(w, roomId, progress);
  const unlocks: AchievementUnlockWire[] = [];
  evaluateRoomMakerDeluxeAchievements(w, unlocks);
  if (unlocks.length > 0 && onUnlock) onUnlock(unlocks);
}

function countSeenKeysWithPrefix(wallet: string, prefix: string): number {
  const w = normalizeWallet(wallet);
  const row = requireDb()
    .prepare(
      `SELECT COUNT(*) AS count FROM achievement_seen
       WHERE wallet = ? AND seen_key LIKE ? || '%'`
    )
    .get(w, prefix) as { count: number };
  return row?.count ?? 0;
}

function hasSeenKey(wallet: string, seenKey: string): boolean {
  const w = normalizeWallet(wallet);
  const row = requireDb()
    .prepare(
      `SELECT 1 FROM achievement_seen WHERE wallet = ? AND seen_key = ?`
    )
    .get(w, seenKey);
  return row != null;
}

/** Idempotent lifetime dedupe insert; returns true when newly recorded. */
export function recordAchievementSeen(
  wallet: string,
  seenKey: string
): boolean {
  if (!isAchievementEligibleWallet(wallet)) return false;
  const w = normalizeWallet(wallet);
  const key = String(seenKey ?? "").trim();
  if (!key) return false;
  const result = requireDb()
    .prepare(
      `INSERT OR IGNORE INTO achievement_seen (wallet, seen_key, first_seen_ms)
       VALUES (?, ?, ?)`
    )
    .run(w, key, Date.now());
  return result.changes > 0;
}

export function countAchievementSeenWithPrefix(
  wallet: string,
  prefix: string
): number {
  if (!isAchievementEligibleWallet(wallet)) return 0;
  return countSeenKeysWithPrefix(normalizeWallet(wallet), prefix);
}

export function getAchievementDailyState(
  wallet: string,
  utcDay: string,
  stateKey: string
): string | null {
  if (!isAchievementEligibleWallet(wallet)) return null;
  const w = normalizeWallet(wallet);
  const row = requireDb()
    .prepare(
      `SELECT value FROM achievement_daily_state
       WHERE wallet = ? AND utc_day = ? AND state_key = ?`
    )
    .get(w, utcDay, stateKey) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setAchievementDailyState(
  wallet: string,
  utcDay: string,
  stateKey: string,
  value: string
): void {
  if (!isAchievementEligibleWallet(wallet)) return;
  const w = normalizeWallet(wallet);
  requireDb()
    .prepare(
      `INSERT INTO achievement_daily_state (wallet, utc_day, state_key, value)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(wallet, utc_day, state_key) DO UPDATE SET
         value = excluded.value`
    )
    .run(w, utcDay, stateKey, value);
}

function setCounterValue(
  wallet: string,
  counter: AchievementCounterKey,
  value: number
): void {
  const w = normalizeWallet(wallet);
  const now = Date.now();
  requireDb()
    .prepare(
      `INSERT INTO achievement_counters (wallet, counter_key, value, updated_at_ms)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(wallet, counter_key) DO UPDATE SET
         value = excluded.value,
         updated_at_ms = excluded.updated_at_ms`
    )
    .run(w, counter, value, now);
}

function hasCompletion(wallet: string, achievementId: string): boolean {
  const w = normalizeWallet(wallet);
  const row = requireDb()
    .prepare(
      `SELECT 1 FROM achievement_completions
       WHERE wallet = ? AND achievement_id = ?`
    )
    .get(w, achievementId);
  return row != null;
}

function insertCompletion(
  wallet: string,
  def: AchievementDefinition
): boolean {
  const w = normalizeWallet(wallet);
  if (!w) return false;
  if (hasCompletion(w, def.id)) return false;
  const now = Date.now();
  requireDb()
    .prepare(
      `INSERT INTO achievement_completions
        (wallet, achievement_id, completed_at_ms, points_awarded, reward_sku)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      w,
      def.id,
      now,
      def.points,
      def.rewardSku ?? null
    );
  if (def.rewardSku) {
    seedAchievementRewardCatalog();
    grantEntitlement(w, def.rewardSku, ACHIEVEMENT_ACTOR, "achievement");
  }
  return true;
}

/** Backfill reward entitlements for completed achievements (e.g. catalog seeded after unlock). */
export function ensureAchievementRewardEntitlements(wallet: string): void {
  if (!isAchievementEligibleWallet(wallet)) return;
  const w = normalizeWallet(wallet);
  seedAchievementRewardCatalog();
  const completedIds = listCompletedAchievementIds(w);
  for (const def of ACHIEVEMENT_DEFINITIONS) {
    if (!def.rewardSku || !completedIds.has(def.id)) continue;
    if (hasEntitlement(w, def.rewardSku)) continue;
    grantEntitlement(w, def.rewardSku, ACHIEVEMENT_ACTOR, "achievement");
  }
  // Legacy rows may still reference old SKUs that remain in catalog.
  const rows = requireDb()
    .prepare(
      `SELECT DISTINCT reward_sku AS reward_sku FROM achievement_completions
       WHERE wallet = ? AND reward_sku IS NOT NULL AND reward_sku != ''`
    )
    .all(w) as Array<{ reward_sku: string }>;
  for (const row of rows) {
    if (!getCatalogEntry(row.reward_sku)) continue;
    if (hasEntitlement(w, row.reward_sku)) continue;
    grantEntitlement(w, row.reward_sku, ACHIEVEMENT_ACTOR, "achievement");
  }
}

function totalPointsForWallet(wallet: string): number {
  const w = normalizeWallet(wallet);
  const row = requireDb()
    .prepare(
      `SELECT COALESCE(SUM(points_awarded), 0) AS total
       FROM achievement_completions WHERE wallet = ?`
    )
    .get(w) as { total: number };
  return row?.total ?? 0;
}

function listCompletedAchievementIds(wallet: string): Set<string> {
  const w = normalizeWallet(wallet);
  const rows = requireDb()
    .prepare(
      `SELECT achievement_id FROM achievement_completions WHERE wallet = ?`
    )
    .all(w) as Array<{ achievement_id: string }>;
  return new Set(rows.map((r) => r.achievement_id));
}

function evaluateOnboardingCompleteAchievements(
  wallet: string,
  unlocks: AchievementUnlockWire[]
): void {
  if (!isAchievementEligibleWallet(wallet)) return;
  const def = getTelescopeAchievementDefinition();
  if (!def) return;
  const w = normalizeWallet(wallet);
  if (hasCompletion(w, def.id)) return;
  const completed = listCompletedAchievementIds(w);
  if (!isAllOnboardingPrerequisitesComplete(completed)) return;
  completeAchievement(w, def, unlocks);
}

export function ensureOnboardingCompleteAchievements(
  wallet: string,
  onUnlock?: AchievementUnlockCallback
): void {
  const unlocks: AchievementUnlockWire[] = [];
  evaluateOnboardingCompleteAchievements(wallet, unlocks);
  if (unlocks.length > 0 && onUnlock) onUnlock(unlocks);
}

export function isTelescopeUnlockedForWallet(wallet: string): boolean {
  if (!isAchievementEligibleWallet(wallet)) return false;
  return hasCompletion(normalizeWallet(wallet), TELESCOPE_ACHIEVEMENT_ID);
}

function completeAchievement(
  wallet: string,
  def: AchievementDefinition,
  unlocks: AchievementUnlockWire[]
): void {
  if (!insertCompletion(wallet, def)) return;
  const totalPoints = totalPointsForWallet(wallet);
  unlocks.push({
    achievementId: def.id,
    title: def.title,
    description: achievementPublicDescription(def),
    points: def.points,
    rewardSku: def.rewardSku ?? null,
    rewardDisplayName: rewardDisplayName(def.rewardSku),
    totalPoints,
  });
  evaluateOnboardingCompleteAchievements(wallet, unlocks);
  evaluateApThresholdAchievements(wallet, unlocks);
}

function evaluateCounterAchievements(
  wallet: string,
  counter: AchievementCounterKey,
  unlocks: AchievementUnlockWire[]
): void {
  const value = getCounterValue(wallet, counter);
  for (const def of listAchievementsForCounter(counter)) {
    if (def.criteria.type !== "counter") continue;
    if (hasCompletion(wallet, def.id)) continue;
    if (value >= sunnyBuildThresholdForDef(def)) {
      completeAchievement(wallet, def, unlocks);
    }
  }
}

function evaluateStreakCounterAchievements(
  wallet: string,
  counter: AchievementCounterKey,
  unlocks: AchievementUnlockWire[]
): void {
  const value = getCounterValue(wallet, counter);
  for (const def of listAchievementsForStreakCounter(counter)) {
    if (def.criteria.type !== "streak_counter") continue;
    if (hasCompletion(wallet, def.id)) continue;
    if (value >= def.criteria.threshold) {
      completeAchievement(wallet, def, unlocks);
    }
  }
}

function bumpStreakCounterCollecting(
  wallet: string,
  counter: AchievementCounterKey,
  delta: number,
  unlocks: AchievementUnlockWire[]
): void {
  if (!isAchievementEligibleWallet(wallet) || delta <= 0) return;
  const w = normalizeWallet(wallet);
  const next = getCounterValue(w, counter) + delta;
  setCounterValue(w, counter, next);
  evaluateStreakCounterAchievements(w, counter, unlocks);
}

function resetStreakCounterCollecting(
  wallet: string,
  counter: AchievementCounterKey,
  value: number,
  unlocks: AchievementUnlockWire[]
): void {
  if (!isAchievementEligibleWallet(wallet)) return;
  const w = normalizeWallet(wallet);
  setCounterValue(w, counter, Math.max(0, Math.floor(value)));
  evaluateStreakCounterAchievements(w, counter, unlocks);
}

function evaluateDedupePrefixAchievements(
  wallet: string,
  seenPrefix: string,
  unlocks: AchievementUnlockWire[]
): void {
  const count = countSeenKeysWithPrefix(wallet, seenPrefix);
  for (const def of listAchievementsForDedupePrefix(seenPrefix)) {
    if (def.criteria.type !== "dedupe_count") continue;
    if (hasCompletion(wallet, def.id)) continue;
    if (count >= def.criteria.threshold) {
      completeAchievement(wallet, def, unlocks);
    }
  }
}

function evaluateDailySetAchievements(
  wallet: string,
  visited: ReadonlySet<string>,
  unlocks: AchievementUnlockWire[]
): void {
  for (const def of listDailySetAchievements()) {
    if (def.criteria.type !== "daily_set") continue;
    if (hasCompletion(wallet, def.id)) continue;
    const required = def.criteria.requiredKeys;
    if (required.every((key) => visited.has(key))) {
      completeAchievement(wallet, def, unlocks);
    }
  }
}

function fireEventCollecting(
  wallet: string,
  event: AchievementEventKey,
  unlocks: AchievementUnlockWire[]
): void {
  if (!isAchievementEligibleWallet(wallet)) return;
  if (!isWorldCupAchievementProgressEnabled() && isWorldCupAchievementEvent(event)) return;
  const w = normalizeWallet(wallet);
  for (const def of listAchievementsForEvent(event)) {
    if (hasCompletion(w, def.id)) continue;
    completeAchievement(w, def, unlocks);
  }
}

function bumpCounterCollecting(
  wallet: string,
  counter: AchievementCounterKey,
  delta: number,
  unlocks: AchievementUnlockWire[]
): void {
  if (!isAchievementEligibleWallet(wallet) || delta <= 0) return;
  if (!isWorldCupAchievementProgressEnabled() && isWorldCupAchievementCounter(counter)) return;
  const w = normalizeWallet(wallet);
  const next = getCounterValue(w, counter) + delta;
  setCounterValue(w, counter, next);
  evaluateCounterAchievements(w, counter, unlocks);
}

function setCounterCollecting(
  wallet: string,
  counter: AchievementCounterKey,
  value: number,
  unlocks: AchievementUnlockWire[]
): void {
  if (!isAchievementEligibleWallet(wallet)) return;
  if (!isWorldCupAchievementProgressEnabled() && isWorldCupAchievementCounter(counter)) return;
  const w = normalizeWallet(wallet);
  setCounterValue(w, counter, Math.max(0, Math.floor(value)));
  evaluateCounterAchievements(w, counter, unlocks);
}

function applyMatchEndParticipant(
  input: MatchEndParticipantInput,
  unlocks: AchievementUnlockWire[]
): void {
  if (!isAchievementEligibleWallet(input.wallet)) return;
  const { wallet, ...participant } = input;
  const effect = evaluateMatchAchievementsForParticipant(participant);
  bumpCounterCollecting(
    wallet,
    "matches_played",
    effect.matchesPlayedDelta,
    unlocks
  );
  if (effect.matchesWonDelta > 0) {
    bumpCounterCollecting(
      wallet,
      "matches_won",
      effect.matchesWonDelta,
      unlocks
    );
  }
  setCounterCollecting(
    wallet,
    "match_win_streak",
    effect.newWinStreak,
    unlocks
  );
  for (const event of effect.events) {
    fireEventCollecting(wallet, event, unlocks);
  }
}

export function seedAchievementRewardCatalog(): void {
  initCosmeticStore();
  for (const reward of ACHIEVEMENT_REWARD_CATALOG) {
    const existing = getCatalogEntry(reward.cosmeticSku);
    if (existing) continue;
    const created = createCatalogEntry(
      {
        cosmeticSku: reward.cosmeticSku,
        presetId: reward.presetId,
        displayName: reward.displayName,
        description: reward.description,
        collection: ACHIEVEMENT_COLLECTION,
        sortOrder: reward.sortOrder,
        priceLuna: 0n,
      },
      ACHIEVEMENT_ACTOR
    );
    if (created.ok) {
      publishCatalogEntry(reward.cosmeticSku, ACHIEVEMENT_ACTOR);
    }
  }
}

export function initAchievementStore(): void {
  initCampaignStore();
  if (achievementTablesReady) return;
  const database = getCampaignDatabase();
  database.exec(`
    CREATE TABLE IF NOT EXISTS achievement_counters (
      wallet TEXT NOT NULL,
      counter_key TEXT NOT NULL,
      value INTEGER NOT NULL DEFAULT 0,
      updated_at_ms INTEGER NOT NULL,
      PRIMARY KEY (wallet, counter_key)
    );
    CREATE TABLE IF NOT EXISTS achievement_completions (
      wallet TEXT NOT NULL,
      achievement_id TEXT NOT NULL,
      completed_at_ms INTEGER NOT NULL,
      points_awarded INTEGER NOT NULL,
      reward_sku TEXT,
      PRIMARY KEY (wallet, achievement_id)
    );
    CREATE INDEX IF NOT EXISTS idx_achievement_completions_wallet_time
      ON achievement_completions (wallet, completed_at_ms DESC);
    CREATE TABLE IF NOT EXISTS achievement_seen (
      wallet TEXT NOT NULL,
      seen_key TEXT NOT NULL,
      first_seen_ms INTEGER NOT NULL,
      PRIMARY KEY (wallet, seen_key)
    );
    CREATE INDEX IF NOT EXISTS idx_achievement_seen_wallet_prefix
      ON achievement_seen (wallet, seen_key);
    CREATE TABLE IF NOT EXISTS achievement_daily_state (
      wallet TEXT NOT NULL,
      utc_day TEXT NOT NULL,
      state_key TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (wallet, utc_day, state_key)
    );
  `);
  achievementTablesReady = true;
  seedAchievementRewardCatalog();
}

/** Test-only: reset module singletons so each temp SQLite file is isolated. */
export function _resetAchievementStoreForTests(): void {
  achievementTablesReady = false;
  lastExplorationUtcDay = null;
  _resetCosmeticStoreForTests();
}

export function bumpAchievementCounter(
  wallet: string,
  counter: AchievementCounterKey,
  delta: number,
  onUnlock?: AchievementUnlockCallback
): void {
  const unlocks: AchievementUnlockWire[] = [];
  bumpCounterCollecting(wallet, counter, delta, unlocks);
  if (unlocks.length > 0 && onUnlock) onUnlock(unlocks);
}

export function fireAchievementEvent(
  wallet: string,
  event: AchievementEventKey,
  onUnlock?: AchievementUnlockCallback
): void {
  const unlocks: AchievementUnlockWire[] = [];
  fireEventCollecting(wallet, event, unlocks);
  if (unlocks.length > 0 && onUnlock) onUnlock(unlocks);
}

/** Increment streak on win; reset to zero on loss or draw. */
export function setMatchWinStreak(
  wallet: string,
  won: boolean,
  onUnlock?: AchievementUnlockCallback
): void {
  if (!isWorldCupAchievementProgressEnabled() || !isAchievementEligibleWallet(wallet)) return;
  const w = normalizeWallet(wallet);
  const next = won ? getCounterValue(w, "match_win_streak") + 1 : 0;
  const unlocks: AchievementUnlockWire[] = [];
  setCounterCollecting(w, "match_win_streak", next, unlocks);
  if (unlocks.length > 0 && onUnlock) onUnlock(unlocks);
}

export function recordMatchEnd(
  sideA: MatchEndParticipantInput,
  sideB: MatchEndParticipantInput,
  onUnlock?: AchievementUnlockForWalletCallback
): void {
  if (!isWorldCupAchievementProgressEnabled()) return;
  const unlocksA: AchievementUnlockWire[] = [];
  const unlocksB: AchievementUnlockWire[] = [];
  applyMatchEndParticipant(sideA, unlocksA);
  applyMatchEndParticipant(sideB, unlocksB);
  if (!onUnlock) return;
  if (unlocksA.length > 0) onUnlock(sideA.wallet, unlocksA);
  if (unlocksB.length > 0) onUnlock(sideB.wallet, unlocksB);
}

export function recordFieldGoalScored(
  wallet: string,
  opts: {
    contested?: boolean;
    solo?: boolean;
    rushHour?: boolean;
    underdog?: boolean;
    utcDay?: string;
  } = {},
  onUnlock?: AchievementUnlockCallback
): void {
  if (!isWorldCupAchievementProgressEnabled() || !isAchievementEligibleWallet(wallet)) return;
  const unlocks: AchievementUnlockWire[] = [];
  const w = normalizeWallet(wallet);
  bumpCounterCollecting(w, "field_goals_scored", 1, unlocks);
  fireEventCollecting(w, "field_goal_scored", unlocks);
  if (opts.contested) fireEventCollecting(w, "field_goal_contested", unlocks);
  if (opts.solo) fireEventCollecting(w, "field_goal_solo", unlocks);
  if (opts.rushHour) fireEventCollecting(w, "field_goal_rush_hour", unlocks);
  if (opts.underdog) fireEventCollecting(w, "field_underdog_country", unlocks);

  const today = opts.utcDay ?? utcCalendarDay();
  const lastScoredDay = getAchievementDailyState(
    w,
    ACHIEVEMENT_LIFETIME_DAY,
    FIELD_GOAL_LAST_SCORED_DAY_KEY
  );
  const streakUpdate = computeFieldGoalDailyStreakUpdate(
    getCounterValue(w, "field_goal_daily_streak"),
    lastScoredDay,
    today
  );
  if (streakUpdate.firstScoreToday) {
    setAchievementDailyState(
      w,
      ACHIEVEMENT_LIFETIME_DAY,
      FIELD_GOAL_LAST_SCORED_DAY_KEY,
      today
    );
    setCounterCollecting(w, "field_goal_daily_streak", streakUpdate.streak, unlocks);
  }

  if (unlocks.length > 0 && onUnlock) onUnlock(unlocks);
}

/** Track mutual same-day rivalry when a Match begins (challenger vs accepter). */
export function recordMatchChallengeStarted(
  challengerWallet: string,
  accepterWallet: string,
  onUnlock?: AchievementUnlockForWalletCallback
): void {
  if (!isWorldCupAchievementProgressEnabled()) return;
  if (
    !isAchievementEligibleWallet(challengerWallet) ||
    !isAchievementEligibleWallet(accepterWallet)
  ) {
    return;
  }
  const challenger = normalizeWallet(challengerWallet);
  const accepter = normalizeWallet(accepterWallet);
  const utcDay = utcCalendarDay();
  const unlocks: AchievementUnlockWire[] = [];
  if (
    getAchievementDailyState(accepter, utcDay, handshakeChallengerVsKey(challenger))
  ) {
    fireEventCollecting(accepter, "handshake_rival", unlocks);
  }
  setAchievementDailyState(
    challenger,
    utcDay,
    handshakeChallengerVsKey(accepter),
    "1"
  );
  if (unlocks.length > 0 && onUnlock) onUnlock(accepter, unlocks);
}

export function recordChatMessageSent(
  wallet: string,
  onUnlock?: AchievementUnlockCallback
): void {
  bumpAchievementCounter(wallet, "chat_messages_sent", 1, onUnlock);
}

export function evaluateLoginStreakAchievements(
  wallet: string,
  onUnlock?: AchievementUnlockCallback
): void {
  if (!isAchievementEligibleWallet(wallet)) return;
  const w = normalizeWallet(wallet);
  const days = getLoginStreakDaysForWallet(w);
  const unlocks: AchievementUnlockWire[] = [];
  evaluateLoginStreakAchievementsCollecting(w, days, unlocks);
  if (unlocks.length > 0 && onUnlock) onUnlock(unlocks);
}

function evaluateLoginStreakAchievementsCollecting(
  wallet: string,
  streakDays: number,
  unlocks: AchievementUnlockWire[]
): void {
  const days = Math.max(0, Math.floor(streakDays));
  for (const def of listLoginStreakAchievements()) {
    if (def.criteria.type !== "login_streak") continue;
    if (hasCompletion(wallet, def.id)) continue;
    if (days >= loginStreakThresholdForDef(def)) {
      completeAchievement(wallet, def, unlocks);
    }
  }
}

export function recordBlockPlaced(
  wallet: string,
  roomId: string,
  onUnlock?: AchievementUnlockCallback
): void {
  if (!isAchievementEligibleWallet(wallet)) return;
  bumpAchievementCounter(wallet, "blocks_placed", 1, (unlocks) => {
    onUnlock?.(unlocks);
  });
  if (roomId.trim().toLowerCase() === COMMONS_ROOM_ID) {
    bumpAchievementCounter(wallet, "blocks_placed_commons", 1, onUnlock);
  }
}

export function recordBlockMined(
  wallet: string,
  onUnlock?: AchievementUnlockCallback
): void {
  bumpAchievementCounter(wallet, "blocks_mined", 1, onUnlock);
}

export function recordPixelPainted(
  wallet: string,
  count: number,
  onUnlock?: AchievementUnlockCallback
): void {
  if (count <= 0) return;
  bumpAchievementCounter(wallet, "pixels_painted", count, onUnlock);
}

export function recordImpatientMiner(
  wallet: string,
  onUnlock?: AchievementUnlockCallback
): void {
  fireAchievementEvent(wallet, "impatient_miner", onUnlock);
}

export function recordMineCooldownAttempt(
  wallet: string,
  onUnlock?: AchievementUnlockCallback
): void {
  bumpAchievementCounter(wallet, "mine_cooldown_attempts", 1, onUnlock);
}

export function recordFieldGoalPayout(
  wallet: string,
  onUnlock?: AchievementUnlockCallback
): void {
  fireAchievementEvent(wallet, "paid_in_full", onUnlock);
}

export function recordBillboardDwellMs(
  wallet: string,
  deltaMs: number,
  onUnlock?: AchievementUnlockCallback
): void {
  if (deltaMs <= 0) return;
  bumpAchievementCounter(wallet, "billboard_dwell_ms", deltaMs, onUnlock);
}

export function recordPixelCornerPainted(
  wallet: string,
  x: number,
  z: number,
  onUnlock?: AchievementUnlockCallback
): void {
  if (!isAchievementEligibleWallet(wallet)) return;
  const cornerId = pixelCornerIdForTile(x, z);
  if (!cornerId) return;
  const w = normalizeWallet(wallet);
  const unlocks: AchievementUnlockWire[] = [];
  const seenKey = pixelCornerSeenKey(cornerId);
  if (recordAchievementSeen(w, seenKey)) {
    evaluateDedupePrefixAchievements(w, PIXEL_CORNER_SEEN_PREFIX, unlocks);
  }
  if (unlocks.length > 0 && onUnlock) onUnlock(unlocks);
}

export function recordPixelCollaboratorPaint(
  wallet: string,
  onUnlock?: AchievementUnlockCallback
): void {
  fireAchievementEvent(wallet, "pixel_collaborator", onUnlock);
}

export function recordPixelMonochromePaint(
  wallet: string,
  colorRgb: number,
  onUnlock?: AchievementUnlockCallback
): void {
  if (!isAchievementEligibleWallet(wallet)) return;
  const w = normalizeWallet(wallet);
  const hueKey = monochromeHueKey(colorRgb);
  const storedHue = parseMonochromeHueKey(
    getAchievementDailyState(
      w,
      PIXEL_MONOCHROME_LIFETIME_DAY,
      PIXEL_MONOCHROME_HUE_STATE_KEY
    )
  );
  const unlocks: AchievementUnlockWire[] = [];
  if (storedHue === null || storedHue !== parseMonochromeHueKey(hueKey)) {
    setAchievementDailyState(
      w,
      PIXEL_MONOCHROME_LIFETIME_DAY,
      PIXEL_MONOCHROME_HUE_STATE_KEY,
      hueKey
    );
    resetStreakCounterCollecting(w, "pixel_monochrome_streak", 1, unlocks);
  } else {
    bumpStreakCounterCollecting(w, "pixel_monochrome_streak", 1, unlocks);
  }
  if (unlocks.length > 0 && onUnlock) onUnlock(unlocks);
}

export function recordPixelPaintAchievements(
  wallet: string,
  x: number,
  z: number,
  colorRgb: number,
  tilePainters: ReadonlyMap<string, string>,
  otherPresentWallets: ReadonlySet<string>,
  onUnlock?: AchievementUnlockCallback
): void {
  if (!isAchievementEligibleWallet(wallet)) return;
  recordPixelCornerPainted(wallet, x, z, onUnlock);
  if (
    isPixelCollaboratorPaint(wallet, x, z, tilePainters, otherPresentWallets)
  ) {
    recordPixelCollaboratorPaint(wallet, onUnlock);
  }
  recordPixelMonochromePaint(wallet, colorRgb, onUnlock);
}

export function recordDistinctTileWalked(
  wallet: string,
  roomId: string,
  pathTiles: ReadonlyArray<{ x: number; z: number }>,
  onUnlock?: AchievementUnlockCallback
): number {
  if (!isAchievementEligibleWallet(wallet) || pathTiles.length === 0) return 0;
  const w = normalizeWallet(wallet);
  const seenInBatch = new Set<string>();
  const isAlreadySeen = (seenKey: string) =>
    seenInBatch.has(seenKey) || hasSeenKey(w, seenKey);
  const credits = computeDistinctTileCredits(roomId, pathTiles, isAlreadySeen);
  if (credits.length === 0) return 0;
  const unlocks: AchievementUnlockWire[] = [];
  let inserted = 0;
  for (const seenKey of credits) {
    if (recordAchievementSeen(w, seenKey)) {
      seenInBatch.add(seenKey);
      inserted += 1;
    }
  }
  if (inserted > 0) {
    evaluateDedupePrefixAchievements(w, MARATHON_TILE_SEEN_PREFIX, unlocks);
  }
  if (unlocks.length > 0 && onUnlock) onUnlock(unlocks);
  return inserted;
}

export function recordExplorationRoomEntry(
  wallet: string,
  roomId: string,
  onUnlock?: AchievementUnlockCallback,
  utcDay: string = utcCalendarDay()
): void {
  if (!isAchievementEligibleWallet(wallet)) return;
  const w = normalizeWallet(wallet);
  const unlocks: AchievementUnlockWire[] = [];
  const roomSeenKey = explorationRoomSeenKey(roomId);
  if (recordAchievementSeen(w, roomSeenKey)) {
    evaluateDedupePrefixAchievements(w, EXPLORATION_ROOM_SEEN_PREFIX, unlocks);
  }
  const tourKey = grandTourKeyForRoom(roomId);
  if (tourKey) {
    const visited = parseGrandTourVisitedKeys(
      getAchievementDailyState(w, utcDay, GRAND_TOUR_DAILY_STATE_KEY)
    );
    if (!visited.has(tourKey)) {
      visited.add(tourKey);
      setAchievementDailyState(
        w,
        utcDay,
        GRAND_TOUR_DAILY_STATE_KEY,
        formatGrandTourVisitedKeys(visited)
      );
      evaluateDailySetAchievements(w, visited, unlocks);
    }
  }
  if (unlocks.length > 0 && onUnlock) onUnlock(unlocks);
}

export function recordExplorationDoorFromSpawn(
  wallet: string,
  targetRoomId: string,
  spawnX: number,
  spawnZ: number,
  onUnlock?: AchievementUnlockCallback
): void {
  const doorKey = resolveBuiltinDoorSeenKeyFromSpawn(
    targetRoomId,
    spawnX,
    spawnZ
  );
  if (!doorKey) return;
  recordExplorationDoorUsed(wallet, doorKey, onUnlock);
}

export function recordExplorationDoorUsed(
  wallet: string,
  doorSeenKey: string,
  onUnlock?: AchievementUnlockCallback
): void {
  if (!isAchievementEligibleWallet(wallet)) return;
  const w = normalizeWallet(wallet);
  const unlocks: AchievementUnlockWire[] = [];
  if (recordAchievementSeen(w, doorSeenKey)) {
    evaluateDedupePrefixAchievements(w, EXPLORATION_DOOR_SEEN_PREFIX, unlocks);
  }
  if (unlocks.length > 0 && onUnlock) onUnlock(unlocks);
}

export function recordTeleporterWarp(
  wallet: string,
  fromRoomId: string,
  fromX: number,
  fromZ: number,
  toRoomId: string,
  onUnlock?: AchievementUnlockCallback
): void {
  if (!isAchievementEligibleWallet(wallet)) return;
  const w = normalizeWallet(wallet);
  const unlocks: AchievementUnlockWire[] = [];
  const doorKey = teleporterPortalDoorSeenKey(
    fromRoomId,
    fromX,
    fromZ,
    toRoomId
  );
  const destKey = teleporterDestinationSeenKey(toRoomId);
  let doorInserted = false;
  let destInserted = false;
  if (recordAchievementSeen(w, doorKey)) doorInserted = true;
  if (recordAchievementSeen(w, destKey)) destInserted = true;
  if (doorInserted) {
    evaluateDedupePrefixAchievements(w, EXPLORATION_DOOR_SEEN_PREFIX, unlocks);
  }
  if (destInserted) {
    evaluateDedupePrefixAchievements(w, TELEPORTER_DEST_SEEN_PREFIX, unlocks);
  }
  if (unlocks.length > 0 && onUnlock) onUnlock(unlocks);
}

export function recordOutfieldTilesWalked(
  wallet: string,
  roomId: string,
  pathTiles: ReadonlyArray<{ x: number; z: number }>,
  onUnlock?: AchievementUnlockCallback
): number {
  if (!isAchievementEligibleWallet(wallet) || pathTiles.length === 0) return 0;
  const w = normalizeWallet(wallet);
  const seenInBatch = new Set<string>();
  const isAlreadySeen = (seenKey: string) =>
    seenInBatch.has(seenKey) || hasSeenKey(w, seenKey);
  const credits = computeOutfieldTileCredits(roomId, pathTiles, isAlreadySeen);
  if (credits.length === 0) return 0;
  const unlocks: AchievementUnlockWire[] = [];
  let inserted = 0;
  for (const seenKey of credits) {
    if (recordAchievementSeen(w, seenKey)) {
      seenInBatch.add(seenKey);
      inserted += 1;
    }
  }
  if (inserted > 0) {
    evaluateDedupePrefixAchievements(w, OUTFIELD_TILE_SEEN_PREFIX, unlocks);
  }
  if (unlocks.length > 0 && onUnlock) onUnlock(unlocks);
  return inserted;
}

export function recordFloorRecolored(
  wallet: string,
  roomId: string,
  x: number,
  z: number,
  colorRgb: number,
  onUnlock?: AchievementUnlockCallback,
  opts?: { ownedRoomDeluxe?: boolean }
): void {
  if (!isAchievementEligibleWallet(wallet)) return;
  const w = normalizeWallet(wallet);
  const unlocks: AchievementUnlockWire[] = [];
  let newDistinctRecolor = false;
  if (isPalettePainterEligibleRoom(roomId)) {
    const recolorKey = floorRecolorSeenKey(roomId, x, z);
    if (recordAchievementSeen(w, recolorKey)) {
      newDistinctRecolor = true;
      evaluateDedupePrefixAchievements(w, FLOOR_RECOLOR_SEEN_PREFIX, unlocks);
    }
  }
  const hueBucket = hueBucketFromColorRgb(colorRgb);
  if (hueBucket >= 0) {
    const hueKey = rainbowHueSeenKey(roomId, hueBucket);
    if (recordAchievementSeen(w, hueKey)) {
      evaluateRainbowFloorAchievements(
        w,
        roomId,
        unlocks
      );
    }
  }
  if (opts?.ownedRoomDeluxe && newDistinctRecolor) {
    const progress = getRoomDeluxeProgress(w, roomId);
    progress.recolors += 1;
    setRoomDeluxeProgress(w, roomId, progress);
    evaluateRoomMakerDeluxeAchievements(w, unlocks);
  }
  if (unlocks.length > 0 && onUnlock) onUnlock(unlocks);
}

export function recordTerrainShapePlaced(
  wallet: string,
  shape: {
    hex: boolean;
    pyramid: boolean;
    sphere: boolean;
    ramp: boolean;
  },
  onUnlock?: AchievementUnlockCallback
): void {
  if (!isAchievementEligibleWallet(wallet)) return;
  const w = normalizeWallet(wallet);
  const unlocks: AchievementUnlockWire[] = [];
  const kind = terrainShapeKindFromPrism(shape);
  if (recordAchievementSeen(w, shapeSeenKey(kind))) {
    evaluateDedupePrefixAchievements(w, "shape:", unlocks);
  }
  if (unlocks.length > 0 && onUnlock) onUnlock(unlocks);
}

export function recordPrefabPublished(
  wallet: string,
  visibility: "private" | "public",
  kind: "object" | "room",
  onUnlock?: AchievementUnlockCallback
): void {
  if (!isAchievementEligibleWallet(wallet)) return;
  if (visibility !== "public" || kind !== "object") return;
  fireAchievementEvent(wallet, "prefab_author", onUnlock);
}

export function recordPrefabStampedByOther(
  creatorWallet: string,
  stamperWallet: string,
  designId: string,
  visibility: "private" | "public",
  onUnlock?: AchievementUnlockForWalletCallback
): void {
  if (visibility !== "public") return;
  if (!isAchievementEligibleWallet(creatorWallet)) return;
  const creator = normalizeWallet(creatorWallet);
  const stamper = normalizeWallet(stamperWallet);
  if (!stamper || creator === stamper) return;
  const unlocks: AchievementUnlockWire[] = [];
  if (recordAchievementSeen(creator, prefabAdoptionSeenKey(designId))) {
    evaluateDedupePrefixAchievements(
      creator,
      PREFAB_ADOPTION_SEEN_PREFIX,
      unlocks
    );
  }
  if (unlocks.length > 0 && onUnlock) onUnlock(creator, unlocks);
}

export function recordSignpostPlaced(
  wallet: string,
  message: string,
  onUnlock?: AchievementUnlockCallback
): void {
  if (!isAchievementEligibleWallet(wallet)) return;
  if (String(message ?? "").trim().length < 40) return;
  fireAchievementEvent(wallet, "signpost_scribe", onUnlock);
}

export function recordSignboardOpened(
  wallet: string,
  signboardId: string,
  authorWallet: string,
  onUnlock?: AchievementUnlockCallback
): void {
  if (!isAchievementEligibleWallet(wallet)) return;
  const w = normalizeWallet(wallet);
  const author = normalizeWallet(authorWallet);
  if (!author || w === author) return;
  const unlocks: AchievementUnlockWire[] = [];
  const key = signpostReadSeenKey(signboardId);
  if (recordAchievementSeen(w, key)) {
    evaluateDedupePrefixAchievements(w, SIGNPOST_READ_SEEN_PREFIX, unlocks);
  }
  if (unlocks.length > 0 && onUnlock) onUnlock(unlocks);
}

export function recordGatekeeperOpen(
  wallet: string,
  gateOwnerWallet: string,
  inHub: boolean,
  onUnlock?: AchievementUnlockCallback
): void {
  if (!isAchievementEligibleWallet(wallet) || !inHub) return;
  const w = normalizeWallet(wallet);
  const owner = normalizeWallet(gateOwnerWallet);
  if (!owner || w === owner) return;
  fireAchievementEvent(w, "gatekeeper", onUnlock);
}

export function recordTrustCircleWalk(
  wallet: string,
  gateOwnerWallet: string,
  onAcl: boolean,
  inHub: boolean,
  onUnlock?: AchievementUnlockCallback
): void {
  if (!isAchievementEligibleWallet(wallet) || inHub || !onAcl) return;
  const w = normalizeWallet(wallet);
  const owner = normalizeWallet(gateOwnerWallet);
  if (!owner || w === owner) return;
  fireAchievementEvent(w, "trust_circle", onUnlock);
}

export function recordRoomCreatedForDeluxe(
  wallet: string,
  roomId: string,
  onUnlock?: AchievementUnlockCallback
): void {
  touchRoomDeluxeProgress(
    wallet,
    roomId,
    (progress) => {
      progress.created = true;
    },
    onUnlock
  );
}

export function recordRoomJoinSpawnForDeluxe(
  wallet: string,
  roomId: string,
  onUnlock?: AchievementUnlockCallback
): void {
  touchRoomDeluxeProgress(
    wallet,
    roomId,
    (progress) => {
      progress.spawn = true;
    },
    onUnlock
  );
}

export function recordOwnedRoomBlockPlaced(
  wallet: string,
  roomId: string,
  colorRgb: number,
  onUnlock?: AchievementUnlockCallback
): void {
  if (!isAchievementEligibleWallet(wallet)) return;
  const w = normalizeWallet(wallet);
  touchRoomDeluxeProgress(
    w,
    roomId,
    (progress) => {
      if (progress.blocks < Number.MAX_SAFE_INTEGER) {
        progress.blocks += 1;
      }
    },
    onUnlock
  );
  const furnisher = getRoomFurnisherProgress(w, roomId);
  if (furnisher.blocks < Number.MAX_SAFE_INTEGER) {
    furnisher.blocks += 1;
  }
  recordRoomFurnisherHueBucket(furnisher, hueBucketFromColorRgb(colorRgb));
  setRoomFurnisherProgress(w, roomId, furnisher);
  const unlocks: AchievementUnlockWire[] = [];
  evaluateRoomFurnisherAchievements(w, unlocks);
  if (unlocks.length > 0 && onUnlock) onUnlock(unlocks);
}

export function recordTeleporterActivated(
  wallet: string,
  onUnlock?: AchievementUnlockCallback
): void {
  fireAchievementEvent(wallet, "teleporter_activated", onUnlock);
}

/** Re-evaluate Grand Tour on UTC midnight for online players (daily row resets by day key). */
export function tickExplorationDailyRollover(
  nowMs: number,
  collectOnline: () => ReadonlyArray<{ wallet: string; roomId: string }>,
  onUnlock?: (wallet: string, unlocks: AchievementUnlockWire[]) => void
): void {
  const today = utcCalendarDay(new Date(nowMs));
  if (lastExplorationUtcDay === null) {
    lastExplorationUtcDay = today;
    return;
  }
  if (lastExplorationUtcDay === today) return;
  lastExplorationUtcDay = today;
  for (const entry of collectOnline()) {
    recordExplorationRoomEntry(
      entry.wallet,
      entry.roomId,
      onUnlock ? (unlocks) => onUnlock(entry.wallet, unlocks) : undefined,
      today
    );
  }
}

export function getAchievementCounterValue(
  wallet: string,
  counter: AchievementCounterKey
): number {
  return getCounterValue(normalizeWallet(wallet), counter);
}

function buildProgressRow(
  wallet: string,
  def: AchievementDefinition,
  completedAtMs: number | null
): AchievementProgressPublic {
  const counterKey = counterKeyForDef(def);
  const threshold = counterThreshold(def);
  let progress =
    counterKey != null
      ? Math.min(threshold, getCounterValue(wallet, counterKey))
      : completedAtMs != null
        ? 1
        : 0;
  if (def.criteria.type === "onboarding_complete") {
    progress =
      completedAtMs != null
        ? threshold
        : countOnboardingPrerequisitesComplete(
            listCompletedAchievementIds(wallet)
          );
  } else if (def.criteria.type === "login_streak") {
    progress =
      completedAtMs != null
        ? threshold
        : Math.min(threshold, getLoginStreakDaysForWallet(wallet));
  } else if (def.criteria.type === "dedupe_count") {
    progress =
      completedAtMs != null
        ? threshold
        : Math.min(
            threshold,
            countSeenKeysWithPrefix(wallet, def.criteria.seenPrefix)
          );
  } else if (def.criteria.type === "daily_set") {
    const visited = parseGrandTourVisitedKeys(
      getAchievementDailyState(
        wallet,
        utcCalendarDay(),
        GRAND_TOUR_DAILY_STATE_KEY
      )
    );
    progress =
      completedAtMs != null
        ? threshold
        : Math.min(threshold, countGrandTourProgress(visited));
  } else if (def.criteria.type === "ap_threshold") {
    progress =
      completedAtMs != null
        ? threshold
        : Math.min(threshold, totalPointsForWallet(wallet));
  } else if (def.criteria.type === "rainbow_floor") {
    progress =
      completedAtMs != null
        ? threshold
        : Math.min(threshold, maxRainbowHueProgress(wallet));
  } else if (def.criteria.type === "room_maker_deluxe") {
    progress =
      completedAtMs != null
        ? threshold
        : Math.min(threshold, maxRoomDeluxeProgress(wallet));
  } else if (def.criteria.type === "owned_room_furnisher") {
    progress =
      completedAtMs != null
        ? threshold
        : Math.min(threshold, maxRoomFurnisherProgress(wallet));
  } else if (def.criteria.type === "streak_counter") {
    progress =
      completedAtMs != null
        ? threshold
        : Math.min(
            threshold,
            getCounterValue(wallet, def.criteria.counter)
          );
  }
  return {
    achievementId: def.id,
    title: def.title,
    description: achievementPublicDescription(def),
    category: def.category,
    categoryGroup: def.categoryGroup ?? null,
    points: def.points,
    completed: completedAtMs != null,
    completedAt:
      completedAtMs != null
        ? new Date(completedAtMs).toISOString()
        : null,
    progress,
    threshold,
    rewardSku: def.rewardSku ?? null,
    rewardDisplayName: rewardDisplayName(def.rewardSku),
    rewardPresetId: rewardPresetId(def.rewardSku),
    sortOrder: def.sortOrder,
  };
}

export function getAchievementsForWallet(
  wallet: string
): AchievementMePayload {
  const w = normalizeWallet(wallet);
  if (!w) return { totalPoints: 0, achievements: [], telescopeUnlocked: false };
  ensureAchievementRewardEntitlements(w);
  evaluateOnboardingCompleteAchievements(w, []);
  evaluateLoginStreakAchievementsCollecting(
    w,
    getLoginStreakDaysForWallet(w),
    []
  );
  evaluateApThresholdAchievements(w, []);
  const completionRows = requireDb()
    .prepare(
      `SELECT achievement_id, completed_at_ms FROM achievement_completions
       WHERE wallet = ?`
    )
    .all(w) as Array<{ achievement_id: string; completed_at_ms: number }>;
  const completedAt = new Map(
    completionRows.map((r) => [r.achievement_id, r.completed_at_ms] as const)
  );
  const achievements = ACHIEVEMENT_DEFINITIONS.map((def) =>
    buildProgressRow(w, def, completedAt.get(def.id) ?? null)
  ).sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
  return {
    totalPoints: totalPointsForWallet(w),
    achievements,
    telescopeUnlocked: isTelescopeUnlockedForWallet(w),
  };
}

export function getPublicAchievementSummary(
  wallet: string,
  highlightLimit = 5
): AchievementPublicSummary {
  const w = normalizeWallet(wallet);
  if (!w) return { totalPoints: 0, recentHighlights: [] };
  const rows = requireDb()
    .prepare(
      `SELECT c.achievement_id, c.completed_at_ms, c.points_awarded
       FROM achievement_completions c
       WHERE c.wallet = ?
       ORDER BY c.completed_at_ms DESC
       LIMIT ?`
    )
    .all(w, highlightLimit) as Array<{
    achievement_id: string;
    completed_at_ms: number;
    points_awarded: number;
  }>;
  const recentHighlights: AchievementHighlightPublic[] = [];
  for (const row of rows) {
    const def = getAchievementDefinition(row.achievement_id);
    if (!def) continue;
    recentHighlights.push({
      achievementId: def.id,
      title: def.title,
      points: row.points_awarded,
      completedAt: new Date(row.completed_at_ms).toISOString(),
    });
  }
  return {
    totalPoints: totalPointsForWallet(w),
    recentHighlights,
  };
}
