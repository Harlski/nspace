import type { AchievementProgress } from "./api.js";

export const SUMMARY_VIEW_ID = "__summary__" as const;

export type AchievementViewId = typeof SUMMARY_VIEW_ID | string;

export const CATEGORY_LABELS: Record<string, string> = {
  onboarding: "Getting started",
  commons_build: "Commons building",
  mining: "Mining",
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

export function overallProgress(achievements: AchievementProgress[]): {
  earned: number;
  total: number;
} {
  return {
    earned: achievements.filter((a) => a.completed).length,
    total: achievements.length,
  };
}

export function categoryProgress(
  achievements: AchievementProgress[],
  category: string
): { earned: number; total: number } {
  const rows = achievements.filter((a) => a.category === category);
  return {
    earned: rows.filter((a) => a.completed).length,
    total: rows.length,
  };
}

export function orderedCategories(achievements: AchievementProgress[]): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  const sorted = [...achievements].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title)
  );
  for (const a of sorted) {
    if (!seen.has(a.category)) {
      seen.add(a.category);
      order.push(a.category);
    }
  }
  return order;
}

export function recentCompletedAchievements(
  achievements: AchievementProgress[],
  limit = 4
): AchievementProgress[] {
  return achievements
    .filter((a) => a.completed && a.completedAt)
    .sort(
      (a, b) =>
        new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime()
    )
    .slice(0, limit);
}

export function achievementsForCategory(
  achievements: AchievementProgress[],
  category: string
): AchievementProgress[] {
  return achievements
    .filter((a) => a.category === category)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
}

export function viewTitle(viewId: AchievementViewId): string {
  if (viewId === SUMMARY_VIEW_ID) return "Summary";
  return categoryLabel(viewId);
}

export type AchievementNavEntry = {
  id: AchievementViewId;
  label: string;
  earned: number;
  total: number;
};

export function navEntries(
  achievements: AchievementProgress[]
): AchievementNavEntry[] {
  const summary = overallProgress(achievements);
  const entries: AchievementNavEntry[] = [
    {
      id: SUMMARY_VIEW_ID,
      label: "Summary",
      earned: summary.earned,
      total: summary.total,
    },
  ];
  for (const cat of orderedCategories(achievements)) {
    const progress = categoryProgress(achievements, cat);
    entries.push({
      id: cat,
      label: categoryLabel(cat),
      earned: progress.earned,
      total: progress.total,
    });
  }
  return entries;
}

export function progressPercent(earned: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((earned / total) * 100));
}
