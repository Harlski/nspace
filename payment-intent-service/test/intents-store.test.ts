import assert from "node:assert/strict";
import test from "node:test";
import type { AppConfig } from "../src/config.js";
import { registerBuiltinFeatureHandlers } from "../src/features/builtin.js";
import { createIntent, getIntent } from "../src/intents.js";
import { IntentStore } from "../src/store.js";

registerBuiltinFeatureHandlers();

const testRecipient = "NQ97 4M1T 4TGD VC7F LHLQ Y2DY 425N 5CVH M02Y";

const testCfg: AppConfig = {
  port: 3090,
  apiSecret: "unit-test-secret",
  sqlitePath: ":memory:",
  recipientAddress: testRecipient,
  nimNetwork: "testalbatross",
  nimClientLogLevel: "error",
  intentTtlMs: 120_000,
  minConfirmations: 1,
};

test("createIntent persists row and returns memo with intent id", async () => {
  const store = new IntentStore(":memory:");
  const pub = await createIntent(store, testCfg, {
    featureKind: "nspace.test.min",
    payerWallet: testRecipient,
    featurePayload: { amountLuna: "200000" },
  });
  assert.match(pub.memo, /^NSPACE:pi:[0-9a-f-]{36}$/i);
  assert.equal(pub.amountLuna, "200000");
  assert.equal(pub.recipient, testRecipient.replace(/\s+/g, "").toUpperCase());
  const again = getIntent(store, pub.intentId);
  assert.ok(again);
  assert.equal(again.status, "pending");
});

test("idempotency returns same intent when still pending", async () => {
  const store = new IntentStore(":memory:");
  const a = await createIntent(store, testCfg, {
    featureKind: "nspace.test.min",
    payerWallet: testRecipient,
    featurePayload: {},
    idempotencyKey: "idem-1",
  });
  const b = await createIntent(store, testCfg, {
    featureKind: "nspace.test.min",
    payerWallet: testRecipient,
    featurePayload: {},
    idempotencyKey: "idem-1",
  });
  assert.equal(a.intentId, b.intentId);
});
