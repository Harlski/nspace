export {
  DIRECT_INVITE_ENABLED,
  GUEST_SESSION_TTL_SEC,
  MAX_PLAY_SPACE_OCCUPANTS,
  isInviteLobbyRoomId,
} from "./config.js";
export { registerDirectInviteRoutes } from "./httpHandlers.js";
export type { DirectInviteHttpDeps } from "./httpHandlers.js";
export { sanitizeGuestNickname, getParticipant } from "./reducer.js";
export {
  claimInvite,
  closeInvite,
  createInvite,
  getInviteByGuestId,
  getInviteByHost,
  getInviteBySlug,
  markGuestJoinedLobby,
  markHostJoinedLobby,
  markHostLeftLobby,
  removeInviteParticipant,
  expireInvitePastTtl,
  listOpenInvites,
  tickInvites,
} from "./store.js";
export type {
  DirectInviteRecord,
  InviteParticipant,
  InvitePhase,
} from "./types.js";

import type { DirectInviteRecord, InvitePhase } from "./types.js";

export type DirectInviteRosterEntry = {
  displayName: string;
};

export type DirectInviteStateWire = {
  slug: string;
  phase: InvitePhase;
  hostDisplayName: string;
  shareUrl: string;
  expiresAtMs: number;
  isHost: boolean;
  /** Guests currently inside the Play Space (joined the room). */
  roster: DirectInviteRosterEntry[];
  /** Current occupants (creator-if-present + joined guests). */
  occupancy: number;
  /** Max occupants (creator + guests). */
  capacity: number;
};

export function buildInviteStateWire(
  invite: DirectInviteRecord,
  viewerWalletOrGuestId: string,
  hostDisplayName: string,
  shareUrl: string
): DirectInviteStateWire {
  const isHost = invite.hostWallet === viewerWalletOrGuestId;
  const roster: DirectInviteRosterEntry[] = invite.participants
    .filter((p) => p.joinedLobby)
    .map((p) => ({ displayName: p.displayName ?? "Guest" }));
  const occupancy = (invite.hostInLobby ? 1 : 0) + roster.length;
  return {
    slug: invite.slug,
    phase: invite.phase,
    hostDisplayName,
    shareUrl,
    expiresAtMs: invite.expiresAtMs,
    isHost,
    roster,
    occupancy,
    capacity: invite.capacity,
  };
}
