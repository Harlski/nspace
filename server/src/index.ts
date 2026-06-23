import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import fs from "node:fs";
import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import dotenv from "dotenv";
import { timingSafeEqual } from "node:crypto";
import { createNonce, consumeNonce, signSession, verifySession, isGuestSession } from "./auth.js";
import { resolvePublicBaseUrl } from "./publicBaseUrl.js";
import { registerDirectInviteRoutes } from "./directInvite/httpHandlers.js";
import { registerPlaySpaceTemplateAdminRoutes } from "./playSpaceTemplate/routes.js";
import {
  isInviteLobbyRoomId,
  makeInviteLobbyRoomId,
} from "./directInvite/config.js";
import {
  addClient,
  adminRandomExtraFloorLayout,
  broadcastRestartPendingNotice,
  broadcastRoomCatalogRefresh,
  directInviteOnCreated,
  getHostDisplayNameForInvite,
  getLiveRealPlayerCountInRoom,
  getRoomFloorColorMapForThumbnail,
  getRoomLayoutSnapshot,
  getWalletCurrentRoomId,
  resolveResumeLogin,
  setDirectInvitePublicBaseUrl,
  snapshotChatHistoryForWallet,
  startRoomTick,
  syncPlayerProfileDisplayNameForWallet,
  walletHasOpenChallenge,
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
import {
  startDailyStatsScheduler,
  buildDailyStatsReport,
  sendDailyStatsReport,
  buildRolling24hReport,
  sendRolling24hReport,
  parseUtcDayStartMs,
  previousUtcDayStartMs,
} from "./dailyStatsReport.js";
import { flushCanvasClaimsSync } from "./canvasCanvas.js";
import { flushSignboardsSync } from "./signboards.js";
import {
  designToWire,
  flushDesignsSync,
  getDesignSnapshotForWallet,
  listPlaceableDesigns,
  listPublicDesigns,
} from "./designs.js";
import { flushBillboardsSync } from "./billboards.js";
import { flushVoxelTextsSync } from "./voxelTexts.js";
import { getTopMazeRecords } from "./mazeRecords.js";
// worldcup: seasonal soccer leaderboard API (feature-flagged, deletable)
import { WORLDCUP_ENABLED } from "./worldcup/config.js";
import {
  getLeaderboard as getWorldcupLeaderboard,
  getPlayerCountry as getWorldcupPlayerCountry,
} from "./worldcup/scoreStore.js";
import { installSwarmErrorForwarder } from "./swarmLogForwarder.js";
import {
  CHAMBER_ROOM_ID,
  isBuiltinRoomId,
  listDeletedRoomDefinitions,
  listRoomDefinitions,
  normalizeRoomId,
  PIXEL_ROOM_ID,
} from "./roomLayouts.js";
import {
  getDynamicRoomBuilderAddresses,
  normalizeBackgroundHuePatch,
  normalizeBackgroundNeutralPatch,
  normalizeBuilderAddressesPatch,
  updateDynamicRoomMetadata,
} from "./roomRegistry.js";
import {
  getBuiltinRoomBuilderAddresses,
  patchBuiltinRoomSettings,
} from "./builtinRoomNames.js";
import { renderRoomThumbnailPng } from "./roomThumbnailImage.js";
import { adminRoomsPageHtml } from "./adminRoomsPage.js";
import {
  hasAcceptedCurrentTermsPrivacyDocs,
  recordTermsPrivacyAcceptance,
} from "./termsPrivacyAcceptanceStore.js";
import { TERMS_PRIVACY_DOCS_VERSION } from "./termsPrivacyVersion.js";
import {
  getPayoutWalletBalanceLuna,
  getPendingSnapshotForWallet,
  getPublicPendingAdminPanelSnapshot,
  getPublicPendingSnapshot,
  getPublicPendingSummary,
  triggerManualBulkPayout,
  isPayoutSenderConfigured,
  peekPayoutBalanceCacheLuna,
  enqueuePayIntent,
  LUNA_PER_NIM,
} from "./payoutGateway.js";
import { startPayoutOutboxDeliveryLoop } from "./payoutOutbox.js";
import { startPayoutBalancePullLoop } from "./payoutBalancePull.js";
import { pendingPayoutsPublicPageHtml } from "./pendingPayoutsPublicPage.js";
import { analyticsPublicPageHtml } from "./analyticsPublicPage.js";
import { analyticsAdminPageHtml } from "./analyticsAdminPage.js";
import { adminSystemPageHtml } from "./adminSystemPage.js";
import { adminSettingsPageHtml } from "./adminSettingsPage.js";
import { adminHeaderPageHtml } from "./adminHeaderPage.js";
import { adminFeedbackPageHtml } from "./adminFeedbackPage.js";
import { adminCampaignPageHtml } from "./adminCampaignPage.js";
import { advertisePageHtml } from "./advertisePage.js";
import { advertiseGuidePageHtml } from "./advertiseGuidePage.js";
import {
  campaignUploadsDir,
  CAMPAIGN_IMAGE_UPLOAD_MAX_BYTES,
  ensureCampaignUploadsDir,
  isCampaignImageUploadContentType,
  parseCampaignImageBuffer,
  saveCampaignImageUpload,
} from "./campaignImageUpload.js";
import {
  billboardSlotDurationMs,
  ADVERTISE_FUND_RECIPIENT_ADDRESS,
  billboardSlotPriceLuna,
  campaignMinimumFundLuna,
  campaignPlacementModesForApi,
  campaignSlideDwellTiersForApi,
  campaignVisibilityEconomicsForApi,
  estimateCampaignDurationForApi,
  formatLunaAsNimLabel,
  isCampaignSlideDwellSec,
  nimAmountToLuna,
  nimFor24hVisibility,
  campaignPrepaidDisplayForApi,
  type CampaignPrepaidDisplay,
} from "./advertiseConfig.js";
import { billboardImageSpecForApi } from "./billboardImageSpec.js";
import {
  createCampaign,
  getCampaignForOwner,
  initCampaignStore,
  listCampaignsForOwner,
  listCampaignsPendingApproval,
  listApprovedCampaigns,
  listExpiredCampaigns,
  listUnfundedCampaigns,
  updateCampaignDraft,
  updateCampaignDisplayInterval,
  listCampaignTransactions,
  getCampaignById,
  repairInflatedCampaignBalances,
  sumCampaignFundingLuna,
  type CampaignPublic,
} from "./campaignStore.js";
import {
  getCampaignAnalyticsSummary,
  initCampaignAnalyticsStore,
  type CampaignAnalyticsSummary,
} from "./campaignAnalyticsStore.js";
import {
  approveCampaignForInGame,
  adminUpdateCampaignDetailsForInGame,
  createCampaignPaymentIntent,
  grantCampaignAdminCreditForInGame,
  rejectCampaignForInGame,
  syncCampaignPaymentStatus,
  syncOwnerCampaignsPaymentStatus,
  tickExpiredCampaignBillboards,
} from "./campaignFulfill.js";
import {
  initRotationSetStore,
  createRotationSet,
  deleteRotationSet,
  getRotationSetById,
  listRotationSets,
  listRotationSetSummaries,
  replaceRotationSetItems,
  updateRotationSetMeta,
  campaignIdsInRotationSets,
  listRotationSetIdsContainingCampaign,
} from "./rotationSetStore.js";
import { rebuildBillboardsForRotationSet } from "./rotationSetSync.js";
import { getPaymentIntent } from "./paymentIntentClient.js";
import { BILLBOARD_ADVERTS_CATALOG } from "./billboardAdvertsCatalog.js";
import { sendTelegramPlainText } from "./telegramNotify.js";
import {
  addAdminFeedbackMessage,
  addPlayerFeedbackMessage,
  composeReportTicketMessage,
  createFeedbackTicket,
  FEEDBACK_COOLDOWN_MS,
  FEEDBACK_MAX_CHARS,
  FEEDBACK_REPORT_REASON_MAX,
  FEEDBACK_REWARD_MAX_LUNA,
  FEEDBACK_REWARD_MIN_LUNA,
  getFeedbackTicketAdmin,
  getFeedbackTicketForWallet,
  listFeedbackTicketsAdmin,
  listFeedbackTicketsForWallet,
  markFeedbackTicketRewarded,
  parseFeedbackKindInput,
  parseFeedbackReportInput,
  patchFeedbackTicketStatus,
  ticketToAdminDetail,
  ticketToPlayerDetail,
  ticketToPlayerSummary,
  type FeedbackKind,
  type FeedbackReportContext,
  type FeedbackStatus,
} from "./feedbackTicketStore.js";
import {
  getAdminRuntimeSettings,
  patchAdminRuntimeSettings,
} from "./adminRuntimeSettingsStore.js";
import {
  getHeaderMarqueeSettings,
  patchHeaderMarqueeSettings,
  headerMarqueePublicVisible,
  sanitizeNewsMessagesList,
  type HeaderMarqueeSettings,
} from "./headerMarqueeSettingsStore.js";
import { getTopLoginStreaks, recordLoginStreakForWallet } from "./loginStreakStore.js";
import { getAdminSystemSnapshot, startAdminSystemMonitor } from "./adminSystemMonitor.js";
import { probePaymentIntentService } from "./paymentIntentProbe.js";
import { probePayoutService } from "./payoutServiceProbe.js";
import { getDeployRestartHookSecret, isAdmin, isStreamObserver, streamObserverAllowlistConfigured, streamObserverEnvConfigured } from "./config.js";
import { normalizeStreamObserverAddressesField } from "./walletAddresses.js";
import { getPixelBoardPngCached } from "./pixelBoardImage.js";
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
  adminClearPlayerUsername,
  adminSetUsernameOnTarget,
  getEffectivePlayerDisplayName,
  getPlayerProfilePublicJson,
  getUsernamePromptStatus,
  listKnownPlayerUsernames,
  playerHasCustomUsername,
  recordUsernamePromptDeferral,
  setPlayerProfileMessage,
  trySetPlayerUsername,
} from "./playerProfileStore.js";
import {
  isChannelMuted,
  isUsernameSetBanned,
  listModerationSnapshot,
  setChannelMuted,
  setUsernameSetBanned,
} from "./moderationStore.js";
import { listRoomsOwnedBy } from "./roomRegistry.js";
import { nimiqIdenticonDataUrl } from "./nimiqIdenticonServer.js";
import { walletDisplayName } from "./walletDisplayName.js";

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
const repoRootEnv = path.join(__dirname, "../../.env");
const serverEnv = path.join(__dirname, "../.env");
dotenv.config({ path: repoRootEnv });
dotenv.config({ path: serverEnv });
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
const jsonBody = express.json({ limit: "64kb" });
/** Binary image upload — skip JSON parser (base64 JSON was slow/hung on large bodies). */
const campaignImageUploadRaw = express.raw({
  limit: CAMPAIGN_IMAGE_UPLOAD_MAX_BYTES,
  type: (req) => isCampaignImageUploadContentType(String(req.headers["content-type"] ?? "")),
});
app.use((req, res, next) => {
  if (
    req.method === "POST" &&
    req.path === "/api/advertise/campaigns/upload-image"
  ) {
    return next();
  }
  return jsonBody(req, res, next);
});

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
const feedbackLastByAddress = new Map<string, number>();

