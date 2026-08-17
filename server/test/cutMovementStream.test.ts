import assert from "node:assert/strict";
import test from "node:test";
import {
  cutMovementStreamEligible,
  presenceDeltaPlayers,
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

test("presence delta for an active grid walker omits pose", () => {
  const walker = player({
    x: 4.2,
    z: 1,
    vx: 5,
    vz: 0,
    chatTyping: true,
  });
  const out = presenceDeltaPlayers({
    enabled: true,
    subjects: [
      {
        player: walker,
        pathQueueLength: 3,
        isFieldFreeMove: false,
      },
    ],
  });
  assert.equal(out.length, 1);
  assert.equal(out[0]!.chatTyping, true);
  assert.equal(out[0]!.address, walker.address);
  assert.equal("x" in out[0]!, false);
  assert.equal("y" in out[0]!, false);
  assert.equal("z" in out[0]!, false);
  assert.equal("vx" in out[0]!, false);
  assert.equal("vz" in out[0]!, false);
});

test("presence delta for an idle player keeps pose", () => {
  const idle = player({ x: 2, z: 3, chatTyping: true });
  const out = presenceDeltaPlayers({
    enabled: true,
    subjects: [
      {
        player: idle,
        pathQueueLength: 0,
        isFieldFreeMove: false,
      },
    ],
  });
  assert.equal(out.length, 1);
  assert.equal(out[0]!.x, 2);
  assert.equal(out[0]!.z, 3);
  assert.equal(out[0]!.chatTyping, true);
});

test("presence delta is only the subject players, never a full roster", () => {
  const typing = player({ address: "NQ01", chatTyping: true });
  const out = presenceDeltaPlayers({
    enabled: true,
    subjects: [
      {
        player: typing,
        pathQueueLength: 0,
        isFieldFreeMove: false,
      },
    ],
  });
  assert.equal(out.length, 1);
  assert.equal(out[0]!.address, "NQ01");
});

test("presence delta on a worldcup field walker still includes pose", () => {
  const walker = player({ x: 8, z: 2, vx: 2, chatTyping: true });
  const out = presenceDeltaPlayers({
    enabled: true,
    subjects: [
      {
        player: walker,
        pathQueueLength: 1,
        isFieldFreeMove: true,
      },
    ],
  });
  assert.equal(out[0]!.x, 8);
  assert.equal(out[0]!.z, 2);
});
