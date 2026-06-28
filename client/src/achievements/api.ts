import { apiUrl } from "../net/apiBase.js";
import { loadCachedSession } from "../auth/session.js";

export type AchievementProgress = {
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

export async function fetchMyAchievements(): Promise<AchievementMeResponse | null> {
  const token = loadCachedSession()?.token ?? null;
  if (!token) return null;
  const r = await fetch(apiUrl("/api/achievements/me"), {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  return (await r.json()) as AchievementMeResponse;
}
