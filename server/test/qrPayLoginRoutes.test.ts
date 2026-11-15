/**
 * Public seam: QR login HTTP routes.
 * Catches ticket secrecy, one-shot claim, terms gate, and real Login:v1 signatures.
 * Misses the phone UI and the Nimiq Pay app itself.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import type { Server } from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import express, { type Express } from "express";

/**
 * Importing the session issuer pulls world modules that start referenced
 * autosave intervals. Unref them so this file can exit when its assertions finish.
 */
const originalSetInterval = global.setInterval;
global.setInterval = ((fn: TimerHandler, ms?: number, ...args: unknown[]) => {
  const handle = originalSetInterval(fn, ms, ...args);
  handle.unref?.();
  return handle;
}) as typeof setInterval;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nspace-qr-login-"));
process.env.TERMS_PRIVACY_ACCEPTANCE_STORE_FILE = path.join(tmp, "terms.json");
process.env.PLAYER_PROFILE_STORE_FILE = path.join(tmp, "profiles.json");
process.env.LOGIN_STREAK_STORE_FILE = path.join(tmp, "streaks.json");
process.env.MODERATION_STORE_FILE = path.join(tmp, "moderation.json");
process.env.NODE_ENV = "test";
delete process.env.DEV_AUTH_BYPASS;
delete process.env.TUTORIAL_ENABLED;

const JWT_SECRET = "qr-login-route-test-secret";
const PUBLIC_BASE = "https://nimiq.space";

type Created = {
  ticketId: string;
  claimSecret: string;
  expiresAt: number;
  spaUrl: string;
  payDeepLink: string;
};

type Challenge = {
  status: string;
  nonce?: string;
  message?: string;
  expiresAt?: number;
};

const { registerQrPayLoginRoutes } = await import("../src/qrPayLoginRoutes.js");
const { TERMS_PRIVACY_DOCS_VERSION } = await import("../src/termsPrivacyVersion.js");
const { verifySession } = await import("../src/auth.js");
const { resetQrPayLoginTicketsForTests } = await import("../src/qrPayLogin.js");

function appFor(devAuthBypass: boolean): Express {
  const app = express();
  app.use(express.json());
  registerQrPayLoginRoutes(app, {
    jwtSecret: JWT_SECRET,
    publicBaseUrl: PUBLIC_BASE,
    devAuthBypass,
  });
  return app;
}

