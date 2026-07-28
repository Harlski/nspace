import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createFakeChainClient } from "../src/chain/fakeClient.js";
import type { AppConfig } from "../src/config.js";
import { createPayoutApp } from "../src/app.js";
import {
  enqueuePayIntent,
  listPendingJobsForTests,
  maybeAutoBulkStalePending,
  resetQueueForTests,
  runProcessorTickForTests,
  stopPayoutProcessorForTests,
} from "../src/queue.js";

const testRecipient = "NQ97 4M1T 4TGD VC7F LHLQ Y2DY 425N 5CVH M02Y";

function testCfg(
  dataDir: string,
  overrides?: Partial<AppConfig>
): AppConfig {
  return {
    host: "127.0.0.1",
    port: 0,
    apiSecret: "unit-test-secret",
    gameServerInternalUrl: null,
    dataDir,
    nimNetwork: "testalbatross",
    defaultTxMessage: "test payout",
    processIntervalMs: 50_000,
    balanceCacheMs: 20_000,
    maxBackoffMs: 60_000,
    deadLetterAfterAttempts: 3,
    autoBulkAfterMs: 0,
    autoBulkCheckIntervalMs: 300_000,
    reconcileIntervalMs: 0,
    unconfirmedReviewMs: 10_800_000,
    ...overrides,
  };
}

test("priority job is sent before older normal jobs", { concurrency: false }, async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "payout-priority-pick-"));
  t.after(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  resetQueueForTests();
  const fake = createFakeChainClient();
  createPayoutApp({
    cfg: testCfg(dataDir),
    chainClient: fake,
    startProcessor: false,
  });

  enqueuePayIntent({
    claimId: "normal-old",
    recipientAddress: testRecipient,
    roomId: "canvas",
    tileKey: "1,1,0",
  });
  enqueuePayIntent({
    claimId: "tutorial-faucet",
    recipientAddress: testRecipient,
    roomId: "tutorial",
    tileKey: "2,2,0",
    priority: true,
  });
  const now = Date.now();
  for (const j of listPendingJobsForTests()) {
    if (j.claimId === "normal-old") j.createdAt = now - 60_000;
  }

  await runProcessorTickForTests(now);
  assert.equal(fake.sends.length, 1);
  assert.equal(fake.sends[0]?.claimId, "tutorial-faucet");

  stopPayoutProcessorForTests();
});

test("auto bulk skips priority jobs and leaves them for the individual path", {
  concurrency: false,
}, async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "payout-priority-bulk-"));
  t.after(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  resetQueueForTests();
  const fake = createFakeChainClient();
  const ageMs = 60_000;
  createPayoutApp({
    cfg: testCfg(dataDir, { autoBulkAfterMs: ageMs }),
    chainClient: fake,
    startProcessor: false,
  });

  const now = Date.now();
  enqueuePayIntent({
    claimId: "stale-normal",
    recipientAddress: testRecipient,
    roomId: "canvas",
    tileKey: "1,1,0",
  });
  enqueuePayIntent({
    claimId: "priority-faucet",
    recipientAddress: testRecipient,
    roomId: "tutorial",
    tileKey: "2,2,0",
    priority: true,
  });
  for (const j of listPendingJobsForTests()) {
    j.createdAt = now - ageMs - 1_000;
  }

  const paid = await maybeAutoBulkStalePending(now);
  assert.equal(paid.recipientsPaid, 1);
  assert.equal(paid.jobsCleared, 1);
  assert.equal(fake.sends.length, 1);
  assert.equal(fake.sends[0]?.amountLuna, 100_000n);

  const remaining = listPendingJobsForTests();
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0]?.claimId, "priority-faucet");
  assert.equal(remaining[0]?.priority, true);

  stopPayoutProcessorForTests();
});
