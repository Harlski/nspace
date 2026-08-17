import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createFakeChainClient } from "../src/chain/fakeClient.js";
import type { AppConfig } from "../src/config.js";
import {
  enqueuePayIntent,
  initPayoutQueue,
  listPendingJobsForTests,
  resetQueueForTests,
  runProcessorTickForTests,
} from "../src/queue.js";
import {
  initMiningBanGate,
  refreshMiningBannedWallets,
  setMiningBannedWalletsForTests,
  stopMiningBanGateForTests,
} from "../src/miningBanGate.js";

const bannedWallet = "NQ97 4M1T 4TGD VC7F LHLQ Y2DY 425N 5CVH M02Y";

function testCfg(dataDir: string): AppConfig {
  return {
    host: "127.0.0.1",
    port: 3091,
    apiSecret: "test-secret",
    gameServerInternalUrl: null,
    dataDir,
    nimNetwork: "testalbatross",
    defaultTxMessage: "test",
    processIntervalMs: 2000,
    balanceCacheMs: 0,
    maxBackoffMs: 60_000,
    deadLetterAfterAttempts: 80,
    autoBulkAfterMs: 0,
    autoBulkCheckIntervalMs: 300_000,
    reconcileIntervalMs: 0,
    unconfirmedReviewMs: 10_800_000,
  };
}

test("processor skips mining payouts for banned wallets but sends maze rewards", async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "payout-mining-restriction-"));
  t.after(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
    resetQueueForTests();
    stopMiningBanGateForTests();
  });

  const fake = createFakeChainClient();
  resetQueueForTests();
  stopMiningBanGateForTests();
  setMiningBannedWalletsForTests([bannedWallet]);
  initPayoutQueue(testCfg(dataDir), fake);

  enqueuePayIntent({
    claimId: "mining-held-1",
    recipientAddress: bannedWallet,
    roomId: "canvas",
    tileKey: "1,2,0",
  });
  enqueuePayIntent({
    claimId: "maze-ok-1",
    recipientAddress: bannedWallet,
    roomId: "maze",
    tileKey: "maze-first-place",
  });

  await runProcessorTickForTests();
  await runProcessorTickForTests();

  assert.equal(fake.sends.length, 1);
  assert.equal(fake.sends[0]?.claimId, "maze-ok-1");
  const pending = listPendingJobsForTests();
  assert.equal(pending.length, 1);
  assert.equal(pending[0]?.claimId, "mining-held-1");
});

test("processor holds mining jobs after restriction is applied without a refresh window", async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "payout-mining-restriction-live-"));
  let wallets: string[] = [];
  const srv = http.createServer((req, res) => {
    if (req.url !== "/internal/v1/mining-banned-wallets") {
      res.writeHead(404);
      res.end();
      return;
    }
    if (req.headers.authorization !== "Bearer test-secret") {
      res.writeHead(401);
      res.end();
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ wallets }));
  });
  await new Promise<void>((resolve) => srv.listen(0, "127.0.0.1", resolve));
  const { port } = srv.address() as AddressInfo;
  t.after(() => {
    srv.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
    resetQueueForTests();
    stopMiningBanGateForTests();
  });

  const cfg = {
    ...testCfg(dataDir),
    gameServerInternalUrl: `http://127.0.0.1:${port}`,
  };
  const fake = createFakeChainClient();
  resetQueueForTests();
  stopMiningBanGateForTests();
  initMiningBanGate(cfg);
  initPayoutQueue(cfg, fake);
  await refreshMiningBannedWallets(true);

  enqueuePayIntent({
    claimId: "mining-queued-then-restricted",
    recipientAddress: bannedWallet,
    roomId: "canvas",
    tileKey: "4,5,0",
  });
  wallets = [bannedWallet];

  await runProcessorTickForTests();

  assert.equal(fake.sends.length, 0);
  const pending = listPendingJobsForTests();
  assert.equal(pending.length, 1);
  assert.equal(pending[0]?.claimId, "mining-queued-then-restricted");
});

test("processor holds mining jobs when the restriction list cannot be confirmed", async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "payout-mining-restriction-stale-"));
  let listStatus = 200;
  const srv = http.createServer((req, res) => {
    if (req.url !== "/internal/v1/mining-banned-wallets") {
      res.writeHead(404);
      res.end();
      return;
    }
    if (req.headers.authorization !== "Bearer test-secret") {
      res.writeHead(401);
      res.end();
      return;
    }
    if (listStatus !== 200) {
      res.writeHead(listStatus);
      res.end("unavailable");
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ wallets: [] }));
  });
  await new Promise<void>((resolve) => srv.listen(0, "127.0.0.1", resolve));
  const { port } = srv.address() as AddressInfo;
  t.after(() => {
    srv.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
    resetQueueForTests();
    stopMiningBanGateForTests();
  });

  const cfg = {
    ...testCfg(dataDir),
    gameServerInternalUrl: `http://127.0.0.1:${port}`,
  };
  const fake = createFakeChainClient();
  resetQueueForTests();
  stopMiningBanGateForTests();
  initMiningBanGate(cfg);
  initPayoutQueue(cfg, fake);
  await refreshMiningBannedWallets(true);

  enqueuePayIntent({
    claimId: "mining-while-list-unconfirmed",
    recipientAddress: bannedWallet,
    roomId: "canvas",
    tileKey: "6,7,0",
  });
  listStatus = 500;

  await runProcessorTickForTests();

  assert.equal(fake.sends.length, 0);
  const pending = listPendingJobsForTests();
  assert.equal(pending.length, 1);
  assert.equal(pending[0]?.claimId, "mining-while-list-unconfirmed");
});
