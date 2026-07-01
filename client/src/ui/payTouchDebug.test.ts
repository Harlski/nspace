import { describe, it, expect, afterEach } from "vitest";
import { isPayTouchDebugEnabled } from "./payTouchDebug.js";

describe("isPayTouchDebugEnabled", () => {
  afterEach(() => {
    try {
      localStorage.removeItem("nspace.payDebug");
    } catch {
      /* ignore */
    }
  });

  it("is true when ?payDebug=1", () => {
    const prev = location.search;
    history.replaceState({}, "", "?payDebug=1");
    expect(isPayTouchDebugEnabled()).toBe(true);
    history.replaceState({}, "", prev || "/");
  });

  it("is true when localStorage nspace.payDebug=1", () => {
    localStorage.setItem("nspace.payDebug", "1");
    expect(isPayTouchDebugEnabled()).toBe(true);
  });

  it("is false by default", () => {
    expect(isPayTouchDebugEnabled()).toBe(false);
  });
});
