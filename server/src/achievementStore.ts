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
  listAchievementsForEvent,
} from "./achievementDefinitions.js";
import {
  evaluateMatchAchievementsForParticipant,
  type MatchEndParticipantInput,
  type MatchWinReason,
  type MatchParticipantResult,
} from "./matchAchievementEvaluator.js";
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
} from "./cosmeticStore.js";

const ACHIEVEMENT_ACTOR = "NQ07 ACHIEV0000000000000000000000001";

function envInt(name: string, dflt: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw.trim() === "") return dflt;
  const n = Math.floor(Number(raw.trim()));
  return Number.isFinite(n) && n >= 0 ? n : dflt;
}

/** Operator-configured top login-streak tier (Time of Kaan). Default 60 UTC days. */
export function getAchievementLoginStreakTopThreshold(): number {
  return Math.max(1, envInt("ACHIEVEMENT_LOGIN_STREAK_TOP", 60));
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

function counterThreshold(def: AchievementDefinition): number {
  if (def.criteria.type === "counter") return def.criteria.threshold;
  if (def.criteria.type === "onboarding_complete") {
    return listOnboardingPrerequisiteDefinitions().length;
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
  const rows = requireDb()
    .prepare(
      `SELECT DISTINCT reward_sku AS reward_sku FROM achievement_completions
       WHERE wallet = ? AND reward_sku IS NOT NULL AND reward_sku != ''`
    )
    .all(w) as Array<{ reward_sku: string }>;
  for (const row of rows) {
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
    description: def.description,
    points: def.points,
    rewardSku: def.rewardSku ?? null,
    rewardDisplayName: rewardDisplayName(def.rewardSku),
    totalPoints,
  });
  evaluateOnboardingCompleteAchievements(wallet, unlocks);
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
    if (value >= def.criteria.threshold) {
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
  `);
  achievementTablesReady = true;
  seedAchievementRewardCatalog();
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
  onUnlock?: AchievementUnlockCallback
): void {
  if (!isWorldCupAchievementProgressEnabled()) return;
  const unlocks: AchievementUnlockWire[] = [];
  applyMatchEndParticipant(sideA, unlocks);
  applyMatchEndParticipant(sideB, unlocks);
  if (unlocks.length > 0 && onUnlock) onUnlock(unlocks);
}

export function recordFieldGoalScored(
  wallet: string,
  opts: { contested?: boolean; solo?: boolean } = {},
  onUnlock?: AchievementUnlockCallback
): void {
  if (!isWorldCupAchievementProgressEnabled() || !isAchievementEligibleWallet(wallet)) return;
  const unlocks: AchievementUnlockWire[] = [];
  bumpCounterCollecting(wallet, "field_goals_scored", 1, unlocks);
  fireEventCollecting(wallet, "field_goal_scored", unlocks);
  if (opts.contested) fireEventCollecting(wallet, "field_goal_contested", unlocks);
  if (opts.solo) fireEventCollecting(wallet, "field_goal_solo", unlocks);
  if (unlocks.length > 0 && onUnlock) onUnlock(unlocks);
}

export function recordChatMessageSent(
  wallet: string,
  onUnlock?: AchievementUnlockCallback
): void {
  bumpAchievementCounter(wallet, "chat_messages_sent", 1, onUnlock);
}

export function evaluateLoginStreakAchievements(
  wallet: string,
  streakDays: number,
  onUnlock?: AchievementUnlockCallback
): void {
  if (!isAchievementEligibleWallet(wallet)) return;
  const days = Math.max(0, Math.floor(streakDays));
  const unlocks: AchievementUnlockWire[] = [];
  if (days >= 7) fireEventCollecting(wallet, "login_streak_7", unlocks);
  if (days >= 30) fireEventCollecting(wallet, "login_streak_30", unlocks);
  if (days >= getAchievementLoginStreakTopThreshold()) {
    fireEventCollecting(wallet, "login_streak_top", unlocks);
  }
  if (unlocks.length > 0 && onUnlock) onUnlock(unlocks);
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
  }
  return {
    achievementId: def.id,
    title: def.title,
    description: def.description,
    category: def.category,
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
  evaluateOnboardingCompleteAchievements(w, []);
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
