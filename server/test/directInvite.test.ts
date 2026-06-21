import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateRedeem,
  reduceInvite,
  sanitizeGuestNickname,
} from "../src/directInvite/reducer.js";
import type { DirectInviteRecord, InviteEvent } from "../src/directInvite/types.js";

const CFG = { ttlMs: 900_000 };

function drive(events: InviteEvent[]): DirectInviteRecord | null {
  return events.reduce(
    (s, e) => reduceInvite(s, e, CFG),
    null as DirectInviteRecord | null
  );
}

const CREATE: InviteEvent = {
  type: "create",
  hostWallet: "NQHost123",
  hostOriginRoomId: "hub",
  slug: "abc12345",
  lobbyRoomId: "invite-lobby-abc12345",
  nowMs: 1_000_000,
  ttlMs: CFG.ttlMs,
  activity: "worldcup-match",
};

test("create → open with future expiresAtMs", () => {
  const s = drive([CREATE]);
  assert.ok(s);
  assert.equal(s!.phase, "open");
  assert.equal(s!.expiresAtMs, 1_000_000 + CFG.ttlMs);
  assert.equal(s!.hostInLobby, true);
  assert.equal(s!.guestId, null);
});

test("claim → claimed with guestId; second distinct guestId rejected", () => {
  const s = drive([
    CREATE,
    { type: "claim", guestId: "guest-a", nowMs: 1_000_100 },
  ]);
  assert.equal(s!.phase, "claimed");
  assert.equal(s!.guestId, "guest-a");

  const rejected = reduceInvite(
    s,
    { type: "claim", guestId: "guest-b", nowMs: 1_000_200 },
    CFG
  );
  assert.equal(rejected!.guestId, "guest-a");
  assert.equal(rejected!.phase, "claimed");
});

test("reclaim with same guestId allowed in claimed and lobby", () => {
  let s = drive([
    CREATE,
    { type: "claim", guestId: "guest-a", nowMs: 1_000_100 },
    { type: "reclaim", guestId: "guest-a" },
  ]);
  assert.equal(s!.phase, "claimed");

  s = reduceInvite(
    s,
    { type: "guestJoinedLobby", guestId: "guest-a" },
    CFG
  );
  assert.equal(s!.phase, "lobby");

  s = reduceInvite(s, { type: "reclaim", guestId: "guest-a" }, CFG);
  assert.equal(s!.phase, "lobby");
});

test("nickname commit stores sanitized name", () => {
  const s = drive([
    CREATE,
    { type: "claim", guestId: "guest-a", nowMs: 1_000_100 },
    { type: "setNickname", guestId: "guest-a", nickname: "Swift Fox" },
  ]);
  assert.equal(s!.guestDisplayName, "Swift Fox");
  assert.equal(sanitizeGuestNickname("a"), null);
  assert.equal(sanitizeGuestNickname("Valid Name"), "Valid Name");
});

test("wallet upgrade sets guestWallet and preserves guestId", () => {
  const s = drive([
    CREATE,
    { type: "claim", guestId: "guest-a", nowMs: 1_000_100 },
    { type: "upgradeWallet", guestId: "guest-a", wallet: "NQGuestWallet" },
  ]);
  assert.equal(s!.guestId, "guest-a");
  assert.equal(s!.guestWallet, "NQGuestWallet");
});

test("both in lobby → lobby; host Start → starting", () => {
  const s = drive([
    CREATE,
    { type: "claim", guestId: "guest-a", nowMs: 1_000_100 },
    { type: "guestJoinedLobby", guestId: "guest-a" },
    { type: "hostStart" },
  ]);
  assert.equal(s!.phase, "starting");
});

test("cancel / expire transitions", () => {
  const open = drive([CREATE]);
  const cancelled = reduceInvite(
    open,
    { type: "cancel", by: "host" },
    CFG
  );
  assert.equal(cancelled!.phase, "cancelled");

  const expired = reduceInvite(
    open,
    { type: "tick", nowMs: open!.expiresAtMs + 1 },
    CFG
  );
  assert.equal(expired!.phase, "expired");
});

test("redeem after cancel or expire rejected", () => {
  const open = drive([CREATE])!;
  const cancelled = reduceInvite(
    open,
    { type: "cancel", by: "host" },
    CFG
  )!;
  assert.deepEqual(evaluateRedeem(cancelled, null, 1_000_500), {
    ok: false,
    code: "cancelled",
  });

  const expired = reduceInvite(
    open,
    { type: "tick", nowMs: open.expiresAtMs + 1 },
    CFG
  )!;
  assert.deepEqual(evaluateRedeem(expired, null, open.expiresAtMs + 1), {
    ok: false,
    code: "expired",
  });
});

test("evaluateRedeem rejects slot taken by another guest", () => {
  const s = drive([
    CREATE,
    { type: "claim", guestId: "guest-a", nowMs: 1_000_100 },
  ])!;
  assert.deepEqual(evaluateRedeem(s, "guest-b", 1_000_200), {
    ok: false,
    code: "slot_taken",
  });
  assert.deepEqual(evaluateRedeem(s, "guest-a", 1_000_200), {
    ok: true,
    invite: s,
  });
});

test("tick past expiresAtMs expires from any non-terminal phase", () => {
  const s = drive([
    CREATE,
    { type: "claim", guestId: "guest-a", nowMs: 1_000_100 },
    { type: "guestJoinedLobby", guestId: "guest-a" },
  ])!;
  const expired = reduceInvite(
    s,
    { type: "tick", nowMs: s.expiresAtMs + 1 },
    CFG
  );
  assert.equal(expired!.phase, "expired");
});
