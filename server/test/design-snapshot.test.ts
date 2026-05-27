import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  captureDesignSnapshot,
  normalizeDesignBbox,
  validateBboxForKind,
  sanitizeObstaclePropsForExport,
  rotateDesignOffset,
} from "../src/designSnapshot.js";
import type { TerrainProps } from "../src/grid.js";
import { blockKey } from "../src/grid.js";

describe("designSnapshot", () => {
  it("rejects teleporters and gates from export", () => {
    assert.equal(sanitizeObstaclePropsForExport({ teleporter: { pending: true } } as TerrainProps), null);
    assert.equal(
      sanitizeObstaclePropsForExport({ gate: { exitX: 0, exitZ: 1 } } as TerrainProps),
      null
    );
  });

  it("captures obstacles in bbox", () => {
    const placed = new Map<string, TerrainProps>();
    placed.set(blockKey(2, 3, 0), {
      passable: false,
      half: false,
      quarter: false,
      hex: false,
      pyramid: false,
      sphere: false,
      ramp: false,
      rampDir: 0,
      colorRgb: 0xff0000,
    });
    const bbox = normalizeDesignBbox(2, 3, 3, 4);
    const r = captureDesignSnapshot(placed, undefined, undefined, bbox);
    assert.ok(!("error" in r));
    if ("error" in r) return;
    assert.equal(r.obstacleCount, 1);
    assert.equal(r.snapshot.obstacles[0]?.dx, 0);
    assert.equal(r.snapshot.obstacles[0]?.dz, 0);
  });

  it("validates object footprint cap", () => {
    const bbox = { minX: 0, maxX: 7, minZ: 0, maxZ: 0 };
    assert.equal(validateBboxForKind(bbox, "object"), "footprint_too_large");
  });

  it("rotates offsets for yaw", () => {
    const r = rotateDesignOffset(1, 0, 2, 1, 1);
    assert.equal(r.dx, 0);
    assert.equal(r.dz, 0);
  });
});
