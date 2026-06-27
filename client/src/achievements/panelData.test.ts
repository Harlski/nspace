import { describe, it, expect } from "vitest";
import type { AchievementProgress } from "./api.js";
import {
  SUMMARY_VIEW_ID,
  achievementsForCategory,
  navEntries,
  orderedCategories,
  overallProgress,
  progressPercent,
  recentCompletedAchievements,
} from "./panelData.js";

function ach(
  partial: Partial<AchievementProgress> & Pick<AchievementProgress, "achievementId">
): AchievementProgress {
  return {
    title: partial.achievementId,
    description: "",
    category: "onboarding",
    points: 10,
    completed: false,
    completedAt: null,
    progress: 0,
    threshold: 1,
    rewardSku: null,
    rewardDisplayName: null,
    rewardPresetId: null,
    sortOrder: 0,
    ...partial,
  };
}

describe("achievement panel data", () => {
  const sample: AchievementProgress[] = [
    ach({
      achievementId: "a",
      category: "onboarding",
      completed: true,
      completedAt: "2026-01-02T00:00:00.000Z",
      sortOrder: 20,
    }),
    ach({
      achievementId: "b",
      category: "onboarding",
      completed: true,
      completedAt: "2026-01-03T00:00:00.000Z",
      sortOrder: 10,
    }),
    ach({
      achievementId: "c",
      category: "mining",
      completed: false,
      sortOrder: 5,
    }),
    ach({
      achievementId: "d",
      category: "commons_build",
      completed: false,
      sortOrder: 15,
    }),
  ];

  it("orders categories by earliest sortOrder in each group", () => {
    expect(orderedCategories(sample)).toEqual([
      "mining",
      "onboarding",
      "commons_build",
    ]);
  });

  it("lists recent completions newest first", () => {
    const recent = recentCompletedAchievements(sample);
    expect(recent.map((a) => a.achievementId)).toEqual(["b", "a"]);
  });

  it("builds navigator entries with summary first", () => {
    expect(navEntries(sample)).toEqual([
      { id: SUMMARY_VIEW_ID, label: "Summary", earned: 2, total: 4 },
      { id: "mining", label: "Mining", earned: 0, total: 1 },
      { id: "onboarding", label: "Getting started", earned: 2, total: 2 },
      { id: "commons_build", label: "Commons building", earned: 0, total: 1 },
    ]);
  });

  it("filters achievements for a category", () => {
    expect(achievementsForCategory(sample, "onboarding").map((a) => a.achievementId)).toEqual([
      "b",
      "a",
    ]);
  });

  it("computes overall progress and percent", () => {
    expect(overallProgress(sample)).toEqual({ earned: 2, total: 4 });
    expect(progressPercent(2, 4)).toBe(50);
  });
});
