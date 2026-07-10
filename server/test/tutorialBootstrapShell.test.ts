import assert from "node:assert/strict";
import test from "node:test";

import {
  TUTORIAL_DEFAULT_BOUNDS,
  buildDefaultTutorialBootstrapShell,
} from "../src/tutorialTemplate/bootstrapShell.js";

function parseTile(tile: string): { x: number; z: number; y: number } {
  const [xs, zs, ys] = tile.split(",");
  return { x: Number(xs), z: Number(zs), y: Number(ys) };
}

test("Tutorial Path bounds are portrait 7 wide by 15 deep", () => {
  const b = TUTORIAL_DEFAULT_BOUNDS;
  assert.equal(b.maxX - b.minX + 1, 7);
  assert.equal(b.maxZ - b.minZ + 1, 15);
  assert.deepEqual(b, { minX: -3, maxX: 3, minZ: -7, maxZ: 7 });
});

test("Tutorial Path join spawn sits in the south band on a clear tile", () => {
  const shell = buildDefaultTutorialBootstrapShell();
  assert.ok(shell.joinSpawn);
  const { x, z } = shell.joinSpawn;
  assert.equal(x, 0);
  assert.equal(z, -6);
  const blocked = shell.obstacles.some((o) => {
    const t = parseTile(o.tile);
    return t.x === x && t.z === z && t.y === 0 && !o.props.passable;
  });
  assert.equal(blocked, false);
});

test("Tutorial Path places three mine slots south of the pay gate", () => {
  const shell = buildDefaultTutorialBootstrapShell();
  const mines = shell.obstacles.filter((o) => o.props.tutorialMineSlot === true);
  assert.equal(mines.length, 3);
  const gate = shell.obstacles.find((o) => o.props.gate);
  assert.ok(gate);
  const gateZ = parseTile(gate.tile).z;
  for (const m of mines) {
    assert.ok(m.props.claimable === true);
    assert.ok(m.props.pyramid === true);
    assert.ok(parseTile(m.tile).z < gateZ);
  }
});

test("Tutorial Path gate exit lands north of the pay gate", () => {
  const shell = buildDefaultTutorialBootstrapShell();
  const gate = shell.obstacles.find((o) => o.props.gate);
  assert.ok(gate?.props.gate);
  const gateTile = parseTile(gate.tile);
  const { exitX, exitZ } = gate.props.gate;
  assert.ok(exitZ > gateTile.z);
  assert.equal(exitX, gateTile.x);
  const blocked = shell.obstacles.some((o) => {
    const t = parseTile(o.tile);
    return t.x === exitX && t.z === exitZ && t.y === 0 && !o.props.passable;
  });
  assert.equal(blocked, false);
});

test("Tutorial Path obstacles stay inside portrait bounds", () => {
  const shell = buildDefaultTutorialBootstrapShell();
  const b = shell.bounds;
  for (const o of shell.obstacles) {
    const t = parseTile(o.tile);
    assert.ok(t.x >= b.minX && t.x <= b.maxX, o.tile);
    assert.ok(t.z >= b.minZ && t.z <= b.maxZ, o.tile);
  }
});

test("Tutorial Path paints a center floor strip from spawn toward exit", () => {
  const shell = buildDefaultTutorialBootstrapShell();
  assert.ok(shell.extraFloor.length > 0);
  assert.ok(shell.joinSpawn);
  const spawnTint = shell.extraFloor.some(
    (t) => t.x === shell.joinSpawn!.x && t.z === shell.joinSpawn!.z
  );
  assert.ok(spawnTint);
  const gate = shell.obstacles.find((o) => o.props.gate);
  assert.ok(gate?.props.gate);
  const exitTint = shell.extraFloor.some(
    (t) => t.x === gate.props.gate!.exitX && t.z === gate.props.gate!.exitZ
  );
  assert.ok(exitTint);
});

test("Tutorial Path leaves side lanes past the mine band so learners can walk north", () => {
  const shell = buildDefaultTutorialBootstrapShell();
  const mineZ = Math.min(
    ...shell.obstacles
      .filter((o) => o.props.tutorialMineSlot)
      .map((o) => parseTile(o.tile).z)
  );
  for (const x of [-2, 2] as const) {
    const blocked = shell.obstacles.some((o) => {
      const t = parseTile(o.tile);
      return t.x === x && t.z === mineZ && t.y === 0 && !o.props.passable;
    });
    assert.equal(blocked, false, `lane ${x},${mineZ} should be clear`);
  }
});

test("Tutorial Path pay gate sits at mid depth with exit immediately north", () => {
  const shell = buildDefaultTutorialBootstrapShell();
  const gate = shell.obstacles.find((o) => o.props.gate);
  assert.ok(gate?.props.gate);
  const midZ = Math.floor((shell.bounds.minZ + shell.bounds.maxZ) / 2);
  assert.equal(parseTile(gate.tile).z, midZ);
  assert.equal(gate.props.gate.exitZ, midZ + 1);
});