async function listen(app: Express): Promise<{ base: string; close: () => Promise<void> }> {
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no port");
  return {
    base: `http://127.0.0.1:${addr.port}`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

async function signLoginV1(message: string): Promise<{
  signerPublicKey: string;
  signature: string;
  address: string;
}> {
  const { Hash, PrivateKey, PublicKey, Signature } = await import("@nimiq/core");
  const privateKey = PrivateKey.generate();
  const publicKey = PublicKey.derive(privateKey);
  const prefixed = `\x16Nimiq Signed Message:\n${message.length}${message}`;
  const hash = Hash.computeSha256(new TextEncoder().encode(prefixed));
  const signature = Signature.create(privateKey, publicKey, hash);
  return {
    signerPublicKey: Buffer.from(publicKey.serialize()).toString("base64"),
    signature: Buffer.from(signature.serialize()).toString("base64"),
    address: publicKey.toAddress().toUserFriendlyAddress(),
  };
}

test("desktop create returns a Pay deeplink and hides the claim secret from the phone", async () => {
  resetQrPayLoginTicketsForTests();
  const srv = await listen(appFor(false));
  try {
    const createdRes = await fetch(`${srv.base}/api/auth/qr-login`, { method: "POST" });
    assert.equal(createdRes.status, 200);
    const created = (await createdRes.json()) as Created;
    assert.match(created.ticketId, /^[0-9a-f]{32}$/);
    assert.match(created.claimSecret, /^[0-9a-f]{64}$/);
    assert.equal(created.spaUrl, `${PUBLIC_BASE}/auth/qr/${created.ticketId}`);
    assert.equal(created.payDeepLink, `nimiqpay://miniapp?url=${created.spaUrl}`);
    assert.equal(created.payDeepLink.includes("%"), false);

    const challengeRes = await fetch(
      `${srv.base}/api/auth/qr-login/${created.ticketId}/challenge`
    );
    assert.equal(challengeRes.status, 200);
    const challenge = (await challengeRes.json()) as Challenge;
    assert.equal(challenge.status, "pending");
    assert.equal(challenge.message, `Login:v1:${challenge.nonce}`);
    assert.equal(JSON.stringify(challenge).includes(created.claimSecret), false);

    const forbidden = await fetch(`${srv.base}/api/auth/qr-login/${created.ticketId}`);
    assert.equal(forbidden.status, 403);
    const forbiddenBody = (await forbidden.json()) as { token?: string };
    assert.equal(forbiddenBody.token, undefined);

    const pending = await fetch(
      `${srv.base}/api/auth/qr-login/${created.ticketId}?claimSecret=${created.claimSecret}`
    );
    assert.equal(pending.status, 200);
    assert.equal(((await pending.json()) as { status: string }).status, "pending");
  } finally {
    await srv.close();
  }
});

test("a wrong Login:v1 message does not fulfill the ticket", async () => {
  resetQrPayLoginTicketsForTests();
  const srv = await listen(appFor(false));
  try {
    const created = (await (
      await fetch(`${srv.base}/api/auth/qr-login`, { method: "POST" })
    ).json()) as Created;
    const challenge = (await (
      await fetch(`${srv.base}/api/auth/qr-login/${created.ticketId}/challenge`)
    ).json()) as Challenge;
    const signed = await signLoginV1("Login:v1:not-the-ticket-nonce");
    const res = await fetch(`${srv.base}/api/auth/qr-login/${created.ticketId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Login:v1:not-the-ticket-nonce",
        signer: signed.address,
        signerPublicKey: signed.signerPublicKey,
        signature: signed.signature,
        acceptedTermsPrivacyVersion: TERMS_PRIVACY_DOCS_VERSION,
      }),
    });
    assert.equal(res.status, 401);
    assert.equal(((await res.json()) as { error: string }).error, "message_mismatch");

    const still = (await (
      await fetch(`${srv.base}/api/auth/qr-login/${created.ticketId}/challenge`)
    ).json()) as Challenge;
    assert.equal(still.status, "pending");
    assert.equal(still.nonce, challenge.nonce);
  } finally {
    await srv.close();
  }
});

test("production rejects an unsigned complete and a signer that does not match the key", async () => {
  resetQrPayLoginTicketsForTests();
  const srv = await listen(appFor(false));
  try {
    const created = (await (
      await fetch(`${srv.base}/api/auth/qr-login`, { method: "POST" })
    ).json()) as Created;
    const challenge = (await (
      await fetch(`${srv.base}/api/auth/qr-login/${created.ticketId}/challenge`)
    ).json()) as Challenge;
    const wrongMessage = await signLoginV1("Login:v1:different-message");
    const bad = await fetch(`${srv.base}/api/auth/qr-login/${created.ticketId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: challenge.message,
        signer: "",
        signerPublicKey: wrongMessage.signerPublicKey,
        signature: wrongMessage.signature,
        nimiqPayClient: true,
        acceptedTermsPrivacyVersion: TERMS_PRIVACY_DOCS_VERSION,
      }),
    });
    assert.equal(bad.status, 401);
    assert.equal(((await bad.json()) as { error: string }).error, "invalid_signature");

    const signed = await signLoginV1(String(challenge.message));
    const mismatch = await fetch(`${srv.base}/api/auth/qr-login/${created.ticketId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: challenge.message,
        signer: "NQ07 OTHERWALLET0000000000000000000001",
        signerPublicKey: signed.signerPublicKey,
        signature: signed.signature,
        acceptedTermsPrivacyVersion: TERMS_PRIVACY_DOCS_VERSION,
      }),
    });
    assert.equal(mismatch.status, 401);
    assert.equal(((await mismatch.json()) as { error: string }).error, "signer_mismatch");

    const still = (await (
      await fetch(`${srv.base}/api/auth/qr-login/${created.ticketId}/challenge`)
    ).json()) as Challenge;
    assert.equal(still.status, "pending");
  } finally {
    await srv.close();
  }
});

test("a signed Login:v1 fulfills once, and only the claim secret receives the session", async () => {
  resetQrPayLoginTicketsForTests();
  const srv = await listen(appFor(false));
  try {
    const created = (await (
      await fetch(`${srv.base}/api/auth/qr-login`, { method: "POST" })
    ).json()) as Created;
    const challenge = (await (
      await fetch(`${srv.base}/api/auth/qr-login/${created.ticketId}/challenge`)
    ).json()) as Challenge;
    const signed = await signLoginV1(String(challenge.message));

    const needsTerms = await fetch(`${srv.base}/api/auth/qr-login/${created.ticketId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: challenge.message,
        signer: signed.address,
        signerPublicKey: signed.signerPublicKey,
        signature: signed.signature,
      }),
    });
    assert.equal(needsTerms.status, 403);
    const termsBody = (await needsTerms.json()) as { error: string; requiredVersion: string };
    assert.equal(termsBody.error, "terms_privacy_ack_required");
    assert.equal(termsBody.requiredVersion, TERMS_PRIVACY_DOCS_VERSION);

    const done = await fetch(`${srv.base}/api/auth/qr-login/${created.ticketId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: challenge.message,
        signer: signed.address,
        signerPublicKey: signed.signerPublicKey,
        signature: signed.signature,
        acceptedTermsPrivacyVersion: TERMS_PRIVACY_DOCS_VERSION,
      }),
    });
    assert.equal(done.status, 200);
    const phone = (await done.json()) as { ok: boolean; address: string; nimiqPay: boolean; token?: string };
    assert.equal(phone.ok, true);
    assert.equal(phone.address, signed.address);
    assert.equal(phone.nimiqPay, false);
    assert.equal(phone.token, undefined);

    const again = await fetch(`${srv.base}/api/auth/qr-login/${created.ticketId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: challenge.message,
        signer: signed.address,
        signerPublicKey: signed.signerPublicKey,
        signature: signed.signature,
        acceptedTermsPrivacyVersion: TERMS_PRIVACY_DOCS_VERSION,
      }),
    });
    assert.equal(again.status, 409);

    const leaked = await fetch(`${srv.base}/api/auth/qr-login/${created.ticketId}/challenge`);
    const leakedBody = (await leaked.json()) as Challenge & { token?: string };
    assert.equal(leakedBody.status, "fulfilled");
    assert.equal(leakedBody.token, undefined);
    assert.equal(JSON.stringify(leakedBody).includes(created.claimSecret), false);

    const claimed = await fetch(
      `${srv.base}/api/auth/qr-login/${created.ticketId}?claimSecret=${created.claimSecret}`
    );
    assert.equal(claimed.status, 200);
    const session = (await claimed.json()) as {
      status: string;
      token: string;
      address: string;
      nimiqPay: boolean;
    };
    assert.equal(session.status, "fulfilled");
    assert.equal(session.address, signed.address);
    assert.equal(session.nimiqPay, false);
    const payload = verifySession(session.token, JWT_SECRET);
    assert.equal(payload.sub, signed.address);
    assert.equal(payload.nimiqPay, undefined);

    const second = await fetch(
      `${srv.base}/api/auth/qr-login/${created.ticketId}?claimSecret=${created.claimSecret}`
    );
    assert.equal(second.status, 410);
  } finally {
    await srv.close();
  }
});

