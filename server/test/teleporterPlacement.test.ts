import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canPlaceTeleporterAt,
  teleporterInColumn,
} from "../src/grid.js";
import { TELEPORTER_DEFAULT_PILLAR_COLOR_RGB } from "../src/blockColors.js";

const ROOM = "test-room";

function block(x: number, z: number, y: number, props: Record<string, unknown>) {
  return [`${x},${z},${y}`, props] as const;
}

test("teleporterInColumn detects any stack level", () => {
  const placed = new Map<string, Record<string, unknown>>([
    block(1, 2, 1, { teleporter: { pending: true } }),
  ]);
  assert.equal(teleporterInColumn(placed, 1, 2), true);
  assert.equal(teleporterInColumn(placed, 0, 0), false);
});

test("canPlaceTeleporterAt allows floor and one block up only", () => {
  const empty = new Map<string, Record<string, unknown>>();
  const extra = new Map<string, number>();
  assert.equal(
    canPlaceTeleporterAt(ROOM, 0, 0, 0, empty, extra),
    true
  );

  const oneBlock = new Map<string, Record<string, unknown>>([
    block(0, 0, 0, { passable: false, half: false }),
  ]);
  assert.equal(
    canPlaceTeleporterAt(ROOM, 0, 0, 1, oneBlock, extra),
    true
  );
  assert.equal(
    canPlaceTeleporterAt(ROOM, 0, 0, 2, oneBlock, extra),
    false
  );

  const twoBlocks = new Map<string, Record<string, unknown>>([
    block(0, 0, 0, { passable: false }),
    block(0, 0, 1, { passable: false }),
  ]);
  assert.equal(
    canPlaceTeleporterAt(ROOM, 0, 0, 2, twoBlocks, extra),
    false
  );
});

test("canPlaceTeleporterAt rejects teleporter column and teleporter support", () => {
  const extra = new Map<string, number>();
  const withTp = new Map<string, Record<string, unknown>>([
    block(3, 3, 0, {
      teleporter: { pending: true },
      colorRgb: TELEPORTER_DEFAULT_PILLAR_COLOR_RGB,
    }),
  ]);
  assert.equal(
    canPlaceTeleporterAt(ROOM, 3, 3, 1, withTp, extra),
    false
  );

  const tpSupport = new Map<string, Record<string, unknown>>([
    block(4, 4, 0, {
      teleporter: { targetRoomId: "hub", targetX: 0, targetZ: 0 },
    }),
  ]);
  assert.equal(
    canPlaceTeleporterAt(ROOM, 4, 4, 1, tpSupport, extra),
    false
  );
});
