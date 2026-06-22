import type {
  DirectInviteRecord,
  InviteConfig,
  InviteEvent,
  InviteParticipant,
  InvitePhase,
  RedeemResult,
} from "./types.js";

const TERMINAL: ReadonlySet<InvitePhase> = new Set(["closed", "expired"]);

export function initInviteState(): null {
  return null;
}

/** Number of guest slots still free (the creator occupies one of the `capacity` seats). */
function freeGuestSlots(rec: DirectInviteRecord): number {
  return Math.max(0, rec.capacity - 1 - rec.participants.length);
}

function findParticipant(
  rec: DirectInviteRecord,
  guestId: string
): { idx: number } | null {
  const idx = rec.participants.findIndex((p) => p.guestId === guestId);
  return idx === -1 ? null : { idx };
}

export function reduceInvite(
  state: DirectInviteRecord | null,
  event: InviteEvent,
  _cfg: InviteConfig
): DirectInviteRecord | null {
  if (event.type === "create") {
    if (state) return state;
    return {
      slug: event.slug,
      activity: event.activity,
      hostWallet: event.hostWallet,
      hostOriginRoomId: event.hostOriginRoomId,
      lobbyRoomId: event.lobbyRoomId,
      phase: "open",
      participants: [],
      hostInLobby: true,
      capacity: event.capacity,
      createdAtMs: event.nowMs,
      expiresAtMs: event.nowMs + event.ttlMs,
    };
  }

  if (!state || TERMINAL.has(state.phase)) return state;

  if (event.type === "tick") {
    if (event.nowMs >= state.expiresAtMs) return { ...state, phase: "expired" };
    return state;
  }

  if (event.type === "close") {
    return { ...state, phase: "closed" };
  }

  if (event.type === "claim") {
    if (findParticipant(state, event.guestId)) return state; // idempotent reclaim
    if (freeGuestSlots(state) <= 0) return state; // full (gated by evaluateRedeem)
    return {
      ...state,
      participants: [
        ...state.participants,
        { guestId: event.guestId, displayName: null, wallet: null, joinedLobby: false },
      ],
    };
  }

  if (event.type === "setNickname") {
    const found = findParticipant(state, event.guestId);
    if (!found) return state;
    const participants = state.participants.slice();
    participants[found.idx] = {
      ...participants[found.idx]!,
      displayName: event.nickname,
    };
    return { ...state, participants };
  }

  if (event.type === "upgradeWallet") {
    const found = findParticipant(state, event.guestId);
    if (!found) return state;
    const participants = state.participants.slice();
    participants[found.idx] = {
      ...participants[found.idx]!,
      wallet: event.wallet,
    };
    return { ...state, participants };
  }

  if (event.type === "guestJoinedLobby") {
    const found = findParticipant(state, event.guestId);
    if (!found) return state;
    const participants = state.participants.slice();
    participants[found.idx] = { ...participants[found.idx]!, joinedLobby: true };
    return { ...state, participants };
  }

  if (event.type === "hostJoinedLobby") {
    if (state.hostInLobby) return state;
    return { ...state, hostInLobby: true };
  }

  if (event.type === "hostLeftLobby") {
    if (!state.hostInLobby) return state;
    return { ...state, hostInLobby: false };
  }

  if (event.type === "removeParticipant") {
    const found = findParticipant(state, event.guestId);
    if (!found) return state;
    return {
      ...state,
      participants: state.participants.filter((p) => p.guestId !== event.guestId),
    };
  }

  return state;
}

export type PeekResult =
  | { ok: false; code: "not_found" | "closed" | "expired" | "full" }
  | { ok: true; invite: DirectInviteRecord; reclaimable: boolean };

/** Read-only joinability check (no slot claim). */
export function evaluatePeek(
  invite: DirectInviteRecord | null,
  guestId: string | null,
  nowMs: number
): PeekResult {
  if (!invite) return { ok: false, code: "not_found" };
  if (invite.phase === "closed") return { ok: false, code: "closed" };
  if (invite.phase === "expired") return { ok: false, code: "expired" };
  const reclaimable = !!(
    guestId && invite.participants.some((p) => p.guestId === guestId)
  );
  if (reclaimable) return { ok: true, invite, reclaimable: true };
  const redeem = evaluateRedeem(invite, guestId, nowMs);
  if (!redeem.ok) {
    const code = redeem.code === "not_found" ? "not_found" : redeem.code;
    return { ok: false, code };
  }
  return { ok: true, invite, reclaimable: false };
}

/** Whether a guest may redeem (claim/reclaim) this invite. */
export function evaluateRedeem(
  invite: DirectInviteRecord | null,
  guestId: string | null,
  _nowMs: number
): RedeemResult {
  if (!invite) return { ok: false, code: "not_found" };
  if (invite.phase === "closed") return { ok: false, code: "closed" };
  if (invite.phase === "expired") return { ok: false, code: "expired" };
  // Open Play Spaces stay joinable until explicitly closed — TTL is only a backstop for
  // abandoned creates (see directInviteSweepExpired), not a cap on active sessions.
  // An already-claimed guest may always reclaim their own slot.
  if (guestId && invite.participants.some((p) => p.guestId === guestId)) {
    return { ok: true, invite };
  }
  if (invite.participants.length >= invite.capacity - 1) {
    return { ok: false, code: "full" };
  }
  return { ok: true, invite };
}

/** Sanitize guest nickname for display. */
export function sanitizeGuestNickname(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length < 2 || trimmed.length > 24) return null;
  if (!/^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u.test(trimmed)) return null;
  return trimmed;
}

export function isTerminalPhase(phase: InvitePhase): boolean {
  return TERMINAL.has(phase);
}

/** Look up a participant by guest id (read helper for the store/handlers). */
export function getParticipant(
  invite: DirectInviteRecord,
  guestId: string
): InviteParticipant | null {
  return invite.participants.find((p) => p.guestId === guestId) ?? null;
}
