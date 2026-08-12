import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

import {
  clearAnalyticsOverviewCache,
  getEventLogAnalyticsSnapshot,
} from "../src/eventLogAnalytics.js";

function todayFile(dir: string): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return path.join(dir, `events-${y}-${m}-${day}.jsonl`);
}

function appendStart(dir: string, address: string, sessionId: string): void {
  fs.appendFileSync(
    todayFile(dir),
    `${JSON.stringify({
      ts: Date.now(),
      kind: "session_start",
      sessionId,
      address,
      roomId: "hub",
    })}\n`,
    "utf8"
  );
}

describe("getEventLogAnalyticsSnapshot cache", () => {
  let tmpDir = "";
  let prevLogDir: string | undefined;
  let prevTtl: string | undefined;
  let prevIdenticon: string | undefined;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nspace-analytics-cache-"));
    prevLogDir = process.env.EVENT_LOG_DIR;
    prevTtl = process.env.ANALYTICS_OVERVIEW_CACHE_TTL_MS;
    prevIdenticon = process.env.ANALYTICS_IDENTICON_STUB;
    process.env.EVENT_LOG_DIR = tmpDir;
    process.env.ANALYTICS_IDENTICON_STUB = "1";
    clearAnalyticsOverviewCache();
  });

  after(() => {
    clearAnalyticsOverviewCache();
    if (prevLogDir === undefined) delete process.env.EVENT_LOG_DIR;
    else process.env.EVENT_LOG_DIR = prevLogDir;
    if (prevTtl === undefined) delete process.env.ANALYTICS_OVERVIEW_CACHE_TTL_MS;
    else process.env.ANALYTICS_OVERVIEW_CACHE_TTL_MS = prevTtl;
    if (prevIdenticon === undefined) delete process.env.ANALYTICS_IDENTICON_STUB;
    else process.env.ANALYTICS_IDENTICON_STUB = prevIdenticon;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("serves a second identical overview from cache without re-scanning", async () => {
    process.env.ANALYTICS_OVERVIEW_CACHE_TTL_MS = "60000";
    clearAnalyticsOverviewCache();
    appendStart(tmpDir, "NQTESTADDR1XXXXXXXXXXXXXXXXXXXXX", "s1");

    const a = await getEventLogAnalyticsSnapshot(7, 50, 50);
    const generatedAt = a.generatedAt;
    assert.ok(a.uniqueVisitors >= 1);
    assert.ok(a.chosenFlags);
    assert.equal(a.chosenFlags.uniqueVisitors, a.uniqueVisitors);

    appendStart(tmpDir, "NQTESTADDR2XXXXXXXXXXXXXXXXXXXXX", "s2");
    const b = await getEventLogAnalyticsSnapshot(7, 50, 50);
    assert.equal(b.generatedAt, generatedAt);
    assert.equal(b.uniqueVisitors, a.uniqueVisitors);
  });

  it("bypasses cache when TTL is 0", async () => {
    process.env.ANALYTICS_OVERVIEW_CACHE_TTL_MS = "0";
    clearAnalyticsOverviewCache();
    const a = await getEventLogAnalyticsSnapshot(7, 50, 50);
    appendStart(tmpDir, "NQTESTADDR3XXXXXXXXXXXXXXXXXXXXX", "s3");
    const b = await getEventLogAnalyticsSnapshot(7, 50, 50);
    assert.notEqual(b.generatedAt, a.generatedAt);
  });
});
