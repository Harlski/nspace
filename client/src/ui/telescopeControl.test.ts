import { describe, it, expect } from "vitest";
import { createTelescopeControl } from "./telescopeControl.js";

describe("telescopeControl", () => {
  it("stays hidden until unlocked for full players", () => {
    const host = document.createElement("div");
    const control = createTelescopeControl(host);
    expect(control.root.hidden).toBe(true);

    control.setUnlocked(true);
    expect(control.root.hidden).toBe(false);

    control.setGuestMode(true);
    expect(control.root.hidden).toBe(true);
  });
});
