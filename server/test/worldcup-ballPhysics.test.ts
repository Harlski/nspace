import assert from "node:assert/strict";
import test from "node:test";
import {
  applyKick,
  canKick,
  clampSpeed,
  detectGoal,
  kickFromPlayer,
  stepBall,
  type BallPhysicsConfig,
} from "../src/worldcup/ballPhysics.js";
import { FIELD_BOUNDS, FIELD_GOALS, GOAL_DEPTH } from "../src/worldcup/config.js";
import { tickRoomBalls } from "../src/worldcup/ballTick.js";
import { clearRoomBalls, getBalls, spawnMatchBall } from "../src/worldcup/ballStore.js";

const CFG: BallPhysicsConfig = {
  radius: 0.45,
  maxSpeed: 12,
  decel: 7,
  minSpeed: 0.05,
  restitution: 0.6,
};

test("clampSpeed caps magnitude but keeps direction", () => {
  const { vx, vz } = clampSpeed(30, 0, 12);
  assert.equal(vx, 12);
  assert.equal(vz, 0);
  const keep = clampSpeed(3, 4, 12); // speed 5 < 12
  assert.equal(keep.vx, 3);
  assert.equal(keep.vz, 4);
});

test("stepBall slows the ball via friction and eventually stops", () => {
  let ball = { x: 0, z: 0, vx: 6, vz: 0 };
  let steps = 0;
  while (Math.hypot(ball.vx, ball.vz) > 0 && steps < 1000) {
    ball = stepBall(ball, 0.05, FIELD_BOUNDS, CFG);
    steps += 1;
  }
  assert.equal(ball.vx, 0);
  assert.equal(ball.vz, 0);
  assert.ok(steps < 1000, "ball should stop within a bounded number of steps");
  assert.ok(ball.x > 0, "ball should have travelled in +x before stopping");
});

test("stepBall reflects off the east wall and reverses x velocity", () => {
  // Start near the east wall moving outward fast.
  const startX = FIELD_BOUNDS.maxX + 0.5 - CFG.radius - 0.01;
  const ball = stepBall(
    { x: startX, z: 0, vx: 10, vz: 0 },
    0.05,
    FIELD_BOUNDS,
    CFG
  );
  assert.ok(ball.vx < 0, "x velocity should reverse after hitting the wall");
  assert.ok(
    ball.x + CFG.radius <= FIELD_BOUNDS.maxX + 0.5 + 1e-6,
    "ball stays inside the east wall"
  );
});

test("stepBall never exceeds max speed even with a huge initial velocity", () => {
  const ball = stepBall(
    { x: 0, z: 0, vx: 999, vz: 999 },
    0.05,
    FIELD_BOUNDS,
    CFG
  );
  assert.ok(Math.hypot(ball.vx, ball.vz) <= CFG.maxSpeed + 1e-6);
});

test("stepBall bounces off a solid tile predicate", () => {
  // A solid wall of tiles at x=3; ball moving +x from x=2.7 should reflect.
  const isSolid = (tx: number) => tx === 3;
  const ball = stepBall(
    { x: 2.7, z: 0, vx: 8, vz: 0 },
    0.05,
    FIELD_BOUNDS,
    CFG,
    isSolid
  );
  assert.ok(ball.vx < 0, "x velocity should reverse off the solid tile");
});

test("applyKick sets a normalized velocity at the requested speed", () => {
  const ball = applyKick({ x: 0, z: 0, vx: 0, vz: 0 }, 0, 5, 6, CFG);
  assert.ok(Math.abs(ball.vx) < 1e-9);
  assert.ok(Math.abs(ball.vz - 6) < 1e-9);
});

test("applyKick clamps to max speed", () => {
  const ball = applyKick({ x: 0, z: 0, vx: 0, vz: 0 }, 1, 0, 999, CFG);
  assert.ok(Math.abs(ball.vx - CFG.maxSpeed) < 1e-9);
});

