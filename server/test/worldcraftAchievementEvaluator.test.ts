import assert from "node:assert/strict";
import test from "node:test";

import {
  floorRecolorSeenKey,
  hueBucketFromColorRgb,
  isPalettePainterEligibleRoom,
  isRoomDeluxeComplete,
  parseRoomDeluxeProgress,
  rainbowHueSeenKey,
  roomDeluxeMetRequirements,
  shapeSeenKey,
  terrainShapeKindFromPrism,
} from "../src/worldcraftAchievementEvaluator.js";

test("Palette Painter excludes Pixel room", () => {
  assert.equal(isPalettePainterEligibleRoom("hub"), true);
  assert.equal(isPalettePainterEligibleRoom("pixel"), false);
  assert.equal(isPalettePainterEligibleRoom("PIXEL"), false);
});

test("floorRecolorSeenKey normalizes room id and tile coords", () => {
  assert.equal(floorRecolorSeenKey("My-Room", 2, -1), "recolor:my-room:2,-1");
});

test("terrainShapeKindFromPrism maps prism flags to shape kinds", () => {
  assert.equal(
    terrainShapeKindFromPrism({
      hex: false,
      pyramid: false,
      sphere: false,
      ramp: false,
    }),
    "cube"
  );
  assert.equal(
    terrainShapeKindFromPrism({
      hex: true,
      pyramid: false,
      sphere: false,
      ramp: false,
    }),
    "hex"
  );
  assert.equal(shapeSeenKey("ramp"), "shape:ramp");
});

test("hueBucketFromColorRgb buckets distinct hues", () => {
  const red = hueBucketFromColorRgb(0xff0000);
  const green = hueBucketFromColorRgb(0x00ff00);
  const blue = hueBucketFromColorRgb(0x0000ff);
  assert.notEqual(red, green);
  assert.notEqual(green, blue);
  assert.equal(hueBucketFromColorRgb(0x808080), -1);
});

test("rainbowHueSeenKey scopes hues per room", () => {
  assert.equal(rainbowHueSeenKey("hub", 3), "rainbow-hue:hub:3");
  assert.equal(rainbowHueSeenKey("chamber", 3), "rainbow-hue:chamber:3");
});

test("room deluxe progress completes when all four requirements met", () => {
  const partial = parseRoomDeluxeProgress(
    JSON.stringify({ created: true, blocks: 10, spawn: true, recolors: 2 })
  );
  assert.equal(roomDeluxeMetRequirements(partial), 2);
  assert.equal(isRoomDeluxeComplete(partial), false);

  const done = parseRoomDeluxeProgress(
    JSON.stringify({ created: true, blocks: 25, spawn: true, recolors: 5 })
  );
  assert.equal(roomDeluxeMetRequirements(done), 4);
  assert.equal(isRoomDeluxeComplete(done), true);
});
