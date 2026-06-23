import { apiUrl } from "../net/apiBase.js";

export type CreateInviteResponse = {
  slug: string;
  url: string;
  lobbyRoomId: string;
  expiresAt: number;
};

export type PeekInviteResponse = {
  slug: string;
  hostDisplayName?: string;
  lobbyRoomId?: string;
  expiresAt?: number;
  joinable: boolean;
  reclaimable: boolean;
  error?: "full" | "closed" | "expired" | "not_found";
};

export type RedeemInviteResponse = {
  token: string;
  guestId: string;
  suggestedNickname: string;
  hostDisplayName: string;
  lobbyRoomId: string;
  expiresAt: number;
  slug: string;
};

export type JoinWalletInviteResponse = {
  token: string;
  guestId: string;
  address: string;
  displayName: string;
  lobbyRoomId: string;
  slug: string;
  expiresAt: number;
};

export async function peekDirectInvite(slug: string): Promise<PeekInviteResponse> {
  const res = await fetch(apiUrl(`/api/invite/peek/${encodeURIComponent(slug)}`), {
    credentials: "include",
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? "peek_failed");
  }
  return res.json() as Promise<PeekInviteResponse>;
}

export async function joinInviteAsWallet(
  slug: string,
  walletToken: string
): Promise<JoinWalletInviteResponse> {
  const res = await fetch(apiUrl(`/api/invite/join-wallet/${encodeURIComponent(slug)}`), {
    method: "POST",
    headers: { Authorization: `Bearer ${walletToken}` },
    credentials: "include",
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? "join_wallet_failed");
  }
  return res.json() as Promise<JoinWalletInviteResponse>;
}

export async function createDirectInvite(
  token: string,
  opts?: { templateId?: string }
): Promise<CreateInviteResponse> {
  const body: Record<string, string> = { activity: "worldcup-match" };
  if (opts?.templateId) body.templateId = opts.templateId;
  const res = await fetch(apiUrl("/api/invite/create"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    credentials: "include",
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? "create_failed");
  }
  return res.json() as Promise<CreateInviteResponse>;
}

export async function redeemDirectInvite(slug: string): Promise<RedeemInviteResponse> {
  const res = await fetch(apiUrl(`/api/invite/redeem/${encodeURIComponent(slug)}`), {
    credentials: "include",
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? "redeem_failed");
  }
  return res.json() as Promise<RedeemInviteResponse>;
}

export async function submitGuestNickname(
  token: string,
  nickname: string
): Promise<{ token: string; nickname: string }> {
  const res = await fetch(apiUrl("/api/invite/nickname"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ nickname }),
    credentials: "include",
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? "nickname_failed");
  }
  return res.json() as Promise<{ token: string; nickname: string }>;
}

export function parseJoinSlugFromPath(pathname: string): string | null {
  const m = /^\/join\/([^/]+)\/?$/.exec(pathname);
  return m?.[1]?.trim() || null;
}

/** Ephemeral Direct Invite lobby rooms (must match server `INVITE_LOBBY_PREFIX`). */
export const INVITE_LOBBY_PREFIX = "invite-lobby-";

export function isInviteLobbyRoomId(roomId: string | null | undefined): boolean {
  return typeof roomId === "string" && roomId.startsWith(INVITE_LOBBY_PREFIX);
}
