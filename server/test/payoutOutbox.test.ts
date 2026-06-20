import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  appendPayIntentToOutbox,
  drainOutboxOnce,
  initOutboxForTests,
  isClaimDeliveredForTests,
  listUndeliveredOutboxForTests,
  reloadOutboxFromDiskForTests,
} from "../src/payoutOutbox.js";
import type { PayIntentDeliverer, PayIntentPayload } from "../src/payoutServiceClient.js";

const testIntent = {
  claimId: "outbox-claim-1",
  recipientAddress: "NQ97 4M1T 4TGD VC7F LHLQ Y2DY 425N 5CVH M02Y",
  amountLuna: 50_000n,
  roomId: "canvas",
  tileKey: "2,3,0",
};

test("outbox persists until acknowledged and redelivers on failure", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "payout-outbox-"));
  t.after(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });
  process.env.PAYOUT_OUTBOX_DIR = dir;

  const attempts: PayIntentPayload[] = [];
  let failNext = true;
  const deliverer: PayIntentDeliverer = async (intent) => {
    attempts.push(intent);
    if (failNext) {
      failNext = false;
      return { ok: false, error: "simulated timeout" };
    }
    return { ok: true };
  };

  initOutboxForTests({ deliverer });
  appendPayIntentToOutbox(testIntent);
  assert.equal(listUndeliveredOutboxForTests().length, 1);

  await drainOutboxOnce();
  assert.equal(isClaimDeliveredForTests(testIntent.claimId), false);
  assert.equal(attempts.length, 1);

  await drainOutboxOnce();
  assert.equal(isClaimDeliveredForTests(testIntent.claimId), true);
  assert.equal(listUndeliveredOutboxForTests().length, 0);
  assert.equal(attempts.length, 2);
});

test("outbox survives simulated game-server restart", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "payout-outbox-restart-"));
  t.after(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });
  process.env.PAYOUT_OUTBOX_DIR = dir;

  const deliverer: PayIntentDeliverer = async () => ({ ok: true });
  initOutboxForTests({ deliverer });
  appendPayIntentToOutbox(testIntent);

  reloadOutboxFromDiskForTests();
  assert.equal(isClaimDeliveredForTests(testIntent.claimId), false);
  await drainOutboxOnce();
  assert.equal(isClaimDeliveredForTests(testIntent.claimId), true);
});

test("duplicate outbox append by claimId is ignored", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "payout-outbox-dup-"));
  t.after(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });
  process.env.PAYOUT_OUTBOX_DIR = dir;

  initOutboxForTests({
    deliverer: async () => ({ ok: true }),
  });
  appendPayIntentToOutbox(testIntent);
  appendPayIntentToOutbox(testIntent);
  assert.equal(listUndeliveredOutboxForTests().length, 1);
});
