import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "daily-earn-"));
process.env.DAILY_EARN_ALLOWANCE_FILE = path.join(TMP, "allowance.json");

const {
  __resetDailyEarnAllowanceForTests,
  decideAndCommitGameplayEarn,
  enqueueGameplayPayIntent,
} = await import("../src/dailyEarnAllowance.js");
import {
  initOutboxForTests,
  listUndeliveredOutboxForTests,
} from "../src/payoutOutbox.js";
import { isPayoutServiceMode } from "../src/payoutGateway.js";

const DAY = "2026-08-08";
const NOON = Date.UTC(2026, 7, 8, 12, 0);

test("Level 1 mining partial-fills against remaining Daily Earn Allowance", () => {
  __resetDailyEarnAllowanceForTests(DAY);
  const first = decideAndCommitGameplayEarn({
    wallet: "NQ AAAA",
    proposedLuna: 900_000n,
    achievementPoints: 0,
    nowMs: NOON,
  });
  assert.equal(first.payLuna, 900_000n);
  assert.equal(first.allowanceBound, false);
  assert.equal(first.level, 1);

  const second = decideAndCommitGameplayEarn({
    wallet: "NQ AAAA",
    proposedLuna: 200_000n,
    achievementPoints: 0,
    nowMs: NOON,
  });
  assert.equal(second.payLuna, 100_000n);
  assert.equal(second.allowanceBound, true);
  assert.equal(second.level, 1);
});

test("mid-day Level-up raises ceiling without resetting spent", () => {
  __resetDailyEarnAllowanceForTests(DAY);
  decideAndCommitGameplayEarn({
    wallet: "NQ BBBB",
    proposedLuna: 1_000_000n,
    achievementPoints: 0,
    nowMs: NOON,
  });
  const afterLevelUp = decideAndCommitGameplayEarn({
    wallet: "NQ BBBB",
    proposedLuna: 500_000n,
    achievementPoints: 300, // Level 4 → 30 NIM
    nowMs: NOON,
  });
  // spent 10 NIM, ceiling now 30 → 20 remaining; proposed 5 → full pay
  assert.equal(afterLevelUp.payLuna, 500_000n);
  assert.equal(afterLevelUp.allowanceBound, false);
  assert.equal(afterLevelUp.level, 4);
});

test("UTC day rollover clears spent", () => {
  __resetDailyEarnAllowanceForTests(DAY);
  decideAndCommitGameplayEarn({
    wallet: "NQ CCCC",
    proposedLuna: 1_000_000n,
    achievementPoints: 0,
    nowMs: NOON,
  });
  const nextDay = decideAndCommitGameplayEarn({
    wallet: "NQ CCCC",
    proposedLuna: 1_000_000n,
    achievementPoints: 0,
    nowMs: Date.UTC(2026, 7, 9, 1, 0),
  });
  assert.equal(nextDay.payLuna, 1_000_000n);
  assert.equal(nextDay.allowanceBound, false);
});

test("Level 11+ is uncapped", () => {
  __resetDailyEarnAllowanceForTests(DAY);
  const d = decideAndCommitGameplayEarn({
    wallet: "NQ DDDD",
    proposedLuna: 50_000_000n,
    achievementPoints: 1000,
    nowMs: NOON,
  });
  assert.equal(d.payLuna, 50_000_000n);
  assert.equal(d.allowanceBound, false);
  assert.equal(d.level, 11);
});

test("enqueueGameplayPayIntent enqueues only partial-filled luna", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "daily-earn-out-"));
  process.env.PAYOUT_OUTBOX_DIR = dir;
  process.env.PAYOUT_SERVICE_URL = "http://127.0.0.1:1";
  process.env.PAYOUT_SERVICE_API_SECRET = "daily-earn-test";
  initOutboxForTests({ deliverer: async () => ({ ok: true }) });
  assert.equal(isPayoutServiceMode(), true);
  __resetDailyEarnAllowanceForTests(DAY);
  decideAndCommitGameplayEarn({
    wallet: "NQ EEEE",
    proposedLuna: 900_000n,
    achievementPoints: 0,
    nowMs: NOON,
  });
  const earn = enqueueGameplayPayIntent(
    {
      claimId: "mine-partial-1",
      recipientAddress: "NQ EEEE",
      amountLuna: 250_000n,
      roomId: "hub",
      tileKey: "1,2,0",
    },
    0,
    NOON
  );
  assert.equal(earn.payLuna, 100_000n);
  assert.equal(earn.allowanceBound, true);
  const pending = listUndeliveredOutboxForTests();
  assert.equal(pending.length, 1);
  assert.equal(pending[0]?.amountLuna, 100_000n);
  assert.equal(pending[0]?.claimId, "mine-partial-1");
});
