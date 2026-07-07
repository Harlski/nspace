export type PlayerMenuItemId =
  | "profile"
  | "wardrobe"
  | "shop"
  | "achievements"
  | "rooms"
  | "feedback"
  | "return-from-shaper"
  | "return-to-hub"
  | "logout"
  | "get-wallet"
  | "leave";

export type PlayerMenuConfirmKind = "logout" | "leave";

const PLAYER_MENU_LONG_PRESS_MS = 480;
const PLAYER_MENU_LONG_PRESS_MOVE_PX = 14;

type ItemDef = {
  id: PlayerMenuItemId;
  label: string;
  guestOnly?: boolean;
  fullOnly?: boolean;
  destructive?: boolean;
  /** Hidden while already in the Hub (chamber id). */
  returnToHub?: boolean;
  /** Only shown while the player is inside The Shaper. */
  shaperOnly?: boolean;
};

const FULL_PLAYER_ITEMS: ItemDef[] = [
  { id: "return-from-shaper", label: "Leave the Shaper", shaperOnly: true },
  { id: "wardrobe", label: "Wardrobe" },
  { id: "shop", label: "Shop" },
  { id: "achievements", label: "Achievements" },
  { id: "rooms", label: "Rooms" },
  { id: "feedback", label: "Feedback" },
  { id: "return-to-hub", label: "Return to Hub", returnToHub: true },
  { id: "logout", label: "Logout", destructive: true },
];

const GUEST_ITEMS: ItemDef[] = [
  { id: "profile", label: "Profile" },
  { id: "get-wallet", label: "Get a Wallet", guestOnly: true },
  { id: "return-to-hub", label: "Return to Hub", returnToHub: true },
  { id: "leave", label: "Leave", destructive: true, guestOnly: true },
];

export type PlayerMenu = {
  root: HTMLElement;
  trigger: HTMLButtonElement;
  open: () => void;
  close: () => void;
  isOpen: () => boolean;
  setGuestMode: (guest: boolean) => void;
  setReturnToHubVisible: (visible: boolean) => void;
  /** Toggle the in-Shaper "Leave the Shaper" entry (full players only). */
  setInShaper: (inShaper: boolean) => void;
  /** Display name shown in the pill left of the identicon (hidden when empty). */
  setName: (name: string) => void;
  /** Copy identicon src/hidden state from the top player bar image. */
  syncIdenticonFromBar: (barIdenticon: HTMLImageElement) => void;
  /** Unread admin reply dot on the Feedback menu row. */
  setFeedbackUnread: (hasUnread: boolean) => void;
  onAction: (fn: (id: PlayerMenuItemId) => void) => void;
  onConfirm: (fn: (kind: PlayerMenuConfirmKind) => void) => void;
  /** Long-press on the identicon/name pill; used to open the avatar-centred Action Wheel. */
  onLongPress: (fn: () => void) => void;
};

