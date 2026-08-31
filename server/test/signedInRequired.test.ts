import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SIGNED_IN_REQUIRED_MESSAGE,
  isUnauthenticatedFailure,
} from "../src/signedInRequired.js";

test("Sign-in Gate copy names the missing session, not a load failure", () => {
  assert.equal(
    SIGNED_IN_REQUIRED_MESSAGE,
    "You must be signed in to perform this action."
  );
  assert.equal(SIGNED_IN_REQUIRED_MESSAGE.includes("Could not load"), false);
});

test("401 and unauthorized codes are unauthenticated failures", () => {
  assert.equal(isUnauthenticatedFailure(401), true);
  assert.equal(isUnauthenticatedFailure(200, "unauthorized"), true);
  assert.equal(isUnauthenticatedFailure(403), false);
  assert.equal(isUnauthenticatedFailure(503, "backend_unavailable"), false);
  assert.equal(isUnauthenticatedFailure(500, "not_signed_in"), true);
});