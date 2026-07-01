/** Activity target for a Direct Invite (extensible; v1 implements worldcup-match only). */
export type DirectInviteActivity = "worldcup-match";

/**
 * Play Space lifecycle. Unlike the old 1:1 staging lobby, a Play Space is just "alive"
 * (`open`) until it empties or its TTL lapses - there is no host-driven start/cancel that
 * ends it for everyone.
 */
export type InvitePhase = "open" | "closed" | "expired";

/** One guest who claimed the invite link (a temporary, named participant). */
export type InviteParticipant = {
  guestId: string;
  displayName: string | null;
  /** Optional wallet linked via the upgrade flow (still plays under the guest id). */
  wallet: string | null;
  /** True once this guest has actually connected into the Play Space room. */
  joinedLobby: boolean;
};

export type DirectInviteRecord = {
  slug: string;
  activity: DirectInviteActivity;
  hostWallet: string;
  hostOriginRoomId: string;
  lobbyRoomId: string;
  /** Play Space Template used to seed this space. */
  templateId: string;
  phase: InvitePhase;
  /** Guests who claimed the link, in claim order. */
  participants: InviteParticipant[];
  /** True while the wallet creator is currently inside the Play Space. */
  hostInLobby: boolean;
  /** Max total occupants (creator + guests). */
  capacity: number;
  createdAtMs: number;
  expiresAtMs: number;
};

export type InviteEvent =
  | {
      type: "create";
      hostWallet: string;
      hostOriginRoomId: string;
      slug: string;
      lobbyRoomId: string;
      nowMs: number;
      ttlMs: number;
      activity: DirectInviteActivity;
      capacity: number;
      templateId: string;
    }
  | { type: "claim"; guestId: string; nowMs: number }
  | { type: "setNickname"; guestId: string; nickname: string }
  | { type: "upgradeWallet"; guestId: string; wallet: string }
  | { type: "guestJoinedLobby"; guestId: string }
  | { type: "hostJoinedLobby" }
  | { type: "hostLeftLobby" }
  | { type: "removeParticipant"; guestId: string }
  | { type: "close" }
  | { type: "tick"; nowMs: number };

export type RedeemResult =
  | { ok: true; invite: DirectInviteRecord }
  | { ok: false; code: "not_found" | "expired" | "closed" | "full" };

export type InviteConfig = {
  ttlMs: number;
};
