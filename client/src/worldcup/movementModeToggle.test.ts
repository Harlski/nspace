import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  loadPitchMovementMode,
  savePitchMovementMode,
} from "./movementModeToggle.js";

describe("movementModeToggle persistence", () => {
  const key = "nspace.worldcup.pitchMoveMode";
  let prior: string | null = null;

  beforeEach(() => {
    prior = localStorage.getItem(key);
    localStorage.removeItem(key);
  });

  afterEach(() => {
    if (prior === null) localStorage.removeItem(key);
    else localStorage.setItem(key, prior);
  });

  it("defaults to tap when unset", () => {
    expect(loadPitchMovementMode()).toBe("tap");
  });

  it("round-trips joystick mode", () => {
    savePitchMovementMode("joystick");
    expect(loadPitchMovementMode()).toBe("joystick");
  });

  it("ignores invalid stored values", () => {
    localStorage.setItem(key, "hybrid");
    expect(loadPitchMovementMode()).toBe("tap");
  });
});
