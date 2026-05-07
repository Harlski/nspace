import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizePaymentIntentServiceBaseUrl,
  probePaymentIntentService,
} from "../src/paymentIntentProbe.js";

test("normalizePaymentIntentServiceBaseUrl trims and strips trailing slash", () => {
  assert.equal(
    normalizePaymentIntentServiceBaseUrl("  http://127.0.0.1:3090/  "),
    "http://127.0.0.1:3090"
  );
  assert.equal(normalizePaymentIntentServiceBaseUrl(""), null);
  assert.equal(normalizePaymentIntentServiceBaseUrl(undefined), null);
});

test("probePaymentIntentService returns not configured when URL unset", async () => {
  const prev = process.env.PAYMENT_INTENT_SERVICE_URL;
  const prevSecret = process.env.PAYMENT_INTENT_API_SECRET;
  delete process.env.PAYMENT_INTENT_SERVICE_URL;
  delete process.env.PAYMENT_INTENT_API_SECRET;
  try {
    const out = await probePaymentIntentService(100);
    assert.equal(out.configured, false);
    if (!out.configured) {
      assert.ok(out.hint.includes("PAYMENT_INTENT_SERVICE_URL"));
    }
  } finally {
    if (prev !== undefined) process.env.PAYMENT_INTENT_SERVICE_URL = prev;
    else delete process.env.PAYMENT_INTENT_SERVICE_URL;
    if (prevSecret !== undefined) process.env.PAYMENT_INTENT_API_SECRET = prevSecret;
    else delete process.env.PAYMENT_INTENT_API_SECRET;
  }
});
