import assert from "node:assert/strict";
import { describe, expect, it } from "vitest";
import {
  moveOrderPlaybackActive,
  moveOrderPlaybackFinished,
  playbackNowMs,
  playbackSameWalk,
  remotePoseFromMoveOrder,
  shouldAdvancePlaybackSample,
  shouldAdoptReplacementMoveOrder,
  shouldAdoptSnapshotPose,
  type MoveOrderWire,
  type PlaybackHold,
} from "./moveOrderPlayback.js";

const OPEN_BOUNDS = {
  minX: -1000,
  maxX: 1000,
  minZ: -1000,
  maxZ: 1000,
};

const EMPTY_PLACED = new Map();

describe("remotePoseFromMoveOrder", () => {
  it("walks a straight segment from server-owned startAtMs", () => {
    const order: MoveOrderWire = {
      address: "NQ97 TEST",
      path: [{ x: 5, z: 0, layer: 0 }],
      startX: 0,
      startZ: 0,
      startAtMs: 1_000_000,
      speed: 5,
    };

    const mid = remotePoseFromMoveOrder({
      order,
      startY: 0,
      nowMs: order.startAtMs + 500,
      bounds: OPEN_BOUNDS,
      placed: EMPTY_PLACED,
    });
    assert.ok(mid.pose.x > 2 && mid.pose.x < 3);
    assert.equal(mid.pathRemaining, 1);

    const done = remotePoseFromMoveOrder({
      order,
      startY: 0,
      nowMs: order.startAtMs + 1100,
      bounds: OPEN_BOUNDS,
      placed: EMPTY_PLACED,
    });
    expect(done.pathRemaining).toBe(0);
    assert.ok(Math.abs(done.pose.x - 5) <= 0.05);
  });

  it("reports playback active until the path queue is drained", () => {
    expect(
      moveOrderPlaybackActive({
        pathRemaining: 1,
        pose: { x: 0, z: 0 },
        path: [{ x: 5, z: 0, layer: 0 }],
      })
    ).toBe(true);
    expect(
      moveOrderPlaybackFinished({
        pathRemaining: 0,
        pose: { x: 5, z: 0 },
        path: [{ x: 5, z: 0, layer: 0 }],
      })
    ).toBe(true);
  });

  it("keeps playback active after an intermediate waypoint when the queue drains early", () => {
    const path = [
      { x: 1, z: 0, layer: 0 },
      { x: 2, z: 0, layer: 0 },
    ];
    expect(
      moveOrderPlaybackActive({
        pathRemaining: 0,
        pose: { x: 1, z: 0 },
        path,
      })
    ).toBe(true);
    expect(
      moveOrderPlaybackFinished({
        pathRemaining: 0,
        pose: { x: 1, z: 0 },
        path,
      })
    ).toBe(false);
  });

  it("playbackNowMs offsets local time by serverNowMs - recvLocalMs", () => {
    expect(
      playbackNowMs({
        localNowMs: 2_000,
        serverNowMs: 10_000,
        recvLocalMs: 1_000,
      })
    ).toBe(11_000);
    expect(playbackNowMs({ localNowMs: 5_000 })).toBe(5_000);
  });

  it("walks a single straight-line pitch waypoint", () => {
    const order: MoveOrderWire = {
      address: "NQ97 TEST",
      path: [{ x: 8, z: 3, layer: 0 }],
      startX: 0,
      startZ: 0,
      startAtMs: 2_000_000,
      speed: 5,
    };
    const mid = remotePoseFromMoveOrder({
      order,
      startY: 0,
      nowMs: order.startAtMs + 800,
      bounds: OPEN_BOUNDS,
      placed: EMPTY_PLACED,
    });
    assert.ok(mid.pathRemaining === 1);
    assert.ok(Math.hypot(mid.pose.x, mid.pose.z) > 3);
  });
});

describe("shouldAdoptSnapshotPose", () => {
  it("holds last playback after drain when the snapshot is behind along the path", () => {
    expect(
      shouldAdoptSnapshotPose({
        playbackActive: false,
        behind: true,
        intentionalSnap: false,
      })
    ).toBe(false);
  });

  it("still snaps on an intentional jump", () => {
    expect(
      shouldAdoptSnapshotPose({
        playbackActive: false,
        behind: false,
        intentionalSnap: true,
      })
    ).toBe(true);
  });

  it("does not let snapshots own pose while Path Playback is active", () => {
    expect(
      shouldAdoptSnapshotPose({
        playbackActive: true,
        behind: false,
        intentionalSnap: false,
      })
    ).toBe(false);
  });

  it("treats walking=false as an implicit abort even when behind", () => {
    expect(
      shouldAdoptSnapshotPose({
        playbackActive: true,
        behind: true,
        intentionalSnap: false,
        walkingFlag: false,
      })
    ).toBe(true);
  });

  it("treats an increased walkId as forward catch-up", () => {
    expect(
      shouldAdoptSnapshotPose({
        playbackActive: true,
        behind: true,
        intentionalSnap: false,
        walkIdChanged: true,
      })
    ).toBe(true);
  });
});

