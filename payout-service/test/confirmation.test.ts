import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createFakeChainClient } from "../src/chain/fakeClient.js";
import type { PayoutSendResult, TxLifecycleState } from "../src/chain/types.js";
import type { AppConfig } from "../src/config.js";
import { createPayoutApp } from "../src/app.js";
import {
  drainQueueForTests,
  enqueuePayIntent,
  listPendingJobsForTests,
  manualBulkPayoutPendingForRecipient,
  resetQueueForTests,
  runReconcileForTests,
  stopPayoutProcessorForTests,
} from "../src/queue.js";

const recipient = "NQ97 4M1T 4TGD VC7F LHLQ Y2DY 425N 5CVH M02Y";

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

function mkDataDir(tag: string, t: test.TestContext): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `payout-confirm-${tag}-`));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function readSentHistory(dataDir: string): unknown[] {
  const f = path.join(dataDir, "nim-payout-sent.jsonl");
  if (!fs.existsSync(f)) return [];
  return fs
    .readFileSync(f, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

test(
  "worker: broadcast that never confirms is NOT re-sent (double-pay guard)",
  { concurrency: false },
  async (t) => {
    const dataDir = mkDataDir("worker-noresend", t);
    resetQueueForTests();

    // Simulates the incident: the tx is broadcast, but confirmation times out, so
    // sendPayout returns state="pending" (broadcast, unconfirmed) rather than throwing.
    const fake = createFakeChainClient({
      onSend: async (): Promise<PayoutSendResult> => ({
        txHash: "broadcast-unconfirmed-tx",
        state: "pending",
      }),
    });
    createPayoutApp({ cfg: testCfg(dataDir), chainClient: fake, startProcessor: false });

    enqueuePayIntent({
      claimId: "c1",
      recipientAddress: recipient,
      roomId: "canvas",
      tileKey: "1,1,0",
    });

    await drainQueueForTests({ maxTicks: 10 });

    // Exactly one broadcast, and it is parked awaiting confirmation - never re-sent.
    assert.equal(fake.sends.length, 1);
    assert.equal(listPendingJobsForTests().length, 0, "not pending anymore");
    assert.equal(readSentHistory(dataDir).length, 0, "not recorded until confirmed");

    stopPayoutProcessorForTests();
  }
);

test(
  "worker: unconfirmed broadcast finalizes once the chain confirms it",
  { concurrency: false },
  async (t) => {
    const dataDir = mkDataDir("worker-finalize", t);
    resetQueueForTests();

    let confirmed = false;
    const fake = createFakeChainClient({
      onSend: async (): Promise<PayoutSendResult> => ({
        txHash: "tx-eventually-confirms",
        state: "pending",
      }),
      onGetState: (): TxLifecycleState => (confirmed ? "confirmed" : "pending"),
    });
    createPayoutApp({ cfg: testCfg(dataDir), chainClient: fake, startProcessor: false });

    enqueuePayIntent({
      claimId: "c1",
      recipientAddress: recipient,
      roomId: "canvas",
      tileKey: "1,1,0",
    });
    await drainQueueForTests({ maxTicks: 5 });
    assert.equal(fake.sends.length, 1);

    // Not yet confirmed: reconciliation leaves it in place, no re-send.
    let r = await runReconcileForTests();
    assert.deepEqual(r, { finalized: 0, reQueued: 0, escalated: 0 });
    assert.equal(fake.sends.length, 1);

    // Chain confirms: reconciliation finalizes it, still no second broadcast.
    confirmed = true;
    r = await runReconcileForTests();
    assert.equal(r.finalized, 1);
    assert.equal(fake.sends.length, 1);
    assert.equal(readSentHistory(dataDir).length, 1);

    stopPayoutProcessorForTests();
  }
);

test(
  "worker: broadcast that expires IS re-queued and re-sent (no under-pay)",
  { concurrency: false },
  async (t) => {
    const dataDir = mkDataDir("worker-expire", t);
    resetQueueForTests();

    let expiredOnce = false;
    const fake = createFakeChainClient({
      onSend: async (): Promise<PayoutSendResult> => {
        // First broadcast is unconfirmed; second (after re-queue) confirms.
        return expiredOnce
          ? { txHash: "tx-second", state: "confirmed" }
          : { txHash: "tx-first", state: "pending" };
      },
      onGetState: (): TxLifecycleState => "expired",
    });
    createPayoutApp({ cfg: testCfg(dataDir), chainClient: fake, startProcessor: false });

    enqueuePayIntent({
      claimId: "c1",
      recipientAddress: recipient,
      roomId: "canvas",
      tileKey: "1,1,0",
    });
    await drainQueueForTests({ maxTicks: 5 });
    assert.equal(fake.sends.length, 1);

    // Chain reports the broadcast expired (no funds moved): safe to re-queue.
    const r = await runReconcileForTests();
    assert.equal(r.reQueued, 1);
    assert.equal(listPendingJobsForTests().length, 1);

    expiredOnce = true;
    await drainQueueForTests({ maxTicks: 5 });
    assert.equal(fake.sends.length, 2, "re-sent exactly once after provable expiry");
    assert.equal(readSentHistory(dataDir).length, 1);

    stopPayoutProcessorForTests();
  }
);

test(
  "worker: stuck-unknown broadcast is escalated to review, never re-sent",
  { concurrency: false },
  async (t) => {
    const dataDir = mkDataDir("worker-review", t);
    resetQueueForTests();

    const fake = createFakeChainClient({
      onSend: async (): Promise<PayoutSendResult> => ({
        txHash: "tx-stuck",
        state: "pending",
      }),
      onGetState: (): TxLifecycleState => "unknown",
    });
    createPayoutApp(
      { cfg: testCfg(dataDir, { unconfirmedReviewMs: 1 }), chainClient: fake, startProcessor: false }
    );

    enqueuePayIntent({
      claimId: "c1",
      recipientAddress: recipient,
      roomId: "canvas",
      tileKey: "1,1,0",
    });
    await drainQueueForTests({ maxTicks: 5 });

    await new Promise((r) => setTimeout(r, 5));
    const r = await runReconcileForTests();
    assert.equal(r.escalated, 1);
    assert.equal(fake.sends.length, 1, "never re-sent an ambiguous broadcast");
    assert.equal(listPendingJobsForTests().length, 0);

    const reviewFile = path.join(dataDir, "nim-payout-needs-review.jsonl");
    assert.equal(fs.existsSync(reviewFile), true);

    stopPayoutProcessorForTests();
  }
);

test(
  "bulk: unconfirmed combined broadcast is parked, not re-sent",
  { concurrency: false },
  async (t) => {
    const dataDir = mkDataDir("bulk-noresend", t);
    resetQueueForTests();

    let confirmed = false;
    const fake = createFakeChainClient({
      onSend: async (): Promise<PayoutSendResult> => ({
        txHash: "bulk-tx",
        state: "pending",
      }),
      onGetState: (): TxLifecycleState => (confirmed ? "included" : "pending"),
    });
    createPayoutApp({ cfg: testCfg(dataDir), chainClient: fake, startProcessor: false });

    for (const claimId of ["b1", "b2", "b3"]) {
      enqueuePayIntent({
        claimId,
        recipientAddress: recipient,
        roomId: "canvas",
        tileKey: `${claimId},0,0`,
      });
    }

    const out = await manualBulkPayoutPendingForRecipient(recipient);
    assert.equal(out.jobsCleared, 3);
    assert.equal(fake.sends.length, 1, "one combined broadcast");
    assert.equal(readSentHistory(dataDir).length, 0, "not recorded until confirmed");

    // A second manual trigger must find nothing pending (jobs are awaiting confirmation).
    await assert.rejects(
      manualBulkPayoutPendingForRecipient(recipient),
      /no_pending_jobs/
    );
    assert.equal(fake.sends.length, 1, "not re-sent");

    confirmed = true;
    const r = await runReconcileForTests();
    assert.equal(r.finalized, 3);
    assert.equal(readSentHistory(dataDir).length, 3);
    const bulkLog = path.join(dataDir, "nim-payout-manual-bulk.jsonl");
    assert.equal(fs.existsSync(bulkLog), true);

    stopPayoutProcessorForTests();
  }
);

test(
  "pre-broadcast failure is still retried (safe path unchanged)",
  { concurrency: false },
  async (t) => {
    const dataDir = mkDataDir("prebroadcast-retry", t);
    resetQueueForTests();

    let attempts = 0;
    const fake = createFakeChainClient({
      onSend: async (): Promise<PayoutSendResult> => {
        attempts += 1;
        if (attempts < 2) throw new Error("no consensus - not broadcast");
        return { txHash: "tx-ok", state: "confirmed" };
      },
    });
    createPayoutApp({ cfg: testCfg(dataDir), chainClient: fake, startProcessor: false });

    enqueuePayIntent({
      claimId: "c1",
      recipientAddress: recipient,
      roomId: "canvas",
      tileKey: "1,1,0",
    });
    await drainQueueForTests({ maxTicks: 10 });

    assert.equal(attempts, 2, "retried after a not-broadcast failure");
    assert.equal(readSentHistory(dataDir).length, 1);
    assert.equal(listPendingJobsForTests().length, 0);

    stopPayoutProcessorForTests();
  }
);
