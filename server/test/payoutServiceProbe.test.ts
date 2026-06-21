import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizePayoutServiceBaseUrl,
  probePayoutService,
} from "../src/payoutServiceProbe.js";

test("normalizePayoutServiceBaseUrl trims and strips trailing slash", () => {
  assert.equal(
    normalizePayoutServiceBaseUrl("  http://127.0.0.1:3091/  "),
    "http://127.0.0.1:3091"
  );
  assert.equal(normalizePayoutServiceBaseUrl(""), null);
  assert.equal(normalizePayoutServiceBaseUrl(undefined), null);
});

test("probePayoutService returns not configured when URL unset", async () => {
  const prevUrl = process.env.PAYOUT_SERVICE_URL;
  const prevSecret = process.env.PAYOUT_SERVICE_API_SECRET;
  delete process.env.PAYOUT_SERVICE_URL;
  delete process.env.PAYOUT_SERVICE_API_SECRET;
  try {
    const out = await probePayoutService(100);
    assert.equal(out.configured, false);
    if (!out.configured) {
      assert.equal(out.statusTone, "off");
      assert.ok(out.hint.includes("PAYOUT_SERVICE_URL"));
    }
  } finally {
    if (prevUrl !== undefined) process.env.PAYOUT_SERVICE_URL = prevUrl;
    else delete process.env.PAYOUT_SERVICE_URL;
    if (prevSecret !== undefined) process.env.PAYOUT_SERVICE_API_SECRET = prevSecret;
    else delete process.env.PAYOUT_SERVICE_API_SECRET;
  }
});
