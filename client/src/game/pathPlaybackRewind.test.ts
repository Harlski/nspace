/**
 * Feedback loop for live "avatars teleport back along their path".
 *
 * Mirrors Game.ts observer Path Playback:
 * - `refreshRemoteMoveOrderTarget` poses from `startAtMs` vs `Date.now()`
 * - when the path drains, the order is dropped
 * - `syncState` then owns `targetPos` from the next snapshot
 *
 * Desired: visual pose never jumps backward along an in-flight walk.
 * Observer step uses Path Playback hold-last + never-rewind snapshot rules.
 */
import assert from "node:assert/strict";
import { describe, expect, it } from "vitest";
import {
  moveOrderPlaybackFinished,
  playbackNowMs,
  poseIsBehindAlongPath,
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
const SPEED = 5;
const PATH_END = 15;

type XZ = { x: number; z: number };

type Observer = {
  order: MoveOrderWire | null;
  target: XZ;
  hold: PlaybackHold | null;
};

function straightOrder(startAtMs: number, walkId = 1): MoveOrderWire {
  return {
    address: "NQ97 TEST",
    path: [{ x: PATH_END, z: 0, layer: 0 }],
    startX: 0,
    startZ: 0,
    startAtMs,
    speed: SPEED,
    walkId,
  };
}

function poseArgs(order: MoveOrderWire, nowMs: number) {
  return {
    order,
    startY: 0,
    nowMs,
    bounds: OPEN_BOUNDS,
    placed: EMPTY_PLACED,
  };
}

function applyObserverMoveOrder(
  obs: Observer,
  order: MoveOrderWire,
  nowMs: number
): void {
  const clock = playbackNowMs({ localNowMs: nowMs });
  const { pose } = remotePoseFromMoveOrder(poseArgs(order, clock));
  if (
    !shouldAdoptReplacementMoveOrder({
      last: obs.hold,
      candidatePose: { x: pose.x, z: pose.z },
      order,
    })
  ) {
    return;
  }
  if (
    obs.hold &&
    (obs.hold.startX !== order.startX ||
      obs.hold.startZ !== order.startZ ||
      obs.hold.path.length !== order.path.length)
  ) {
    obs.hold = null;
  }
  obs.order = order;
}

/** Same order of operations as `refreshRemoteMoveOrderTarget` then `syncState`. */
function stepObserver(
  obs: Observer,
  nowMs: number,
  snapshot?: XZ
): XZ {
  const clock = playbackNowMs({ localNowMs: nowMs });
  if (obs.order) {
    const { pose, pathRemaining } = remotePoseFromMoveOrder(
      poseArgs(obs.order, clock)
    );
    const candidate = { x: pose.x, z: pose.z };
    if (
      !shouldAdvancePlaybackSample({
        last: obs.hold,
        candidatePose: candidate,
        order: obs.order,
      })
    ) {
      return obs.target;
    }
    obs.target = candidate;
    obs.hold = {
      pose: candidate,
      path: obs.order.path,
      startX: obs.order.startX,
      startZ: obs.order.startZ,
      walkId: obs.order.walkId,
    };
    if (
      moveOrderPlaybackFinished({
        pathRemaining,
        pose: candidate,
        path: obs.order.path,
      })
    ) {
      obs.order = null;
    }
  }
  if (!obs.order && snapshot) {
    const behind = obs.hold
      ? poseIsBehindAlongPath(obs.hold.pose, snapshot, obs.hold.path)
      : false;
    if (
      shouldAdoptSnapshotPose({
        playbackActive: false,
        behind,
        intentionalSnap: false,
      })
    ) {
      obs.target = snapshot;
    }
  }
  return obs.target;
}

describe("observer Path Playback rewind (production teleport-back)", () => {
  it("walks monotonically when client clock matches startAtMs", () => {
    const startAtMs = 1_000_000;
    const obs: Observer = { order: straightOrder(startAtMs), target: { x: 0, z: 0 }, hold: null };
    const xs: number[] = [];
    for (let t = 0; t <= 2000; t += 50) {
      xs.push(stepObserver(obs, startAtMs + t).x);
    }
    for (let i = 1; i < xs.length; i++) {
      assert.ok(xs[i]! + 1e-6 >= xs[i - 1]!, `rewind at sample ${i}: ${xs[i - 1]} → ${xs[i]}`);
    }
    assert.ok(xs[xs.length - 1]! > 9);
  });

  it("solo: after playback finishes, cut-stream (no snapshot) keeps the avatar at the destination", () => {
    const startAtMs = 1_000_000;
    const obs: Observer = { order: straightOrder(startAtMs), target: { x: 0, z: 0 }, hold: null };
    const arrived = stepObserver(obs, startAtMs + 3100);
    expect(arrived.x).toBeGreaterThan(14);
    expect(obs.order).toBeNull();

    const still = stepObserver(obs, startAtMs + 3600);
    assert.ok(
      still.x > 14,
      `solo cut-stream should leave visual x at destination, got ${still.x}`
    );
  });

  it("occupied: on-time drain + lagged conn.player + presence snapshot keeps destination", () => {
    const startAtMs = 1_000_000;
    const obs: Observer = { order: straightOrder(startAtMs), target: { x: 0, z: 0 }, hold: null };
    const arrived = stepObserver(obs, startAtMs + 3100);
    expect(arrived.x).toBeGreaterThan(14);
    expect(obs.order).toBeNull();

    // Tick has not copied analytic pose yet; a presence delta (or stale lastPlayers pose)
    // must not own visual pose after drain.
    const afterSnapshot = stepObserver(obs, startAtMs + 3150, { x: 0, z: 0 });
    assert.ok(
      afterSnapshot.x > 14,
      `stale full state after drain snapped visual x from ${arrived.x.toFixed(2)} back to ${afterSnapshot.x}`
    );
  });

  it("does not snap back to path start after clock-ahead playback drain + stale snapshot", () => {
    const startAtMs = 1_000_000;
    const obs: Observer = { order: straightOrder(startAtMs), target: { x: 0, z: 0 }, hold: null };

    const mid = stepObserver(obs, startAtMs + 1000);
    expect(mid.x).toBeGreaterThan(4);

    const drained = stepObserver(obs, startAtMs + 4000);
    expect(drained.x).toBeGreaterThan(14);
    expect(obs.order).toBeNull();

    const afterSnapshot = stepObserver(obs, startAtMs + 4050, { x: 0, z: 0 });
    assert.ok(
      afterSnapshot.x > 14,
      `stale snapshot after drain snapped visual x from ${drained.x.toFixed(2)} back to ${afterSnapshot.x}`
    );
  });

  it("does not snap back when a replacement moveOrder reuses the original start with a fresh startAtMs", () => {
    const startAtMs = 2_000_000;
    const obs: Observer = { order: straightOrder(startAtMs), target: { x: 0, z: 0 }, hold: null };
    const mid = stepObserver(obs, startAtMs + 1000);
    expect(mid.x).toBeGreaterThan(4);

    // Server re-issues the walk from conn.player (still at start if ticks lagged).
    applyObserverMoveOrder(obs, straightOrder(startAtMs + 1000, 1), startAtMs + 1000);
    const afterReissue = stepObserver(obs, startAtMs + 1000);
    assert.ok(
      afterReissue.x + 0.05 >= mid.x,
      `replacement moveOrder rewound visual x from ${mid.x.toFixed(2)} to ${afterReissue.x}`
    );
  });

  it("does not hold at path start when client nowMs is behind startAtMs", () => {
    const startAtMs = 3_000_000;
    const obs: Observer = { order: straightOrder(startAtMs), target: { x: 0, z: 0 }, hold: null };
    const mid = stepObserver(obs, startAtMs + 800);
    expect(mid.x).toBeGreaterThan(3);

    const behind = stepObserver(obs, startAtMs - 200);
    assert.ok(
      behind.x > 3,
      `clock-behind sample rewound visual x from ${mid.x.toFixed(2)} to ${behind.x}`
    );
  });
});
