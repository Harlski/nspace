import assert from "node:assert/strict";
import test from "node:test";
import {
  ACHIEVEMENT_CELEBRATION_CAP,
  achievementCelebrationCount,
} from "../src/achievementCelebration.js";

test("achievementCelebrationCount caps at three per burst", () => {
  assert.equal(achievementCelebrationCount(0), 0);
  assert.equal(achievementCelebrationCount(1), 1);
  assert.equal(achievementCelebrationCount(3), 3);
  assert.equal(achievementCelebrationCount(5), ACHIEVEMENT_CELEBRATION_CAP);
  assert.equal(achievementCelebrationCount(Number.NaN), 0);
});
