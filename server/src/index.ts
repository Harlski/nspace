import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import fs from "node:fs";
import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import dotenv from "dotenv";
import { createNonce, consumeNonce, signSession, verifySession } from "./auth.js";
import {
  addClient,
  adminRandomExtraFloorLayout,
  startRoomTick,
} from "./rooms.js";
import { startGameWsMetricsFlushTimer } from "./gameWsMetrics.js";
import { flushPersistWorldStateSync } from "./worldPersistence.js";
import { verifySignedMessageDeriveAddress } from "./verifyNimiq.js";
import {
  getEventLogAnalyticsSnapshot,
  flushEventLogSync,
  getEventsForSession,
  listRecentPlayerAddresses,
  listSessionsForPlayer,
  type AnalyticsTimeWindow,
} from "./eventLog.js";
import { flushCanvasClaimsSync } from "./canvasCanvas.js";
import { flushSignboardsSync } from "./signboards.js";
import { flushVoxelTextsSync } from "./voxelTexts.js";
import { getTopMazeRecords } from "./mazeRecords.js";
import { installSwarmErrorForwarder } from "./swarmLogForwarder.js";
import {
  flushNimPayoutQueueSync,
  getNimPayoutWalletBalanceLuna,
  getPendingPayoutSnapshotForWallet,
  getPublicPendingPayoutAdminPanelSnapshot,
  getPublicPendingPayoutSnapshot,
  getPublicPendingPayoutSummary,
  manualBulkPayoutPendingForRecipient,
  isNimPayoutSenderConfigured,
  startNimPayoutProcessor,
} from "./nimPayout/index.js";
import { pendingPayoutsPublicPageHtml } from "./pendingPayoutsPublicPage.js";
import { analyticsPublicPageHtml } from "./analyticsPublicPage.js";
import { analyticsAdminPageHtml } from "./analyticsAdminPage.js";
import {
  type AnalyticsPageViewAnonReason,
  getAnalyticsPageViewsByDay,
  getRecentAnalyticsPageViews,
  recordAnalyticsPageViewEvent,
} from "./analyticsPageViews.js";
import {
  loadAnalyticsAllowlistFromDisk,
  saveAnalyticsAllowlistToDisk,
} from "./analyticsAllowlistStore.js";
import {
  getPlayerProfileMessage,
  setPlayerProfileMessage,
} from "./playerProfileStore.js";
import { nimiqIdenticonDataUrl } from "./nimiqIdenticonServer.js";

function analyticsDayStartUtcMs(dayStr: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayStr.trim());
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** `ym` is `YYYY-MM` (UTC calendar month). */
function utcMonthBoundsMs(ym: string): { fromTs: number; toTs: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(ym.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (!Number.isFinite(y) || mo < 1 || mo > 12) return null;
  const fromTs = Date.UTC(y, mo - 1, 1);
  const toTs = Date.UTC(y, mo, 0, 23, 59, 59, 999);
  return { fromTs, toTs };
}

function parseAnalyticsTimeWindowFromQuery(q: { [key: string]: unknown }):
  | { ok: true; range?: AnalyticsTimeWindow }
  | { ok: false; error: string } {
  const monthStr = String(q.month ?? "").trim();
  const dayStr = String(q.day ?? "").trim();
  if (monthStr) {
    const b = utcMonthBoundsMs(monthStr);
    if (!b) return { ok: false, error: "bad_month" };
    return { ok: true, range: { fromTs: b.fromTs, toTs: b.toTs } };
  }
  if (dayStr) {
    const start = analyticsDayStartUtcMs(dayStr);
    if (start == null) return { ok: false, error: "bad_day" };
    const toTs = start + 86_400_000 - 1;
    return { ok: true, range: { fromTs: start, toTs } };
  }
  return { ok: true, range: undefined };
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });
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
      "[FATAL] JWT_SECRET must be a strong random secret in production (not empty, not dev-insecure-change-me).\n" +
        "If you copied server/.env.example, replace JWT_SECRET=dev-insecure-change-me with a new value, e.g.:\n" +
        "  openssl rand -base64 32\n" +
        "Docker Compose loads server/.env via env_file — fix that file on the host, then recreate the container.\n" +
        "Check logs: docker logs --tail 80 <container_name>"
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