function feedbackRateLimit(address: string, res: Response): boolean {
  const now = Date.now();
  const lastAt = feedbackLastByAddress.get(address) ?? 0;
  const retryAfterMs = FEEDBACK_COOLDOWN_MS - (now - lastAt);
  if (retryAfterMs > 0) {
    res.status(429).json({ error: "rate_limited", retryAfterMs });
    return true;
  }
  feedbackLastByAddress.set(address, now);
  return false;
}

function parseFeedbackStatusInput(raw: unknown): FeedbackStatus | null {
  const s = String(raw ?? "").trim();
  if (s === "open" || s === "answered" || s === "integrated" || s === "closed") return s;
  return null;
}
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

/** Must register before `GET /api/player-profile/:address` (otherwise `:address` captures `username-prompt`). */
app.get("/api/player-profile/username-prompt", requireJwt, (req, res) => {
  try {
    const sub = jwtAddressFromReq(req);
    const signer = normalizeWalletId(sub ?? "");
    if (!signer) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    res.json(getUsernamePromptStatus(signer));
  } catch (err) {
    console.error("[player-profile/username-prompt]", err);
    res.status(500).json({ error: "internal" });
  }
});

app.post("/api/player-profile/username/defer", requireJwt, (req, res) => {
  const sub = jwtAddressFromReq(req);
  const signer = normalizeWalletId(sub ?? "");
  if (!signer) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const result = recordUsernamePromptDeferral(signer);
  if (!result.ok) {
    const status = result.error === "username_prompt_required" ? 403 : 400;
    res.status(status).json({ error: result.error });
    return;
  }
  res.json({ ok: true, deferralsRemaining: result.deferralsRemaining });
});

