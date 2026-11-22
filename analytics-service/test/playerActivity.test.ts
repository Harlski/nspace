import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createAnalyticsApp } from "../src/app.js";
import { getPlayerActivity } from "../src/playerActivity.js";

const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;
const ALICE = "nqaliceaaaaaaaaaaaaaaaaaaaaaaaa";

let envChain: Promise<void> = Promise.resolve();

function withEnvLock<T>(run: () => Promise<T>): Promise<T> {
  const next = envChain.then(run, run);
  envChain = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

async function withLog(
  lines: unknown[],
  run: () => Promise<void>
): Promise<void> {
  return withEnvLock(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "player-activity-"));
  const prev = process.env.EVENT_LOG_DIR;
  process.env.EVENT_LOG_DIR = dir;
  try {
    fs.writeFileSync(
      path.join(dir, "events-2026-11-22.jsonl"),
      lines.map((line) => JSON.stringify(line)).join("\n") + "\n"
    );
    await run();
  } finally {
    if (prev === undefined) delete process.env.EVENT_LOG_DIR;
    else process.env.EVENT_LOG_DIR = prev;
    fs.rmSync(dir, { recursive: true, force: true });
  }
  });
}

test("long visit shows connected time with an idle gap after the last action", async () => {
  const windowEnd = Date.UTC(2026, 10, 22, 12, 0, 0);
  const windowStart = windowEnd - 24 * HOUR;
  const start = windowStart + 2 * HOUR;
  await withLog(
    [
      { ts: start, kind: "session_start", sessionId: "s1", address: ALICE, roomId: "hub" },
      { ts: start + 10 * MIN, kind: "chat", sessionId: "s1", address: ALICE, roomId: "hub" },
      { ts: start + 20 * MIN, kind: "move_to", sessionId: "s1", address: ALICE, roomId: "hub" },
      {
        ts: start + 30 * MIN,
        kind: "gameplay_nim_earned",
        sessionId: "s1",
        address: ALICE,
        roomId: "hub",
        payload: { claimId: "c1", amountLuna: "150000" },
      },
      {
        ts: start + 30 * MIN,
        kind: "claim_block",
        sessionId: "s1",
        address: ALICE,
        roomId: "hub",
        payload: { claimId: "c1", amountLuna: "150000" },
      },
      {
        ts: start + 30 * MIN,
        kind: "nim_payout_sent",
        sessionId: "s1",
        address: ALICE,
        roomId: "hub",
        payload: { amountLuna: "999999" },
      },
      { ts: start + 2 * HOUR, kind: "session_end", sessionId: "s1", address: ALICE, roomId: "hub" },
    ],
    async () => {
      const activity = await getPlayerActivity(ALICE, windowStart, windowEnd, false);
      assert.equal(activity.address, ALICE.toUpperCase());
      assert.equal(activity.sessionCount, 1);
      assert.equal(activity.connectedMs, 2 * HOUR);
      // Each 10-minute gap counts 5 minutes, then sign-out adds one more capped slice.
      assert.equal(activity.activeMs, 20 * MIN);
      assert.equal(activity.nimEarnedLuna, "150000");
      assert.equal(activity.connected.length, 1);
      assert.equal(activity.active.length, 4);
      const lastActive = activity.active[activity.active.length - 1];
      assert.equal(lastActive?.endMs, start + 35 * MIN);
      assert.equal(activity.earns.length, 1);
      assert.equal(activity.sessions[0]?.closedWithoutSignOut, false);
      assert.equal(activity.sessions[0]?.nimEarnedLuna, "150000");
      const idle = activity.connected[0]!.endMs - lastActive!.endMs;
      assert.equal(idle, 2 * HOUR - 35 * MIN);
    }
  );
});

