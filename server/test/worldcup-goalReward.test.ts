import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// Point the store at a throwaway file before importing it.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "worldcup-rewards-"));
process.env.WORLDCUP_GOAL_REWARDS_FILE = path.join(TMP, "rewards.json");

const {
  __resetGoalRewardsForTests,
  decideAndCommitGoalReward,
  evaluateGoalReward,
  goalRewardClaimId,
} = await import("../src/worldcup/goalReward.js");

const CFG = {
  minRewardLuna: 25_000n,
  maxRewardLuna: 25_000n,
  dailyCapPerWallet: 3,
  dailyBudgetLuna: 200_000n, // 8 rewards of 25000 fit
  minPlayers: 2,
};

const DAY = "2026-06-19";
const NOON = Date.UTC(2026, 5, 19, 12, 0);

function base() {
  return {
    scorerWallet: "NQ AAAA",
    distinctPlayersInField: 2,
    utcDay: DAY,
    walletPaidCount: 0,
    budgetSpentLuna: 0n,
    proposedRewardLuna: 25_000n,
  };
}

test("evaluateGoalReward pays a contested goal under cap with a deterministic claimId", () => {
  const d = evaluateGoalReward(base(), CFG);
  assert.equal(d.pay, true);
  assert.equal(d.reason, "ok");
  assert.equal(d.amountLuna, 25_000n);
  assert.equal(d.recipientWallet, "NQAAAA");
  assert.equal(d.claimId, goalRewardClaimId("NQAAAA", DAY, 0));
});

test("an uncredited goal (no scorer) never pays", () => {
  const d = evaluateGoalReward({ ...base(), scorerWallet: null }, CFG);
  assert.equal(d.pay, false);
  assert.equal(d.reason, "no_scorer");
});

test("a solo goal (one player) pays half the drawn amount", () => {
  const d = evaluateGoalReward({ ...base(), distinctPlayersInField: 1 }, CFG);
  assert.equal(d.pay, true);
  assert.equal(d.reason, "ok");
  assert.equal(d.amountLuna, 12_500n); // floor(25000 / 2)
});

test("with caps disabled (0), wallet and budget never block", () => {
  const uncapped = { ...CFG, dailyCapPerWallet: 0, dailyBudgetLuna: 0n };
  const d = evaluateGoalReward(
    { ...base(), walletPaidCount: 999, budgetSpentLuna: 999_999_999n },
    uncapped
  );
  assert.equal(d.pay, true);
  assert.equal(d.reason, "ok");
});

test("at/over the per-wallet daily cap, no pay", () => {
  const d = evaluateGoalReward({ ...base(), walletPaidCount: 3 }, CFG);
  assert.equal(d.pay, false);
  assert.equal(d.reason, "wallet_cap");
});

test("when the next reward would exceed the global budget, no pay", () => {
  const d = evaluateGoalReward(
    { ...base(), budgetSpentLuna: 200_000n, proposedRewardLuna: 25_000n },
    CFG
  );
  assert.equal(d.pay, false);
  assert.equal(d.reason, "budget_exhausted");
});

test("claimId is idempotent for the same goal (wallet + day + index)", () => {
  const a = evaluateGoalReward(base(), CFG);
  const b = evaluateGoalReward(base(), CFG);
  assert.equal(a.claimId, b.claimId);
});

test("successive paid goals get successive claim indices via the store", () => {
  __resetGoalRewardsForTests(DAY);
  const first = decideAndCommitGoalReward(
    { scorerWallet: "NQ BBBB", distinctPlayersInField: 2 },
    CFG,
    NOON
  );
  const second = decideAndCommitGoalReward(
    { scorerWallet: "NQ BBBB", distinctPlayersInField: 2 },
    CFG,
    NOON
  );
  assert.equal(first.claimId, goalRewardClaimId("NQBBBB", DAY, 0));
  assert.equal(second.claimId, goalRewardClaimId("NQBBBB", DAY, 1));
});

test("store pays solo goals at half rate", () => {
  __resetGoalRewardsForTests(DAY);
  const d = decideAndCommitGoalReward(
    { scorerWallet: "NQ SOLO", distinctPlayersInField: 1 },
    CFG,
    NOON
  );
  assert.equal(d.pay, true);
  assert.equal(d.reason, "ok");
  assert.ok(d.amountLuna !== undefined);
  assert.equal(d.amountLuna, 12_500n);
});

test("store enforces the per-wallet daily cap across calls", () => {
  __resetGoalRewardsForTests(DAY);
  const results = [];
  for (let i = 0; i < 5; i++) {
    results.push(
      decideAndCommitGoalReward(
        { scorerWallet: "NQ CCCC", distinctPlayersInField: 2 },
        CFG,
        NOON
      )
    );
  }
  assert.deepEqual(
    results.map((r) => r.pay),
    [true, true, true, false, false]
  );
  assert.equal(results[3].reason, "wallet_cap");
});

test("store enforces the global daily budget across wallets", () => {
  __resetGoalRewardsForTests(DAY);
  const tight = { ...CFG, dailyCapPerWallet: 100, dailyBudgetLuna: 50_000n }; // 2 rewards
  const a = decideAndCommitGoalReward(
    { scorerWallet: "NQ D1", distinctPlayersInField: 2 },
    tight,
    NOON
  );
  const b = decideAndCommitGoalReward(
    { scorerWallet: "NQ D2", distinctPlayersInField: 2 },
    tight,
    NOON
  );
  const c = decideAndCommitGoalReward(
    { scorerWallet: "NQ D3", distinctPlayersInField: 2 },
    tight,
    NOON
  );
  assert.equal(a.pay, true);
  assert.equal(b.pay, true);
  assert.equal(c.pay, false);
  assert.equal(c.reason, "budget_exhausted");
});

test("UTC-day rollover resets the per-wallet and budget counters", () => {
  __resetGoalRewardsForTests(DAY);
  for (let i = 0; i < 3; i++) {
    decideAndCommitGoalReward(
      { scorerWallet: "NQ EEEE", distinctPlayersInField: 2 },
      CFG,
      NOON
    );
  }
  // Capped on day 1.
  assert.equal(
    decideAndCommitGoalReward(
      { scorerWallet: "NQ EEEE", distinctPlayersInField: 2 },
      CFG,
      NOON
    ).pay,
    false
  );
  // Next UTC day: counters reset, paying again from index 0.
  const nextDay = Date.UTC(2026, 5, 20, 12, 0);
  const fresh = decideAndCommitGoalReward(
    { scorerWallet: "NQ EEEE", distinctPlayersInField: 2 },
    CFG,
    nextDay
  );
  assert.equal(fresh.pay, true);
  assert.equal(fresh.claimId, goalRewardClaimId("NQEEEE", "2026-06-20", 0));
});
