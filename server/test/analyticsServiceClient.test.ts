import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { Server } from "node:http";
import { createAnalyticsApp } from "../../analytics-service/src/app.js";
import type { AnalyticsServiceConfig } from "../../analytics-service/src/config.js";
import { clearAnalyticsOverviewCache } from "../../analytics-service/src/eventLogAnalytics.js";
import {
  fetchDailyStatsAggregate,
  fetchEventLogAnalyticsSnapshot,
  isAnalyticsServiceClientConfigured,
} from "../src/analyticsServiceClient.js";

const SECRET = "game-proxy-analytics-secret";

async function withSidecar(
  t: test.TestContext,
  run: (eventLogDir: string) => Promise<void>
): Promise<void> {
  const eventLogDir = fs.mkdtempSync(path.join(os.tmpdir(), "analytics-proxy-"));
  t.after(() => fs.rmSync(eventLogDir, { recursive: true, force: true }));
  process.env.ANALYTICS_IDENTICON_STUB = "1";
  process.env.ANALYTICS_OVERVIEW_CACHE_TTL_MS = "0";
  clearAnalyticsOverviewCache();

  const cfg: AnalyticsServiceConfig = {
    host: "127.0.0.1",
    port: 0,
    apiSecret: SECRET,
    eventLogDir,
  };
  const { app } = createAnalyticsApp({ cfg });
  const server: Server = await new Promise((resolve, reject) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
    s.on("error", reject);
  });
  t.after(() => {
    server.close();
    clearAnalyticsOverviewCache();
  });
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("expected bound port");
  const prevUrl = process.env.ANALYTICS_SERVICE_URL;
  const prevSecret = process.env.ANALYTICS_SERVICE_API_SECRET;
  process.env.ANALYTICS_SERVICE_URL = `http://127.0.0.1:${addr.port}`;
  process.env.ANALYTICS_SERVICE_API_SECRET = SECRET;
  t.after(() => {
    if (prevUrl === undefined) delete process.env.ANALYTICS_SERVICE_URL;
    else process.env.ANALYTICS_SERVICE_URL = prevUrl;
    if (prevSecret === undefined) delete process.env.ANALYTICS_SERVICE_API_SECRET;
    else process.env.ANALYTICS_SERVICE_API_SECRET = prevSecret;
  });
  await run(eventLogDir);
}

test("overview proxy fails without hanging when the Analytics Service is down", async () => {
  const prevUrl = process.env.ANALYTICS_SERVICE_URL;
  const prevSecret = process.env.ANALYTICS_SERVICE_API_SECRET;
  const prevTimeout = process.env.ANALYTICS_SERVICE_FETCH_TIMEOUT_MS;
  process.env.ANALYTICS_SERVICE_URL = "http://127.0.0.1:1";
  process.env.ANALYTICS_SERVICE_API_SECRET = SECRET;
  process.env.ANALYTICS_SERVICE_FETCH_TIMEOUT_MS = "2000";
  try {
    const result = await fetchEventLogAnalyticsSnapshot(1, 50, 50);
    assert.equal(result.ok, false);
  } finally {
    if (prevUrl === undefined) delete process.env.ANALYTICS_SERVICE_URL;
    else process.env.ANALYTICS_SERVICE_URL = prevUrl;
    if (prevSecret === undefined) delete process.env.ANALYTICS_SERVICE_API_SECRET;
    else process.env.ANALYTICS_SERVICE_API_SECRET = prevSecret;
    if (prevTimeout === undefined) delete process.env.ANALYTICS_SERVICE_FETCH_TIMEOUT_MS;
    else process.env.ANALYTICS_SERVICE_FETCH_TIMEOUT_MS = prevTimeout;
  }
});

test("analytics client is not configured without URL and secret", () => {
  const prevUrl = process.env.ANALYTICS_SERVICE_URL;
  const prevSecret = process.env.ANALYTICS_SERVICE_API_SECRET;
  delete process.env.ANALYTICS_SERVICE_URL;
  delete process.env.ANALYTICS_SERVICE_API_SECRET;
  try {
    assert.equal(isAnalyticsServiceClientConfigured(), false);
  } finally {
    if (prevUrl === undefined) delete process.env.ANALYTICS_SERVICE_URL;
    else process.env.ANALYTICS_SERVICE_URL = prevUrl;
    if (prevSecret === undefined) delete process.env.ANALYTICS_SERVICE_API_SECRET;
    else process.env.ANALYTICS_SERVICE_API_SECRET = prevSecret;
  }
});

test("game overview proxy reads unique visitors from the Analytics Service", async (t) => {
  await withSidecar(t, async (eventLogDir) => {
    const now = Date.now();
    const d = new Date(now);
    const day = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    fs.writeFileSync(
      path.join(eventLogDir, `events-${day}.jsonl`),
      `${JSON.stringify({
        ts: now,
        kind: "session_start",
        sessionId: "proxy-s1",
        address: "NQPROXYWALLETXXXXXXXXXXXXXXXXXX",
        roomId: "hub",
      })}\n`
    );
    const result = await fetchEventLogAnalyticsSnapshot(1, 50, 50);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const snap = result.value as {
      uniqueVisitors: number;
      visitorWalletIds: string[];
      chosenFlags: { uniqueVisitors: number };
    };
    assert.equal(snap.uniqueVisitors, 1);
    assert.deepEqual(snap.visitorWalletIds, ["NQPROXYWALLETXXXXXXXXXXXXXXXXXX"]);
    assert.equal(snap.chosenFlags.uniqueVisitors, 1);
  });
});

test("game daily-stats proxy reads the day's unique sign-ins from the Analytics Service", async (t) => {
  await withSidecar(t, async (eventLogDir) => {
    const now = Date.now();
    const dayStart = Date.UTC(
      new Date(now).getUTCFullYear(),
      new Date(now).getUTCMonth(),
      new Date(now).getUTCDate()
    );
    const d = new Date(dayStart);
    const day = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    fs.writeFileSync(
      path.join(eventLogDir, `events-${day}.jsonl`),
      `${JSON.stringify({
        ts: dayStart + 60_000,
        kind: "session_start",
        sessionId: "proxy-day",
        address: "NQPROXYDAYXXXXXXXXXXXXXXXXXXXXX",
        roomId: "hub",
      })}\n`
    );
    const result = await fetchDailyStatsAggregate(dayStart, dayStart + 86_400_000, 7);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.uniqueSignedIn, 1);
  });
});
