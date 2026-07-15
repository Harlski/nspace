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

test("Tutorial Path places three mine slots south of the Unlock Pad", () => {
  const shell = buildDefaultTutorialBootstrapShell();
  const mines = shell.obstacles.filter((o) => o.props.tutorialMineSlot === true);
  assert.equal(mines.length, 3);
  const pad = shell.obstacles.find((o) => o.props.unlockPad);
  assert.ok(pad);
  const padZ = parseTile(pad.tile).z;
  for (const m of mines) {
    assert.ok(m.props.claimable === true);
    assert.ok(m.props.pyramid === true);
    assert.ok(parseTile(m.tile).z < padZ);
  }
});

test("Tutorial Path Unlock Pad sits at mid depth with Exit Teleporter one step north to Hub", () => {
  const shell = buildDefaultTutorialBootstrapShell();
  const pad = shell.obstacles.find((o) => o.props.unlockPad);
  assert.ok(pad?.props.unlockPad);
  assert.equal(pad.props.unlockPad.proofMode, "optimistic");
  const midZ = Math.floor((shell.bounds.minZ + shell.bounds.maxZ) / 2);
  const padTile = parseTile(pad.tile);
  assert.equal(padTile.z, midZ);
  const exit = shell.obstacles.find((o) => {
    const t = parseTile(o.tile);
    return (
      t.x === padTile.x &&
      t.z === padTile.z + 1 &&
      t.y === 0 &&
      o.props.teleporter &&
      !("pending" in o.props.teleporter)
    );
  });
  assert.ok(exit, "Exit Teleporter must sit one tile north of the Unlock Pad");
  assert.equal(exit.props.passable, true);
  const tp = exit.props.teleporter;
  assert.ok(tp && !("pending" in tp));
  assert.equal(tp.targetRoomId, "chamber");
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
  const pad = shell.obstacles.find((o) => o.props.unlockPad);
  assert.ok(pad);
  const padTile = parseTile(pad.tile);
  const exitTint = shell.extraFloor.some(
    (t) => t.x === padTile.x && t.z === padTile.z + 1
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

test("Tutorial Path Alcove Garden seeds grass base floor and side pines", () => {
  const shell = buildDefaultTutorialBootstrapShell();
  const b = shell.bounds;
  const expectedTiles = (b.maxX - b.minX + 1) * (b.maxZ - b.minZ + 1);
  assert.equal(shell.baseFloorColors.length, expectedTiles);
  assert.ok(shell.baseFloorColors.every((t) => t.colorRgb === 0x2f6b3a));

  const pines = shell.obstacles.filter(
    (o) => o.props.pyramid === true && o.props.tutorialMineSlot !== true
  );
  // Six pines × two canopy pyramids (trunks are cubes).
  assert.equal(pines.length, 12);
  for (const p of pines) {
    const t = parseTile(p.tile);
    assert.ok(t.x === -2 || t.x === 2, p.tile);
    assert.notEqual(t.z, -5, "pine must not sit on mine row side lane");
  }
});