test("Nimiq Pay complete marks the session as Pay and still withholds the JWT from the phone", async () => {
  resetQrPayLoginTicketsForTests();
  const srv = await listen(appFor(false));
  try {
    const created = (await (
      await fetch(`${srv.base}/api/auth/qr-login`, { method: "POST" })
    ).json()) as Created;
    const challenge = (await (
      await fetch(`${srv.base}/api/auth/qr-login/${created.ticketId}/challenge`)
    ).json()) as Challenge;
    const signed = await signLoginV1(String(challenge.message));
    const done = await fetch(`${srv.base}/api/auth/qr-login/${created.ticketId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: challenge.message,
        signer: "",
        signerPublicKey: signed.signerPublicKey,
        signature: signed.signature,
        nimiqPayClient: true,
        acceptedTermsPrivacyVersion: TERMS_PRIVACY_DOCS_VERSION,
      }),
    });
    assert.equal(done.status, 200);
    const phone = (await done.json()) as { ok: boolean; nimiqPay: boolean; token?: string; address: string };
    assert.equal(phone.ok, true);
    assert.equal(phone.nimiqPay, true);
    assert.equal(phone.address, signed.address);
    assert.equal(phone.token, undefined);

    const claimed = await fetch(
      `${srv.base}/api/auth/qr-login/${created.ticketId}?claimSecret=${created.claimSecret}`
    );
    const session = (await claimed.json()) as {
      token: string;
      nimiqPay: boolean;
      tutorial?: { needsTutorial: boolean };
    };
    assert.equal(session.nimiqPay, true);
    assert.deepEqual(session.tutorial, { needsTutorial: false });
    const payload = verifySession(session.token, JWT_SECRET);
    assert.equal(payload.nimiqPay, true);
    assert.equal(payload.sub, signed.address);
  } finally {
    await srv.close();
  }
});

test("a Pay flag alone does not label a wallet signature as Nimiq Pay", async () => {
  resetQrPayLoginTicketsForTests();
  const srv = await listen(appFor(false));
  try {
    const created = (await (
      await fetch(`${srv.base}/api/auth/qr-login`, { method: "POST" })
    ).json()) as Created;
    const challenge = (await (
      await fetch(`${srv.base}/api/auth/qr-login/${created.ticketId}/challenge`)
    ).json()) as Challenge;
    const signed = await signLoginV1(String(challenge.message));
    const done = await fetch(`${srv.base}/api/auth/qr-login/${created.ticketId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: challenge.message,
        signer: signed.address,
        signerPublicKey: signed.signerPublicKey,
        signature: signed.signature,
        nimiqPayClient: true,
        acceptedTermsPrivacyVersion: TERMS_PRIVACY_DOCS_VERSION,
      }),
    });
    assert.equal(done.status, 200);
    assert.equal(((await done.json()) as { nimiqPay: boolean }).nimiqPay, false);
    const claimed = await fetch(
      `${srv.base}/api/auth/qr-login/${created.ticketId}?claimSecret=${created.claimSecret}`
    );
    const session = (await claimed.json()) as { nimiqPay: boolean; tutorial?: unknown };
    assert.equal(session.nimiqPay, false);
    assert.equal(session.tutorial, undefined);
  } finally {
    await srv.close();
  }
});

test("an unknown ticket is expired on challenge, poll, and complete", async () => {
  resetQrPayLoginTicketsForTests();
  const srv = await listen(appFor(false));
  try {
    const challenge = await fetch(`${srv.base}/api/auth/qr-login/missing/challenge`);
    assert.equal(((await challenge.json()) as Challenge).status, "expired");
    const poll = await fetch(`${srv.base}/api/auth/qr-login/missing?claimSecret=abc`);
    assert.equal(poll.status, 410);
    const complete = await fetch(`${srv.base}/api/auth/qr-login/missing/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Login:v1:x", signerPublicKey: "aa", signature: "bb" }),
    });
    assert.equal(complete.status, 410);
  } finally {
    await srv.close();
  }
});
