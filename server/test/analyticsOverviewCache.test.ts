import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

import {
  beginSession,
  clearAnalyticsOverviewCache,
  getEventLogAnalyticsSnapshot,
} from "../src/eventLog.js";

describe("getEventLogAnalyticsSnapshot cache", () => {
  let tmpDir = "";
  let prevLogDir: string | undefined;
  let prevTtl: string | undefined;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nspace-analytics-cache-"));
    prevLogDir = process.env.EVENT_LOG_DIR;
    prevTtl = process.env.ANALYTICS_OVERVIEW_CACHE_TTL_MS;
    process.env.EVENT_LOG_DIR = tmpDir;
    clearAnalyticsOverviewCache();
  });

  after(() => {
    clearAnalyticsOverviewCache();
    if (prevLogDir === undefined) delete process.env.EVENT_LOG_DIR;
    else process.env.EVENT_LOG_DIR = prevLogDir;
    if (prevTtl === undefined) delete process.env.ANALYTICS_OVERVIEW_CACHE_TTL_MS;
    else process.env.ANALYTICS_OVERVIEW_CACHE_TTL_MS = prevTtl;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("serves a second identical overview from cache without re-scanning", async () => {
    process.env.ANALYTICS_OVERVIEW_CACHE_TTL_MS = "60000";
    clearAnalyticsOverviewCache();
    beginSession("NQTESTADDR1XXXXXXXXXXXXXXXXXXXXX", "hub");

    const a = await getEventLogAnalyticsSnapshot(7, 50, 50);
    const generatedAt = a.generatedAt;
    assert.ok(a.uniqueVisitors >= 1);
    assert.ok(a.chosenFlags);
    assert.equal(a.chosenFlags.uniqueVisitors, a.uniqueVisitors);
    assert.equal(typeof a.chosenFlags.withFlag, "number");
    assert.ok(Array.isArray(a.chosenFlags.byCountry));
    assert.ok(a.nimiqPay);
    assert.equal(typeof a.nimiqPay.uniqueVisitors, "number");
    assert.equal(typeof a.nimiqPay.firstTime, "number");
    assert.ok(Array.isArray(a.nimiqPay.byDay));

    // Append another start; cache should still return the prior snapshot.
    beginSession("NQTESTADDR2XXXXXXXXXXXXXXXXXXXXX", "hub");
    const b = await getEventLogAnalyticsSnapshot(7, 50, 50);
    assert.equal(b.generatedAt, generatedAt);
    assert.equal(b.uniqueVisitors, a.uniqueVisitors);
  });

  it("bypasses cache when TTL is 0", async () => {
    process.env.ANALYTICS_OVERVIEW_CACHE_TTL_MS = "0";
    clearAnalyticsOverviewCache();
    const a = await getEventLogAnalyticsSnapshot(7, 50, 50);
    beginSession("NQTESTADDR3XXXXXXXXXXXXXXXXXXXXX", "hub");
    const b = await getEventLogAnalyticsSnapshot(7, 50, 50);
    assert.notEqual(b.generatedAt, a.generatedAt);
  });
});
