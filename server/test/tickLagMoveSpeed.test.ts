/**
 * Feedback loop for live "characters crawl at ~1.5 blocks/s" reports.
 *
 * rooms.ts ticks with fixed `dt = TICK_MS/1000` inside `setInterval(..., TICK_MS)`.
 * When the event loop is busy, callbacks fire late but still apply only one slice of
 * sim time → wall-clock move speed collapses. Analytic path (MOVE_ORDER / pathMove)
 * uses wall `nowMs` and stays at DEFAULT_PATH_MOVE_SPEED.
 *
 * Symptom match: continuous ~160ms tick spacing → ~1.56 u/s (user: "1 1/2 blocks a second").
 * 3s local / 6s live for the same distance → ~2× wall time (≈100ms spacing).
 */
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

const PATH_LEN = 15; // ideal wall time at speed 5 = 3.0s

function straightPath(len: number): PathWaypoint[] {
  return [{ x: len, z: 0, layer: 0 }];
}

/** rooms.ts stepped path: one fixed TICK_MS of dt per callback, whatever the wall gap. */
function wallMsSteppedFixedDt(args: {
  wallGapMs: number;
  tickMs?: number;
  speed?: number;
}): number {
  const tickMs = args.tickMs ?? DEFAULT_PATH_TICK_MS;
  const speed = args.speed ?? DEFAULT_PATH_MOVE_SPEED;
  const pose: PathMovePose = { x: 0, y: 0, z: 0, vx: 0, vz: 0 };
  const pathQueue = straightPath(PATH_LEN);
  let wallMs = 0;
  const hardCap = 60_000;
  while (pathQueue.length > 0 && wallMs < hardCap) {
    stepHumanAlongPath({
      pose,
      pathQueue,
      dt: tickMs / 1000,
      speed,
      bounds: OPEN_BOUNDS,
      waypointY: FLAT_Y,
    });
    wallMs += args.wallGapMs;
  }
  assert.ok(pathQueue.length === 0, "stepped sim should finish within hardCap");
  assert.ok(Math.abs(pose.x - PATH_LEN) <= PATH_ARRIVE_EPS);
  return wallMs;
}

/** Analytic / moveOrder path: pose from wall clock regardless of how rarely we sample. */
function wallMsAnalyticSparse(args: {
  wallGapMs: number;
  speed?: number;
}): number {
  const speed = args.speed ?? DEFAULT_PATH_MOVE_SPEED;
  const startAtMs = 1_000_000;
  let nowMs = startAtMs;
  const hardCap = 60_000;
  while (nowMs - startAtMs < hardCap) {
    const result = poseAlongPathAtTime({
      startPose: { x: 0, y: 0, z: 0, vx: 0, vz: 0 },
      pathQueue: straightPath(PATH_LEN),
      startAtMs,
      nowMs,
      bounds: OPEN_BOUNDS,
      waypointY: FLAT_Y,
      speed,
    });
    if (result.pathQueue.length === 0) {
      return nowMs - startAtMs;
    }
    nowMs += args.wallGapMs;
  }
  assert.fail("analytic sim should finish within hardCap");
}

test("fixed-dt ticks at 160ms wall gaps crawl at ~1.5 u/s (live Commons symptom)", () => {
  const wallMs = wallMsSteppedFixedDt({ wallGapMs: 160 });
  const effectiveSpeed = PATH_LEN / (wallMs / 1000);
  // 5 * (50/160) = 1.5625
  assert.ok(
    effectiveSpeed > 1.4 && effectiveSpeed < 1.7,
    `expected ~1.56 u/s under 160ms gaps, got ${effectiveSpeed.toFixed(3)} u/s over ${wallMs}ms`
  );
  assert.ok(
    wallMs >= 5500,
    `15u at crawl should take ~6s wall time (got ${wallMs}ms)`
  );
});

test("fixed-dt ticks at 100ms wall gaps take ~2× ideal time (3s → 6s report)", () => {
  const idealMs = (PATH_LEN / DEFAULT_PATH_MOVE_SPEED) * 1000;
  const wallMs = wallMsSteppedFixedDt({ wallGapMs: 100 });
  assert.equal(idealMs, 3000);
  assert.ok(
    wallMs >= idealMs * 1.9 && wallMs <= idealMs * 2.1,
    `expected ~2× ideal wall time, got ${wallMs}ms vs ideal ${idealMs}ms`
  );
});

test("analytic path stays at MOVE_SPEED under the same 160ms sparse samples", () => {
  const wallMs = wallMsAnalyticSparse({ wallGapMs: 160 });
  const effectiveSpeed = PATH_LEN / (wallMs / 1000);
  assert.ok(
    effectiveSpeed > 4.5 && effectiveSpeed < 5.5,
    `analytic should stay ~5 u/s, got ${effectiveSpeed.toFixed(3)} u/s over ${wallMs}ms`
  );
  assert.ok(
    wallMs <= 3200,
    `15u analytic should finish near 3s even when sampled sparsely (got ${wallMs}ms)`
  );
});
