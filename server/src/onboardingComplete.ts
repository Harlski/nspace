import {
  ACHIEVEMENT_DEFINITIONS,
  type AchievementDefinition,
} from "./achievementDefinitions.js";

/** Capstone Getting started achievement - unlocks the in-world Telescope control. */
export const TELESCOPE_ACHIEVEMENT_ID = "telescope";

/** Onboarding achievements that complement but do not gate the Telescope capstone. */
export const TELESCOPE_EXCLUDED_ONBOARDING_IDS = new Set([
  TELESCOPE_ACHIEVEMENT_ID,
  "first-nim",
]);

export function listOnboardingPrerequisiteDefinitions(): ReadonlyArray<AchievementDefinition> {
  return ACHIEVEMENT_DEFINITIONS.filter(
    (d) =>
      d.category === "onboarding" &&
      !TELESCOPE_EXCLUDED_ONBOARDING_IDS.has(d.id)
  );
}

export function countOnboardingPrerequisitesComplete(
  completedIds: ReadonlySet<string>
): number {
  return listOnboardingPrerequisiteDefinitions().filter((d) =>
    completedIds.has(d.id)
  ).length;
}

export function isAllOnboardingPrerequisitesComplete(
  completedIds: ReadonlySet<string>
): boolean {
  const prereqs = listOnboardingPrerequisiteDefinitions();
  return prereqs.length > 0 && prereqs.every((d) => completedIds.has(d.id));
}

export function getTelescopeAchievementDefinition():
  | AchievementDefinition
  | undefined {
  return ACHIEVEMENT_DEFINITIONS.find((d) => d.id === TELESCOPE_ACHIEVEMENT_ID);
}
