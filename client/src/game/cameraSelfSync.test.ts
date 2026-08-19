import { describe, expect, it } from "vitest";
import {
  shouldHardSnapSelfMeshOnSync,
  shouldSnapCameraOnSelfSync,
} from "./cameraSelfSync.js";

describe("shouldSnapCameraOnSelfSync", () => {
  it("snaps when establishing self target after room entry (setSelf cleared target)", () => {
    expect(
      shouldSnapCameraOnSelfSync({
        establishingSelfTarget: true,
        hasSelfMoveOrder: false,
        cameraFollowReady: false,
        jumped: false,
      })
    ).toBe(true);
  });

  it("snaps on room entry even if a prior-room selfMoveOrder is still active", () => {
    expect(
      shouldSnapCameraOnSelfSync({
        establishingSelfTarget: true,
        hasSelfMoveOrder: true,
        cameraFollowReady: false,
        jumped: false,
      })
    ).toBe(true);
  });

  it("snaps when follow is not ready and not under move-order playback", () => {
    expect(
      shouldSnapCameraOnSelfSync({
        establishingSelfTarget: false,
        hasSelfMoveOrder: false,
        cameraFollowReady: false,
        jumped: false,
      })
    ).toBe(true);
  });

  it("snaps on a large pose jump even when follow was already ready", () => {
    expect(
      shouldSnapCameraOnSelfSync({
        establishingSelfTarget: false,
        hasSelfMoveOrder: false,
        cameraFollowReady: true,
        jumped: true,
      })
    ).toBe(true);
  });

  it("does not snap on ordinary soft-follow ticks", () => {
    expect(
      shouldSnapCameraOnSelfSync({
        establishingSelfTarget: false,
        hasSelfMoveOrder: false,
        cameraFollowReady: true,
        jumped: false,
      })
    ).toBe(false);
  });

  it("does not snap (and drop Path Playback) when follow is not ready but a walk is active", () => {
    expect(
      shouldSnapCameraOnSelfSync({
        establishingSelfTarget: false,
        hasSelfMoveOrder: true,
        cameraFollowReady: false,
        jumped: false,
      })
    ).toBe(false);
  });
});

describe("shouldHardSnapSelfMeshOnSync", () => {
  it("hard-snaps on room welcome even when Hub-to-dest displacement is under 6 tiles", () => {
    const jumped = Math.hypot(0 - -5, 0 - 0) > 6;
    expect(jumped).toBe(false);
    expect(
      shouldHardSnapSelfMeshOnSync({
        establishingSelfTarget: false,
        jumped,
        pendingRoomWelcomeSnap: true,
      })
    ).toBe(true);
  });

  it("hard-snaps when establishing self target after setSelf", () => {
    expect(
      shouldHardSnapSelfMeshOnSync({
        establishingSelfTarget: true,
        jumped: false,
        pendingRoomWelcomeSnap: false,
      })
    ).toBe(true);
  });

  it("hard-snaps on a large pose jump", () => {
    expect(
      shouldHardSnapSelfMeshOnSync({
        establishingSelfTarget: false,
        jumped: true,
        pendingRoomWelcomeSnap: false,
      })
    ).toBe(true);
  });

  it("does not hard-snap ordinary in-room follow ticks", () => {
    expect(
      shouldHardSnapSelfMeshOnSync({
        establishingSelfTarget: false,
        jumped: false,
        pendingRoomWelcomeSnap: false,
      })
    ).toBe(false);
  });
});
