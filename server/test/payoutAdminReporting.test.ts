import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { Server } from "node:http";
import { createFakeChainClient } from "../../payout-service/src/chain/fakeClient.js";
import { createPayoutApp } from "../../payout-service/src/app.js";
import type { AppConfig } from "../../payout-service/src/config.js";
import { resetQueueForTests, stopPayoutProcessorForTests } from "../../payout-service/src/queue.js";
import {
  formatDailyStatsMessage,
  runEndOfDaySnapshotReportFlushSequence,
  type PendingPayoutSummaryForReport,
} from "../src/dailyStatsReport.js";
import type { DailyStatsAggregate } from "../src/eventLog.js";
import {
  getPendingQueueTotals,
  triggerManualBulkPayout,
  triggerEndOfDayFlush,
} from "../src/payoutGateway.js";
import { deliverPayIntentToService } from "../src/payoutServiceClient.js";
import {
  appendPayIntentToOutbox,
  drainOutboxOnce,
  initOutboxForTests,
} from "../src/payoutOutbox.js";

const testRecipient = "NQ97 4M1T 4TGD VC7F LHLQ Y2DY 425N 5CVH M02Y";

async function withStubService(
  t: test.TestContext,
  run: (baseUrl: string) => Promise<void>
): Promise<void> {
  const payoutDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "admin-report-svc-"));
  const outboxDir = fs.mkdtempSync(path.join(os.tmpdir(), "admin-report-out-"));
  t.after(() => {
    fs.rmSync(payoutDataDir, { recursive: true, force: true });
    fs.rmSync(outboxDir, { recursive: true, force: true });
  });

  resetQueueForTests();
  const fake = createFakeChainClient();
  const cfg: AppConfig = {
    host: "127.0.0.1",
    port: 0,
    apiSecret: "admin-report-secret",
    dataDir: payoutDataDir,
    nimNetwork: "testalbatross",
    defaultTxMessage: "test",
    processIntervalMs: 50_000,
    balanceCacheMs: 20_000,
    maxBackoffMs: 3_600_000,
    deadLetterAfterAttempts: 80,
    autoBulkAfterMs: 0,
    autoBulkCheckIntervalMs: 300_000,
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
  t.after(() => {
    server.close();
    stopPayoutProcessorForTests();
  });

  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no port");
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  const prevUrl = process.env.PAYOUT_SERVICE_URL;
  const prevSecret = process.env.PAYOUT_SERVICE_API_SECRET;
  const prevOutbox = process.env.PAYOUT_OUTBOX_DIR;
  const prevFlush = process.env.NIM_PAYOUT_DAILY_FLUSH_ENABLED;
  const prevStats = process.env.DAILY_STATS_TELEGRAM_ENABLED;
  const prevStatsChat = process.env.DAILY_STATS_TELEGRAM_CHAT_ID;
  process.env.PAYOUT_SERVICE_URL = baseUrl;
  process.env.PAYOUT_SERVICE_API_SECRET = "admin-report-secret";
  process.env.PAYOUT_OUTBOX_DIR = outboxDir;
  process.env.NIM_PAYOUT_DAILY_FLUSH_ENABLED = "true";
  process.env.DAILY_STATS_TELEGRAM_ENABLED = "true";
  process.env.DAILY_STATS_TELEGRAM_CHAT_ID = "test-chat";
  t.after(() => {
    if (prevUrl !== undefined) process.env.PAYOUT_SERVICE_URL = prevUrl;
    else delete process.env.PAYOUT_SERVICE_URL;
    if (prevSecret !== undefined) process.env.PAYOUT_SERVICE_API_SECRET = prevSecret;
    else delete process.env.PAYOUT_SERVICE_API_SECRET;
    if (prevOutbox !== undefined) process.env.PAYOUT_OUTBOX_DIR = prevOutbox;
    else delete process.env.PAYOUT_OUTBOX_DIR;
    if (prevFlush !== undefined) process.env.NIM_PAYOUT_DAILY_FLUSH_ENABLED = prevFlush;
    else delete process.env.NIM_PAYOUT_DAILY_FLUSH_ENABLED;
    if (prevStats !== undefined) process.env.DAILY_STATS_TELEGRAM_ENABLED = prevStats;
    else delete process.env.DAILY_STATS_TELEGRAM_ENABLED;
    if (prevStatsChat !== undefined) process.env.DAILY_STATS_TELEGRAM_CHAT_ID = prevStatsChat;
    else delete process.env.DAILY_STATS_TELEGRAM_CHAT_ID;
  });

  initOutboxForTests({ deliverer: deliverPayIntentToService });
  await run(baseUrl);
}

async function enqueuePendingViaOutbox(claimIds: string[]): Promise<void> {
  for (const claimId of claimIds) {
    appendPayIntentToOutbox({
      claimId,
      recipientAddress: testRecipient,
      amountLuna: 100_000n,
      roomId: "canvas",
      tileKey: "3,4,0",
    });
  }
  await drainOutboxOnce();
}

const emptyAggregate: DailyStatsAggregate = {
  dayUtc: "2026-01-01",
  uniqueSignedIn: 0,
  newSignedIn: 0,
  nimiqPaySignedIn: 0,
  nonNimiqPaySignedIn: 0,
  sessionStarts: 0,
  payoutsSent: 0,
  payoutRecipients: 0,
  payoutNimTotal: "0",
  payoutLunaTotal: "0",
  activePlayMsTotal: 0,
  endedSessionsCounted: 0,
};

test("gateway manual bulk payout proxies to the service", async (t) => {
  await withStubService(t, async () => {
    await enqueuePendingViaOutbox(["bulk-a", "bulk-b"]);
    const before = await getPendingQueueTotals();
    assert.equal(before.jobCount, 2);

    const out = await triggerManualBulkPayout(testRecipient);
    assert.equal(out.jobsCleared, 2);
    assert.equal(out.totalLuna, "200000");

    const after = await getPendingQueueTotals();
    assert.equal(after.jobCount, 0);
  });
});

test("end-of-day sequence snapshots pending, reports, then flushes via service", async (t) => {
  await withStubService(t, async () => {
    await enqueuePendingViaOutbox(["eod-a", "eod-b"]);

    const steps: string[] = [];
    let reportPending: PendingPayoutSummaryForReport | undefined;

    const pending = await runEndOfDaySnapshotReportFlushSequence({
      recordStep: (step) => steps.push(step),
      sendReport: async (_dayStartMs, pendingInfo) => {
        reportPending = pendingInfo;
        const message = formatDailyStatsMessage(emptyAggregate, "test", pendingInfo);
        assert.match(message, /Pending in queue: 2 NIM/);
        assert.match(message, /Total NIM \(sent \+ pending\): 2 NIM/);
      },
      flush: triggerEndOfDayFlush,
    });

    assert.deepEqual(steps, ["snapshot", "report", "flush"]);
    assert.equal(pending.jobCount, 2);
    assert.equal(reportPending?.willFlush, true);
    assert.equal(reportPending?.luna, "200000");

    const after = await getPendingQueueTotals();
    assert.equal(after.jobCount, 0);
  });
});
