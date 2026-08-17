import { describe, expect, it } from "vitest";

import { formatClickIntervalSec } from "./movementWatchView";

describe("formatClickIntervalSec", () => {
  it("writes hundredths of a second with no unit", () => {
    expect(formatClickIntervalSec(2.43)).toBe("2.43");
  });

  it("pads whole seconds to two decimals", () => {
    expect(formatClickIntervalSec(8)).toBe("8.00");
  });
});
