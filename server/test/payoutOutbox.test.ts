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
  outboxFileSizeForTests,
  reloadOutboxFromDiskForTests,
  clearDeliveredClaimIdsForTests,
} from "../src/payoutOutbox.js";
import type { PayIntentDeliverer, PayIntentPayload } from "../src/payoutServiceClient.js";

const testIntent = {
  claimId: "outbox-claim-1",
  recipientAddress: "NQ97 4M1T 4TGD VC7F LHLQ Y2DY 425N 5CVH M02Y",
  amountLuna: 50_000n,
  roomId: "canvas",
  // Non-grid tileKey so local mining-ban state cannot hold these test intents.
  tileKey: "test:outbox",
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

test("outbox delivers after service outage and game-server restart", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "payout-outbox-outage-"));
  t.after(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });
  process.env.PAYOUT_OUTBOX_DIR = dir;

  let serviceUp = false;
  initOutboxForTests({
    deliverer: async () =>
      serviceUp ? { ok: true } : { ok: false, error: "service unreachable" },
  });
  appendPayIntentToOutbox(testIntent);
  await drainOutboxOnce();
  assert.equal(isClaimDeliveredForTests(testIntent.claimId), false);

  reloadOutboxFromDiskForTests();
  assert.equal(listUndeliveredOutboxForTests().length, 1);

  serviceUp = true;
  await drainOutboxOnce();
  assert.equal(isClaimDeliveredForTests(testIntent.claimId), true);
  assert.equal(listUndeliveredOutboxForTests().length, 0);
});

test("compacts delivered history out of outbox.jsonl so idle drains stay cheap", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "payout-outbox-compact-"));
  t.after(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });
  process.env.PAYOUT_OUTBOX_DIR = dir;

  const deliverer: PayIntentDeliverer = async () => ({ ok: true });
  initOutboxForTests({ deliverer });

  // Simulate a never-compacted production file: many already-delivered lines still on disk.
  const outboxPath = path.join(dir, "outbox.jsonl");
  const deliveredPath = path.join(dir, "delivered-claim-ids.json");
  const deliveredIds: string[] = [];
  const lines: string[] = [];
  for (let i = 0; i < 5000; i++) {
    const claimId = `hist-claim-${i}`;
    deliveredIds.push(claimId);
    lines.push(
      JSON.stringify({
        claimId,
        recipientAddress: testIntent.recipientAddress,
        amountLuna: "1000",
        roomId: "hub",
        tileKey: "test:hist",
        enqueuedAt: Date.now(),
      })
    );
  }
  fs.writeFileSync(outboxPath, lines.join("\n") + "\n", "utf8");
  fs.writeFileSync(deliveredPath, JSON.stringify(deliveredIds), "utf8");
  const bloatedBytes = fs.statSync(outboxPath).size;
  assert.ok(bloatedBytes > 100_000, `expected bloated fixture, got ${bloatedBytes}`);

  // Startup / reload must compact delivered history off disk.
  reloadOutboxFromDiskForTests();
  assert.equal(listUndeliveredOutboxForTests().length, 0);
  assert.ok(
    outboxFileSizeForTests() < 100,
    `outbox.jsonl should be empty after compact, got ${outboxFileSizeForTests()} bytes (was ${bloatedBytes})`
  );

  appendPayIntentToOutbox({ ...testIntent, claimId: "fresh-claim" });
  await drainOutboxOnce();
  assert.equal(isClaimDeliveredForTests("fresh-claim"), true);
  assert.equal(listUndeliveredOutboxForTests().length, 0);
  assert.ok(
    outboxFileSizeForTests() < 100,
    "successful delivery must rewrite outbox without the delivered line"
  );
});

test("delivered claim ids append one line each (no full-array rewrite)", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "payout-outbox-append-ids-"));
  t.after(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });
  process.env.PAYOUT_OUTBOX_DIR = dir;

  initOutboxForTests({
    deliverer: async () => ({ ok: true }),
  });

  const jsonlPath = path.join(dir, "delivered-claim-ids.jsonl");
  const legacyPath = path.join(dir, "delivered-claim-ids.json");

  for (let i = 0; i < 40; i++) {
    appendPayIntentToOutbox({ ...testIntent, claimId: `append-claim-${i}` });
    await drainOutboxOnce();
  }

  assert.equal(fs.existsSync(jsonlPath), true);
  assert.equal(fs.existsSync(legacyPath), false);
  const bytes = fs.statSync(jsonlPath).size;
  // 40 short ids + newlines should stay well under a full JSON rewrite of a large set.
  assert.ok(bytes < 2_000, `expected small append-only file, got ${bytes} bytes`);
  const lines = fs.readFileSync(jsonlPath, "utf8").trim().split("\n");
  assert.equal(lines.length, 40);

  reloadOutboxFromDiskForTests();
  assert.equal(isClaimDeliveredForTests("append-claim-0"), true);
  assert.equal(isClaimDeliveredForTests("append-claim-39"), true);
});

test("migrates legacy delivered-claim-ids.json to jsonl once", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "payout-outbox-migrate-ids-"));
  t.after(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });
  process.env.PAYOUT_OUTBOX_DIR = dir;

  initOutboxForTests({
    deliverer: async () => ({ ok: true }),
  });

  const legacyPath = path.join(dir, "delivered-claim-ids.json");
  const jsonlPath = path.join(dir, "delivered-claim-ids.jsonl");
  const bakPath = `${legacyPath}.pre-jsonl.bak`;
  fs.writeFileSync(legacyPath, JSON.stringify(["legacy-a", "legacy-b"]), "utf8");
  reloadOutboxFromDiskForTests();

  assert.equal(isClaimDeliveredForTests("legacy-a"), true);
  assert.equal(isClaimDeliveredForTests("legacy-b"), true);
  assert.equal(fs.existsSync(jsonlPath), true);
  assert.equal(fs.existsSync(legacyPath), false);
  assert.equal(fs.existsSync(bakPath), true);
});