/** Public read: profile message, display name, aliases (normalized `NQ…` in path). */
app.get("/api/player-profile/:address", (req, res) => {
  try {
    const decoded = decodeURIComponent(String(req.params.address ?? "").trim());
    const addr = normalizeWalletId(decoded);
    if (!addr || addr.length < 4) {
      res.status(400).json({ error: "invalid_address" });
      return;
    }
    const pub = getPlayerProfilePublicJson(addr) as Record<string, unknown>;
    pub.usernameSelfServiceEnabled =
      getAdminRuntimeSettings().playerUsernameSelfServiceEnabled;
    // Chosen country flag (reused from the World Cup country); shown on the profile card
    // and used for the player's own Flag Emote. Available regardless of the season gate.
    pub.country = getWorldcupPlayerCountry(addr);
    let canSeePrivateRooms = false;
    const t = bearerToken(req);
    if (t) {
      try {
        const sub = normalizeWalletId(verifySession(t, jwtSecret).sub);
        if (sub === addr) {
          pub.usernameSetBanned = isUsernameSetBanned(addr);
          pub.channelMuted = isChannelMuted(addr);
          canSeePrivateRooms = true;
        } else if (isAdmin(sub)) {
          pub.subjectUsernameBanned = isUsernameSetBanned(addr);
          pub.subjectChannelMuted = isChannelMuted(addr);
          canSeePrivateRooms = true;
        }
      } catch {
        /* ignore invalid bearer on public read */
      }
    }
    const ownedRooms = listRoomsOwnedBy(addr).filter(
      (room) => canSeePrivateRooms || room.isPublic === true
    );
    pub.rooms = ownedRooms
      .map((room) => ({
        ...room,
        playerCount: getLiveRealPlayerCountInRoom(room.id),
      }))
      .sort(
        (a, b) =>
          b.playerCount - a.playerCount ||
          a.displayName.localeCompare(b.displayName) ||
          a.id.localeCompare(b.id)
      )
      .slice(0, 3);
    res.json(pub);
  } catch (err) {
    console.error("[player-profile/get]", err);
    res.status(500).json({ error: "internal" });
  }
});

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
  systemAdmin: boolean;
} {
  const t = bearerToken(req);
  if (!t) {
    return {
      authenticated: false,
      analyticsAuthorized: false,
      analyticsManager: false,
      systemAdmin: false,
    };
  }
  try {
    const payload = verifySession(t, jwtSecret);
    const signer = normalizeWalletId(payload.sub);
    return {
      authenticated: true,
      analyticsAuthorized: analyticsAuthorizedWallets.has(signer),
      analyticsManager: analyticsManagerWallets.has(signer),
      systemAdmin: isAdmin(payload.sub),
    };
  } catch {
    return {
      authenticated: false,
      analyticsAuthorized: false,
      analyticsManager: false,
      systemAdmin: false,
    };
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

/** Game / ops admin (`ADMIN_ADDRESSES` in `config.ts`), not analytics managers. */
function requireSystemAdminWallet(req: Request, res: Response, next: NextFunction): void {
  const t = bearerToken(req);
  if (!t) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  try {
    const payload = verifySession(t, jwtSecret);
    if (!isAdmin(payload.sub)) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    next();
  } catch {
    res.status(401).json({ error: "unauthorized" });
  }
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
  await sendTelegramPlainText(
    `NSpace connect\nWallet: ${address}\nRoom: ${roomId}\nAt: ${new Date().toISOString()}`,
    "connect"
  );
}

function notifyUsernameSet(wallet: string, username: string): void {
  void sendTelegramPlainText(`Name Update:\n${wallet} -> ${username}`, "username");
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

// worldcup: public read of the seasonal soccer tally (404 when disabled)
app.get("/api/worldcup/leaderboard", (_req, res) => {
  if (!WORLDCUP_ENABLED) {
    res.status(404).json({ error: "worldcup_disabled" });
    return;
  }
  try {
    res.json(getWorldcupLeaderboard());
  } catch (err) {
    console.error("[worldcup/leaderboard]", err);
    res.status(500).json({ error: "internal" });
  }
});

/** Live 1000×1000 PNG of the Pixel room floor (2 px per tile). Public read-only. */
app.get("/pixels.png", (req, res) => {
  try {
    const { body, etag } = getPixelBoardPngCached();
    if (req.headers["if-none-match"] === etag) {
      res.status(304).end();
      return;
    }
    res.set("Content-Type", "image/png");
    res.set("Cache-Control", "public, max-age=5");
    res.set("ETag", etag);
    res.send(body);
  } catch (err) {
    console.error("[pixels.png]", err);
    res.status(500).end();
  }
});

const NIM_BALANCE_API_TIMEOUT_MS = Math.max(
  3000,
  Number(process.env.NIM_BALANCE_API_TIMEOUT_MS ?? 28_000)
);

/** When live balance read times out, still return 200 if cache is at most this old (ms). */
const NIM_BALANCE_API_STALE_MAX_MS = Math.max(
  0,
  Number(process.env.NIM_BALANCE_API_STALE_MAX_MS ?? 300_000)
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
  if (!isPayoutSenderConfigured()) {
    res.json({ configured: false, hasNim: false, balanceNim: "0.0000" });
    return;
  }
  try {
    const luna = await withTimeout(
      getPayoutWalletBalanceLuna(),
      NIM_BALANCE_API_TIMEOUT_MS,
      "getPayoutWalletBalanceLuna"
    );
    const balanceNim = (Number(luna) / 100_000).toFixed(4);
    res.json({
      configured: true,
      hasNim: luna > 0n,
      balanceNim,
    });
  } catch (err) {
    console.error("[nim/payout-balance]", err);
    if (NIM_BALANCE_API_STALE_MAX_MS > 0) {
      const peek = peekPayoutBalanceCacheLuna();
      const age = peek ? Date.now() - peek.cachedAtMs : Infinity;
      if (peek && age <= NIM_BALANCE_API_STALE_MAX_MS) {
        const balanceNim = (Number(peek.luna) / 100_000).toFixed(4);
        res.json({
          configured: true,
          hasNim: peek.luna > 0n,
          balanceNim,
          stale: true as const,
        });
        return;
      }
    }
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
app.get("/api/nim/payouts", async (req, res) => {
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
            ? await getPublicPendingAdminPanelSnapshot()
            : await getPublicPendingSnapshot();
          res.json({ mode: "admin" as const, ...snap });
        } else {
          res.json(await getPendingSnapshotForWallet(addr));
        }
      } catch {
        res.status(401).json({ error: "unauthorized" });
      }
      return;
    }
    res.json(await getPublicPendingSummary());
  } catch (err) {
    console.error("[nim/payouts]", err);
    res.status(500).json({ error: "internal" });
  }
});

/** @deprecated Use `GET /api/nim/payouts`. */
app.get("/api/nim/pending-payouts", (req, res) => {
  const i = req.originalUrl.indexOf("?");
  const q = i >= 0 ? req.originalUrl.slice(i) : "";
  res.redirect(301, `/api/nim/payouts${q}`);
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
      const out = await triggerManualBulkPayout(recipient);
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

/** Human-readable table; data from `GET /api/nim/payouts`. */
app.get("/payouts", (_req, res) => {
  res.type("html").send(pendingPayoutsPublicPageHtml());
});

/** @deprecated Use `GET /payouts`. */
app.get("/pending-payouts", (_req, res) => {
  res.redirect(301, "/payouts");
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

/**
 * Build (and optionally send) the end-of-day Telegram stats report on demand, for verifying
 * the report without waiting for the scheduled 00:00 UTC run.
 * Query: `day=YYYY-MM-DD` (UTC; defaults to the previous UTC day), `send=1` to actually push to Telegram.
 */
app.post("/api/admin/daily-stats/send", requireAnalyticsWalletAdmin, async (req, res) => {
  const dayParam = typeof req.query.day === "string" ? req.query.day : "";
  let dayStartMs: number;
  if (dayParam) {
    const parsed = parseUtcDayStartMs(dayParam);
    if (parsed == null) {
      res.status(400).json({ error: "invalid day (expected YYYY-MM-DD)" });
      return;
    }
    dayStartMs = parsed;
  } else {
    dayStartMs = previousUtcDayStartMs(Date.now());
  }
  const doSend = req.query.send === "1" || req.query.send === "true";
  try {
    const report = doSend
      ? await sendDailyStatsReport(dayStartMs)
      : await buildDailyStatsReport(dayStartMs);
    res.json({
      sent: doSend,
      aggregate: report.aggregate,
      message: report.message,
      worldcupMessage: report.worldcupMessage,
    });
  } catch (err) {
    console.error("[daily-stats] manual report", err);
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

/** Server diagnostics (event loop, memory, in-process log ring); JWT must be `ADMIN_ADDRESSES`. */
app.get("/admin/system", (_req, res) => {
  res.type("html").send(adminSystemPageHtml());
});

app.get("/admin/settings", (_req, res) => {
  res.type("html").send(adminSettingsPageHtml());
});

app.get("/admin/header", (_req, res) => {
  res.type("html").send(adminHeaderPageHtml());
});

app.get("/admin/feedback", (_req, res) => {
  res.type("html").send(adminFeedbackPageHtml());
});

app.get("/admin/campaign", (_req, res) => {
  res.type("html").send(adminCampaignPageHtml());
});

app.get("/admin/rooms", (_req, res) => {
  res.type("html").send(adminRoomsPageHtml());
});

app.get("/advertise", (_req, res) => {
  res.type("html").send(advertisePageHtml());
});

app.get("/advertise/how-it-works", (_req, res) => {
  res.type("html").send(advertiseGuidePageHtml());
});

ensureCampaignUploadsDir();
app.use(
  "/advertise/uploads",
  express.static(campaignUploadsDir(), {
    maxAge: "7d",
    immutable: true,
    fallthrough: false,
  })
);

app.post(
  "/api/advertise/campaigns/upload-image",
  campaignImageUploadRaw,
  requireJwt,
  (req, res) => {
  const sub = jwtAddressFromReq(req);
  const signer = normalizeWalletId(sub ?? "");
  if (!signer) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  const parsed = parseCampaignImageBuffer(buffer);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  try {
    const imageUrl = saveCampaignImageUpload(parsed.buffer, parsed.format);
    res.status(201).json({ imageUrl });
  } catch (e) {
    console.error("[api/advertise/upload-image]", e);
    res.status(500).json({ error: "upload_failed" });
  }
  }
);

app.get("/api/advertise/meta", (_req, res) => {
  const luna = billboardSlotPriceLuna();
  const nimWhole = luna / 100_000n;
  const nimFrac = Number(luna % 100_000n) / 100_000;
  const priceNimLabel =
    nimFrac > 0 ? `${nimWhole}.${String(nimFrac).slice(2, 7)}` : String(nimWhole);
  const minFundLuna = campaignMinimumFundLuna();
  const minFundWhole = minFundLuna / 100_000n;
  const minFundFrac = Number(minFundLuna % 100_000n) / 100_000;
  const minFundNimLabel =
    minFundFrac > 0
      ? `${minFundWhole}.${String(minFundFrac).slice(2, 7)}`
      : String(minFundWhole);
  const exampleFundNim = nimFor24hVisibility();
  res.json({
    priceLuna: luna.toString(),
    priceNimLabel,
    durationDays: Math.round(billboardSlotDurationMs() / (24 * 60 * 60 * 1000)),
    extendSlotPriceNimLabel: priceNimLabel,
    billboard: billboardImageSpecForApi(),
    fundRecipientAddress: ADVERTISE_FUND_RECIPIENT_ADDRESS,
    placementModes: campaignPlacementModesForApi(),
    slideDwellTiers: campaignSlideDwellTiersForApi(),
    visibilityEconomics: campaignVisibilityEconomicsForApi(),
    minimumFundNimLabel: minFundNimLabel,
    noMinimumFund: minFundLuna <= 1n,
    exampleFundNim24h: exampleFundNim,
    fundEstimateExample: estimateCampaignDurationForApi(
      exampleFundNim,
      10
    ),
    paymentIntentConfigured: Boolean(
      process.env.PAYMENT_INTENT_SERVICE_URL?.trim() &&
        process.env.PAYMENT_INTENT_API_SECRET?.trim()
    ),
  });
});

app.get("/api/advertise/estimate", (req, res) => {
  const fundRaw = String(req.query.fundNim ?? "").trim();
  const dwellQ = req.query.dwellSec;
  if (!/^\d+(\.\d+)?$/.test(fundRaw)) {
    res.status(400).json({ error: "invalid_fund_nim" });
    return;
  }
  let dwellSec: number | undefined;
  if (dwellQ !== undefined && dwellQ !== "") {
    const dwellRaw = Number(dwellQ);
    if (!isCampaignSlideDwellSec(dwellRaw)) {
      res.status(400).json({ error: "invalid_dwell_sec" });
      return;
    }
    dwellSec = Math.floor(dwellRaw);
  }
  res.json(estimateCampaignDurationForApi(Number(fundRaw), dwellSec));
});

type CampaignAdvertisePortal = CampaignPublic & {
  inRotationSet: boolean;
  analytics: CampaignAnalyticsSummary;
  prepaid: CampaignPrepaidDisplay;
};

function campaignTotalFundedLuna(campaignId: string): bigint {
  return sumCampaignFundingLuna(campaignId);
}

function enrichCampaignPrepaid(campaign: CampaignPublic): CampaignPrepaidDisplay {
  const totalFundedLuna = campaignTotalFundedLuna(campaign.id);
  return campaignPrepaidDisplayForApi({
    balanceLuna: campaign.balanceLuna,
    totalFundedLuna: totalFundedLuna > 0n ? totalFundedLuna : null,
    status: campaign.status,
    formatNim: formatLunaAsNimLabel,
  });
}

function enrichCampaignForAdvertisePortal(
  campaign: CampaignPublic,
  liveCampaignIds?: Set<string>
): CampaignAdvertisePortal {
  const inRotationSet =
    campaign.status === "approved" &&
    (liveCampaignIds
      ? liveCampaignIds.has(campaign.id)
      : listRotationSetIdsContainingCampaign(campaign.id).length > 0);
  return {
    ...campaign,
    inRotationSet,
    analytics: getCampaignAnalyticsSummary(campaign.id),
    prepaid: enrichCampaignPrepaid(campaign),
  };
}

app.get("/api/advertise/campaigns", requireJwt, async (req, res) => {
  const sub = jwtAddressFromReq(req);
  const signer = normalizeWalletId(sub ?? "");
  if (!signer) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  try {
    await syncOwnerCampaignsPaymentStatus(signer);
    const liveIds = campaignIdsInRotationSets();
    res.json({
      campaigns: listCampaignsForOwner(signer).map((c) =>
        enrichCampaignForAdvertisePortal(c, liveIds)
      ),
    });
  } catch (e) {
    console.error("[api/advertise/campaigns]", e);
    res.status(500).json({ error: "internal" });
  }
});

app.post("/api/advertise/campaigns", requireJwt, (req, res) => {
  const sub = jwtAddressFromReq(req);
  const signer = normalizeWalletId(sub ?? "");
  if (!signer) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const body = req.body as Record<string, unknown> | null;
  const created = createCampaign(signer, {
    projectName: String(body?.projectName ?? ""),
    miniappTargetUrl: String(body?.miniappTargetUrl ?? ""),
    imageUrl: String(body?.imageUrl ?? ""),
    displayIntervalSec: Number(body?.displayIntervalSec ?? 10),
  });
  if (!created) {
    res.status(400).json({ error: "invalid_campaign" });
    return;
  }
  res.status(201).json({ campaign: enrichCampaignForAdvertisePortal(created) });
});

app.get("/api/advertise/campaigns/:id/transactions", requireJwt, (req, res) => {
  const sub = jwtAddressFromReq(req);
  const signer = normalizeWalletId(sub ?? "");
  if (!signer) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const campaignId = String(req.params.id ?? "");
  const campaign = getCampaignForOwner(campaignId, signer);
  if (!campaign) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json({ transactions: listCampaignTransactions(campaignId) });
});

app.get("/api/advertise/campaigns/:id", requireJwt, (req, res) => {
  const sub = jwtAddressFromReq(req);
  const signer = normalizeWalletId(sub ?? "");
  if (!signer) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const campaign = getCampaignForOwner(String(req.params.id ?? ""), signer);
  if (!campaign) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json({ campaign: enrichCampaignForAdvertisePortal(campaign) });
});

app.put("/api/advertise/campaigns/:id", requireJwt, (req, res) => {
  const sub = jwtAddressFromReq(req);
  const signer = normalizeWalletId(sub ?? "");
  if (!signer) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const body = req.body as Record<string, unknown> | null;
  const campaignId = String(req.params.id ?? "");
  const displayIntervalSec =
    body && body.displayIntervalSec !== undefined
      ? Number(body.displayIntervalSec)
      : undefined;
  let updated = updateCampaignDraft(campaignId, signer, {
    projectName:
      body && Object.prototype.hasOwnProperty.call(body, "projectName")
        ? String(body.projectName ?? "")
        : undefined,
    miniappTargetUrl:
      body && Object.prototype.hasOwnProperty.call(body, "miniappTargetUrl")
        ? String(body.miniappTargetUrl ?? "")
        : undefined,
    imageUrl:
      body && Object.prototype.hasOwnProperty.call(body, "imageUrl")
        ? String(body.imageUrl ?? "")
        : undefined,
    displayIntervalSec,
  });
  if (!updated && displayIntervalSec !== undefined) {
    updated = updateCampaignDisplayInterval(campaignId, signer, displayIntervalSec);
  }
  if (!updated) {
    res.status(400).json({ error: "update_failed" });
    return;
  }
  res.json({ campaign: enrichCampaignForAdvertisePortal(updated) });
});

app.post("/api/advertise/campaigns/:id/intent", requireJwt, async (req, res) => {
  const sub = jwtAddressFromReq(req);
  const signer = normalizeWalletId(sub ?? "");
  if (!signer) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  try {
    const body = (req.body ?? {}) as { amountNim?: string | number };
    let amountLuna: bigint | undefined;
    if (
      body.amountNim === undefined ||
      body.amountNim === null ||
      String(body.amountNim).trim() === ""
    ) {
      res.status(400).json({ error: "amount_required" });
      return;
    }
    const parsed = nimAmountToLuna(String(body.amountNim));
    if (!parsed) {
      res.status(400).json({ error: "invalid_amount" });
      return;
    }
    amountLuna = parsed;
    const result = await createCampaignPaymentIntent(
      String(req.params.id ?? ""),
      signer,
      amountLuna
    );
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    const luna = /^\d+$/.test(result.intent.amountLuna)
      ? BigInt(result.intent.amountLuna)
      : amountLuna!;
    const amountNimLabel = formatLunaAsNimLabel(luna);
    res.json({
      campaign: enrichCampaignForAdvertisePortal(result.campaign),
      intent: {
        ...result.intent,
        amountLuna: luna.toString(),
        amountNimLabel,
      },
    });
  } catch (e) {
    console.error("[api/advertise/intent]", e);
    res.status(500).json({ error: "internal" });
  }
});

app.get("/api/advertise/campaigns/:id/intent", requireJwt, async (req, res) => {
  const sub = jwtAddressFromReq(req);
  const signer = normalizeWalletId(sub ?? "");
  if (!signer) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  try {
    const campaign = getCampaignForOwner(String(req.params.id ?? ""), signer);
    if (!campaign) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    if (!campaign.intentId) {
      res.status(404).json({ error: "no_intent" });
      return;
    }
    const pi = await getPaymentIntent(campaign.intentId);
    if (!pi.ok) {
      const status = pi.status === 404 ? 404 : 400;
      res.status(status).json({ error: pi.error });
      return;
    }
    const amountNimLabel = formatLunaAsNimLabel(pi.intent.amountLuna);
    res.json({
      campaign: enrichCampaignForAdvertisePortal(campaign),
      intent: {
        ...pi.intent,
        amountLuna: pi.intent.amountLuna,
        amountNimLabel,
      },
    });
  } catch (e) {
    console.error("[api/advertise/intent GET]", e);
    res.status(500).json({ error: "internal" });
  }
});

app.post("/api/advertise/campaigns/:id/sync", requireJwt, async (req, res) => {
  const sub = jwtAddressFromReq(req);
  const signer = normalizeWalletId(sub ?? "");
  if (!signer) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  try {
    const result = await syncCampaignPaymentStatus(
      String(req.params.id ?? ""),
      signer
    );
    if (!result.ok) {
      res.status(result.paymentPending ? 202 : 400).json({
        error: result.error,
        paymentPending: result.paymentPending ?? false,
        intentExpired: result.intentExpired ?? false,
        campaign: (() => {
          const c = getCampaignForOwner(String(req.params.id ?? ""), signer);
          return c ? enrichCampaignForAdvertisePortal(c) : null;
        })(),
      });
      return;
    }
    res.json({
      campaign: enrichCampaignForAdvertisePortal(result.campaign),
      paymentPending: result.paymentPending ?? false,
      topUpApplied: result.topUpApplied ?? false,
    });
  } catch (e) {
    console.error("[api/advertise/sync]", e);
    res.status(500).json({ error: "internal" });
  }
});

app.get(
  "/api/admin/advertise/campaigns/pending",
  requireSystemAdminWallet,
  (_req, res) => {
    res.json({ campaigns: listCampaignsPendingApproval() });
  }
);

app.get(
  "/api/admin/advertise/campaigns/:id/transactions",
  requireSystemAdminWallet,
  (req, res) => {
    const campaignId = String(req.params.id ?? "");
    if (!getCampaignById(campaignId)) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ transactions: listCampaignTransactions(campaignId) });
  }
);

app.post(
  "/api/admin/advertise/campaigns/:id/approve",
  requireSystemAdminWallet,
  async (req, res) => {
    try {
      const result = await approveCampaignForInGame(String(req.params.id ?? ""));
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json({ campaign: result.campaign });
    } catch (e) {
      console.error("[api/admin/advertise/approve]", e);
      res.status(500).json({ error: "internal" });
    }
  }
);

app.post(
  "/api/admin/advertise/campaigns/:id/reject",
  requireSystemAdminWallet,
  async (req, res) => {
    try {
      const note =
        req.body && typeof req.body.note === "string" ? req.body.note : undefined;
      const result = await rejectCampaignForInGame(
        String(req.params.id ?? ""),
        note
      );
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json({ campaign: result.campaign });
    } catch (e) {
      console.error("[api/admin/advertise/reject]", e);
      res.status(500).json({ error: "internal" });
    }
  }
);

app.patch(
  "/api/admin/advertise/campaigns/:id",
  requireSystemAdminWallet,
  async (req, res) => {
    try {
      const body = (req.body ?? {}) as {
        projectName?: string;
        miniappTargetUrl?: string;
      };
      const patch: { projectName?: string; miniappTargetUrl?: string } = {};
      if (typeof body.projectName === "string") patch.projectName = body.projectName;
      if (typeof body.miniappTargetUrl === "string") {
        patch.miniappTargetUrl = body.miniappTargetUrl;
      }
      const result = await adminUpdateCampaignDetailsForInGame(
        String(req.params.id ?? ""),
        patch
      );
      if (!result.ok) {
        const status =
          result.error === "campaign_not_found" ? 404 : 400;
        res.status(status).json({ error: result.error });
        return;
      }
      res.json({ campaign: result.campaign });
    } catch (e) {
      console.error("[api/admin/advertise/patch]", e);
      res.status(500).json({ error: "internal" });
    }
  }
);

app.post(
  "/api/admin/advertise/campaigns/:id/credit",
  requireSystemAdminWallet,
  async (req, res) => {
    try {
      const body = (req.body ?? {}) as { amountNim?: string | number };
      if (
        body.amountNim === undefined ||
        body.amountNim === null ||
        String(body.amountNim).trim() === ""
      ) {
        res.status(400).json({ error: "amount_required" });
        return;
      }
      const luna = nimAmountToLuna(String(body.amountNim));
      if (luna === null || luna < 1n) {
        res.status(400).json({ error: "invalid_amount" });
        return;
      }
      const result = await grantCampaignAdminCreditForInGame(
        String(req.params.id ?? ""),
        luna
      );
      if (!result.ok) {
        const status =
          result.error === "campaign_not_found" ? 404 : 400;
        res.status(status).json({ error: result.error });
        return;
      }
      res.json({ campaign: result.campaign });
    } catch (e) {
      console.error("[api/admin/advertise/credit]", e);
      res.status(500).json({ error: "internal" });
    }
  }
);

app.get("/api/admin/campaign/overview", requireSystemAdminWallet, (_req, res) => {
  const liveIds = campaignIdsInRotationSets();
  const enrich = (c: ReturnType<typeof listCampaignsPendingApproval>[number]) => {
    const txs = listCampaignTransactions(c.id);
    let totalFundedLuna = 0n;
    for (const t of txs) {
      try {
        totalFundedLuna += BigInt(t.amountLuna);
      } catch {
        /* ignore bad row */
      }
    }
    let remainingLuna = 0n;
    try {
      if (c.balanceLuna) remainingLuna = BigInt(c.balanceLuna);
    } catch {
      /* ignore */
    }
    const usedLuna =
      totalFundedLuna > remainingLuna ? totalFundedLuna - remainingLuna : 0n;
    return {
      ...c,
      ownerDisplayName: getEffectivePlayerDisplayName(c.ownerWallet),
      inRotationSet: liveIds.has(c.id),
      totalFundedLuna: totalFundedLuna.toString(),
      usedLuna: usedLuna.toString(),
      remainingLuna: remainingLuna.toString(),
      totalFundedNimLabel: formatLunaAsNimLabel(totalFundedLuna),
      usedNimLabel: formatLunaAsNimLabel(usedLuna),
      remainingNimLabel: formatLunaAsNimLabel(remainingLuna),
      analytics: getCampaignAnalyticsSummary(c.id),
      prepaid: enrichCampaignPrepaid(c),
    };
  };
  res.json({
    pendingCampaigns: listCampaignsPendingApproval().map(enrich),
    approvedCampaigns: listApprovedCampaigns().map(enrich),
    expiredCampaigns: listExpiredCampaigns().map(enrich),
    unfundedCampaigns: listUnfundedCampaigns().map(enrich),
    rotationSets: listRotationSets(),
    placeholders: BILLBOARD_ADVERTS_CATALOG.map((a) => ({
      id: a.id,
      name: a.name,
      imageUrl: a.slides[0] ?? "",
      visitUrl: a.visitUrl || a.miniappTargetUrl || "",
    })),
    audienceStatsAvailable: true,
  });
});

app.get(
  "/api/admin/campaign/rotation-sets/summary",
  requireSystemAdminWallet,
  (_req, res) => {
    res.json({ rotationSets: listRotationSetSummaries() });
  }
);

app.post("/api/admin/campaign/rotation-sets", requireSystemAdminWallet, (req, res) => {
  const body = req.body ?? {};
  const created = createRotationSet({
    name: String(body.name ?? ""),
    placeholderDwellSec:
      body.placeholderDwellSec !== undefined
        ? Number(body.placeholderDwellSec)
        : undefined,
    items: Array.isArray(body.items) ? body.items : undefined,
  });
  if (!created) {
    res.status(400).json({ error: "invalid_rotation_set" });
    return;
  }
  res.status(201).json({ rotationSet: created });
});

app.put(
  "/api/admin/campaign/rotation-sets/:id",
  requireSystemAdminWallet,
  (req, res) => {
    const id = String(req.params.id ?? "").trim();
    const body = req.body ?? {};
    let updated = updateRotationSetMeta(id, {
      name: body.name !== undefined ? String(body.name) : undefined,
      placeholderDwellSec:
        body.placeholderDwellSec !== undefined
          ? Number(body.placeholderDwellSec)
          : undefined,
    });
    if (!updated) {
      res.status(404).json({ error: "rotation_set_not_found" });
      return;
    }
    if (Array.isArray(body.items)) {
      updated = replaceRotationSetItems(id, body.items) ?? updated;
    }
    rebuildBillboardsForRotationSet(id);
    res.json({ rotationSet: getRotationSetById(id) });
  }
);

app.delete(
  "/api/admin/campaign/rotation-sets/:id",
  requireSystemAdminWallet,
  (req, res) => {
    const id = String(req.params.id ?? "").trim();
    if (!deleteRotationSet(id)) {
      res.status(404).json({ error: "rotation_set_not_found" });
      return;
    }
    res.json({ ok: true });
  }
);

app.get("/api/admin/system/snapshot", requireSystemAdminWallet, async (_req, res) => {
  try {
    const snapshot = getAdminSystemSnapshot();
    const [paymentIntent, payoutService] = await Promise.all([
      probePaymentIntentService(),
      probePayoutService(),
    ]);
    res.json({ ...snapshot, paymentIntent, payoutService });
  } catch (e) {
    console.error("[api/admin/system/snapshot]", e);
    res.status(500).json({ error: "internal" });
  }
});

/**
 * Send the stats report for the rolling last 24 hours to Telegram, on demand from `/admin/system`.
 * `preview=1` returns the built report without sending.
 */
app.post("/api/admin/system/daily-stats/send", requireSystemAdminWallet, async (req, res) => {
  const preview = req.query.preview === "1" || req.query.preview === "true";
  try {
    const report = preview
      ? await buildRolling24hReport()
      : await sendRolling24hReport();
    res.json({ sent: !preview, aggregate: report.aggregate, message: report.message });
  } catch (e) {
    console.error("[api/admin/system/daily-stats/send]", e);
    res.status(500).json({ error: "internal" });
  }
});

app.get("/api/admin/settings", requireSystemAdminWallet, (_req, res) => {
  res.json({
    ...getAdminRuntimeSettings(),
    streamObserverEnvConfigured: streamObserverEnvConfigured(),
    streamObserverAllowlistConfigured: streamObserverAllowlistConfigured(),
  });
});

app.put("/api/admin/settings", requireSystemAdminWallet, (req, res) => {
  const body = req.body as Record<string, unknown> | null;
  const patch: {
    playerUsernameSelfServiceEnabled?: boolean;
    streamObserverAddresses?: string;
  } = {};
  if (
    body &&
    Object.prototype.hasOwnProperty.call(body, "playerUsernameSelfServiceEnabled")
  ) {
    patch.playerUsernameSelfServiceEnabled =
      body.playerUsernameSelfServiceEnabled === true;
  }
  if (body && Object.prototype.hasOwnProperty.call(body, "streamObserverAddresses")) {
    try {
      patch.streamObserverAddresses = normalizeStreamObserverAddressesField(
        String(body.streamObserverAddresses ?? "")
      );
    } catch {
      res.status(400).json({ error: "invalid_stream_observer_address" });
      return;
    }
  }
  const next =
    Object.keys(patch).length > 0
      ? patchAdminRuntimeSettings(patch)
      : getAdminRuntimeSettings();
  res.json({
    ...next,
    streamObserverEnvConfigured: streamObserverEnvConfigured(),
    streamObserverAllowlistConfigured: streamObserverAllowlistConfigured(),
  });
});

app.get("/api/admin/header-marquee", requireSystemAdminWallet, (_req, res) => {
  res.json(getHeaderMarqueeSettings());
});

app.put("/api/admin/header-marquee", requireSystemAdminWallet, (req, res) => {
  const body = req.body as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    res.status(400).json({ error: "bad_body" });
    return;
  }
  const patch: Partial<HeaderMarqueeSettings> = {};
  if (Object.prototype.hasOwnProperty.call(body, "bannerEnabled")) {
    patch.bannerEnabled = body.bannerEnabled === true;
  }
  if (Object.prototype.hasOwnProperty.call(body, "loginStreakLeaderboardEnabled")) {
    patch.loginStreakLeaderboardEnabled =
      body.loginStreakLeaderboardEnabled === true;
  }
  if (Object.prototype.hasOwnProperty.call(body, "newsMessageEnabled")) {
    patch.newsMessageEnabled = body.newsMessageEnabled === true;
  }
  if (Object.prototype.hasOwnProperty.call(body, "newsMessages")) {
    patch.newsMessages = sanitizeNewsMessagesList(body.newsMessages);
  } else if (Object.prototype.hasOwnProperty.call(body, "newsMessage")) {
    patch.newsMessages = sanitizeNewsMessagesList([String(body.newsMessage ?? "")]);
  }
  if (Object.prototype.hasOwnProperty.call(body, "marqueeStreakSeconds")) {
    patch.marqueeStreakSeconds = Number(body.marqueeStreakSeconds);
  }
  if (Object.prototype.hasOwnProperty.call(body, "marqueeMessageSeconds")) {
    patch.marqueeMessageSeconds = Number(body.marqueeMessageSeconds);
  }
  res.json(patchHeaderMarqueeSettings(patch));
});

function disambiguateMarqueeLeaderboardLabels(
  wallets: string[],
  labels: string[]
): string[] {
  const countBy = new Map<string, number>();
  for (const l of labels) {
    countBy.set(l, (countBy.get(l) ?? 0) + 1);
  }
  return labels.map((label, i) => {
    if ((countBy.get(label) ?? 0) <= 1) return label;
    const w = wallets[i];
    return w ? `${label} (${walletDisplayName(w)})` : label;
  });
}

app.get("/api/header-marquee", async (_req, res) => {
  try {
    const settings = getHeaderMarqueeSettings();
    const top =
      settings.bannerEnabled && settings.loginStreakLeaderboardEnabled
        ? getTopLoginStreaks(10)
        : [];
    const newsMessages = settings.newsMessageEnabled
      ? sanitizeNewsMessagesList(settings.newsMessages)
      : [];
    const rawLabels = top.map((row) => getEffectivePlayerDisplayName(row.wallet));
    const displayLabels = disambiguateMarqueeLeaderboardLabels(
      top.map((r) => r.wallet),
      rawLabels
    );
    const leaderboard = [];
    for (let i = 0; i < top.length; i++) {
      const row = top[i]!;
      const identicon = await nimiqIdenticonDataUrl(row.wallet);
      leaderboard.push({
        walletId: row.wallet,
        displayLabel: displayLabels[i] ?? rawLabels[i] ?? "",
        streakDays: row.streakDays,
        identicon,
      });
    }
    const visible = headerMarqueePublicVisible(
      settings,
      leaderboard.length > 0,
      newsMessages
    );
    res.json({
      visible,
      bannerEnabled: settings.bannerEnabled,
      loginStreakLeaderboardEnabled: settings.loginStreakLeaderboardEnabled,
      newsMessageEnabled: settings.newsMessageEnabled,
      newsMessages,
      marqueeStreakSeconds: settings.marqueeStreakSeconds,
      marqueeMessageSeconds: settings.marqueeMessageSeconds,
      leaderboard,
    });
  } catch (e) {
    console.error("[api/header-marquee]", e);
    res.status(500).json({ error: "internal" });
  }
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

/** Admin room manager: full catalog with category + builder allowlists. */
/**
 * Known users for the builder-allowlist picker: recent players, anyone with a
 * custom username, room owners, and existing builders. Labels reuse the in-game
 * display-name resolution (custom username, else `NQAB…WXYZ` shorthand).
 */
app.get("/api/admin/users", requireSystemAdminWallet, (_req, res) => {
  const wallets = new Set<string>();
  const addWallet = (raw: string | null | undefined): void => {
    const w = String(raw ?? "")
      .replace(/\s+/g, "")
      .toUpperCase();
    if (/^NQ[0-9A-Z]{34}$/.test(w)) wallets.add(w);
  };
  for (const addr of listRecentPlayerAddresses(30, 1000)) addWallet(addr);
  for (const { wallet } of listKnownPlayerUsernames()) addWallet(wallet);
  for (const d of listRoomDefinitions()) {
    addWallet(d.ownerAddress);
    const builders = d.isBuiltin
      ? getBuiltinRoomBuilderAddresses(d.id)
      : getDynamicRoomBuilderAddresses(d.id);
    for (const b of builders) addWallet(b);
  }
  for (const d of listDeletedRoomDefinitions()) {
    addWallet(d.ownerAddress);
    for (const b of getDynamicRoomBuilderAddresses(d.id)) addWallet(b);
  }
  const users = [...wallets]
    .map((wallet) => {
      const username = playerHasCustomUsername(wallet)
        ? getEffectivePlayerDisplayName(wallet)
        : null;
      return {
        wallet,
        username,
        label: username || walletDisplayName(wallet),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label))
    .slice(0, 2000);
  res.json({ users });
});

app.get("/api/admin/rooms", requireSystemAdminWallet, (_req, res) => {
  const active = listRoomDefinitions().map((d) => {
    const category: "builtin" | "official" | "player" = d.isBuiltin
      ? "builtin"
      : d.isOfficial
        ? "official"
        : "player";
    return {
      id: d.id,
      displayName: d.displayName,
      ownerAddress: d.ownerAddress,
      category,
      isBuiltin: d.isBuiltin,
      isOfficial: Boolean(d.isOfficial),
      isPublic: d.isPublic,
      isDeleted: false,
      playerCount: getLiveRealPlayerCountInRoom(d.id),
      backgroundHueDeg: d.backgroundHueDeg ?? null,
      backgroundNeutral: d.backgroundNeutral ?? null,
      builderAddresses: d.isBuiltin
        ? getBuiltinRoomBuilderAddresses(d.id)
        : getDynamicRoomBuilderAddresses(d.id),
      builderEditable: true,
    };
  });
  const deleted = listDeletedRoomDefinitions().map((d) => ({
    id: d.id,
    displayName: d.displayName,
    ownerAddress: d.ownerAddress,
    category: (d.isOfficial ? "official" : "player") as "official" | "player",
    isBuiltin: false,
    isOfficial: Boolean(d.isOfficial),
    isPublic: d.isPublic,
    isDeleted: true,
    playerCount: 0,
    backgroundHueDeg: d.backgroundHueDeg ?? null,
    backgroundNeutral: d.backgroundNeutral ?? null,
    builderAddresses: getDynamicRoomBuilderAddresses(d.id),
    builderEditable: true,
  }));
  res.json({ rooms: [...active, ...deleted] });
});

/** Full layout snapshot for the interactive 3D preview. */
app.get("/api/admin/rooms/:id/layout", requireSystemAdminWallet, (req, res) => {
  const snapshot = getRoomLayoutSnapshot(String(req.params.id ?? ""));
  if (!snapshot) {
    res.status(404).json({ error: "room_not_found" });
    return;
  }
  res.json(snapshot);
});

/**
 * 2D top-down thumbnail PNG. Authenticated via `?token=` query (so an `<img>`
 * tag can load it) restricted to system admins.
 */
app.get("/api/admin/rooms/:id/thumbnail.png", (req, res) => {
  const token =
    bearerToken(req) || String((req.query.token as string | undefined) ?? "");
  let authorized = false;
  try {
    if (token) authorized = isAdmin(verifySession(token, jwtSecret).sub);
  } catch {
    authorized = false;
  }
  if (!authorized) {
    res.status(401).type("text/plain").send("unauthorized");
    return;
  }
  const roomId = normalizeRoomId(String(req.params.id ?? ""));
  const snapshot = getRoomLayoutSnapshot(roomId);
  if (!snapshot) {
    res.status(404).type("text/plain").send("room not found");
    return;
  }
  let body: Buffer;
  if (snapshot.spatial && roomId === PIXEL_ROOM_ID) {
    body = getPixelBoardPngCached().body;
  } else {
    const floor = getRoomFloorColorMapForThumbnail(roomId);
    if (!floor) {
      res.status(404).type("text/plain").send("room not found");
      return;
    }
    body = renderRoomThumbnailPng({
      bounds: floor.bounds,
      colorAt: floor.colorAt,
      obstacles: snapshot.obstacles.map((o) => ({
        x: o.x,
        z: o.z,
        y: o.y,
        colorRgb: o.colorRgb,
      })),
    });
  }
  res.setHeader("Cache-Control", "no-store");
  res.type("image/png").send(body);
});

/** Patch room properties (and, for dynamic rooms, the builder allowlist). */
app.put("/api/admin/rooms/:id", requireSystemAdminWallet, (req, res) => {
  const roomId = normalizeRoomId(String(req.params.id ?? ""));
  const adminAddr = jwtAddressFromReq(req) ?? "";
  const adminCompact = normalizeWalletId(adminAddr);
  const body = (req.body ?? {}) as Record<string, unknown>;

  const patch: {
    displayName?: string;
    isPublic?: boolean;
    backgroundHueDeg?: number | null;
    backgroundNeutral?: "black" | "white" | "gray" | null;
    joinSpawn?: { x: number; z: number } | null;
    builderAddresses?: string[];
  } = {};

  if (body.displayName !== undefined) {
    patch.displayName = String(body.displayName);
  }
  if (body.isPublic !== undefined) {
    patch.isPublic = Boolean(body.isPublic);
  }
  if (body.backgroundHueDeg !== undefined) {
    const hue = normalizeBackgroundHuePatch(body.backgroundHueDeg);
    if (!hue.ok) {
      res.status(400).json({ error: hue.reason });
      return;
    }
    patch.backgroundHueDeg = hue.hue;
  }
  if (body.backgroundNeutral !== undefined) {
    const neutral = normalizeBackgroundNeutralPatch(body.backgroundNeutral);
    if (!neutral.ok) {
      res.status(400).json({ error: neutral.reason });
      return;
    }
    patch.backgroundNeutral = neutral.neutral;
  }
  if (body.joinSpawn !== undefined) {
    if (body.joinSpawn === null) {
      patch.joinSpawn = null;
    } else {
      const js = body.joinSpawn as { x?: unknown; z?: unknown };
      const x = Number(js?.x);
      const z = Number(js?.z);
      if (!Number.isFinite(x) || !Number.isFinite(z)) {
        res.status(400).json({ error: "Invalid join spawn tile." });
        return;
      }
      patch.joinSpawn = { x, z };
    }
  }
  if (body.builderAddresses !== undefined) {
    const builders = normalizeBuilderAddressesPatch(body.builderAddresses);
    if (!builders.ok) {
      res.status(400).json({ error: builders.reason });
      return;
    }
    patch.builderAddresses = builders.builders;
  }

  if (isBuiltinRoomId(roomId)) {
    if (patch.joinSpawn !== undefined) {
      res
        .status(400)
        .json({ error: "Built-in rooms do not support a custom join spawn." });
      return;
    }
    const out = patchBuiltinRoomSettings(roomId, {
      displayName: patch.displayName,
      isPublic: patch.isPublic,
      backgroundHueDeg: patch.backgroundHueDeg,
      backgroundNeutral: patch.backgroundNeutral,
      builderAddresses: patch.builderAddresses,
    });
    if (!out.ok) {
      res.status(400).json({ error: out.reason });
      return;
    }
  } else {
    const out = updateDynamicRoomMetadata(roomId, patch, adminCompact, true);
    if (!out.ok) {
      res.status(400).json({ error: out.reason });
      return;
    }
  }

  broadcastRoomCatalogRefresh();
  res.json({ ok: true });
});

app.post("/api/feedback", requireJwt, async (req, res) => {
  const address = jwtAddressFromReq(req);
  if (!address) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const body = req.body as Record<string, unknown> | null;
  const raw = body?.message;
  const message = typeof raw === "string" ? raw.trim() : "";
  const sourceRaw = String(body?.source ?? "").trim();
  const source = sourceRaw === "report" ? "report" : "player";
  const kind = parseFeedbackKindInput(
    body?.kind,
    source === "report" ? "bug" : "suggestion"
  );
  if (!message) {
    res.status(400).json({ error: "missing_message" });
    return;
  }
  if (feedbackRateLimit(normalizeWalletId(address), res)) return;

  let ticketMessage = message;
  let reportContext: FeedbackReportContext | undefined;
  if (source === "report") {
    if (message.length > FEEDBACK_REPORT_REASON_MAX) {
      res.status(400).json({ error: "message_too_long" });
      return;
    }
    const parsed = parseFeedbackReportInput(body?.report);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const chatHistory = snapshotChatHistoryForWallet(
      parsed.ctx.reportedWallet,
      parsed.ctx.roomId
    );
    reportContext = {
      ...parsed.ctx,
      reportedUserChatHistory: chatHistory,
    };
    ticketMessage = composeReportTicketMessage(reportContext, message);
    if (ticketMessage.length > FEEDBACK_MAX_CHARS) {
      res.status(400).json({ error: "message_too_long" });
      return;
    }
  } else if (message.length > FEEDBACK_MAX_CHARS) {
    res.status(400).json({ error: "message_too_long" });
    return;
  }

  const created = createFeedbackTicket({
    wallet: address,
    kind,
    message: ticketMessage,
    source,
    reportContext,
  });
  if (!created.ok) {
    const err = created.error;
    if (err === "daily_ticket_limit") {
      res.status(429).json({ error: err });
      return;
    }
    res.status(400).json({ error: err });
    return;
  }

  const ticket = created.ticket;
  void sendTelegramFeedback(
    `NSpace feedback [${ticket.kind}] #${ticket.id.slice(0, 8)}\nWallet: ${address}\nStatus: ${ticket.status}\n\n${ticketMessage}`
  );
  console.log(
    "[feedback] ticket created",
    JSON.stringify({ address, ticketId: ticket.id, kind: ticket.kind })
  );
  res.json({ ok: true, ticketId: ticket.id, ticket: ticketToPlayerSummary(ticket) });
});

app.get("/api/feedback/mine", requireJwt, (req, res) => {
  const address = jwtAddressFromReq(req);
  if (!address) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const rows = listFeedbackTicketsForWallet(address);
  const tickets = rows.map(ticketToPlayerSummary);
  res.json({
    tickets,
    unreadCount: rows.filter((t) => ticketToPlayerSummary(t).unread).length,
  });
});

app.get("/api/feedback/:id", requireJwt, (req, res) => {
  const address = jwtAddressFromReq(req);
  if (!address) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const ticket = getFeedbackTicketForWallet(address, String(req.params.id ?? ""), {
    markRead: true,
  });
  if (!ticket) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json({ ticket: ticketToPlayerDetail(ticket) });
});

app.post("/api/feedback/:id/messages", requireJwt, (req, res) => {
  const address = jwtAddressFromReq(req);
  if (!address) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const raw = (req.body as Record<string, unknown> | null)?.message;
  const message = typeof raw === "string" ? raw.trim() : "";
  if (!message) {
    res.status(400).json({ error: "missing_message" });
    return;
  }
  if (feedbackRateLimit(normalizeWalletId(address), res)) return;

  const out = addPlayerFeedbackMessage({
    wallet: address,
    ticketId: String(req.params.id ?? ""),
    body: message,
  });
  if (!out.ok) {
    const status =
      out.error === "forbidden" ? 403 : out.error === "not_found" ? 404 : 400;
    res.status(status).json({ error: out.error });
    return;
  }
  res.json({ ok: true, ticket: ticketToPlayerDetail(out.ticket) });
});

app.get("/api/admin/feedback", requireSystemAdminWallet, (req, res) => {
  const status = parseFeedbackStatusInput(req.query.status);
  const kindRaw = String(req.query.kind ?? "").trim();
  const kind: FeedbackKind | undefined =
    kindRaw === "bug" || kindRaw === "feature" || kindRaw === "suggestion"
      ? kindRaw
      : undefined;
  const wallet = String(req.query.wallet ?? "").trim() || undefined;
  const limit = Number(req.query.limit);
  const offset = Number(req.query.offset);
  const out = listFeedbackTicketsAdmin({
    status: status ?? undefined,
    kind,
    wallet,
    limit: Number.isFinite(limit) ? limit : undefined,
    offset: Number.isFinite(offset) ? offset : undefined,
  });
  res.json({
    total: out.total,
    tickets: out.tickets.map(ticketToPlayerSummary),
    _filterStatus: status ?? "",
    _filterKind: kind ?? "",
    _filterWallet: wallet ?? "",
  });
});

app.get("/api/admin/feedback/:id", requireSystemAdminWallet, (req, res) => {
  const ticket = getFeedbackTicketAdmin(String(req.params.id ?? ""));
  if (!ticket) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json({ ticket: ticketToAdminDetail(ticket) });
});

app.post("/api/admin/feedback/:id/messages", requireSystemAdminWallet, (req, res) => {
  const adminWallet = jwtAddressFromReq(req);
  if (!adminWallet) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const raw = (req.body as Record<string, unknown> | null)?.message;
  const message = typeof raw === "string" ? raw.trim() : "";
  if (!message) {
    res.status(400).json({ error: "missing_message" });
    return;
  }
  const out = addAdminFeedbackMessage({
    adminWallet,
    ticketId: String(req.params.id ?? ""),
    body: message,
  });
  if (!out.ok) {
    res.status(out.error === "not_found" ? 404 : 400).json({ error: out.error });
    return;
  }
  res.json({ ok: true, ticket: ticketToPlayerDetail(out.ticket) });
});

app.patch("/api/admin/feedback/:id", requireSystemAdminWallet, (req, res) => {
  const status = parseFeedbackStatusInput((req.body as Record<string, unknown> | null)?.status);
  if (!status) {
    res.status(400).json({ error: "invalid_status" });
    return;
  }
  const out = patchFeedbackTicketStatus({
    ticketId: String(req.params.id ?? ""),
    status,
  });
  if (!out.ok) {
    res.status(out.error === "not_found" ? 404 : 400).json({ error: out.error });
    return;
  }
  res.json({ ok: true, ticket: ticketToPlayerDetail(out.ticket) });
});

app.post("/api/admin/feedback/:id/reward", requireSystemAdminWallet, (req, res) => {
  const ticketId = String(req.params.id ?? "");
  const ticket = getFeedbackTicketAdmin(ticketId);
  if (!ticket) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  const amountNim = Number((req.body as Record<string, unknown> | null)?.amountNim);
  if (!Number.isFinite(amountNim) || amountNim < 0.1 || amountNim > 2) {
    res.status(400).json({ error: "invalid_reward_amount" });
    return;
  }
  const amountLuna = BigInt(Math.round(amountNim * Number(LUNA_PER_NIM)));
  if (amountLuna < FEEDBACK_REWARD_MIN_LUNA || amountLuna > FEEDBACK_REWARD_MAX_LUNA) {
    res.status(400).json({ error: "invalid_reward_amount" });
    return;
  }
  const claimId = `feedback-${ticketId}`;
  const marked = markFeedbackTicketRewarded({ ticketId, amountLuna, claimId });
  if (!marked.ok) {
    res.status(400).json({ error: marked.error });
    return;
  }
  enqueuePayIntent({
    claimId,
    recipientAddress: ticket.wallet,
    amountLuna,
    roomId: "feedback",
    tileKey: "admin-reward",
    txMessage: "Nimiq Space — thank you for integrated feedback",
  });
  res.json({ ok: true, ticket: ticketToPlayerDetail(marked.ticket) });
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

app.put("/api/player-profile/username", requireJwt, (req, res) => {
  const sub = jwtAddressFromReq(req);
  const signer = normalizeWalletId(sub ?? "");
  if (!signer) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const selfService = getAdminRuntimeSettings().playerUsernameSelfServiceEnabled;
  const hasCustom = playerHasCustomUsername(signer);
  if (!isAdmin(signer) && !selfService && hasCustom) {
    res.status(403).json({ error: "username_self_service_disabled" });
    return;
  }
  const raw = (req.body as Record<string, unknown> | null)?.username;
  if (typeof raw !== "string") {
    res.status(400).json({ error: "missing_username" });
    return;
  }
  const result = trySetPlayerUsername(signer, raw, {
    skipCooldown: isAdmin(signer) || !hasCustom,
  });
  if (!result.ok) {
    const e = result.error;
    const status =
      e === "username_cooldown"
        ? 429
        : e === "username_taken"
          ? 409
          : 400;
    res.status(status).json({ error: e });
    return;
  }
  syncPlayerProfileDisplayNameForWallet(signer);
  notifyUsernameSet(signer, result.customUsername);
  res.json({
    ok: true,
    customUsername: result.customUsername,
    effectiveDisplayName: result.effectiveDisplayName,
    usernameLockedUntil: result.usernameLockedUntil,
  });
});

app.post("/api/admin/moderation", requireSystemAdminWallet, (req, res) => {
  const actor = normalizeWalletId(jwtAddressFromReq(req) ?? "");
  const body = req.body as Record<string, unknown> | null;
  const action = String(body?.action ?? "");
  const target = normalizeWalletId(String(body?.target ?? ""));
  if (!target || target.length < 4) {
    res.status(400).json({ error: "invalid_target" });
    return;
  }
  try {
    if (action === "clear_username") {
      adminClearPlayerUsername(target);
      syncPlayerProfileDisplayNameForWallet(target);
      res.json({ ok: true });
      return;
    }
    if (action === "username_ban") {
      setUsernameSetBanned(target, body?.banned === true, actor);
      res.json({ ok: true });
      return;
    }
    if (action === "channel_mute") {
      setChannelMuted(target, body?.muted === true, actor);
      res.json({ ok: true });
      return;
    }
    if (action === "set_username") {
      const uname = String(body?.username ?? "");
      const result = adminSetUsernameOnTarget(target, uname);
      if (!result.ok) {
        const e = result.error;
        const status =
          e === "username_cooldown"
            ? 429
            : e === "username_taken"
              ? 409
              : 400;
        res.status(status).json({ error: e });
        return;
      }
      syncPlayerProfileDisplayNameForWallet(target);
      notifyUsernameSet(target, result.customUsername);
      res.json({
        ok: true,
        customUsername: result.customUsername,
        effectiveDisplayName: result.effectiveDisplayName,
        usernameLockedUntil: result.usernameLockedUntil,
      });
      return;
    }
    res.status(400).json({ error: "unknown_action" });
  } catch (err) {
    console.error("[admin/moderation]", err);
    res.status(500).json({ error: "internal" });
  }
});

app.get("/api/admin/bans", requireSystemAdminWallet, (_req, res) => {
  res.json(listModerationSnapshot());
});

app.get("/admin/bans", requireSystemAdminWallet, (_req, res) => {
  res.json(listModerationSnapshot());
});

/**
 * Schedule a graceful process exit after `etaSeconds` and warn all game WebSockets.
 * Body: `{ "etaSeconds": number, "message"?: string }` — `etaSeconds` in **[5, 7200]**.
 * Re-posting replaces the previous schedule. Used by admin JWT and by the optional deploy hook.
 */
let announceRestartTimer: ReturnType<typeof setTimeout> | null = null;
let announceRestartSeq = 0;

function parseAnnounceRestartBody(
  body: Record<string, unknown> | null | undefined
):
  | { ok: true; eta: number; message: string | undefined }
  | { ok: false; status: number; json: Record<string, unknown> } {
  const eta = Math.floor(Number(body?.etaSeconds));
  if (!Number.isFinite(eta) || eta < 5 || eta > 7200) {
    return {
      ok: false,
      status: 400,
      json: { error: "invalid_eta_seconds", min: 5, max: 7200 },
    };
  }
  let message: string | undefined;
  if (typeof body?.message === "string") {
    const t = body.message.trim();
    if (t.length > 0) message = t.slice(0, 200);
  }
  return { ok: true, eta, message };
}

function bearerMatchesDeployHookSecret(
  token: string | null,
  secret: string
): boolean {
  if (!token) return false;
  const a = Buffer.from(token, "utf8");
  const b = Buffer.from(secret, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function scheduleRestartBroadcastAndExit(
  etaSeconds: number,
  message: string | undefined
): { seq: number; etaSeconds: number } {
  if (announceRestartTimer) {
    clearTimeout(announceRestartTimer);
    announceRestartTimer = null;
  }
  announceRestartSeq += 1;
  broadcastRestartPendingNotice(etaSeconds, message, announceRestartSeq);
  announceRestartTimer = setTimeout(() => {
    announceRestartTimer = null;
    shutdown("ANNOUNCED_RESTART");
  }, etaSeconds * 1000);
  return { seq: announceRestartSeq, etaSeconds: etaSeconds };
}

app.post("/api/admin/announce-restart", requireSystemAdminWallet, (req, res) => {
  const parsed = parseAnnounceRestartBody(
    req.body as Record<string, unknown> | null
  );
  if (!parsed.ok) {
    res.status(parsed.status).json(parsed.json);
    return;
  }
  const out = scheduleRestartBroadcastAndExit(parsed.eta, parsed.message);
  res.json({ ok: true, ...out });
});

/**
 * CI / VPS deploy script: same broadcast + exit schedule as `announce-restart`, but
 * `Authorization: Bearer <DEPLOY_RESTART_HOOK_SECRET>` (no JWT). Returns **404** when unset.
 */
app.post("/api/hooks/pre-deploy-restart", (req, res) => {
  const secret = getDeployRestartHookSecret();
  if (!secret) {
    res.status(404).json({ error: "not_configured" });
    return;
  }
  if (!bearerMatchesDeployHookSecret(bearerToken(req), secret)) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const parsed = parseAnnounceRestartBody(
    req.body as Record<string, unknown> | null
  );
  if (!parsed.ok) {
    res.status(parsed.status).json(parsed.json);
    return;
  }
  const out = scheduleRestartBroadcastAndExit(parsed.eta, parsed.message);
  res.json({ ok: true, ...out });
});


app.get("/api/designs", (req, res) => {
  const kind = req.query.kind === "room" ? "room" : req.query.kind === "object" ? "object" : undefined;
  const rows = listPublicDesigns({ kind, limit: 50 }).map(designToWire);
  res.json({ designs: rows });
});

app.get("/api/designs/placeable", (req, res) => {
  const kind = req.query.kind === "room" ? "room" : req.query.kind === "object" ? "object" : undefined;
  const address = jwtAddressFromReq(req);
  if (!address) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const rows = listPlaceableDesigns(address, {
    kind: kind ?? "object",
    limit: 80,
  }).map(designToWire);
  res.json({ designs: rows });
});

app.get("/api/designs/:id/snapshot", (req, res) => {
  const address = jwtAddressFromReq(req);
  if (!address) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const designId = String(req.params.id ?? "").trim();
  if (!designId) {
    res.status(400).json({ error: "invalid_id" });
    return;
  }
  const snapshot = getDesignSnapshotForWallet(address, designId);
  if (!snapshot) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json({ snapshot });
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

  const normAddr = normalizeWalletId(sessionAddress);
  const rawTp =
    typeof body.acceptedTermsPrivacyVersion === "string"
      ? String(body.acceptedTermsPrivacyVersion).trim()
      : "";
  const rawLegacy =
    typeof body.acceptedLegalVersion === "string" ? String(body.acceptedLegalVersion).trim() : "";
  const acceptedTermsPrivacy = rawTp || rawLegacy;
  if (!hasAcceptedCurrentTermsPrivacyDocs(normAddr)) {
    if (acceptedTermsPrivacy !== TERMS_PRIVACY_DOCS_VERSION) {
      res.status(403).json({
        error: "terms_privacy_ack_required",
        requiredVersion: TERMS_PRIVACY_DOCS_VERSION,
      });
      return;
    }
    recordTermsPrivacyAcceptance(normAddr, TERMS_PRIVACY_DOCS_VERSION);
  }

  const token = signSession(sessionAddress, jwtSecret, { nimiqPay });
  try {
    recordLoginStreakForWallet(normalizeWalletId(sessionAddress));
  } catch (e) {
    console.error("[login-streak]", e);
  }
  const usernamePrompt = getUsernamePromptStatus(normAddr);
  res.json({
    token,
    address: sessionAddress,
    nimiqPay,
    usernamePrompt,
  });
});

const PUBLIC_BASE_URL = resolvePublicBaseUrl(NODE_ENV);
setDirectInvitePublicBaseUrl(PUBLIC_BASE_URL);
if (NODE_ENV !== "production") {
  console.log(`Play Space share links: ${PUBLIC_BASE_URL}/join/{slug}`);
}

registerDirectInviteRoutes(app, {
  jwtSecret,
  publicBaseUrl: PUBLIC_BASE_URL,
  getHostDisplayName: getHostDisplayNameForInvite,
  getHostOriginRoomId: getWalletCurrentRoomId,
  hostHasOpenChallenge: walletHasOpenChallenge,
  onInviteCreated: directInviteOnCreated,
});
registerPlaySpaceTemplateAdminRoutes(app, requireSystemAdminWallet);

const server = createServer(app);

const wss = new WebSocketServer({ server, path: "/ws" });

initCampaignStore();
initCampaignAnalyticsStore();
const repairedCampaignBalances = repairInflatedCampaignBalances();
if (repairedCampaignBalances > 0) {
  console.log(
    `[campaigns] repaired ${repairedCampaignBalances} inflated prepaid balance(s)`
  );
}
initRotationSetStore();
startRoomTick();
setInterval(() => {
  try {
    tickExpiredCampaignBillboards(Date.now());
  } catch (e) {
    console.error("[campaigns] expiry tick", e);
  }
}, 60_000);
startAdminSystemMonitor();
startGameWsMetricsFlushTimer();
startPayoutOutboxDeliveryLoop();
startPayoutBalancePullLoop();
startDailyStatsScheduler();

wss.on("connection", (ws, req) => {
  const url = new URL(req.url || "", "http://localhost");
  const token = url.searchParams.get("token") || "";
  let address: string;
  let sessionNimiqPay = false;
  let guestDisplayName: string | undefined;
  let guestId: string | undefined;
  let guestInviteSlug: string | undefined;
  try {
    const payload = verifySession(token, jwtSecret);
    address = payload.sub;
    sessionNimiqPay = payload.nimiqPay === true;
    if (isGuestSession(payload)) {
      guestDisplayName = payload.displayName;
      guestId = payload.guestId;
      guestInviteSlug = payload.inviteSlug;
    }
  } catch {
    ws.close(4001, "unauthorized");
    return;
  }

  const roomIdParam = url.searchParams.get("room") || CHAMBER_ROOM_ID;
  const sx = url.searchParams.get("sx");
  const sz = url.searchParams.get("sz");
  const resumeSession = url.searchParams.get("resume") === "1";
  let spawnHint: { x: number; z: number } | undefined;
  if (sx !== null && sz !== null) {
    const x = Number(sx);
    const z = Number(sz);
    if (Number.isFinite(x) && Number.isFinite(z)) {
      spawnHint = { x, z };
    }
  }
  const streamRequested = url.searchParams.get("stream") === "1";
  if (streamRequested && !isStreamObserver(address)) {
    ws.close(4403, "stream_unauthorized");
    return;
  }
  let roomId = roomIdParam;
  // Honor an explicit Play Space target: `resume=1` must not override it back to chamber
  // (a fresh guest has no prior session, so resume would otherwise drop them in the hub).
  const targetIsPlaySpace = isInviteLobbyRoomId(normalizeRoomId(roomIdParam));
  if (resumeSession && !streamRequested && !targetIsPlaySpace) {
    const resolved = resolveResumeLogin(address);
    roomId = resolved.roomId;
    spawnHint = { x: resolved.spawn.x, z: resolved.spawn.z };
  }
  // Guest confinement: a guest may only ever connect into their own Play Space. Any other
  // requested/resumed room is forced back to it; a guest with no invite slug is rejected.
  if (guestId !== undefined) {
    const allowedLobby = guestInviteSlug
      ? normalizeRoomId(makeInviteLobbyRoomId(guestInviteSlug))
      : null;
    if (!allowedLobby) {
      ws.close(4003, "guest_no_invite");
      return;
    }
    if (normalizeRoomId(roomId) !== allowedLobby) {
      roomId = allowedLobby;
      spawnHint = undefined;
    }
  }
  addClient(roomId, ws, address, spawnHint, {
    nimiqPay: sessionNimiqPay,
    streamObserver: streamRequested,
    guestDisplayName,
    guestId,
  });
  void sendTelegramConnectNotice(address, roomId);
});

const clientDist = path.join(__dirname, "../../client/dist");

function sendTermsPrivacyPage(res: Response, htmlFileName: string): void {
  const resolved = path.join(clientDist, htmlFileName);
  if (!fs.existsSync(resolved)) {
    res.status(404).type("text/plain").send(`${htmlFileName} not built (missing client/dist asset)`);
    return;
  }
  res.sendFile(resolved);
}

if (fs.existsSync(clientDist)) {
  app.get(["/tacs", "/tacs/"], (_req, res) => {
    sendTermsPrivacyPage(res, "tacs.html");
  });
  app.get(["/privacy", "/privacy/"], (_req, res) => {
    sendTermsPrivacyPage(res, "privacy.html");
  });
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
  if (announceRestartTimer) {
    clearTimeout(announceRestartTimer);
    announceRestartTimer = null;
  }
  console.log(`\n${signal} — flushing world state…`);
  flushPersistWorldStateSync();
  flushEventLogSync();
  flushCanvasClaimsSync();
  flushSignboardsSync();
  flushDesignsSync();
  flushBillboardsSync();
  flushVoxelTextsSync();
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
  if (!streamObserverAllowlistConfigured()) {
    console.warn(
      "[stream] No stream observer wallets configured — set `/admin/settings` or STREAM_OBSERVER_ADDRESSES; ?stream=1 is disabled"
    );
  }
});