test("canKick respects radius + reach", () => {
  assert.equal(canKick(0, 0, 0.8, 0, 0.45, 0.6), true); // dist 0.8 <= 1.05
  assert.equal(canKick(0, 0, 2, 0, 0.45, 0.6), false);
});

test("kickFromPlayer uses travel heading when moving", () => {
  const k = kickFromPlayer(
    { px: 0, pz: 0, vx: 5, vz: 0, bx: 0.5, bz: 0 },
    { reach: 0.6, baseSpeed: 5.5, playerSpeedScale: 1.6, cooldownMs: 220 },
    12
  );
  assert.ok(k.dirX > 0.99, "kicks along +x heading");
  assert.ok(Math.abs(k.dirZ) < 1e-9);
  assert.ok(k.speed > 5.5, "moving player adds speed over base");
  assert.ok(k.speed <= 12);
});

test("kickFromPlayer kicks away from a stationary player", () => {
  const k = kickFromPlayer(
    { px: 0, pz: 0, vx: 0, vz: 0, bx: 0, bz: 1 },
    { reach: 0.6, baseSpeed: 5.5, playerSpeedScale: 1.6, cooldownMs: 220 },
    12
  );
  assert.ok(k.dirZ > 0.99, "kicks away from player toward ball (+z)");
  assert.ok(Math.abs(k.speed - 5.5) < 1e-9, "base speed when player is still");
});

test("detectGoal only counts once the ball crosses the goal line", () => {
  // In front of the line (inside the band) is NOT a goal anymore.
  assert.equal(detectGoal({ x: -9.5, z: 0 }, FIELD_GOALS), null);
  assert.equal(detectGoal({ x: 9.5, z: 0 }, FIELD_GOALS), null);
  // Crossing the line (x <= -10.5 west, x >= 10.5 east) within the mouth scores.
  assert.equal(detectGoal({ x: -10.6, z: 0 }, FIELD_GOALS), "west");
  assert.equal(detectGoal({ x: 10.6, z: 0 }, FIELD_GOALS), "east");
  // On/at the line counts (whole-ball nuance handled by the wall opening).
  assert.equal(detectGoal({ x: -10.5, z: 1 }, FIELD_GOALS), "west");
  // Centre pitch and outside the z band never score.
  assert.equal(detectGoal({ x: 0, z: 0 }, FIELD_GOALS), null);
  assert.equal(detectGoal({ x: 10.6, z: 5 }, FIELD_GOALS), null);
});

test("ball passes through the goal mouth and crosses the line", () => {
  // Aimed straight at the west goal centre, fast.
  let ball = { x: -8, z: 0, vx: -10, vz: 0 };
  let scored = false;
  for (let i = 0; i < 60 && !scored; i++) {
    ball = stepBall(ball, 0.05, FIELD_BOUNDS, CFG, undefined, FIELD_GOALS, GOAL_DEPTH);
    if (detectGoal(ball, FIELD_GOALS) === "west") scored = true;
  }
  assert.ok(scored, "a ball shot into the mouth should cross the line");
  assert.ok(ball.x <= FIELD_BOUNDS.minX - 0.5, "ball is at/behind the goal line");
});

test("ball aimed wide of the mouth bounces off the end line (no goal)", () => {
  // z near the upper post, outside the radius-inset mouth: should reflect, never score.
  let ball = { x: -8, z: 2.4, vx: -10, vz: 0 };
  let scored = false;
  for (let i = 0; i < 60 && !scored; i++) {
    ball = stepBall(ball, 0.05, FIELD_BOUNDS, CFG, undefined, FIELD_GOALS, GOAL_DEPTH);
    if (detectGoal(ball, FIELD_GOALS)) scored = true;
  }
  assert.equal(scored, false, "a shot wide of the mouth must not score");
  assert.ok(
    ball.x + CFG.radius <= FIELD_BOUNDS.maxX + 0.5 + 1e-6 &&
      ball.x - CFG.radius >= FIELD_BOUNDS.minX - 0.5 - 1e-6,
    "ball stays within the pitch end lines when it misses the mouth"
  );
});

