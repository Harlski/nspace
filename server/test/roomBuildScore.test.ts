import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MIN_BUILDS_FOR_PUBLIC,
  canEnablePublicVisibility,
  publicBuildGateMessage,
  sumRoomBuildScore,
} from "../src/roomBuildScore.js";

describe("roomBuildScore", () => {
  it("sums all build parts", () => {
    assert.equal(
      sumRoomBuildScore({
        obstacles: 10,
        signboards: 5,
        billboards: 2,
        voxelTexts: 3,
        extraFloor: 20,
        baseFloorColor: 10,
      }),
      50
    );
  });

  it("requires 50 builds for non-exempt public rooms", () => {
    assert.equal(canEnablePublicVisibility(49, false), false);
    assert.equal(canEnablePublicVisibility(50, false), true);
    assert.equal(canEnablePublicVisibility(0, true), true);
  });

  it("formats gate message with progress", () => {
    assert.equal(
      publicBuildGateMessage(38),
      `Public rooms require ${MIN_BUILDS_FOR_PUBLIC} builds (38/50).`
    );
  });
});
