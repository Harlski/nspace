const LONG_PRESS_MS = 400;
const LONG_PRESS_MOVE_PX = 12;

type LongPressSession = {
  pointerId: number;
  startX: number;
  startY: number;
  fired: boolean;
  timer: ReturnType<typeof setTimeout>;
};

let pinnedTipHost: HTMLElement | null = null;
let globalDismissBound = false;
let suppressNextClick = false;

function ensureGlobalDismiss(): void {
  if (globalDismissBound) return;
  globalDismissBound = true;
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (!pinnedTipHost) return;
      if (pinnedTipHost.contains(e.target as Node)) return;
      unpinWardrobeSlotTip();
    },
    true
  );
}

function unpinWardrobeSlotTip(): void {
  if (!pinnedTipHost) return;
  const tip = pinnedTipHost.querySelector(".wardrobe-slot-tip");
  tip?.classList.remove("is-visible", "is-pinned");
  pinnedTipHost = null;
}

function showWardrobeSlotTip(host: HTMLElement, pinned: boolean): void {
  const tip = host.querySelector(".wardrobe-slot-tip");
  if (!tip) return;
  tip.classList.add("is-visible");
  if (pinned) {
    tip.classList.add("is-pinned");
    if (pinnedTipHost && pinnedTipHost !== host) unpinWardrobeSlotTip();
    pinnedTipHost = host;
    ensureGlobalDismiss();
  }
}

function hideWardrobeSlotTip(host: HTMLElement): void {
  const tip = host.querySelector(".wardrobe-slot-tip");
  if (!tip || tip.classList.contains("is-pinned")) return;
  tip.classList.remove("is-visible");
}

export function slotAriaLabel(slotLabel: string, presetName: string): string {
  return `${slotLabel}: ${presetName}`;
}

export function createWardrobeSlotTooltip(slotLabel: string): HTMLSpanElement {
  const tip = document.createElement("span");
  tip.className = "wardrobe-slot-tip";
  tip.setAttribute("role", "tooltip");
  tip.textContent = slotLabel;
  return tip;
}

/** Hover (desktop) and long-press (touch) Slot label discovery for Loadout doll squares. */
export function bindWardrobeSlotTooltip(
  host: HTMLElement,
  interactiveEl: HTMLElement,
  options: { editable?: boolean } = {}
): void {
  interactiveEl.addEventListener("mouseenter", () => showWardrobeSlotTip(host, false));
  interactiveEl.addEventListener("mouseleave", () => hideWardrobeSlotTip(host));
  interactiveEl.addEventListener("focusin", () => showWardrobeSlotTip(host, false));
  interactiveEl.addEventListener("focusout", () => hideWardrobeSlotTip(host));

  let session: LongPressSession | null = null;

  const clearSession = (): void => {
    if (!session) return;
    clearTimeout(session.timer);
    session = null;
  };

  interactiveEl.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || session) return;
    session = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      fired: false,
      timer: setTimeout(() => {
        if (!session || session.pointerId !== e.pointerId) return;
        session.fired = true;
        if (options.editable) suppressNextClick = true;
        showWardrobeSlotTip(host, true);
      }, LONG_PRESS_MS),
    };
  });

  interactiveEl.addEventListener("pointermove", (e) => {
    if (!session || session.pointerId !== e.pointerId || session.fired) return;
    const dx = e.clientX - session.startX;
    const dy = e.clientY - session.startY;
    if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_PX) clearSession();
  });

  interactiveEl.addEventListener("pointerup", (e) => {
    if (!session || session.pointerId !== e.pointerId) return;
    clearSession();
  });

  interactiveEl.addEventListener("pointercancel", (e) => {
    if (!session || session.pointerId !== e.pointerId) return;
    clearSession();
  });

  if (options.editable) {
    interactiveEl.addEventListener(
      "click",
      (e) => {
        if (!suppressNextClick) return;
        suppressNextClick = false;
        e.preventDefault();
        e.stopImmediatePropagation();
      },
      true
    );
  }
}

export function resetWardrobeSlotTipsForTests(): void {
  unpinWardrobeSlotTip();
  suppressNextClick = false;
}