/** Trim and strip a single pair of surrounding quotes (common .env typo). */
function telegramEnvTrim(key: string): string {
  let v = String(process.env[key] ?? "").trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

const TELEGRAM_BOT_TOKEN = telegramEnvTrim("TELEGRAM_BOT_TOKEN");
const TELEGRAM_CHAT_ID = telegramEnvTrim("TELEGRAM_CHAT_ID");
const FEEDBACK_MAX_CHARS = 700;
const FEEDBACK_COOLDOWN_MS = 20_000;
const feedbackLastByAddress = new Map<string, number>();
const DEFAULT_ANALYTICS_AUTHORIZED_WALLET =
  "NQ97 4M1T 4TGD VC7F LHLQ Y2DY 425N 5CVH M02Y";

function parseAuthorizedWallets(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of String(raw || "").split(/[,\n;]+/)) {
    const cleaned = String(part || "").trim().replace(/^['"]|['"]$/g, "");
    const normalized = normalizeWalletId(cleaned);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

const analyticsAuthorizedWalletsRaw = String(
  process.env.ANALYTICS_AUTHORIZED_WALLETS ??
    process.env.ANALYTICS_AUTHORIZED_WALLET ??
    DEFAULT_ANALYTICS_AUTHORIZED_WALLET
).trim();
const analyticsManagerWalletsRaw = String(
  process.env.ANALYTICS_MANAGER_WALLETS ??
    analyticsAuthorizedWalletsRaw
).trim();
const envAnalyticsAuthorizedWallets = new Set(
  parseAuthorizedWallets(analyticsAuthorizedWalletsRaw)
);
const envAnalyticsManagerWallets = new Set(
  parseAuthorizedWallets(analyticsManagerWalletsRaw)
);
const persistedAnalyticsAllowlist = loadAnalyticsAllowlistFromDisk();
const analyticsAuthorizedWallets =
  persistedAnalyticsAllowlist?.wallets ?? envAnalyticsAuthorizedWallets;
const analyticsManagerWallets =
  persistedAnalyticsAllowlist?.managerWallets ?? envAnalyticsManagerWallets;
if (persistedAnalyticsAllowlist) {
  console.info(
    `[analytics] loaded persisted allowlist (${analyticsAuthorizedWallets.size} authorized, ${analyticsManagerWallets.size} managers)`
  );
}

function maskSecret(v: string, head = 4, tail = 3): string {
  if (!v) return "(empty)";
  if (v.length <= head + tail) return "*".repeat(v.length);
  return `${v.slice(0, head)}...${v.slice(-tail)}`;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/identicon/:wallet", async (req, res) => {
  const wallet = String(req.params.wallet || "").trim();
  if (!wallet) {
    res.status(400).json({ error: "missing_wallet" });
    return;
  }
  try {
    const identicon = await nimiqIdenticonDataUrl(wallet);
    res.json({ wallet, identicon });
  } catch (err) {
    console.error("[identicon]", err);
    res.status(500).json({ error: "internal" });
  }
});

/** Public read: short message shown on in-game player profile (normalized `NQ…` in path). */
app.get("/api/player-profile/:address", (req, res) => {
  try {
    const decoded = decodeURIComponent(String(req.params.address ?? "").trim());
    const addr = normalizeWalletId(decoded);
    if (!addr || addr.length < 4) {
      res.status(400).json({ error: "invalid_address" });
      return;
    }
    res.json({ message: getPlayerProfileMessage(addr) });
  } catch (err) {
    console.error("[player-profile/get]", err);
    res.status(500).json({ error: "internal" });
  }
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

function jwtAddressFromReq(req: Request): string | null {
  const t = bearerToken(req);
  if (!t) return null;
  try {
    return verifySession(t, jwtSecret).sub;
  } catch {
    return null;
  }
}

/** In-game profile description — max length matches client two-line sample string. */
const PROFILE_MESSAGE_MAX_LEN =
  "THISISONETHISITHISISONETHISITHISISONETHISITHISISONETHISITHISISO".length;

function sanitizeProfileMessageBody(raw: unknown): string {
  if (typeof raw !== "string") return "";
  let t = raw.replace(/\r\n|\r|\n/g, " ").replace(/\s+/g, " ").trim();
  if (t.length > PROFILE_MESSAGE_MAX_LEN) t = t.slice(0, PROFILE_MESSAGE_MAX_LEN);
  return t;
}

function normalizeWalletId(v: string): string {
  return String(v || "").replace(/\s+/g, "").toUpperCase();
}

function analyticsAuthStatus(req: Request): {
  authenticated: boolean;
  analyticsAuthorized: boolean;
  analyticsManager: boolean;
} {
  const t = bearerToken(req);
  if (!t) {
    return { authenticated: false, analyticsAuthorized: false, analyticsManager: false };
  }
  try {
    const payload = verifySession(t, jwtSecret);
    const signer = normalizeWalletId(payload.sub);
    return {
      authenticated: true,
      analyticsAuthorized: analyticsAuthorizedWallets.has(signer),
      analyticsManager: analyticsManagerWallets.has(signer),
    };
  } catch {
    return { authenticated: false, analyticsAuthorized: false, analyticsManager: false };
  }
}

function requireAnalyticsWallet(req: Request, res: Response, next: NextFunction): void {
  const t = bearerToken(req);
  if (!t) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  try {
    const payload = verifySession(t, jwtSecret);
    const signer = normalizeWalletId(payload.sub);
    if (analyticsAuthorizedWallets.size === 0 || !analyticsAuthorizedWallets.has(signer)) {
      res.status(403).json({ error: "not_authorized_for_activity" });
      return;
    }
    next();
  } catch {
    res.status(401).json({ error: "unauthorized" });
  }
}

function requireAnalyticsWalletAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const t = bearerToken(req);
  if (!t) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  try {
    const payload = verifySession(t, jwtSecret);
    const signer = normalizeWalletId(payload.sub);
    if (analyticsManagerWallets.size === 0 || !analyticsManagerWallets.has(signer)) {
      res.status(403).json({ error: "not_authorized_for_activity" });
      return;
    }
  } catch {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
}

async function sendTelegramFeedback(text: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn(
      "[feedback] Telegram env missing:",
      JSON.stringify({
        hasToken: Boolean(TELEGRAM_BOT_TOKEN),
        hasChatId: Boolean(TELEGRAM_CHAT_ID),
      })
    );
    return false;
  }
  // Token must stay literal (colon between id and secret); encoding breaks Telegram paths.
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  console.log(
    "[feedback] Telegram request:",
    JSON.stringify({
      urlHost: "api.telegram.org",
      chatIdMasked: maskSecret(TELEGRAM_CHAT_ID),
      textLength: text.length,
    })
  );
  try {
    const chatIdPayload =
      /^-?\d+$/.test(TELEGRAM_CHAT_ID) ? Number(TELEGRAM_CHAT_ID) : TELEGRAM_CHAT_ID;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatIdPayload,
        text,
        disable_web_page_preview: true,
      }),
    });
    const bodyText = await resp.text();
    console.log(
      "[feedback] Telegram response:",
      JSON.stringify({
        ok: resp.ok,
        status: resp.status,
        statusText: resp.statusText,
        body: bodyText.slice(0, 400),
      })
    );
    return resp.ok;
  } catch (err) {
    console.error("[feedback] Telegram fetch error:", err);
    return false;
  }
}

