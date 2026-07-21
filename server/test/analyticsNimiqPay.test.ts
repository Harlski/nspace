import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { finalizeNimiqPayAnalytics } from "../src/analyticsNimiqPay.js";

describe("finalizeNimiqPayAnalytics", () => {
  it("splits activity vs acquisition and sums payouts for Pay cohort", () => {
    const payVisitors = new Set(["A", "B", "C"]);
    const payFirstTime = new Set(["A"]);
    const seenBefore = new Set(["B", "C", "Z"]);
    const visitorPayoutLuna = new Map<string, bigint>([
      ["A", 100n],
      ["B", 50n],
      ["D", 999n], // not Pay
    ]);
    const payUniqueByDay = new Map([
      ["2026-07-20", new Set(["A", "B"])],
      ["2026-07-19", new Set(["C"])],
    ]);
    const payFirstByDay = new Map([["2026-07-20", new Set(["A"])]]);

    const out = finalizeNimiqPayAnalytics({
      windowUniqueVisitors: 10,
      payVisitors,
      payFirstTime,
      seenBeforeWindow: seenBefore,
      paySessionStarts: 7,
      payActivePlayMs: 12_000,
      visitorPayoutLuna,
      payUniqueByDay,
      payFirstByDay,
      formatLunaToNim: (luna) => `${luna}.nim`,
    });

    assert.equal(out.uniqueVisitors, 3);
    assert.equal(out.otherUniqueVisitors, 7);
    assert.equal(out.firstTime, 1);
    assert.equal(out.returning, 2);
    assert.equal(out.sessionStarts, 7);
    assert.equal(out.activePlayMs, 12_000);
    assert.equal(out.payoutLunaToPayVisitors, "150");
    assert.equal(out.payoutNimToPayVisitors, "150.nim");
    assert.deepEqual(out.byDay, [
      { dayUtc: "2026-07-20", uniquePay: 2, firstTimePay: 1 },
      { dayUtc: "2026-07-19", uniquePay: 1, firstTimePay: 0 },
    ]);
  });
});
