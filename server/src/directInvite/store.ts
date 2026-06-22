import crypto from "node:crypto";

import {
  DIRECT_INVITE_TTL_MS,
  INVITE_CONFIG,
  MAX_PLAY_SPACE_OCCUPANTS,
  makeInviteLobbyRoomId,
} from "./config.js";
import { evaluateRedeem, getParticipant, reduceInvite } from "./reducer.js";
import type {
  DirectInviteActivity,
  DirectInviteRecord,
  InviteEvent,
} from "./types.js";

const invitesBySlug = new Map<string, DirectInviteRecord>();
const slugByHost = new Map<string, string>();
const slugByGuestId = new Map<string, string>();

export function generateInviteSlug(): string {
  return crypto.randomBytes(6).toString("base64url").slice(0, 10);
}

export function generateGuestId(): string {
  return crypto.randomBytes(16).toString("hex");
}

function dispatch(slug: string, event: InviteEvent): DirectInviteRecord | null {
  const prev = invitesBySlug.get(slug) ?? null;
  const next = reduceInvite(prev, event, INVITE_CONFIG);
  if (event.type === "removeParticipant") {
    slugByGuestId.delete(event.guestId);
  }
  if (next) {
    invitesBySlug.set(slug, next);
    slugByHost.set(next.hostWallet, slug);
    for (const p of next.participants) slugByGuestId.set(p.guestId, slug);
  } else {
    invitesBySlug.delete(slug);
  }
  return next;
}

export function getInviteBySlug(slug: string): DirectInviteRecord | null {
  return invitesBySlug.get(slug) ?? null;
}

export function getInviteByHost(hostWallet: string): DirectInviteRecord | null {
  const slug = slugByHost.get(hostWallet);
  return slug ? invitesBySlug.get(slug) ?? null : null;
}

export function getInviteByGuestId(guestId: string): DirectInviteRecord | null {
  const slug = slugByGuestId.get(guestId);
  return slug ? invitesBySlug.get(slug) ?? null : null;
}

export type CreateInviteInput = {
  hostWallet: string;
  hostOriginRoomId: string;
  activity: DirectInviteActivity;
  nowMs?: number;
};

/**
 * Open a Play Space for this host. Idempotent: if the host already owns a live space we
 * return it rather than spinning up a second one.
 */
export function createInvite(input: CreateInviteInput): DirectInviteRecord {
  const existing = getInviteByHost(input.hostWallet);
  if (existing && existing.phase === "open") return existing;
  const slug = generateInviteSlug();
  const lobbyRoomId = makeInviteLobbyRoomId(slug);
  const nowMs = input.nowMs ?? Date.now();
  const invite = dispatch(slug, {
    type: "create",
    hostWallet: input.hostWallet,
    hostOriginRoomId: input.hostOriginRoomId,
    slug,
    lobbyRoomId,
    nowMs,
    ttlMs: DIRECT_INVITE_TTL_MS,
    activity: input.activity,
    capacity: MAX_PLAY_SPACE_OCCUPANTS,
  });
  return invite!;
}

export function claimInvite(
  slug: string,
  guestId: string,
  nowMs = Date.now()
): ReturnType<typeof evaluateRedeem> {
  const invite = getInviteBySlug(slug);
  const verdict = evaluateRedeem(invite, guestId, nowMs);
  if (!verdict.ok) return verdict;
  if (!getParticipant(invite!, guestId)) {
    dispatch(slug, { type: "claim", guestId, nowMs });
  }
  return { ok: true, invite: getInviteBySlug(slug)! };
}

export function setInviteNickname(
  slug: string,
  guestId: string,
  nickname: string
): DirectInviteRecord | null {
  const invite = getInviteBySlug(slug);
  if (!invite || !getParticipant(invite, guestId)) return null;
  return dispatch(slug, { type: "setNickname", guestId, nickname });
}

export function upgradeInviteGuestWallet(
  slug: string,
  guestId: string,
  wallet: string
): DirectInviteRecord | null {
  const invite = getInviteBySlug(slug);
  if (!invite || !getParticipant(invite, guestId)) return null;
  return dispatch(slug, { type: "upgradeWallet", guestId, wallet });
}

export function markGuestJoinedLobby(
  slug: string,
  guestId: string
): DirectInviteRecord | null {
  const invite = getInviteBySlug(slug);
  if (!invite || !getParticipant(invite, guestId)) return null;
  return dispatch(slug, { type: "guestJoinedLobby", guestId });
}

export function markHostJoinedLobby(slug: string): DirectInviteRecord | null {
  const invite = getInviteBySlug(slug);
  if (!invite) return null;
  return dispatch(slug, { type: "hostJoinedLobby" });
}

export function markHostLeftLobby(slug: string): DirectInviteRecord | null {
  const invite = getInviteBySlug(slug);
  if (!invite) return null;
  return dispatch(slug, { type: "hostLeftLobby" });
}

export function removeInviteParticipant(
  slug: string,
  guestId: string
): DirectInviteRecord | null {
  const invite = getInviteBySlug(slug);
  if (!invite) return null;
  return dispatch(slug, { type: "removeParticipant", guestId });
}

/** Close (tear down) a Play Space — call once it has fully emptied. */
export function closeInvite(slug: string): DirectInviteRecord | null {
  const invite = getInviteBySlug(slug);
  if (!invite) return null;
  if (invite.phase === "closed" || invite.phase === "expired") return invite;
  return dispatch(slug, { type: "close" });
}

/** All Play Spaces still in the `open` phase (for occupancy-aware expiry sweeps). */
export function listOpenInvites(): DirectInviteRecord[] {
  return [...invitesBySlug.values()].filter((i) => i.phase === "open");
}

/** Force-expire an open invite whose TTL has lapsed (caller must gate on occupancy). */
export function expireInvitePastTtl(slug: string): DirectInviteRecord | null {
  const invite = getInviteBySlug(slug);
  if (!invite || invite.phase !== "open") return invite ?? null;
  return dispatch(slug, { type: "tick", nowMs: invite.expiresAtMs });
}

/** Tick all non-terminal invites; returns slugs that transitioned to expired. */
export function tickInvites(nowMs: number): string[] {
  const expired: string[] = [];
  for (const [slug, invite] of [...invitesBySlug]) {
    if (invite.phase === "closed" || invite.phase === "expired") continue;
    const next = dispatch(slug, { type: "tick", nowMs });
    if (next?.phase === "expired") expired.push(slug);
  }
  return expired;
}

/** Test-only reset. */
export function _resetInviteStoreForTests(): void {
  invitesBySlug.clear();
  slugByHost.clear();
  slugByGuestId.clear();
}

export { evaluateRedeem };