async function sendTelegramConnectNotice(address: string, roomId: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const text = `NSpace connect\nWallet: ${address}\nRoom: ${roomId}\nAt: ${new Date().toISOString()}`;
  try {
    const chatIdPayload =
      /^-?\d+$/.test(TELEGRAM_CHAT_ID) ? Number(TELEGRAM_CHAT_ID) : TELEGRAM_CHAT_ID;
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatIdPayload,
        text,
        disable_web_page_preview: true,
      }),
    });
  } catch (err) {
    console.error("[connect] Telegram notify failed:", err);
  }
}

app.get("/api/canvas/leaderboard", (_req, res) => {
  try {
    const top = getTopMazeRecords(10);
    res.json({ leaderboard: top });
  } catch (err) {
    console.error("[canvas/leaderboard]", err);
    res.status(500).json({ error: "internal" });
  }
});

const NIM_BALANCE_API_TIMEOUT_MS = Math.max(
  3000,
  Number(process.env.NIM_BALANCE_API_TIMEOUT_MS ?? 28_000)
);

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

app.get("/api/nim/payout-balance", async (_req, res) => {
  if (!isNimPayoutSenderConfigured()) {
    res.json({ configured: false, hasNim: false, balanceNim: "0.0000" });
    return;
  }
  try {
    const luna = await withTimeout(
      getNimPayoutWalletBalanceLuna(),
      NIM_BALANCE_API_TIMEOUT_MS,
      "getNimPayoutWalletBalanceLuna"
    );
    const balanceNim = (Number(luna) / 100_000).toFixed(4);
    res.json({
      configured: true,
      hasNim: luna > 0n,
      balanceNim,
    });
  } catch (err) {
    console.error("[nim/payout-balance]", err);
    res.status(503).json({
      error: "nim_unavailable",
      configured: true,
      hasNim: false,
      balanceNim: "0.0000",
    });
  }
});

