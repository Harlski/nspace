import assert from "node:assert/strict";
import test from "node:test";

import { isWalkableTile, tileKey } from "../src/grid.js";

const ROOM = "hub";

test("isWalkableTile rejects No-Walk Floor on a base tile that still has floor", () => {
  const extra = new Set<string>();
  const noWalk = new Set([tileKey(0, 0)]);
  assert.equal(isWalkableTile(0, 0, extra, ROOM, null, noWalk), false);
  assert.equal(isWalkableTile(1, 0, extra, ROOM, null, noWalk), true);
});

test("isWalkableTile rejects No-Walk Floor on an extra-floor tile", () => {
  const extra = new Set([tileKey(20, 20)]);
  const noWalk = new Set([tileKey(20, 20)]);
  assert.equal(isWalkableTile(20, 20, extra, ROOM, null, null), true);
  assert.equal(isWalkableTile(20, 20, extra, ROOM, null, noWalk), false);
});

test("isWalkableTile still treats removed base as unwalkable independent of No-Walk", () => {
  const extra = new Set<string>();
  const removed = new Set([tileKey(0, 0)]);
  assert.equal(isWalkableTile(0, 0, extra, ROOM, removed, null), false);
  assert.equal(isWalkableTile(0, 0, extra, ROOM, removed, new Set()), false);
});
