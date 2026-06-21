/** Activity target for a Direct Invite (extensible; v1 implements worldcup-match only). */
export type DirectInviteActivity = "worldcup-match";

export type InvitePhase =
  | "open"
  | "claimed"
  | "lobby"
  | "starting"
  | "started"
  | "cancelled"
  | "expired";

export type DirectInviteRecord = {
  slug: string;
  activity: DirectInviteActivity;
  hostWallet: string;
  hostOriginRoomId: string;
  lobbyRoomId: string;
  phase: InvitePhase;
  guestId: string | null;
  guestDisplayName: string | null;
  guestWallet: string | null;
  hostInLobby: boolean;
  guestInLobby: boolean;
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
    }
  | { type: "claim"; guestId: string; nowMs: number }
  | { type: "reclaim"; guestId: string }
  | { type: "setNickname"; guestId: string; nickname: string }
  | { type: "upgradeWallet"; guestId: string; wallet: string }
  | { type: "guestJoinedLobby"; guestId: string }
  | { type: "hostJoinedLobby" }
  | { type: "hostStart" }
  | { type: "cancel"; by: "host" | "system" }
  | { type: "started" }
  | { type: "tick"; nowMs: number };

export type RedeemResult =
  | { ok: true; invite: DirectInviteRecord }
  | { ok: false; code: "not_found" | "expired" | "slot_taken" | "cancelled" | "started" };

export type InviteConfig = {
  ttlMs: number;
};
