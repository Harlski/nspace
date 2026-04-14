import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import fs from "node:fs";
import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { createNonce, consumeNonce, signSession, verifySession } from "./auth.js";
import { addClient, adminRandomExtraFloorLayout, startRoomTick } from "./rooms.js";
import { flushPersistWorldStateSync } from "./worldPersistence.js";
import { verifySignedMessage } from "./verifyNimiq.js";
import {
  flushEventLogSync,
  getEventsForSession,
  listRecentPlayerAddresses,
  listSessionsForPlayer,
} from "./eventLog.js";
import { flushCanvasClaimsSync } from "./canvasCanvas.js";
import { getTopPlayers } from "./canvasCanvas.js";
import { flushSignboardsSync } from "./signboards.js";
import { installSwarmErrorForwarder } from "./swarmLogForwarder.js";
import {
  flushNimPayoutQueueSync,
  getNimPayoutWalletBalanceLuna,
  isNimPayoutSenderConfigured,
  startNimPayoutProcessor,
} from "./nimPayout/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SWARM_ERROR_LOG_PATH =
  process.env.SWARM_ERROR_LOG_PATH ??
  path.join(__dirname, "../data/swarm-errors.log");
installSwarmErrorForwarder(SWARM_ERROR_LOG_PATH);

const PORT = Number(process.env.PORT) || 3001;
/** Bind address: `0.0.0.0` accepts connections on all interfaces (LAN + localhost). Use `127.0.0.1` for local-only. */
const HOST = process.env.HOST ?? "0.0.0.0";
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === "dev-insecure-change-me") {
  if (process.env.NODE_ENV === "production") {
    console.error(
      "[FATAL] JWT_SECRET environment variable must be set to a secure value in production.\n" +
      "Generate one with: openssl rand -base64 32"
    );
    process.exit(1);
  } else if (!JWT_SECRET) {
    console.error(
      "[FATAL] JWT_SECRET environment variable is required.\n" +
      "For development, use: JWT_SECRET=dev-insecure-change-me npm run dev -w server"
    );
    process.exit(1);
  }
}
// TypeScript now knows JWT_SECRET is a string (not undefined) after the checks above
const jwtSecret: string = JWT_SECRET;
const NODE_ENV = process.env.NODE_ENV || "development";
const DEV_AUTH_BYPASS =
  NODE_ENV === "development" && process.env.DEV_AUTH_BYPASS === "1";

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "64kb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

function bearerToken(req: Request): string | null {
  const h = req.headers.authorization;
  if (!h || typeof h !== "string") return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

function requireJwt(req: Request, res: Response, next: NextFunction): void {
  const t = bearerToken(req);
  if (!t) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  try {
    verifySession(t, jwtSecret);
    next();
  } catch {
    res.status(401).json({ error: "unauthorized" });
  }
}

app.get("/api/canvas/leaderboard", (_req, res) => {
  try {
    const top = getTopPlayers(3);
    res.json({ leaderboard: top });
  } catch (err) {
    console.error("[canvas/leaderboard]", err);
    res.status(500).json({ error: "internal" });
  }
});

app.get("/api/nim/payout-balance", async (_req, res) => {
  if (!isNimPayoutSenderConfigured()) {
    res.json({ configured: false, hasNim: false, balanceNim: "0.0000" });
    return;
  }
  try {
    const luna = await getNimPayoutWalletBalanceLuna();
    const balanceNim = (Number(luna) / 100_000).toFixed(4);
    res.json({
      configured: true,
      hasNim: luna > 0n,
      balanceNim,
    });
  } catch (err) {
    console.error("[nim/payout-balance]", err);
    res.status(500).json({ error: "internal" });
  }
});

app.get("/api/replay/players", requireJwt, (req, res) => {
  const maxDays = Math.min(30, Math.max(1, Number(req.query.days) || 7));
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));
  res.json({ players: listRecentPlayerAddresses(maxDays, limit) });
});

app.get("/api/replay/sessions", requireJwt, (req, res) => {
  const address = String(req.query.address ?? "");
  if (!address) {
    res.status(400).json({ error: "missing_address" });
    return;
  }
  const maxDays = Math.min(30, Math.max(1, Number(req.query.days) || 7));
  res.json({ sessions: listSessionsForPlayer(address, maxDays) });
});

