import assert from "node:assert/strict";
import test from "node:test";
import {
  getPendingPayoutSnapshotForWallet,
  getPublicPendingPayoutAdminPanelSnapshot,
  getPublicPendingPayoutSnapshot,
  getPublicPendingPayoutSummary,
} from "../src/history.js";
import {
  setMiningBannedWalletsForTests,
  stopMiningBanGateForTests,
} from "../src/miningBanGate.js";

const bannedWallet = "NQ97 4M1T 4TGD VC7F LHLQ Y2DY 425N 5CVH M02Y";
const otherWallet = "NQ55 CJKX 4N4T HHEA RGGG S2KR 5U7U 76TC VY86";

function job(partial: {
  claimId: string;
  recipientAddress: string;
  tileKey: string;
  amountLuna?: bigint;
  status?: string;
  createdAt?: number;
}) {
  return {
    claimId: partial.claimId,
    recipientAddress: partial.recipientAddress,
    amountLuna: partial.amountLuna ?? 100_000n,
    createdAt: partial.createdAt ?? 1_700_000_000_000,
    status: partial.status ?? "pending",
    tileKey: partial.tileKey,
  };
}

test("public pending listings omit mining-held jobs", () => {
  stopMiningBanGateForTests();
  setMiningBannedWalletsForTests([bannedWallet]);

  const jobs = [
    job({ claimId: "held", recipientAddress: bannedWallet, tileKey: "1,2,0" }),
    job({
      claimId: "maze",
      recipientAddress: bannedWallet,
      tileKey: "maze-first-place",
      amountLuna: 200_000n,
      createdAt: 1_700_000_000_100,
    }),
    job({
      claimId: "other",
      recipientAddress: otherWallet,
      tileKey: "3,4,0",
      amountLuna: 50_000n,
      createdAt: 1_700_000_000_200,
    }),
  ];

  const summary = getPublicPendingPayoutSummary(jobs);
  assert.equal(summary.pendingTotal, 2);
  assert.equal(summary.allSent, false);

  const globalSnap = getPublicPendingPayoutSnapshot(jobs);
  assert.equal(globalSnap.pendingTotal, 2);
  assert.deepEqual(
    globalSnap.rows.map((r) => r.walletId),
    [bannedWallet, otherWallet]
  );
  assert.deepEqual(
    globalSnap.rows.map((r) => r.amountNim),
    ["2.0000", "0.5000"]
  );

  const walletSnap = getPendingPayoutSnapshotForWallet(jobs, bannedWallet);
  assert.equal(walletSnap.pendingTotal, 1);
  assert.equal(walletSnap.rows.length, 1);
  assert.equal(walletSnap.rows[0]?.amountNim, "2.0000");

  stopMiningBanGateForTests();
});

test("admin panel snapshot splits payable vs mining-held by recipient", () => {
  stopMiningBanGateForTests();
  setMiningBannedWalletsForTests([bannedWallet]);

  const jobs = [
    job({ claimId: "held-a", recipientAddress: bannedWallet, tileKey: "1,2,0" }),
    job({
      claimId: "held-b",
      recipientAddress: bannedWallet,
      tileKey: "2,3,0",
      amountLuna: 150_000n,
    }),
    job({
      claimId: "maze",
      recipientAddress: bannedWallet,
      tileKey: "maze-first-place",
      amountLuna: 200_000n,
    }),
    job({
      claimId: "other",
      recipientAddress: otherWallet,
      tileKey: "0,1,0",
      amountLuna: 50_000n,
    }),
  ];

  const snap = getPublicPendingPayoutAdminPanelSnapshot(jobs);
  assert.equal(snap.pendingTotal, 2);
  assert.equal(snap.miningHeldPendingTotal, 2);
  assert.equal(snap.allSent, false);
  assert.equal(snap.pendingByRecipient?.length, 2);
  assert.equal(snap.pendingByRecipientMiningHeld?.length, 1);

  const payableBanned = snap.pendingByRecipient?.find(
    (r) => r.walletId === bannedWallet
  );
  assert.ok(payableBanned);
  assert.equal(payableBanned.jobCount, 1);
  assert.equal(payableBanned.amountNim, "2.0000");

  const heldBanned = snap.pendingByRecipientMiningHeld?.[0];
  assert.ok(heldBanned);
  assert.equal(heldBanned.walletId, bannedWallet);
  assert.equal(heldBanned.jobCount, 2);
  assert.equal(heldBanned.amountNim, "2.5000");

  stopMiningBanGateForTests();
});

test("admin panel reports allSent when only mining-held jobs remain", () => {
  stopMiningBanGateForTests();
  setMiningBannedWalletsForTests([bannedWallet]);

  const jobs = [
    job({ claimId: "held", recipientAddress: bannedWallet, tileKey: "1,2,0" }),
  ];
  const snap = getPublicPendingPayoutAdminPanelSnapshot(jobs);
  assert.equal(snap.allSent, true);
  assert.equal(snap.pendingTotal, 0);
  assert.equal(snap.miningHeldPendingTotal, 1);
  assert.match(String(snap.message || ""), /Mining Restriction/);
  assert.equal(snap.pendingByRecipient?.length, 0);
  assert.equal(snap.pendingByRecipientMiningHeld?.length, 1);

  const summary = getPublicPendingPayoutSummary(jobs);
  assert.equal(summary.pendingTotal, 0);
  assert.equal(summary.allSent, true);

  stopMiningBanGateForTests();
});
