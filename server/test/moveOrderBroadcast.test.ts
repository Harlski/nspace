import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMoveOrderOutMsg,
  shouldEmitMoveOrder,
} from "../src/moveOrderBroadcast.js";

test("shouldEmitMoveOrder requires flag and a non-empty path queue", () => {
  assert.equal(
    shouldEmitMoveOrder({
      enabled: true,
      pathQueueLength: 3,
    }),
    true
  );
  assert.equal(
    shouldEmitMoveOrder({
      enabled: true,
      pathQueueLength: 1,
    }),
    true
  );
  assert.equal(
    shouldEmitMoveOrder({
      enabled: false,
      pathQueueLength: 3,
    }),
    false
  );
  assert.equal(
    shouldEmitMoveOrder({
      enabled: true,
      pathQueueLength: 0,
    }),
    false
  );
});

test("buildMoveOrderOutMsg copies path and uses server-owned timing fields", () => {
  const pathQueue = [
    { x: 3, z: 4, layer: 0 as const },
    { x: 7, z: 4, layer: 1 as const },
  ];
  const msg = buildMoveOrderOutMsg({
    address: "NQ97 TEST",
    pathQueue,
    startX: 2.1,
    startZ: 4,
    startAtMs: 1_720_000_000_000,
    speed: 5,
  });

  assert.equal(msg.type, "moveOrder");
  assert.equal(msg.address, "NQ97 TEST");
  assert.deepEqual(msg.path, pathQueue);
  assert.notEqual(msg.path, pathQueue);
  assert.equal(msg.startX, 2.1);
  assert.equal(msg.startZ, 4);
  assert.equal(msg.startAtMs, 1_720_000_000_000);
  assert.equal(msg.speed, 5);
});
