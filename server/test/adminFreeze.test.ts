import assert from "node:assert/strict";
import test from "node:test";
import {
  frozenCueVisibleToViewer,
  mayFreezeTarget,
  movementBlockedByFreeze,
} from "../src/adminFreeze.js";

test("mayFreezeTarget: admin may freeze non-admin other; denies self and admin peers", () => {
  assert.equal(
    mayFreezeTarget({
      actorIsGameAdmin: true,
      actorAddress: "A",
      targetAddress: "B",
      targetIsGameAdmin: false,
    }),
    true
  );
  assert.equal(
    mayFreezeTarget({
      actorIsGameAdmin: true,
      actorAddress: "A",
      targetAddress: "A",
      targetIsGameAdmin: false,
    }),
    false
  );
  assert.equal(
    mayFreezeTarget({
      actorIsGameAdmin: true,
      actorAddress: "A",
      targetAddress: "B",
      targetIsGameAdmin: true,
    }),
    false
  );
  assert.equal(
    mayFreezeTarget({
      actorIsGameAdmin: false,
      actorAddress: "A",
      targetAddress: "B",
      targetIsGameAdmin: false,
    }),
    false
  );
});

test("movementBlockedByFreeze only when frozen", () => {
  assert.equal(movementBlockedByFreeze(true), true);
  assert.equal(movementBlockedByFreeze(false), false);
});

test("frozenCueVisibleToViewer is admin-only", () => {
  assert.equal(frozenCueVisibleToViewer(true), true);
  assert.equal(frozenCueVisibleToViewer(false), false);
});
