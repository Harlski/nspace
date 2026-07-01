import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOverlayBackStack, isNspaceOverlayState } from "./overlayBackStack.js";

describe("createOverlayBackStack", () => {
  let historyStates: unknown[];
  let historyIndex: number;

  beforeEach(() => {
    historyStates = [{ seed: true }];
    historyIndex = 0;
    vi.stubGlobal("history", {
      pushState: (state: unknown) => {
        historyStates.splice(historyIndex + 1);
        historyStates.push(state);
        historyIndex = historyStates.length - 1;
      },
      back: () => {
        if (historyIndex > 0) historyIndex -= 1;
        window.dispatchEvent(new PopStateEvent("popstate", { state: historyStates[historyIndex] }));
      },
      get state() {
        return historyStates[historyIndex];
      },
    });
    vi.stubGlobal("location", { href: "https://nimiq.space/" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls onPop when the user presses back on an open overlay", () => {
    const onPop = vi.fn();
    const stack = createOverlayBackStack();
    const uninstall = stack.install();
    stack.push("profile", onPop);

    history.back();

    expect(onPop).toHaveBeenCalledOnce();
    expect(stack.isOpen("profile")).toBe(false);
    uninstall();
  });

  it("re-pushes history when onPop returns true (inner layer handled)", () => {
    const onPop = vi.fn(() => true);
    const stack = createOverlayBackStack();
    const uninstall = stack.install();
    stack.push("profile", onPop);
    const depthBefore = historyStates.length;

    history.back();

    expect(onPop).toHaveBeenCalledOnce();
    expect(stack.isOpen("profile")).toBe(true);
    expect(historyStates.length).toBe(depthBefore + 1);
    expect(isNspaceOverlayState(history.state, "profile")).toBe(true);
    uninstall();
  });

  it("dismiss syncs history without running onPop", () => {
    const onPop = vi.fn();
    const stack = createOverlayBackStack();
    const uninstall = stack.install();
    stack.push("profile", onPop);

    stack.dismiss("profile");

    expect(onPop).not.toHaveBeenCalled();
    expect(stack.isOpen("profile")).toBe(false);
    uninstall();
  });

  it("re-traps history on empty back when onEmptyBack is not provided", async () => {
    const stack = createOverlayBackStack();
    const uninstall = stack.install();
    const depthBefore = historyStates.length;

    history.back();
    await Promise.resolve();

    expect(historyStates.length).toBe(depthBefore + 1);
    expect(isNspaceOverlayState(history.state)).toBe(false);
    expect((history.state as { nspace?: { trap?: boolean } }).nspace?.trap).toBe(true);
    uninstall();
  });

  it("allows exit on empty back when onEmptyBack returns true", async () => {
    const onEmptyBack = vi.fn(() => true);
    const stack = createOverlayBackStack({ onEmptyBack });
    const uninstall = stack.install();
    const depthBefore = historyStates.length;

    history.back();
    await Promise.resolve();

    expect(onEmptyBack).toHaveBeenCalledOnce();
    expect(historyStates.length).toBe(depthBefore);
    uninstall();
  });

  it("does not push duplicate overlay ids", () => {
    const stack = createOverlayBackStack();
    const uninstall = stack.install();
    stack.push("profile", () => {});
    const depthAfterFirst = historyStates.length;
    stack.push("profile", () => {});

    expect(historyStates.length).toBe(depthAfterFirst);
    uninstall();
  });
});

describe("isNspaceOverlayState", () => {
  it("matches overlay ids", () => {
    expect(isNspaceOverlayState({ nspace: { overlay: "profile" } }, "profile")).toBe(true);
    expect(isNspaceOverlayState({ nspace: { overlay: "profile" } }, "shop")).toBe(false);
    expect(isNspaceOverlayState({ nspace: { trap: true } })).toBe(false);
  });
});
