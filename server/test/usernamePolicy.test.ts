import assert from "node:assert/strict";
import test from "node:test";
import { usernameAssignmentError } from "../src/usernamePolicy.js";

test("usernameAssignmentError allows ordinary names", () => {
  assert.equal(usernameAssignmentError("Player1"), null);
  assert.equal(usernameAssignmentError("classic"), null);
  assert.equal(usernameAssignmentError("assassin"), null);
});

test("usernameAssignmentError rejects reserved staff names", () => {
  assert.equal(usernameAssignmentError("admin"), "username_restricted");
  assert.equal(usernameAssignmentError("Nimiq"), "username_restricted");
  assert.equal(usernameAssignmentError("MOD"), "username_restricted");
});

test("usernameAssignmentError rejects profanity", () => {
  assert.equal(usernameAssignmentError("shit"), "username_profanity");
});

test("usernameAssignmentError rejects invalid format", () => {
  assert.equal(usernameAssignmentError(""), "invalid_username");
  assert.equal(usernameAssignmentError("bad name"), "invalid_username");
  assert.equal(usernameAssignmentError("waytoolongname"), "invalid_username");
});
