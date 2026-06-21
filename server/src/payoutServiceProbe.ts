/**
 * Optional reachability checks for the Payout Service sidecar (used by `/admin/system`).
 * Never exposes secrets in return values.
 */

import {
  getPayoutServiceBaseUrl,
  normalizePayoutServiceBaseUrl,
} from "./payoutServiceClient.js";
import type { SidecarStatusTone } from "./paymentIntentProbe.js";

const DEFAULT_TIMEOUT_MS = 3000;

export { normalizePayoutServiceBaseUrl };

export type { SidecarStatusTone };

function serverPayoutApiSecret(): string | null {
  const s = process.env.PAYOUT_SERVICE_API_SECRET?.trim();
  return s || null;
}

export type PayoutHealthProbe = {
  reached: boolean;
  ok: boolean;
  statusCode?: number;
  latencyMs: number;
  service?: string;
  error?: string;
};

export type PayoutApiProbe = {
  attempted: boolean;
  ok?: boolean;
  statusCode?: number;
  latencyMs?: number;
  error?: string;
  skipReason?: "no_secret_on_game_server";
};

export type PayoutServiceAdminSnapshot =
  | { configured: false; statusTone: "off"; hint: string }
  | {
      configured: true;
      statusTone: SidecarStatusTone;
      baseUrl: string;
      health: PayoutHealthProbe;
      api: PayoutApiProbe;
      /** Operator hint when status is not fully green (no host paths exposed). */
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

function computeStatusTone(
  health: PayoutHealthProbe,
  api: PayoutApiProbe
): SidecarStatusTone {
  if (!health.ok) return "error";
  if (api.skipReason === "no_secret_on_game_server") return "warn";
  if (api.attempted && !api.ok) return "warn";
  if (health.ok && api.ok) return "ok";
  if (health.ok) return "warn";
  return "error";
}

/**
 * Probes `GET {base}/health` and, when `PAYOUT_SERVICE_API_SECRET` is set on this process,
 * `GET {base}/v1/pending/totals` with Bearer auth.
 */
export async function probePayoutService(
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<PayoutServiceAdminSnapshot> {
  const baseUrl = getPayoutServiceBaseUrl();
  if (!baseUrl) {
    return {
      configured: false,
      statusTone: "off",
      hint:
        "Set PAYOUT_SERVICE_URL on the game server (e.g. http://127.0.0.1:3091 or http://payout:3091 in Docker) to enable monitoring.",
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

  const health: PayoutHealthProbe = {
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

  const secret = serverPayoutApiSecret();
  const api: PayoutApiProbe = { attempted: false };

  if (!secret) {
    api.skipReason = "no_secret_on_game_server";
    api.attempted = false;
    const statusTone = computeStatusTone(health, api);
    return {
      configured: true,
      statusTone,
      baseUrl,
      health,
      api,
      logsHint: "docker compose logs payout --tail 100",
    };
  }

  const totalsUrl = `${baseUrl}/v1/pending/totals`;
  const tr = await fetchJson(
    totalsUrl,
    {
      method: "GET",
      headers: { authorization: `Bearer ${secret}` },
    },
    timeoutMs
  );

  api.attempted = true;
  api.statusCode = tr.status || undefined;
  api.latencyMs = tr.latencyMs;
  if (!tr.ok) {
    api.ok = false;
    api.error = tr.text || `HTTP ${tr.status}`;
    const statusTone = computeStatusTone(health, api);
    return {
      configured: true,
      statusTone,
      baseUrl,
      health,
      api,
      logsHint: "docker compose logs payout --tail 100",
    };
  }

  let totalsOk = false;
  if (tr.json && typeof tr.json === "object" && tr.json !== null) {
    const o = tr.json as Record<string, unknown>;
    if (typeof o.jobCount === "number" && typeof o.totalLuna === "string") {
      totalsOk = true;
    }
  }

  api.ok = totalsOk;
  if (!totalsOk) {
    api.error = "invalid_response";
  }

  const statusTone = computeStatusTone(health, api);
  return {
    configured: true,
    statusTone,
    baseUrl,
    health,
    api,
    logsHint: "docker compose logs payout --tail 100",
  };
}
