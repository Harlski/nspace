import { describe, expect, it } from "vitest";
import {
  applyDirectoryRankingClock,
  directoryRankingSecondsRemaining,
  formatDirectoryRankingHint,
  type DirectoryRankingClock,
} from "./directoryRankingHint.js";

function clock(partial: Partial<DirectoryRankingClock> = {}): DirectoryRankingClock {
  return {
    nextAtMs: 10_000,
    serverNowMs: 5_000,
    intervalMs: 5_000,
    receivedAtMs: 5_000,
    ...partial,
  };
}

describe("directoryRankingSecondsRemaining", () => {
  it("counts a full interval down from the server clock", () => {
    expect(directoryRankingSecondsRemaining(clock(), 5_000)).toBe(5);
    expect(directoryRankingSecondsRemaining(clock(), 6_600)).toBe(4);
    expect(directoryRankingSecondsRemaining(clock(), 9_100)).toBe(1);
  });

  it("wraps to the next interval after the deadline", () => {
    expect(directoryRankingSecondsRemaining(clock(), 10_000)).toBe(5);
    expect(directoryRankingSecondsRemaining(clock(), 10_100)).toBe(5);
    expect(directoryRankingSecondsRemaining(clock(), 14_200)).toBe(1);
  });

  it("uses the client receipt time so a skewed wall clock still matches the server", () => {
    const skewed = clock({ receivedAtMs: 50_000 });
    expect(directoryRankingSecondsRemaining(skewed, 51_600)).toBe(4);
  });
});

describe("formatDirectoryRankingHint", () => {
  it("renders a mm:ss countdown", () => {
    expect(formatDirectoryRankingHint(4)).toBe("Room rankings update in 0:04");
    expect(formatDirectoryRankingHint(65)).toBe("Room rankings update in 1:05");
    expect(formatDirectoryRankingHint(3661)).toBe("Room rankings update in 1:01:01");
  });
});

describe("applyDirectoryRankingClock", () => {
  it("replaces the clock and keeps a trailing build hint", () => {
    expect(
      applyDirectoryRankingClock(
        "Room rankings update in 0:05 · B: blocks",
        "Room rankings update in 0:04"
      )
    ).toBe("Room rankings update in 0:04 · B: blocks");
  });

  it("leaves other hint-strip copy alone", () => {
    expect(
      applyDirectoryRankingClock(
        "Build mode - click a block to edit",
        "Room rankings update in 0:04"
      )
    ).toBeNull();
  });

  it("skips a write when the clock text is unchanged", () => {
    expect(
      applyDirectoryRankingClock(
        "Room rankings update in 0:04",
        "Room rankings update in 0:04"
      )
    ).toBeNull();
  });
});