test("several short visits leave signed-out gaps between connected spans", async () => {
  const windowEnd = Date.UTC(2026, 10, 22, 18, 0, 0);
  const windowStart = windowEnd - 24 * HOUR;
  const first = windowStart + HOUR;
  await withLog(
    [
      { ts: first, kind: "session_start", sessionId: "a", address: ALICE, roomId: "hub" },
      { ts: first + 8 * MIN, kind: "session_end", sessionId: "a", address: ALICE, roomId: "hub" },
      { ts: first + 40 * MIN, kind: "session_start", sessionId: "b", address: ALICE, roomId: "commons" },
      { ts: first + 48 * MIN, kind: "session_end", sessionId: "b", address: ALICE, roomId: "commons" },
      { ts: first + 3 * HOUR, kind: "session_start", sessionId: "c", address: ALICE, roomId: "hub" },
      { ts: first + 3 * HOUR + 4 * MIN, kind: "session_end", sessionId: "c", address: ALICE, roomId: "hub" },
    ],
    async () => {
      const activity = await getPlayerActivity(ALICE, windowStart, windowEnd, false);
      assert.equal(activity.sessionCount, 3);
      assert.equal(activity.connected.length, 3);
      assert.equal(activity.connectedMs, (8 + 8 + 4) * MIN);
      assert.equal(activity.longestConnectedMs, 8 * MIN);
      const gap = activity.connected[1]!.startMs - activity.connected[0]!.endMs;
      assert.equal(gap, 32 * MIN);
      assert.equal(activity.sessions[0]?.roomId, "hub");
      assert.equal(activity.sessions[1]?.roomId, "commons");
    }
  );
});

test("overlapping sessions count once in the headline totals", async () => {
  const windowEnd = Date.UTC(2026, 10, 22, 12, 0, 0);
  const windowStart = windowEnd - 24 * HOUR;
  const start = windowStart + HOUR;
  await withLog(
    [
      { ts: start, kind: "session_start", sessionId: "tab1", address: ALICE, roomId: "hub" },
      { ts: start + 30 * MIN, kind: "session_end", sessionId: "tab1", address: ALICE, roomId: "hub" },
      { ts: start + 10 * MIN, kind: "session_start", sessionId: "tab2", address: ALICE, roomId: "hub" },
      { ts: start + 20 * MIN, kind: "session_end", sessionId: "tab2", address: ALICE, roomId: "hub" },
    ],
    async () => {
      const activity = await getPlayerActivity(ALICE, windowStart, windowEnd, false);
      assert.equal(activity.sessionCount, 2);
      assert.equal(activity.connectedMs, 30 * MIN);
      assert.equal(activity.connected.length, 1);
      assert.equal(activity.sessions[0]!.connectedMs + activity.sessions[1]!.connectedMs, 40 * MIN);
    }
  );
});

test("an open session extends to now only when the wallet is still connected", async () => {
  const windowEnd = Date.UTC(2026, 10, 22, 15, 0, 0);
  const windowStart = windowEnd - 24 * HOUR;
  const start = windowEnd - 2 * HOUR;
  const lines = [
    { ts: start, kind: "session_start", sessionId: "live", address: ALICE, roomId: "hub" },
    { ts: start + 4 * MIN, kind: "chat", sessionId: "live", address: ALICE, roomId: "hub" },
    {
      ts: start - 5 * HOUR,
      kind: "session_start",
      sessionId: "zombie",
      address: ALICE,
      roomId: "old",
    },
  ];
  await withLog(lines, async () => {
    const online = await getPlayerActivity(ALICE, windowStart, windowEnd, true);
    const live = online.sessions.find((s) => s.sessionId === "live");
    const zombie = online.sessions.find((s) => s.sessionId === "zombie");
    assert.equal(live?.connectedMs, 2 * HOUR);
    assert.equal(live?.open, true);
    assert.equal(live?.closedWithoutSignOut, false);
    assert.equal(zombie?.closedWithoutSignOut, true);
    assert.equal(zombie?.connectedMs, 5 * MIN);
    assert.equal(online.connectedMs, 2 * HOUR + 5 * MIN);
    const liveActive = online.active.find((span) => span.startMs >= start);
    assert.ok(liveActive);
    assert.equal(liveActive.endMs - liveActive.startMs, 9 * MIN);

    const offline = await getPlayerActivity(ALICE, windowStart, windowEnd, false);
    const offlineLive = offline.sessions.find((s) => s.sessionId === "live");
    assert.equal(offlineLive?.closedWithoutSignOut, true);
    assert.equal(offlineLive?.connectedMs, 4 * MIN + 5 * MIN);
  });
});

