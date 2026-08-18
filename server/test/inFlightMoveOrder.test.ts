import assert from "node:assert/strict";
import test from "node:test";
import { buildInFlightMoveOrder, nextWalkId } from "../src/inFlightMoveOrder.js";
import { overlayGameplayPose, snapshotPathMoveBegin } from "../src/playerPathPose.js";
import {
  DEFAULT_PATH_MOVE_SPEED,
  poseAlongPathAtTime,
  type PathMoveBounds,
} from "../src/pathPosition.js";

const OPEN_BOUNDS: PathMoveBounds = {
  minX: -1000,
  maxX: 1000,
  minZ: -1000,
  maxZ: 1000,
};
const FLAT_Y = (): number => 0;

test("nextWalkId is monotonic from 0", () => {
  assert.equal(nextWalkId(undefined), 1);
  assert.equal(nextWalkId(0), 1);
  assert.equal(nextWalkId(4), 5);
});

test("welcome in-flight order plays mid-path from original startAtMs + serverNowMs", () => {
  const player = { x: 0, y: 0, z: 0, vx: 0, vz: 0 };
  const pathQueue = [{ x: 15, z: 0, layer: 0 as const }];
  const startAtMs = 1_000_000;
  const pathMove = snapshotPathMoveBegin({ player, pathQueue, startAtMs });
  assert.ok(pathMove);

  const serverNowMs = startAtMs + 1000;
  const msg = buildInFlightMoveOrder({
    address: "NQ97 TEST",
    pathMove,
    pathQueueLength: 1,
    walkId: 3,
    serverNowMs,
  });
  assert.ok(msg);
  assert.equal(msg.startX, 0);
  assert.equal(msg.startAtMs, startAtMs);
  assert.equal(msg.serverNowMs, serverNowMs);
  assert.equal(msg.walkId, 3);

  const observer = poseAlongPathAtTime({
    startPose: { x: msg.startX, y: 0, z: msg.startZ, vx: 0, vz: 0 },
    pathQueue: msg.path,
    startAtMs: msg.startAtMs,
    nowMs: msg.serverNowMs,
    bounds: OPEN_BOUNDS,
    waypointY: FLAT_Y,
    speed: msg.speed,
  });
  assert.ok(
    observer.pose.x > 4 && observer.pose.x < 6,
    `late joiner should start mid-path ~5, got ${observer.pose.x}`
  );
  assert.equal(msg.speed, DEFAULT_PATH_MOVE_SPEED);
});

test("buildInFlightMoveOrder is null when the path has drained", () => {
  const player = { x: 0, y: 0, z: 0, vx: 0, vz: 0 };
  const pathMove = snapshotPathMoveBegin({
    player,
    pathQueue: [{ x: 2, z: 0, layer: 0 }],
    startAtMs: 1,
  });
  assert.equal(
    buildInFlightMoveOrder({
      address: "NQ97 TEST",
      pathMove,
      pathQueueLength: 0,
      walkId: 1,
      serverNowMs: 2,
    }),
    null
  );
});

test("overlayGameplayPose copies analytic fields without mutating the tick cache", () => {
  const player = { x: 0, y: 0, z: 0, vx: 0, vz: 0, displayName: "A" };
  const out = overlayGameplayPose(player, {
    x: 5.1,
    y: 0.5,
    z: 2,
    vx: 5,
    vz: 0,
  });
  assert.equal(player.x, 0);
  assert.equal(out.x, 5.1);
  assert.equal(out.y, 0.5);
  assert.equal(out.z, 2);
  assert.equal(out.vx, 5);
  assert.equal(out.displayName, "A");
});
