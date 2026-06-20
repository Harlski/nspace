import assert from "node:assert/strict";
import test from "node:test";

import {
  goalieLineX,
  goalieZRange,
  initGoalieState,
  stepGoalie,
  type GoalieTuning,
} from "../src/worldcup/goalie.js";
import { FIELD_GOALS } from "../src/worldcup/config.js";

const WEST = FIELD_GOALS.find((g) => g.id === "west")!;
const EAST = FIELD_GOALS.find((g) => g.id === "east")!;
const CFG: GoalieTuning = { moveSpeed: 4, radius: 0.5, reactionMs: 0 };
const DT = 50; // ms

test("goalieLineX patrols the pitch-facing edge of each mouth", () => {
  assert.equal(goalieLineX(WEST), WEST.maxX);
  assert.equal(goalieLineX(EAST), EAST.minX);
});

test("the keeper tracks the ball laterally toward its z", () => {
  let g = initGoalieState(WEST); // starts at z=0
  assert.equal(g.z, 0);
  for (let i = 0; i < 40; i++) g = stepGoalie(g, 1.5, DT, WEST, CFG);
  assert.ok(Math.abs(g.z - 1.5) < 1e-6, "keeper converges on the ball's z");
});

test("the keeper stays bounded by the goal-line limits", () => {
  const { zMin, zMax } = goalieZRange(WEST, CFG.radius);
  let g = initGoalieState(WEST);
  // Ball far beyond the mouth: keeper clamps to the upper limit, never past it.
  for (let i = 0; i < 200; i++) {
    g = stepGoalie(g, 99, DT, WEST, CFG);
    assert.ok(g.z <= zMax + 1e-9 && g.z >= zMin - 1e-9);
  }
  assert.ok(Math.abs(g.z - zMax) < 1e-6, "keeper rests at the upper goal limit");
});

test("the keeper never moves more than moveSpeed*dt in one step", () => {
  let g = initGoalieState(WEST);
  const maxStep = CFG.moveSpeed * (DT / 1000);
  for (let i = 0; i < 50; i++) {
    const next = stepGoalie(g, 99, DT, WEST, CFG);
    assert.ok(Math.abs(next.z - g.z) <= maxStep + 1e-9);
    g = next;
  }
});

test("reaction lag delays the keeper's response to a sudden ball jump", () => {
  const start = initGoalieState(WEST); // z=0
  const snappy = stepGoalie(start, 2, DT, WEST, { ...CFG, reactionMs: 0 });
  const laggy = stepGoalie(start, 2, DT, WEST, { ...CFG, reactionMs: 1000 });
  assert.ok(
    laggy.z < snappy.z,
    "a larger reaction time constant moves the keeper less on the first step"
  );
});

test("coverage defaults to the full radius-inset mouth (backward compatible)", () => {
  const full = goalieZRange(WEST, CFG.radius);
  const explicit = goalieZRange(WEST, CFG.radius, 1);
  assert.ok(Math.abs(full.zMin - explicit.zMin) < 1e-9);
  assert.ok(Math.abs(full.zMax - explicit.zMax) < 1e-9);
});

test("a coverage fraction < 1 narrows the patrol symmetrically, opening corner gaps", () => {
  const full = goalieZRange(WEST, CFG.radius, 1);
  const narrow = goalieZRange(WEST, CFG.radius, 0.6);
  const mid = (WEST.minZ + WEST.maxZ) / 2;
  // Symmetric around the mouth centre.
  assert.ok(Math.abs(narrow.zMin + narrow.zMax - 2 * mid) < 1e-9);
  // Strictly inside the full range: corners are now unreachable.
  assert.ok(narrow.zMin > full.zMin + 1e-9);
  assert.ok(narrow.zMax < full.zMax - 1e-9);
});

test("stepGoalie honours coverage: the keeper cannot reach the posts when narrowed", () => {
  const coverage = 0.6;
  const { zMax } = goalieZRange(WEST, CFG.radius, coverage);
  let g = initGoalieState(WEST);
  for (let i = 0; i < 200; i++) {
    g = stepGoalie(g, 99, DT, WEST, { ...CFG, coverage });
    assert.ok(g.z <= zMax + 1e-9);
  }
  assert.ok(
    Math.abs(g.z - zMax) < 1e-6,
    "keeper rests at the narrowed limit, short of the post"
  );
});