test("a visit that began before the window is clipped to the window", async () => {
  const windowEnd = Date.UTC(2026, 10, 22, 12, 0, 0);
  const windowStart = windowEnd - 24 * HOUR;
  await withLog(
    [
      {
        ts: windowStart - 30 * MIN,
        kind: "session_start",
        sessionId: "early",
        address: ALICE,
        roomId: "hub",
      },
      {
        ts: windowStart + 10 * MIN,
        kind: "session_end",
        sessionId: "early",
        address: ALICE,
        roomId: "hub",
      },
      {
        ts: windowStart - HOUR,
        kind: "session_start",
        sessionId: "gone",
        address: ALICE,
        roomId: "hub",
      },
      {
        ts: windowStart - 10 * MIN,
        kind: "session_end",
        sessionId: "gone",
        address: ALICE,
        roomId: "hub",
      },
    ],
    async () => {
      const activity = await getPlayerActivity(ALICE, windowStart, windowEnd, false);
      assert.equal(activity.sessionCount, 1);
      assert.equal(activity.connectedMs, 10 * MIN);
      assert.equal(activity.connected[0]?.startMs, windowStart);
    }
  );
});

test("other wallets are ignored", async () => {
  const windowEnd = Date.UTC(2026, 10, 22, 12, 0, 0);
  const windowStart = windowEnd - 24 * HOUR;
  await withLog(
    [
      {
        ts: windowStart + HOUR,
        kind: "session_start",
        sessionId: "bob",
        address: "NQBOBAAAAAAAAAAAAAAAAAAAAAAAAA",
        roomId: "hub",
      },
      {
        ts: windowStart + 2 * HOUR,
        kind: "session_end",
        sessionId: "bob",
        address: "NQBOBAAAAAAAAAAAAAAAAAAAAAAAAA",
        roomId: "hub",
      },
    ],
    async () => {
      const activity = await getPlayerActivity(ALICE, windowStart, windowEnd, false);
      assert.equal(activity.sessionCount, 0);
      assert.equal(activity.connectedMs, 0);
      assert.equal(activity.nimEarnedLuna, "0");
    }
  );
});

test("GET /v1/player-activity rejects a window wider than 8 days", async () => {
  await withEnvLock(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "player-activity-route-"));
  const prev = process.env.EVENT_LOG_DIR;
  const { app } = createAnalyticsApp({
    cfg: {
      host: "127.0.0.1",
      port: 0,
      apiSecret: "test-secret",
      eventLogDir: dir,
    },
  });
  const server = await new Promise<import("node:http").Server>((resolve, reject) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
    s.on("error", reject);
  });
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no port");
    const end = Date.UTC(2026, 10, 22, 12, 0, 0);
    const url = `http://127.0.0.1:${address.port}/v1/player-activity?address=${ALICE}&fromMs=${end - 9 * 24 * HOUR}&toMs=${end}`;
    const res = await fetch(url, { headers: { authorization: "Bearer test-secret" } });
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error?: string };
    assert.equal(body.error, "window must be within 8 days");
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    fs.rmSync(dir, { recursive: true, force: true });
    if (prev === undefined) delete process.env.EVENT_LOG_DIR;
    else process.env.EVENT_LOG_DIR = prev;
  }
  });
});
