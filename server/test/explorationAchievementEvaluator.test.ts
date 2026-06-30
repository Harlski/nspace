import assert from "node:assert/strict";
import test from "node:test";

process.env.WORLDCUP_ENABLED = "1";
import {
  builtinDoorSeenKey,
  computeDistinctTileCredits,
  computeOutfieldTileCredits,
  countGrandTourProgress,
  explorationRoomCanonicalKey,
  explorationRoomSeenKey,
  formatGrandTourVisitedKeys,
  grandTourKeyForRoom,
  isGrandTourComplete,
  isMarathonTileEligibleRoom,
  isOutfieldMarginTile,
  marathonTileSeenKey,
  parseGrandTourVisitedKeys,
  resolveBuiltinDoorSeenKeyFromSpawn,
  teleporterDestinationSeenKey,
  teleporterPortalDoorSeenKey,
} from "../src/explorationAchievementEvaluator.js";
import { COSMETIC_GALLERY_ROOM_ID } from "../src/cosmeticGallery.js";
import { CANVAS_ROOM_ID, CHAMBER_DEFAULT_SPAWN } from "../src/roomLayouts.js";
import {
  FIELD_BOUNDS,
  FIELD_OUTFIELD_MARGIN,
  FIELD_ROOM_ID,
  HUB_FIELD_DOOR,
} from "../src/worldcup/config.js";

test("Marathon eligibility excludes field-like, shaper, and canvas rooms", () => {
  assert.equal(isMarathonTileEligibleRoom("hub"), true);
  assert.equal(isMarathonTileEligibleRoom("chamber"), true);
  assert.equal(isMarathonTileEligibleRoom("pixel"), true);
  assert.equal(isMarathonTileEligibleRoom("my-room"), true);
  assert.equal(isMarathonTileEligibleRoom(FIELD_ROOM_ID), false);
  assert.equal(isMarathonTileEligibleRoom("wc-match-abc"), false);
  assert.equal(isMarathonTileEligibleRoom(COSMETIC_GALLERY_ROOM_ID), false);
  assert.equal(isMarathonTileEligibleRoom(CANVAS_ROOM_ID), false);
});

test("marathonTileSeenKey uses normalized room id and integer tile coords", () => {
  assert.equal(marathonTileSeenKey("Hub", 3, -2), "tile:hub:3,-2");
});

test("computeDistinctTileCredits skips ineligible rooms", () => {
  const credits = computeDistinctTileCredits(
    FIELD_ROOM_ID,
    [{ x: 1, z: 2 }],
    () => false
  );
  assert.deepEqual(credits, []);
});

test("computeDistinctTileCredits dedupes repeats within one path", () => {
  const credits = computeDistinctTileCredits(
    "hub",
    [
      { x: 0, z: 0 },
      { x: 0, z: 0 },
      { x: 1, z: 0 },
    ],
    () => false
  );
  assert.deepEqual(credits, ["tile:hub:0,0", "tile:hub:1,0"]);
});

test("computeDistinctTileCredits dedupes repeats and caps at path length", () => {
  const seen = new Set<string>();
  const isAlreadySeen = (key: string) => seen.has(key);
  const path = [
    { x: 0, z: 0 },
    { x: 1, z: 0 },
    { x: 1, z: 0 },
    { x: 2, z: 0 },
  ];
  const first = computeDistinctTileCredits("hub", path, isAlreadySeen);
  assert.deepEqual(first, [
    "tile:hub:0,0",
    "tile:hub:1,0",
    "tile:hub:2,0",
  ]);
  for (const key of first) seen.add(key);

  const second = computeDistinctTileCredits("hub", path, isAlreadySeen);
  assert.deepEqual(second, []);

  const longPath = Array.from({ length: 5 }, (_, i) => ({ x: i + 10, z: 0 }));
  const capped = computeDistinctTileCredits("hub", longPath, () => false);
  assert.equal(capped.length, longPath.length);
});

test("computeDistinctTileCredits credits at most one new tile per path step", () => {
  const credits = computeDistinctTileCredits(
    "hub",
    [{ x: 4, z: 4 }],
    () => false
  );
  assert.deepEqual(credits, ["tile:hub:4,4"]);
});

