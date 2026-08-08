import assert from "node:assert/strict";
import test from "node:test";
import { haltPathVelocity } from "../src/pathHalt.js";

test("haltPathVelocity zeros leftover mid-walk velocity", () => {
  const player = { vx: 5, vz: -2.5 };
  haltPathVelocity(player);
  assert.equal(player.vx, 0);
  assert.equal(player.vz, 0);
});
