import { nimiqIconUseMarkup } from "./nimiqIcons.js";

export type TelescopeControl = {
  root: HTMLButtonElement;
  setUnlocked: (unlocked: boolean) => void;
  setGuestMode: (guest: boolean) => void;
  onHoldStart: (fn: () => void) => void;
  onHoldEnd: (fn: () => void) => void;
};

export function createTelescopeControl(parent: HTMLElement): TelescopeControl {
  const root = document.createElement("button");
  root.type = "button";
  root.className = "telescope-control";
  root.hidden = true;
  root.setAttribute("aria-label", "Telescope — hold to zoom out");
  root.title = "Hold to zoom out";
  root.innerHTML = nimiqIconUseMarkup("nq-view", {
    width: 22,
    height: 22,
    class: "telescope-control__icon",
  });

  parent.insertBefore(root, parent.firstChild);

  let unlocked = false;
  let guestMode = false;
  let holdStartHandler: () => void = () => {};
  let holdEndHandler: () => void = () => {};
  let activePointerId: number | null = null;

  function syncVisible(): void {
    root.hidden = guestMode || !unlocked;
  }

  function endHold(): void {
    if (activePointerId === null) return;
    activePointerId = null;
    root.classList.remove("telescope-control--active");
    holdEndHandler();
  }

  root.addEventListener("pointerdown", (e) => {
    if (guestMode || !unlocked || activePointerId !== null) return;
    if (e.button !== 0) return;
    activePointerId = e.pointerId;
    root.classList.add("telescope-control--active");
    try {
      root.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    e.preventDefault();
    e.stopPropagation();
    holdStartHandler();
  });

  root.addEventListener("pointerup", (e) => {
    if (activePointerId !== e.pointerId) return;
    endHold();
  });

  root.addEventListener("pointercancel", (e) => {
    if (activePointerId !== e.pointerId) return;
    endHold();
  });

  root.addEventListener("lostpointercapture", () => {
    endHold();
  });

  root.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  return {
    root,
    setUnlocked(next: boolean) {
      unlocked = next;
      syncVisible();
    },
    setGuestMode(guest: boolean) {
      guestMode = guest;
      if (guest) endHold();
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
