import { describe, it, expect } from "vitest";
import type { AchievementProgress } from "./api.js";
import {
  SUMMARY_VIEW_ID,
  achievementsForCategory,
  categoryLabel,
  navEntries,
  navRows,
  orderedCategories,
  overallProgress,
  progressPercent,
  recentCompletedAchievements,
  isAchievementVisibleInView,
  syncDerivedAchievementProgress,
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
      categoryGroup: "building",
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
      { id: "commons_build", label: "Commons", earned: 0, total: 1, nested: true },
    ]);
  });

  it("groups building categories under a header in nav rows", () => {
    const rows: AchievementProgress[] = [
      ach({
        achievementId: "commons",
        category: "commons_build",
        categoryGroup: "building",
        sortOrder: 100,
      }),
      ach({
        achievementId: "pixel",
        category: "pixel",
        categoryGroup: "building",
        sortOrder: 150,
      }),
      ach({
        achievementId: "mine",
        category: "mining",
        sortOrder: 200,
      }),
    ];
    expect(navRows(rows)).toEqual([
      { kind: "entry", id: SUMMARY_VIEW_ID, label: "Summary", earned: 0, total: 3 },
      {
        kind: "group-header",
        groupId: "building",
        label: "Building",
      },
      {
        kind: "entry",
        id: "commons_build",
        label: "Commons",
        earned: 0,
        total: 1,
        nested: true,
      },
      {
        kind: "entry",
        id: "pixel",
        label: "Pixel",
        earned: 0,
        total: 1,
        nested: true,
      },
      {
        kind: "entry",
        id: "mining",
        label: "Mining",
        earned: 0,
        total: 1,
      },
    ]);
  });

  it("keeps one building header when worldcraft sort order is after other categories", () => {
    const rows: AchievementProgress[] = [
      ach({
        achievementId: "commons",
        category: "commons_build",
        categoryGroup: "building",
        sortOrder: 100,
      }),
      ach({
        achievementId: "pixel",
        category: "pixel",
        categoryGroup: "building",
        sortOrder: 150,
      }),
      ach({
        achievementId: "mine",
        category: "mining",
        sortOrder: 200,
      }),
      ach({
        achievementId: "social",
        category: "social",
        sortOrder: 3000,
      }),
      ach({
        achievementId: "worldcraft-palette-painter-1",
        category: "worldcraft",
        categoryGroup: "building",
        sortOrder: 5000,
      }),
    ];
    expect(navRows(rows)).toEqual([
      { kind: "entry", id: SUMMARY_VIEW_ID, label: "Summary", earned: 0, total: 5 },
      {
        kind: "group-header",
        groupId: "building",
        label: "Building",
      },
      {
        kind: "entry",
        id: "commons_build",
        label: "Commons",
        earned: 0,
        total: 1,
        nested: true,
      },
      {
        kind: "entry",
        id: "pixel",
        label: "Pixel",
        earned: 0,
        total: 1,
        nested: true,
      },
      {
        kind: "entry",
        id: "worldcraft",
        label: "Worldcraft",
        earned: 0,
        total: 1,
        nested: true,
      },
      {
        kind: "entry",
        id: "mining",
        label: "Mining",
        earned: 0,
        total: 1,
      },
      {
        kind: "entry",
        id: "social",
        label: "Social",
        earned: 0,
        total: 1,
      },
    ]);
  });

  it("groups minigames football categories under a header in nav rows", () => {
    const rows: AchievementProgress[] = [
      ach({
        achievementId: "match",
        category: "football_match",
        categoryGroup: "minigames",
        sortOrder: 1000,
      }),
      ach({
        achievementId: "field",
        category: "football_free_play",
        categoryGroup: "minigames",
        sortOrder: 2000,
      }),
      ach({
        achievementId: "social",
        category: "social",
        sortOrder: 3000,
      }),
    ];
    expect(navRows(rows)).toEqual([
      { kind: "entry", id: SUMMARY_VIEW_ID, label: "Summary", earned: 0, total: 3 },
      {
        kind: "group-header",
        groupId: "minigames",
        label: "Minigames",
      },
      {
        kind: "entry",
        id: "football_match",
        label: "Football Match",
        earned: 0,
        total: 1,
        nested: true,
      },
      {
        kind: "entry",
        id: "football_free_play",
        label: "Football Free Play",
        earned: 0,
        total: 1,
        nested: true,
      },
      {
        kind: "entry",
        id: "social",
        label: "Social",
        earned: 0,
        total: 1,
      },
    ]);
  });

  it("labels exploration category for Achievements Window navigator", () => {
    expect(categoryLabel("exploration")).toBe("Exploration");
    const rows: AchievementProgress[] = [
      ach({
        achievementId: "marathon",
        category: "exploration",
        sortOrder: 4000,
      }),
    ];
    expect(navRows(rows)).toEqual([
      { kind: "entry", id: SUMMARY_VIEW_ID, label: "Summary", earned: 0, total: 1 },
      {
        kind: "entry",
        id: "exploration",
        label: "Exploration",
        earned: 0,
        total: 1,
      },
    ]);
  });

  it("labels worldcraft category for Achievements Window navigator", () => {
    expect(categoryLabel("worldcraft")).toBe("Worldcraft");
    const rows: AchievementProgress[] = [
      ach({
        achievementId: "worldcraft-palette-painter-1",
        category: "worldcraft",
        categoryGroup: "building",
        sortOrder: 5000,
      }),
    ];
    expect(navRows(rows)).toEqual([
      { kind: "entry", id: SUMMARY_VIEW_ID, label: "Summary", earned: 0, total: 1 },
      {
        kind: "group-header",
        groupId: "building",
        label: "Building",
      },
      {
        kind: "entry",
        id: "worldcraft",
        label: "Worldcraft",
        earned: 0,
        total: 1,
        nested: true,
      },
    ]);
  });

  it("labels misc category for Achievements Window navigator", () => {
    expect(categoryLabel("misc")).toBe("Misc");
    const rows: AchievementProgress[] = [
      ach({
        achievementId: "mining-billboard-audience",
        category: "misc",
        sortOrder: 3100,
      }),
    ];
    expect(navRows(rows)).toEqual([
      { kind: "entry", id: SUMMARY_VIEW_ID, label: "Summary", earned: 0, total: 1 },
      {
        kind: "entry",
        id: "misc",
        label: "Misc",
        earned: 0,
        total: 1,
      },
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

  it("knows when an achievement row is visible in a view", () => {
    expect(isAchievementVisibleInView(sample, "mining", "c")).toBe(true);
    expect(isAchievementVisibleInView(sample, "onboarding", "c")).toBe(false);
    expect(isAchievementVisibleInView(sample, SUMMARY_VIEW_ID, "b")).toBe(true);
    expect(isAchievementVisibleInView(sample, SUMMARY_VIEW_ID, "c")).toBe(false);
    expect(isAchievementVisibleInView(sample, "onboarding", "missing")).toBe(
      false
    );
  });

  it("recomputes Telescope progress from completed onboarding prerequisites", () => {
    const rows: AchievementProgress[] = [
      ach({
        achievementId: "a",
        category: "onboarding",
        completed: true,
        completedAt: "2026-01-01T00:00:00.000Z",
      }),
      ach({
        achievementId: "b",
        category: "onboarding",
        completed: true,
        completedAt: "2026-01-02T00:00:00.000Z",
      }),
      ach({
        achievementId: "c",
        category: "onboarding",
        completed: false,
        progress: 0,
        threshold: 1,
      }),
      ach({
        achievementId: "telescope",
        category: "onboarding",
        completed: false,
        progress: 0,
        threshold: 9,
      }),
    ];
    const synced = syncDerivedAchievementProgress(rows);
    const telescope = synced.find((a) => a.achievementId === "telescope");
    expect(telescope?.progress).toBe(2);
    expect(telescope?.threshold).toBe(3);
  });
});
