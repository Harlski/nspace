import assert from "node:assert/strict";
import test from "node:test";
import {
  clearCosmeticDeployStateForTests,
  validateCosmeticDeploy,
} from "../src/cosmeticDeploy.js";

test("deploy rejects when deployables disabled in room", () => {
  clearCosmeticDeployStateForTests();
  const result = validateCosmeticDeploy({
    wallet: "NQ07 TEST000000000000000000000000000001",
    roomId: "room1",
    cosmeticSku: "missing",
    playerX: 0,
    playerZ: 0,
    tileX: 1,
    tileZ: 0,
    deployablesAllowed: false,
    isWalkable: () => true,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "deployables_disabled");
});

test("deploy rejects non-walkable tile", () => {
  clearCosmeticDeployStateForTests();
  const result = validateCosmeticDeploy({
    wallet: "NQ07 TEST000000000000000000000000000001",
    roomId: "room1",
    cosmeticSku: "missing",
    playerX: 0,
    playerZ: 0,
    tileX: 1,
    tileZ: 0,
    deployablesAllowed: true,
    isWalkable: () => false,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "not_entitled");
});
