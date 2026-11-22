import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PUBLIC_DIRECTORY_DOOR,
  PUBLIC_DIRECTORY_SPAWN,
  DIRECTORY_PODIUM_REFRESH_MS,
  DIRECTORY_PODIUM_SLOTS,
  directoryShownPlayerCount,
  getPublicDirectoryBounds,
  layoutPublicDirectory,
  nextDirectoryPodium,
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
    assert.deepEqual(
      teleporters.slice(0, 3).map((slot) => ({ x: slot.x, z: slot.z })),
      DIRECTORY_PODIUM_SLOTS.slice(0, 3)
    );
    assert.ok(teleporters[0]!.z > PUBLIC_DIRECTORY_SPAWN.z);
    assert.ok(teleporters[0]!.z < teleporters[1]!.z);
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
    assert.deepEqual(
      row.teleporters.map((slot) => ({ x: slot.x, z: slot.z })),
      DIRECTORY_PODIUM_SLOTS.slice(0, 3)
    );
    assert.equal(one.bounds.minZ, PUBLIC_DIRECTORY_DOOR.z);
    assert.ok(next.teleporters[3]!.z > row.teleporters[2]!.z);
    assert.ok(next.bounds.maxZ >= next.teleporters[3]!.z);
    assert.deepEqual(
      { x: next.teleporters[3]!.x, z: next.teleporters[3]!.z },
      { x: DIRECTORY_PODIUM_SLOTS[3]!.x, z: DIRECTORY_PODIUM_SLOTS[3]!.z }
    );
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
    assert.equal(hot?.x, DIRECTORY_PODIUM_SLOTS[0]!.x);
    assert.equal(hot?.z, DIRECTORY_PODIUM_SLOTS[0]!.z);
    assert.equal(hot?.targetX, 4);
    assert.equal(hot?.targetZ, 5);
    assert.equal(quiet?.x, DIRECTORY_PODIUM_SLOTS[1]!.x);
    assert.equal(quiet?.z, DIRECTORY_PODIUM_SLOTS[1]!.z);
  });

  it("keeps a moved tile behind the podium", () => {
    layoutPublicDirectory([]);
    const entries = Array.from({ length: 6 }, (_, i) =>
      listing({ id: `r${i}`, thumbsUpCount: 20 - i })
    );
    const moved = reconcilePublicDirectory(entries, [{ x: 4, z: 18 }]);
    const first = moved.teleporters.find((slot) => slot.targetRoomId === "r0");
    const sixth = moved.teleporters.find((slot) => slot.targetRoomId === "r5");
    assert.equal(first?.x, DIRECTORY_PODIUM_SLOTS[0]!.x);
    assert.equal(first?.z, DIRECTORY_PODIUM_SLOTS[0]!.z);
    assert.equal(sixth?.x, 4);
    assert.equal(sixth?.z, 18);
  });

  it("holds the podium for 30 minutes, then re-ranks by likes", () => {
    const start = [
      listing({ id: "a", thumbsUpCount: 5 }),
      listing({ id: "b", thumbsUpCount: 4 }),
      listing({ id: "c", thumbsUpCount: 1 }),
    ];
    const first = nextDirectoryPodium(start, null, 0);
    assert.deepEqual(first.hold.roomIds, ["a", "b", "c"]);
    const surged = [
      listing({ id: "a", thumbsUpCount: 5 }),
      listing({ id: "b", thumbsUpCount: 4 }),
      listing({ id: "c", thumbsUpCount: 99 }),
    ];
    const held = nextDirectoryPodium(surged, first.hold, 10 * 60 * 1000);
    assert.deepEqual(held.hold.roomIds, ["a", "b", "c"]);
    assert.equal(held.hold.assignedAtMs, 0);
    const refreshed = nextDirectoryPodium(
      surged,
      first.hold,
      DIRECTORY_PODIUM_REFRESH_MS
    );
    assert.deepEqual(refreshed.hold.roomIds, ["c", "a", "b"]);
    assert.equal(refreshed.hold.assignedAtMs, DIRECTORY_PODIUM_REFRESH_MS);
  });

  it("fills a vacated podium seat without waiting for the likes refresh", () => {
    const next = nextDirectoryPodium(
      [
        listing({ id: "a", thumbsUpCount: 5 }),
        listing({ id: "d", thumbsUpCount: 3 }),
      ],
      { assignedAtMs: 0, roomIds: ["a", "b", "c"] },
      1000
    );
    assert.deepEqual(next.hold.roomIds, ["a", "d"]);
    assert.equal(next.hold.assignedAtMs, 0);
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
