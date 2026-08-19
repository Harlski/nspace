/**
 * Feedback loop for the local player's camera hitch: "I teleport back and forth".
 *
 * Camera look-at is bound to `selfMesh` (`updateCameraFollow`). Any self pose rewind
 * is a camera jump. This harness mirrors Game.ts self Path Playback:
 * `refreshSelfMoveOrderTarget` → `applyPoseHeartbeat` → optional late `applyMoveOrder`.
 *
 * Desired symptom: after the local walk has visually arrived, the pose the camera
 * follows must not jump backward along that path.
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
  walkIdIncreased,
  type MoveOrderWire,
  type PlaybackHold,
  type PoseHeartbeatPlayerWire,
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

type SelfView = {
  order: (MoveOrderWire & { startY: number; recvLocalMs: number }) | null;
  target: XZ;
  mesh: XZ;
  hold: PlaybackHold | null;
  playbackServerNowMs?: number;
  playbackRecvLocalMs?: number;
};

function straightOrder(startAtMs: number, walkId = 1): MoveOrderWire {
  return {
    address: "self",
    path: [{ x: PATH_END, z: 0, layer: 0 }],
    startX: 0,
    startZ: 0,
    startAtMs,
    speed: SPEED,
    walkId,
    serverNowMs: startAtMs,
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

function clockNow(self: SelfView, localNowMs: number): number {
  return playbackNowMs({
    localNowMs,
    serverNowMs: self.playbackServerNowMs,
    recvLocalMs: self.playbackRecvLocalMs,
  });
}

function noteServerNow(self: SelfView, serverNowMs: number | undefined, recvLocalMs: number): void {
  if (serverNowMs == null || !Number.isFinite(serverNowMs)) return;
  self.playbackServerNowMs = serverNowMs;
  self.playbackRecvLocalMs = recvLocalMs;
}

function playbackActive(self: SelfView): boolean {
  return self.order != null;
}

/** Same order of operations as `refreshSelfMoveOrderTarget`. */
function refreshSelf(self: SelfView, localNowMs: number): void {
  const order = self.order;
  if (!order) return;
  const nowMs = clockNow(self, localNowMs);
  const { pose, pathRemaining } = remotePoseFromMoveOrder(poseArgs(order, nowMs));
  const candidate = { x: pose.x, z: pose.z };
  if (
    !shouldAdvancePlaybackSample({
      last: self.hold,
      candidatePose: candidate,
      order,
    })
  ) {
    return;
  }
  if (
    moveOrderPlaybackFinished({
      pathRemaining,
      pose: candidate,
      path: order.path,
    })
  ) {
    self.order = null;
  }
  self.target = candidate;
  self.mesh = candidate;
  self.hold = {
    pose: candidate,
    path: order.path,
    startX: order.startX,
    startZ: order.startZ,
    walkId: order.walkId,
  };
}

/** Same rules as Game.ts `applyPoseHeartbeat` for the local player. */
function applySelfHeartbeat(
  self: SelfView,
  p: PoseHeartbeatPlayerWire,
  recvLocalMs: number
): void {
  noteServerNow(self, p.serverNowMs, recvLocalMs);
  const last = self.hold;
  const behind = last
    ? poseIsBehindAlongPath(last.pose, { x: p.x, z: p.z }, last.path)
    : false;
  const walkIdChanged = walkIdIncreased(last?.walkId, p.walkId);
  const implicitAbort = p.walking === false || walkIdChanged;
  if (
    !shouldAdoptSnapshotPose({
      playbackActive: playbackActive(self),
      behind,
      intentionalSnap: implicitAbort,
      walkIdChanged,
      walkingFlag: p.walking,
    })
  ) {
    return;
  }
  if (implicitAbort) {
    self.order = null;
    self.hold = null;
  }
  self.target = { x: p.x, z: p.z };
  self.mesh = { x: p.x, z: p.z };
  if (!implicitAbort && last) {
    self.hold = {
      pose: { x: p.x, z: p.z },
      path: last.path,
      startX: last.startX,
      startZ: last.startZ,
      walkId: p.walkId,
    };
  }
}

