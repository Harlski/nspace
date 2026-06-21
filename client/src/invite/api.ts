import { apiUrl } from "../net/apiBase.js";

export type CreateInviteResponse = {
  slug: string;
  url: string;
  lobbyRoomId: string;
  expiresAt: number;
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

export async function createDirectInvite(
  token: string
): Promise<CreateInviteResponse> {
  const res = await fetch(apiUrl("/api/invite/create"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ activity: "worldcup-match" }),
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
