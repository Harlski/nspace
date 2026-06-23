import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateRedeem,
  evaluatePeek,
  getParticipant,
  reduceInvite,
  sanitizeGuestNickname,
} from "../src/directInvite/reducer.js";
import type { DirectInviteRecord, InviteEvent } from "../src/directInvite/types.js";
import {
  _resetInviteStoreForTests,
  createInvite,
  generateInviteSlug,
  joinInviteAsWallet,
} from "../src/directInvite/store.js";
import { PLAY_SPACE_SLUG_LENGTH } from "../src/directInvite/config.js";

const CFG = { ttlMs: 900_000 };

function drive(events: InviteEvent[]): DirectInviteRecord | null {
  return events.reduce(
    (s, e) => reduceInvite(s, e, CFG),
    null as DirectInviteRecord | null
  );
}

/** capacity 3 ⇒ host + 2 guests. */
const CREATE: InviteEvent = {
  type: "create",
  hostWallet: "NQHost123",
  hostOriginRoomId: "hub",
  slug: "abc12345",
  lobbyRoomId: "invite-lobby-abc12345",
  nowMs: 1_000_000,
  ttlMs: CFG.ttlMs,
  activity: "worldcup-match",
  capacity: 3,
  templateId: "template-default-test",
};

test("create → open Play Space with no guests yet", () => {
  const s = drive([CREATE]);
  assert.ok(s);
  assert.equal(s!.phase, "open");
  assert.equal(s!.expiresAtMs, 1_000_000 + CFG.ttlMs);
  assert.equal(s!.hostInLobby, true);
  assert.equal(s!.participants.length, 0);
  assert.equal(s!.capacity, 3);
});

test("multiple distinct guests can claim; reclaim is idempotent", () => {
  let s = drive([
    CREATE,
    { type: "claim", guestId: "guest-a", nowMs: 1_000_100 },
    { type: "claim", guestId: "guest-b", nowMs: 1_000_200 },
  ]);
  assert.equal(s!.participants.length, 2);
  assert.deepEqual(
    s!.participants.map((p) => p.guestId),
    ["guest-a", "guest-b"]
  );

  // Reclaim by an existing guest does not add a duplicate.
  s = reduceInvite(s, { type: "claim", guestId: "guest-a", nowMs: 1_000_300 }, CFG);
  assert.equal(s!.participants.length, 2);
});

test("claim past capacity is gated by evaluateRedeem (full)", () => {
  const s = drive([
    CREATE,
    { type: "claim", guestId: "guest-a", nowMs: 1_000_100 },
    { type: "claim", guestId: "guest-b", nowMs: 1_000_200 },
  ])!;
  // capacity 3 ⇒ 2 guest slots already taken.
  assert.deepEqual(evaluateRedeem(s, "guest-c", 1_000_300), {
    ok: false,
    code: "full",
  });
  // An existing guest may still reclaim even when full.
  assert.deepEqual(evaluateRedeem(s, "guest-a", 1_000_300), {
    ok: true,
    invite: s,
  });
});

test("nickname + lobby-join + wallet upgrade land on the right participant", () => {
  const s = drive([
    CREATE,
    { type: "claim", guestId: "guest-a", nowMs: 1_000_100 },
    { type: "setNickname", guestId: "guest-a", nickname: "Swift Fox" },
    { type: "guestJoinedLobby", guestId: "guest-a" },
    { type: "upgradeWallet", guestId: "guest-a", wallet: "NQGuestWallet" },
  ])!;
  const p = getParticipant(s, "guest-a")!;
  assert.equal(p.displayName, "Swift Fox");
  assert.equal(p.joinedLobby, true);
  assert.equal(p.wallet, "NQGuestWallet");
  assert.equal(sanitizeGuestNickname("a"), null);
  assert.equal(sanitizeGuestNickname("Valid Name"), "Valid Name");
});

