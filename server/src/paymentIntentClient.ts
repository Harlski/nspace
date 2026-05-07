/**
 * Server-to-server calls to `payment-intent-service` (Bearer secret, never exposed to browsers).
 */

const DEFAULT_TIMEOUT_MS = 20_000;

function normalizeBaseUrl(raw: string | undefined): string | null {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  return t.replace(/\/+$/, "");
}

export function isPaymentIntentSidecarConfigured(): boolean {
  const base = normalizeBaseUrl(process.env.PAYMENT_INTENT_SERVICE_URL);
  const secret = String(process.env.PAYMENT_INTENT_API_SECRET ?? "").trim();
  return !!(base && secret);
}

export class PaymentIntentSidecarError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly bodyText?: string
  ) {
    super(message);
    this.name = "PaymentIntentSidecarError";
  }
}

async function sidecarFetchJson(
  method: "GET" | "POST",
  pathWithQuery: string,
  body?: unknown
): Promise<unknown> {
  const base = normalizeBaseUrl(process.env.PAYMENT_INTENT_SERVICE_URL);
  const secret = String(process.env.PAYMENT_INTENT_API_SECRET ?? "").trim();
  if (!base || !secret) {
    throw new PaymentIntentSidecarError("payment_intent_unconfigured", 503);
  }
  const url = `${base}${pathWithQuery.startsWith("/") ? "" : "/"}${pathWithQuery}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        authorization: `Bearer ${secret}`,
        ...(method === "POST"
          ? { "content-type": "application/json" }
          : {}),
      },
      body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new PaymentIntentSidecarError(
      `payment_intent_unreachable: ${msg}`,
      502,
      msg
    );
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const errMsg =
      json &&
      typeof json === "object" &&
      json !== null &&
      "error" in json &&
      typeof (json as { error: unknown }).error === "string"
        ? (json as { error: string }).error
        : text.slice(0, 200) || `HTTP ${res.status}`;
    throw new PaymentIntentSidecarError(errMsg, res.status, text);
  }
  return json;
}

export async function sidecarCreateIntent(
  payerWallet: string,
  input: {
    featureKind: string;
    featurePayload?: unknown;
    idempotencyKey?: string;
  }
): Promise<unknown> {
  return sidecarFetchJson("POST", "/v1/intents", {
    featureKind: input.featureKind,
    featurePayload: input.featurePayload,
    payerWallet,
    idempotencyKey: input.idempotencyKey,
  });
}

export async function sidecarGetIntent(
  intentId: string,
  payerWallet: string
): Promise<unknown> {
  const q = new URLSearchParams({ payerWallet });
  return sidecarFetchJson(
    "GET",
    `/v1/intents/${encodeURIComponent(intentId)}?${q.toString()}`
  );
}

export async function sidecarVerifyIntent(
  intentId: string,
  payerWallet: string,
  txHash: string
): Promise<unknown> {
  return sidecarFetchJson(
    "POST",
    `/v1/intents/${encodeURIComponent(intentId)}/verify`,
    { txHash, payerWallet }
  );
}
