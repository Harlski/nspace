import { apiUrl } from "../net/apiBase.js";
import { loadCachedSession } from "../auth/session.js";

export type WardrobeEntitlement = {
  cosmeticSku: string;
  grantedAt: string;
  source: "purchase" | "grant" | "achievement";
};

export type WardrobeLoadout = {
  auraSku: string | null;
  nameplateSku: string | null;
  chatBubbleSku: string | null;
  trailSku: string | null;
};

export type ShopEntry = {
  cosmeticSku: string;
  presetId: string;
  slot: string;
  displayName: string;
  description: string;
  collection: string;
  priceLuna: string;
  owned?: boolean;
};

export type WardrobeResponse = {
  entitlements: WardrobeEntitlement[];
  loadout: WardrobeLoadout;
  shop: ShopEntry[];
  /** Global daily featured shelf (up to 5), identical for everyone on a given UTC day. */
  featured: ShopEntry[];
};

function sessionToken(): string | null {
  return loadCachedSession()?.token ?? null;
}

async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(apiUrl(path), init);
  const j = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error(String(j.error ?? r.statusText));
  return j;
}

export async function fetchWardrobe(): Promise<WardrobeResponse> {
  const token = sessionToken();
  if (!token) throw new Error("not_signed_in");
  return apiJson<WardrobeResponse>("/api/cosmetics/wardrobe", {
    headers: { authorization: `Bearer ${token}` },
  });
}

export async function updateLoadoutSlot(
  slot: string,
  cosmeticSku: string | null
): Promise<{ loadout: WardrobeLoadout }> {
  const token = sessionToken();
  if (!token) throw new Error("not_signed_in");
  return apiJson("/api/cosmetics/loadout", {
    method: "PUT",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ slot, cosmeticSku }),
  });
}

export async function createUnlockIntent(
  cosmeticSku: string
): Promise<{ intent: { intentId: string; amountNimLabel: string; memo: string } }> {
  const token = sessionToken();
  if (!token) throw new Error("not_signed_in");
  return apiJson("/api/cosmetics/unlock-intent", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ cosmeticSku }),
  });
}

export async function syncUnlockPayment(
  intentId: string,
  cosmeticSku: string
): Promise<{ ok: boolean; granted?: boolean }> {
  const token = sessionToken();
  if (!token) throw new Error("not_signed_in");
  return apiJson("/api/cosmetics/unlock-sync", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ intentId, cosmeticSku }),
  });
}
