import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mining-challenge-"));
process.env.MINING_CHALLENGE_STORE_FILE = path.join(dir, "mining-challenges.json");
process.env.MODERATION_STORE_FILE = path.join(dir, "moderation.json");
process.env.ADMIN_RUNTIME_SETTINGS_FILE = path.join(dir, "admin-runtime-settings.json");

const ADMIN = "NQ97 4M1T 4TGD VC7F LHLQ Y2DY 425N 5CVH M02Y";
const A = "NQ11AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const B = "NQ22BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const C = "NQ33CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";
const D = "NQ44DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD";

const settings = await import("../src/adminRuntimeSettingsStore.ts");
const challenge = await import("../src/miningChallenge.ts");
const gate = await import("../src/payoutMiningGate.ts");
const bans = await import("../src/moderationStore.ts");

function reset(): void {
  settings.patchAdminRuntimeSettings({
    miningChallengeEnabled: true,
    miningChallengeAdminSelfCheck: true,
  });
  challenge.resetMiningChallengeForTests();
  challenge.setMiningChallengeTestHooks({
    captchaReachable: true,
    verify: async (token: string) => (token === "ok" ? "pass" : "fail"),
  });
  fs.writeFileSync(
    process.env.MODERATION_STORE_FILE!,
    JSON.stringify({ usernameSetBanned: {}, channelMuted: {}, miningBanned: {} })
  );
}

test("two wallets do not open a hold; the third pulls in the last 15 minutes", () => {
  reset();
  const now = Date.now();
  const ip = "203.0.113.8";
  assert.equal(challenge.considerGameplayBegin({ wallet: A, ip, now, tutorial: false }).accepted, true);
  assert.equal(challenge.considerGameplayBegin({ wallet: B, ip, now: now + 1000, tutorial: false }).accepted, true);
  assert.equal(challenge.miningClaimDenialReason(A, now + 1000), null);

  const trip = challenge.considerGameplayBegin({ wallet: C, ip, now: now + 2000, tutorial: false });
  assert.equal(trip.accepted, true);
  assert.equal(challenge.miningClaimDenialReason(C, now + 2000), challenge.BLOCK_CLAIM_MSG_MINING_CHALLENGE);
  assert.equal(challenge.miningClaimDenialReason(A, now + 2000), challenge.BLOCK_CLAIM_MSG_MINING_CHALLENGE);
  assert.equal(challenge.miningClaimDenialReason(B, now + 2000), challenge.BLOCK_CLAIM_MSG_MINING_CHALLENGE);
  assert.equal(gate.shouldHoldMiningPayoutForBannedWallet(C, "1,2,0"), true);
  assert.equal(gate.shouldHoldMiningPayoutForBannedWallet(C, "maze-first-place"), false);
});

test("a begin older than 15 minutes is not pulled in", () => {
  reset();
  const now = Date.now();
  const ip = "203.0.113.9";
  challenge.considerGameplayBegin({ wallet: A, ip, now: now - 16 * 60 * 1000, tutorial: false });
  challenge.considerGameplayBegin({ wallet: B, ip, now, tutorial: false });
  challenge.considerGameplayBegin({ wallet: C, ip, now: now + 1000, tutorial: false });
  assert.equal(challenge.miningClaimDenialReason(A, now + 1000), null);
  assert.equal(challenge.miningClaimDenialReason(B, now + 1000), challenge.BLOCK_CLAIM_MSG_MINING_CHALLENGE);
  assert.equal(challenge.miningClaimDenialReason(C, now + 1000), challenge.BLOCK_CLAIM_MSG_MINING_CHALLENGE);
});

test("tutorial mine does not count and a later begin on a hot address is refused", () => {
  reset();
  const now = Date.now();
  const ip = "203.0.113.10";
  challenge.considerGameplayBegin({ wallet: A, ip, now, tutorial: false });
  challenge.considerGameplayBegin({ wallet: B, ip, now, tutorial: false });
  assert.equal(challenge.considerGameplayBegin({ wallet: C, ip, now, tutorial: true }).accepted, true);
  assert.equal(challenge.miningClaimDenialReason(C, now), null);
  challenge.considerGameplayBegin({ wallet: C, ip, now: now + 1000, tutorial: false });
  const later = challenge.considerGameplayBegin({ wallet: D, ip, now: now + 2000, tutorial: false });
  assert.equal(later.accepted, false);
  if (!later.accepted) assert.equal(later.denial, challenge.BLOCK_CLAIM_MSG_MINING_CHALLENGE);
  assert.equal(challenge.miningClaimDenialReason(D, now + 2000), challenge.BLOCK_CLAIM_MSG_MINING_CHALLENGE);
});

test("unreachable captcha does not open a hold", () => {
  reset();
  challenge.setMiningChallengeTestHooks({ captchaReachable: false });
  const now = Date.now();
  const ip = "203.0.113.11";
  for (const wallet of [A, B, C]) {
    assert.equal(challenge.considerGameplayBegin({ wallet, ip, now, tutorial: false }).accepted, true);
  }
  assert.equal(challenge.miningClaimDenialReason(C, now), null);
  const opened = challenge.openMiningChallengeByPerson({ actor: ADMIN, target: A, now });
  assert.equal(opened.ok, false);
  if (!opened.ok) assert.equal(opened.error, "captcha_unavailable");
});

