/**
 * Single floating context-menu host for in-world UI (gates, chat lines, …).
 * ESC, click-outside, and Tab wrap apply while open. Player avatar menu keeps
 * its own DOM (`other-player-ctx` with multi-picker) but shares positioning
 * and listeners via {@link WorldContextMenuOpenOwned}.
 */

export type WorldContextMenuItem = {
  id: string;
  label: string;
  /** Plain-text suffix (e.g. timing hint); shown after `label` with `suffixClass`. */
  labelSuffix?: string;
  suffixClass?: string;
  icon?: string;
  destructive?: boolean;
  disabled?: boolean;
  onSelect: () => void;
};

export type WorldContextMenuOpenItems = {
  kind: "items";
  clientX: number;
  clientY: number;
  ariaLabel: string;
  items: WorldContextMenuItem[];
  /** Default "first". Chat menu historically focused Translate (last row). */
  initialFocus?: "first" | "last" | "none";
};

export type WorldContextMenuOpenOwned = {
  kind: "owned";
  clientX: number;
  clientY: number;
  ariaLabel: string;
  /** Existing panel (e.g. avatar `other-player-ctx`); stays in the DOM. */
  element: HTMLElement;
  /** Reset DOM / state when the coordinator closes this panel. */
  onOwnedClose: () => void;
  /** Optional `querySelector` relative to `element` after layout. */
  focusSelector?: string;
};

export type WorldContextMenuOpenOptions =
  | WorldContextMenuOpenItems
  | WorldContextMenuOpenOwned;

export type WorldContextMenu = {
  open(opts: WorldContextMenuOpenOptions): void;
  close(): void;
  /** Close only when the open owned surface is `el` (keeps items-mode chat menu open). */
  closeIfActiveOwnedElement(el: HTMLElement): boolean;
  isOpen(): boolean;
};

function clampMenuPosition(
  el: HTMLElement,
  clientX: number,
  clientY: number
): void {
  const w = el.offsetWidth || 160;
  const h = el.offsetHeight || 44;
  const pad = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const x = Math.min(Math.max(pad, clientX), vw - w - pad);
  const y = Math.min(Math.max(pad, clientY), vh - h - pad);
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.position = "fixed";
}

