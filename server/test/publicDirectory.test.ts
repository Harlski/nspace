import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PUBLIC_DIRECTORY_DOOR,
  PUBLIC_DIRECTORY_SPAWN,
  getPublicDirectoryBounds,
  layoutPublicDirectory,
  type DirectoryListing,
} from "../src/publicDirectory.js";

function listing(
  partial: Pick<DirectoryListing, "id"> & Partial<DirectoryListing>
): DirectoryListing {
  return {
    displayName: partial.id,
    thumbsUpCount: 0,
    playerCount: 0,
    spawnX: 0,
    spawnZ: 0,
    ...partial,
  };
}

describe("public directory layout", () => {
  it("puts the most thumbed-up room closest to the door", () => {
    const { teleporters } = layoutPublicDirectory([
      listing({ id: "quiet", displayName: "Quiet", thumbsUpCount: 1, spawnX: 1, spawnZ: 2 }),
      listing({ id: "busy", displayName: "Busy", thumbsUpCount: 9, playerCount: 1, spawnX: 3, spawnZ: 4 }),
      listing({ id: "crowded", displayName: "Crowded", thumbsUpCount: 9, playerCount: 4, spawnX: -1, spawnZ: 0 }),
    ]);
    assert.equal(teleporters[0]?.targetRoomId, "crowded");
    assert.equal(teleporters[1]?.targetRoomId, "busy");
    assert.equal(teleporters[2]?.targetRoomId, "quiet");
    assert.equal(teleporters[0]?.z, teleporters[1]?.z);
    assert.equal(teleporters[1]?.z, teleporters[2]?.z);
    assert.ok(teleporters[0]!.z > PUBLIC_DIRECTORY_SPAWN.z);
    assert.ok(teleporters[0]!.x < teleporters[1]!.x);
    assert.ok(teleporters[1]!.x < teleporters[2]!.x);
    assert.equal(teleporters[0]?.targetRoomDisplayName, "Crowded");
    assert.equal(teleporters[0]?.targetX, -1);
    assert.equal(teleporters[0]?.targetZ, 0);
  });

  it("fills rows of three and lengthens the hall on the next row", () => {
    const one = layoutPublicDirectory([listing({ id: "a" })]);
    const row = layoutPublicDirectory([
      listing({ id: "a" }),
      listing({ id: "b" }),
      listing({ id: "c" }),
    ]);
    const next = layoutPublicDirectory([
      listing({ id: "a" }),
      listing({ id: "b" }),
      listing({ id: "c" }),
      listing({ id: "d" }),
    ]);
    assert.equal(row.teleporters[0]?.z, row.teleporters[2]?.z);
    assert.deepEqual(
      row.teleporters.map((slot) => slot.x),
      [-3, 0, 3]
    );
    assert.equal(one.bounds.maxZ, row.bounds.maxZ);
    assert.equal(one.bounds.minZ, PUBLIC_DIRECTORY_DOOR.z);
    assert.ok(next.bounds.maxZ > row.bounds.maxZ);
    assert.ok(next.teleporters[3]!.z > next.teleporters[0]!.z);
    assert.equal(next.teleporters[3]?.x, -3);
    assert.equal(getPublicDirectoryBounds().maxZ, next.bounds.maxZ);
    assert.ok(
      next.teleporters.every(
        (slot) =>
          slot.x >= next.bounds.minX &&
          slot.x <= next.bounds.maxX &&
          slot.z <= next.bounds.maxZ
      )
    );
  });

  it("keeps a short hall when nothing is public", () => {
    const { teleporters, bounds } = layoutPublicDirectory([]);
    assert.equal(teleporters.length, 0);
    assert.equal(bounds.minZ, PUBLIC_DIRECTORY_DOOR.z);
    assert.ok(bounds.maxZ > PUBLIC_DIRECTORY_SPAWN.z);
  });
});
