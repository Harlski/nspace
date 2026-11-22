import assert from "node:assert/strict";
import test from "node:test";

import type { ActivityDigest } from "../src/analyticsServiceClient.js";
import {
  formatHourlyActivityMessage,
  formatNimCompact,
  formatPlayedDuration,
  hourlyActivityWindowEndMs,
  msUntilNextHourlyActivity,
} from "../src/hourlyActivityReport.js";

const HOUR = 60 * 60 * 1000;

function digest(partial: Partial<ActivityDigest> = {}): ActivityDigest {
  return {
    windowStartMs: Date.UTC(2026, 10, 20, 10, 0, 0),
    windowEndMs: Date.UTC(2026, 10, 21, 10, 0, 0),
    lookbackDays: 400,
    uniquePlayers: 2,
    newPlayers: 1,
    guestPlayers: 0,
    nimiqPayPlayers: 1,
    activePlayMsTotal: 14 * 60 * 1000,
    nimEarnedLuna: "150000",
    sessionStarts: 3,
    sessionStartsLastHour: 1,
    chatLines: 4,
    blocksPlaced: 2,
    blocksClaimed: 1,
    topRooms: [{ roomId: "hub", activeMs: 14 * 60 * 1000, uniquePlayers: 1 }],
    players: [
      {
        address: "NQALICEAAAAAAAAAAAAAAAAAAAAAAAA",
        activeMs: 14 * 60 * 1000,
        sessionStarts: 2,
        nimEarnedLuna: "100000",
        chatCount: 3,
        blocksPlaced: 2,
        blocksClaimed: 1,
        nimiqPay: true,
        isNew: false,
        isGuest: false,
        lastRoomId: "hub",
        joinedLastHour: false,
      },
      {
        address: "NQBOBAAAAAAAAAAAAAAAAAAAAAAAAA",
        activeMs: 8 * 60 * 1000,
        sessionStarts: 1,
        nimEarnedLuna: "50000",
        chatCount: 1,
        blocksPlaced: 0,
        blocksClaimed: 0,
        nimiqPay: false,
        isNew: true,
        isGuest: false,
        lastRoomId: "commons",
        joinedLastHour: true,
      },
    ],
    playerCount: 2,
    joinedLastHourAddresses: ["NQBOBAAAAAAAAAAAAAAAAAAAAAAAAA"],
    ...partial,
  };
}

test("hourly schedule fires one minute after each UTC hour", () => {
  const ten = Date.UTC(2026, 10, 21, 10, 0, 0);
  assert.equal(msUntilNextHourlyActivity(ten), 60 * 1000);
  assert.equal(hourlyActivityWindowEndMs(ten + 60 * 1000), ten);
  assert.equal(msUntilNextHourlyActivity(ten + 30 * 60 * 1000), 31 * 60 * 1000);
  assert.equal(hourlyActivityWindowEndMs(ten + 30 * 1000), ten - HOUR);
});

test("NIM compact format keeps small rewards visible", () => {
  assert.equal(formatNimCompact(0n), "0");
  assert.equal(formatNimCompact(100000n), "1");
  assert.equal(formatNimCompact(150000n), "1.5");
  assert.equal(formatNimCompact(500n), "0.005");
  assert.equal(formatPlayedDuration(14 * 60 * 1000), "14m");
  assert.equal(formatPlayedDuration(6 * 60 * 60 * 1000 + 12 * 60 * 1000), "6h12m");
});

test("hourly message is a 24h leaderboard with online room and join line", () => {
  const text = formatHourlyActivityMessage({
    digest: digest(),
    online: [
      {
        address: "NQALICEAAAAAAAAAAAAAAAAAAAAAAAA",
        displayName: "The Creator",
        roomId: "hub",
        nimiqPay: true,
      },
    ],
    pendingLuna: 310000n,
    pendingRecipients: 2,
    topN: 12,
  });
  assert.match(text, /Nimiq Space hourly activity/);
  assert.match(text, /2026-11-20 10:00 -> 2026-11-21 10:00 UTC/);
  assert.match(text, /Online now: 1/);
  assert.match(text, /Players: 2 \(1 new, 0 guests, 1 Nimiq Pay\)/);
  assert.match(text, /NIM earned: 1\.5/);
  assert.match(text, /Pending payout: 3\.1 NIM across 2 players/);
  assert.match(text, /The Creator/);
  assert.doesNotMatch(text, /The Creator\+/);
  assert.match(text, /New\s+Pay/);
  assert.match(text, /hub/);
  assert.match(text, /Joined this hour:/);
  assert.match(text, /Rooms: hub 14m/);
  assert.doesNotMatch(text, /NQALICE/);
});
