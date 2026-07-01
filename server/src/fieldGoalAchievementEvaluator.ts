/** Pure helpers for Free Play Field achievement extensions (v3). */

export const FIELD_GOAL_DAILY_STREAK_THRESHOLD = 3;

export type FieldGoalDailyStreakUpdate = {
  streak: number;
  /** False when the scorer already credited a goal today (no streak change). */
  firstScoreToday: boolean;
};

/** UTC calendar day immediately before `utcDay` (`YYYY-MM-DD`). */
export function previousUtcCalendarDay(utcDay: string): string {
  const d = new Date(`${utcDay}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Next field-goal daily streak after a credited goal on `todayUtcDay`.
 * `lastScoredUtcDay` is the wallet's most recent prior scoring day, or null.
 */
export function computeFieldGoalDailyStreakUpdate(
  priorStreak: number,
  lastScoredUtcDay: string | null,
  todayUtcDay: string
): FieldGoalDailyStreakUpdate {
  if (lastScoredUtcDay === todayUtcDay) {
    return { streak: Math.max(0, priorStreak), firstScoreToday: false };
  }
  const yesterday = previousUtcCalendarDay(todayUtcDay);
  if (lastScoredUtcDay === yesterday) {
    return {
      streak: Math.max(1, priorStreak) + 1,
      firstScoreToday: true,
    };
  }
  return { streak: 1, firstScoreToday: true };
}

/** True when `countryCode` is absent from the top N countries on today's board. */
export function isUnderdogCountryAtGoalTime(
  countryCode: string | null | undefined,
  topCountries: ReadonlyArray<{ code: string; goals: number }>,
  topN = 3
): boolean {
  const code = String(countryCode ?? "").trim();
  if (!code) return false;
  const leaders = topCountries.slice(0, topN).map((row) => row.code);
  if (leaders.length === 0) return true;
  return !leaders.includes(code);
}

/** Rush Hour requires a contested goal with at least four distinct players on pitch. */
export function isRushHourFieldGoal(distinctPlayersOnPitch: number): boolean {
  return distinctPlayersOnPitch >= 4;
}
