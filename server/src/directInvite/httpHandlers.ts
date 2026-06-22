import type { Request, Response } from "express";

import {
  signGuestSession,
  signUpgradedGuestSession,
  verifySession,
  type SessionPayload,
} from "../auth.js";
import { pickDirectInviteGuestName } from "../guestNames.js";
import { DIRECT_INVITE_ENABLED, GUEST_SESSION_TTL_SEC } from "./config.js";
import { getParticipant, sanitizeGuestNickname, evaluatePeek } from "./reducer.js";
import {
  claimInvite,
  createInvite,
  getInviteBySlug,
  joinInviteAsWallet,
  setInviteNickname,
  upgradeInviteGuestWallet,
} from "./store.js";
import { generateGuestId } from "./store.js";

export type DirectInviteHttpDeps = {
  jwtSecret: string;
  publicBaseUrl: string;
  getHostDisplayName: (wallet: string) => string;
  onInviteCreated: (invite: import("./types.js").DirectInviteRecord) => void;
  getHostOriginRoomId: (wallet: string) => string | null;
  hostHasOpenChallenge: (wallet: string) => boolean;
};

const GUEST_ID_COOKIE = "nspace_guest_id";

function readGuestIdCookie(req: Request): string | null {
  const raw = req.headers.cookie ?? "";
  const match = raw.match(new RegExp(`(?:^|;\\s*)${GUEST_ID_COOKIE}=([^;]+)`));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]!);
  } catch {
    return null;
  }
}

function setGuestIdCookie(res: Response, guestId: string): void {
  res.setHeader(
    "Set-Cookie",
    `${GUEST_ID_COOKIE}=${encodeURIComponent(guestId)}; Path=/; Max-Age=${GUEST_SESSION_TTL_SEC}; SameSite=Lax`
  );
}

function requireWalletJwt(req: Request, deps: DirectInviteHttpDeps): SessionPayload | null {
  const auth = req.headers.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  try {
    const payload = verifySession(token, deps.jwtSecret);
    if (payload.guest) return null;
    return payload;
  } catch {
    return null;
  }
}

function requireGuestJwt(req: Request, deps: DirectInviteHttpDeps): SessionPayload | null {
  const auth = req.headers.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  try {
    const payload = verifySession(token, deps.jwtSecret);
    if (!payload.guest || !payload.guestId) return null;
    return payload;
  } catch {
    return null;
  }
}

