import {
  BILLBOARD_ADVERTS_CATALOG,
  getBillboardAdvertById,
} from "./billboardAdvertsCatalog.js";

export type BillboardLiveChartRange = "24h" | "7d";

export type BillboardLiveChart = {
  range: BillboardLiveChartRange;
  /** Catalog id whose first slide is shown when OHLC cannot be loaded (client). */
  fallbackAdvertId: string;
  /** Client cycles 24h ↔ 7d when true. */
  rangeCycle?: boolean;
  /** Seconds per range when `rangeCycle` (5–300; default 20). */
  cycleIntervalSec?: number;
};

/** Same-origin asset; client skips loading it when `liveChart` is set (canvas drives the face). */
export const BILLBOARD_LIVE_CHART_PLACEHOLDER_SLIDE =
  "/nim-billboard-chart-placeholder.png";

const DEFAULT_FALLBACK_ADVERT_ID =
  BILLBOARD_ADVERTS_CATALOG[0]?.id ?? "nimiq_bb";

function parseCycleIntervalSec(raw: unknown): number | undefined {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return undefined;
  return Math.max(5, Math.min(300, n));
}

function resolveFallbackAdvertId(raw: unknown): string {
  const id = String(
    raw && typeof raw === "object"
      ? (raw as Record<string, unknown>).fallbackAdvertId ?? ""
      : ""
  ).trim();
  return getBillboardAdvertById(id) ? id : DEFAULT_FALLBACK_ADVERT_ID;
}

export function parseBillboardLiveChartFromMessage(
  msg: Record<string, unknown>
): BillboardLiveChart | null {
  const v = msg.liveChart;
  if (v === false || v === null) return null;
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const r = String(o.range ?? "").trim();
  const fallbackAdvertId = resolveFallbackAdvertId(v);
  const rangeCycle = o.rangeCycle === true;
  const cycleIntervalSec = rangeCycle
    ? parseCycleIntervalSec(o.cycleIntervalSec) ?? 20
    : undefined;
  const cyclePart = rangeCycle
    ? { rangeCycle: true as const, cycleIntervalSec }
    : {};
  if (r === "24h" || r === "1d")
    return { range: "24h", fallbackAdvertId, ...cyclePart };
  if (r === "7d") return { range: "7d", fallbackAdvertId, ...cyclePart };
  /** Legacy short-range key → 24h chart. */
  if (r === "60m" || r === "1h")
    return { range: "24h", fallbackAdvertId, ...cyclePart };
  return null;
}

/** Disk / wire shape may omit `fallbackAdvertId` (legacy). */
export function isBillboardLiveChart(
  x: unknown
): x is { range: BillboardLiveChartRange; fallbackAdvertId?: string } {
  if (!x || typeof x !== "object") return false;
  const r = (x as { range?: unknown }).range;
  return r === "24h" || r === "7d" || r === "60m" || r === "1h";
}

/** Normalize persisted or partial `liveChart` to a full record. */
export function normalizeLiveChartWire(
  x: unknown
): BillboardLiveChart | null {
  if (!isBillboardLiveChart(x)) return null;
  const raw = x as Record<string, unknown>;
  const range = String(raw.range);
  const rangeCycle = raw.rangeCycle === true;
  const cycleIntervalSec = rangeCycle
    ? parseCycleIntervalSec(raw.cycleIntervalSec) ?? 20
    : undefined;
  return {
    range: range === "7d" ? "7d" : "24h",
    fallbackAdvertId: resolveFallbackAdvertId(x),
    ...(rangeCycle ? { rangeCycle: true, cycleIntervalSec } : {}),
  };
}
