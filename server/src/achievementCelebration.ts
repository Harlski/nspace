/** Max in-world trophy pops per unlock burst (Achievement Unlock Celebration). */
export const ACHIEVEMENT_CELEBRATION_CAP = 3;

/** How many room broadcasts to send when `unlockCount` achievements unlock at once. */
export function achievementCelebrationCount(unlockCount: number): number {
  if (!Number.isFinite(unlockCount) || unlockCount <= 0) return 0;
  return Math.min(Math.floor(unlockCount), ACHIEVEMENT_CELEBRATION_CAP);
}
