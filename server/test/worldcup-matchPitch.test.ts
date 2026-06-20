import assert from "node:assert/strict";
import test from "node:test";

import { matchSpawn, scoringSideForGoal } from "../src/worldcup/matchPitch.js";
import {
  isMatchPitchRoomId,
  makeMatchPitchRoomId,
} from "../src/worldcup/config.js";

test("a goal in the east net scores for side a (b concedes its own goal)", () => {
  assert.equal(scoringSideForGoal("east"), "a");
});

test("a goal in the west net scores for side b (a concedes its own goal)", () => {
  assert.equal(scoringSideForGoal("west"), "b");
});

test("sides spawn on opposite halves, centred on z", () => {
  const a = matchSpawn("a");
  const b = matchSpawn("b");
  assert.ok(a.x < 0 && b.x > 0, "a is west, b is east");
  assert.equal(a.z, 0);
  assert.equal(b.z, 0);
});

test("match pitch room ids round-trip through the prefix helpers", () => {
  const id = makeMatchPitchRoomId("abc123");
  assert.ok(isMatchPitchRoomId(id));
  assert.ok(!isMatchPitchRoomId("field"));
  assert.ok(!isMatchPitchRoomId("hub"));
  assert.ok(!isMatchPitchRoomId(null));
});
