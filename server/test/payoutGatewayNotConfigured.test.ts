import assert from "node:assert/strict";
import test from "node:test";
import {
  getPendingSnapshotForWallet,
  getPublicPendingSummary,
} from "../src/payoutGateway.js";

test("payout gateway returns empty summary when service is not configured", async () => {
  const prevUrl = process.env.PAYOUT_SERVICE_URL;
  const prevSecret = process.env.PAYOUT_SERVICE_API_SECRET;
  delete process.env.PAYOUT_SERVICE_URL;
  delete process.env.PAYOUT_SERVICE_API_SECRET;
  try {
    const summary = await getPublicPendingSummary();
    assert.equal(summary.mode, "summary");
    assert.equal(summary.pendingTotal, 0);
    assert.equal(summary.allSent, true);
    assert.match(String(summary.message), /not configured/i);

    const wallet = await getPendingSnapshotForWallet(
      "NQ97 4M1T 4TGD VC7F LHLQ Y2DY 425N 5CVH M02Y"
    );
    assert.equal(wallet.mode, "wallet");
    assert.deepEqual(wallet.rows, []);
    assert.deepEqual(wallet.historyRows, []);
  } finally {
    if (prevUrl !== undefined) process.env.PAYOUT_SERVICE_URL = prevUrl;
    else delete process.env.PAYOUT_SERVICE_URL;
    if (prevSecret !== undefined) process.env.PAYOUT_SERVICE_API_SECRET = prevSecret;
    else delete process.env.PAYOUT_SERVICE_API_SECRET;
  }
});