/** Same rules as Game.ts `applyMoveOrder` for the local player. */
function applySelfMoveOrder(
  self: SelfView,
  msg: MoveOrderWire,
  recvLocalMs: number
): void {
  noteServerNow(self, msg.serverNowMs, recvLocalMs);
  const nowMs = clockNow(self, recvLocalMs);
  const { pose } = remotePoseFromMoveOrder(poseArgs(msg, nowMs));
  if (
    !shouldAdoptReplacementMoveOrder({
      last: self.hold,
      candidatePose: { x: pose.x, z: pose.z },
      order: msg,
    })
  ) {
    return;
  }
  self.order = { ...msg, startY: 0, recvLocalMs, path: msg.path.map((w) => ({ ...w })) };
  refreshSelf(self, recvLocalMs);
}

describe("local camera pose must not rewind after Path Playback drain", () => {
  it("walks to the destination without going backward", () => {
    const startAtMs = 1_000_000;
    const self: SelfView = {
      order: { ...straightOrder(startAtMs), startY: 0, recvLocalMs: startAtMs },
      target: { x: 0, z: 0 },
      mesh: { x: 0, z: 0 },
      hold: null,
      playbackServerNowMs: startAtMs,
      playbackRecvLocalMs: startAtMs,
    };
    const xs: number[] = [];
    for (let t = 0; t <= 3200; t += 50) {
      refreshSelf(self, startAtMs + t);
      xs.push(self.mesh.x);
    }
    for (let i = 1; i < xs.length; i++) {
      assert.ok(xs[i]! + 1e-6 >= xs[i - 1]!, `rewind at ${i}: ${xs[i - 1]} → ${xs[i]}`);
    }
    expect(self.mesh.x).toBeGreaterThan(14);
    expect(self.order).toBeNull();
  });

  it("after-drain heartbeat walking=false that is behind last playback does not pull the camera back", () => {
    const startAtMs = 1_000_000;
    const self: SelfView = {
      order: { ...straightOrder(startAtMs), startY: 0, recvLocalMs: startAtMs },
      target: { x: 0, z: 0 },
      mesh: { x: 0, z: 0 },
      hold: null,
      playbackServerNowMs: startAtMs,
      playbackRecvLocalMs: startAtMs,
    };
    refreshSelf(self, startAtMs + 3100);
    expect(self.mesh.x).toBeGreaterThan(14);
    expect(self.order).toBeNull();
    const arrived = self.mesh.x;

    // ~200ms lag: after-drain heartbeat still reports a pose short of the destination.
    applySelfHeartbeat(
      self,
      {
        address: "self",
        x: arrived - 1,
        y: 0,
        z: 0,
        vx: 0,
        vz: 0,
        walkId: 1,
        walking: false,
        serverNowMs: startAtMs + 3300,
      },
      startAtMs + 3500
    );

    assert.ok(
      self.mesh.x + 1e-6 >= arrived,
      `camera pose rewound from ${arrived.toFixed(2)} to ${self.mesh.x.toFixed(2)} on walking=false heartbeat`
    );
  });

  it("implicit abort that clears the hold, then a late duplicate of the same walk, does not restart from origin", () => {
    const startAtMs = 2_000_000;
    const order = straightOrder(startAtMs);
    const self: SelfView = {
      order: { ...order, startY: 0, recvLocalMs: startAtMs },
      target: { x: 0, z: 0 },
      mesh: { x: 0, z: 0 },
      hold: null,
      playbackServerNowMs: startAtMs,
      playbackRecvLocalMs: startAtMs,
    };
    refreshSelf(self, startAtMs + 3100);
    const arrived = self.mesh.x;
    expect(arrived).toBeGreaterThan(14);

    applySelfHeartbeat(
      self,
      {
        address: "self",
        x: arrived - 0.8,
        y: 0,
        z: 0,
        vx: 0,
        vz: 0,
        walkId: 1,
        walking: false,
        serverNowMs: startAtMs + 3200,
      },
      startAtMs + 3400
    );

    applySelfMoveOrder(self, { ...order, serverNowMs: startAtMs + 50 }, startAtMs + 3450);
    refreshSelf(self, startAtMs + 3450);

    assert.ok(
      self.mesh.x + 1e-6 >= arrived - 0.05,
      `late duplicate after implicit abort moved camera from dest ${arrived.toFixed(2)} to ${self.mesh.x.toFixed(2)}`
    );
  });
});
