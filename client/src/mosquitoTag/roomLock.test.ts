import { describe, it, expect } from "vitest";
import {
  participantRoomLocked,
  payTagTelescopeZoomActive,
} from "./roomLock.js";

describe("participantRoomLocked", () => {
  it("is off during a waiting Tag Call", () => {
    expect(
      participantRoomLocked(
        { phase: "calling", participants: [] },
        "a"
      )
    ).toBe(false);
  });

  it("holds Participants from Tag Countdown through the Tag Round", () => {
    expect(
      participantRoomLocked(
        { phase: "countdown", participants: ["a", "b"] },
        "a"
      )
    ).toBe(true);
    expect(
      participantRoomLocked(
        { phase: "playing", participants: ["a", "b"] },
        "B"
      )
    ).toBe(true);
    expect(
      participantRoomLocked(
        { phase: "playing", participants: ["a", "b"] },
        "c"
      )
    ).toBe(false);
  });

  it("lifts on the result linger", () => {
    expect(
      participantRoomLocked(
        { phase: "result", participants: ["a", "b"] },
        "a"
      )
    ).toBe(false);
  });
});

describe("payTagTelescopeZoomActive", () => {
  const playing = { phase: "playing" as const, participants: ["a", "b"] };

  it("is on for Nimiq Pay Participants during Tag Countdown and Tag Round", () => {
    expect(
      payTagTelescopeZoomActive(
        { phase: "countdown", participants: ["a"] },
        "a",
        true
      )
    ).toBe(true);
    expect(payTagTelescopeZoomActive(playing, "a", true)).toBe(true);
  });

  it("stays off for Hub Participants, Pay Bystanders, and Pay after the round", () => {
    expect(payTagTelescopeZoomActive(playing, "a", false)).toBe(false);
    expect(payTagTelescopeZoomActive(playing, "c", true)).toBe(false);
    expect(
      payTagTelescopeZoomActive(
        { phase: "calling", participants: ["a"] },
        "a",
        true
      )
    ).toBe(false);
    expect(
      payTagTelescopeZoomActive(
        { phase: "result", participants: ["a"] },
        "a",
        true
      )
    ).toBe(false);
  });
});
