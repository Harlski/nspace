import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PUBLIC_DIRECTORY_DOOR,
  PUBLIC_DIRECTORY_SPAWN,
  directoryRankingSchedule,
  directoryShownPlayerCount,
  getPublicDirectoryBounds,
  layoutPublicDirectory,
  reconcilePublicDirectory,
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

describe("public directory slot rebinding", () => {
  it("puts the hottest room on the slot closest to the door", () => {
    layoutPublicDirectory([]);
    const { teleporters } = reconcilePublicDirectory(
      [
        listing({ id: "quiet", thumbsUpCount: 0, spawnX: 1, spawnZ: 1 }),
        listing({ id: "hot", thumbsUpCount: 5, spawnX: 4, spawnZ: 5 }),
      ],
      [
        { x: 0, z: 20 },
        { x: 3, z: 2 },
      ]
    );
    const hot = teleporters.find((slot) => slot.targetRoomId === "hot");
    const quiet = teleporters.find((slot) => slot.targetRoomId === "quiet");
    assert.equal(hot?.x, 3);
    assert.equal(hot?.z, 2);
    assert.equal(hot?.targetX, 4);
    assert.equal(hot?.targetZ, 5);
    assert.equal(quiet?.x, 0);
    assert.equal(quiet?.z, 20);
  });

  it("keeps moved tiles and only adds a slot for a new public room", () => {
    layoutPublicDirectory([]);
    const moved = reconcilePublicDirectory(
      [listing({ id: "only", thumbsUpCount: 1 })],
      [{ x: 4, z: 3 }]
    );
    assert.equal(moved.teleporters.length, 1);
    assert.equal(moved.teleporters[0]?.x, 4);
    assert.equal(moved.teleporters[0]?.z, 3);

    const grown = reconcilePublicDirectory(
      [
        listing({ id: "only", thumbsUpCount: 1 }),
        listing({ id: "hotter", thumbsUpCount: 9, spawnX: 2, spawnZ: 2 }),
      ],
      moved.teleporters.map((slot) => ({ x: slot.x, z: slot.z }))
    );
    assert.equal(grown.teleporters.length, 2);
    const kept = grown.teleporters.find((slot) => slot.x === 4 && slot.z === 3);
    assert.ok(kept);
    const hotter = grown.teleporters.find((slot) => slot.targetRoomId === "hotter");
    assert.ok(hotter);
    assert.ok(
      hotter!.x !== 4 || hotter!.z !== 3,
      "the new room takes the closer default slot"
    );
    assert.equal(hotter?.targetX, 2);
    assert.equal(hotter?.targetZ, 2);
  });

  it("shows a preview count only for empty rooms outside production", () => {
    assert.equal(directoryShownPlayerCount("quiet", 0, false), 0);
    assert.equal(directoryShownPlayerCount("quiet", 4, true), 4);
    const preview = directoryShownPlayerCount("quiet", 0, true);
    assert.ok(preview >= 1 && preview <= 12);
    assert.equal(directoryShownPlayerCount("quiet", 0, true), preview);
    assert.equal(reconcilePublicDirectory(
      [listing({ id: "quiet", playerCount: 3 })],
      []
    ).teleporters[0]?.playerCount, 3);
  });

  it("carries the owner wallet onto the teleporter slot", () => {
    layoutPublicDirectory([]);
    const { teleporters } = reconcilePublicDirectory(
      [listing({ id: "owned", ownerAddress: "NQ07 OWNER" })],
      []
    );
    assert.equal(teleporters[0]?.targetRoomOwnerAddress, "NQ07 OWNER");
  });

  it("drops the farthest slot when a room is no longer listed", () => {
    layoutPublicDirectory([]);
    const shrunk = reconcilePublicDirectory(
      [listing({ id: "keep" })],
      [
        { x: 0, z: 2 },
        { x: 0, z: 30 },
      ]
    );
    assert.equal(shrunk.teleporters.length, 1);
    assert.equal(shrunk.teleporters[0]?.x, 0);
    assert.equal(shrunk.teleporters[0]?.z, 2);
    assert.equal(shrunk.teleporters[0]?.targetRoomId, "keep");
  });
});

describe("directory ranking schedule", () => {
  it("counts a full interval after a rebind", () => {
    const schedule = directoryRankingSchedule(1_000, 0, 50, 100);
    assert.equal(schedule.serverNowMs, 1_000);
    assert.equal(schedule.intervalMs, 5_000);
    assert.equal(schedule.nextAtMs, 6_000);
  });

  it("shortens the wait by the ticks already elapsed", () => {
    const mid = directoryRankingSchedule(1_000, 40, 50, 100);
    assert.equal(mid.nextAtMs, 1_000 + 60 * 50);
    const last = directoryRankingSchedule(1_000, 99, 50, 100);
    assert.equal(last.nextAtMs, 1_050);
  });
});
