import assert from "node:assert/strict";
import test from "node:test";

import {
  chebyshev,
  initTagState,
  isPlayerInTag,
  participantRoomLocked,
  reduceTag,
  snapTile,
  TAG_DEFAULTS,
  tagWireSnapshot,
  walkSpeedMul,
  type TagConfig,
  type TagEvent,
  type TagState,
  type TagVec,
} from "../src/mosquitoTag/engine.js";

const CFG: TagConfig = { ...TAG_DEFAULTS };

function drive(events: TagEvent[], start: TagState = initTagState()): TagState {
  return events.reduce((s, e) => reduceTag(s, e, CFG), start);
}

/** rng() that yields each value in order, then 0. */
function seqRng(values: number[]): () => number {
  let i = 0;
  return () => (i < values.length ? values[i++]! : 0);
}

const WALKABLE: TagVec[] = [
  { x: 0, z: 0 },
  { x: 1, z: 0 },
  { x: 2, z: 0 },
  { x: 3, z: 0 },
  { x: 4, z: 0 },
  { x: 5, z: 0 },
  { x: 6, z: 0 },
];

function startRound(
  extra: TagEvent[] = [],
  rng: () => number = () => 0
): TagState {
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
      rng,
    },
    ...extra,
  ]);
}

test("raise from idle opens a Tag Call with the Caller in the party", () => {
  const s = drive([{ type: "raise", playerId: "a" }]);
  assert.equal(s.phase, "calling");
  assert.equal(s.callerId, "a");
  assert.deepEqual(s.joinerIds, []);
  assert.equal(isPlayerInTag(s, "a"), true);
  assert.equal(isPlayerInTag(s, "b"), false);
});

test("a second raise is ignored while a Tag Call is open", () => {
  const s = drive([
    { type: "raise", playerId: "a" },
    { type: "raise", playerId: "b" },
  ]);
  assert.equal(s.callerId, "a");
  assert.equal(s.phase, "calling");
});

test("others Join until the cap of 8 including the Caller", () => {
  const joins: TagEvent[] = [{ type: "raise", playerId: "a" }];
  for (let i = 1; i <= 8; i++) {
    joins.push({ type: "join", playerId: `p${i}` });
  }
  const s = drive(joins);
  assert.equal(1 + s.joinerIds.length, 8);
  assert.equal(s.joinerIds.includes("p8"), false);
});

test("Caller cannot Join themselves; duplicate Join is ignored", () => {
  const s = drive([
    { type: "raise", playerId: "a" },
    { type: "join", playerId: "a" },
    { type: "join", playerId: "b" },
    { type: "join", playerId: "b" },
  ]);
  assert.deepEqual(s.joinerIds, ["b"]);
});

test("Caller Cancel clears the Tag Call; a Joiner cannot Cancel", () => {
  const cancelled = drive([
    { type: "raise", playerId: "a" },
    { type: "join", playerId: "b" },
    { type: "cancel", playerId: "a" },
  ]);
  assert.equal(cancelled.phase, "idle");

  const blocked = drive([
    { type: "raise", playerId: "a" },
    { type: "join", playerId: "b" },
    { type: "cancel", playerId: "b" },
  ]);
  assert.equal(blocked.phase, "calling");
});

test("a waiting Joiner can Leave; Caller leave clears the Tag Call", () => {
  const left = drive([
    { type: "raise", playerId: "a" },
    { type: "join", playerId: "b" },
    { type: "leave", playerId: "b", nowMs: 0 },
  ]);
  assert.deepEqual(left.joinerIds, []);
  assert.equal(left.phase, "calling");

  const callerGone = drive([
    { type: "raise", playerId: "a" },
    { type: "join", playerId: "b" },
    { type: "leave", playerId: "a", nowMs: 0 },
  ]);
  assert.equal(callerGone.phase, "idle");
});

