import assert from "node:assert/strict";
import { describe, expect, it } from "vitest";
import {
  moveOrderPlaybackActive,
  remotePoseFromMoveOrder,
  type MoveOrderWire,
} from "./moveOrderPlayback.js";

const OPEN_BOUNDS = {
  minX: -1000,
  maxX: 1000,
  minZ: -1000,
  maxZ: 1000,
};

const EMPTY_PLACED = new Map();

describe("remotePoseFromMoveOrder", () => {
  it("walks a straight segment from server-owned startAtMs", () => {
    const order: MoveOrderWire = {
      address: "NQ97 TEST",
      path: [{ x: 5, z: 0, layer: 0 }],
      startX: 0,
      startZ: 0,
      startAtMs: 1_000_000,
      speed: 5,
    };

    const mid = remotePoseFromMoveOrder({
      order,
      startY: 0,
      nowMs: order.startAtMs + 500,
      bounds: OPEN_BOUNDS,
      placed: EMPTY_PLACED,
    });
    assert.ok(mid.pose.x > 2 && mid.pose.x < 3);
    assert.equal(mid.pathRemaining, 1);

    const done = remotePoseFromMoveOrder({
      order,
      startY: 0,
      nowMs: order.startAtMs + 1100,
      bounds: OPEN_BOUNDS,
      placed: EMPTY_PLACED,
    });
    expect(done.pathRemaining).toBe(0);
    assert.ok(Math.abs(done.pose.x - 5) <= 0.05);
  });

  it("reports playback active until the path queue is drained", () => {
    const order: MoveOrderWire = {
      address: "NQ97 TEST",
      path: [{ x: 3, z: 0, layer: 0 }],
      startX: 0,
      startZ: 0,
      startAtMs: 0,
      speed: 5,
    };
    expect(moveOrderPlaybackActive(1)).toBe(true);
    expect(moveOrderPlaybackActive(0)).toBe(false);
  });
});
