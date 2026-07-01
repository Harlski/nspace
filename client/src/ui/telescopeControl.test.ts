import { describe, it, expect, afterEach } from "vitest";
import { createTelescopeControl } from "./telescopeControl.js";
import { MOBILE_PLAY_HOST_CLASS } from "./pseudoFullscreen.js";

function pointerDown(el: HTMLElement, pointerId = 1): void {
  el.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      button: 0,
      pointerId,
      pointerType: "mouse",
    })
  );
}

function pointerUp(el: HTMLElement, pointerId = 1): void {
  el.dispatchEvent(
    new PointerEvent("pointerup", {
      bubbles: true,
      button: 0,
      pointerId,
      pointerType: "mouse",
    })
  );
}

function shiftDown(): void {
  window.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Shift", bubbles: true })
  );
}

function shiftUp(): void {
  window.dispatchEvent(
    new KeyboardEvent("keyup", { key: "Shift", bubbles: true })
  );
}

async function flushKeyboardHoldStart(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function shiftHold(): void {
  shiftDown();
}

async function shiftRelease(): Promise<void> {
  shiftUp();
}

function shiftWithLetter(): void {
  shiftDown();
  window.dispatchEvent(
    new KeyboardEvent("keydown", { key: "z", bubbles: true })
  );
  window.dispatchEvent(new KeyboardEvent("keyup", { key: "z", bubbles: true }));
  shiftUp();
}

describe("telescopeControl", () => {
  afterEach(() => {
    document.documentElement.classList.remove(MOBILE_PLAY_HOST_CLASS);
  });

  it("stays hidden until unlocked for full players", () => {
    const host = document.createElement("div");
    const control = createTelescopeControl(host);
    expect(control.root.hidden).toBe(true);

    control.setUnlocked(true);
    expect(control.root.hidden).toBe(false);

    control.setGuestMode(true);
    expect(control.root.hidden).toBe(true);
  });

  it("uses desktop hint copy on letterbox layout", () => {
    const host = document.createElement("div");
    const control = createTelescopeControl(host);
    expect(control.root.title).toBe("Hold Shift or this button to zoom out");
  });

  it("uses touch-only hint copy on mobile-play host", () => {
    document.documentElement.classList.add(MOBILE_PLAY_HOST_CLASS);
    const host = document.createElement("div");
    const control = createTelescopeControl(host);
    expect(control.root.title).toBe("Hold to zoom out");
  });

  it("fires hold start on pointer down and hold end on pointer up", () => {
    const host = document.createElement("div");
    const control = createTelescopeControl(host);
    control.setUnlocked(true);

    let starts = 0;
    let ends = 0;
    control.onHoldStart(() => {
      starts++;
    });
    control.onHoldEnd(() => {
      ends++;
    });

    pointerDown(control.root);
    expect(starts).toBe(1);
    expect(ends).toBe(0);

    pointerUp(control.root);
    expect(starts).toBe(1);
    expect(ends).toBe(1);
  });

  it("does not end hold synchronously on pointer down", () => {
    const host = document.createElement("div");
    const control = createTelescopeControl(host);
    control.setUnlocked(true);

    let ends = 0;
    control.onHoldEnd(() => {
      ends++;
    });

    pointerDown(control.root);
    expect(ends).toBe(0);
  });

  it("ends hold on window pointerup when capture is lost", () => {
    const host = document.createElement("div");
    const control = createTelescopeControl(host);
    control.setUnlocked(true);

    let ends = 0;
    control.onHoldEnd(() => {
      ends++;
    });

    pointerDown(control.root);
    window.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        button: 0,
        pointerId: 1,
        pointerType: "mouse",
      })
    );
    expect(ends).toBe(1);
  });

  it("holds zoom on Shift down and restores on Shift up when unlocked", async () => {
    const host = document.createElement("div");
    const control = createTelescopeControl(host);
    control.setUnlocked(true);

    let starts = 0;
    let ends = 0;
    control.onHoldStart(() => {
      starts++;
    });
    control.onHoldEnd(() => {
      ends++;
    });

    shiftHold();
    expect(starts).toBe(0);
    await flushKeyboardHoldStart();
    expect(starts).toBe(1);
    expect(ends).toBe(0);
    expect(control.root.classList.contains("telescope-control--active")).toBe(
      true
    );

    await shiftRelease();
    expect(starts).toBe(1);
    expect(ends).toBe(1);
    expect(control.root.classList.contains("telescope-control--active")).toBe(
      false
    );
  });

  it("does not hold zoom on Shift when locked or guest", async () => {
    const host = document.createElement("div");
    const control = createTelescopeControl(host);

    let starts = 0;
    control.onHoldStart(() => {
      starts++;
    });

    shiftHold();
    await flushKeyboardHoldStart();
    expect(starts).toBe(0);

    control.setUnlocked(true);
    control.setGuestMode(true);
    shiftHold();
    await flushKeyboardHoldStart();
    expect(starts).toBe(0);
  });

  it("does not hold zoom on Shift+letter chords", async () => {
    const host = document.createElement("div");
    const control = createTelescopeControl(host);
    control.setUnlocked(true);

    let starts = 0;
    control.onHoldStart(() => {
      starts++;
    });

    shiftWithLetter();
    await flushKeyboardHoldStart();
    expect(starts).toBe(0);
  });

  it("ignores Shift hold on mobile-play host", async () => {
    document.documentElement.classList.add(MOBILE_PLAY_HOST_CLASS);
    const host = document.createElement("div");
    const control = createTelescopeControl(host);
    control.setUnlocked(true);

    let starts = 0;
    control.onHoldStart(() => {
      starts++;
    });

    shiftHold();
    await flushKeyboardHoldStart();
    expect(starts).toBe(0);
  });

  it("keeps zoom while Shift held after pointer release", async () => {
    const host = document.createElement("div");
    const control = createTelescopeControl(host);
    control.setUnlocked(true);

    let ends = 0;
    control.onHoldEnd(() => {
      ends++;
    });

    shiftHold();
    await flushKeyboardHoldStart();
    pointerDown(control.root);
    pointerUp(control.root);
    expect(ends).toBe(0);
    expect(control.root.classList.contains("telescope-control--active")).toBe(
      true
    );

    await shiftRelease();
    expect(ends).toBe(1);
  });

  it("ends Shift hold on window blur", async () => {
    const host = document.createElement("div");
    const control = createTelescopeControl(host);
    control.setUnlocked(true);

    let ends = 0;
    control.onHoldEnd(() => {
      ends++;
    });

    shiftHold();
    await flushKeyboardHoldStart();
    window.dispatchEvent(new Event("blur"));
    expect(ends).toBe(1);
  });

  it("ends Shift hold when the document becomes hidden", async () => {
    const host = document.createElement("div");
    const control = createTelescopeControl(host);
    control.setUnlocked(true);

    let ends = 0;
    control.onHoldEnd(() => {
      ends++;
    });

    shiftHold();
    await flushKeyboardHoldStart();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(ends).toBe(1);
  });
});