test("Start requires the Caller plus at least one Joiner and locks the party", () => {
  const solo = drive([
    { type: "raise", playerId: "a" },
    { type: "start", playerId: "a", nowMs: 10 },
  ]);
  assert.equal(solo.phase, "calling");

  const notCaller = drive([
    { type: "raise", playerId: "a" },
    { type: "join", playerId: "b" },
    { type: "start", playerId: "b", nowMs: 10 },
  ]);
  assert.equal(notCaller.phase, "calling");

  const started = drive([
    { type: "raise", playerId: "a" },
    { type: "join", playerId: "b" },
    { type: "start", playerId: "a", nowMs: 10 },
  ]);
  assert.equal(started.phase, "countdown");
  assert.deepEqual(started.participantIds, ["a", "b"]);
  assert.equal(started.countdownEndsAtMs, 10 + CFG.countdownMs);
  assert.equal(started.phase, "countdown");
});

test("Join after Start is ignored", () => {
  const s = drive([
    { type: "raise", playerId: "a" },
    { type: "join", playerId: "b" },
    { type: "start", playerId: "a", nowMs: 10 },
    { type: "join", playerId: "c" },
  ]);
  assert.deepEqual(s.participantIds, ["a", "b"]);
});

test("countdown end assigns a Holder from rng and spawns Boost Pads", () => {
  const s = startRound([], seqRng([0.9, 0, 0, 0, 0, 0, 0]));
  assert.equal(s.phase, "playing");
  // 0.9 * 3 participants → index 2 → "c"
  assert.equal(s.holderId, "c");
  assert.equal(s.boostPads.length, 6);
  assert.equal(s.roundEndsAtMs, 1_000 + CFG.countdownMs + CFG.roundMs);
});

test("passing requires Chebyshev distance 1 or less on snapped tiles", () => {
  assert.equal(chebyshev(snapTile(0.4, 0.4), snapTile(1.4, 0.2)), 1);
  const far = startRound([
    {
      type: "tick",
      nowMs: 1_000 + CFG.countdownMs + 10,
      poses: { a: { x: 0, z: 0 }, b: { x: 3, z: 0 }, c: { x: 9, z: 9 } },
      walkable: WALKABLE,
      rng: () => 0,
    },
  ]);
  assert.equal(far.holderId, "a");

  const passed = reduceTag(
    far,
    {
      type: "tick",
      nowMs: 1_000 + CFG.countdownMs + 10,
      poses: { a: { x: 0, z: 0 }, b: { x: 1, z: 1 }, c: { x: 9, z: 9 } },
      walkable: WALKABLE,
      rng: () => 0,
    },
    CFG
  );
  assert.equal(passed.holderId, "b");
  assert.equal(passed.previousHolderId, "a");
});

test("Bystanders cannot receive the Mosquito", () => {
  const s = startRound([
    {
      type: "tick",
      nowMs: 1_000 + CFG.countdownMs + 10,
      poses: { a: { x: 0, z: 0 }, b: { x: 8, z: 8 }, z: { x: 0, z: 0 } },
      walkable: WALKABLE,
      rng: () => 0,
    },
  ]);
  assert.equal(s.holderId, "a");
});

test("pass cooldown blocks an immediate bounce", () => {
  const t0 = 1_000 + CFG.countdownMs;
  const passed = startRound([
    {
      type: "tick",
      nowMs: t0 + 10,
      poses: { a: { x: 0, z: 0 }, b: { x: 0, z: 0 }, c: { x: 9, z: 9 } },
      walkable: WALKABLE,
      rng: () => 0,
    },
  ]);
  assert.equal(passed.holderId, "b");

  const bounce = reduceTag(
    passed,
    {
      type: "tick",
      nowMs: t0 + 10,
      poses: { a: { x: 0, z: 0 }, b: { x: 0, z: 0 }, c: { x: 9, z: 9 } },
      walkable: WALKABLE,
      rng: () => 0,
    },
    CFG
  );
  assert.equal(bounce.holderId, "b");
});

