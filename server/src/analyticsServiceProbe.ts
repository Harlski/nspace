/**
 * Optional reachability checks for the Analytics Service sidecar (`/admin/system`).
 * Health only — never call overview (that scan is the work we isolated).
 */

import {
  getAnalyticsServiceBaseUrl,
  normalizeAnalyticsServiceBaseUrl,
} from "./analyticsServiceClient.js";
import type { SidecarStatusTone } from "./paymentIntentProbe.js";

const DEFAULT_TIMEOUT_MS = 3000;

export type AnalyticsServiceAdminSnapshot =
  | { configured: false; statusTone: "off"; hint: string }
  | {
      configured: true;
      statusTone: SidecarStatusTone;
      baseUrl: string;
      health: {
        reached: boolean;
        ok: boolean;
        statusCode?: number;
        latencyMs: number;
        service?: string;
        error?: string;
      };
      logsHint: string;
    };

export async function probeAnalyticsService(
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<AnalyticsServiceAdminSnapshot> {
  const baseUrl = getAnalyticsServiceBaseUrl();
  if (!baseUrl) {
    return {
      configured: false,
      statusTone: "off",
      hint:
        "Set ANALYTICS_SERVICE_URL on the game server (e.g. http://127.0.0.1:3092 or http://analytics:3092 in Docker).",
    };
  }

  const t0 = Date.now();
  try {
    const res = await fetch(`${normalizeAnalyticsServiceBaseUrl(baseUrl)}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const latencyMs = Date.now() - t0;
    const text = await res.text();
    let service: string | undefined;
    let bodyOk = false;
    try {
      const json = JSON.parse(text) as { ok?: unknown; service?: unknown };
      if (json.ok === true) bodyOk = true;
      if (typeof json.service === "string") service = json.service;
    } catch {
      /* ignore */
    }
    const ok = res.ok && res.status === 200 && bodyOk;
    return {
      configured: true,
      statusTone: ok ? "ok" : "error",
      baseUrl,
      health: {
        reached: true,
        ok,
        statusCode: res.status,
        latencyMs,
        service,
        error: ok ? undefined : text.slice(0, 500) || `HTTP ${res.status}`,
      },
      logsHint: "docker compose logs analytics --tail 80",
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      configured: true,
      statusTone: "error",
      baseUrl,
      health: {
        reached: false,
        ok: false,
        latencyMs: Date.now() - t0,
        error: msg || "Unreachable (DNS, refused, or timeout)",
      },
      logsHint: "docker compose logs analytics --tail 80",
    };
  }
}
