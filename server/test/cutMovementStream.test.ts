import assert from "node:assert/strict";
import test from "node:test";
import {
  cutMovementStreamEligible,
  shouldIncludeInTickStateDelta,
  type TickPlayerSnapshot,
} from "../src/cutMovementStream.js";

function player(overrides: Partial<TickPlayerSnapshot> = {}): TickPlayerSnapshot {
  return {
    address: "NQ97 TEST",
    displayName: "Walker",
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vz: 0,
    ...overrides,
  };
}

test("cutMovementStreamEligible requires flag, active path, and non-field room", () => {
  assert.equal(
    cutMovementStreamEligible({
      enabled: true,
      pathQueueLength: 2,
      isFieldFreeMove: false,
    }),
    true
  );
  assert.equal(
    cutMovementStreamEligible({
      enabled: false,
      pathQueueLength: 2,
      isFieldFreeMove: false,
    }),
    false
  );
  assert.equal(
    cutMovementStreamEligible({
      enabled: true,
      pathQueueLength: 0,
      isFieldFreeMove: false,
    }),
    false
  );
  assert.equal(
    cutMovementStreamEligible({
      enabled: true,
      pathQueueLength: 2,
      isFieldFreeMove: true,
    }),
    false
  );
});

test("shouldIncludeInTickStateDelta omits movement-only changes for eligible walkers", () => {
  const prev = player({ x: 0, z: 0, vx: 1, vz: 0 });
  const next = player({ x: 0.4, z: 0, vx: 1, vz: 0 });
  const decision = shouldIncludeInTickStateDelta({
    enabled: true,
    pathQueueLength: 3,
    isFieldFreeMove: false,
    prev,
    next,
  });
  assert.equal(decision.include, false);
  assert.equal(decision.suppressedMovementOnly, true);
});

test("shouldIncludeInTickStateDelta still includes non-movement changes during path walk", () => {
  const prev = player({ x: 0, z: 0, chatTyping: false });
  const next = player({ x: 0.4, z: 0, chatTyping: true });
  const decision = shouldIncludeInTickStateDelta({
    enabled: true,
    pathQueueLength: 3,
    isFieldFreeMove: false,
    prev,
    next,
  });
  assert.equal(decision.include, true);
  assert.equal(decision.suppressedMovementOnly, false);
});

test("shouldIncludeInTickStateDelta keeps worldcup field free-move on normal movement deltas", () => {
  const prev = player({ x: 0, z: 0, vx: 2, vz: 0 });
  const next = player({ x: 0.5, z: 0, vx: 2, vz: 0 });
  const decision = shouldIncludeInTickStateDelta({
    enabled: true,
    pathQueueLength: 1,
    isFieldFreeMove: true,
    prev,
    next,
  });
  assert.equal(decision.include, true);
  assert.equal(decision.suppressedMovementOnly, false);
});

test("shouldIncludeInTickStateDelta is unchanged when flag is off", () => {
  const prev = player({ x: 0, z: 0 });
  const next = player({ x: 0.5, z: 0, vx: 1, vz: 0 });
  const decision = shouldIncludeInTickStateDelta({
    enabled: false,
    pathQueueLength: 3,
    isFieldFreeMove: false,
    prev,
    next,
  });
  assert.equal(decision.include, true);
  assert.equal(decision.suppressedMovementOnly, false);
});
