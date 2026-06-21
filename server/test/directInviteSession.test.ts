import assert from "node:assert/strict";
import test from "node:test";

import {
  signGuestSession,
  signUpgradedGuestSession,
  verifySession,
} from "../src/auth.js";

const SECRET = "test-secret-for-guest-sessions";

test("mint guest JWT → verify → claims present", () => {
  const token = signGuestSession("gid-1", "Swift Fox", SECRET, {
    inviteSlug: "abc123",
    ttlSec: 3600,
  });
  const payload = verifySession(token, SECRET);
  assert.equal(payload.guest, true);
  assert.equal(payload.guestId, "gid-1");
  assert.equal(payload.displayName, "Swift Fox");
  assert.equal(payload.inviteSlug, "abc123");
  assert.equal(payload.sub, "guest:gid-1");
});

test("upgrade re-issue contains wallet + original guestId", () => {
  const token = signUpgradedGuestSession(
    "gid-1",
    "NQGuestWallet",
    "Swift Fox",
    SECRET,
    { inviteSlug: "abc123" }
  );
  const payload = verifySession(token, SECRET);
  assert.equal(payload.guestId, "gid-1");
  assert.equal(payload.upgradedWallet, "NQGuestWallet");
  assert.equal(payload.sub, "guest:gid-1");
});
