import assert from "node:assert/strict";
import test from "node:test";
import {
  computeFieldGoalDailyStreakUpdate,
  isRushHourFieldGoal,
  isUnderdogCountryAtGoalTime,
  previousUtcCalendarDay,
} from "../src/fieldGoalAchievementEvaluator.js";

test("previousUtcCalendarDay steps back one UTC day", () => {
  assert.equal(previousUtcCalendarDay("2026-07-02"), "2026-07-01");
  assert.equal(previousUtcCalendarDay("2026-01-01"), "2025-12-31");
});

test("field goal daily streak starts at one on first scored day", () => {
  const update = computeFieldGoalDailyStreakUpdate(0, null, "2026-07-01");
  assert.equal(update.streak, 1);
  assert.equal(update.firstScoreToday, true);
});

test("field goal daily streak increments on consecutive UTC days", () => {
  const day2 = computeFieldGoalDailyStreakUpdate(1, "2026-07-01", "2026-07-02");
  assert.equal(day2.streak, 2);
  assert.equal(day2.firstScoreToday, true);

  const day3 = computeFieldGoalDailyStreakUpdate(2, "2026-07-02", "2026-07-03");
  assert.equal(day3.streak, 3);
});

test("field goal daily streak resets after a gap day", () => {
  const update = computeFieldGoalDailyStreakUpdate(5, "2026-07-01", "2026-07-03");
  assert.equal(update.streak, 1);
});

test("second goal same UTC day does not bump streak", () => {
  const update = computeFieldGoalDailyStreakUpdate(2, "2026-07-02", "2026-07-02");
  assert.equal(update.streak, 2);
  assert.equal(update.firstScoreToday, false);
});

test("underdog country excludes top three leaderboard codes", () => {
  const top = [
    { code: "DE", goals: 10 },
    { code: "BR", goals: 8 },
    { code: "FR", goals: 5 },
    { code: "US", goals: 2 },
  ];
  assert.equal(isUnderdogCountryAtGoalTime("US", top), true);
  assert.equal(isUnderdogCountryAtGoalTime("FR", top), false);
  assert.equal(isUnderdogCountryAtGoalTime(null, top), false);
});

test("rush hour requires four or more players on pitch", () => {
  assert.equal(isRushHourFieldGoal(3), false);
  assert.equal(isRushHourFieldGoal(4), true);
  assert.equal(isRushHourFieldGoal(8), true);
});
