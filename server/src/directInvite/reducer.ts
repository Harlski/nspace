import type {
  DirectInviteRecord,
  InviteConfig,
  InviteEvent,
  InvitePhase,
  RedeemResult,
} from "./types.js";

const TERMINAL: ReadonlySet<InvitePhase> = new Set([
  "cancelled",
  "expired",
  "started",
]);

export function initInviteState(): null {
  return null;
}

function deriveLobbyPhase(rec: DirectInviteRecord): InvitePhase {
  if (rec.hostInLobby && rec.guestInLobby && rec.guestId) return "lobby";
  if (rec.guestId) return "claimed";
  return "open";
}

function applyLobbyTransition(rec: DirectInviteRecord): DirectInviteRecord {
  if (TERMINAL.has(rec.phase) || rec.phase === "starting" || rec.phase === "started") {
    return rec;
  }
  const nextPhase = deriveLobbyPhase(rec);
  if (rec.phase === nextPhase) return rec;
  return { ...rec, phase: nextPhase };
}

export function reduceInvite(
  state: DirectInviteRecord | null,
  event: InviteEvent,
  _cfg: InviteConfig
): DirectInviteRecord | null {
  if (event.type === "create") {
    if (state) return state;
    const expiresAtMs = event.nowMs + event.ttlMs;
    return {
      slug: event.slug,
      activity: event.activity,
      hostWallet: event.hostWallet,
      hostOriginRoomId: event.hostOriginRoomId,
      lobbyRoomId: event.lobbyRoomId,
      phase: "open",
      guestId: null,
      guestDisplayName: null,
      guestWallet: null,
      hostInLobby: true,
      guestInLobby: false,
      createdAtMs: event.nowMs,
      expiresAtMs,
    };
  }

  if (!state || TERMINAL.has(state.phase)) return state;

  if (event.type === "tick") {
    if (event.nowMs >= state.expiresAtMs) {
      return { ...state, phase: "expired" };
    }
    return state;
  }

  if (event.type === "cancel") {
    return { ...state, phase: "cancelled" };
  }

  if (event.type === "started") {
    return { ...state, phase: "started" };
  }

  if (event.type === "claim") {
    if (state.phase !== "open" && state.phase !== "claimed") return state;
    if (state.guestId && state.guestId !== event.guestId) return state;
    const next: DirectInviteRecord = {
      ...state,
      guestId: event.guestId,
      phase: "claimed",
    };
    return applyLobbyTransition(next);
  }

  if (event.type === "reclaim") {
    if (!state.guestId || state.guestId !== event.guestId) return state;
    if (state.phase !== "claimed" && state.phase !== "lobby") return state;
    return state;
  }

  if (event.type === "setNickname") {
    if (!state.guestId || state.guestId !== event.guestId) return state;
    return { ...state, guestDisplayName: event.nickname };
  }

  if (event.type === "upgradeWallet") {
    if (!state.guestId || state.guestId !== event.guestId) return state;
    return { ...state, guestWallet: event.wallet };
  }

  if (event.type === "guestJoinedLobby") {
    if (!state.guestId || state.guestId !== event.guestId) return state;
    const next = { ...state, guestInLobby: true };
    return applyLobbyTransition(next);
  }

  if (event.type === "hostJoinedLobby") {
    const next = { ...state, hostInLobby: true };
    return applyLobbyTransition(next);
  }

  if (event.type === "hostStart") {
    if (state.phase !== "lobby") return state;
    return { ...state, phase: "starting" };
  }

  return state;
}

/** Whether a guest may redeem (claim/reclaim) this invite. */
export function evaluateRedeem(
  invite: DirectInviteRecord | null,
  guestId: string | null,
  nowMs: number
): RedeemResult {
  if (!invite) return { ok: false, code: "not_found" };
  if (invite.phase === "cancelled") return { ok: false, code: "cancelled" };
  if (invite.phase === "started") return { ok: false, code: "started" };
  if (nowMs >= invite.expiresAtMs || invite.phase === "expired") {
    return { ok: false, code: "expired" };
  }
  if (invite.guestId && guestId && invite.guestId !== guestId) {
    return { ok: false, code: "slot_taken" };
  }
  if (invite.guestId && !guestId) {
    return { ok: false, code: "slot_taken" };
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
