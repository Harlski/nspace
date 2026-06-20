/**
 * HTTP client for the Payout Service sidecar.
 */

export type PayIntent = {
  claimId: string;
  recipientAddress: string;
  amountLuna?: bigint;
  roomId: string;
  tileKey: string;
  txMessage?: string;
};

export type PayIntentPayload = PayIntent;

export function normalizePayoutServiceBaseUrl(
  raw: string | undefined | null
): string | null {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  return t.replace(/\/+$/, "");
}

export function getPayoutServiceBaseUrl(): string | null {
  return normalizePayoutServiceBaseUrl(process.env.PAYOUT_SERVICE_URL);
}

function apiSecret(): string | null {
  const s = process.env.PAYOUT_SERVICE_API_SECRET?.trim();
  return s || null;
}

export function isPayoutServiceClientConfigured(): boolean {
  return getPayoutServiceBaseUrl() != null && apiSecret() != null;
}

async function payoutFetch(
  path: string,
  init: RequestInit
): Promise<{ ok: boolean; status: number; json: unknown | null; text: string }> {
  const base = getPayoutServiceBaseUrl();
  const secret = apiSecret();
  if (!base || !secret) {
    return {
      ok: false,
      status: 0,
      json: null,
      text: "payout_service_not_configured",
    };
  }
  const url = `${normalizePayoutServiceBaseUrl(base)}${path}`;
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/json",
        ...(init.headers as Record<string, string> | undefined),
      },
      signal: AbortSignal.timeout(12_000),
    });
    const text = await res.text();
    let json: unknown | null = null;
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      json = null;
    }
    return { ok: res.ok, status: res.status, json, text };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, status: 0, json: null, text: msg };
  }
}

export async function deliverPayIntentToService(
  intent: PayIntentPayload
): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  const body: Record<string, string> = {
    claimId: intent.claimId,
    recipientAddress: intent.recipientAddress,
    roomId: intent.roomId,
    tileKey: intent.tileKey,
  };
  if (intent.amountLuna !== undefined) {
    body.amountLuna = intent.amountLuna.toString();
  }
  if (intent.txMessage?.trim()) {
    body.txMessage = intent.txMessage.trim();
  }

  const r = await payoutFetch("/v1/pay-intents", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    return {
      ok: false,
      error: r.text || `HTTP ${r.status}`,
      status: r.status || undefined,
    };
  }

  if (r.json && typeof r.json === "object" && r.json !== null) {
    const accepted = (r.json as Record<string, unknown>).accepted;
    if (accepted === true) {
      return { ok: true };
    }
  }

  return { ok: false, error: "invalid_response", status: r.status };
}

export async function fetchBalanceFromService(): Promise<
  { ok: true; balanceLuna: bigint } | { ok: false; error: string; status?: number }
> {
  const r = await payoutFetch("/v1/balance", { method: "GET" });
  if (!r.ok) {
    return {
      ok: false,
      error: r.text || `HTTP ${r.status}`,
      status: r.status || undefined,
    };
  }
  if (r.json && typeof r.json === "object" && r.json !== null) {
    const raw = (r.json as Record<string, unknown>).balanceLuna;
    if (typeof raw === "string" && /^\d+$/.test(raw)) {
      return { ok: true, balanceLuna: BigInt(raw) };
    }
  }
  return { ok: false, error: "invalid_response", status: r.status };
}

export type PayIntentDeliverer = (
  intent: PayIntentPayload
) => Promise<{ ok: true } | { ok: false; error: string; status?: number }>;
