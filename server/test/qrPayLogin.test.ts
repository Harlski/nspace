import assert from "node:assert/strict";
import test from "node:test";

import {
  createQrPayLoginTicket,
  fulfillQrPayLoginTicket,
  getQrPayLoginChallenge,
  pollQrPayLoginTicket,
  resetQrPayLoginTicketsForTests,
} from "../src/qrPayLogin.js";

test("createQrPayLoginTicket returns spa URL, deeplink, and claim secret", () => {
  resetQrPayLoginTicketsForTests();
  const created = createQrPayLoginTicket("https://nimiq.space");
  assert.match(created.ticketId, /^[0-9a-f]{32}$/);
  assert.match(created.claimSecret, /^[0-9a-f]{64}$/);
  assert.equal(created.spaUrl, `https://nimiq.space/auth/qr/${created.ticketId}`);
  assert.ok(created.payDeepLink.startsWith("nimiqpay://miniapp?url="));
  assert.ok(created.payDeepLink.includes(encodeURIComponent(created.spaUrl)));
  assert.ok(created.expiresAt > Date.now());
});

test("challenge exposes nonce while pending and never returns claim secret", () => {
  resetQrPayLoginTicketsForTests();
  const created = createQrPayLoginTicket("https://nimiq.space");
  const challenge = getQrPayLoginChallenge(created.ticketId);
  assert.equal(challenge.status, "pending");
  assert.ok(challenge.nonce);
  assert.equal(challenge.message, `Login:v1:${challenge.nonce}`);
  assert.equal(
    JSON.stringify(challenge).includes(created.claimSecret),
    false
  );
});

test("poll requires claim secret; fulfill is one-shot for desktop", () => {
  resetQrPayLoginTicketsForTests();
  const created = createQrPayLoginTicket("https://nimiq.space");

  assert.equal(
    pollQrPayLoginTicket(created.ticketId, "wrong-secret").status,
    "forbidden"
  );

  const pending = pollQrPayLoginTicket(created.ticketId, created.claimSecret);
  assert.equal(pending.status, "pending");

  const session = {
    token: "jwt-test",
    address: "NQTEST",
    nimiqPay: true,
    usernamePrompt: { needsPrompt: false },
  };
  assert.deepEqual(fulfillQrPayLoginTicket(created.ticketId, session), { ok: true });
  assert.equal(getQrPayLoginChallenge(created.ticketId).status, "fulfilled");

  const first = pollQrPayLoginTicket(created.ticketId, created.claimSecret);
  assert.equal(first.status, "fulfilled");
  if (first.status === "fulfilled") {
    assert.equal(first.session.token, "jwt-test");
    assert.equal(first.session.nimiqPay, true);
  }

  const second = pollQrPayLoginTicket(created.ticketId, created.claimSecret);
  assert.equal(second.status, "expired");
});

test("unknown ticket is expired", () => {
  resetQrPayLoginTicketsForTests();
  assert.equal(getQrPayLoginChallenge("missing").status, "expired");
  assert.equal(pollQrPayLoginTicket("missing", "x").status, "expired");
});
