import assert from "node:assert/strict";
import test from "node:test";
import {
  isMiningPayoutHeldForBannedWallet,
  setMiningRestrictionListUnconfirmedForTests,
  setMiningBannedWalletsForTests,
  stopMiningBanGateForTests,
} from "../src/miningBanGate.js";

const wallet = "NQ97 4M1T 4TGD VC7F LHLQ Y2DY 425N 5CVH M02Y";

test("unconfirmed restriction list holds block-claim payouts (fail closed)", () => {
  stopMiningBanGateForTests();
  setMiningRestrictionListUnconfirmedForTests();
  try {
    assert.equal(isMiningPayoutHeldForBannedWallet(wallet, "1,2,0"), true);
    assert.equal(
      isMiningPayoutHeldForBannedWallet(wallet, "maze-first-place"),
      false
    );
  } finally {
    stopMiningBanGateForTests();
  }
});

test("confirmed empty restriction list does not hold mining payouts", () => {
  stopMiningBanGateForTests();
  setMiningBannedWalletsForTests([]);
  try {
    assert.equal(isMiningPayoutHeldForBannedWallet(wallet, "1,2,0"), false);
  } finally {
    stopMiningBanGateForTests();
  }
});