/**
 * Pending payout data.
 * Without `Authorization: Bearer <jwt>`: aggregate summary only (no per-wallet rows).
 * With valid session: analytics manager wallets get the global queue + history
 * (`mode: "admin"`, capped at 10 pending + 5 completed rows). Use `?adminPanel=1` with
 * a manager JWT for a fast embed (totals, per-recipient pending summary, recent history text only, no identicons).
 * Other wallets get only jobs for `sub`, capped the same way.
 */
app.get("/api/nim/pending-payouts", async (req, res) => {
  try {
    const t = bearerToken(req);
    if (req.headers.authorization) {
      if (!t) {
        res.status(401).json({ error: "unauthorized" });
        return;
      }
      try {
        const payload = verifySession(t, jwtSecret);
        const addr = normalizeWalletId(String(payload.sub || "").trim());
        if (!addr) {
          res.status(401).json({ error: "unauthorized" });
          return;
        }
        if (analyticsManagerWallets.has(addr)) {
          const rawPanel = req.query["adminPanel"];
          const adminPanelLite =
            typeof rawPanel === "string" &&
            (rawPanel === "1" || rawPanel.toLowerCase() === "true");
          const snap = adminPanelLite
            ? getPublicPendingPayoutAdminPanelSnapshot()
            : await getPublicPendingPayoutSnapshot();
          res.json({ mode: "admin" as const, ...snap });
        } else {
          res.json(await getPendingPayoutSnapshotForWallet(addr));
        }
      } catch {
        res.status(401).json({ error: "unauthorized" });
      }
      return;
    }
    res.json(await getPublicPendingPayoutSummary());
  } catch (err) {
    console.error("[nim/pending-payouts]", err);
    res.status(500).json({ error: "internal" });
  }
});

app.post(
  "/api/nim/manual-bulk-payout",
  requireAnalyticsWalletAdmin,
  async (req, res) => {
    try {
      const body = req.body as { recipient?: string };
      const recipient = String(body?.recipient || "").trim();
      if (!recipient) {
        res.status(400).json({ error: "missing_recipient" });
        return;
      }
      const out = await manualBulkPayoutPendingForRecipient(recipient);
      res.json(out);
    } catch (err) {
      const code = err instanceof Error ? err.message : "internal";
      if (code === "no_pending_jobs") {
        res.status(400).json({ error: code });
        return;
      }
      if (code === "wallet_payout_race_retry") {
        res.status(409).json({ error: code });
        return;
      }
      if (code === "invalid_recipient" || code === "nim_payout_not_configured") {
        res.status(400).json({ error: code });
        return;
      }
      console.error("[nim/manual-bulk-payout]", err);
      res.status(503).json({ error: "payout_failed", detail: code });
    }
  }
);

/** Human-readable table; data from `/api/nim/pending-payouts`. */
app.get("/pending-payouts", (_req, res) => {
  res.type("html").send(pendingPayoutsPublicPageHtml());
});

