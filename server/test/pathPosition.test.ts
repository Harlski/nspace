import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_PATH_MOVE_SPEED,
  DEFAULT_PATH_TICK_MS,
  PATH_ARRIVE_EPS,
  poseAlongPathAtTime,
  stepHumanAlongPath,
  type PathMoveBounds,
  type PathMovePose,
  type PathWaypoint,
} from "../src/pathPosition.js";

const FLAT_Y = (): number => 0;

const OPEN_BOUNDS: PathMoveBounds = {
  minX: -1000,
  maxX: 1000,
  minZ: -1000,
  maxZ: 1000,
};

function stepLoopMs(args: {
  startPose: PathMovePose;
  pathQueue: PathWaypoint[];
  startAtMs: number;
  nowMs: number;
  speed?: number;
  tickMs?: number;
}): ReturnType<typeof poseAlongPathAtTime> {
  const tickMs = args.tickMs ?? DEFAULT_PATH_TICK_MS;
  const speed = args.speed ?? DEFAULT_PATH_MOVE_SPEED;
  const pose: PathMovePose = { ...args.startPose };
  const pathQueue = args.pathQueue.map((w) => ({ ...w }));
  const arrivedTiles: Array<{ x: number; z: number }> = [];
  let t = args.startAtMs;
  while (t < args.nowMs) {
    const dtMs = Math.min(tickMs, args.nowMs - t);
    const result = stepHumanAlongPath({
      pose,
      pathQueue,
      dt: dtMs / 1000,
      speed,
      bounds: OPEN_BOUNDS,
      waypointY: FLAT_Y,
    });
    arrivedTiles.push(...result.arrivedTiles);
    t += dtMs;
  }
  return { pose, pathQueue, arrivedTiles };
}

test("poseAlongPathAtTime walks a straight segment at MOVE_SPEED", () => {
  const startPose: PathMovePose = { x: 0, y: 0, z: 0, vx: 0, vz: 0 };
  const pathQueue: PathWaypoint[] = [{ x: 5, z: 0, layer: 0 }];
  const startAtMs = 1_000_000;
  const nowMs = startAtMs + 1100;

  const result = poseAlongPathAtTime({
    startPose,
    pathQueue,
    startAtMs,
    nowMs,
    bounds: OPEN_BOUNDS,
    waypointY: FLAT_Y,
  });

  assert.ok(result.pathQueue.length === 0, "should reach destination in 1s at speed 5");
  assert.ok(Math.abs(result.pose.x - 5) <= PATH_ARRIVE_EPS);
  assert.equal(result.pose.z, 0);
  assert.equal(result.pose.vx, 0);
  assert.equal(result.pose.vz, 0);
});

test("poseAlongPathAtTime matches stepped loop on a straight segment", () => {
  const startPose: PathMovePose = { x: 0, y: 0, z: 0, vx: 0, vz: 0 };
  const pathQueue: PathWaypoint[] = [{ x: 5, z: 0, layer: 0 }];
  const startAtMs = 500_000;
  const nowMs = startAtMs + 1100;

  const analytic = poseAlongPathAtTime({
    startPose,
    pathQueue: pathQueue.map((w) => ({ ...w })),
    startAtMs,
    nowMs,
    bounds: OPEN_BOUNDS,
    waypointY: FLAT_Y,
  });
  const stepped = stepLoopMs({ startPose, pathQueue: pathQueue.map((w) => ({ ...w })), startAtMs, nowMs });

  assert.deepEqual(analytic.arrivedTiles, stepped.arrivedTiles);
  assert.ok(Math.abs(analytic.pose.x - stepped.pose.x) <= PATH_ARRIVE_EPS);
  assert.equal(analytic.pathQueue.length, stepped.pathQueue.length);
});

test("poseAlongPathAtTime matches stepped loop on a corner path", () => {
  const startPose: PathMovePose = { x: 0, y: 0, z: 0, vx: 0, vz: 0 };
  const pathQueue: PathWaypoint[] = [
    { x: 3, z: 0, layer: 0 },
    { x: 3, z: 4, layer: 0 },
  ];
  const startAtMs = 2_000_000;
  const nowMs = startAtMs + 2500;

  const analytic = poseAlongPathAtTime({
    startPose,
    pathQueue: pathQueue.map((w) => ({ ...w })),
    startAtMs,
    nowMs,
    bounds: OPEN_BOUNDS,
    waypointY: FLAT_Y,
  });
  const stepped = stepLoopMs({
    startPose,
    pathQueue: pathQueue.map((w) => ({ ...w })),
    startAtMs,
    nowMs,
  });

  assert.ok(
    Math.abs(analytic.pose.x - stepped.pose.x) <= PATH_ARRIVE_EPS,
    `x: ${analytic.pose.x} vs ${stepped.pose.x}`
  );
  assert.ok(
    Math.abs(analytic.pose.z - stepped.pose.z) <= PATH_ARRIVE_EPS,
    `z: ${analytic.pose.z} vs ${stepped.pose.z}`
  );
  assert.equal(analytic.pathQueue.length, stepped.pathQueue.length);
  assert.deepEqual(analytic.arrivedTiles, stepped.arrivedTiles);
});

test("poseAlongPathAtTime records tile crossings on multi-tile walks", () => {
  const startPose: PathMovePose = { x: 0.5, y: 0, z: 0.5, vx: 0, vz: 0 };
  const pathQueue: PathWaypoint[] = [{ x: 4.5, z: 0.5, layer: 0 }];
  const startAtMs = 0;
  const nowMs = 2000;

  const analytic = poseAlongPathAtTime({
    startPose,
    pathQueue: pathQueue.map((w) => ({ ...w })),
    startAtMs,
    nowMs,
    bounds: OPEN_BOUNDS,
    waypointY: FLAT_Y,
  });
  const stepped = stepLoopMs({
    startPose,
    pathQueue: pathQueue.map((w) => ({ ...w })),
    startAtMs,
    nowMs,
  });

  assert.deepEqual(analytic.arrivedTiles, stepped.arrivedTiles);
  assert.ok(analytic.arrivedTiles.length >= 2, "should cross at least two tiles along a 4-unit walk");
});
