import { aggregateChosenFlags } from "./analyticsChosenFlags.js";
import { playerWalletLabel } from "./playerWalletLabel.js";
import { getPlayerCountry } from "./worldcup/scoreStore.js";

export type AnalyticsTimeWindow = {
  fromTs?: number;
  toTs?: number;
};

export type DailyStatsAggregate = {
  dayUtc: string;
  dayStartMs: number;
  dayEndMs: number;
  lookbackDays: number;
  uniqueSignedIn: number;
  newSignedIn: number;
  nimiqPaySignedIn: number;
  nonNimiqPaySignedIn: number;
  sessionStarts: number;
  payoutsSent: number;
  payoutRecipients: number;
  payoutLunaTotal: string;
  payoutNimTotal: string | null;
  activePlayMsTotal: number;
  endedSessionsCounted: number;
};

export function normalizeAnalyticsServiceBaseUrl(
  raw: string | undefined | null
): string | null {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  return t.replace(/\/+$/, "");
}

export function getAnalyticsServiceBaseUrl(): string | null {
  return normalizeAnalyticsServiceBaseUrl(process.env.ANALYTICS_SERVICE_URL);
}

function apiSecret(): string | null {
  const s = process.env.ANALYTICS_SERVICE_API_SECRET?.trim();
  return s || null;
}

export function isAnalyticsServiceClientConfigured(): boolean {
  return getAnalyticsServiceBaseUrl() != null && apiSecret() != null;
}

function overviewTimeoutMs(): number {
  const raw = Number(process.env.ANALYTICS_SERVICE_FETCH_TIMEOUT_MS);
  if (Number.isFinite(raw) && raw >= 1000) return Math.floor(raw);
  return 180_000;
}

async function analyticsFetch(
  path: string,
  init: RequestInit,
  opts?: { timeoutMs?: number }
): Promise<{ ok: boolean; status: number; json: unknown | null; text: string }> {
  const base = getAnalyticsServiceBaseUrl();
  const secret = apiSecret();
  if (!base || !secret) {
    return {
      ok: false,
      status: 0,
      json: null,
      text: "analytics_service_not_configured",
    };
  }
  const url = `${normalizeAnalyticsServiceBaseUrl(base)}${path}`;
  const timeoutMs = opts?.timeoutMs ?? overviewTimeoutMs();
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        authorization: `Bearer ${secret}`,
        ...(init.headers as Record<string, string> | undefined),
      },
      signal: AbortSignal.timeout(timeoutMs),
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

function enrichOverviewSnapshot(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) {
      for (const item of v) walk(item);
      return;
    }
    if (!v || typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    const id = String(o.walletId ?? o.address ?? o.recipient ?? "");
    if (id && "displayName" in o) o.displayName = playerWalletLabel(id);
    for (const child of Object.values(o)) walk(child);
  };
  walk(raw);
  const snap = raw as {
    visitors?: { walletId?: string }[];
    visitorWalletIds?: unknown;
    chosenFlags?: unknown;
  };
  const flagWallets = Array.isArray(snap.visitorWalletIds)
    ? snap.visitorWalletIds.map((id) => String(id ?? "")).filter(Boolean)
    : Array.isArray(snap.visitors)
      ? snap.visitors.map((row) => String(row.walletId ?? "")).filter(Boolean)
      : [];
  if (flagWallets.length) {
    snap.chosenFlags = aggregateChosenFlags(flagWallets, getPlayerCountry);
  }
  return raw;
}

export type AnalyticsServiceReadResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; status?: number };

export async function fetchEventLogAnalyticsSnapshot(
  maxDays: number,
  sessionLimit: number,
  payoutLimit: number,
  timeWindow?: AnalyticsTimeWindow
): Promise<AnalyticsServiceReadResult<unknown>> {
  const qs = new URLSearchParams({
    days: String(maxDays),
    sessions: String(sessionLimit),
    payouts: String(payoutLimit),
  });
  if (timeWindow?.fromTs != null) qs.set("fromTs", String(timeWindow.fromTs));
  if (timeWindow?.toTs != null) qs.set("toTs", String(timeWindow.toTs));
  const r = await analyticsFetch(`/v1/overview?${qs}`, { method: "GET" });
  if (!r.ok) {
    return {
      ok: false,
      error: r.text || `HTTP ${r.status}`,
      status: r.status || undefined,
    };
  }
  return { ok: true, value: enrichOverviewSnapshot(r.json) };
}

export async function fetchDailyStatsAggregate(
  dayStartMs: number,
  dayEndMs: number,
  lookbackDays: number
): Promise<AnalyticsServiceReadResult<DailyStatsAggregate>> {
  const qs = new URLSearchParams({
    dayStartMs: String(dayStartMs),
    dayEndMs: String(dayEndMs),
    lookbackDays: String(lookbackDays),
  });
  const r = await analyticsFetch(`/v1/daily-stats-aggregate?${qs}`, {
    method: "GET",
  });
  if (!r.ok) {
    return {
      ok: false,
      error: r.text || `HTTP ${r.status}`,
      status: r.status || undefined,
    };
  }
  if (!r.json || typeof r.json !== "object") {
    return { ok: false, error: "invalid_response", status: r.status };
  }
  return { ok: true, value: r.json as DailyStatsAggregate };
}