/**
 * Dashboard-ready analytics from event logs.
 * Query: days (1–30), sessions (1–1000), payouts (1–1000).
 * Optional whole-period UTC filters: `day=YYYY-MM-DD`, `month=YYYY-MM` (mutually exclusive; month wins if both).
 * Extra query keys (e.g. `view`) are ignored.
 */
app.get("/api/analytics/overview", requireAnalyticsWallet, async (req, res) => {
  const maxDays = Math.min(30, Math.max(1, Number(req.query.days) || 7));
  const sessionLimit = Math.min(1000, Math.max(1, Number(req.query.sessions) || 300));
  const payoutLimit = Math.min(1000, Math.max(1, Number(req.query.payouts) || 300));
  const tw = parseAnalyticsTimeWindowFromQuery(req.query);
  if (!tw.ok) {
    res.status(400).json({ error: tw.error });
    return;
  }
  try {
    const analytics = await getEventLogAnalyticsSnapshot(
      maxDays,
      sessionLimit,
      payoutLimit,
      tw.range
    );
    res.json(analytics);
  } catch (err) {
    console.error("[analytics/overview]", err);
    res.status(500).json({ error: "internal" });
  }
});

app.get("/api/analytics/auth-status", (req: Request, res: Response) => {
  res.json(analyticsAuthStatus(req));
});

app.get("/api/analytics/authorized-wallets", requireAnalyticsWalletAdmin, (_req, res) => {
  res.json({
    wallets: Array.from(analyticsAuthorizedWallets.values()),
    managerWallets: Array.from(analyticsManagerWallets.values()),
  });
});

app.post("/api/analytics/authorized-wallets", requireAnalyticsWalletAdmin, (req, res) => {
  const wallet = normalizeWalletId(String((req.body as Record<string, unknown>)?.wallet ?? ""));
  if (!wallet) {
    res.status(400).json({ error: "missing_wallet" });
    return;
  }
  analyticsAuthorizedWallets.add(wallet);
  try {
    saveAnalyticsAllowlistToDisk(analyticsAuthorizedWallets, analyticsManagerWallets);
  } catch (err) {
    analyticsAuthorizedWallets.delete(wallet);
    console.error("[analytics/authorized-wallets] persist failed", err);
    res.status(500).json({ error: "persist_failed" });
    return;
  }
  res.json({ ok: true, wallets: Array.from(analyticsAuthorizedWallets.values()) });
});

app.delete(
  "/api/analytics/authorized-wallets",
  requireAnalyticsWalletAdmin,
  (req, res) => {
    const wallet = normalizeWalletId(
      String((req.body as Record<string, unknown>)?.wallet ?? "")
    );
    if (!wallet) {
      res.status(400).json({ error: "missing_wallet" });
      return;
    }
    const removed = analyticsAuthorizedWallets.delete(wallet);
    if (removed) {
      try {
        saveAnalyticsAllowlistToDisk(analyticsAuthorizedWallets, analyticsManagerWallets);
      } catch (err) {
        analyticsAuthorizedWallets.add(wallet);
        console.error("[analytics/authorized-wallets] persist failed", err);
        res.status(500).json({ error: "persist_failed" });
        return;
      }
    }
    res.json({ ok: true, removed, wallets: Array.from(analyticsAuthorizedWallets.values()) });
  }
);

/**
 * Daily counts + recent `/analytics` SPA beacons (`POST /api/analytics/page-view`), UTC days / newest first.
 * Manager wallets only. `recent` = max rows (1–500, default 120). Recent rows include `identicon` when `wallet` is set;
 * anonymous rows include `anonReason` (`no_token` | `invalid_session` | `not_on_allowlist` | `legacy`).
 */
