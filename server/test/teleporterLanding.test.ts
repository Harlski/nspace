import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isValidTeleporterLandingHint,
  isLegalTeleporterLanding,
  resolveTeleporterLanding,
  parsePlacedKey,
  type TeleporterLandingContext,
} from "../src/teleporterLanding.js";

const bounds = { minX: -5, maxX: 5, minZ: -5, maxZ: 5 };

function makeCtx(overrides: Partial<TeleporterLandingContext> = {}): TeleporterLandingContext {
  const walkable = new Set(["0,0", "2,2", "3,3"]);
  const floorWalkable = new Set(["0,0", "2,2", "3,3", "1,1"]);
  return {
    normalizeRoomId: (id) => id.toLowerCase(),
    hubRoomId: "hub",
    getRoomBounds: () => bounds,
    isWalkableForRoom: (_roomId, x, z) => walkable.has(`${x},${z}`),
    floorWalkableAt: (_roomId, x, z) => floorWalkable.has(`${x},${z}`),
    resolveDefaultSpawnForPlayerRoom: (roomId) =>
      roomId === "myroom" ? { x: 3, z: 3 } : null,
    ...overrides,
  };
}

describe("teleporterLanding", () => {
  it("validates landing hint in bounds and walkable", () => {
    const ctx = makeCtx();
    assert.equal(isValidTeleporterLandingHint("myroom", 2, 2, ctx), true);
    assert.equal(isValidTeleporterLandingHint("myroom", 99, 0, ctx), false);
    assert.equal(isValidTeleporterLandingHint("myroom", 1, 1, ctx), false);
  });

  it("resolves Hub to fixed spawn", () => {
    const landing = resolveTeleporterLanding("hub", 5, 5, makeCtx());
    assert.deepEqual(landing, { x: 0, z: 0 });
  });

  it("uses hint when legal at warp time", () => {
    const landing = resolveTeleporterLanding("myroom", 2, 2, makeCtx());
    assert.deepEqual(landing, { x: 2, z: 2 });
  });

  it("falls back to join spawn when hint blocked", () => {
    const landing = resolveTeleporterLanding("myroom", 4, 4, makeCtx());
    assert.deepEqual(landing, { x: 3, z: 3 });
  });

  it("falls back to room center when no default spawn", () => {
    const landing = resolveTeleporterLanding("commons", 9, 9, makeCtx());
    assert.deepEqual(landing, { x: 0, z: 0 });
  });

  it("parsePlacedKey reads block keys", () => {
    assert.deepEqual(parsePlacedKey("2,3,1"), { x: 2, z: 3, y: 1 });
    assert.deepEqual(parsePlacedKey("2,3"), { x: 2, z: 3, y: 0 });
    assert.equal(parsePlacedKey("bad"), null);
  });

  it("isLegalTeleporterLanding uses floor walkability", () => {
    const ctx = makeCtx();
    assert.equal(isLegalTeleporterLanding("r", 1, 1, ctx), true);
    assert.equal(isLegalTeleporterLanding("r", 9, 9, ctx), false);
  });
});
