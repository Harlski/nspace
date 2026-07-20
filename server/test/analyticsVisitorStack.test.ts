import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildUniqueVisitorBarSegments,
  visitorStackFillTotal,
} from "../src/analyticsVisitorStack.js";

describe("buildUniqueVisitorBarSegments", () => {
  it("fills bar to uniqueTotal when listed wallets are capped below unique count", () => {
    // Repro: day with 47 unique players but only 22 wallets in capped startUsers∪endUsers.
    const listed = Array.from({ length: 22 }, (_, i) => ({
      walletId: `w${i}`,
      stackW: 1,
      ev: 1,
      inCount: 1,
      outCount: 0,
    }));
    const uniqueTotal = 47;
    const segs = buildUniqueVisitorBarSegments(uniqueTotal, listed, 10);
    const fill = visitorStackFillTotal(segs);

    assert.equal(
      fill,
      uniqueTotal,
      `bar fill must match hover unique count; got ${fill} (looks capped near listed=${listed.length})`
    );
  });

  it("collapses overflow named wallets into other without dropping uniqueTotal", () => {
    const listed = Array.from({ length: 15 }, (_, i) => ({
      walletId: `w${i}`,
      stackW: 1,
      ev: 2,
    }));
    const segs = buildUniqueVisitorBarSegments(15, listed, 10);
    assert.equal(visitorStackFillTotal(segs), 15);
    const other = segs.find((s) => s.isOther);
    assert.ok(other);
    assert.equal(other!.stackW, 5);
    assert.equal(segs.filter((s) => !s.isOther).length, 10);
  });
});
