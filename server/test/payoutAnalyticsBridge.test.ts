import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import express from "express";
import type { Server } from "node:http";

function withEnv(key: string, value: string, run: () => Promise<void>): Promise<void> {
  const prev = process.env[key];
  process.env[key] = value;
  return run().finally(() => {
    if (prev !== undefined) process.env[key] = prev;
    else delete process.env[key];
  });
}

async function loadBridgeModules() {
  return import("../src/payoutAnalyticsBridge.js");
}

function countNimPayoutSentInDir(eventDir: string): number {
  if (!fs.existsSync(eventDir)) return 0;
  let n = 0;
  for (const name of fs.readdirSync(eventDir)) {
    if (!name.startsWith("events-") || !name.endsWith(".jsonl")) continue;
    const raw = fs.readFileSync(path.join(eventDir, name), "utf8");
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      try {
        const rec = JSON.parse(line) as { kind?: string };
        if (rec.kind === "nim_payout_sent") n += 1;
      } catch {
        /* skip */
      }
    }
  }
  return n;
}

test("internal payout analytics endpoint records nim_payout_sent", async (t) => {
  const eventDir = fs.mkdtempSync(path.join(os.tmpdir(), "payout-analytics-ev-"));
  const syncDir = fs.mkdtempSync(path.join(os.tmpdir(), "payout-analytics-sync-"));
  t.after(() => {
    fs.rmSync(eventDir, { recursive: true, force: true });
    fs.rmSync(syncDir, { recursive: true, force: true });
  });

  await withEnv("EVENT_LOG_DIR", eventDir, async () => {
    await withEnv("PAYOUT_ANALYTICS_SYNC_DIR", syncDir, async () => {
      await withEnv("PAYOUT_SERVICE_API_SECRET", "bridge-secret", async () => {
        const {
          handlePayoutAnalyticsEventPost,
          initPayoutAnalyticsBridgeForRuntime,
          requirePayoutServiceBearer,
          resetPayoutAnalyticsBridgeForTests,
        } = await loadBridgeModules();
        resetPayoutAnalyticsBridgeForTests();
        initPayoutAnalyticsBridgeForRuntime();

        const app = express();
        app.use(express.json());
        app.post(
          "/internal/v1/payout-analytics-events",
          requirePayoutServiceBearer,
          handlePayoutAnalyticsEventPost
        );
        const server: Server = await new Promise((resolve, reject) => {
          const s = app.listen(0, "127.0.0.1", () => resolve(s));
          s.on("error", reject);
        });
        t.after(() => server.close());
        const addr = server.address();
        if (!addr || typeof addr === "string") throw new Error("no port");
        const url = `http://127.0.0.1:${addr.port}/internal/v1/payout-analytics-events`;

        const body = {
          kind: "nim_payout_sent",
          payload: {
            claimId: "analytics-bridge-1",
            recipientAddress: "NQ97 4M1T 4TGD VC7F LHLQ Y2DY 425N 5CVH M02Y",
            roomId: "chamber",
            tileKey: "1,2",
            txHash: "abc123hash",
            sentAt: Date.now(),
            enqueuedAt: Date.now() - 5000,
            amountLuna: "100000",
            jobId: "job-1",
            state: "included",
          },
        };

        const first = await fetch(url, {
          method: "POST",
          headers: {
            authorization: "Bearer bridge-secret",
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
        });
        assert.equal(first.status, 201);

        const dup = await fetch(url, {
          method: "POST",
          headers: {
            authorization: "Bearer bridge-secret",
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
        });
        assert.equal(dup.status, 200);

        assert.equal(countNimPayoutSentInDir(eventDir), 1);
        resetPayoutAnalyticsBridgeForTests();
      });
    });
  });
});

test("recordPayoutSentAnalyticsEvent is idempotent by claimId", async () => {
  const eventDir = fs.mkdtempSync(path.join(os.tmpdir(), "payout-analytics-idem-"));
  const syncDir = fs.mkdtempSync(path.join(os.tmpdir(), "payout-analytics-sync2-"));
  const prevEvent = process.env.EVENT_LOG_DIR;
  const prevSync = process.env.PAYOUT_ANALYTICS_SYNC_DIR;
  process.env.EVENT_LOG_DIR = eventDir;
  process.env.PAYOUT_ANALYTICS_SYNC_DIR = syncDir;
  try {
    const {
      initPayoutAnalyticsBridgeForRuntime,
      recordPayoutSentAnalyticsEvent,
      resetPayoutAnalyticsBridgeForTests,
    } = await loadBridgeModules();
    resetPayoutAnalyticsBridgeForTests();
    initPayoutAnalyticsBridgeForRuntime();
    const input = {
      claimId: "idem-claim",
      recipientAddress: "NQ97 4M1T 4TGD VC7F LHLQ Y2DY 425N 5CVH M02Y",
      roomId: "chamber",
      tileKey: "0,0",
      txHash: "tx-idem",
      sentAt: 1_700_000_000_000,
      enqueuedAt: 1_700_000_000_000 - 1000,
      amountLuna: "50000",
    };
    assert.equal(recordPayoutSentAnalyticsEvent(input).recorded, true);
    assert.equal(recordPayoutSentAnalyticsEvent(input).duplicate, true);
    assert.equal(countNimPayoutSentInDir(eventDir), 1);
  } finally {
    if (prevEvent !== undefined) process.env.EVENT_LOG_DIR = prevEvent;
    else delete process.env.EVENT_LOG_DIR;
    if (prevSync !== undefined) process.env.PAYOUT_ANALYTICS_SYNC_DIR = prevSync;
    else delete process.env.PAYOUT_ANALYTICS_SYNC_DIR;
    const { resetPayoutAnalyticsBridgeForTests } = await loadBridgeModules();
    resetPayoutAnalyticsBridgeForTests();
    fs.rmSync(eventDir, { recursive: true, force: true });
    fs.rmSync(syncDir, { recursive: true, force: true });
  }
});

test("backfill reads sent history from payout service", async (t) => {
  const eventDir = fs.mkdtempSync(path.join(os.tmpdir(), "payout-analytics-bf-ev-"));
  const syncDir = fs.mkdtempSync(path.join(os.tmpdir(), "payout-analytics-bf-sync-"));
  const payoutDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "payout-analytics-bf-svc-"));
  t.after(() => {
    fs.rmSync(eventDir, { recursive: true, force: true });
    fs.rmSync(syncDir, { recursive: true, force: true });
    fs.rmSync(payoutDataDir, { recursive: true, force: true });
  });

  const { createPayoutApp } = await import("../../payout-service/src/app.js");
  const { createFakeChainClient } = await import(
    "../../payout-service/src/chain/fakeClient.js"
  );
  const { resetQueueForTests } = await import("../../payout-service/src/queue.js");
  const { appendSentHistoryLine, initHistoryPaths } = await import(
    "../../payout-service/src/history.js"
  );

  resetQueueForTests();
  const fake = createFakeChainClient();
  const cfg = {
    host: "127.0.0.1",
    port: 0,
    apiSecret: "backfill-secret",
    gameServerInternalUrl: null,
    dataDir: payoutDataDir,
    nimNetwork: "testalbatross",
    defaultTxMessage: "test",
    processIntervalMs: 50_000,
    balanceCacheMs: 20_000,
    maxBackoffMs: 3_600_000,
    deadLetterAfterAttempts: 80,
  };
  initHistoryPaths(cfg);
  appendSentHistoryLine(
    {
      claimId: "backfill-claim",
      recipientAddress: "NQ97 4M1T 4TGD VC7F LHLQ Y2DY 425N 5CVH M02Y",
      amountLuna: 200_000n,
      createdAt: Date.now() - 10_000,
      status: "completed",
      roomId: "chamber",
      tileKey: "3,4",
      id: "job-backfill",
    },
    "backfill-tx",
    Date.now()
  );

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
  const prevEvent = process.env.EVENT_LOG_DIR;
  const prevSync = process.env.PAYOUT_ANALYTICS_SYNC_DIR;
  const prevSince = process.env.PAYOUT_ANALYTICS_BACKFILL_SINCE_MS;
  process.env.PAYOUT_SERVICE_URL = baseUrl;
  process.env.PAYOUT_SERVICE_API_SECRET = "backfill-secret";
  process.env.EVENT_LOG_DIR = eventDir;
  process.env.PAYOUT_ANALYTICS_SYNC_DIR = syncDir;
  process.env.PAYOUT_ANALYTICS_BACKFILL_SINCE_MS = "0";
  try {
    const {
      backfillPayoutAnalyticsFromServiceOnce,
      resetPayoutAnalyticsBridgeForTests,
    } = await loadBridgeModules();
    resetPayoutAnalyticsBridgeForTests();
    const out = await backfillPayoutAnalyticsFromServiceOnce();
    assert.equal(out.sentRecorded, 1);
    assert.equal(countNimPayoutSentInDir(eventDir), 1);
  } finally {
    if (prevUrl !== undefined) process.env.PAYOUT_SERVICE_URL = prevUrl;
    else delete process.env.PAYOUT_SERVICE_URL;
    if (prevSecret !== undefined) process.env.PAYOUT_SERVICE_API_SECRET = prevSecret;
    else delete process.env.PAYOUT_SERVICE_API_SECRET;
    if (prevEvent !== undefined) process.env.EVENT_LOG_DIR = prevEvent;
    else delete process.env.EVENT_LOG_DIR;
    if (prevSync !== undefined) process.env.PAYOUT_ANALYTICS_SYNC_DIR = prevSync;
    else delete process.env.PAYOUT_ANALYTICS_SYNC_DIR;
    if (prevSince !== undefined) process.env.PAYOUT_ANALYTICS_BACKFILL_SINCE_MS = prevSince;
    else delete process.env.PAYOUT_ANALYTICS_BACKFILL_SINCE_MS;
    const { resetPayoutAnalyticsBridgeForTests } = await loadBridgeModules();
    resetPayoutAnalyticsBridgeForTests();
  }
});
