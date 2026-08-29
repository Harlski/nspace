import assert from "node:assert/strict";
import test from "node:test";

import {
  mosquitoTagAllowedInRoom,
  mosquitoTagOccupiedTileKeys,
} from "../src/mosquitoTag/policy.js";

test("Mosquito Tag is allowed in the Hub, Commons, and ordinary rooms", () => {
  assert.equal(mosquitoTagAllowedInRoom("chamber"), true);
  assert.equal(mosquitoTagAllowedInRoom("hub"), true);
  assert.equal(mosquitoTagAllowedInRoom("my-room"), true);
});

test("Mosquito Tag is blocked on Match Pitches, Field, Tutorial, Pixel, and Canvas", () => {
  assert.equal(mosquitoTagAllowedInRoom("field"), false);
  assert.equal(mosquitoTagAllowedInRoom("wc-match-abc"), false);
  assert.equal(mosquitoTagAllowedInRoom("tutorial"), false);
  assert.equal(mosquitoTagAllowedInRoom("tutorial-staging"), false);
  assert.equal(mosquitoTagAllowedInRoom("pixel"), false);
  assert.equal(mosquitoTagAllowedInRoom("canvas"), false);
});

test("Boost Pad occupancy uses legacy floor keys and stacked block keys", () => {
  const occupied = mosquitoTagOccupiedTileKeys(["3,4", "5,6,1", "8,9,0"]);
  assert.equal(occupied.has("3,4"), true);
  assert.equal(occupied.has("5,6"), true);
  assert.equal(occupied.has("8,9"), true);
  assert.equal(occupied.has("3,5"), false);
  assert.equal(occupied.has("30,4"), false);
});
