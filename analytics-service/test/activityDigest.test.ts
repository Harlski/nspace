import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { getActivityDigest } from "../src/activityDigest.js";

const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;

test("getActivityDigest ranks active play and counts gameplay NIM once per claim", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "activity-digest-"));
  const prev = process.env.EVENT_LOG_DIR;
  process.env.EVENT_LOG_DIR = dir;
  try {
    const windowEnd = Date.UTC(2026, 10, 21, 10, 0, 0);
    const windowStart = windowEnd - 24 * HOUR;
    const alice = "nqaliceaaaaaaaaaaaaaaaaaaaaaaaa";
    const bob = "NQBOBAAAAAAAAAAAAAAAAAAAAAAAAA";
    const guest = "guest:abcd";
    const aliceStart = windowStart + HOUR;
    const lines = [
      {
        ts: windowStart - 2 * HOUR,
        kind: "session_start",
        sessionId: "s0",
        address: alice,
        roomId: "hub",
      },
      {
        ts: aliceStart,
        kind: "session_start",
        sessionId: "s1",
        address: alice,
        roomId: "hub",
        payload: { nimiqPay: true },
      },
      {
        ts: aliceStart + 2 * MIN,
        kind: "chat",
        sessionId: "s1",
        address: alice,
        roomId: "hub",
      },
      {
        ts: aliceStart + 4 * MIN,
        kind: "gameplay_nim_earned",
        sessionId: "s1",
        address: alice,
        roomId: "hub",
        payload: { claimId: "c1", amountLuna: "100000", source: "mine" },
      },
      {
        ts: aliceStart + 4 * MIN,
        kind: "claim_block",
        sessionId: "s1",
        address: alice,
        roomId: "hub",
        payload: { claimId: "c1", amountLuna: "100000" },
      },
      {
        ts: aliceStart + 10 * MIN,
        kind: "place_block",
        sessionId: "s1",
        address: alice,
        roomId: "hub",
      },
      {
        ts: aliceStart + 20 * MIN,
        kind: "session_end",
        sessionId: "s1",
        address: alice,
        roomId: "hub",
      },
      {
        ts: windowEnd - 30 * MIN,
        kind: "session_start",
        sessionId: "s2",
        address: bob,
        roomId: "commons",
      },
      {
        ts: windowEnd - 28 * MIN,
        kind: "move_to",
        sessionId: "s2",
        address: bob,
        roomId: "commons",
      },
      {
        ts: windowEnd - 27 * MIN,
        kind: "gameplay_nim_earned",
        sessionId: "s2",
        address: bob,
        roomId: "commons",
        payload: { claimId: "g1", amountLuna: "50000", source: "goal" },
      },
      {
        ts: windowStart + 3 * HOUR,
        kind: "session_start",
        sessionId: "s3",
        address: guest,
        roomId: "field",
      },
      {
        ts: windowStart + 3 * HOUR + 3 * MIN,
        kind: "session_end",
        sessionId: "s3",
        address: guest,
        roomId: "field",
      },
    ];
    fs.writeFileSync(
      path.join(dir, "events-2026-11-21.jsonl"),
      lines.map((line) => JSON.stringify(line)).join("\n") + "\n"
    );

    const digest = await getActivityDigest(windowStart, windowEnd, 3);
    assert.equal(digest.uniquePlayers, 3);
    assert.equal(digest.newPlayers, 2);
    assert.equal(digest.guestPlayers, 1);
    assert.equal(digest.nimiqPayPlayers, 1);
    assert.equal(digest.sessionStarts, 3);
    assert.equal(digest.sessionStartsLastHour, 1);
    assert.equal(digest.chatLines, 1);
    assert.equal(digest.blocksClaimed, 1);
    assert.equal(digest.blocksPlaced, 1);
    assert.equal(digest.nimEarnedLuna, "150000");
    assert.equal(digest.players[0]?.address, alice.toUpperCase());
    assert.equal(digest.players[0]?.activeMs, 14 * MIN);
    assert.equal(digest.players[0]?.nimEarnedLuna, "100000");
    assert.equal(digest.players[0]?.isNew, false);
    assert.equal(digest.players[0]?.nimiqPay, true);
    assert.equal(digest.players[1]?.address, bob);
    assert.equal(digest.players[1]?.activeMs, 8 * MIN);
    assert.equal(digest.players[1]?.nimEarnedLuna, "50000");
    assert.equal(digest.players[1]?.isNew, true);
    assert.equal(digest.players[2]?.address, guest);
    assert.equal(digest.players[2]?.activeMs, 3 * MIN);
    assert.equal(digest.players[2]?.isGuest, true);
    assert.deepEqual(digest.joinedLastHourAddresses, [bob]);
    assert.equal(digest.topRooms[0]?.roomId, "hub");
    assert.equal(digest.topRooms[0]?.activeMs, 14 * MIN);
    assert.equal(digest.topRooms[1]?.roomId, "commons");
    assert.equal(digest.activePlayMsTotal, (14 + 8 + 3) * MIN);
  } finally {
    if (prev === undefined) delete process.env.EVENT_LOG_DIR;
    else process.env.EVENT_LOG_DIR = prev;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