app.get("/api/analytics/page-views", requireAnalyticsWalletAdmin, async (req, res) => {
  const days = Math.min(90, Math.max(1, Number(req.query.days) || 14));
  const recentRaw = req.query.recent;
  const recentParsed = Number(recentRaw);
  const recentLimit =
    recentRaw === undefined || recentRaw === "" || Number.isNaN(recentParsed)
      ? 120
      : Math.min(500, Math.max(0, Math.floor(recentParsed)));
  try {
    const byDay = getAnalyticsPageViewsByDay(days);
    if (recentLimit <= 0) {
      res.json({ byDay });
      return;
    }
    const rawRecent = getRecentAnalyticsPageViews(recentLimit);
    const iconCache = new Map<string, string>();
    for (const row of rawRecent) {
      if (!row.wallet || iconCache.has(row.wallet)) continue;
      try {
        iconCache.set(row.wallet, await nimiqIdenticonDataUrl(row.wallet));
      } catch {
        iconCache.set(row.wallet, "");
      }
    }
    const recent = rawRecent.map((row) => ({
      t: row.t,
      wallet: row.wallet,
      identicon: row.wallet ? (iconCache.get(row.wallet) ?? "") : "",
      anonReason: row.wallet ? null : row.anonReason,
    }));
    res.json({ byDay, recent });
  } catch (err) {
    console.error("[analytics/page-views]", err);
    res.status(500).json({ error: "internal" });
  }
});

/** Beacon from `/analytics` client: records time; wallet when Bearer is analytics-authorized. */
app.post("/api/analytics/page-view", (req, res) => {
  let wallet: string | null = null;
  let anonymousReason: AnalyticsPageViewAnonReason | null = null;
  const t = bearerToken(req);
  const tokenStr = t && String(t).trim() ? String(t).trim() : "";
  if (!tokenStr) {
    anonymousReason = "no_token";
  } else {
    try {
      const payload = verifySession(tokenStr, jwtSecret);
      const signer = normalizeWalletId(String(payload.sub || ""));
      if (!signer) {
        anonymousReason = "invalid_session";
      } else if (
        analyticsAuthorizedWallets.size > 0 &&
        analyticsAuthorizedWallets.has(signer)
      ) {
        wallet = signer;
      } else {
        anonymousReason = "not_on_allowlist";
      }
    } catch {
      anonymousReason = "invalid_session";
    }
  }
  recordAnalyticsPageViewEvent(wallet, wallet ? null : anonymousReason);
  res.json({ ok: true });
});

/** Visual analytics page (supply `?token=...`). */
app.get("/analytics", (_req, res) => {
  res.type("html").send(analyticsPublicPageHtml());
});

/** Visual admin page for analytics wallet permissions. */
app.get("/admin", (_req, res) => {
  res.type("html").send(analyticsAdminPageHtml());
});

