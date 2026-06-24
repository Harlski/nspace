import {
  getPaymentIntentServiceBaseUrl,
  normalizePaymentIntentServiceBaseUrl,
} from "./paymentIntentProbe.js";

export type PublicPaymentIntent = {
  intentId: string;
  featureKind: string;
  payerWallet: string;
  amountLuna: string;
  recipient: string;
  memo: string;
  expiresAt: string;
  status: string;
  createdAt: string;
  verifiedTxHash: string | null;
  failureReason: string | null;
};

function apiSecret(): string | null {
  const s = process.env.PAYMENT_INTENT_API_SECRET?.trim();
  return s || null;
}

function baseUrl(): string | null {
  return getPaymentIntentServiceBaseUrl();
}

async function piFetch(
  path: string,
  init: RequestInit
): Promise<{ ok: boolean; status: number; json: unknown | null; text: string }> {
  const base = baseUrl();
  const secret = apiSecret();
  if (!base || !secret) {
    return {
      ok: false,
      status: 0,
      json: null,
      text: "payment_intent_not_configured",
    };
  }
  const url = `${normalizePaymentIntentServiceBaseUrl(base)}${path}`;
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

function parseIntentPayload(json: unknown): PublicPaymentIntent | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const intent = o.intent;
  if (!intent || typeof intent !== "object") return null;
  const i = intent as Record<string, unknown>;
  const intentId = String(i.intentId ?? "").trim();
  if (!intentId) return null;
  return {
    intentId,
    featureKind: String(i.featureKind ?? ""),
    payerWallet: String(i.payerWallet ?? ""),
    amountLuna: String(i.amountLuna ?? ""),
    recipient: String(i.recipient ?? ""),
    memo: String(i.memo ?? ""),
    expiresAt: String(i.expiresAt ?? ""),
    status: String(i.status ?? ""),
    createdAt: String(i.createdAt ?? ""),
    verifiedTxHash:
      i.verifiedTxHash == null ? null : String(i.verifiedTxHash),
    failureReason: i.failureReason == null ? null : String(i.failureReason),
  };
}

export function isPaymentIntentClientConfigured(): boolean {
  return baseUrl() != null && apiSecret() != null;
}

function parsePiErrorMessage(json: unknown, fallback: string): string {
  if (json && typeof json === "object" && json !== null) {
    const err = String((json as Record<string, unknown>).error ?? "").trim();
    if (err) return err;
  }
  const t = String(fallback ?? "").trim();
  if (!t) return "payment_intent_error";
  try {
    const parsed = JSON.parse(t) as { error?: string };
    if (parsed?.error) return parsed.error;
  } catch {
    /* plain text */
  }
  if (t.includes("not implemented yet")) {
    return "payment_intent_feature_stale — rebuild payment-intent Docker image (docker compose build payment-intent)";
  }
  return t.slice(0, 240);
}

export async function createBillboardSlotIntent(opts: {
  payerWallet: string;
  campaignId: string;
  idempotencyKey?: string;
  amountLuna?: bigint;
}): Promise<
  | { ok: true; intent: PublicPaymentIntent }
  | { ok: false; error: string; status?: number }
> {
  const featurePayload: Record<string, string> = {
    campaignId: opts.campaignId,
  };
  if (opts.amountLuna !== undefined) {
    featurePayload.amountLuna = opts.amountLuna.toString();
  }
  const r = await piFetch("/v1/intents", {
    method: "POST",
    body: JSON.stringify({
      featureKind: "nspace.billboard.slot",
      payerWallet: opts.payerWallet,
      featurePayload,
      idempotencyKey: opts.idempotencyKey,
    }),
  });
  const intent = parseIntentPayload(r.json);
  if (!r.ok || !intent) {
    return {
      ok: false,
      error: parsePiErrorMessage(r.json, r.text || `HTTP ${r.status}`),
      status: r.status || undefined,
    };
  }
  return { ok: true, intent };
}

export async function createCosmeticUnlockIntent(opts: {
  payerWallet: string;
  cosmeticSku: string;
  amountLuna: bigint;
  idempotencyKey?: string;
}): Promise<
  | { ok: true; intent: PublicPaymentIntent }
  | { ok: false; error: string; status?: number }
> {
  const r = await piFetch("/v1/intents", {
    method: "POST",
    body: JSON.stringify({
      featureKind: "nspace.cosmetic.unlock",
      payerWallet: opts.payerWallet,
      featurePayload: {
        cosmeticSku: opts.cosmeticSku,
        amountLuna: opts.amountLuna.toString(),
      },
      idempotencyKey: opts.idempotencyKey,
    }),
  });
  const intent = parseIntentPayload(r.json);
  if (!r.ok || !intent) {
    return {
      ok: false,
      error: parsePiErrorMessage(r.json, r.text || `HTTP ${r.status}`),
      status: r.status || undefined,
    };
  }
  return { ok: true, intent };
}

export async function getPaymentIntent(
  intentId: string
): Promise<
  | { ok: true; intent: PublicPaymentIntent }
  | { ok: false; error: string; status?: number }
> {
  const id = intentId.trim();
  const r = await piFetch(`/v1/intents/${encodeURIComponent(id)}`, {
    method: "GET",
  });
  const intent = parseIntentPayload(r.json);
  if (!r.ok || !intent) {
    return {
      ok: false,
      error: r.text || `HTTP ${r.status}`,
      status: r.status || undefined,
    };
  }
  return { ok: true, intent };
}

export async function checkPaymentIntent(
  intentId: string
): Promise<
  | { ok: true; intent: PublicPaymentIntent }
  | { ok: false; error: string; intent?: PublicPaymentIntent; status?: number }
> {
  const r = await piFetch(
    `/v1/intents/${encodeURIComponent(intentId.trim())}/check`,
    { method: "POST", body: "{}" }
  );
  if (!r.json || typeof r.json !== "object") {
    return { ok: false, error: r.text || `HTTP ${r.status}`, status: r.status };
  }
  const o = r.json as Record<string, unknown>;
  const intent = parseIntentPayload({ intent: o.intent });
  if (!intent) {
    return { ok: false, error: r.text || "invalid_response", status: r.status };
  }
  if (o.ok === true) {
    return { ok: true, intent };
  }
  return {
    ok: false,
    error: String(o.chainMessage ?? intent.failureReason ?? "check_failed"),
    intent,
    status: r.status,
  };
}

export async function verifyPaymentIntentTx(
  intentId: string,
  txHash: string
): Promise<
  | { ok: true; intent: PublicPaymentIntent; chainOk: boolean }
  | { ok: false; error: string; intent?: PublicPaymentIntent; status?: number }
> {
  const r = await piFetch(
    `/v1/intents/${encodeURIComponent(intentId.trim())}/verify`,
    {
      method: "POST",
      body: JSON.stringify({ txHash }),
    }
  );
  if (!r.json || typeof r.json !== "object") {
    return { ok: false, error: r.text || `HTTP ${r.status}`, status: r.status };
  }
  const o = r.json as Record<string, unknown>;
  const intent = parseIntentPayload({ intent: o.intent });
  if (!intent) {
    return { ok: false, error: r.text || "invalid_response", status: r.status };
  }
  const chainOk = o.ok === true;
  if (!chainOk) {
    return {
      ok: false,
      error: String(o.chainMessage ?? intent.failureReason ?? "verify_failed"),
      intent,
      status: r.status,
    };
  }
  return { ok: true, intent, chainOk: true };
}