test("previous Holder is immune from receiving the Mosquito back during the immune window", () => {
  const t0 = 1_000 + CFG.countdownMs;
  const toB = startRound([
    {
      type: "tick",
      nowMs: t0 + 10,
      poses: { a: { x: 0, z: 0 }, b: { x: 0, z: 0 }, c: { x: 9, z: 9 } },
      walkable: WALKABLE,
      rng: () => 0,
    },
  ]);
  const afterCooldown = reduceTag(
    toB,
    {
      type: "tick",
      nowMs: t0 + 10 + CFG.passCooldownMs,
      poses: { a: { x: 0, z: 0 }, b: { x: 0, z: 0 }, c: { x: 9, z: 9 } },
      walkable: WALKABLE,
      rng: () => 0,
    },
    CFG
  );
  assert.equal(afterCooldown.holderId, "b");
});

test("Holder standing on a live Boost Pad gets a 3s non-stacking 1.5x boost", () => {
  const t0 = 1_000 + CFG.countdownMs;
  const playing = startRound([], () => 0);
  const pad = playing.boostPads[0]!;
  const boosted = reduceTag(
    playing,
    {
      type: "tick",
      nowMs: t0,
      poses: { a: { x: pad.x, z: pad.z }, b: { x: 9, z: 9 }, c: { x: 8, z: 8 } },
      walkable: WALKABLE,
      rng: () => 0,
    },
    CFG
  );
  assert.equal(boosted.holderBoostUntilMs, t0 + CFG.boostDurationMs);
  assert.equal(walkSpeedMul(boosted, "a", t0, CFG), 1.5);
  assert.equal(walkSpeedMul(boosted, "b", t0, CFG), 1);

  const stacked = reduceTag(
    boosted,
    {
      type: "tick",
      nowMs: t0 + 100,
      poses: { a: { x: pad.x, z: pad.z }, b: { x: 9, z: 9 }, c: { x: 8, z: 8 } },
      walkable: WALKABLE,
      rng: () => 0,
    },
    CFG
  );
  assert.equal(stacked.holderBoostUntilMs, t0 + CFG.boostDurationMs);

  const cooled = boosted.boostPads.find((p) => p.x === pad.x && p.z === pad.z);
  assert.ok(cooled);
  assert.equal(cooled!.coolingUntilMs, t0 + CFG.boostPadCooldownMs);
});

test("when the Tag Round timer ends the Holder is Stung", () => {
  const t0 = 1_000 + CFG.countdownMs;
  const s = startRound([
    {
      type: "tick",
      nowMs: t0 + CFG.roundMs,
      poses: { a: { x: 0, z: 0 }, b: { x: 5, z: 5 }, c: { x: 6, z: 6 } },
      walkable: WALKABLE,
      rng: () => 0,
    },
  ]);
  assert.equal(s.phase, "result");
  assert.deepEqual(s.outcome, { type: "stung", playerId: "a" });
  assert.equal(s.stungPlayerId, "a");
  assert.equal(s.stungUntilMs, t0 + CFG.roundMs + CFG.stungSlowMs);
  assert.equal(walkSpeedMul(s, "a", t0 + CFG.roundMs, CFG), CFG.stungSlowMul);
  assert.equal(walkSpeedMul(s, "b", t0 + CFG.roundMs, CFG), 1);
});

test("result linger returns to idle", () => {
  const t0 = 1_000 + CFG.countdownMs;
  const ended = startRound([
    {
      type: "tick",
      nowMs: t0 + CFG.roundMs,
      poses: {},
      walkable: WALKABLE,
      rng: () => 0,
    },
  ]);
  const idle = reduceTag(
    ended,
    {
      type: "tick",
      nowMs: t0 + CFG.roundMs + CFG.resultMs,
      poses: {},
      walkable: WALKABLE,
      rng: () => 0,
    },
    CFG
  );
  assert.equal(idle.phase, "idle");
  assert.equal(idle.holderId, null);
  assert.deepEqual(idle.boostPads, []);
  assert.equal(idle.stungPlayerId, "a");
  assert.equal(
    walkSpeedMul(idle, "a", t0 + CFG.roundMs + CFG.resultMs, CFG),
    CFG.stungSlowMul
  );
});

