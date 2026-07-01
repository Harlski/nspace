import { describe, it, expect, vi, afterEach } from "vitest";
import { createPlayerMenu, playerMenuItemLabelsForMode } from "./playerMenu.js";

describe("playerMenuItemLabelsForMode", () => {
  it("lists full-player navigation items (Shop replaces Profile)", () => {
    expect(playerMenuItemLabelsForMode(false)).toEqual([
      "Wardrobe",
      "Shop",
      "Achievements",
      "Rooms",
      "Return to Hub",
      "Logout",
    ]);
  });

  it("lists guest navigation items (no Shop, keeps Profile)", () => {
    expect(playerMenuItemLabelsForMode(true)).toEqual([
      "Profile",
      "Get a Wallet",
      "Return to Hub",
      "Leave",
    ]);
  });

  it("hides Return to Hub while already in the Hub", () => {
    expect(playerMenuItemLabelsForMode(false, false)).toEqual([
      "Wardrobe",
      "Shop",
      "Achievements",
      "Rooms",
      "Logout",
    ]);
  });

  it("surfaces Leave the Shaper at the top while inside The Shaper", () => {
    expect(playerMenuItemLabelsForMode(false, true, true)).toEqual([
      "Leave the Shaper",
      "Wardrobe",
      "Shop",
      "Achievements",
      "Rooms",
      "Return to Hub",
      "Logout",
    ]);
  });

  it("does not surface Leave the Shaper for guests", () => {
    expect(playerMenuItemLabelsForMode(true, true, true)).toEqual([
      "Profile",
      "Get a Wallet",
      "Return to Hub",
      "Leave",
    ]);
  });
});

describe("createPlayerMenu long press", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function mountMenu() {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const menu = createPlayerMenu(host);
    let longPressCount = 0;
    menu.onLongPress(() => {
      longPressCount += 1;
    });
    return {
      menu,
      host,
      getLongPressCount: () => longPressCount,
      cleanup: () => host.remove(),
    };
  }

  function longPress(el: HTMLElement, pointerId = 1): void {
    el.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        pointerId,
        pointerType: "touch",
        clientX: 10,
        clientY: 10,
      })
    );
    vi.advanceTimersByTime(500);
  }

  function release(el: HTMLElement, pointerId = 1): void {
    el.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        button: 0,
        pointerId,
        pointerType: "touch",
        clientX: 10,
        clientY: 10,
      })
    );
  }

  it("opens the Action Wheel twice after closing it once", () => {
    vi.useFakeTimers();
    const ctx = mountMenu();
    try {
      longPress(ctx.menu.trigger);
      expect(ctx.getLongPressCount()).toBe(1);
      release(ctx.menu.trigger);

      longPress(ctx.menu.trigger, 2);
      expect(ctx.getLongPressCount()).toBe(2);
    } finally {
      ctx.cleanup();
    }
  });

  it("clears the long-press session when the timer fires without pointerup", () => {
    vi.useFakeTimers();
    const ctx = mountMenu();
    try {
      longPress(ctx.menu.trigger);
      expect(ctx.getLongPressCount()).toBe(1);
      // Pay WebView often skips pointerup - second long-press must still work.
      longPress(ctx.menu.trigger, 2);
      expect(ctx.getLongPressCount()).toBe(2);
    } finally {
      ctx.cleanup();
    }
  });

  it("releases pointer capture when the long press fires", () => {
    vi.useFakeTimers();
    const ctx = mountMenu();
    const releaseCapture = vi.fn();
    ctx.menu.trigger.setPointerCapture = vi.fn();
    ctx.menu.trigger.releasePointerCapture = releaseCapture;
    try {
      ctx.menu.trigger.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          button: 0,
          pointerId: 3,
          pointerType: "touch",
          clientX: 10,
          clientY: 10,
        })
      );
      vi.advanceTimersByTime(500);
      expect(releaseCapture).toHaveBeenCalledWith(3);
    } finally {
      ctx.cleanup();
    }
  });
});