test("blocker-mode goalie repels a shot aimed straight at it", () => {
  // West goalie sits in front of the mouth centre; ball shot straight at it.
  const goalie = { x: -9, z: 0, radius: 0.5 };
  let ball = { x: -7, z: 0, vx: -10, vz: 0 };
  let scored = false;
  for (let i = 0; i < 60 && !scored; i++) {
    ball = stepBall(
      ball,
      0.05,
      FIELD_BOUNDS,
      CFG,
      undefined,
      FIELD_GOALS,
      GOAL_DEPTH,
      [goalie]
    );
    if (detectGoal(ball, FIELD_GOALS) === "west") scored = true;
  }
  assert.equal(scored, false, "a shot straight at the keeper must not score");
});

test("blocker-mode goalie lets a shot wide of it through to the net", () => {
  // Keeper at z=0; ball aimed low at the open part of the mouth (z ~ -1.4).
  const goalie = { x: -9, z: 0, radius: 0.5 };
  let ball = { x: -7, z: -1.4, vx: -10, vz: 0 };
  let scored = false;
  for (let i = 0; i < 60 && !scored; i++) {
    ball = stepBall(
      ball,
      0.05,
      FIELD_BOUNDS,
      CFG,
      undefined,
      FIELD_GOALS,
      GOAL_DEPTH,
      [goalie]
    );
    if (detectGoal(ball, FIELD_GOALS) === "west") scored = true;
  }
  assert.equal(scored, true, "a shot wide of the keeper should still score");
});

test("tickRoomBalls honours a short per-kicker reach (keeper can't reach far)", () => {
  // Ball at (0,0). A kicker 0.9 away is inside the default reach (radius 0.45 + 0.6 = 1.05)
  // but outside a short keeper reach (0.45 + 0.3 = 0.75), so it must NOT touch the ball.
  const room = "wc-match-reachtest";
  clearRoomBalls(room);
  spawnMatchBall(room);
  tickRoomBalls({
    roomId: room,
    bounds: FIELD_BOUNDS,
    players: [
      { x: 0.9, z: 0, vx: 0, vz: 0, address: "__worldcup_goalie__", kickReach: 0.3 },
    ],
    now: 10_000,
    dt: 0.05,
    broadcastBallState: () => {},
  });
  const ball = getBalls(room)[0]!;
  assert.equal(Math.hypot(ball.vx, ball.vz), 0, "short-reach keeper leaves the ball at rest");
  clearRoomBalls(room);
});

test("tickRoomBalls kicks when the player has the default reach", () => {
  const room = "wc-match-reachtest2";
  clearRoomBalls(room);
  spawnMatchBall(room);
  tickRoomBalls({
    roomId: room,
    bounds: FIELD_BOUNDS,
    players: [{ x: 0.9, z: 0, vx: 0, vz: 0, address: "p1" }],
    now: 10_000,
    dt: 0.05,
    broadcastBallState: () => {},
  });
  const ball = getBalls(room)[0]!;
  assert.ok(Math.hypot(ball.vx, ball.vz) > 0, "default-reach player kicks the ball");
  clearRoomBalls(room);
});

test("net box contains a ball that crosses the line (no runaway)", () => {
  // Simulate the cooldown case: keep stepping past a goal without resetting.
  let ball = { x: -10, z: 0, vx: -12, vz: 0 };
  for (let i = 0; i < 200; i++) {
    ball = stepBall(ball, 0.05, FIELD_BOUNDS, CFG, undefined, FIELD_GOALS, GOAL_DEPTH);
  }
  assert.ok(
    ball.x >= FIELD_BOUNDS.minX - 0.5 - GOAL_DEPTH - 1e-6,
    "ball never escapes past the net behind the goal line"
  );
});