test("pass restores mining for 30 minutes and expiry becomes a restriction", async () => {
  reset();
  const now = Date.now();
  const opened = challenge.openMiningChallengeByPerson({ actor: ADMIN, target: A, now });
  assert.equal(opened.ok, true, !opened.ok ? opened.error : "");
  assert.equal(gate.shouldHoldMiningPayoutForBannedWallet(A, "4,5"), true);
  const bad = await challenge.passMiningChallenge({ wallet: A, token: "nope", now: now + 1000 });
  assert.equal(bad.ok, false);
  const good = await challenge.passMiningChallenge({ wallet: A, token: "ok", now: now + 2000 });
  assert.equal(good.ok, true);
  assert.equal(challenge.miningClaimDenialReason(A, now + 2000), null);
  assert.equal(gate.shouldHoldMiningPayoutForBannedWallet(A, "4,5"), false);
  const again = challenge.openMiningChallengeByPerson({ actor: ADMIN, target: A, now: now + 3000 });
  assert.equal(again.ok, false);
  if (!again.ok) assert.equal(again.error, "challenge_immune");

  assert.equal(challenge.openMiningChallengeByPerson({ actor: ADMIN, target: B, now }).ok, true);
  assert.equal(
    challenge.miningClaimDenialReason(B, now + challenge.MINING_CHALLENGE_WINDOW_MS + 1),
    null
  );
  assert.equal(bans.isMiningBanned(B), true);
  assert.equal(gate.shouldHoldMiningPayoutForBannedWallet(B, "1,1"), true);
});

test("grant holder cannot target self or an admin", () => {
  reset();
  const now = Date.now();
  challenge.setChallengeGrant(A, true, ADMIN, now);
  assert.equal(challenge.viewerMayOfferMiningChallenge(A, B), true);
  assert.equal(challenge.viewerMayOfferMiningChallenge(A, A), false);
  assert.equal(challenge.viewerMayOfferMiningChallenge(A, ADMIN), false);
  assert.equal(challenge.viewerMayOfferMiningChallenge(C, B), false);
  assert.equal(challenge.openMiningChallengeByPerson({ actor: A, target: A, now }).ok, false);
  const admin = challenge.openMiningChallengeByPerson({ actor: A, target: ADMIN, now });
  assert.equal(admin.ok, false);
  if (!admin.ok) assert.equal(admin.error, "cannot_target_admin");
  assert.equal(challenge.openMiningChallengeByPerson({ actor: A, target: B, now }).ok, true);
  challenge.setChallengeGrant(A, false, ADMIN, now);
  assert.equal(challenge.listChallengeGrants(now).length, 0);
});

test("the player-facing check stays off until an admin enables it", () => {
  reset();
  settings.patchAdminRuntimeSettings({ miningChallengeEnabled: false });
  const now = Date.now();
  const ip = "203.0.113.20";
  for (const wallet of [A, B, C]) {
    assert.equal(challenge.considerGameplayBegin({ wallet, ip, now, tutorial: false }).accepted, true);
  }
  assert.equal(challenge.miningClaimDenialReason(C, now), null);
  const opened = challenge.openMiningChallengeByPerson({ actor: ADMIN, target: A, now });
  assert.equal(opened.ok, false);
  if (!opened.ok) assert.equal(opened.error, "challenge_disabled");
});

test("an admin can open and clear a self-check without a mining restriction", () => {
  reset();
  settings.patchAdminRuntimeSettings({
    miningChallengeEnabled: false,
    miningChallengeAdminSelfCheck: true,
  });
  const now = Date.now();
  const opened = challenge.openMiningChallengeForSelf({ actor: ADMIN, now });
  assert.equal(opened.ok, true);
  assert.equal(
    challenge.miningClaimDenialReason(ADMIN, now),
    challenge.BLOCK_CLAIM_MSG_MINING_CHALLENGE
  );
  assert.equal(challenge.openMiningChallengeForSelf({ actor: A, now }).ok, false);
  const cleared = challenge.clearMiningChallengeForSelf({ actor: ADMIN, now: now + 1000 });
  assert.equal(cleared.ok, true);
  assert.equal(challenge.miningClaimDenialReason(ADMIN, now + 1000), null);

  assert.equal(challenge.openMiningChallengeForSelf({ actor: ADMIN, now: now + 2000 }).ok, true);
  assert.equal(
    challenge.miningClaimDenialReason(ADMIN, now + challenge.MINING_CHALLENGE_WINDOW_MS + 3000),
    null
  );
  assert.equal(bans.isMiningBanned(ADMIN.replace(/\s+/g, "")), false);

  settings.patchAdminRuntimeSettings({ miningChallengeAdminSelfCheck: false });
  const refused = challenge.openMiningChallengeForSelf({ actor: ADMIN, now: now + 4000 });
  assert.equal(refused.ok, false);
  if (!refused.ok) assert.equal(refused.error, "self_check_disabled");
});

test("client address comes from the trusted proxy", () => {
  assert.equal(
    challenge.clientIpFromProxyRequest({
      peer: "127.0.0.1",
      xForwardedFor: "198.51.100.4, 10.0.0.1",
    }),
    "198.51.100.4"
  );
  assert.equal(
    challenge.clientIpFromProxyRequest({
      peer: "203.0.113.50",
      xForwardedFor: "198.51.100.4",
    }),
    "203.0.113.50"
  );
  assert.equal(
    challenge.clientIpFromProxyRequest({ peer: "::ffff:127.0.0.1", xRealIp: "2001:db8::1" }),
    "2001:db8::1"
  );
});
