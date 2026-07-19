import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createFakeChainClient } from "../src/chain/fakeClient.js";
import type { AppConfig } from "../src/config.js";
import { createPayoutApp } from "../src/app.js";
import {
  drainQueueForTests,
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
    ...overrides,
  };
}

test("failed sends back off and dead-letter after threshold with audit record", { concurrency: false }, async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "payout-reliability-dl-"));
  t.after(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  resetQueueForTests();
  const fake = createFakeChainClient({
    onSend: async () => {
      throw new Error("simulated chain failure");
    },
  });
  const cfg = testCfg(dataDir);
  createPayoutApp({ cfg, chainClient: fake, startProcessor: false });

  enqueuePayIntent({
    claimId: "fail-claim",
    recipientAddress: testRecipient,
    roomId: "canvas",
    tileKey: "1,1,0",
  });

  await drainQueueForTests({ maxTicks: 10 });

  assert.equal(fake.sends.length, 3);
  assert.equal(listPendingJobsForTests().length, 0);

  const deadLetterFile = path.join(dataDir, "nim-payout-dead-letter.jsonl");
  assert.equal(fs.existsSync(deadLetterFile), true);
  const lines = fs.readFileSync(deadLetterFile, "utf8").trim().split("\n");
  assert.equal(lines.length, 1);
  const row = JSON.parse(lines[0]!) as {
    claimId?: string;
    attempts?: number;
    error?: string;
  };
  assert.equal(row.claimId, "fail-claim");
  assert.equal(row.attempts, 3);
  assert.match(String(row.error), /simulated chain failure/);

  stopPayoutProcessorForTests();
});

test("service restart mid-queue resumes without double-send", { concurrency: false }, async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "payout-reliability-restart-"));
  t.after(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  resetQueueForTests();
  const cfg = testCfg(dataDir, { deadLetterAfterAttempts: 10 });
  fs.mkdirSync(dataDir, { recursive: true });
  const claimId = "restart-claim";
  const jobId = randomUUID();
  const now = Date.now();
  fs.writeFileSync(
    path.join(dataDir, "nim-payout-pending.json"),
    JSON.stringify([
      {
        id: jobId,
        claimId,
        recipientAddress: testRecipient,
        amountLuna: "100000",
        createdAt: now,
        attempts: 0,
        nextRetryAt: now,
        status: "processing",
        roomId: "canvas",
        tileKey: "2,2,0",
      },
    ]),
    "utf8"
  );
  fs.writeFileSync(
    path.join(dataDir, "accepted-claim-ids.json"),
    JSON.stringify([claimId]),
    "utf8"
  );

  resetQueueForTests();
  const fake = createFakeChainClient();
  createPayoutApp({ cfg, chainClient: fake, startProcessor: false });
  await drainQueueForTests();
  stopPayoutProcessorForTests();

  assert.equal(fake.sends.length, 1);
  assert.equal(fake.sends[0]?.claimId, claimId);
});

test("duplicate enqueue by claimId never double-sends under retry", { concurrency: false }, async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "payout-reliability-dedupe-"));
  t.after(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  resetQueueForTests();
  const fake = createFakeChainClient();
  createPayoutApp({ cfg: testCfg(dataDir), chainClient: fake, startProcessor: false });

  const body = {
    claimId: "dedupe-claim",
    recipientAddress: testRecipient,
    roomId: "canvas",
    tileKey: "3,3,0",
  };
  const first = enqueuePayIntent(body);
  const second = enqueuePayIntent(body);
  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);

  await drainQueueForTests();
  stopPayoutProcessorForTests();

  assert.equal(fake.sends.length, 1);
  assert.equal(fake.sends[0]?.claimId, "dedupe-claim");
});

test("auto bulk combines pending jobs after age threshold", { concurrency: false }, async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "payout-reliability-autobulk-"));
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
    claimId: "stale-a",
    recipientAddress: testRecipient,
    roomId: "canvas",
    tileKey: "1,1,0",
  });
  enqueuePayIntent({
    claimId: "stale-b",
    recipientAddress: testRecipient,
    roomId: "canvas",
    tileKey: "2,2,0",
  });
  for (const j of listPendingJobsForTests()) {
    j.createdAt = now - ageMs - 1_000;
  }

  const freshOnly = await maybeAutoBulkStalePending(now - ageMs + 5_000);
  assert.equal(freshOnly.recipientsPaid, 0);
  assert.equal(fake.sends.length, 0);

  const paid = await maybeAutoBulkStalePending(now);
  assert.equal(paid.recipientsPaid, 1);
  assert.equal(paid.jobsCleared, 2);
  assert.equal(fake.sends.length, 1);
  assert.equal(fake.sends[0]?.amountLuna, 200_000n);
  assert.equal(listPendingJobsForTests().length, 0);

  stopPayoutProcessorForTests();
});
