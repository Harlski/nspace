import { MOBILE_PLAY_HOST_CLASS } from "./pseudoFullscreen.js";
import { nimiqIconUseMarkup } from "./nimiqIcons.js";

export type TelescopeControl = {
  root: HTMLButtonElement;
  setUnlocked: (unlocked: boolean) => void;
  setGuestMode: (guest: boolean) => void;
  onHoldStart: (fn: () => void) => void;
  onHoldEnd: (fn: () => void) => void;
};

function isTypingTarget(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
}

function isDesktopLetterbox(): boolean {
  return !document.documentElement.classList.contains(MOBILE_PLAY_HOST_CLASS);
}

export function createTelescopeControl(parent: HTMLElement): TelescopeControl {
  const root = document.createElement("button");
  root.type = "button";
  root.className = "telescope-control";
  root.hidden = true;

  parent.insertBefore(root, parent.firstChild);

  let unlocked = false;
  let guestMode = false;
  let holdStartHandler: () => void = () => {};
  let holdEndHandler: () => void = () => {};
  let activePointerId: number | null = null;
  let pointerHoldActive = false;
  let keyboardHoldActive = false;
  let holdEngaged = false;
  let shiftAlonePending = false;
  let shiftSessionChorded = false;
  let shiftHoldDeferredId: number | null = null;
  let windowHoldListenersBound = false;
  let keyboardListenersBound = false;

  function syncHint(): void {
    const desktop = isDesktopLetterbox();
    root.title = desktop
      ? "Hold Shift or this button to zoom out"
      : "Hold to zoom out";
    root.setAttribute(
      "aria-label",
      desktop
        ? "Telescope - hold Shift or this button to zoom out"
        : "Telescope - hold to zoom out"
    );
  }

  function syncVisible(): void {
    root.hidden = guestMode || !unlocked;
  }

  function syncActiveChrome(): void {
    root.classList.toggle(
      "telescope-control--active",
      pointerHoldActive || keyboardHoldActive
    );
  }

  function syncHoldEngagement(): void {
    const shouldHold = pointerHoldActive || keyboardHoldActive;
    if (shouldHold && !holdEngaged) {
      holdEngaged = true;
      holdStartHandler();
    } else if (!shouldHold && holdEngaged) {
      holdEngaged = false;
      holdEndHandler();
    }
    syncActiveChrome();
  }

  function cancelDeferredKeyboardHold(): void {
    if (shiftHoldDeferredId === null) return;
    cancelAnimationFrame(shiftHoldDeferredId);
    shiftHoldDeferredId = null;
  }

  function endKeyboardHold(): void {
    cancelDeferredKeyboardHold();
    shiftAlonePending = false;
    if (!keyboardHoldActive) return;
    keyboardHoldActive = false;
    syncHoldEngagement();
  }

  function resetHoldState(): void {
    activePointerId = null;
    pointerHoldActive = false;
    keyboardHoldActive = false;
    shiftAlonePending = false;
    shiftSessionChorded = false;
    cancelDeferredKeyboardHold();
    unbindWindowHoldListeners();
    syncHoldEngagement();
  }

  function onWindowPointerEnd(e: PointerEvent): void {
    if (activePointerId === null || activePointerId !== e.pointerId) return;
    endPointerHold();
  }

  function bindWindowHoldListeners(): void {
    if (windowHoldListenersBound) return;
    windowHoldListenersBound = true;
    window.addEventListener("pointerup", onWindowPointerEnd, true);
    window.addEventListener("pointercancel", onWindowPointerEnd, true);
  }

  function unbindWindowHoldListeners(): void {
    if (!windowHoldListenersBound) return;
    windowHoldListenersBound = false;
    window.removeEventListener("pointerup", onWindowPointerEnd, true);
    window.removeEventListener("pointercancel", onWindowPointerEnd, true);
  }

  function endPointerHold(): void {
    if (!pointerHoldActive) return;
    activePointerId = null;
    pointerHoldActive = false;
    unbindWindowHoldListeners();
    syncHoldEngagement();
  }

  function scheduleKeyboardHoldStart(): void {
    cancelDeferredKeyboardHold();
    shiftHoldDeferredId = requestAnimationFrame(() => {
      shiftHoldDeferredId = null;
      if (!shiftAlonePending || shiftSessionChorded) return;
      keyboardHoldActive = true;
      syncHoldEngagement();
    });
  }

  function onWindowKeyDown(e: KeyboardEvent): void {
    if (!isDesktopLetterbox() || guestMode || !unlocked) return;
    if (e.key === "Shift" && !e.repeat) {
      if (shiftSessionChorded || isTypingTarget(document.activeElement)) return;
      shiftAlonePending = true;
      scheduleKeyboardHoldStart();
      return;
    }
    if (shiftAlonePending || keyboardHoldActive) {
      shiftAlonePending = false;
      shiftSessionChorded = true;
      cancelDeferredKeyboardHold();
      endKeyboardHold();
    }
  }

  function onWindowKeyUp(e: KeyboardEvent): void {
    if (e.key !== "Shift") return;
    shiftAlonePending = false;
    shiftSessionChorded = false;
    cancelDeferredKeyboardHold();
    endKeyboardHold();
  }

  function onWindowBlur(): void {
    endKeyboardHold();
    shiftSessionChorded = false;
  }

  function onVisibilityChange(): void {
    if (document.visibilityState === "hidden") {
      onWindowBlur();
    }
  }

  function bindKeyboardListeners(): void {
    if (keyboardListenersBound) return;
    keyboardListenersBound = true;
    window.addEventListener("keydown", onWindowKeyDown, true);
    window.addEventListener("keyup", onWindowKeyUp, true);
    window.addEventListener("blur", onWindowBlur);
    document.addEventListener("visibilitychange", onVisibilityChange);
  }

  root.addEventListener(
    "pointerdown",
    (e) => {
      if (guestMode || !unlocked || activePointerId !== null) return;
      if (e.button !== 0) return;
      activePointerId = e.pointerId;
      pointerHoldActive = true;
      bindWindowHoldListeners();
      try {
        root.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      e.preventDefault();
      e.stopPropagation();
      syncHoldEngagement();
    },
    true
  );

  root.addEventListener("pointerup", (e) => {
    if (activePointerId !== e.pointerId) return;
    endPointerHold();
  });

  root.addEventListener("pointercancel", (e) => {
    if (activePointerId !== e.pointerId) return;
    endPointerHold();
  });

  root.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  root.innerHTML = nimiqIconUseMarkup("nq-view", {
    width: 22,
    height: 22,
    class: "telescope-control__icon",
  });
  syncHint();
  bindKeyboardListeners();

  return {
    root,
    setUnlocked(next: boolean) {
      unlocked = next;
      if (!next) {
        resetHoldState();
      }
      syncVisible();
    },
    setGuestMode(guest: boolean) {
      guestMode = guest;
      if (guest) resetHoldState();
      syncVisible();
    },
    onHoldStart(fn: () => void) {
      holdStartHandler = fn;
    },
    onHoldEnd(fn: () => void) {
      holdEndHandler = fn;
    },
  };
}
