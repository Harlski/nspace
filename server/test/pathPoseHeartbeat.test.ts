import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPoseHeartbeatOutMsg,
  buildPoseHeartbeatPlayer,
  heartbeatDue,
  heartbeatWalkingState,
  PATH_POSE_HEARTBEAT_MS,
} from "../src/pathPoseHeartbeat.js";

test("heartbeatDue is true on first sample and after the interval", () => {
  assert.equal(heartbeatDue({ nowMs: 1000, lastHeartbeatAtMs: null }), true);
  assert.equal(
    heartbeatDue({
      nowMs: 1000,
      lastHeartbeatAtMs: 1000,
    }),
    false
  );
  assert.equal(
    heartbeatDue({
      nowMs: 1000 + PATH_POSE_HEARTBEAT_MS,
      lastHeartbeatAtMs: 1000,
    }),
    true
  );
});

test("heartbeatWalkingState includes in-flight grid walkers and ~1s after drain", () => {
  assert.deepEqual(
    heartbeatWalkingState({
      pathQueueLength: 2,
      pathDrainedAtMs: null,
      nowMs: 5000,
      isFieldFreeMove: false,
    }),
    { include: true, walking: true }
  );
  assert.deepEqual(
    heartbeatWalkingState({
      pathQueueLength: 0,
      pathDrainedAtMs: 4500,
      nowMs: 5000,
      isFieldFreeMove: false,
    }),
    { include: true, walking: false }
  );
  assert.deepEqual(
    heartbeatWalkingState({
      pathQueueLength: 0,
      pathDrainedAtMs: 3000,
      nowMs: 5000,
      isFieldFreeMove: false,
    }),
    { include: false, walking: false }
  );
  assert.deepEqual(
    heartbeatWalkingState({
      pathQueueLength: 2,
      pathDrainedAtMs: null,
      nowMs: 5000,
      isFieldFreeMove: true,
    }),
    { include: false, walking: false }
  );
});

test("buildPoseHeartbeatOutMsg is null for an empty roster", () => {
  assert.equal(buildPoseHeartbeatOutMsg([]), null);
  const msg = buildPoseHeartbeatOutMsg([
    buildPoseHeartbeatPlayer({
      address: "NQ97 TEST",
      pose: { x: 1, y: 0, z: 2, vx: 5, vz: 0 },
      walkId: 4,
      walking: true,
      serverNowMs: 9,
    }),
  ]);
  assert.ok(msg);
  assert.equal(msg.type, "poseHeartbeat");
  assert.equal(msg.players[0]!.walkId, 4);
  assert.equal(msg.players[0]!.walking, true);
});
