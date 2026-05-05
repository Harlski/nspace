/**
 * Standalone OHLC proxy for NIM billboards (CoinGecko). Not part of the game server.
 */
import http from "node:http";
import { URL } from "node:url";

const PORT = Math.floor(Number(process.env.PORT ?? "3080")) || 3080;
const COINGECKO_BASE =
  String(process.env.COINGECKO_API_BASE ?? "https://api.coingecko.com/api/v3").replace(
    /\/$/,
    ""
  );
const COIN_ID = String(process.env.COINGECKO_COIN_ID ?? "nimiq-2").trim() || "nimiq-2";
const CACHE_TTL_MS = Math.max(
  15_000,
  Math.floor(Number(process.env.CACHE_TTL_MS ?? "45000")) || 45_000
);

/** @type {Map<string, { at: number; body: string; status: number }>} */
const cache = new Map();

function corsHeaders(origin) {
  const o = String(process.env.CORS_ORIGIN ?? "*").trim() || "*";
  const allow = o === "*" ? "*" : origin && origin === o ? origin : o;
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function sendJson(res, status, obj, extraHeaders = {}) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=30",
    ...extraHeaders,
  });
  res.end(body);
}

function coingeckoHeaders() {
  const headers = {};
  const pro = String(process.env.COINGECKO_API_KEY ?? "").trim();
  if (pro) {
    headers["x-cg-pro-api-key"] = pro;
  }
  const demo = String(process.env.COINGECKO_DEMO_API_KEY ?? "").trim();
  if (demo && !pro) {
    headers["x-cg-demo-api-key"] = demo;
  }
  return headers;
}

async function fetchCoinGeckoOhlc(days) {
  const u = new URL(`${COINGECKO_BASE}/coins/${encodeURIComponent(COIN_ID)}/ohlc`);
  u.searchParams.set("vs_currency", "usd");
  u.searchParams.set("days", String(days));
  const r = await fetch(u.toString(), { headers: coingeckoHeaders() });
  const text = await r.text();
  if (!r.ok) {
    throw new Error(`coingecko_${r.status}: ${text.slice(0, 200)}`);
  }
  const raw = JSON.parse(text);
  if (!Array.isArray(raw)) {
    throw new Error("coingecko_bad_shape");
  }
  /** @type {{ t: number; o: number; h: number; l: number; c: number }[]} */
  const candles = [];
  for (const row of raw) {
    if (!Array.isArray(row) || row.length < 5) continue;
    const t = Number(row[0]);
    const o = Number(row[1]);
    const h = Number(row[2]);
    const l = Number(row[3]);
    const c = Number(row[4]);
    if (!Number.isFinite(t) || !Number.isFinite(o)) continue;
    candles.push({ t, o, h, l, c });
  }
  return candles;
}

function rangeToDays(range) {
  if (range === "24h") return 1;
  if (range === "7d") return 7;
  return null;
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin ?? "";
  const baseH = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    res.writeHead(204, baseH);
    res.end();
    return;
  }

  if (req.method !== "GET") {
    sendJson(res, 405, { error: "method_not_allowed" }, baseH);
    return;
  }

  let path;
  try {
    path = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`).pathname;
  } catch {
    sendJson(res, 400, { error: "bad_url" }, baseH);
    return;
  }

  if (path === "/health") {
    sendJson(res, 200, { ok: true, coinId: COIN_ID }, baseH);
    return;
  }

  if (path !== "/v1/nim/ohlc") {
    sendJson(res, 404, { error: "not_found" }, baseH);
    return;
  }

  let range;
  try {
    const u = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    range = String(u.searchParams.get("range") ?? "").trim();
  } catch {
    range = "";
  }

  const days = rangeToDays(range);
  if (!days) {
    sendJson(
      res,
      400,
      { error: "invalid_range", allowed: ["24h", "7d"] },
      baseH
    );
    return;
  }

  const cacheKey = `${range}`;
  const hit = cache.get(cacheKey);
  const now = Date.now();
  if (hit && now - hit.at < CACHE_TTL_MS) {
    res.writeHead(hit.status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": `public, max-age=${Math.floor(CACHE_TTL_MS / 1000)}`,
      ...baseH,
    });
    res.end(hit.body);
    return;
  }

  try {
    const candles = await fetchCoinGeckoOhlc(days);
    const payload = {
      range,
      days,
      coinId: COIN_ID,
      fetchedAt: now,
      candles,
    };
    const body = JSON.stringify(payload);
    cache.set(cacheKey, { at: now, body, status: 200 });
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": `public, max-age=${Math.floor(CACHE_TTL_MS / 1000)}`,
      ...baseH,
    });
    res.end(body);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const errBody = JSON.stringify({
      error: "upstream_failed",
      message: msg.slice(0, 300),
    });
    cache.set(cacheKey, { at: now, body: errBody, status: 502 });
    res.writeHead(502, {
      "Content-Type": "application/json; charset=utf-8",
      ...baseH,
    });
    res.end(errBody);
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(
    `[nim-chart-service] listening on :${PORT} coin=${COIN_ID} cache=${CACHE_TTL_MS}ms`
  );
});
