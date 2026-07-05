import assert from "node:assert/strict";
import test from "node:test";
import { snapToTile, isOrthogonallyAdjacentToTile } from "../src/grid.js";
import {
  DEFAULT_PATH_MOVE_SPEED,
  DEFAULT_PATH_TICK_MS,
  stepHumanAlongPath,
  type PathMoveBounds,
  type PathMovePose,
  type PathWaypoint,
} from "../src/pathPosition.js";
import {
  gameplayPoseFromConn,
  snapshotPathMoveBegin,
  tickAnalyticPathHuman,
  type ConnPathMoveState,
} from "../src/playerPathPose.js";
import { canKick } from "../src/worldcup/ballPhysics.js";
import { BALL_KICK, BALL_PHYSICS } from "../src/worldcup/config.js";

const FLAT_Y = (): number => 0;

const OPEN_BOUNDS: PathMoveBounds = {
  minX: -1000,
  maxX: 1000,
  minZ: -1000,
  maxZ: 1000,
};

function stepPlayerLoop(args: {
  startPose: PathMovePose;
  pathQueue: PathWaypoint[];
  startAtMs: number;
  nowMs: number;
}): { pose: PathMovePose; pathQueue: PathWaypoint[]; arrivedTiles: Array<{ x: number; z: number }> } {
  const pose: PathMovePose = { ...args.startPose };
  const pathQueue = args.pathQueue.map((w) => ({ ...w }));
  const arrivedTiles: Array<{ x: number; z: number }> = [];
  let t = args.startAtMs;
  while (t < args.nowMs) {
    const dtMs = Math.min(DEFAULT_PATH_TICK_MS, args.nowMs - t);
    const result = stepHumanAlongPath({
      pose,
      pathQueue,
      dt: dtMs / 1000,
      speed: DEFAULT_PATH_MOVE_SPEED,
      bounds: OPEN_BOUNDS,
      waypointY: FLAT_Y,
    });
    arrivedTiles.push(...result.arrivedTiles);
    t += dtMs;
  }
  return { pose, pathQueue, arrivedTiles };
}

function simulateWalk(args: {
  startPose: PathMovePose;
  pathQueue: PathWaypoint[];
  startAtMs: number;
  durationMs: number;
  mode: "stepped" | "analytic";
}): {
  pose: PathMovePose;
  pathQueue: PathWaypoint[];
  arrivedTiles: Array<{ x: number; z: number }>;
} {
  if (args.mode === "stepped") {
    return stepPlayerLoop({
      startPose: args.startPose,
      pathQueue: args.pathQueue,
      startAtMs: args.startAtMs,
      nowMs: args.startAtMs + args.durationMs,
    });
  }
  const pathMove = snapshotPathMoveBegin({
    player: args.startPose,
    pathQueue: args.pathQueue,
    startAtMs: args.startAtMs,
  })!;
  const player: PathMovePose = { ...args.startPose };
  const pathQueue = args.pathQueue.map((w) => ({ ...w }));
  const endMs = args.startAtMs + args.durationMs;
  let lastArrived: Array<{ x: number; z: number }> = [];
  for (let t = args.startAtMs + DEFAULT_PATH_TICK_MS; t <= endMs; t += DEFAULT_PATH_TICK_MS) {
    const tick = tickAnalyticPathHuman({
      player,
      pathQueue,
      pathMove,
      nowMs: t,
      bounds: OPEN_BOUNDS,
      waypointY: FLAT_Y,
    });
    lastArrived = tick.arrivedTiles;
  }
  return { pose: player, pathQueue, arrivedTiles: lastArrived };
}

test("gameplayPoseFromConn matches stepped pose during an active walk", () => {
  const startPose: PathMovePose = { x: 0.5, y: 0, z: 0.5, vx: 0, vz: 0 };
  const pathQueue: PathWaypoint[] = [{ x: 4.5, z: 0.5, layer: 0 }];
  const startAtMs = 1_000_000;
  const nowMs = startAtMs + 750;
  const pathMove = snapshotPathMoveBegin({ player: startPose, pathQueue, startAtMs })!;

  const stepped = stepPlayerLoop({ startPose, pathQueue: pathQueue.map((w) => ({ ...w })), startAtMs, nowMs });
  const analytic = gameplayPoseFromConn({
    player: startPose,
    pathQueue,
    pathMove,
    nowMs,
    bounds: OPEN_BOUNDS,
    waypointY: FLAT_Y,
  });

  assert.ok(Math.abs(analytic.x - stepped.pose.x) <= 0.04);
  assert.ok(Math.abs(analytic.z - stepped.pose.z) <= 0.04);
});

