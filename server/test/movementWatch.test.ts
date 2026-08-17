import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMovementWatchAcceptedClick,
  buildMovementWatchActive,
  buildMovementWatchClear,
  buildMovementWatchRejectedClick,
  buildMovementWatchSnapshot,
  buildMovementWatchWalkFromConn,
  canSubscribeMovementWatch,
  countMovementWatchSubscribers,
  filterMovementWatchRecipients,
  movementWatchDestKey,
  noteMovementWatchMarkerShown,
  parseMovementWatchClientIntentReason,
  shouldShowMovementWatchMarker,
  takeMovementWatchClickInterval,
  clearMovementWatchClickInterval,
  resetMovementWatchClickInterval,
  type MovementWatchClickThrottleState,
} from "../src/movementWatch.js";

test("canSubscribeMovementWatch requires admin wallet", () => {
  assert.equal(canSubscribeMovementWatch(true), true);
  assert.equal(canSubscribeMovementWatch(false), false);
});

test("shouldShowMovementWatchMarker fires on dest change and respects min interval", () => {
  const throttle: MovementWatchClickThrottleState = {
    lastMarkerKey: null,
    lastMarkerAtMs: 0,
  };
  const keyA = movementWatchDestKey(1, 2, 0, "accept");
  assert.equal(
    shouldShowMovementWatchMarker({
      throttle,
      destKey: keyA,
      nowMs: 1000,
      minIntervalMs: 120,
    }),
    true
  );
  noteMovementWatchMarkerShown(throttle, keyA, 1000);

  assert.equal(
    shouldShowMovementWatchMarker({
      throttle,
      destKey: keyA,
      nowMs: 1050,
      minIntervalMs: 120,
    }),
    false
  );
  assert.equal(
    shouldShowMovementWatchMarker({
      throttle,
      destKey: keyA,
      nowMs: 1200,
      minIntervalMs: 120,
    }),
    true
  );

  const keyB = movementWatchDestKey(3, 2, 0, "accept");
  assert.equal(
    shouldShowMovementWatchMarker({
      throttle,
      destKey: keyB,
      nowMs: 1050,
      minIntervalMs: 120,
    }),
    true
  );
});

test("buildMovementWatchWalkFromConn returns null when idle", () => {
  assert.equal(
    buildMovementWatchWalkFromConn({
      address: "NQ01",
      displayName: "Ada",
      player: { x: 0, z: 0 },
      pathQueue: [],
      pathMoveStartAtMs: null,
      nowMs: 1,
    }),
    null
  );
});

test("buildMovementWatchWalkFromConn uses final waypoint as goal", () => {
  const walk = buildMovementWatchWalkFromConn({
    address: "NQ01",
    displayName: "Ada",
    player: { x: 1.2, z: 3.4 },
    pathQueue: [
      { x: 2, z: 3, layer: 0 },
      { x: 5, z: 3, layer: 1 },
    ],
    pathMoveStartAtMs: 99,
    nowMs: 100,
    speed: 4,
  });
  assert.ok(walk);
  assert.equal(walk!.goalX, 5);
  assert.equal(walk!.goalZ, 3);
  assert.equal(walk!.goalLayer, 1);
  assert.equal(walk!.startAtMs, 99);
  assert.equal(walk!.speed, 4);
  assert.equal(walk!.path.length, 2);
});

test("accepted click copies path; rejected carries reason", () => {
  const ok = buildMovementWatchAcceptedClick({
    address: "NQ01",
    displayName: "Ada",
    x: 5,
    z: 3,
    layer: 0,
    showMarker: true,
    pathQueue: [{ x: 5, z: 3, layer: 0 }],
    startX: 1,
    startZ: 3,
    startAtMs: 10,
  });
  assert.equal(ok.type, "movementWatchClick");
  assert.equal(ok.accepted, true);
  assert.equal(ok.showMarker, true);
  assert.equal(ok.clickIntervalSec, undefined);
  assert.deepEqual(ok.path, [{ x: 5, z: 3, layer: 0 }]);

  const bad = buildMovementWatchRejectedClick({
    address: "NQ01",
    displayName: "Ada",
    x: 9,
    z: 9,
    layer: 0,
    reason: "rate_limited",
    showMarker: true,
  });
  assert.equal(bad.accepted, false);
  assert.equal(bad.reason, "rate_limited");
  assert.equal(bad.path, undefined);
  assert.equal(bad.clickIntervalSec, undefined);
});