test("Stung slow expires after 30s even once the Tag Round is idle", () => {
  const t0 = 1_000 + CFG.countdownMs;
  const ended = startRound([
    {
      type: "tick",
      nowMs: t0 + CFG.roundMs,
      poses: {},
      walkable: WALKABLE,
      rng: () => 0,
    },
  ]);
  const stillSlow = reduceTag(
    ended,
    {
      type: "tick",
      nowMs: t0 + CFG.roundMs + CFG.resultMs,
      poses: {},
      walkable: WALKABLE,
      rng: () => 0,
    },
    CFG
  );
  const expired = reduceTag(
    stillSlow,
    {
      type: "tick",
      nowMs: t0 + CFG.roundMs + CFG.stungSlowMs,
      poses: {},
      walkable: WALKABLE,
      rng: () => 0,
    },
    CFG
  );
  assert.equal(expired.stungPlayerId, null);
  assert.equal(walkSpeedMul(expired, "a", t0 + CFG.roundMs + CFG.stungSlowMs, CFG), 1);
});

test("Holder leave reassigns among remaining Participants", () => {
  const playing = startRound();
  assert.equal(playing.holderId, "a");
  const next = reduceTag(
    playing,
    {
      type: "leave",
      playerId: "a",
      nowMs: 1_000 + CFG.countdownMs,
      rng: () => 0.9,
    },
    CFG
  );
  assert.equal(next.phase, "playing");
  assert.ok(next.holderId === "b" || next.holderId === "c");
  assert.equal(next.participantIds.includes("a"), false);
});

test("last remaining Participant wins if everyone else left", () => {
  const playing = startRound();
  const afterB = reduceTag(
    playing,
    { type: "leave", playerId: "b", nowMs: 5_000 },
    CFG
  );
  const last = reduceTag(
    afterB,
    { type: "leave", playerId: "c", nowMs: 5_000 },
    CFG
  );
  assert.equal(last.phase, "result");
  assert.deepEqual(last.outcome, { type: "last_remaining", playerId: "a" });
});

test("dropping below two during Tag Countdown aborts to idle", () => {
  const counting = drive([
    { type: "raise", playerId: "a" },
    { type: "join", playerId: "b" },
    { type: "start", playerId: "a", nowMs: 10 },
    { type: "leave", playerId: "b", nowMs: 11 },
  ]);
  assert.equal(counting.phase, "idle");
});

test("wire snapshot reports remaining timers and cooling pads", () => {
  const t0 = 1_000 + CFG.countdownMs;
  const playing = startRound();
  const wire = tagWireSnapshot(playing, t0);
  assert.equal(wire.phase, "playing");
  assert.equal(wire.holder, "a");
  assert.equal(wire.roundRemainingMs, CFG.roundMs);
  assert.equal(wire.countdownRemainingMs, 0);
  assert.equal(wire.boostPads.length, 6);
});

test("Tag Room Lock is off during a waiting Tag Call", () => {
  const s = drive([
    { type: "raise", playerId: "a" },
    { type: "join", playerId: "b" },
  ]);
  assert.equal(participantRoomLocked(s, "a"), false);
  assert.equal(participantRoomLocked(s, "b"), false);
});

test("Tag Room Lock holds Participants from Start through the Tag Round", () => {
  const counting = drive([
    { type: "raise", playerId: "a" },
    { type: "join", playerId: "b" },
    { type: "start", playerId: "a", nowMs: 1_000 },
  ]);
  assert.equal(counting.phase, "countdown");
  assert.equal(participantRoomLocked(counting, "a"), true);
  assert.equal(participantRoomLocked(counting, "b"), true);
  assert.equal(participantRoomLocked(counting, "c"), false);

  const playing = startRound();
  assert.equal(playing.phase, "playing");
  assert.equal(participantRoomLocked(playing, "a"), true);
  assert.equal(participantRoomLocked(playing, "c"), true);
});

test("Tag Room Lock lifts on the result linger", () => {
  const playing = startRound();
  const ended = reduceTag(
    playing,
    {
      type: "tick",
      nowMs: playing.roundEndsAtMs,
      poses: {},
      walkable: WALKABLE,
      rng: () => 0,
    },
    CFG
  );
  assert.equal(ended.phase, "result");
  assert.equal(participantRoomLocked(ended, "a"), false);
  assert.equal(participantRoomLocked(ended, "b"), false);
});
