import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildConnectNoticeMessage,
  consumePendingConnectNotice,
  CONNECT_NOTICE_DEDUPE_MS,
  isConnectNoticeDedupeActive,
  markGuestConnectNoticePending,
  markWalletConnectNoticePending,
  recordConnectNoticeSent,
  resetConnectNoticeStateForTests,
} from "../src/connectNotice.js";
import { getConnectNoticeStatsForAddress } from "../src/eventLog.js";

test("connect notice pending is consumed once on WS connect", () => {
  resetConnectNoticeStateForTests();
  markWalletConnectNoticePending("NQABAAAAAAAAAAAAAAAAAAAAAAAAAA01", { nimiqPay: true });
  const pending = consumePendingConnectNotice("NQABAAAAAAAAAAAAAAAAAAAAAAAAAA01");
  assert.equal(pending?.kind, "wallet");
  assert.equal(pending && pending.kind === "wallet" ? pending.nimiqPay : false, true);
  assert.equal(consumePendingConnectNotice("NQABAAAAAAAAAAAAAAAAAAAAAAAAAA01"), null);
});

test("connect notice dedupes within one minute", () => {
  resetConnectNoticeStateForTests();
  const now = Date.now();
  const notice = {
    kind: "wallet" as const,
    address: "NQABAAAAAAAAAAAAAAAAAAAAAAAAAA02",
    nimiqPay: false,
    markedAt: now,
  };
  recordConnectNoticeSent(notice, now);
  assert.equal(isConnectNoticeDedupeActive(notice, now + 30_000), true);
  assert.equal(isConnectNoticeDedupeActive(notice, now + CONNECT_NOTICE_DEDUPE_MS + 1), false);
});

test("buildConnectNoticeMessage includes identity, counts, stats, and moderation link", () => {
  resetConnectNoticeStateForTests();
  const text = buildConnectNoticeMessage({
    pending: {
      kind: "wallet",
      address: "NQABAAAAAAAAAAAAAAAAAAAAAAAAAA03",
      nimiqPay: true,
      markedAt: Date.now(),
    },
    roomId: "hub",
    displayName: "The Creator",
    publicBaseUrl: "https://nimiq.space",
    nowMs: Date.parse("2026-07-01T12:00:00.000Z"),
    stats: {
      lastVisit: { nimEarnedLabel: "1.5 NIM", activeMs: 18 * 60_000 },
      today: { nimEarnedLabel: "3 NIM", activeMs: 42 * 60_000 },
    },
    coPresenceNames: ["Bob"],
  });
  assert.match(text, /^NSpace connect\n/);
  assert.match(text, /Player: The Creator \(NQABAA03\) · Nimiq Pay/);
  assert.match(text, /Room: hub \| Room: \d+ \| Online: \d+/);
  assert.match(text, /Last visit: 1\.5 NIM, 18m active/);
  assert.match(text, /Today: 3 NIM, 42m active/);
  assert.match(text, /Also in room: Bob/);
  assert.match(text, /Moderation: https:\/\/nimiq\.space\/admin\/moderation\?wallet=NQAB/);
});

test("buildConnectNoticeMessage omits redundant wallet when no custom name", () => {
  resetConnectNoticeStateForTests();
  const text = buildConnectNoticeMessage({
    pending: {
      kind: "wallet",
      address: "NQABAAAAAAAAAAAAAAAAAAAAAAAAAA03",
      nimiqPay: false,
      markedAt: Date.now(),
    },
    roomId: "hub",
    publicBaseUrl: "https://nimiq.space",
    nowMs: Date.parse("2026-07-01T12:00:00.000Z"),
    stats: {
      lastVisit: null,
      today: { nimEarnedLabel: "0 NIM", activeMs: 0 },
    },
  });
  assert.match(text, /Player: NQABAA03\n/);
  assert.doesNotMatch(text, /Player: NQABAA03 \(NQABAA03\)/);
});

test("getConnectNoticeStatsForAddress aggregates last visit and today UTC", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nspace-connect-stats-"));
  process.env.EVENT_LOG_DIR = dir;
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

  delete process.env.EVENT_LOG_DIR;
});

test("guest pending refreshes on markGuestConnectNoticePending", () => {
  resetConnectNoticeStateForTests();
  markGuestConnectNoticePending({
    guestAddress: "guest:abc",
    hostWallet: "NQHOSTAAAAAAAAAAAAAAAAAAAAAAAA01",
    inviteSlug: "sluggy",
  });
  const first = consumePendingConnectNotice("guest:abc");
  assert.equal(first?.kind, "guest");
});

test("connect notice dedupe window constant is one minute", () => {
  assert.equal(CONNECT_NOTICE_DEDUPE_MS, 60_000);
});

test("maybeSendConnectNotice fires on every wallet connect", async () => {
  resetConnectNoticeStateForTests();
  const sent: string[] = [];
  const original = globalThis.fetch;
  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  process.env.TELEGRAM_CHAT_ID = "1";
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as { text?: string };
    if (body.text) sent.push(body.text);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  const { maybeSendConnectNotice } = await import("../src/connectNotice.js");
  try {
    await maybeSendConnectNotice(
      {
        address: "NQABAAAAAAAAAAAAAAAAAAAAAAAAAA04",
        roomId: "hub",
        displayName: "Alice",
      },
      "https://nimiq.space"
    );
    assert.equal(sent.length, 1);
    assert.match(sent[0]!, /^NSpace connect\n/);
    assert.match(sent[0]!, /Player: Alice \(NQABAA04\)/);
  } finally {
    globalThis.fetch = original;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    resetConnectNoticeStateForTests();
  }
});

test("maybeSendConnectNotice skips stream observers", async () => {
  resetConnectNoticeStateForTests();
  const sent: string[] = [];
  const original = globalThis.fetch;
  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  process.env.TELEGRAM_CHAT_ID = "1";
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as { text?: string };
    if (body.text) sent.push(body.text);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  const { maybeSendConnectNotice } = await import("../src/connectNotice.js");
  try {
    await maybeSendConnectNotice(
      {
        address: "NQABAAAAAAAAAAAAAAAAAAAAAAAAAA05",
        roomId: "hub",
        streamObserver: true,
      },
      "https://nimiq.space"
    );
    assert.equal(sent.length, 0);
  } finally {
    globalThis.fetch = original;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    resetConnectNoticeStateForTests();
  }
});
