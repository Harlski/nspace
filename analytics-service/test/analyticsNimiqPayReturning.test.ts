import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

import {
  clearAnalyticsOverviewCache,
  getEventLogAnalyticsSnapshot,
} from "../src/eventLogAnalytics.js";

function utcDayFile(dir: string, dayStartMs: number): string {
  const d = new Date(dayStartMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return path.join(dir, `events-${y}-${m}-${day}.jsonl`);
}

function appendJsonl(filePath: string, rec: Record<string, unknown>): void {
  fs.appendFileSync(filePath, `${JSON.stringify(rec)}\n`, "utf8");
}

describe("analytics Nimiq Pay returning (lookback before window)", () => {
  let tmpDir = "";
  let prevLogDir: string | undefined;
  let prevTtl: string | undefined;
  let prevLookback: string | undefined;
  let prevIdenticon: string | undefined;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nspace-pay-returning-"));
    prevLogDir = process.env.EVENT_LOG_DIR;
    prevTtl = process.env.ANALYTICS_OVERVIEW_CACHE_TTL_MS;
    prevLookback = process.env.ANALYTICS_FIRST_TIME_LOOKBACK_DAYS;
    prevIdenticon = process.env.ANALYTICS_IDENTICON_STUB;
    process.env.EVENT_LOG_DIR = tmpDir;
    process.env.ANALYTICS_OVERVIEW_CACHE_TTL_MS = "0";
    process.env.ANALYTICS_FIRST_TIME_LOOKBACK_DAYS = "30";
    process.env.ANALYTICS_IDENTICON_STUB = "1";
    clearAnalyticsOverviewCache();
  });

  after(() => {
    clearAnalyticsOverviewCache();
    if (prevLogDir === undefined) delete process.env.EVENT_LOG_DIR;
    else process.env.EVENT_LOG_DIR = prevLogDir;
    if (prevTtl === undefined) delete process.env.ANALYTICS_OVERVIEW_CACHE_TTL_MS;
    else process.env.ANALYTICS_OVERVIEW_CACHE_TTL_MS = prevTtl;
    if (prevLookback === undefined) delete process.env.ANALYTICS_FIRST_TIME_LOOKBACK_DAYS;
    else process.env.ANALYTICS_FIRST_TIME_LOOKBACK_DAYS = prevLookback;
    if (prevIdenticon === undefined) delete process.env.ANALYTICS_IDENTICON_STUB;
    else process.env.ANALYTICS_IDENTICON_STUB = prevIdenticon;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("counts Pay wallets with a pre-window session as returning, not first-time", async () => {
    const now = Date.now();
    const todayStart = Date.UTC(
      new Date(now).getUTCFullYear(),
      new Date(now).getUTCMonth(),
      new Date(now).getUTCDate()
    );
    const dayMs = 86_400_000;
    const beforeWindowStart = todayStart - 10 * dayMs;
    const inWindowStart = todayStart - 1 * dayMs;
    for (let i = 0; i <= 10; i += 1) {
      const dayStart = todayStart - i * dayMs;
      const fp = utcDayFile(tmpDir, dayStart);
      if (!fs.existsSync(fp)) fs.writeFileSync(fp, "", "utf8");
    }

    const returningWallet = "NQRETURNINGPAYXXXXXXXXXXXXXXXXX";
    const firstTimeWallet = "NQFIRSTTIMEPAYXXXXXXXXXXXXXXXXX";

    appendJsonl(utcDayFile(tmpDir, beforeWindowStart), {
      ts: beforeWindowStart + 60_000,
      kind: "session_start",
      sessionId: "sess-before",
      address: returningWallet,
      roomId: "hub",
      payload: { nimiqPay: true },
    });
    appendJsonl(utcDayFile(tmpDir, inWindowStart), {
      ts: inWindowStart + 60_000,
      kind: "session_start",
      sessionId: "sess-in-window-returning",
      address: returningWallet,
      roomId: "hub",
      payload: { nimiqPay: true },
    });
    appendJsonl(utcDayFile(tmpDir, inWindowStart), {
      ts: inWindowStart + 120_000,
      kind: "session_start",
      sessionId: "sess-in-window-ftu",
      address: firstTimeWallet,
      roomId: "hub",
      payload: { nimiqPay: true },
    });

    const snap = await getEventLogAnalyticsSnapshot(7, 50, 50);
    assert.equal(snap.nimiqPay.uniqueVisitors, 2);
    assert.equal(snap.nimiqPay.firstTime, 1, "only the first-ever Pay wallet is FTU");
    assert.equal(snap.nimiqPay.returning, 1, "pre-window Pay session must count as returning");
    assert.ok(
      snap.fileDaysScanned > 7,
      `expected lookback beyond the 7d window, got fileDaysScanned=${snap.fileDaysScanned}`
    );
  });
});
