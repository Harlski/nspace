import type { AchievementProgress } from "./api.js";
import { TELESCOPE_ACHIEVEMENT_ID } from "../telescope/constants.js";

export const SUMMARY_VIEW_ID = "__summary__" as const;

export type AchievementViewId = typeof SUMMARY_VIEW_ID | string;

export const CATEGORY_LABELS: Record<string, string> = {
  onboarding: "Getting started",
  commons_build: "Commons",
  mining: "Mining",
  pixel: "Pixel",
  football_match: "Football Match",
  football_free_play: "Football Free Play",
  social: "Social",
  exploration: "Exploration",
  worldcraft: "Worldcraft",
  misc: "Misc",
};

export const CATEGORY_GROUP_LABELS: Record<string, string> = {
  building: "Building",
  minigames: "Minigames",
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

function categoryGroupForCategory(
  achievements: AchievementProgress[],
  category: string
): string | null {
  const row = achievements.find((a) => a.category === category);
  return row?.categoryGroup ?? null;
}

function categoryMinSortOrder(
  achievements: AchievementProgress[],
  category: string
): number {
  let min = Number.POSITIVE_INFINITY;
  for (const a of achievements) {
    if (a.category !== category) continue;
    if (a.sortOrder < min) min = a.sortOrder;
  }
  return Number.isFinite(min) ? min : 0;
}

type NavBlock =
  | { kind: "category"; category: string; sortOrder: number }
  | { kind: "group"; groupId: string; categories: string[]; sortOrder: number };

function navBlocks(achievements: AchievementProgress[]): NavBlock[] {
  const grouped = new Map<string, string[]>();
  const blocks: NavBlock[] = [];

  for (const category of orderedCategories(achievements)) {
    const group = categoryGroupForCategory(achievements, category);
    if (group) {
      const list = grouped.get(group) ?? [];
      list.push(category);
      grouped.set(group, list);
      continue;
    }
    blocks.push({
      kind: "category",
      category,
      sortOrder: categoryMinSortOrder(achievements, category),
    });
  }

  for (const [groupId, categories] of grouped) {
    blocks.push({
      kind: "group",
      groupId,
      categories,
      sortOrder: Math.min(
        ...categories.map((category) =>
          categoryMinSortOrder(achievements, category)
        )
      ),
    });
  }

  blocks.sort((a, b) => a.sortOrder - b.sortOrder);
  return blocks;
}

export type AchievementNavEntry = {
  id: AchievementViewId;
  label: string;
  earned: number;
  total: number;
  nested?: boolean;
};

export type AchievementNavRow =
  | ({ kind: "entry" } & AchievementNavEntry)
  | { kind: "group-header"; groupId: string; label: string };

export function navRows(achievements: AchievementProgress[]): AchievementNavRow[] {
  const rows: AchievementNavRow[] = [];
  const summary = overallProgress(achievements);
  rows.push({
    kind: "entry",
    id: SUMMARY_VIEW_ID,
    label: "Summary",
    earned: summary.earned,
    total: summary.total,
  });

  for (const block of navBlocks(achievements)) {
    if (block.kind === "category") {
      const progress = categoryProgress(achievements, block.category);
      rows.push({
        kind: "entry",
        id: block.category,
        label: categoryLabel(block.category),
        earned: progress.earned,
        total: progress.total,
      });
      continue;
    }

    rows.push({
      kind: "group-header",
      groupId: block.groupId,
      label: CATEGORY_GROUP_LABELS[block.groupId] ?? block.groupId,
    });
    for (const category of block.categories) {
      const progress = categoryProgress(achievements, category);
      rows.push({
        kind: "entry",
        id: category,
        label: categoryLabel(category),
        earned: progress.earned,
        total: progress.total,
        nested: true,
      });
    }
  }
  return rows;
}

export function navEntries(
  achievements: AchievementProgress[]
): AchievementNavEntry[] {
  return navRows(achievements)
    .filter((row): row is { kind: "entry" } & AchievementNavEntry => row.kind === "entry")
    .map(({ kind: _kind, ...entry }) => entry);
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

export function progressPercent(earned: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((earned / total) * 100));
}

/** Whether an achievement row is rendered in the given panel view. */
export function isAchievementVisibleInView(
  achievements: AchievementProgress[],
  viewId: AchievementViewId,
  achievementId: string
): boolean {
  const row = achievements.find((a) => a.achievementId === achievementId);
  if (!row) return false;
  if (viewId === SUMMARY_VIEW_ID) {
    return recentCompletedAchievements(achievements).some(
      (a) => a.achievementId === achievementId
    );
  }
  return viewId === row.category;
}

/**
 * Recompute client-side progress for achievements derived from other completions
 * (e.g. Telescope = completed Getting started prerequisites / total prerequisites).
 */
export function syncDerivedAchievementProgress(
  achievements: AchievementProgress[]
): AchievementProgress[] {
  const completedIds = new Set(
    achievements.filter((a) => a.completed).map((a) => a.achievementId)
  );
  const onboardingPrereqs = achievements.filter(
    (a) =>
      a.category === "onboarding" && a.achievementId !== TELESCOPE_ACHIEVEMENT_ID
  );
  const prereqProgress = onboardingPrereqs.filter((a) =>
    completedIds.has(a.achievementId)
  ).length;
  const prereqThreshold = onboardingPrereqs.length;

  return achievements.map((a) => {
    if (a.achievementId !== TELESCOPE_ACHIEVEMENT_ID || a.completed) {
      return a;
    }
    return { ...a, progress: prereqProgress, threshold: prereqThreshold };
  });
}
