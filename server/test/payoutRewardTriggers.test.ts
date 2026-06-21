import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  enqueuePayIntent,
  isPayoutServiceMode,
  LUNA_PER_NIM,
} from "../src/payoutGateway.js";
import {
  initOutboxForTests,
  listUndeliveredOutboxForTests,
} from "../src/payoutOutbox.js";
import {
  __resetGoalRewardsForTests,
  decideAndCommitGoalReward,
  type GoalRewardDecision,
} from "../src/worldcup/goalReward.js";

const testRecipient = "NQ97 4M1T 4TGD VC7F LHLQ Y2DY 425N 5CVH M02Y";

const GOAL_CFG = {
  minRewardLuna: 25_000n,
  maxRewardLuna: 25_000n,
  dailyCapPerWallet: 3,
  dailyBudgetLuna: 200_000n,
  minPlayers: 2,
};

function formatGoalRewardNim(luna: bigint): string {
  const nim = Number(luna) / Number(LUNA_PER_NIM);
  return nim.toFixed(2).replace(/\.?0+$/, "");
}

/** Mirrors `sendGoalRewardOutcomeToScorer` payload selection in rooms.ts. */
function goalRewardOutcomeFromDecision(
  roomId: string,
  decision: GoalRewardDecision
): { type: "goalRewardOutcome"; roomId: string; reason: string; amountNim?: string } | null {
  if (decision.pay && decision.amountLuna !== undefined) {
    return {
      type: "goalRewardOutcome",
      roomId,
      reason: "ok",
      amountNim: formatGoalRewardNim(decision.amountLuna),
    };
  }
  if (decision.reason === "wallet_cap") {
    return { type: "goalRewardOutcome", roomId, reason: "wallet_cap" };
  }
  if (decision.reason === "budget_exhausted") {
    return { type: "goalRewardOutcome", roomId, reason: "budget_exhausted" };
  }
  return null;
}

function withServiceModeOutbox(t: test.TestContext, run: () => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "payout-triggers-out-"));
  t.after(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });
  process.env.PAYOUT_OUTBOX_DIR = dir;

  const prevUrl = process.env.PAYOUT_SERVICE_URL;
  const prevSecret = process.env.PAYOUT_SERVICE_API_SECRET;
  process.env.PAYOUT_SERVICE_URL = "http://127.0.0.1:1";
  process.env.PAYOUT_SERVICE_API_SECRET = "trigger-test-secret";
  t.after(() => {
    if (prevUrl !== undefined) process.env.PAYOUT_SERVICE_URL = prevUrl;
    else delete process.env.PAYOUT_SERVICE_URL;
    if (prevSecret !== undefined) process.env.PAYOUT_SERVICE_API_SECRET = prevSecret;
    else delete process.env.PAYOUT_SERVICE_API_SECRET;
    if (process.env.PAYOUT_OUTBOX_DIR === dir) {
      delete process.env.PAYOUT_OUTBOX_DIR;
    }
  });

  initOutboxForTests({ deliverer: async () => ({ ok: true }) });
  assert.equal(isPayoutServiceMode(), true);
  run();
}

test("world cup goal reward enqueues via gateway outbox in service mode", (t) => {
  withServiceModeOutbox(t, () => {
    __resetGoalRewardsForTests();
    const decision = decideAndCommitGoalReward(
      { scorerWallet: testRecipient, distinctPlayersInField: 2 },
      GOAL_CFG,
      Date.UTC(2026, 5, 19, 12, 0)
    );
    assert.equal(decision.pay, true);
    assert.ok(decision.claimId);
    assert.ok(decision.amountLuna !== undefined);

    enqueuePayIntent({
      claimId: decision.claimId!,
      recipientAddress: decision.recipientWallet!,
      amountLuna: decision.amountLuna,
      roomId: "worldcup-field",
      tileKey: "wc-goal-test-goal-1",
      txMessage: "Scored a goal on Nimiq Space!",
    });

    const pending = listUndeliveredOutboxForTests();
    assert.equal(pending.length, 1);
    assert.equal(pending[0]?.claimId, decision.claimId);
    assert.equal(pending[0]?.amountLuna, decision.amountLuna);
  });
});

