import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { getConnectNoticeStatsForAddress } from "../src/eventLog.js";

test("getConnectNoticeStatsForAddress aggregates last visit and today UTC", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nspace-connect-stats-"));
  const prev = process.env.EVENT_LOG_DIR;
  process.env.EVENT_LOG_DIR = dir;
  try {
    const wallet = "NQTESTAAAAAAAAAAAAAAAAAAAAAAAA03";
    const dayStart = Date.UTC(2026, 6, 1, 0, 0, 0);
    const prevSessionId = "prev-session";
    const todaySessionId = "today-session";
    const prevStart = dayStart - 2 * 3_600_000;
    const prevEnd = dayStart - 3_600_000;
    const todayStart = dayStart + 3_600_000;
    const todayEnd = dayStart + 5_400_000;
    const logFile = path.join(dir, "events-2026-07-01.jsonl");
    const lines = [
      {
        ts: prevStart,
        kind: "session_start",
        sessionId: prevSessionId,
        address: wallet,
        roomId: "hub",
      },
      {
        ts: prevStart + 60_000,
        kind: "move_to",
        sessionId: prevSessionId,
        address: wallet,
        roomId: "hub",
      },
      {
        ts: prevEnd - 30_000,
        kind: "nim_payout_sent",
        sessionId: prevSessionId,
        address: wallet,
        roomId: "hub",
        payload: { amountLuna: "150000", sentAt: prevEnd - 30_000 },
      },
      {
        ts: prevEnd,
        kind: "session_end",
        sessionId: prevSessionId,
        address: wallet,
        roomId: "hub",
        durationMs: prevEnd - prevStart,
      },
      {
        ts: todayStart,
        kind: "session_start",
        sessionId: todaySessionId,
        address: wallet,
        roomId: "chamber",
      },
      {
        ts: todayStart + 120_000,
        kind: "chat",
        sessionId: todaySessionId,
        address: wallet,
        roomId: "chamber",
      },
      {
        ts: todayEnd - 10_000,
        kind: "nim_payout_sent",
        sessionId: todaySessionId,
        address: wallet,
        roomId: "chamber",
        payload: { amountLuna: "200000", sentAt: todayEnd - 10_000 },
      },
      {
        ts: todayEnd,
        kind: "session_end",
        sessionId: todaySessionId,
        address: wallet,
        roomId: "chamber",
        durationMs: todayEnd - todayStart,
      },
    ];
    fs.writeFileSync(logFile, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");

    const stats = getConnectNoticeStatsForAddress(wallet, dayStart + 6 * 3_600_000);
    assert.equal(stats.lastVisit?.nimEarnedLabel, "2 NIM");
    assert.ok((stats.lastVisit?.activeMs ?? 0) >= 120_000);
    assert.equal(stats.today.nimEarnedLabel, "2 NIM");
    assert.ok(stats.today.activeMs >= 120_000);
  } finally {
    if (prev === undefined) delete process.env.EVENT_LOG_DIR;
    else process.env.EVENT_LOG_DIR = prev;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
