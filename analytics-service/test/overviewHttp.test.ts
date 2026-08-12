import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { Server } from "node:http";
import { createAnalyticsApp } from "../src/app.js";
import { clearAnalyticsOverviewCache } from "../src/eventLogAnalytics.js";
import type { AnalyticsServiceConfig } from "../src/config.js";

const SECRET = "unit-test-analytics-secret";

function testCfg(eventLogDir: string): AnalyticsServiceConfig {
  return {
    host: "127.0.0.1",
    port: 0,
    apiSecret: SECRET,
    eventLogDir,
  };
}

async function withServer(
  t: test.TestContext,
  run: (baseUrl: string, eventLogDir: string) => Promise<void>
): Promise<void> {
  const eventLogDir = fs.mkdtempSync(path.join(os.tmpdir(), "analytics-svc-"));
  t.after(() => {
    fs.rmSync(eventLogDir, { recursive: true, force: true });
  });
  process.env.ANALYTICS_IDENTICON_STUB = "1";
  process.env.ANALYTICS_OVERVIEW_CACHE_TTL_MS = "0";
  clearAnalyticsOverviewCache();

  const { app } = createAnalyticsApp({ cfg: testCfg(eventLogDir) });
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
  await run(`http://127.0.0.1:${addr.port}`, eventLogDir);
}

test("GET /v1/overview without bearer is unauthorized", async (t) => {
  await withServer(t, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/v1/overview`);
    assert.equal(res.status, 401);
  });
});

test("GET /v1/overview with bearer returns an empty snapshot", async (t) => {
  await withServer(t, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/v1/overview`, {
      headers: { authorization: `Bearer ${SECRET}` },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { uniqueVisitors: number };
    assert.equal(body.uniqueVisitors, 0);
  });
});

test("GET /v1/overview counts session_start wallets as unique visitors", async (t) => {
  await withServer(t, async (baseUrl, eventLogDir) => {
    const now = Date.now();
    const d = new Date(now);
    const day = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    fs.writeFileSync(
      path.join(eventLogDir, `events-${day}.jsonl`),
      `${JSON.stringify({
        ts: now,
        kind: "session_start",
        sessionId: "s1",
        address: "NQTESTADDR1XXXXXXXXXXXXXXXXXXXXX",
        roomId: "hub",
      })}\n`
    );
    const res = await fetch(`${baseUrl}/v1/overview?days=1`, {
      headers: { authorization: `Bearer ${SECRET}` },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      uniqueVisitors: number;
      visitorWalletIds: string[];
    };
    assert.equal(body.uniqueVisitors, 1);
    assert.deepEqual(body.visitorWalletIds, ["NQTESTADDR1XXXXXXXXXXXXXXXXXXXXX"]);
  });
});

test("GET /v1/daily-stats-aggregate counts the day's session_start wallets", async (t) => {
  await withServer(t, async (baseUrl, eventLogDir) => {
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
        sessionId: "s-day",
        address: "NQDAYWALLETXXXXXXXXXXXXXXXXXXXX",
        roomId: "hub",
      })}\n`
    );
    const qs = new URLSearchParams({
      dayStartMs: String(dayStart),
      dayEndMs: String(dayStart + 86_400_000),
      lookbackDays: "7",
    });
    const res = await fetch(`${baseUrl}/v1/daily-stats-aggregate?${qs}`, {
      headers: { authorization: `Bearer ${SECRET}` },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { uniqueSignedIn: number; newSignedIn: number };
    assert.equal(body.uniqueSignedIn, 1);
    assert.equal(body.newSignedIn, 1);
  });
});