test("world cup goal reward outcome feedback unchanged at enqueue time", (t) => {
  withServiceModeOutbox(t, () => {
    __resetGoalRewardsForTests();
    const roomId = "worldcup-field";
    const paid = decideAndCommitGoalReward(
      { scorerWallet: testRecipient, distinctPlayersInField: 2 },
      GOAL_CFG,
      Date.UTC(2026, 5, 19, 12, 0)
    );
    assert.deepEqual(goalRewardOutcomeFromDecision(roomId, paid), {
      type: "goalRewardOutcome",
      roomId,
      reason: "ok",
      amountNim: "0.25",
    });

    for (let i = 0; i < GOAL_CFG.dailyCapPerWallet; i++) {
      decideAndCommitGoalReward(
        { scorerWallet: "NQ CAPTEST", distinctPlayersInField: 2 },
        GOAL_CFG,
        Date.UTC(2026, 5, 19, 12, 0)
      );
    }
    const capped = decideAndCommitGoalReward(
      { scorerWallet: "NQ CAPTEST", distinctPlayersInField: 2 },
      GOAL_CFG,
      Date.UTC(2026, 5, 19, 12, 0)
    );
    assert.deepEqual(goalRewardOutcomeFromDecision(roomId, capped), {
      type: "goalRewardOutcome",
      roomId,
      reason: "wallet_cap",
    });

    __resetGoalRewardsForTests();
    const tight = { ...GOAL_CFG, dailyBudgetLuna: 25_000n };
    decideAndCommitGoalReward(
      { scorerWallet: "NQ POOL", distinctPlayersInField: 2 },
      tight,
      Date.UTC(2026, 5, 19, 12, 0)
    );
    const exhausted = decideAndCommitGoalReward(
      { scorerWallet: "NQ POOL2", distinctPlayersInField: 2 },
      tight,
      Date.UTC(2026, 5, 19, 12, 0)
    );
    assert.deepEqual(goalRewardOutcomeFromDecision(roomId, exhausted), {
      type: "goalRewardOutcome",
      roomId,
      reason: "budget_exhausted",
    });
  });
});

test("maze first-place reward enqueues via gateway outbox in service mode", (t) => {
  withServiceModeOutbox(t, () => {
    const timerEnd = 1_700_000_000_000;
    const claimId = `maze-first-${timerEnd}-${testRecipient}`;
    enqueuePayIntent({
      claimId,
      recipientAddress: testRecipient,
      amountLuna: LUNA_PER_NIM,
      roomId: "canvas",
      tileKey: "maze-first-place",
      txMessage: "You won The Maze on Nimiq.Space!",
    });

    const pending = listUndeliveredOutboxForTests();
    assert.equal(pending.length, 1);
    assert.equal(pending[0]?.claimId, claimId);
    assert.equal(pending[0]?.amountLuna, LUNA_PER_NIM);
    assert.equal(pending[0]?.tileKey, "maze-first-place");
  });
});

test("admin feedback reward enqueues via gateway outbox in service mode", (t) => {
  withServiceModeOutbox(t, () => {
    const ticketId = "fb-ticket-42";
    const claimId = `feedback-${ticketId}`;
    const amountLuna = 50_000n;
    enqueuePayIntent({
      claimId,
      recipientAddress: testRecipient,
      amountLuna,
      roomId: "feedback",
      tileKey: "admin-reward",
      txMessage: "Nimiq Space — thank you for integrated feedback",
    });

    const pending = listUndeliveredOutboxForTests();
    assert.equal(pending.length, 1);
    assert.equal(pending[0]?.claimId, claimId);
    assert.equal(pending[0]?.amountLuna, amountLuna);
    assert.equal(pending[0]?.roomId, "feedback");
  });
});

test("block claim still enqueues via gateway outbox in service mode", (t) => {
  withServiceModeOutbox(t, () => {
    enqueuePayIntent({
      claimId: "block-claim-7-8-0",
      recipientAddress: testRecipient,
      amountLuna: 3000n,
      roomId: "canvas",
      tileKey: "7,8,0",
    });

    const pending = listUndeliveredOutboxForTests();
    assert.equal(pending.length, 1);
    assert.equal(pending[0]?.claimId, "block-claim-7-8-0");
  });
});
