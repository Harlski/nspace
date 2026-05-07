import assert from "node:assert/strict";
import test from "node:test";
import { isPaymentIntentSidecarConfigured } from "../src/paymentIntentClient.js";
import { normalizePaymentIntentServiceBaseUrl } from "../src/paymentIntentProbe.js";

test("isPaymentIntentSidecarConfigured requires both URL and secret", () => {
  const u = process.env.PAYMENT_INTENT_SERVICE_URL;
  const s = process.env.PAYMENT_INTENT_API_SECRET;
  delete process.env.PAYMENT_INTENT_SERVICE_URL;
  delete process.env.PAYMENT_INTENT_API_SECRET;
  try {
    assert.equal(isPaymentIntentSidecarConfigured(), false);
    process.env.PAYMENT_INTENT_SERVICE_URL = "http://127.0.0.1:3090";
    assert.equal(isPaymentIntentSidecarConfigured(), false);
    process.env.PAYMENT_INTENT_API_SECRET = "x";
    assert.equal(isPaymentIntentSidecarConfigured(), true);
  } finally {
    if (u !== undefined) process.env.PAYMENT_INTENT_SERVICE_URL = u;
    else delete process.env.PAYMENT_INTENT_SERVICE_URL;
    if (s !== undefined) process.env.PAYMENT_INTENT_API_SECRET = s;
    else delete process.env.PAYMENT_INTENT_API_SECRET;
  }
});

test("normalizePaymentIntentServiceBaseUrl still trims service URL", () => {
  assert.equal(
    normalizePaymentIntentServiceBaseUrl("http://a/"),
    "http://a"
  );
});