export function createPlayerMenu(parent: HTMLElement): PlayerMenu {
  const root = document.createElement("div");
  root.className = "player-menu";

  const panel = document.createElement("div");
  panel.className = "player-menu__panel";
  panel.id = "playerMenuPanel";
  panel.setAttribute("role", "menu");
  panel.hidden = true;

  const list = document.createElement("div");
  list.className = "player-menu__list";

  const confirm = document.createElement("div");
  confirm.className = "player-menu__confirm";
  confirm.hidden = true;

  const confirmMsg = document.createElement("p");
  confirmMsg.className = "player-menu__confirm-msg";
  confirmMsg.id = "playerMenuConfirmLabel";

  const confirmActions = document.createElement("div");
  confirmActions.className = "player-menu__confirm-actions";

  const confirmCancel = document.createElement("button");
  confirmCancel.type = "button";
  confirmCancel.className =
    "player-menu__confirm-btn player-menu__confirm-btn--cancel";
  confirmCancel.textContent = "Cancel";

  const confirmOk = document.createElement("button");
  confirmOk.type = "button";
  confirmOk.className =
    "player-menu__confirm-btn player-menu__confirm-btn--confirm";
  confirmOk.textContent = "Return";

  confirmActions.append(confirmCancel, confirmOk);
  confirm.append(confirmMsg, confirmActions);
  panel.append(list, confirm);

  const triggerRow = document.createElement("div");
  triggerRow.className = "player-menu__trigger-row";

  const namePill = document.createElement("button");
  namePill.type = "button";
  namePill.className = "player-menu__name";
  namePill.setAttribute("aria-haspopup", "menu");
  namePill.setAttribute("aria-expanded", "false");
  namePill.setAttribute("aria-controls", "playerMenuPanel");
  namePill.hidden = true;

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "player-menu__trigger";
  trigger.setAttribute("aria-haspopup", "menu");
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-controls", "playerMenuPanel");
  trigger.setAttribute("aria-label", "Player menu");

  const triggerIdent = document.createElement("img");
  triggerIdent.className = "player-menu__identicon";
  triggerIdent.alt = "";
  triggerIdent.width = 44;
  triggerIdent.height = 44;
  triggerIdent.decoding = "async";
  triggerIdent.hidden = true;

  trigger.appendChild(triggerIdent);
  triggerRow.append(namePill, trigger);
  root.append(panel, triggerRow);
  parent.appendChild(root);

  let guestMode = false;
  let returnToHubVisible = true;
  let inShaper = false;
  let feedbackUnread = false;
  let open = false;
  let confirmKind: PlayerMenuConfirmKind | null = null;
  let actionHandler: (id: PlayerMenuItemId) => void = () => {};
  let confirmHandler: (kind: PlayerMenuConfirmKind) => void = () => {};
  let longPressHandler: () => void = () => {};
  let outsideBound = false;
  let suppressNextClick = false;
  let longPressSession:
    | {
        pointerId: number;
        captureEl: HTMLButtonElement;
        startX: number;
        startY: number;
        fired: boolean;
        timer: ReturnType<typeof setTimeout>;
      }
    | null = null;

  function visibleItems(): ItemDef[] {
    const base = guestMode ? GUEST_ITEMS : FULL_PLAYER_ITEMS;
    return base.filter((item) => {
      if (item.returnToHub && !returnToHubVisible) return false;
      if (item.shaperOnly && !inShaper) return false;
      return true;
    });
  }

  function renderList(): void {
    list.replaceChildren();
    for (const item of visibleItems()) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "player-menu__item";
      btn.setAttribute("role", "menuitem");
      btn.dataset.playerMenuItem = item.id;
      btn.textContent = item.label;
      if (item.destructive) {
        btn.classList.add("player-menu__item--destructive");
      }
      if (item.id === "feedback" && feedbackUnread) {
        btn.classList.add("player-menu__item--unread");
        btn.setAttribute("aria-label", "Feedback - new reply");
        btn.title = "Feedback - new reply";
      }
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (item.id === "logout" || item.id === "leave") {
          showConfirm(item.id === "leave" ? "leave" : "logout");
          return;
        }
        closeMenu();
        actionHandler(item.id);
      });
      list.appendChild(btn);
    }
  }

  function showConfirm(kind: PlayerMenuConfirmKind): void {
    confirmKind = kind;
    confirmMsg.textContent =
      kind === "leave"
        ? "Leave this guest session?"
        : "Return to the lobby?";
    confirmOk.textContent = kind === "leave" ? "Leave" : "Return";
    list.hidden = true;
    confirm.hidden = false;
  }

  function hideConfirm(): void {
    confirmKind = null;
    confirm.hidden = true;
    list.hidden = false;
  }

  function setOpen(next: boolean): void {
    open = next;
    trigger.setAttribute("aria-expanded", next ? "true" : "false");
    namePill.setAttribute("aria-expanded", next ? "true" : "false");
    panel.hidden = !next;
    root.classList.toggle("player-menu--open", next);
    if (!next) hideConfirm();
    if (next) {
      bindOutside();
    } else {
      unbindOutside();
    }
  }

  function closeMenu(): void {
    if (!open) return;
    setOpen(false);
  }

  function onOutsidePointerDown(e: PointerEvent): void {
    const t = e.target;
    if (!(t instanceof Node)) return;
    if (root.contains(t)) return;
    closeMenu();
  }

  function onEscape(e: KeyboardEvent): void {
    if (e.key !== "Escape") return;
    if (!open) return;
    e.preventDefault();
    if (confirmKind) {
      hideConfirm();
      return;
    }
    closeMenu();
  }

  function bindOutside(): void {
    if (outsideBound) return;
    outsideBound = true;
    window.addEventListener("pointerdown", onOutsidePointerDown, {
      capture: true,
    });
    window.addEventListener("keydown", onEscape);
  }

  function unbindOutside(): void {
    if (!outsideBound) return;
    outsideBound = false;
    window.removeEventListener("pointerdown", onOutsidePointerDown, {
      capture: true,
    });
    window.removeEventListener("keydown", onEscape);
  }

  function toggleFromTrigger(e: Event): void {
    e.stopPropagation();
    if (open) {
      closeMenu();
      return;
    }
    hideConfirm();
    renderList();
    setOpen(true);
  }

  let windowLongPressListenersBound = false;

  function releaseLongPressCapture(): void {
    if (!longPressSession) return;
    try {
      longPressSession.captureEl.releasePointerCapture(longPressSession.pointerId);
    } catch {
      /* pointer capture is best-effort */
    }
  }

  function unbindWindowLongPressListeners(): void {
    if (!windowLongPressListenersBound) return;
    windowLongPressListenersBound = false;
    window.removeEventListener("pointerup", onWindowLongPressPointerEnd, true);
    window.removeEventListener("pointercancel", onWindowLongPressPointerEnd, true);
  }

  function onWindowLongPressPointerEnd(e: PointerEvent): void {
    if (!longPressSession || longPressSession.pointerId !== e.pointerId) return;
    finishLongPressSession();
  }

  function bindWindowLongPressListeners(): void {
    if (windowLongPressListenersBound) return;
    windowLongPressListenersBound = true;
    window.addEventListener("pointerup", onWindowLongPressPointerEnd, true);
    window.addEventListener("pointercancel", onWindowLongPressPointerEnd, true);
  }

  function clearLongPressSession(): void {
    if (!longPressSession) return;
    clearTimeout(longPressSession.timer);
    releaseLongPressCapture();
    longPressSession = null;
    unbindWindowLongPressListeners();
  }

  /** End the active long-press gesture; keep suppressNextClick when the timer already fired. */
  function finishLongPressSession(): void {
    const hadFired = longPressSession?.fired === true;
    clearLongPressSession();
    // Pay WebView often skips the synthetic click after a long press; do not leave
    // suppressNextClick stuck across the next gesture.
    if (hadFired) {
      window.setTimeout(() => {
        suppressNextClick = false;
      }, 400);
    }
  }

  function bindLongPress(el: HTMLButtonElement): void {
    el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || longPressSession) return;
      longPressSession = {
        pointerId: e.pointerId,
        captureEl: el,
        startX: e.clientX,
        startY: e.clientY,
        fired: false,
        timer: setTimeout(() => {
          if (!longPressSession || longPressSession.pointerId !== e.pointerId) return;
          longPressSession.fired = true;
          suppressNextClick = true;
          // Release capture so the Action Wheel (and the rest of the HUD) can receive
          // the finger still held after the long-press threshold.
          releaseLongPressCapture();
          closeMenu();
          longPressHandler();
          // Pay WebView often never delivers pointerup for the long-press gesture - end
          // the session now so the next open/close cycle is not blocked.
          finishLongPressSession();
        }, PLAYER_MENU_LONG_PRESS_MS),
      };
      bindWindowLongPressListeners();
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* pointer capture is best-effort */
      }
    });

    el.addEventListener("pointermove", (e) => {
      if (!longPressSession || longPressSession.pointerId !== e.pointerId) return;
      if (longPressSession.fired) return;
      const dx = e.clientX - longPressSession.startX;
      const dy = e.clientY - longPressSession.startY;
      if (Math.hypot(dx, dy) > PLAYER_MENU_LONG_PRESS_MOVE_PX) {
        clearLongPressSession();
      }
    });

    el.addEventListener("pointerup", (e) => {
      if (!longPressSession || longPressSession.pointerId !== e.pointerId) return;
      finishLongPressSession();
    });

    el.addEventListener("pointercancel", (e) => {
      if (!longPressSession || longPressSession.pointerId !== e.pointerId) return;
      finishLongPressSession();
    });

    el.addEventListener("lostpointercapture", () => {
      if (!longPressSession) return;
      finishLongPressSession();
    });
  }

  root.addEventListener(
    "click",
    (e) => {
      if (!suppressNextClick) return;
      suppressNextClick = false;
      longPressSession = null;
      e.preventDefault();
      e.stopImmediatePropagation();
    },
    { capture: true }
  );

  trigger.addEventListener("click", toggleFromTrigger);
  namePill.addEventListener("click", toggleFromTrigger);
  bindLongPress(trigger);
  bindLongPress(namePill);

  panel.addEventListener("click", (e) => e.stopPropagation());

  confirmCancel.addEventListener("click", (e) => {
    e.stopPropagation();
    hideConfirm();
  });

  confirmOk.addEventListener("click", (e) => {
    e.stopPropagation();
    const kind = confirmKind;
    closeMenu();
    if (kind) confirmHandler(kind);
  });

  renderList();

  return {
    root,
    trigger,
    open: () => {
      hideConfirm();
      renderList();
      setOpen(true);
    },
    close: closeMenu,
    /** Drop an in-flight long-press gesture (e.g. before opening the Action Wheel). */
    abortLongPressGesture: finishLongPressSession,
    isOpen: () => open,
    setGuestMode(guest: boolean) {
      guestMode = guest;
      renderList();
    },
    setReturnToHubVisible(visible: boolean) {
      returnToHubVisible = visible;
      renderList();
    },
    setInShaper(next: boolean) {
      inShaper = next;
      renderList();
    },
    setName(name: string) {
      const trimmed = name.trim();
      namePill.textContent = trimmed;
      namePill.hidden = trimmed.length === 0;
      namePill.title = trimmed;
    },
    syncIdenticonFromBar(barIdenticon: HTMLImageElement) {
      triggerIdent.hidden = barIdenticon.hidden;
      const src = barIdenticon.getAttribute("src");
      if (src) {
        triggerIdent.src = src;
      } else {
        triggerIdent.removeAttribute("src");
      }
    },
    setFeedbackUnread(hasUnread: boolean) {
      feedbackUnread = hasUnread;
      renderList();
    },
    onAction(fn: (id: PlayerMenuItemId) => void) {
      actionHandler = fn;
    },
    onConfirm(fn: (kind: PlayerMenuConfirmKind) => void) {
      confirmHandler = fn;
    },
    onLongPress(fn: () => void) {
      longPressHandler = fn;
    },
  };
}

/** Items shown for the current mode (test helper). */
export function playerMenuItemLabelsForMode(
  guest: boolean,
  returnToHubVisible = true,
  inShaper = false
): string[] {
  const base = guest ? GUEST_ITEMS : FULL_PLAYER_ITEMS;
  return base
    .filter((item) => {
      if (item.returnToHub && !returnToHubVisible) return false;
      if (item.shaperOnly && !inShaper) return false;
      return true;
    })
    .map((item) => item.label);
}
