import { apiUrl } from "../net/apiBase.js";
import { loadCachedSession } from "../auth/session.js";

export type AchievementProgress = {
  achievementId: string;
  title: string;
  description: string;
  category: string;
  categoryGroup?: string | null;
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

export type AchievementMeResponse = {
  totalPoints: number;
  achievements: AchievementProgress[];
  telescopeUnlocked?: boolean;
};

export type AchievementHighlight = {
  achievementId: string;
  title: string;
  points: number;
  completedAt: string;
};

export type AchievementUnlockMessage = {
  achievementId: string;
  title: string;
  description: string;
  points: number;
  rewardSku: string | null;
  rewardDisplayName: string | null;
  totalPoints: number;
};

const ACHIEVEMENTS_SESSION_CACHE_MS = 60_000;

let achievementsFetchInflight: Promise<AchievementMeResponse | null> | null =
  null;
let achievementsSessionCache: AchievementMeResponse | null = null;
let achievementsSessionCachedAt = 0;

/** Clears the in-memory achievements snapshot (call after unlocks). */
export function invalidateAchievementsCache(): void {
  achievementsSessionCache = null;
  achievementsSessionCachedAt = 0;
}

export async function fetchMyAchievements(opts?: {
  force?: boolean;
}): Promise<AchievementMeResponse | null> {
  const token = loadCachedSession()?.token ?? null;
  if (!token) return null;
  const force = opts?.force === true;
  const now = Date.now();
  if (
    !force &&
    achievementsSessionCache &&
    now - achievementsSessionCachedAt < ACHIEVEMENTS_SESSION_CACHE_MS
  ) {
    return achievementsSessionCache;
  }
  if (achievementsFetchInflight) return achievementsFetchInflight;
  achievementsFetchInflight = (async () => {
    const r = await fetch(apiUrl("/api/achievements/me"), {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const payload = (await r.json()) as AchievementMeResponse;
    achievementsSessionCache = payload;
    achievementsSessionCachedAt = Date.now();
    return payload;
  })().finally(() => {
    achievementsFetchInflight = null;
  });
  return achievementsFetchInflight;
}