test("removeParticipant frees a slot", () => {
  let s = drive([
    CREATE,
    { type: "claim", guestId: "guest-a", nowMs: 1_000_100 },
    { type: "claim", guestId: "guest-b", nowMs: 1_000_200 },
  ])!;
  s = reduceInvite(s, { type: "removeParticipant", guestId: "guest-a" }, CFG)!;
  assert.equal(s.participants.length, 1);
  assert.equal(getParticipant(s, "guest-a"), null);
  // The freed slot is claimable again.
  assert.equal(evaluateRedeem(s, "guest-c", 1_000_400).ok, true);
});

test("host can leave and re-enter the lobby", () => {
  let s = drive([CREATE, { type: "hostLeftLobby" }])!;
  assert.equal(s.hostInLobby, false);
  s = reduceInvite(s, { type: "hostJoinedLobby" }, CFG)!;
  assert.equal(s.hostInLobby, true);
});

test("open Play Space stays redeemable past creation TTL", () => {
  const open = drive([CREATE])!;
  assert.deepEqual(evaluateRedeem(open, "guest-a", open.expiresAtMs + 60_000), {
    ok: true,
    invite: open,
  });
});

test("close + expire are terminal and reject redeem", () => {
  const open = drive([CREATE])!;

  const closed = reduceInvite(open, { type: "close" }, CFG)!;
  assert.equal(closed.phase, "closed");
  assert.deepEqual(evaluateRedeem(closed, "guest-a", 1_000_500), {
    ok: false,
    code: "closed",
  });

  const expired = reduceInvite(
    open,
    { type: "tick", nowMs: open.expiresAtMs + 1 },
    CFG
  )!;
  assert.equal(expired.phase, "expired");
  assert.deepEqual(evaluateRedeem(expired, "guest-a", open.expiresAtMs + 1), {
    ok: false,
    code: "expired",
  });
});

test("claim/remove are ignored once terminal", () => {
  const closed = reduceInvite(drive([CREATE]), { type: "close" }, CFG)!;
  const after = reduceInvite(
    closed,
    { type: "claim", guestId: "guest-a", nowMs: 1_000_600 },
    CFG
  )!;
  assert.equal(after.participants.length, 0);
});

test("evaluatePeek reports joinability without claiming", () => {
  const open = drive([CREATE])!;
  assert.deepEqual(evaluatePeek(open, null, 1_000_100), {
    ok: true,
    invite: open,
    reclaimable: false,
  });
  const full = drive([
    CREATE,
    { type: "claim", guestId: "guest-a", nowMs: 1_000_100 },
    { type: "claim", guestId: "guest-b", nowMs: 1_000_200 },
  ])!;
  assert.deepEqual(evaluatePeek(full, "guest-c", 1_000_300), {
    ok: false,
    code: "full",
  });
  assert.deepEqual(evaluatePeek(full, "guest-a", 1_000_300), {
    ok: true,
    invite: full,
    reclaimable: true,
  });
  const closed = reduceInvite(open, { type: "close" }, CFG)!;
  assert.deepEqual(evaluatePeek(closed, null, 1_000_400), {
    ok: false,
    code: "closed",
  });
});

test("generateInviteSlug is alphanumeric mixed case", () => {
  _resetInviteStoreForTests();
  for (let i = 0; i < 40; i++) {
    const slug = generateInviteSlug();
    assert.equal(slug.length, PLAY_SPACE_SLUG_LENGTH);
    assert.match(slug, /^[A-Za-z0-9]+$/);
  }
});

test("joinInviteAsWallet claims, links wallet, and sets display name", () => {
  _resetInviteStoreForTests();
  const invite = createInvite({
    hostWallet: "NQHost123",
    hostOriginRoomId: "hub",
    activity: "worldcup-match",
    templateId: "template-test",
    nowMs: 1_000_000,
  });
  const joined = joinInviteAsWallet(
    invite.slug,
    "guest-a",
    "NQGuestWallet",
    "Player One"
  );
  assert.equal(joined.ok, true);
  if (!joined.ok) return;
  const p = getParticipant(joined.invite, "guest-a")!;
  assert.equal(p.wallet, "NQGuestWallet");
  assert.equal(p.displayName, "Player One");
});