export function registerDirectInviteRoutes(
  app: import("express").Express,
  deps: DirectInviteHttpDeps
): void {
  app.post("/api/invite/create", (req, res) => {
    if (!DIRECT_INVITE_ENABLED) {
      res.status(404).json({ error: "disabled" });
      return;
    }
    const payload = requireWalletJwt(req, deps);
    if (!payload) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const activity = String(body.activity ?? "");
    if (activity !== "worldcup-match") {
      res.status(400).json({ error: "invalid_activity" });
      return;
    }
    const originRoomId = deps.getHostOriginRoomId(payload.sub);
    if (!originRoomId) {
      res.status(409).json({ error: "not_in_room" });
      return;
    }
    if (deps.hostHasOpenChallenge(payload.sub)) {
      res.status(409).json({ error: "challenge_open" });
      return;
    }
    const invite = createInvite({
      hostWallet: payload.sub,
      hostOriginRoomId: originRoomId,
      activity: "worldcup-match",
    });
    deps.onInviteCreated(invite);
    const url = `${deps.publicBaseUrl.replace(/\/$/, "")}/join/${invite.slug}`;
    res.json({
      slug: invite.slug,
      url,
      lobbyRoomId: invite.lobbyRoomId,
      expiresAt: invite.expiresAtMs,
    });
  });

  app.get("/api/invite/peek/:slug", (req, res) => {
    if (!DIRECT_INVITE_ENABLED) {
      res.status(404).json({ error: "disabled" });
      return;
    }
    const slug = String(req.params.slug ?? "").trim();
    if (!slug) {
      res.status(400).json({ error: "missing_slug" });
      return;
    }
    const guestId = readGuestIdCookie(req);
    const invite = getInviteBySlug(slug);
    const peek = evaluatePeek(invite, guestId, Date.now());
    if (!peek.ok) {
      res.status(peek.code === "not_found" ? 404 : 200).json({
        slug,
        joinable: false,
        reclaimable: false,
        error: peek.code,
      });
      return;
    }
    res.json({
      slug,
      hostDisplayName: deps.getHostDisplayName(peek.invite.hostWallet),
      lobbyRoomId: peek.invite.lobbyRoomId,
      expiresAt: peek.invite.expiresAtMs,
      joinable: true,
      reclaimable: peek.reclaimable,
    });
  });

  app.post("/api/invite/join-wallet/:slug", (req, res) => {
    if (!DIRECT_INVITE_ENABLED) {
      res.status(404).json({ error: "disabled" });
      return;
    }
    const walletPayload = requireWalletJwt(req, deps);
    if (!walletPayload) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const slug = String(req.params.slug ?? "").trim();
    if (!slug) {
      res.status(400).json({ error: "missing_slug" });
      return;
    }
    let guestId = readGuestIdCookie(req);
    if (!guestId) guestId = generateGuestId();
    const displayName = deps.getHostDisplayName(walletPayload.sub);
    const joined = joinInviteAsWallet(
      slug,
      guestId,
      walletPayload.sub,
      displayName
    );
    if (!joined.ok) {
      res.status(joined.code === "not_found" ? 404 : 409).json({ error: joined.code });
      return;
    }
    const invite = joined.invite;
    const token = signUpgradedGuestSession(
      guestId,
      walletPayload.sub,
      displayName,
      deps.jwtSecret,
      {
        inviteSlug: slug,
        nimiqPay: walletPayload.nimiqPay,
        ttlSec: GUEST_SESSION_TTL_SEC,
      }
    );
    setGuestIdCookie(res, guestId);
    res.json({
      token,
      guestId,
      address: `guest:${guestId}`,
      displayName,
      lobbyRoomId: invite.lobbyRoomId,
      slug,
      expiresAt: invite.expiresAtMs,
    });
  });

  app.get("/api/invite/redeem/:slug", (req, res) => {
    if (!DIRECT_INVITE_ENABLED) {
      res.status(404).json({ error: "disabled" });
      return;
    }
    const slug = String(req.params.slug ?? "").trim();
    if (!slug) {
      res.status(400).json({ error: "missing_slug" });
      return;
    }
    let guestId = readGuestIdCookie(req);
    if (!guestId) guestId = generateGuestId();
    const claim = claimInvite(slug, guestId);
    if (!claim.ok) {
      res.status(claim.code === "not_found" ? 404 : 409).json({ error: claim.code });
      return;
    }
    const invite = claim.invite;
    const existing = getParticipant(invite, guestId);
    const suggestedName =
      existing?.displayName ?? pickDirectInviteGuestName(Math.random);
    const token = signGuestSession(guestId, suggestedName, deps.jwtSecret, {
      inviteSlug: slug,
      ttlSec: GUEST_SESSION_TTL_SEC,
    });
    setGuestIdCookie(res, guestId);
    res.json({
      token,
      guestId,
      suggestedNickname: suggestedName,
      hostDisplayName: deps.getHostDisplayName(invite.hostWallet),
      lobbyRoomId: invite.lobbyRoomId,
      expiresAt: invite.expiresAtMs,
      slug,
    });
  });

  app.post("/api/invite/nickname", (req, res) => {
    if (!DIRECT_INVITE_ENABLED) {
      res.status(404).json({ error: "disabled" });
      return;
    }
    const payload = requireGuestJwt(req, deps);
    if (!payload?.guestId) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const nicknameRaw = String(body.nickname ?? "");
    const nickname = sanitizeGuestNickname(nicknameRaw);
    if (!nickname) {
      res.status(400).json({ error: "invalid_nickname" });
      return;
    }
    const slug = payload.inviteSlug ?? "";
    if (!slug) {
      res.status(400).json({ error: "missing_invite" });
      return;
    }
    const updated = setInviteNickname(slug, payload.guestId, nickname);
    if (!updated) {
      res.status(409).json({ error: "invite_mismatch" });
      return;
    }
    const token = signGuestSession(payload.guestId, nickname, deps.jwtSecret, {
      inviteSlug: slug,
      ttlSec: GUEST_SESSION_TTL_SEC,
    });
    res.json({ token, nickname });
  });

  app.post("/api/invite/upgrade", (req, res) => {
    if (!DIRECT_INVITE_ENABLED) {
      res.status(404).json({ error: "disabled" });
      return;
    }
    const guestPayload = requireGuestJwt(req, deps);
    if (!guestPayload?.guestId) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const walletPayload = requireWalletJwt(req, deps);
    if (!walletPayload) {
      res.status(401).json({ error: "wallet_required" });
      return;
    }
    const slug = guestPayload.inviteSlug ?? "";
    if (!slug) {
      res.status(400).json({ error: "missing_invite" });
      return;
    }
    const invite = getInviteBySlug(slug);
    if (!invite || !getParticipant(invite, guestPayload.guestId)) {
      res.status(409).json({ error: "invite_mismatch" });
      return;
    }
    upgradeInviteGuestWallet(slug, guestPayload.guestId, walletPayload.sub);
    const displayName =
      sanitizeGuestNickname(String(req.body?.nickname ?? "")) ??
      guestPayload.displayName ??
      pickDirectInviteGuestName(Math.random);
    const token = signUpgradedGuestSession(
      guestPayload.guestId,
      walletPayload.sub,
      displayName,
      deps.jwtSecret,
      {
        inviteSlug: slug,
        nimiqPay: walletPayload.nimiqPay,
        ttlSec: GUEST_SESSION_TTL_SEC,
      }
    );
    setInviteNickname(slug, guestPayload.guestId, displayName);
    res.json({ token, address: walletPayload.sub, displayName });
  });
}
