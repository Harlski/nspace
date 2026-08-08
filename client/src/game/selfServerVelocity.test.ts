import { describe, expect, it } from "vitest";
import { shouldAdoptServerVelocityOnSelfSync } from "./selfServerVelocity.js";

describe("shouldAdoptServerVelocityOnSelfSync", () => {
  it("adopts server velocity when establishing self target after room entry", () => {
    // Establishing used to skip the velocity copy; leftover mid-walk vx left the
    // avatar stuck at ±0.22 from the tile center and unable to finish a step.
    expect(
      shouldAdoptServerVelocityOnSelfSync({ hasSelfMoveOrder: false })
    ).toBe(true);
  });

  it("does not adopt while moveOrder playback owns velocity", () => {
    expect(
      shouldAdoptServerVelocityOnSelfSync({ hasSelfMoveOrder: true })
    ).toBe(false);
  });
});
