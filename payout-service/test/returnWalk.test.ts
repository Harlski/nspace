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

function testCfg(dataDir: string, overrides?: Partial<AppConfig>): AppConfig {
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

test("Return Gold jobs send from the Server Wallet signer, not Stream Faucet", {
  concurrency: false,
}, async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "payout-rw-signer-"));
  t.after(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });
  resetQueueForTests();
  const streamFaucet = createFakeChainClient();
  const serverWallet = createFakeChainClient();
  createPayoutApp({
    cfg: testCfg(dataDir),
    chainClient: streamFaucet,
    returnWalkChainClient: serverWallet,
    startProcessor: false,
  });
  t.after(() => stopPayoutProcessorForTests());

  enqueuePayIntent({
    claimId: "rw-gold-1",
    recipientAddress: testRecipient,
    amountLuna: "100000",
    roomId: "hub",
    tileKey: "3,4,0",
    source: "returnWalk",
  });
  await runProcessorTickForTests();
  assert.equal(streamFaucet.sends.length, 0);
  assert.equal(serverWallet.sends.length, 1);
  assert.equal(serverWallet.sends[0]?.amountLuna, 100_000n);
});

test("auto bulk skips Return Walk jobs (never Stream Faucet)", {
  concurrency: false,
}, async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "payout-rw-bulk-"));
  t.after(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });
  resetQueueForTests();
  const streamFaucet = createFakeChainClient();
  const serverWallet = createFakeChainClient();
  const ageMs = 60_000;
  createPayoutApp({
    cfg: testCfg(dataDir, { autoBulkAfterMs: ageMs }),
    chainClient: streamFaucet,
    returnWalkChainClient: serverWallet,
    startProcessor: false,
  });
  t.after(() => stopPayoutProcessorForTests());

  const now = Date.now();
  enqueuePayIntent({
    claimId: "stale-normal",
    recipientAddress: testRecipient,
    roomId: "canvas",
    tileKey: "1,1,0",
  });
  enqueuePayIntent({
    claimId: "return-gold-held",
    recipientAddress: testRecipient,
    roomId: "hub",
    tileKey: "3,4,0",
    source: "returnWalk",
  });
  for (const j of listPendingJobsForTests()) {
    j.createdAt = now - ageMs - 1_000;
  }

  const paid = await maybeAutoBulkStalePending(now);
  assert.equal(paid.recipientsPaid, 1);
  const remaining = listPendingJobsForTests();
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0]?.claimId, "return-gold-held");
  assert.equal(remaining[0]?.source, "returnWalk");
  assert.equal(serverWallet.sends.length, 0);
});
