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
  listAchievementsForCounter,
  listAchievementsForEvent,
} from "./achievementDefinitions.js";
import {
  createCatalogEntry,
  getCatalogEntry,
  grantEntitlement,
  initCosmeticStore,
  publishCatalogEntry,
} from "./cosmeticStore.js";

const ACHIEVEMENT_ACTOR = "NQ07 ACHIEV0000000000000000000000001";

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
    grantEntitlement(w, def.rewardSku, ACHIEVEMENT_ACTOR, "achievement");
  }
  return true;
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
  if (!isAchievementEligibleWallet(wallet) || delta <= 0) return;
  const w = normalizeWallet(wallet);
  const next = getCounterValue(w, counter) + delta;
  setCounterValue(w, counter, next);
  const unlocks: AchievementUnlockWire[] = [];
  evaluateCounterAchievements(w, counter, unlocks);
  if (unlocks.length > 0 && onUnlock) onUnlock(unlocks);
}

export function fireAchievementEvent(
  wallet: string,
  event: AchievementEventKey,
  onUnlock?: AchievementUnlockCallback
): void {
  if (!isAchievementEligibleWallet(wallet)) return;
  const w = normalizeWallet(wallet);
  const unlocks: AchievementUnlockWire[] = [];
  for (const def of listAchievementsForEvent(event)) {
    if (hasCompletion(w, def.id)) continue;
    completeAchievement(w, def, unlocks);
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
  const progress =
    counterKey != null ? Math.min(threshold, getCounterValue(wallet, counterKey)) : completedAtMs != null ? 1 : 0;
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
  if (!w) return { totalPoints: 0, achievements: [] };
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
