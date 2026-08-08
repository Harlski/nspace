import assert from "node:assert/strict";
import test from "node:test";

import {
  applyDailyEarnAllowance,
  dailyEarnAllowanceLuna,
  playerLevelFromPoints,
} from "../src/playerLevel.js";

test("Player Level is 1 at 0 Achievement Points", () => {
  assert.equal(playerLevelFromPoints(0), 1);
});

test("Player Level rises one step per 100 Achievement Points", () => {
  assert.equal(playerLevelFromPoints(99), 1);
  assert.equal(playerLevelFromPoints(100), 2);
  assert.equal(playerLevelFromPoints(900), 10);
  assert.equal(playerLevelFromPoints(1000), 11);
  assert.equal(playerLevelFromPoints(1100), 12);
});

test("Daily Earn Allowance follows the L1–L10 NIM table; L11+ uncapped", () => {
  assert.equal(dailyEarnAllowanceLuna(1), 10n * 100_000n);
  assert.equal(dailyEarnAllowanceLuna(2), 15n * 100_000n);
  assert.equal(dailyEarnAllowanceLuna(10), 100n * 100_000n);
  assert.equal(dailyEarnAllowanceLuna(11), null);
  assert.equal(dailyEarnAllowanceLuna(34), null);
});

test("partial-fill pays remaining allowance then binds", () => {
  const d = applyDailyEarnAllowance({
    proposedLuna: 200_000n,
    spentLuna: 900_000n,
    ceilingLuna: 1_000_000n,
  });
  assert.equal(d.payLuna, 100_000n);
  assert.equal(d.allowanceBound, true);
  assert.equal(d.remainingAfterLuna, 0n);
});

test("uncapped Level never binds", () => {
  const d = applyDailyEarnAllowance({
    proposedLuna: 9_000_000n,
    spentLuna: 50_000_000n,
    ceilingLuna: null,
  });
  assert.equal(d.payLuna, 9_000_000n);
  assert.equal(d.allowanceBound, false);
  assert.equal(d.remainingAfterLuna, null);
});

test("exhausted allowance pays zero", () => {
  const d = applyDailyEarnAllowance({
    proposedLuna: 50_000n,
    spentLuna: 1_000_000n,
    ceilingLuna: 1_000_000n,
  });
  assert.equal(d.payLuna, 0n);
  assert.equal(d.allowanceBound, true);
});
