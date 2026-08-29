import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateMosquitoTagAchievementEvents,
  SAVED_BY_THE_BELL_REMAINING_MS,
} from "../src/mosquitoTag/achievements.js";
import {
  initTagState,
  reduceTag,
  TAG_DEFAULTS,
  type TagConfig,
  type TagEvent,
  type TagState,
  type TagVec,
} from "../src/mosquitoTag/engine.js";

const CFG: TagConfig = { ...TAG_DEFAULTS };

const WALKABLE: TagVec[] = [
  { x: 0, z: 0 },
  { x: 1, z: 0 },
  { x: 2, z: 0 },
  { x: 3, z: 0 },
  { x: 4, z: 0 },
  { x: 5, z: 0 },
  { x: 6, z: 0 },
];

function drive(events: TagEvent[], start: TagState = initTagState()): TagState {
  return events.reduce((s, e) => reduceTag(s, e, CFG), start);
}

function startPlaying(): TagState {
  return drive([
    { type: "raise", playerId: "a" },
    { type: "join", playerId: "b" },
    { type: "join", playerId: "c" },
    { type: "start", playerId: "a", nowMs: 1_000 },
    {
      type: "tick",
      nowMs: 1_000 + CFG.countdownMs,
      poses: {},
      walkable: WALKABLE,
      rng: () => 0,
    },
  ]);
}

function fires(
  prev: TagState,
  next: TagState,
  nowMs: number
): Array<{ playerId: string; event: string }> {
  return evaluateMosquitoTagAchievementEvents(prev, next, nowMs);
}

test("raising a Tag Call fires tag_call_raised for the Caller only", () => {
  const prev = initTagState();
  const next = drive([{ type: "raise", playerId: "a" }]);
  assert.deepEqual(fires(prev, next, 0), [
    { playerId: "a", event: "tag_call_raised" },
  ]);
});

test("Join fires tag_joined for the Joiner, not the Caller", () => {
  const prev = drive([{ type: "raise", playerId: "a" }]);
  const next = reduceTag(prev, { type: "join", playerId: "b" }, CFG);
  assert.deepEqual(fires(prev, next, 0), [
    { playerId: "b", event: "tag_joined" },
  ]);
});

test("passing the Mosquito fires mosquito_passed for the previous Holder", () => {
  const playing = startPlaying();
  assert.equal(playing.holderId, "a");
  const t = 1_000 + CFG.countdownMs + 10;
  const next = reduceTag(
    playing,
    {
      type: "tick",
      nowMs: t,
      poses: { a: { x: 0, z: 0 }, b: { x: 0, z: 0 }, c: { x: 9, z: 9 } },
      walkable: WALKABLE,
      rng: () => 0,
    },
    CFG
  );
  assert.equal(next.holderId, "b");
  assert.deepEqual(fires(playing, next, t), [
    { playerId: "a", event: "mosquito_passed" },
  ]);
});

test("a Pass with 3s or less remaining also fires mosquito_passed_clutch", () => {
  const playing = startPlaying();
  const t = playing.roundEndsAtMs - SAVED_BY_THE_BELL_REMAINING_MS;
  const next = reduceTag(
    playing,
    {
      type: "tick",
      nowMs: t,
      poses: { a: { x: 0, z: 0 }, b: { x: 0, z: 0 }, c: { x: 9, z: 9 } },
      walkable: WALKABLE,
      rng: () => 0,
    },
    CFG
  );
  assert.equal(next.holderId, "b");
  assert.deepEqual(fires(playing, next, t), [
    { playerId: "a", event: "mosquito_passed" },
    { playerId: "a", event: "mosquito_passed_clutch" },
  ]);
});

test("a Pass with more than 3s remaining is not clutch", () => {
  const playing = startPlaying();
  const t = playing.roundEndsAtMs - SAVED_BY_THE_BELL_REMAINING_MS - 1;
  const next = reduceTag(
    playing,
    {
      type: "tick",
      nowMs: t,
      poses: { a: { x: 0, z: 0 }, b: { x: 0, z: 0 }, c: { x: 9, z: 9 } },
      walkable: WALKABLE,
      rng: () => 0,
    },
    CFG
  );
  assert.deepEqual(fires(playing, next, t), [
    { playerId: "a", event: "mosquito_passed" },
  ]);
});

test("Holder leave reassignment is not a Pass", () => {
  const playing = startPlaying();
  const t = 1_000 + CFG.countdownMs + 50;
  const next = reduceTag(
    playing,
    { type: "leave", playerId: "a", nowMs: t, rng: () => 0 },
    CFG
  );
  assert.notEqual(next.holderId, "a");
  assert.equal(
    fires(playing, next, t).some((f) => f.event === "mosquito_passed"),
    false
  );
});

test("standing on a live Boost Pad fires tag_boost_pad for the Holder", () => {
  const playing = startPlaying();
  const pad = playing.boostPads[0]!;
  const t = 1_000 + CFG.countdownMs;
  const next = reduceTag(
    playing,
    {
      type: "tick",
      nowMs: t,
      poses: { a: { x: pad.x, z: pad.z }, b: { x: 9, z: 9 }, c: { x: 8, z: 8 } },
      walkable: WALKABLE,
      rng: () => 0,
    },
    CFG
  );
  assert.ok(next.holderBoostUntilMs > playing.holderBoostUntilMs);
  assert.deepEqual(fires(playing, next, t), [
    { playerId: "a", event: "tag_boost_pad" },
  ]);
});

test("timer-end Stung fires tag_stung for the Holder", () => {
  const playing = startPlaying();
  const t = playing.roundEndsAtMs;
  const next = reduceTag(
    playing,
    {
      type: "tick",
      nowMs: t,
      poses: { a: { x: 0, z: 0 }, b: { x: 5, z: 5 }, c: { x: 6, z: 6 } },
      walkable: WALKABLE,
      rng: () => 0,
    },
    CFG
  );
  assert.deepEqual(next.outcome, { type: "stung", playerId: "a" });
  assert.deepEqual(fires(playing, next, t), [
    { playerId: "a", event: "tag_stung" },
  ]);
});

test("last remaining does not fire tag_stung", () => {
  const playing = startPlaying();
  const t = 1_000 + CFG.countdownMs + 20;
  const afterB = reduceTag(
    playing,
    { type: "leave", playerId: "b", nowMs: t, rng: () => 0 },
    CFG
  );
  const next = reduceTag(
    afterB,
    { type: "leave", playerId: "c", nowMs: t + 1, rng: () => 0 },
    CFG
  );
  assert.equal(next.outcome?.type, "last_remaining");
  assert.equal(
    fires(afterB, next, t + 1).some((f) => f.event === "tag_stung"),
    false
  );
});
