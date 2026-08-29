import { describe, expect, it } from "vitest";
import { tagScreenFlash } from "./tagFlash.js";

describe("tagScreenFlash", () => {
  it("flashes red when you become Holder", () => {
    expect(
      tagScreenFlash({
        prevHolder: null,
        nextHolder: "NQ07 B",
        selfAddress: "NQ07 B",
        prevPlaying: false,
        nextPlaying: true,
      })
    ).toBe("obtain");
    expect(
      tagScreenFlash({
        prevHolder: "NQ07 A",
        nextHolder: "NQ07 B",
        selfAddress: "NQ07 B",
        prevPlaying: true,
        nextPlaying: true,
      })
    ).toBe("obtain");
  });

  it("flashes green when you Pass the Mosquito", () => {
    expect(
      tagScreenFlash({
        prevHolder: "NQ07 B",
        nextHolder: "NQ07 A",
        selfAddress: "NQ07 B",
        prevPlaying: true,
        nextPlaying: true,
      })
    ).toBe("pass");
  });

  it("does not flash for bystanders or outside play", () => {
    expect(
      tagScreenFlash({
        prevHolder: "NQ07 A",
        nextHolder: "NQ07 B",
        selfAddress: "NQ07 C",
        prevPlaying: true,
        nextPlaying: true,
      })
    ).toBe(null);
    expect(
      tagScreenFlash({
        prevHolder: "NQ07 B",
        nextHolder: "NQ07 B",
        selfAddress: "NQ07 B",
        prevPlaying: true,
        nextPlaying: false,
      })
    ).toBe(null);
  });
});
