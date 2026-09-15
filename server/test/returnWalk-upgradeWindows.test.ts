import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "return-walk-win-"));
process.env.RETURN_WALK_STORE_FILE = path.join(tmp, "return-walk.sqlite");
process.env.RETURN_WALK_SERVER_WALLET_ADDRESS =
  "NQ11 22AA 33BB 44CC 55DD 66EE 77FF 00AA 11BB";
process.env.RESIDENT_ADDRESSES =
  "NQ97 4M1T 4TGD VC7F LHLQ Y2DY 425N 5CVH M02Y";

const {
  cancelPendingUpgradeWindows,
  pendingUpgradeWindowCountForTests,
  setUpgradeWindowSchedulerForTests,
  startUpgradeWindow,
} = await import("../src/returnWalk/upgradeWindows.js");
const { registerReturnWalkWorld } = await import("../src/returnWalk/world.js");
const {
  createUnpaidInvoice,
  creditInvoice,
  remainingReturnBudgetLuna,
  __resetReturnWalkStoreForTests,
} = await import("../src/returnWalk/store.js");
const { RETURN_WALK_DEPOSIT_LUNA, UPGRADES_PER_WINDOW, RETURN_GOLD_LUNA } =
  await import("../src/returnWalk/constants.js");
const { getServerWalletAddress } = await import("../src/returnWalk/config.js");

const RESIDENT = "NQ97 4M1T 4TGD VC7F LHLQ Y2DY 425N 5CVH M02Y";

describe("returnWalk upgrade windows", { concurrency: false }, () => {
test("Upgrade Window fires vicinity Upgrades and reserves 1 NIM each", () => {
  __resetReturnWalkStoreForTests();
  const created = createUnpaidInvoice({
    residentWallet: RESIDENT,
    toAddress: getServerWalletAddress()!,
  });
  assert.ok("invoiceId" in created);
  creditInvoice({ invoiceId: created.invoiceId, txHash: "tx-win" });

  const converted: Array<{ x: number; z: number }> = [];
  const eligible = [
    { x: 1, z: 0 },
    { x: -1, z: 0 },
    { x: 4, z: 5 },
    { x: -6, z: 3 },
    { x: 7, z: -2 },
    { x: 2, z: 8 },
    { x: -3, z: -7 },
    { x: 8, z: 1 },
    { x: 0, z: 6 },
    { x: 5, z: -5 },
  ];
  registerReturnWalkWorld({
    listPublicRooms: () => [],
    getResidentPose: () => ({ roomId: "hub", x: 0, z: 0 }),
    listEligibleUpgradeTiles: () => eligible,
    convertTileToReturnGold: (_room, x, z) => {
      converted.push({ x, z });
      return true;
    },
  });

  const queued: Array<() => void> = [];
  setUpgradeWindowSchedulerForTests({
    now: () => 1,
    setTimeout: (fn) => {
      queued.push(fn);
      return queued.length as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimeout: () => undefined,
    random: () => 0,
  });
  startUpgradeWindow();
  assert.equal(queued.length, UPGRADES_PER_WINDOW);
  for (const fn of queued) fn();
  assert.equal(converted.length, UPGRADES_PER_WINDOW);
  assert.equal(
    remainingReturnBudgetLuna(),
    RETURN_WALK_DEPOSIT_LUNA - RETURN_GOLD_LUNA * BigInt(UPGRADES_PER_WINDOW)
  );
  cancelPendingUpgradeWindows();
  setUpgradeWindowSchedulerForTests(null);
});

test("cancelPendingUpgradeWindows drops unfired Upgrades", () => {
  const queued: Array<() => void> = [];
  setUpgradeWindowSchedulerForTests({
    now: () => 1,
    setTimeout: (fn) => {
      queued.push(fn);
      return queued.length as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimeout: () => {
      queued.length = 0;
    },
    random: () => 0,
  });
  startUpgradeWindow();
  assert.equal(pendingUpgradeWindowCountForTests(), UPGRADES_PER_WINDOW);
  cancelPendingUpgradeWindows();
  assert.equal(pendingUpgradeWindowCountForTests(), 0);
  setUpgradeWindowSchedulerForTests(null);
});
});
