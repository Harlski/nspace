import { describe, expect, it } from "vitest";
import {
  INVITE_LOBBY_PREFIX,
  joinCodeMatchesRoom,
  resolveRoomsJoinTarget,
  sanitizeRoomsJoinCodeInput,
} from "./playSpaceLayout.js";

describe("sanitizeRoomsJoinCodeInput", () => {
  it("uppercases unified six-character join codes", () => {
    expect(sanitizeRoomsJoinCodeInput("ab12cd")).toBe("AB12CD");
    expect(sanitizeRoomsJoinCodeInput(" AB12CD ")).toBe("AB12CD");
  });

  it("uppercases partial six-character codes while typing", () => {
    expect(sanitizeRoomsJoinCodeInput("xpa")).toBe("XPA");
    expect(sanitizeRoomsJoinCodeInput("xpa6ac")).toBe("XPA6AC");
  });

  it("preserves mixed case for legacy eight-character Play Space slugs", () => {
    expect(sanitizeRoomsJoinCodeInput("Y1dojIyh")).toBe("Y1dojIyh");
  });
});

describe("resolveRoomsJoinTarget", () => {
  it("returns uppercase six-character codes for server-side resolution", () => {
    expect(resolveRoomsJoinTarget("ab12cd")).toBe("AB12CD");
  });

  it("maps legacy Play Space slugs to invite lobby room ids with case preserved", () => {
    expect(resolveRoomsJoinTarget("Y1dojIyh")).toBe(
      `${INVITE_LOBBY_PREFIX}Y1dojIyh`
    );
  });

  it("prefers a known eight-character room id over legacy slug heuristics", () => {
    expect(resolveRoomsJoinTarget("abcdefgh", ["abcdefgh"])).toBe("abcdefgh");
  });

  it("lowercases longer builtin-style room ids", () => {
    expect(resolveRoomsJoinTarget("CHAMBER")).toBe("chamber");
  });
});

describe("joinCodeMatchesRoom", () => {
  it("matches wallet room ids case-insensitively", () => {
    expect(joinCodeMatchesRoom("AB12CD", "ab12cd")).toBe(true);
  });

  it("matches Play Space lobby ids from a join code", () => {
    expect(joinCodeMatchesRoom("AB12CD", `${INVITE_LOBBY_PREFIX}AB12CD`)).toBe(
      true
    );
  });
});
