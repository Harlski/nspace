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
} from "../src/payoutOutbox.js";
import type { PayIntentDeliverer } from "../src/payoutServiceClient.js";

const bannedWallet = "NQ97 4M1T 4TGD VC7F LHLQ Y2DY 425N 5CVH M02Y";
const miningIntent = {
  claimId: "mining-ban-claim-1",
  recipientAddress: bannedWallet,
  amountLuna: 50_000n,
  roomId: "canvas",
  tileKey: "2,3,0",
};
const mazeIntent = {
  claimId: "maze-ban-claim-1",
  recipientAddress: bannedWallet,
  amountLuna: 100_000n,
  roomId: "maze",
  tileKey: "maze-first-place",
};

test("outbox holds block-claim payouts for mining-banned wallets", async (t) => {
  const outboxDir = fs.mkdtempSync(path.join(os.tmpdir(), "payout-outbox-ban-"));
  const modDir = fs.mkdtempSync(path.join(os.tmpdir(), "moderation-ban-"));
  t.after(() => {
    fs.rmSync(outboxDir, { recursive: true, force: true });
    fs.rmSync(modDir, { recursive: true, force: true });
    delete process.env.PAYOUT_OUTBOX_DIR;
    delete process.env.MODERATION_STORE_FILE;
  });
  process.env.PAYOUT_OUTBOX_DIR = outboxDir;
  process.env.MODERATION_STORE_FILE = path.join(modDir, "moderation.json");

  const { setMiningBanned } = await import("../src/moderationStore.js");
  setMiningBanned(bannedWallet, true, "ADMIN");

  const delivered: string[] = [];
  const deliverer: PayIntentDeliverer = async (intent) => {
    delivered.push(intent.claimId);
    return { ok: true };
  };

  initOutboxForTests({ deliverer });
  appendPayIntentToOutbox(miningIntent);
  appendPayIntentToOutbox(mazeIntent);

  await drainOutboxOnce();

  assert.equal(isClaimDeliveredForTests(miningIntent.claimId), false);
  assert.equal(isClaimDeliveredForTests(mazeIntent.claimId), true);
  assert.deepEqual(delivered, [mazeIntent.claimId]);
  assert.equal(listUndeliveredOutboxForTests().length, 1);
});