test("explorationRoomCanonicalKey dedupes Play Space slugs", () => {
  assert.equal(explorationRoomCanonicalKey("invite-lobby-ABC123"), "abc123");
  assert.equal(explorationRoomCanonicalKey("invite-lobby-ABC123"), "abc123");
  assert.equal(explorationRoomSeenKey("invite-lobby-XYZ"), "room:xyz");
  assert.equal(explorationRoomCanonicalKey("my-room"), "my-room");
});

test("grandTourKeyForRoom recognizes the five canonical stops", () => {
  assert.equal(grandTourKeyForRoom("chamber"), "chamber");
  assert.equal(grandTourKeyForRoom("hub"), "hub");
  assert.equal(grandTourKeyForRoom("pixel"), "pixel");
  assert.equal(grandTourKeyForRoom(FIELD_ROOM_ID), FIELD_ROOM_ID);
  assert.equal(grandTourKeyForRoom(COSMETIC_GALLERY_ROOM_ID), "cosmetic-gallery");
  assert.equal(grandTourKeyForRoom("my-room"), null);
});

test("Grand Tour daily set progress and completion", () => {
  const partial = parseGrandTourVisitedKeys("chamber,hub,pixel");
  assert.equal(countGrandTourProgress(partial), 3);
  assert.equal(isGrandTourComplete(partial), false);
  const full = parseGrandTourVisitedKeys(
    formatGrandTourVisitedKeys(
      new Set(["pixel", "hub", "field", "chamber", "cosmetic-gallery"])
    )
  );
  assert.equal(isGrandTourComplete(full), true);
});

test("resolveBuiltinDoorSeenKeyFromSpawn matches hub→chamber door spawn", () => {
  const key = resolveBuiltinDoorSeenKeyFromSpawn(
    "chamber",
    CHAMBER_DEFAULT_SPAWN.x,
    CHAMBER_DEFAULT_SPAWN.z
  );
  assert.equal(key, builtinDoorSeenKey("hub", 12, 0, "chamber"));
});

test("resolveBuiltinDoorSeenKeyFromSpawn matches hub→field door spawn", () => {
  const key = resolveBuiltinDoorSeenKeyFromSpawn(
    FIELD_ROOM_ID,
    HUB_FIELD_DOOR.spawnX,
    HUB_FIELD_DOOR.spawnZ
  );
  assert.equal(
    key,
    builtinDoorSeenKey("hub", HUB_FIELD_DOOR.x, HUB_FIELD_DOOR.z, FIELD_ROOM_ID)
  );
});

test("teleporter door and destination keys are stable", () => {
  assert.equal(
    teleporterPortalDoorSeenKey("hub", 3, 4, "my-room"),
    "door:tp:hub:3,4→my-room"
  );
  assert.equal(
    teleporterDestinationSeenKey("My-Room"),
    "teleporter-dest:my-room"
  );
});

test("isOutfieldMarginTile excludes pitch interior and accepts margin band", () => {
  assert.equal(
    isOutfieldMarginTile(0, 0, FIELD_BOUNDS, FIELD_OUTFIELD_MARGIN),
    false
  );
  assert.equal(
    isOutfieldMarginTile(-11, 0, FIELD_BOUNDS, FIELD_OUTFIELD_MARGIN),
    true
  );
  assert.equal(
    isOutfieldMarginTile(0, 9, FIELD_BOUNDS, FIELD_OUTFIELD_MARGIN),
    false
  );
});

test("computeOutfieldTileCredits skips pitch tiles and dedupes", () => {
  const credits = computeOutfieldTileCredits(
    FIELD_ROOM_ID,
    [
      { x: 0, z: 0 },
      { x: -11, z: 0 },
      { x: -11, z: 0 },
      { x: -11, z: 1 },
    ],
    () => false
  );
  assert.deepEqual(credits, [
    "outfield:field:-11,0",
    "outfield:field:-11,1",
  ]);
});

test("computeOutfieldTileCredits ignores non-field rooms", () => {
  assert.deepEqual(
    computeOutfieldTileCredits("hub", [{ x: -11, z: 0 }], () => false),
    []
  );
});

test("computeOutfieldTileCredits ignores canvas maze room", () => {
  assert.deepEqual(
    computeOutfieldTileCredits(CANVAS_ROOM_ID, [{ x: -11, z: 0 }], () => false),
    []
  );
});
