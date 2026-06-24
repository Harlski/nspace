import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isJoinCode,
  isLegacyPlaySpaceSlug,
  JOIN_CODE_LENGTH,
  normalizeJoinCode,
  walletRoomIdFromJoinCode,
} from "../src/joinCode.js";

describe("joinCode", () => {
  it("recognizes unified six-character codes", () => {
    assert.equal(JOIN_CODE_LENGTH, 6);
    assert.ok(isJoinCode("AB12CD"));
    assert.ok(isJoinCode("ab12cd"));
    assert.ok(!isJoinCode("AB12"));
    assert.ok(!isJoinCode("AB12CDEF"));
  });

  it("normalizes join codes to uppercase", () => {
    assert.equal(normalizeJoinCode(" ab12cd "), "AB12CD");
    assert.equal(walletRoomIdFromJoinCode("AB12CD"), "ab12cd");
  });

  it("still recognizes legacy eight-character Play Space slugs", () => {
    assert.ok(isLegacyPlaySpaceSlug("Y1dojIyh"));
    assert.ok(!isLegacyPlaySpaceSlug("AB12CD"));
  });
});
