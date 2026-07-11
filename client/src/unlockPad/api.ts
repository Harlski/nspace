import { apiUrl } from "../net/apiBase.js";
import { loadCachedSession } from "../auth/session.js";

function sessionToken(): string | null {
  return loadCachedSession()?.token ?? null;
}

async function apiJson<T>(
  path: string,
  init: RequestInit
): Promise<T> {
  const res = await fetch(apiUrl(path), init);
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return body;
}

export type UnlockPadIntentResponse = {
  config: {
    amountLuna: string;
    recipient: string;
    buttonLabel: string;
    proofMode: "optimistic" | "payment_intent";
    instanceId: string;
  };
  intent: {
    intentId: string;
    amountLuna: string;
    amountNimLabel: string;
    recipient: string;
    memo: string;
  };
};

export async function createUnlockPadIntent(
  roomId: string,
  instanceId: string
): Promise<UnlockPadIntentResponse> {
  const token = sessionToken();
  if (!token) throw new Error("not_signed_in");
  return apiJson("/api/unlock-pad/intent", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ roomId, instanceId }),
  });
}

export async function syncUnlockPadPayment(
  intentId: string,
  roomId: string,
  instanceId: string
): Promise<{ ok: boolean; granted?: boolean; instanceId?: string }> {
  const token = sessionToken();
  if (!token) throw new Error("not_signed_in");
  return apiJson("/api/unlock-pad/sync", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ intentId, roomId, instanceId }),
  });
}
