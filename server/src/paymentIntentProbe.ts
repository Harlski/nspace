/**
 * Optional reachability checks for the payment-intent sidecar (used by `/admin/system`).
 * Never exposes secrets in return values.
 */

const DEFAULT_TIMEOUT_MS = 3000;

export function normalizePaymentIntentServiceBaseUrl(
  raw: string | undefined | null
): string | null {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  return t.replace(/\/+$/, "");
}

export function getPaymentIntentServiceBaseUrl(): string | null {
  return normalizePaymentIntentServiceBaseUrl(
    process.env.PAYMENT_INTENT_SERVICE_URL
  );
}

function serverPaymentIntentApiSecret(): string | null {
  const s = process.env.PAYMENT_INTENT_API_SECRET?.trim();
  return s || null;
}

export type PaymentIntentHealthProbe = {
  reached: boolean;
  ok: boolean;
  statusCode?: number;
  latencyMs: number;
  service?: string;
  error?: string;
};

export type PaymentIntentApiProbe = {
  attempted: boolean;
  ok?: boolean;
  statusCode?: number;
  latencyMs?: number;
  featureKindCount?: number;
  error?: string;
  skipReason?: "no_secret_on_game_server";
};

export type PaymentIntentAdminSnapshot =
  | { configured: false; hint: string }
  | {
      configured: true;
      baseUrl: string;
      health: PaymentIntentHealthProbe;
      api: PaymentIntentApiProbe;
    };

async function fetchJson(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<{ ok: boolean; status: number; latencyMs: number; json: unknown | null; text: string }> {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const latencyMs = Date.now() - t0;
    const text = await res.text();
    let json: unknown | null = null;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      try {
        json = JSON.parse(text) as unknown;
      } catch {
        json = null;
      }
    }
    return {
      ok: res.ok,
      status: res.status,
      latencyMs,
      json,
      text: text.slice(0, 500),
    };
  } catch (e) {
    const latencyMs = Date.now() - t0;
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      status: 0,
      latencyMs,
      json: null,
      text: msg,
    };
  }
}

/**
 * Probes `GET {base}/health` and, when `PAYMENT_INTENT_API_SECRET` is set on this process,
 * `GET {base}/v1/meta/features` with Bearer auth (validates end-to-end auth + handler wiring).
 */
export async function probePaymentIntentService(
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<PaymentIntentAdminSnapshot> {
  const baseUrl = getPaymentIntentServiceBaseUrl();
  if (!baseUrl) {
    return {
      configured: false,
      hint:
        "Set PAYMENT_INTENT_SERVICE_URL on the game server (e.g. http://127.0.0.1:3090 or http://payment-intent:3090 in Docker) to enable monitoring.",
    };
  }

  const healthUrl = `${baseUrl}/health`;
  const h = await fetchJson(healthUrl, { method: "GET" }, timeoutMs);

  let serviceName: string | undefined;
  let bodyOk = false;
  if (h.json && typeof h.json === "object" && h.json !== null) {
    const o = h.json as Record<string, unknown>;
    if (typeof o.service === "string") serviceName = o.service;
    if (o.ok === true) bodyOk = true;
  }

  const health: PaymentIntentHealthProbe = {
    reached: h.status > 0,
    ok: h.ok && h.status === 200 && bodyOk,
    statusCode: h.status || undefined,
    latencyMs: h.latencyMs,
    service: serviceName,
    error:
      h.ok && h.status === 200 && bodyOk
        ? undefined
        : h.status === 0
          ? h.text || "Unreachable (DNS, refused, or timeout)"
          : h.text || `HTTP ${h.status}`,
  };

  const secret = serverPaymentIntentApiSecret();
  const api: PaymentIntentApiProbe = { attempted: false };

  if (!secret) {
    api.skipReason = "no_secret_on_game_server";
    api.attempted = false;
    return { configured: true, baseUrl, health, api };
  }

  const featuresUrl = `${baseUrl}/v1/meta/features`;
  const fr = await fetchJson(
    featuresUrl,
    {
      method: "GET",
      headers: { authorization: `Bearer ${secret}` },
    },
    timeoutMs
  );

  api.attempted = true;
  api.statusCode = fr.status || undefined;
  api.latencyMs = fr.latencyMs;
  if (!fr.ok) {
    api.ok = false;
    api.error = fr.text || `HTTP ${fr.status}`;
    return { configured: true, baseUrl, health, api };
  }

  let featureKindCount: number | undefined;
  if (fr.json && typeof fr.json === "object" && fr.json !== null) {
    const o = fr.json as Record<string, unknown>;
    const fk = o.featureKinds;
    if (Array.isArray(fk)) featureKindCount = fk.length;
  }

  api.ok = true;
  api.featureKindCount = featureKindCount;
  return { configured: true, baseUrl, health, api };
}
