import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  getAdminChatMessageDetail,
  queryAdminChatMessages,
} from "../src/adminChatLog.js";

function writeEvents(logDir: string, day: string, lines: unknown[]): void {
  fs.mkdirSync(logDir, { recursive: true });
  const file = path.join(logDir, `events-${day}.jsonl`);
  fs.writeFileSync(
    file,
    lines.map((l) => JSON.stringify(l)).join("\n") + "\n",
    "utf8"
  );
}

test("queryAdminChatMessages filters by room and wallet", () => {
  const logDir = fs.mkdtempSync(path.join(os.tmpdir(), "chat-log-"));
  const at = 1_700_000_000_000;
  writeEvents(logDir, "2023-11-14", [
    {
      ts: at,
      kind: "chat",
      sessionId: "s1",
      address: "NQ1111111111111111111111111111111111",
      roomId: "hub",
      payload: {
        text: "hello",
        at,
        displayName: "Alice",
        audienceLive: ["NQ2222222222222222222222222222222222"],
      },
    },
    {
      ts: at + 1000,
      kind: "chat",
      sessionId: "s2",
      address: "NQ3333333333333333333333333333333333",
      roomId: "pixel",
      payload: { text: "other room", at: at + 1000, audienceLive: [] },
    },
  ]);

  const hubOnly = queryAdminChatMessages({
    logDir,
    fromTs: at - 1,
    toTs: at + 10_000,
    roomId: "hub",
  });
  assert.equal(hubOnly.messages.length, 1);
  assert.equal(hubOnly.messages[0]?.roomId, "hub");

  const walletOnly = queryAdminChatMessages({
    logDir,
    fromTs: at - 1,
    toTs: at + 10_000,
    wallet: "NQ1111111111111111111111111111111111",
  });
  assert.equal(walletOnly.messages.length, 1);
  assert.equal(walletOnly.messages[0]?.fromAddress, "NQ1111111111111111111111111111111111");
});

test("getAdminChatMessageDetail splits live and backlog audience", () => {
  const logDir = fs.mkdtempSync(path.join(os.tmpdir(), "chat-log-"));
  const at = 1_700_000_100_000;
  const sender = "NQ1111111111111111111111111111111111";
  const live = "NQ2222222222222222222222222222222222";
  const backlog = "NQ3333333333333333333333333333333333";
  writeEvents(logDir, "2023-11-14", [
    {
      ts: at,
      kind: "chat",
      sessionId: "s1",
      address: sender,
      roomId: "hub",
      payload: {
        text: "hi",
        textOriginal: "bad hi",
        at,
        displayName: "Alice",
        audienceLive: [live],
      },
    },
    {
      ts: at + 5000,
      kind: "chat_backlog_delivered",
      sessionId: "s3",
      address: backlog,
      roomId: "hub",
      payload: {
        lines: [{ at, fromAddress: sender }],
      },
    },
  ]);

  const detail = getAdminChatMessageDetail({
    logDir,
    roomId: "hub",
    fromAddress: sender,
    at,
  });
  assert.ok(detail);
  assert.equal(detail.text, "hi");
  assert.equal(detail.textOriginal, "bad hi");
  assert.deepEqual(detail.audienceLive, [live]);
  assert.deepEqual(detail.audienceBacklog, [backlog]);
});

test("queryAdminChatMessages returns empty for out-of-range window", () => {
  const logDir = fs.mkdtempSync(path.join(os.tmpdir(), "chat-log-"));
  const at = 1_700_000_000_000;
  writeEvents(logDir, "2023-11-14", [
    {
      ts: at,
      kind: "chat",
      sessionId: "s1",
      address: "NQ1111111111111111111111111111111111",
      roomId: "hub",
      payload: { text: "hello", at, audienceLive: [] },
    },
  ]);

  const out = queryAdminChatMessages({
    logDir,
    fromTs: at + 100_000,
    toTs: at + 200_000,
  });
  assert.equal(out.messages.length, 0);
});
