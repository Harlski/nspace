export { DIRECT_INVITE_ENABLED, GUEST_SESSION_TTL_SEC, isInviteLobbyRoomId } from "./config.js";
export { registerDirectInviteRoutes } from "./httpHandlers.js";
export type { DirectInviteHttpDeps } from "./httpHandlers.js";
export { sanitizeGuestNickname } from "./reducer.js";
export {
  cancelInvite,
  claimInvite,
  createInvite,
  getInviteByGuestId,
  getInviteByHost,
  getInviteBySlug,
  markGuestJoinedLobby,
  markHostJoinedLobby,
  markInviteStarted,
  startInviteMatch,
  tickInvites,
} from "./store.js";
export type { DirectInviteRecord, InvitePhase } from "./types.js";

export type DirectInviteStateWire = {
  slug: string;
  phase: InvitePhase;
  hostDisplayName: string;
  guestDisplayName: string | null;
  shareUrl: string;
  expiresAtMs: number;
  isHost: boolean;
  canStart: boolean;
};

import type { InvitePhase } from "./types.js";

export function buildInviteStateWire(
  invite: import("./types.js").DirectInviteRecord,
  viewerWalletOrGuestId: string,
  hostDisplayName: string,
  shareUrl: string
): DirectInviteStateWire {
  const isHost = invite.hostWallet === viewerWalletOrGuestId;
  return {
    slug: invite.slug,
    phase: invite.phase,
    hostDisplayName,
    guestDisplayName: invite.guestDisplayName,
    shareUrl,
    expiresAtMs: invite.expiresAtMs,
    isHost,
    canStart: isHost && invite.phase === "lobby",
  };
}
