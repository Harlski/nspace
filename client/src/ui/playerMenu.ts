export type PlayerMenuItemId =
  | "profile"
  | "wardrobe"
  | "rooms"
  | "return-to-hub"
  | "logout"
  | "get-wallet"
  | "leave";

export type PlayerMenuConfirmKind = "logout" | "leave";

type ItemDef = {
  id: PlayerMenuItemId;
  label: string;
  guestOnly?: boolean;
  fullOnly?: boolean;
  destructive?: boolean;
  /** Hidden while already in the Hub (chamber id). */
  returnToHub?: boolean;
};

const FULL_PLAYER_ITEMS: ItemDef[] = [
  { id: "profile", label: "Profile" },
  { id: "wardrobe", label: "Wardrobe" },
  { id: "rooms", label: "Rooms" },
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
  /** Copy identicon src/hidden state from the top player bar image. */
  syncIdenticonFromBar: (barIdenticon: HTMLImageElement) => void;
  onAction: (fn: (id: PlayerMenuItemId) => void) => void;
  onConfirm: (fn: (kind: PlayerMenuConfirmKind) => void) => void;
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
  confirmOk.textContent = "Log out";

  confirmActions.append(confirmCancel, confirmOk);
  confirm.append(confirmMsg, confirmActions);
  panel.append(list, confirm);

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
  root.append(panel, trigger);
  parent.appendChild(root);

  let guestMode = false;
  let returnToHubVisible = true;
  let open = false;
  let confirmKind: PlayerMenuConfirmKind | null = null;
  let actionHandler: (id: PlayerMenuItemId) => void = () => {};
  let confirmHandler: (kind: PlayerMenuConfirmKind) => void = () => {};
  let outsideBound = false;

  function visibleItems(): ItemDef[] {
    const base = guestMode ? GUEST_ITEMS : FULL_PLAYER_ITEMS;
    return base.filter((item) => {
      if (item.returnToHub && !returnToHubVisible) return false;
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
        : "Log out of this wallet?";
    confirmOk.textContent = kind === "leave" ? "Leave" : "Log out";
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

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    if (open) {
      closeMenu();
      return;
    }
    hideConfirm();
    renderList();
    setOpen(true);
  });

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
    isOpen: () => open,
    setGuestMode(guest: boolean) {
      guestMode = guest;
      renderList();
    },
    setReturnToHubVisible(visible: boolean) {
      returnToHubVisible = visible;
      renderList();
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
    onAction(fn: (id: PlayerMenuItemId) => void) {
      actionHandler = fn;
    },
    onConfirm(fn: (kind: PlayerMenuConfirmKind) => void) {
      confirmHandler = fn;
    },
  };
}

/** Items shown for the current mode (test helper). */
export function playerMenuItemLabelsForMode(
  guest: boolean,
  returnToHubVisible = true
): string[] {
  const base = guest ? GUEST_ITEMS : FULL_PLAYER_ITEMS;
  return base
    .filter((item) => {
      if (item.returnToHub && !returnToHubVisible) return false;
      return true;
    })
    .map((item) => item.label);
}
