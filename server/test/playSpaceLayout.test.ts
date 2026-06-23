import assert from "node:assert/strict";
import test from "node:test";

import {
  PLAY_SPACE_BLOCKS,
  PLAY_SPACE_BOUNDS,
  PLAY_SPACE_FLOOR_TINTS,
  PLAY_SPACE_SPAWN,
} from "../src/directInvite/playSpaceLayout.js";

test("Play Space blocks stay inside lounge bounds", () => {
  for (const b of PLAY_SPACE_BLOCKS) {
    assert.ok(b.x >= PLAY_SPACE_BOUNDS.minX && b.x <= PLAY_SPACE_BOUNDS.maxX);
    assert.ok(b.z >= PLAY_SPACE_BOUNDS.minZ && b.z <= PLAY_SPACE_BOUNDS.maxZ);
  }
});

test("Play Space spawn sits on a passable tile in the template", () => {
  const blockers = PLAY_SPACE_BLOCKS.filter(
    (b) =>
      b.x === PLAY_SPACE_SPAWN.x &&
      b.z === PLAY_SPACE_SPAWN.z &&
      (b.y ?? 0) === 0 &&
      !b.passable
  );
  assert.equal(blockers.length, 0);
});

test("Play Space floor is fully painted", () => {
  const w = PLAY_SPACE_BOUNDS.maxX - PLAY_SPACE_BOUNDS.minX + 1;
  const h = PLAY_SPACE_BOUNDS.maxZ - PLAY_SPACE_BOUNDS.minZ + 1;
  assert.equal(PLAY_SPACE_FLOOR_TINTS.length, w * h);
});

test("Play Space uses a wild mix of block shapes", () => {
  const hasPyramid = PLAY_SPACE_BLOCKS.some((b) => b.pyramid);
  const hasSphere = PLAY_SPACE_BLOCKS.some((b) => b.sphere);
  const hasHex = PLAY_SPACE_BLOCKS.some((b) => b.hex);
  const hasRamp = PLAY_SPACE_BLOCKS.some((b) => b.ramp);
  assert.ok(hasPyramid && hasSphere && hasHex && hasRamp);
  assert.ok(PLAY_SPACE_BLOCKS.length >= 40);
});