app.get("/api/replay/session/:sessionId/events", requireJwt, (req, res) => {
  const maxDays = Math.min(30, Math.max(1, Number(req.query.days) || 7));
  const events = getEventsForSession(req.params.sessionId, maxDays);
  res.json({ events });
});

app.post("/api/admin/random-layout", (req, res) => {
  const body = req.body as Record<string, unknown>;
  const roomId = String(body.roomId ?? "hub");
  const targetCount = Number(body.targetCount);
  const seed = Number(body.seed ?? 0);
  const clearExisting = Boolean(body.clearExisting);
  const out = adminRandomExtraFloorLayout(roomId, {
    targetCount,
    seed,
    clearExisting,
  });
  if (!out.ok) {
    res.status(400).json({ error: out.error });
    return;
  }
  res.json({ placed: out.placed, totalExtra: out.totalExtra });
});

app.get("/api/auth/nonce", (_req, res) => {
  const { nonce, expiresAt } = createNonce();
  res.json({ nonce, expiresAt });
});

app.post("/api/auth/verify", async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const nonce = String(body.nonce ?? "");
  const message = String(body.message ?? "");
  const signer = String(body.signer ?? "");
  const signerPublicKey = String(body.signerPublicKey ?? "");
  const signature = String(body.signature ?? "");

  if (!nonce || !message || !signer || !signerPublicKey || !signature) {
    res.status(400).json({ error: "missing_fields" });
    return;
  }

  if (!consumeNonce(nonce)) {
    res.status(401).json({ error: "invalid_nonce" });
    return;
  }

  const expected = `Login:v1:${nonce}`;
  if (message !== expected) {
    res.status(401).json({ error: "message_mismatch" });
    return;
  }

  let ok = false;
  if (DEV_AUTH_BYPASS) {
    ok = true;
  } else {
    try {
      ok = await verifySignedMessage(message, signerPublicKey, signature, signer);
    } catch (e) {
      console.error("verifySignedMessage", e);
      ok = false;
    }
  }

  if (!ok) {
    res.status(401).json({ error: "invalid_signature" });
    return;
  }

  const token = signSession(signer, jwtSecret);
  res.json({ token, address: signer });
});

const server = createServer(app);

const wss = new WebSocketServer({ server, path: "/ws" });

startRoomTick();
startNimPayoutProcessor();

wss.on("connection", (ws, req) => {
  const url = new URL(req.url || "", "http://localhost");
  const token = url.searchParams.get("token") || "";
  let address: string;
  try {
    const payload = verifySession(token, jwtSecret);
    address = payload.sub;
  } catch {
    ws.close(4001, "unauthorized");
    return;
  }

  const roomId = url.searchParams.get("room") || "hub";
  const sx = url.searchParams.get("sx");
  const sz = url.searchParams.get("sz");
  let spawnHint: { x: number; z: number } | undefined;
  if (sx !== null && sz !== null) {
    const x = Number(sx);
    const z = Number(sz);
    if (Number.isFinite(x) && Number.isFinite(z)) {
      spawnHint = { x, z };
    }
  }
  addClient(roomId, ws, address, spawnHint);
});

const clientDist = path.join(__dirname, "../../client/dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api")) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

function logListenUrls(port: number, host: string): void {
  console.log(`nspace server listening on ${host}:${port}`);
  console.log(`  Local:   http://127.0.0.1:${port}/`);
  if (host === "0.0.0.0" || host === "::") {
    for (const nets of Object.values(networkInterfaces())) {
      for (const a of nets ?? []) {
        if (a.family === "IPv4" && !a.internal) {
          console.log(`  Network: http://${a.address}:${port}/`);
        }
      }
    }
  }
}

function shutdown(signal: string): void {
  console.log(`\n${signal} — flushing world state…`);
  flushPersistWorldStateSync();
  flushEventLogSync();
  flushCanvasClaimsSync();
  flushSignboardsSync();
  flushNimPayoutQueueSync();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

server.listen(PORT, HOST, () => {
  logListenUrls(PORT, HOST);
  if (DEV_AUTH_BYPASS) console.warn("DEV_AUTH_BYPASS enabled — not for production");
});