test("analytic vs stepped: ball kick reach agrees while walking toward the ball", () => {
  const ballX = 3;
  const ballZ = 0.5;
  const startPose: PathMovePose = { x: 0.5, y: 0, z: 0.5, vx: 0, vz: 0 };
  const pathQueue: PathWaypoint[] = [{ x: 4.5, z: 0.5, layer: 0 }];
  const startAtMs = 2_000_000;
  const reach = BALL_KICK.reach;
  const radius = BALL_PHYSICS.radius;

  for (let offset = 0; offset <= 1200; offset += DEFAULT_PATH_TICK_MS) {
    const nowMs = startAtMs + offset;
    const stepped = stepPlayerLoop({
      startPose,
      pathQueue: pathQueue.map((w) => ({ ...w })),
      startAtMs,
      nowMs,
    });
    const pathMove = snapshotPathMoveBegin({
      player: startPose,
      pathQueue: pathQueue.map((w) => ({ ...w })),
      startAtMs,
    })!;
    const analytic = gameplayPoseFromConn({
      player: startPose,
      pathQueue: pathQueue.map((w) => ({ ...w })),
      pathMove,
      nowMs,
      bounds: OPEN_BOUNDS,
      waypointY: FLAT_Y,
    });
    const steppedKick = canKick(stepped.pose.x, stepped.pose.z, ballX, ballZ, radius, reach);
    const analyticKick = canKick(analytic.x, analytic.z, ballX, ballZ, radius, reach);
    assert.equal(
      analyticKick,
      steppedKick,
      `kick parity mismatch at t+${offset}ms stepped=(${stepped.pose.x},${stepped.pose.z}) analytic=(${analytic.x},${analytic.z})`
    );
  }
});

test("analytic vs stepped: gate front tile detection matches mid-walk", () => {
  const gateFront = { x: 2, z: 1 };
  const startPose: PathMovePose = { x: 0.5, y: 0, z: 0.5, vx: 0, vz: 0 };
  const pathQueue: PathWaypoint[] = [
    { x: 2.5, z: 0.5, layer: 0 },
    { x: 2.5, z: 1.5, layer: 0 },
  ];
  const startAtMs = 3_000_000;

  for (let offset = DEFAULT_PATH_TICK_MS; offset <= 2500; offset += DEFAULT_PATH_TICK_MS) {
    const nowMs = startAtMs + offset;
    const stepped = stepPlayerLoop({
      startPose,
      pathQueue: pathQueue.map((w) => ({ ...w })),
      startAtMs,
      nowMs,
    });
    const pathMove = snapshotPathMoveBegin({
      player: startPose,
      pathQueue: pathQueue.map((w) => ({ ...w })),
      startAtMs,
    })!;
    const analytic = gameplayPoseFromConn({
      player: startPose,
      pathQueue: pathQueue.map((w) => ({ ...w })),
      pathMove,
      nowMs,
      bounds: OPEN_BOUNDS,
      waypointY: FLAT_Y,
    });
    const steppedOnFront = snapToTile(stepped.pose.x, stepped.pose.z);
    const analyticOnFront = snapToTile(analytic.x, analytic.z);
    assert.equal(analyticOnFront.x, steppedOnFront.x, `x at t+${offset}ms`);
    assert.equal(analyticOnFront.z, steppedOnFront.z, `z at t+${offset}ms`);
    assert.equal(
      steppedOnFront.x === gateFront.x && steppedOnFront.z === gateFront.z,
      analyticOnFront.x === gateFront.x && analyticOnFront.z === gateFront.z,
      `gate front tile parity at t+${offset}ms`
    );
  }
});

test("analytic vs stepped: distinct tile crossings match on a multi-tile walk", () => {
  const startPose: PathMovePose = { x: 0.5, y: 0, z: 0.5, vx: 0, vz: 0 };
  const pathQueue: PathWaypoint[] = [{ x: 4.5, z: 0.5, layer: 0 }];
  const startAtMs = 4_000_000;
  const durationMs = 2000;

  const stepped = simulateWalk({ startPose, pathQueue, startAtMs, durationMs, mode: "stepped" });
  const analytic = simulateWalk({ startPose, pathQueue, startAtMs, durationMs, mode: "analytic" });

  assert.deepEqual(analytic.arrivedTiles, stepped.arrivedTiles);
});

test("analytic vs stepped: block-claim adjacency matches while walking past a claim tile", () => {
  const claimTile = { x: 2, z: 0 };
  const startPose: PathMovePose = { x: 0.5, y: 0, z: 0.5, vx: 0, vz: 0 };
  const pathQueue: PathWaypoint[] = [{ x: 4.5, z: 0.5, layer: 0 }];
  const startAtMs = 5_000_000;

  for (let offset = 0; offset <= 1200; offset += DEFAULT_PATH_TICK_MS) {
    const nowMs = startAtMs + offset;
    const stepped = stepPlayerLoop({
      startPose,
      pathQueue: pathQueue.map((w) => ({ ...w })),
      startAtMs,
      nowMs,
    });
    const pathMove = snapshotPathMoveBegin({
      player: startPose,
      pathQueue: pathQueue.map((w) => ({ ...w })),
      startAtMs,
    })!;
    const analytic = gameplayPoseFromConn({
      player: startPose,
      pathQueue: pathQueue.map((w) => ({ ...w })),
      pathMove,
      nowMs,
      bounds: OPEN_BOUNDS,
      waypointY: FLAT_Y,
    });
    assert.equal(
      isOrthogonallyAdjacentToTile(analytic.x, analytic.z, claimTile.x, claimTile.z),
      isOrthogonallyAdjacentToTile(stepped.pose.x, stepped.pose.z, claimTile.x, claimTile.z),
      `adjacency parity at t+${offset}ms`
    );
  }
});
