import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildAmbientCastSnapshot,
  eligibleWalletsForAmbientCast,
  utcDayKey,
} from "../src/ambientCast/snapshot.js";

describe("Ambient Cast snapshot", () => {
  const day = "2026-08-21";
  const dayStart = Date.UTC(2026, 7, 21, 12, 0, 0);

  it("includes Hub joins and excludes Play Space joins for the UTC day", () => {
    const wallets = eligibleWalletsForAmbientCast(
      [
        {
          kind: "session_start",
          address: "NQAA HUB0 0000 0000 0000 0000 0000 0000 0000",
          roomId: "hub",
          ts: dayStart,
        },
        {
          kind: "session_start",
          address: "NQBB PLAY 0000 0000 0000 0000 0000 0000 0000",
          roomId: "invite-lobby-AB12CD",
          ts: dayStart,
        },
        {
          kind: "session_start",
          address: "NQCC COMM 0000 0000 0000 0000 0000 0000 0000",
          roomId: "commons",
          ts: dayStart,
        },
      ],
      day
    );
    const keys = wallets.map((w) => w.replace(/\s+/g, "").toUpperCase());
    assert.equal(keys.length, 2);
    assert.ok(keys.some((k) => k.includes("HUB0")));
    assert.ok(keys.some((k) => k.includes("COMM")));
    assert.ok(!keys.some((k) => k.includes("PLAY")));
  });

  it("ignores joins outside the UTC day", () => {
    const wallets = eligibleWalletsForAmbientCast(
      [
        {
          kind: "session_start",
          address: "NQAA AAAA AAAA AAAA AAAA AAAA AAAA AAAA AAAA",
          roomId: "hub",
          ts: Date.UTC(2026, 7, 20, 23, 0, 0),
        },
        {
          kind: "session_start",
          address: "NQBB BBBB BBBB BBBB BBBB BBBB BBBB BBBB BBBB",
          roomId: "hub",
          ts: dayStart,
        },
      ],
      day
    );
    assert.equal(wallets.length, 1);
    assert.match(wallets[0]!, /NQBB/i);
  });

  it("builds a lean faces-only snapshot with no wallet fields", () => {
    const snap = buildAmbientCastSnapshot({
      day,
      refreshedAt: 1,
      records: [
        {
          kind: "session_start",
          address: "NQ37 37NM 361M 3H8A 4P7T R2P9 4JTN RGY7 71NX",
          roomId: "hub",
          ts: dayStart,
        },
      ],
      tokenForWallet: () => "ac1_testdummy",
    });
    assert.equal(snap.day, day);
    assert.equal(snap.refreshedAt, 1);
    assert.deepEqual(snap.faces, [{ token: "ac1_testdummy" }]);
    const json = JSON.stringify(snap);
    assert.ok(!json.includes("NQ37"));
    assert.ok(!json.includes("wallet"));
    assert.ok(!json.includes("displayName"));
    assert.ok(!json.includes("data:image"));
  });

  it("returns an empty faces array for an empty day", () => {
    const snap = buildAmbientCastSnapshot({
      day,
      refreshedAt: 2,
      records: [],
    });
    assert.deepEqual(snap.faces, []);
  });

  it("utcDayKey formats UTC calendar days", () => {
    assert.equal(utcDayKey(Date.UTC(2026, 7, 21, 0, 0, 0)), "2026-08-21");
    assert.equal(utcDayKey(Date.UTC(2026, 7, 21, 23, 59, 59)), "2026-08-21");
  });
});