function listFocusableIn(root: HTMLElement): HTMLElement[] {
  const nodes = root.querySelectorAll<HTMLElement>(
    'button:not([disabled]), a[href]:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  const out: HTMLElement[] = [];
  for (const el of nodes) {
    if (el.tabIndex === -1) continue;
    if (el.hasAttribute("disabled")) continue;
    if (el.getAttribute("aria-hidden") === "true") continue;
    const st = window.getComputedStyle(el);
    if (st.display === "none" || st.visibility === "hidden") continue;
    out.push(el);
  }
  return out;
}

export function createWorldContextMenu(opts: {
  /** Where the items-mode root node is appended (e.g. HUD letterbox). */
  parent: HTMLElement;
}): WorldContextMenu {
  const itemsRoot = document.createElement("div");
  itemsRoot.className = "other-player-ctx world-context-menu";
  itemsRoot.hidden = true;
  itemsRoot.setAttribute("role", "menu");
  opts.parent.appendChild(itemsRoot);

  let mode: "idle" | "items" | "owned" = "idle";
  let ownedElement: HTMLElement | null = null;
  let ownedOnClose: (() => void) | null = null;

  let pointerBound = false;
  let keydownBound = false;

  function activeSurface(): HTMLElement | null {
    if (mode === "items") return itemsRoot;
    if (mode === "owned") return ownedElement;
    return null;
  }

  function detachGlobalListeners(): void {
    if (pointerBound) {
      window.removeEventListener("pointerdown", onPointerDownCapture, true);
      pointerBound = false;
    }
    if (keydownBound) {
      window.removeEventListener("keydown", onKeyDown, true);
      keydownBound = false;
    }
  }

  function onPointerDownCapture(ev: PointerEvent): void {
    const surf = activeSurface();
    if (!surf || surf.hidden) return;
    if (surf.contains(ev.target as Node)) return;
    close();
  }

  function onKeyDown(ev: KeyboardEvent): void {
    const surf = activeSurface();
    if (!surf || surf.hidden) return;
    if (ev.key === "Escape") {
      ev.preventDefault();
      close();
      return;
    }
    if (ev.key !== "Tab") return;
    const focusables = listFocusableIn(surf);
    if (focusables.length === 0) return;
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    if (ev.shiftKey) {
      if (document.activeElement === first) {
        ev.preventDefault();
        last.focus();
      }
    } else if (document.activeElement === last) {
      ev.preventDefault();
      first.focus();
    }
  }

  function attachGlobalListeners(): void {
    if (!pointerBound) {
      window.addEventListener("pointerdown", onPointerDownCapture, true);
      pointerBound = true;
    }
    if (!keydownBound) {
      window.addEventListener("keydown", onKeyDown, true);
      keydownBound = true;
    }
  }

  function close(): void {
    detachGlobalListeners();
    const wasOwned = mode === "owned";
    const wasItems = mode === "items";
    if (wasOwned && ownedOnClose) {
      ownedOnClose();
      ownedOnClose = null;
      ownedElement = null;
    }
    if (wasItems) {
      itemsRoot.replaceChildren();
    }
    mode = "idle";
    itemsRoot.hidden = true;
  }

  function openItems(o: WorldContextMenuOpenItems): void {
    close();
    mode = "items";
    itemsRoot.setAttribute("aria-label", o.ariaLabel);
    itemsRoot.replaceChildren();
    for (const it of o.items) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "other-player-ctx__item";
      if (it.destructive) {
        btn.classList.add("other-player-ctx__item--destructive");
      }
      btn.setAttribute("role", "menuitem");
      if (it.labelSuffix && it.suffixClass) {
        btn.textContent = "";
        btn.appendChild(document.createTextNode(it.label));
        const suf = document.createElement("span");
        suf.className = it.suffixClass;
        suf.textContent = it.labelSuffix;
        btn.appendChild(suf);
      } else {
        btn.textContent = it.label;
      }
      btn.disabled = it.disabled === true;
      btn.addEventListener("click", () => {
        if (it.disabled) return;
        close();
        it.onSelect();
      });
      itemsRoot.appendChild(btn);
    }
    itemsRoot.hidden = false;
    requestAnimationFrame(() => {
      if (mode !== "items") return;
      clampMenuPosition(itemsRoot, o.clientX, o.clientY);
      attachGlobalListeners();
      const focusables = listFocusableIn(itemsRoot);
      if (focusables.length === 0 || o.initialFocus === "none") return;
      const pick =
        o.initialFocus === "last"
          ? focusables[focusables.length - 1]!
          : focusables[0]!;
      pick.focus();
    });
  }

  function openOwned(o: WorldContextMenuOpenOwned): void {
    close();
    mode = "owned";
    ownedElement = o.element;
    ownedOnClose = o.onOwnedClose;
    o.element.setAttribute("aria-label", o.ariaLabel);
    o.element.hidden = false;
    o.element.style.position = "fixed";
    requestAnimationFrame(() => {
      if (mode !== "owned" || ownedElement !== o.element) return;
      clampMenuPosition(o.element, o.clientX, o.clientY);
      attachGlobalListeners();
      if (o.focusSelector) {
        const t = o.element.querySelector<HTMLElement>(o.focusSelector);
        t?.focus();
      } else {
        const focusables = listFocusableIn(o.element);
        focusables[0]?.focus();
      }
    });
  }

  return {
    open(opts: WorldContextMenuOpenOptions): void {
      if (opts.kind === "items") openItems(opts);
      else openOwned(opts);
    },
    close,
    closeIfActiveOwnedElement(el: HTMLElement): boolean {
      if (mode === "owned" && ownedElement === el) {
        close();
        return true;
      }
      return false;
    },
    isOpen(): boolean {
      return mode !== "idle";
    },
  };
}