describe("Path Playback walk identity", () => {
  const hold: PlaybackHold = {
    pose: { x: 10, z: 0 },
    path: [{ x: 15, z: 0, layer: 0 }],
    startX: 0,
    startZ: 0,
    walkId: 1,
  };
  const sameOrder: MoveOrderWire = {
    address: "NQ97 TEST",
    path: [{ x: 15, z: 0, layer: 0 }],
    startX: 0,
    startZ: 0,
    startAtMs: 1,
    speed: 5,
    walkId: 1,
  };
  const newOrder: MoveOrderWire = {
    address: "NQ97 TEST",
    path: [{ x: 0, z: 5, layer: 0 }],
    startX: 10,
    startZ: 0,
    startAtMs: 2,
    speed: 5,
    walkId: 2,
  };

  it("recognizes same walk vs a new redirect", () => {
    expect(playbackSameWalk(hold, sameOrder)).toBe(true);
    expect(playbackSameWalk(hold, newOrder)).toBe(false);
  });

  it("accepts a new walk even when the last hold is ahead on the old path", () => {
    expect(
      shouldAdoptReplacementMoveOrder({
        last: hold,
        candidatePose: { x: 10, z: 0 },
        order: newOrder,
      })
    ).toBe(true);
  });

  it("advances samples on a new walk using the new path geometry", () => {
    expect(
      shouldAdvancePlaybackSample({
        last: hold,
        candidatePose: { x: 10, z: 1 },
        order: newOrder,
      })
    ).toBe(true);
  });

  it("still rejects a stale reissue behind the hold on the same walk", () => {
    expect(
      shouldAdoptReplacementMoveOrder({
        last: hold,
        candidatePose: { x: 0, z: 0 },
        order: sameOrder,
      })
    ).toBe(false);
  });

  it("adopts a reverse click when walkId increases even if the pose is behind on the old path", () => {
    expect(
      shouldAdoptReplacementMoveOrder({
        last: hold,
        candidatePose: { x: 0, z: 0 },
        order: { ...newOrder, startX: 0, startZ: 0, walkId: 2 },
      })
    ).toBe(true);
  });
});

describe("multi-waypoint Path Playback", () => {
  const OPEN = {
    minX: -1000,
    maxX: 1000,
    minZ: -1000,
    maxZ: 1000,
  };
  const EMPTY = new Map();

  it("walks two straight tiles without stalling after the first waypoint", () => {
    const order: MoveOrderWire = {
      address: "NQ97 TEST",
      path: [
        { x: 1, z: 0, layer: 0 },
        { x: 2, z: 0, layer: 0 },
      ],
      startX: 0,
      startZ: 0,
      startAtMs: 1_000_000,
      speed: 5,
    };
    let hold: PlaybackHold | null = null;
    let target = { x: 0, z: 0 };
    const xs: number[] = [];
    for (let dt = 0; dt <= 500; dt += 25) {
      const { pose, pathRemaining } = remotePoseFromMoveOrder({
        order,
        startY: 0,
        nowMs: order.startAtMs + dt,
        bounds: OPEN,
        placed: EMPTY,
      });
      const candidate = { x: pose.x, z: pose.z };
      if (
        shouldAdvancePlaybackSample({
          last: hold,
          candidatePose: candidate,
          order,
        })
      ) {
        target = candidate;
        hold = {
          pose: candidate,
          path: order.path,
          startX: order.startX,
          startZ: order.startZ,
        };
      }
      xs.push(target.x);
    }
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i]! + 1e-6).toBeGreaterThanOrEqual(xs[i - 1]!);
    }
    expect(xs[xs.length - 1]!).toBeGreaterThan(1.9);
  });

  it("walks an L-shaped two-tile path without stalling at the corner", () => {
    const order: MoveOrderWire = {
      address: "NQ97 TEST",
      path: [
        { x: 0, z: 1, layer: 0 },
        { x: 1, z: 1, layer: 0 },
      ],
      startX: 0,
      startZ: 0,
      startAtMs: 2_000_000,
      speed: 5,
    };
    let hold: PlaybackHold | null = null;
    let target = { x: 0, z: 0 };
    const progress: number[] = [];
    for (let dt = 0; dt <= 500; dt += 25) {
      const { pose } = remotePoseFromMoveOrder({
        order,
        startY: 0,
        nowMs: order.startAtMs + dt,
        bounds: OPEN,
        placed: EMPTY,
      });
      const candidate = { x: pose.x, z: pose.z };
      if (
        shouldAdvancePlaybackSample({
          last: hold,
          candidatePose: candidate,
          order,
        })
      ) {
        target = candidate;
        hold = {
          pose: candidate,
          path: order.path,
          startX: order.startX,
          startZ: order.startZ,
        };
      }
      progress.push(target.x + target.z);
    }
    for (let i = 1; i < progress.length; i++) {
      expect(progress[i]! + 1e-6).toBeGreaterThanOrEqual(progress[i - 1]!);
    }
    expect(progress[progress.length - 1]!).toBeGreaterThan(1.9);
  });

  it("simulation does not drain the queue before the final waypoint on a two-tile walk", () => {
    const order: MoveOrderWire = {
      address: "NQ97 TEST",
      path: [
        { x: 1, z: 0, layer: 0 },
        { x: 2, z: 0, layer: 0 },
      ],
      startX: 0,
      startZ: 0,
      startAtMs: 1_000_000,
      speed: 5,
    };
    for (let dt = 0; dt < 450; dt += 1) {
      const { pose, pathRemaining } = remotePoseFromMoveOrder({
        order,
        startY: 0,
        nowMs: order.startAtMs + dt,
        bounds: OPEN,
        placed: EMPTY,
      });
      if (pathRemaining === 0) {
        expect(pose.x).toBeGreaterThan(1.9);
        return;
      }
    }
    expect.fail("walk never finished");
  });
});
