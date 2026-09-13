import assert from "node:assert/strict";
import fs from "node:fs";
import type { Server } from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import express from "express";
import { signSession, verifySession } from "../src/auth.js";
import { HUB_ROOM_ID } from "../src/roomLayouts.js";

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "nspace-live-admin-"));
process.env.LIVE_EVENT_STORE_FILE = path.join(TMP, "live-events.sqlite");

const ADMIN = "NQ97 4M1T 4TGD VC7F LHLQ Y2DY 425N 5CVH M02Y";
const OTHER = "NQ16 2SSN 82TL SMQS KXT3 Q01V CMAL NU6F 1LJG";
const SECRET = "live-event-admin-http-secret";

const { initLiveEventStore, _resetLiveEventStoreForTests } = await import(
  "../src/liveEvents/store.js"
);
const { registerLiveEventAdminRoutes } = await import(
  "../src/liveEvents/adminHttp.js"
);

function bearerToken(req: express.Request): string | null {
  const h = req.headers.authorization;
  if (!h || typeof h !== "string") return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

async function listenApp(t: test.TestContext, adminWallet: string): Promise<string> {
  _resetLiveEventStoreForTests();
  initLiveEventStore();
  const app = express();
  app.use(express.json());
  registerLiveEventAdminRoutes(app, {
    requireSystemAdminWallet: (req, res, next) => {
      const tok = bearerToken(req);
      if (!tok) {
        res.status(401).json({ error: "unauthorized" });
        return;
      }
      try {
        const payload = verifySession(tok, SECRET);
        if (payload.sub !== adminWallet) {
          res.status(403).json({ error: "forbidden" });
          return;
        }
        next();
      } catch {
        res.status(401).json({ error: "unauthorized" });
      }
    },
    listRooms: () => [{ id: HUB_ROOM_ID, displayName: "Hub" }],
    currentRoomId: () => "pixel",
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

async function reqJson(
  base: string,
  method: string,
  pathName: string,
  token: string | null,
  body?: unknown
): Promise<{ status: number; json: Record<string, unknown> }> {
  const headers: Record<string, string> = { Connection: "close" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${base}${pathName}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json()) as Record<string, unknown>;
  return { status: res.status, json };
}

test.after(() => {
  _resetLiveEventStoreForTests();
  fs.rmSync(TMP, { recursive: true, force: true });
});

test("GET /api/admin/live-events is system-admin only", async (t) => {
  const base = await listenApp(t, ADMIN);
  const noAuth = await reqJson(base, "GET", "/api/admin/live-events", null);
  assert.equal(noAuth.status, 401);
  const other = await reqJson(
    base,
    "GET",
    "/api/admin/live-events",
    signSession(OTHER, SECRET)
  );
  assert.equal(other.status, 403);
});

test("admin can create, update, and delete Live Event mappings", async (t) => {
  const base = await listenApp(t, ADMIN);
  const token = signSession(ADMIN, SECRET);

  const snapshot = await reqJson(base, "GET", "/api/admin/live-events", token);
  assert.equal(snapshot.status, 200);
  assert.equal(snapshot.json.currentRoomId, "pixel");
  assert.ok(Array.isArray(snapshot.json.interactions));
  assert.ok(Array.isArray(snapshot.json.mappings));

  const created = await reqJson(base, "POST", "/api/admin/live-events/mappings", token, {
    eventType: "nimiqlive.twitch.subscribe",
    interactionKind: "gold_blocks",
    roomTarget: "current",
  });
  assert.equal(created.status, 201);
  const mapping = created.json.mapping as { id: string; interactionKind: string };
  assert.equal(mapping.interactionKind, "gold_blocks");

  const dup = await reqJson(base, "POST", "/api/admin/live-events/mappings", token, {
    eventType: "nimiqlive.twitch.subscribe",
    interactionKind: "live_boost",
    roomTarget: "hub",
  });
  assert.equal(dup.status, 409);

  const updated = await reqJson(
    base,
    "PUT",
    `/api/admin/live-events/mappings/${mapping.id}`,
    token,
    {
      eventType: "nimiqlive.twitch.subscribe",
      interactionKind: "live_boost",
      roomTarget: "other",
      roomId: HUB_ROOM_ID,
      enabled: true,
    }
  );
  assert.equal(updated.status, 200);
  assert.equal(
    (updated.json.mapping as { roomTarget: string }).roomTarget,
    "other"
  );

  const deleted = await reqJson(
    base,
    "DELETE",
    `/api/admin/live-events/mappings/${mapping.id}`,
    token
  );
  assert.equal(deleted.status, 200);
  const missing = await reqJson(
    base,
    "DELETE",
    `/api/admin/live-events/mappings/${mapping.id}`,
    token
  );
  assert.equal(missing.status, 404);
});
