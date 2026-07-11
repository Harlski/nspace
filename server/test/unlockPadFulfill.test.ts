import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "unlock-pad-fulfill-"));
process.env.UNLOCK_PAD_GRANT_STORE_FILE = path.join(tmpDir, "grants.json");

const { normalizeUnlockPadConfig, recordUnlockPadGrant, hasUnlockPadGrant } =
  await import("../src/unlockPad/index.js");
const {
  createUnlockPadPaymentIntent,
  confirmUnlockPadPayment,
  setUnlockPadLookup,
} = await import("../src/unlockPad/fulfill.js");

const padCfg = normalizeUnlockPadConfig({
  amountLuna: "100000",
  recipient: "NQ01RECIP",
  buttonLabel: "Unlock",
  proofMode: "payment_intent",
  instanceId: "pad-pi-1",
})!;

setUnlockPadLookup((roomId, instanceId) => {
  if (roomId === "hub" && instanceId === padCfg.instanceId) return padCfg;
  return null;
});

test("createUnlockPadPaymentIntent rejects when payment intent not configured", async () => {
  const prevUrl = process.env.PAYMENT_INTENT_SERVICE_URL;
  const prevSecret = process.env.PAYMENT_INTENT_API_SECRET;
  delete process.env.PAYMENT_INTENT_SERVICE_URL;
  delete process.env.PAYMENT_INTENT_API_SECRET;
  try {
    const r = await createUnlockPadPaymentIntent(
      "NQWALLET1",
      "hub",
      padCfg.instanceId
    );
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error, "payment_intent_not_configured");
  } finally {
    if (prevUrl !== undefined) process.env.PAYMENT_INTENT_SERVICE_URL = prevUrl;
    else delete process.env.PAYMENT_INTENT_SERVICE_URL;
    if (prevSecret !== undefined)
      process.env.PAYMENT_INTENT_API_SECRET = prevSecret;
    else delete process.env.PAYMENT_INTENT_API_SECRET;
  }
});

test("createUnlockPadPaymentIntent rejects missing pad", async () => {
  process.env.PAYMENT_INTENT_SERVICE_URL = "http://127.0.0.1:3090";
  process.env.PAYMENT_INTENT_API_SECRET = "test-secret";
  const r = await createUnlockPadPaymentIntent("NQW", "hub", "missing");
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error, "pad_not_found");
});

test("createUnlockPadPaymentIntent rejects already unlocked", async () => {
  process.env.PAYMENT_INTENT_SERVICE_URL = "http://127.0.0.1:3090";
  process.env.PAYMENT_INTENT_API_SECRET = "test-secret";
  recordUnlockPadGrant({
    wallet: "NQALREADY",
    roomId: "hub",
    instanceId: padCfg.instanceId,
  });
  const r = await createUnlockPadPaymentIntent(
    "NQALREADY",
    "hub",
    padCfg.instanceId
  );
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error, "already_unlocked");
  assert.equal(hasUnlockPadGrant("NQALREADY", "hub", padCfg.instanceId), true);
});

test("confirmUnlockPadPayment rejects wrong feature without calling chain when pad missing", async () => {
  const r = await confirmUnlockPadPayment(
    "NQW",
    "intent-x",
    "hub",
    "no-such-pad"
  );
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error, "pad_not_found");
});
