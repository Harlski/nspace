import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { Server } from "node:http";
import { createFakeChainClient } from "../../payout-service/src/chain/fakeClient.js";
import { createPayoutApp } from "../../payout-service/src/app.js";
import type { AppConfig } from "../../payout-service/src/config.js";
import {
  drainQueueForTests,
  resetQueueForTests,
} from "../../payout-service/src/queue.js";
import {
  appendPayIntentToOutbox,
  drainOutboxOnce,
  initOutboxForTests,
  clearDeliveredClaimIdsForTests,
} from "../src/payoutOutbox.js";
import { deliverPayIntentToService } from "../src/payoutServiceClient.js";

const testRecipient = "NQ97 4M1T 4TGD VC7F LHLQ Y2DY 425N 5CVH M02Y";

test("block claim flows outbox → payout service → exactly one fake send", async (t) => {
  const payoutDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "payout-e2e-svc-"));
  const outboxDir = fs.mkdtempSync(path.join(os.tmpdir(), "payout-e2e-out-"));
  t.after(() => {
    fs.rmSync(payoutDataDir, { recursive: true, force: true });
    fs.rmSync(outboxDir, { recursive: true, force: true });
  });

  resetQueueForTests();
  const fake = createFakeChainClient();
  const cfg: AppConfig = {
    host: "127.0.0.1",
    port: 0,
    apiSecret: "e2e-secret",
    gameServerInternalUrl: null,
    dataDir: payoutDataDir,
    nimNetwork: "testalbatross",
    defaultTxMessage: "test",
    processIntervalMs: 50_000,
    balanceCacheMs: 20_000,
    maxBackoffMs: 3_600_000,
    deadLetterAfterAttempts: 80,
  };
  const { app } = createPayoutApp({
    cfg,
    chainClient: fake,
    startProcessor: false,
  });
  const server: Server = await new Promise((resolve, reject) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
    s.on("error", reject);
  });
  t.after(() => server.close());

  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no port");
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  const prevUrl = process.env.PAYOUT_SERVICE_URL;
  const prevSecret = process.env.PAYOUT_SERVICE_API_SECRET;
  process.env.PAYOUT_SERVICE_URL = baseUrl;
  process.env.PAYOUT_SERVICE_API_SECRET = "e2e-secret";
  process.env.PAYOUT_OUTBOX_DIR = outboxDir;
  t.after(() => {
    if (prevUrl !== undefined) process.env.PAYOUT_SERVICE_URL = prevUrl;
    else delete process.env.PAYOUT_SERVICE_URL;
    if (prevSecret !== undefined) process.env.PAYOUT_SERVICE_API_SECRET = prevSecret;
    else delete process.env.PAYOUT_SERVICE_API_SECRET;
    if (process.env.PAYOUT_OUTBOX_DIR === outboxDir) {
      delete process.env.PAYOUT_OUTBOX_DIR;
    }
  });

  initOutboxForTests({ deliverer: deliverPayIntentToService });
  appendPayIntentToOutbox({
    claimId: "e2e-block-claim",
    recipientAddress: testRecipient,
    amountLuna: 100_000n,
    roomId: "canvas",
    tileKey: "5,6,0",
  });

  await drainOutboxOnce();
  await drainQueueForTests();

  assert.equal(fake.sends.length, 1);
  assert.equal(fake.sends[0]?.claimId, "e2e-block-claim");
});

test("outbox redelivery after lost ack still yields one chain send", async (t) => {
  const payoutDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "payout-redeliver-svc-"));
  const outboxDir = fs.mkdtempSync(path.join(os.tmpdir(), "payout-redeliver-out-"));
  t.after(() => {
    fs.rmSync(payoutDataDir, { recursive: true, force: true });
    fs.rmSync(outboxDir, { recursive: true, force: true });
  });

  resetQueueForTests();
  const fake = createFakeChainClient();
  const cfg: AppConfig = {
    host: "127.0.0.1",
    port: 0,
    apiSecret: "e2e-secret",
    gameServerInternalUrl: null,
    dataDir: payoutDataDir,
    nimNetwork: "testalbatross",
    defaultTxMessage: "test",
    processIntervalMs: 50_000,
    balanceCacheMs: 20_000,
    maxBackoffMs: 3_600_000,
    deadLetterAfterAttempts: 80,
  };
  const { app } = createPayoutApp({
    cfg,
    chainClient: fake,
    startProcessor: false,
  });
  const server: Server = await new Promise((resolve, reject) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
    s.on("error", reject);
  });
  t.after(() => server.close());

  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no port");
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  const prevUrl = process.env.PAYOUT_SERVICE_URL;
  const prevSecret = process.env.PAYOUT_SERVICE_API_SECRET;
  process.env.PAYOUT_SERVICE_URL = baseUrl;
  process.env.PAYOUT_SERVICE_API_SECRET = "e2e-secret";
  process.env.PAYOUT_OUTBOX_DIR = outboxDir;
  t.after(() => {
    if (prevUrl !== undefined) process.env.PAYOUT_SERVICE_URL = prevUrl;
    else delete process.env.PAYOUT_SERVICE_URL;
    if (prevSecret !== undefined) process.env.PAYOUT_SERVICE_API_SECRET = prevSecret;
    else delete process.env.PAYOUT_SERVICE_API_SECRET;
    if (process.env.PAYOUT_OUTBOX_DIR === outboxDir) {
      delete process.env.PAYOUT_OUTBOX_DIR;
    }
  });

  initOutboxForTests({ deliverer: deliverPayIntentToService });
  appendPayIntentToOutbox({
    claimId: "redeliver-claim",
    recipientAddress: testRecipient,
    amountLuna: 100_000n,
    roomId: "canvas",
    tileKey: "7,8,0",
  });

  await drainOutboxOnce();
  clearDeliveredClaimIdsForTests();
  await drainOutboxOnce();
  await drainQueueForTests();

  assert.equal(fake.sends.length, 1);
  assert.equal(fake.sends[0]?.claimId, "redeliver-claim");
});
