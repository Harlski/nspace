import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMoveAbortFromPlayer,
  buildMoveAbortOutMsg,
  shouldEmitMoveAbort,
} from "../src/moveAbortBroadcast.js";

test("shouldEmitMoveAbort requires flag and an invalidated path or pose correction", () => {
  assert.equal(
    shouldEmitMoveAbort({ enabled: true, hadPathQueue: true }),
    true
  );
  assert.equal(
    shouldEmitMoveAbort({ enabled: true, hadPathQueue: false, poseCorrection: true }),
    true
  );
  assert.equal(
    shouldEmitMoveAbort({ enabled: true, hadPathQueue: false }),
    false
  );
  assert.equal(
    shouldEmitMoveAbort({ enabled: false, hadPathQueue: true }),
    false
  );
});

test("buildMoveAbortOutMsg carries authoritative pose and velocity", () => {
  const msg = buildMoveAbortOutMsg({
    address: "NQ97 TEST",
    x: 5,
    z: 4,
    y: 1.2,
    vx: 0,
    vz: 0,
  });
  assert.equal(msg.type, "moveAbort");
  assert.equal(msg.address, "NQ97 TEST");
  assert.equal(msg.x, 5);
  assert.equal(msg.z, 4);
  assert.equal(msg.y, 1.2);
  assert.equal(msg.vx, 0);
  assert.equal(msg.vz, 0);
});

test("buildMoveAbortFromPlayer defaults missing velocity to zero", () => {
  const msg = buildMoveAbortFromPlayer({
    address: "NQ97 TEST",
    player: { x: 2, y: 0, z: 3 },
  });
  assert.equal(msg.vx, 0);
  assert.equal(msg.vz, 0);
});
