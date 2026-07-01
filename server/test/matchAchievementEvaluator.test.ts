import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateMatchAchievementsForParticipant,
  GOLDEN_PATIENCE_MIN_ELAPSED_MS,
} from "../src/matchAchievementEvaluator.js";

const baseWin = {
  result: "win" as const,
  winReason: "score" as const,
  goalsScored: 2,
  goalsConceded: 1,
  maxTrailingDeficit: 0,
  priorWinStreak: 2,
  goldenGoalWin: false,
  enteredGoldenPhase: false,
  scoredOwnGoal: false,
};

test("win increments streak and fires outcome events", () => {
  const effect = evaluateMatchAchievementsForParticipant(baseWin);
  assert.equal(effect.matchesPlayedDelta, 1);
  assert.equal(effect.matchesWonDelta, 1);
  assert.equal(effect.newWinStreak, 3);
  assert.ok(effect.events.includes("match_won"));
  assert.ok(effect.events.includes("match_goals_peak_1"));
  assert.ok(effect.events.includes("match_goals_peak_2"));
  assert.ok(!effect.events.includes("match_goals_peak_3"));
});

test("golden goal and walkover wins add dedicated events", () => {
  const golden = evaluateMatchAchievementsForParticipant({
    ...baseWin,
    goalsScored: 1,
    goalsConceded: 1,
    priorWinStreak: 0,
    goldenGoalWin: true,
    enteredGoldenPhase: true,
    goldenElapsedMsAtWin: GOLDEN_PATIENCE_MIN_ELAPSED_MS,
  });
  assert.ok(golden.events.includes("golden_goal_win"));
  assert.ok(golden.events.includes("golden_patience_win"));
  assert.ok(golden.events.includes("match_full_time"));

  const walkover = evaluateMatchAchievementsForParticipant({
    ...baseWin,
    winReason: "opponent_left",
    goalsScored: 0,
    goalsConceded: 0,
    priorWinStreak: 4,
    enteredGoldenPhase: true,
  });
  assert.ok(walkover.events.includes("opponent_left_win"));
  assert.ok(!walkover.events.includes("match_full_time"));
  assert.equal(walkover.newWinStreak, 5);
});

test("loss and draw reset streak", () => {
  const loss = evaluateMatchAchievementsForParticipant({
    result: "loss",
    winReason: "score",
    goalsScored: 1,
    goalsConceded: 2,
    maxTrailingDeficit: 1,
    priorWinStreak: 7,
  });
  assert.equal(loss.newWinStreak, 0);
  assert.ok(loss.events.includes("match_lost"));

  const draw = evaluateMatchAchievementsForParticipant({
    result: "draw",
    goalsScored: 2,
    goalsConceded: 2,
    maxTrailingDeficit: 1,
    priorWinStreak: 7,
    enteredGoldenPhase: true,
  });
  assert.equal(draw.newWinStreak, 0);
  assert.ok(draw.events.includes("match_draw"));
  assert.ok(draw.events.includes("match_full_time"));
  assert.equal(draw.matchesWonDelta, 0);
});

test("goal peaks fire cumulatively through ten or more", () => {
  const effect = evaluateMatchAchievementsForParticipant({
    ...baseWin,
    goalsScored: 10,
    priorWinStreak: 0,
  });
  assert.deepEqual(
    effect.events.filter((e) => e.startsWith("match_goals_peak_")).sort(),
    [
      "match_goals_peak_1",
      "match_goals_peak_10",
      "match_goals_peak_2",
      "match_goals_peak_3",
      "match_goals_peak_5",
    ]
  );
});

test("clean sheet requires a score win with zero conceded", () => {
  const clean = evaluateMatchAchievementsForParticipant({
    ...baseWin,
    goalsScored: 1,
    goalsConceded: 0,
  });
  assert.ok(clean.events.includes("match_clean_sheet"));

  const leaky = evaluateMatchAchievementsForParticipant({
    ...baseWin,
    goalsConceded: 1,
  });
  assert.ok(!leaky.events.includes("match_clean_sheet"));
});

test("comeback kid requires trailing by two or more before winning", () => {
  const comeback = evaluateMatchAchievementsForParticipant({
    ...baseWin,
    maxTrailingDeficit: 2,
  });
  assert.ok(comeback.events.includes("match_comeback_win"));

  const close = evaluateMatchAchievementsForParticipant({
    ...baseWin,
    maxTrailingDeficit: 1,
  });
  assert.ok(!close.events.includes("match_comeback_win"));
});

test("golden patience skips first-minute golden wins", () => {
  const quick = evaluateMatchAchievementsForParticipant({
    ...baseWin,
    goalsScored: 1,
    goalsConceded: 1,
    goldenGoalWin: true,
    enteredGoldenPhase: true,
    goldenElapsedMsAtWin: GOLDEN_PATIENCE_MIN_ELAPSED_MS - 1,
  });
  assert.ok(quick.events.includes("golden_goal_win"));
  assert.ok(!quick.events.includes("golden_patience_win"));
});

test("own goal hero fires only for winners who scored an own goal", () => {
  const hero = evaluateMatchAchievementsForParticipant({
    ...baseWin,
    scoredOwnGoal: true,
  });
  assert.ok(hero.events.includes("match_own_goal_win"));

  const loser = evaluateMatchAchievementsForParticipant({
    result: "loss",
    goalsScored: 1,
    goalsConceded: 3,
    maxTrailingDeficit: 2,
    priorWinStreak: 0,
    scoredOwnGoal: true,
  });
  assert.ok(!loser.events.includes("match_own_goal_win"));
});
