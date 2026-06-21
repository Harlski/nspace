/**
 * Optional reachability checks for the payment-intent sidecar (used by `/admin/system`).
 * Never exposes secrets in return values.
 */

const DEFAULT_TIMEOUT_MS = 3000;

export type SidecarStatusTone = "ok" | "warn" | "error" | "off";

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
  | { configured: false; statusTone: "off"; hint: string }
  | {
      configured: true;
      statusTone: SidecarStatusTone;
      baseUrl: string;
      health: PaymentIntentHealthProbe;
      api: PaymentIntentApiProbe;
      logsHint: string;
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

function computePaymentIntentStatusTone(
  health: PaymentIntentHealthProbe,
  api: PaymentIntentApiProbe
): SidecarStatusTone {
  if (!health.ok) return "error";
  if (api.skipReason === "no_secret_on_game_server") return "warn";
  if (api.attempted && !api.ok) return "warn";
  if (health.ok && api.ok) return "ok";
  if (health.ok) return "warn";
  return "error";
}

function looksLikePayoutPort(baseUrl: string): boolean {
  return /:3091(?:\/|$)/.test(baseUrl);
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
      statusTone: "off",
      hint:
        "Set PAYMENT_INTENT_SERVICE_URL on the game server (e.g. http://127.0.0.1:3090 or http://payment-intent:3090 in Docker) to enable monitoring.",
    };
  }

  if (looksLikePayoutPort(baseUrl)) {
    const health: PaymentIntentHealthProbe = {
      reached: false,
      ok: false,
      latencyMs: 0,
      error:
        "PAYMENT_INTENT_SERVICE_URL uses port 3091 (payout sidecar). Payment-intent listens on 3090 — set http://payment-intent:3090 (Docker) or http://127.0.0.1:3090 (host).",
    };
    const api: PaymentIntentApiProbe = { attempted: false };
    return {
      configured: true,
      statusTone: "error",
      baseUrl,
      health,
      api,
      logsHint: "docker compose --profile payment logs payment-intent --tail 100",
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
    return {
      configured: true,
      statusTone: computePaymentIntentStatusTone(health, api),
      baseUrl,
      health,
      api,
      logsHint: "docker compose --profile payment logs payment-intent --tail 100",
    };
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
    return {
      configured: true,
      statusTone: computePaymentIntentStatusTone(health, api),
      baseUrl,
      health,
      api,
      logsHint: "docker compose --profile payment logs payment-intent --tail 100",
    };
  }

  let featureKindCount: number | undefined;
  if (fr.json && typeof fr.json === "object" && fr.json !== null) {
    const o = fr.json as Record<string, unknown>;
    const fk = o.featureKinds;
    if (Array.isArray(fk)) featureKindCount = fk.length;
  }

  api.ok = true;
  api.featureKindCount = featureKindCount;
  return {
    configured: true,
    statusTone: computePaymentIntentStatusTone(health, api),
    baseUrl,
    health,
    api,
    logsHint: "docker compose --profile payment logs payment-intent --tail 100",
  };
}