/** Backward-compat redirect. */
app.get("/analytics/admin", (_req, res) => {
  res.redirect(302, "/admin");
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

app.post("/api/feedback", requireJwt, async (req, res) => {
  const address = jwtAddressFromReq(req);
  if (!address) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const raw = (req.body as Record<string, unknown> | null)?.message;
  const message = typeof raw === "string" ? raw.trim() : "";
  console.log(
    "[feedback] Received request:",
    JSON.stringify({
      address,
      messageLength: message.length,
    })
  );
  if (!message) {
    res.status(400).json({ error: "missing_message" });
    return;
  }
  if (message.length > FEEDBACK_MAX_CHARS) {
    res.status(400).json({ error: "message_too_long" });
    return;
  }
  const now = Date.now();
  const lastAt = feedbackLastByAddress.get(address) ?? 0;
  const retryAfterMs = FEEDBACK_COOLDOWN_MS - (now - lastAt);
  if (retryAfterMs > 0) {
    res.status(429).json({ error: "rate_limited", retryAfterMs });
    return;
  }
  feedbackLastByAddress.set(address, now);
  const ok = await sendTelegramFeedback(
    `NSpace feedback\nWallet: ${address}\n\n${message}`
  );
  if (!ok) {
    console.warn("[feedback] sendTelegramFeedback returned false");
    res.status(503).json({ error: "telegram_unavailable" });
    return;
  }
  console.log("[feedback] sent successfully", JSON.stringify({ address }));
  res.json({ ok: true });
});

/** Body: `{ "message": "…" }` — only the JWT wallet (`sub`) may update; max length enforced server-side. */
app.put("/api/player-profile/message", requireJwt, (req, res) => {
  const sub = jwtAddressFromReq(req);
  const signer = normalizeWalletId(sub ?? "");
  if (!signer) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const message = sanitizeProfileMessageBody(
    (req.body as Record<string, unknown> | null)?.message
  );
  try {
    const out = setPlayerProfileMessage(signer, message);
    res.json({ ok: true, message: out.message, updatedAt: out.updatedAt });
  } catch (err) {
    console.error("[player-profile/message]", err);
    res.status(500).json({ error: "internal" });
  }
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

  if (!nonce || !message || !signerPublicKey || !signature) {
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

  let sessionAddress: string | null = null;

  if (DEV_AUTH_BYPASS) {
    /** Dev wallet button sends `signer`; Nimiq Pay mini-app login sends empty `signer` + real key material. */
    if (normalizeWalletId(signer)) {
      sessionAddress = signer;
    } else if (signerPublicKey && signature) {
      try {
        const derived = await verifySignedMessageDeriveAddress(message, signerPublicKey, signature);
        if (!derived) {
          res.status(401).json({ error: "invalid_signature" });
          return;
        }
        sessionAddress = derived;
      } catch (e) {
        console.error("verifySignedMessageDeriveAddress (dev bypass)", e);
        res.status(401).json({ error: "invalid_signature" });
        return;
      }
    } else {
      res.status(400).json({ error: "missing_fields" });
      return;
    }
  } else {
    try {
      const derived = await verifySignedMessageDeriveAddress(message, signerPublicKey, signature);
      if (!derived) {
        res.status(401).json({ error: "invalid_signature" });
        return;
      }
      const claimed = normalizeWalletId(signer);
      if (claimed && claimed !== normalizeWalletId(derived)) {
        res.status(401).json({ error: "signer_mismatch" });
        return;
      }
      sessionAddress = derived;
    } catch (e) {
      console.error("verifySignedMessageDeriveAddress", e);
      res.status(401).json({ error: "invalid_signature" });
      return;
    }
  }

  if (!sessionAddress) {
    res.status(500).json({ error: "internal" });
    return;
  }
  /**
   * Mini-app sets `nimiqPayClient: true` plus `signer: ""` (see `client/src/auth/nimiq.ts`).
   * Require both so a random `nimiqPayClient` flag alone cannot label a Hub login.
   */
  const claimsPayClient = body.nimiqPayClient === true;
  const signerKeyPresent = Object.prototype.hasOwnProperty.call(body, "signer");
  const signerEmpty = signerKeyPresent && normalizeWalletId(signer) === "";
  const nimiqPay = claimsPayClient && signerEmpty;
  const token = signSession(sessionAddress, jwtSecret, { nimiqPay });
  res.json({ token, address: sessionAddress, nimiqPay });
});

const server = createServer(app);

const wss = new WebSocketServer({ server, path: "/ws" });

startRoomTick();
startGameWsMetricsFlushTimer();
startNimPayoutProcessor();

wss.on("connection", (ws, req) => {
  const url = new URL(req.url || "", "http://localhost");
  const token = url.searchParams.get("token") || "";
  let address: string;
  let sessionNimiqPay = false;
  try {
    const payload = verifySession(token, jwtSecret);
    address = payload.sub;
    sessionNimiqPay = payload.nimiqPay === true;
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
  addClient(roomId, ws, address, spawnHint, {
    nimiqPay: sessionNimiqPay,
  });
  void sendTelegramConnectNotice(address, roomId);
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
  flushVoxelTextsSync();
  flushNimPayoutQueueSync();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

server.listen(PORT, HOST, () => {
  logListenUrls(PORT, HOST);
  console.log(
    "[feedback] Telegram config:",
    JSON.stringify({
      hasToken: Boolean(TELEGRAM_BOT_TOKEN),
      hasChatId: Boolean(TELEGRAM_CHAT_ID),
      tokenMasked: maskSecret(TELEGRAM_BOT_TOKEN),
      chatIdMasked: maskSecret(TELEGRAM_CHAT_ID),
    })
  );
  if (DEV_AUTH_BYPASS) console.warn("DEV_AUTH_BYPASS enabled — not for production");
});
