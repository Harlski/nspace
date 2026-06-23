import { describe, expect, it } from "vitest";
import {
  INVITE_LOBBY_PREFIX,
  resolveRoomsJoinTarget,
  sanitizeRoomsJoinCodeInput,
} from "./playSpaceLayout.js";

describe("sanitizeRoomsJoinCodeInput", () => {
  it("preserves mixed case for alphanumeric slugs", () => {
    expect(sanitizeRoomsJoinCodeInput("Y1dojIyh")).toBe("Y1dojIyh");
    expect(sanitizeRoomsJoinCodeInput("Ab12Xy9z")).toBe("Ab12Xy9z");
  });

  it("strips spaces and invalid characters without changing letter case", () => {
    expect(sanitizeRoomsJoinCodeInput(" AB12CD ")).toBe("AB12CD");
  });
});

describe("resolveRoomsJoinTarget", () => {
  it("lowercases six-character wallet room codes", () => {
    expect(resolveRoomsJoinTarget("AB12CD")).toBe("ab12cd");
  });

  it("maps Play Space slugs to invite lobby room ids with case preserved", () => {
    expect(resolveRoomsJoinTarget("Y1dojIyh")).toBe(
      `${INVITE_LOBBY_PREFIX}Y1dojIyh`
    );
    expect(resolveRoomsJoinTarget("Ab12Xy9z")).toBe(
      `${INVITE_LOBBY_PREFIX}Ab12Xy9z`
    );
  });

  it("prefers a known eight-character room id over Play Space slug heuristics", () => {
    expect(resolveRoomsJoinTarget("abcdefgh", ["abcdefgh"])).toBe("abcdefgh");
  });

  it("lowercases longer builtin-style room ids", () => {
    expect(resolveRoomsJoinTarget("CHAMBER")).toBe("chamber");
  });
});
