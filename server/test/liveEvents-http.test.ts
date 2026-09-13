import assert from "node:assert/strict";
import fs from "node:fs";
import type { Server } from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import express from "express";
import { signGuestSession, signSession, verifySession } from "../src/auth.js";
import type { WorldEffect } from "../src/liveEvents/types.js";

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "nspace-live-http-"));
process.env.LIVE_EVENT_STORE_FILE = path.join(TMP, "live-events.sqlite");
process.env.LIVE_EVENT_TEST_BOOST_MS = "60000";

const WALLET = "NQ97 4M1T 4TGD VC7F LHLQ Y2DY 425N 5CVH M02Y";
const OTHER = "NQ16 2SSN 82TL SMQS KXT3 Q01V CMAL NU6F 1LJG";
const SECRET = "live-event-http-test-secret";
const TEST_BODY = {
  id: "11111111-1111-1111-1111-111111111111",
  type: "nimiqlive.test",
  occurredAt: "2026-09-13T12:00:00.000Z",
  source: "nimiqlive",
  payload: {},
};

const { initLiveEventStore, _resetLiveEventStoreForTests } = await import(
  "../src/liveEvents/store.js"
);
const { registerLiveEventRoutes } = await import("../src/liveEvents/http.js");
const { resetLiveWorldEffectForTests } = await import(
  "../src/liveEvents/worldEffect.js"
);

function bearerToken(req: express.Request): string | null {
  const h = req.headers.authorization;
  if (!h || typeof h !== "string") return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

async function listenApp(
  t: test.TestContext,
  allowlist: string,
  applied: WorldEffect[]
): Promise<string> {
  process.env.LIVE_EVENT_ADDRESSES = allowlist;
  _resetLiveEventStoreForTests();
  resetLiveWorldEffectForTests();
  initLiveEventStore();

  const app = express();
  app.use(express.json());
  registerLiveEventRoutes(app, {
    requireJwt: (req, res, next) => {
      const tok = bearerToken(req);
      if (!tok) {
        res.status(401).json({ error: "unauthorized" });
        return;
      }
      try {
        verifySession(tok, SECRET);
        next();
      } catch {
        res.status(401).json({ error: "unauthorized" });
      }
    },
    jwtSessionFromReq: (req) => {
      const tok = bearerToken(req);
      if (!tok) return null;
      try {
        return verifySession(tok, SECRET);
      } catch {
        return null;
      }
    },
    onWorldEffect: (effect) => {
      applied.push(effect);
    },
  });

  const server: Server = await new Promise((resolve, reject) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
    s.on("error", reject);
  });
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no port");
  return `http://127.0.0.1:${addr.port}`;
}

async function postLiveEvent(
  base: string,
  token: string | null,
  body: unknown
): Promise<{ status: number; json: Record<string, unknown> }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Connection: "close",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${base}/api/live-events`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as Record<string, unknown>;
  return { status: res.status, json };
}

test.after(() => {
  _resetLiveEventStoreForTests();
  fs.rmSync(TMP, { recursive: true, force: true });
  delete process.env.LIVE_EVENT_ADDRESSES;
});

test("POST /api/live-events is fail-closed when LIVE_EVENT_ADDRESSES is empty", async (t) => {
  const applied: WorldEffect[] = [];
  const base = await listenApp(t, "", applied);
  const token = signSession(WALLET, SECRET);
  const res = await postLiveEvent(base, token, TEST_BODY);
  assert.equal(res.status, 403);
  assert.equal(applied.length, 0);
});

test("POST /api/live-events requires a NimiqLIVE Wallet JWT", async (t) => {
  const applied: WorldEffect[] = [];
  const base = await listenApp(t, WALLET, applied);

  const noAuth = await postLiveEvent(base, null, TEST_BODY);
  assert.equal(noAuth.status, 401);

  const guest = await postLiveEvent(
    base,
    signGuestSession("g1", "Guest", SECRET),
    TEST_BODY
  );
  assert.equal(guest.status, 403);

  const other = await postLiveEvent(base, signSession(OTHER, SECRET), TEST_BODY);
  assert.equal(other.status, 403);
  assert.equal(applied.length, 0);
});

test("POST /api/live-events applies Live Boost once per Live Event Id", async (t) => {
  const applied: WorldEffect[] = [];
  const base = await listenApp(t, WALLET, applied);
  const token = signSession(WALLET, SECRET);

  const first = await postLiveEvent(base, token, TEST_BODY);
  assert.equal(first.status, 200);
  assert.equal(first.json.ok, true);
  assert.equal(first.json.duplicate, false);
  assert.equal((first.json.effect as { kind?: string } | undefined)?.kind, "live_boost");
  assert.equal(applied.length, 1);

  const retry = await postLiveEvent(base, token, TEST_BODY);
  assert.equal(retry.status, 409);
  assert.equal(retry.json.ok, true);
  assert.equal(retry.json.duplicate, true);
  assert.equal(applied.length, 1);
});

test("POST /api/live-events accepts unknown types without applying a World Effect", async (t) => {
  const applied: WorldEffect[] = [];
  const base = await listenApp(t, WALLET, applied);
  const token = signSession(WALLET, SECRET);
  const res = await postLiveEvent(base, token, {
    ...TEST_BODY,
    id: "22222222-2222-2222-2222-222222222222",
    type: "nimiqlive.twitch.subscribe",
  });
  assert.equal(res.status, 200);
  assert.equal(res.json.ok, true);
  assert.equal(res.json.ignored, true);
  assert.equal(applied.length, 0);

  const bad = await postLiveEvent(base, token, { ...TEST_BODY, id: "nope" });
  assert.equal(bad.status, 400);
});
