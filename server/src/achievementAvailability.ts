/**
 * Achievement Availability: Complete, in progress, or Temporarily unavailable
 * when a live feature dependency (Shop / The Shaper) is off.
 * Distinct from Football seasonal pause, which does not use this label.
 */

export type AchievementAvailability =
  | "complete"
  | "in_progress"
  | "temporarily_unavailable";

export type AchievementFeatureDependency = "shop" | "shaper";

export const TEMPORARILY_UNAVAILABLE_LABEL = "Temporarily unavailable";

export function isFeatureDependencyOff(opts: {
  featureDependency?: AchievementFeatureDependency;
  shopOpen: boolean;
  shaperReachable: boolean;
}): boolean {
  if (opts.featureDependency === "shop") return !opts.shopOpen;
  if (opts.featureDependency === "shaper") return !opts.shaperReachable;
  return false;
}

export function achievementAvailability(opts: {
  completed: boolean;
  featureDependency?: AchievementFeatureDependency;
  shopOpen: boolean;
  shaperReachable: boolean;
}): AchievementAvailability {
  if (opts.completed) return "complete";
  if (isFeatureDependencyOff(opts)) return "temporarily_unavailable";
  return "in_progress";
}

/** Incomplete Temporarily unavailable rows drop out of Progress Overview fractions. */
export function countsTowardProgressOverview(opts: {
  completed: boolean;
  availability?: AchievementAvailability | null;
}): boolean {
  if (opts.completed) return true;
  return opts.availability !== "temporarily_unavailable";
}

/** Skip Completing (and progress unlock) while incomplete and Temporarily unavailable. */
export function shouldIgnoreAchievementProgress(opts: {
  completed: boolean;
  featureDependency?: AchievementFeatureDependency;
  shopOpen: boolean;
  shaperReachable: boolean;
}): boolean {
  if (opts.completed) return false;
  return isFeatureDependencyOff(opts);
}
