import assert from "node:assert/strict";
import test from "node:test";
import {
  BILLBOARD_AUDIENCE_PROXIMITY_BLOCKS,
  isPixelCollaboratorPaint,
  isWithinBillboardProximity,
  monochromeHueKey,
  parseMonochromeHueKey,
  pixelCornerIdForTile,
  pixelCornerSeenKey,
} from "../src/miningPixelAchievementEvaluator.js";

test("pixelCornerIdForTile maps the four corner bands on the 500×500 board", () => {
  assert.equal(pixelCornerIdForTile(-250, -250), "nw");
  assert.equal(pixelCornerIdForTile(249, -250), "ne");
  assert.equal(pixelCornerIdForTile(-250, 249), "sw");
  assert.equal(pixelCornerIdForTile(249, 249), "se");
  assert.equal(pixelCornerIdForTile(0, 0), null);
});

test("pixelCornerSeenKey uses stable corner ids", () => {
  assert.equal(pixelCornerSeenKey("nw"), "pixel-corner:nw");
});

test("isWithinBillboardProximity uses Chebyshev distance to footprint tiles", () => {
  const footprint = [{ x: 10, z: 10 }];
  assert.equal(isWithinBillboardProximity(10, 10, footprint), true);
  assert.equal(
    isWithinBillboardProximity(
      10 + BILLBOARD_AUDIENCE_PROXIMITY_BLOCKS,
      10,
      footprint
    ),
    true
  );
  assert.equal(
    isWithinBillboardProximity(
      10 + BILLBOARD_AUDIENCE_PROXIMITY_BLOCKS + 1,
      10,
      footprint
    ),
    false
  );
});

test("isPixelCollaboratorPaint requires co-presence and adjacent foreign paint", () => {
  const painters = new Map<string, string>([
    ["1,0", "NQ07 OTHER000000000000000000000000002"],
  ]);
  const present = new Set(["NQ07 OTHER000000000000000000000000002"]);
  const wallet = "NQ07 TEST000000000000000000000000000001";
  assert.equal(isPixelCollaboratorPaint(wallet, 0, 0, painters, present), true);
  assert.equal(
    isPixelCollaboratorPaint(wallet, 5, 5, painters, present),
    false
  );
  assert.equal(isPixelCollaboratorPaint(wallet, 0, 0, painters, new Set()), false);
});

test("monochromeHueKey round-trips through parseMonochromeHueKey", () => {
  const key = monochromeHueKey(0xff8040);
  assert.equal(parseMonochromeHueKey(key), 0xff8040);
});