test("Click Marker messages carry Click Interval when provided", () => {
  const ok = buildMovementWatchAcceptedClick({
    address: "NQ01",
    displayName: "Ada",
    x: 5,
    z: 3,
    layer: 0,
    showMarker: true,
    pathQueue: [{ x: 5, z: 3, layer: 0 }],
    startX: 1,
    startZ: 3,
    startAtMs: 10,
    clickIntervalSec: 2.43,
  });
  assert.equal(ok.clickIntervalSec, 2.43);

  const bad = buildMovementWatchRejectedClick({
    address: "NQ01",
    displayName: "Ada",
    x: 9,
    z: 9,
    layer: 0,
    reason: "mine",
    showMarker: true,
    clickIntervalSec: 8,
  });
  assert.equal(bad.clickIntervalSec, 8);
});

test("snapshot deep-copies walks; clear is address-only", () => {
  const path = [{ x: 1, z: 2, layer: 0 as const }];
  const snap = buildMovementWatchSnapshot({
    walks: [
      {
        address: "NQ01",
        displayName: "Ada",
        goalX: 1,
        goalZ: 2,
        goalLayer: 0,
        path,
        startX: 0,
        startZ: 0,
        startAtMs: 1,
        speed: 5,
      },
    ],
  });
  assert.equal(snap.type, "movementWatchSnapshot");
  assert.notEqual(snap.walks[0]!.path, path);
  assert.deepEqual(buildMovementWatchClear("NQ01"), {
    type: "movementWatchClear",
    address: "NQ01",
  });
});

test("parseMovementWatchClientIntentReason allows client-only reasons", () => {
  assert.equal(parseMovementWatchClientIntentReason("no_path"), "no_path");
  assert.equal(parseMovementWatchClientIntentReason("mine"), "mine");
  assert.equal(parseMovementWatchClientIntentReason("mine_empty"), "mine_empty");
  assert.equal(parseMovementWatchClientIntentReason("rate_limited"), null);
  assert.equal(parseMovementWatchClientIntentReason("bogus"), null);
});

test("countMovementWatchSubscribers counts enabled flags", () => {
  assert.equal(
    countMovementWatchSubscribers([
      { movementWatch: true },
      { movementWatch: false },
      {},
      { movementWatch: true },
    ]),
    2
  );
});

test("filterMovementWatchRecipients keeps only subscribed conns", () => {
  const list = filterMovementWatchRecipients([
    { movementWatch: true, id: "a" },
    { movementWatch: false, id: "b" },
    { id: "c" },
    { movementWatch: true, id: "d" },
  ]);
  assert.deepEqual(
    list.map((c) => c.id),
    ["a", "d"]
  );
});

test("buildMovementWatchActive toggles room peer reporting", () => {
  assert.deepEqual(buildMovementWatchActive(true), {
    type: "movementWatchActive",
    active: true,
  });
  assert.deepEqual(buildMovementWatchActive(false), {
    type: "movementWatchActive",
    active: false,
  });
});

test("first shown Click Marker has no Click Interval", () => {
  const state = new Map<string, number>();
  assert.equal(takeMovementWatchClickInterval(state, "NQ01", 1000), undefined);
});

test("second shown Click Marker carries Click Interval in seconds", () => {
  const state = new Map<string, number>();
  takeMovementWatchClickInterval(state, "NQ01", 1000);
  assert.equal(takeMovementWatchClickInterval(state, "NQ01", 3430), 2.43);
});

test("Click Interval is per player address", () => {
  const state = new Map<string, number>();
  takeMovementWatchClickInterval(state, "NQ01", 1000);
  takeMovementWatchClickInterval(state, "NQ02", 2000);
  assert.equal(takeMovementWatchClickInterval(state, "NQ01", 3430), 2.43);
  assert.equal(takeMovementWatchClickInterval(state, "NQ02", 10000), 8);
});

test("clearing an address blanks the next Click Interval", () => {
  const state = new Map<string, number>();
  takeMovementWatchClickInterval(state, "NQ01", 1000);
  takeMovementWatchClickInterval(state, "NQ01", 3430);
  clearMovementWatchClickInterval(state, "NQ01");
  assert.equal(takeMovementWatchClickInterval(state, "NQ01", 5000), undefined);
});

test("reset blanks every player's Click Interval", () => {
  const state = new Map<string, number>();
  takeMovementWatchClickInterval(state, "NQ01", 1000);
  takeMovementWatchClickInterval(state, "NQ02", 2000);
  resetMovementWatchClickInterval(state);
  assert.equal(takeMovementWatchClickInterval(state, "NQ01", 5000), undefined);
  assert.equal(takeMovementWatchClickInterval(state, "NQ02", 5000), undefined);
});
