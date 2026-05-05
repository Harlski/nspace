/** Texture resolution for live NIM candlestick billboards (matches modal preview). */
export const NIM_BILLBOARD_CHART_W = 1024;
export const NIM_BILLBOARD_CHART_H = 638;

/** Canvas text (matches app: Google Muli / Mulish). */
export const NIM_BILLBOARD_CHART_FONT =
  "'Muli','Mulish',system-ui,sans-serif";

export type NimBillboardChartRange = "24h" | "7d";

export type NimOhlcCandle = {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
};

export type NimOhlcResponse = {
  range: string;
  fetchedAt: number;
  candles: NimOhlcCandle[];
};

function nimChartApiBaseUrl(): string {
  const raw = String(
    import.meta.env.VITE_NIM_CHART_API_URL ?? ""
  ).trim();
  if (raw) return raw.replace(/\/$/, "");
  if (import.meta.env.DEV) return "/nim-chart-api";
  return "";
}

/** Wait for Muli/Mulish so canvas draws match UI (no-op if Font Loading API missing). */
export function ensureNimChartFontsLoaded(): Promise<unknown> {
  if (typeof document === "undefined" || !document.fonts?.load) {
    return Promise.resolve();
  }
  return document.fonts
    .load(`18px Muli`)
    .then(() => document.fonts.load(`600 26px Muli`).catch(() => undefined))
    .catch(() => undefined);
}

export function nimChartTitleForRange(range: NimBillboardChartRange): string {
  if (range === "7d") return "NIM · 7d";
  return "NIM · 24h";
}

function formatCountdownMmSs(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

/** Top-right overlay: time until next client poll (call after `drawNimBillboardCandles`). */
export function drawNimChartRefreshCountdown(
  ctx: CanvasRenderingContext2D,
  w: number,
  _h: number,
  remainingSec: number
): void {
  const edge = 26;
  const label =
    remainingSec <= 0 ? "Updating…" : `Next update ${formatCountdownMmSs(remainingSec)}`;
  ctx.save();
  ctx.font = `600 26px ${NIM_BILLBOARD_CHART_FONT}`;
  const tw = ctx.measureText(label).width;
  const padX = 14;
  const boxW = tw + padX * 2;
  const boxH = 40;
  const x = Math.max(edge, w - edge - boxW);
  const y = edge + 2;
  ctx.fillStyle = "rgba(15, 23, 42, 0.82)";
  const r = 6;
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, boxW, boxH, r);
    ctx.fill();
  } else {
    ctx.fillRect(x, y, boxW, boxH);
  }
  ctx.fillStyle = "#e2e8f0";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + boxW / 2, y + boxH / 2);
  ctx.restore();
}

export async function fetchNimBillboardOhlc(
  range: NimBillboardChartRange
): Promise<NimOhlcResponse> {
  const base = nimChartApiBaseUrl();
  if (!base) {
    throw new Error("nim_chart_api_unconfigured");
  }
  const u = `${base}/v1/nim/ohlc?range=${encodeURIComponent(range)}`;
  const r = await fetch(u);
  const j = (await r.json()) as NimOhlcResponse & { error?: string };
  if (!r.ok || j.error) {
    throw new Error(j.error ?? `http_${r.status}`);
  }
  if (!Array.isArray(j.candles)) {
    throw new Error("bad_candles");
  }
  return j;
}

export function drawNimBillboardCandles(
  ctx: CanvasRenderingContext2D,
  candles: readonly NimOhlcCandle[],
  w: number,
  h: number,
  title: string
): void {
  const edge = 26;
  const labelColW = 86;
  const titleBlockH = 44;
  const footerH = 30;
  const plotLeft = edge + labelColW;
  const plotRight = w - edge;
  const plotTop = edge + titleBlockH;
  const plotBottom = h - edge - footerH;
  const innerW = Math.max(40, plotRight - plotLeft);
  const innerH = Math.max(40, plotBottom - plotTop);

  ctx.fillStyle = "#0b0f14";
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "#e2e8f0";
  ctx.font = `600 26px ${NIM_BILLBOARD_CHART_FONT}`;
  ctx.textAlign = "left";
  ctx.fillText(title, edge + 2, edge + 30);

  const n = candles.length;
  if (n === 0) {
    ctx.fillStyle = "#64748b";
    ctx.font = `22px ${NIM_BILLBOARD_CHART_FONT}`;
    ctx.textAlign = "left";
    ctx.fillText("No OHLC data yet.", plotLeft, plotTop + innerH / 2);
    return;
  }

  let lo = Infinity;
  let hi = -Infinity;
  for (const c of candles) {
    lo = Math.min(lo, c.l);
    hi = Math.max(hi, c.h);
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) {
    lo = candles[0]!.l;
    hi = candles[0]!.h;
    if (hi <= lo) {
      hi = lo + Math.abs(lo) * 0.001 + 1e-9;
    }
  }
  const span = hi - lo;
  const padY = span * 0.06;
  const yMin = lo - padY;
  const yMax = hi + padY;
  const ySpan = yMax - yMin;

  const yToPx = (price: number) =>
    plotTop + innerH - ((price - yMin) / ySpan) * innerH;

  ctx.strokeStyle = "rgba(148,163,184,0.25)";
  ctx.lineWidth = 1;
  for (let g = 0; g <= 4; g++) {
    const y = plotTop + (innerH * g) / 4;
    ctx.beginPath();
    ctx.moveTo(plotLeft, y);
    ctx.lineTo(plotLeft + innerW, y);
    ctx.stroke();
    const price = yMax - (ySpan * g) / 4;
    ctx.fillStyle = "#94a3b8";
    ctx.font = `500 18px ${NIM_BILLBOARD_CHART_FONT}`;
    ctx.textAlign = "right";
    const label = price < 0.01 ? price.toFixed(6) : price.toFixed(4);
    ctx.fillText(label, plotLeft - 10, y + 6);
  }

  const slot = innerW / Math.max(1, n);
  const bodyW = Math.max(3, Math.min(22, slot * 0.62));

  for (let i = 0; i < n; i++) {
    const c = candles[i]!;
    const cx = plotLeft + i * slot + slot / 2;
    const yO = yToPx(c.o);
    const yC = yToPx(c.c);
    const yH = yToPx(c.h);
    const yL = yToPx(c.l);
    const top = Math.min(yO, yC);
    const bot = Math.max(yO, yC);
    const bull = c.c >= c.o;
    ctx.strokeStyle = bull ? "#22c55e" : "#f87171";
    ctx.fillStyle = bull ? "#16a34a" : "#dc2626";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, yH);
    ctx.lineTo(cx, yL);
    ctx.stroke();
    const bw = bodyW;
    ctx.fillRect(cx - bw / 2, top, bw, Math.max(2, bot - top));
  }

  ctx.fillStyle = "#64748b";
  ctx.font = `500 14px ${NIM_BILLBOARD_CHART_FONT}`;
  ctx.textAlign = "right";
  ctx.fillText("USD · CoinGecko", w - edge - 4, h - edge - 6);
}
