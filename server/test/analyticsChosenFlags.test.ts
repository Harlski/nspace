import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { aggregateChosenFlags } from "../src/analyticsChosenFlags.js";

describe("aggregateChosenFlags", () => {
  it("counts current Country among visitor wallets and sorts by count then code", () => {
    const countries: Record<string, string | null> = {
      W1: "br",
      W2: "BR",
      W3: "de",
      W4: null,
      W5: "",
      W6: "AT",
      W7: "AT",
      W8: "xx", // invalid length after trim still 2 — accepted as alpha-2 shape
    };
    // "xx" is shape-valid; product store only persists real codes, but aggregator is defensive shape-only.
    const stats = aggregateChosenFlags(Object.keys(countries), (w) => countries[w]);
    assert.equal(stats.uniqueVisitors, 8);
    assert.equal(stats.withFlag, 6);
    assert.equal(stats.withoutFlag, 2);
    assert.deepEqual(stats.byCountry, [
      { code: "AT", count: 2 },
      { code: "BR", count: 2 },
      { code: "DE", count: 1 },
      { code: "XX", count: 1 },
    ]);
  });

  it("returns empty breakdown when no wallets have a Country", () => {
    const stats = aggregateChosenFlags(["A", "B"], () => null);
    assert.equal(stats.uniqueVisitors, 2);
    assert.equal(stats.withFlag, 0);
    assert.equal(stats.withoutFlag, 2);
    assert.deepEqual(stats.byCountry, []);
  });
});
