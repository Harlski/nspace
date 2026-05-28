/**
 * Full-screen prefab library: pick which placeable designs appear in the build dock strip.
 * Selection is persisted per wallet in localStorage.
 */
import { normalizeWalletKey } from "../game/grid.js";
import type { DesignWire } from "../net/ws.js";
import { walletDisplayName } from "../walletDisplayName.js";
import {
  createWorldContextMenu,
  type WorldContextMenu,
} from "./worldContextMenu.js";

function designVisibilityLabel(v: DesignWire["visibility"]): string {
  return v === "public" ? "Public" : "Private";
}

function isOwnDesign(d: DesignWire, wallet: string): boolean {
  if (!wallet.trim()) return false;
  return normalizeWalletKey(d.creatorWallet) === normalizeWalletKey(wallet);
}

const STORAGE_KEY = "nspace-prefab-dock-v1";

function walletStorageKey(wallet: string): string {
  return `${STORAGE_KEY}:${wallet.replace(/\s+/g, "").trim().toUpperCase()}`;
}

/** `null` = legacy default (show entire catalog in the dock). */
export function loadPrefabDockIds(wallet: string): string[] | null {
  if (!wallet.trim()) return null;
  try {
    const raw = localStorage.getItem(walletStorageKey(wallet));
    if (raw == null) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return null;
  }
}

export function savePrefabDockIds(wallet: string, ids: string[]): void {
  if (!wallet.trim()) return;
  try {
    localStorage.setItem(walletStorageKey(wallet), JSON.stringify(ids));
  } catch {
    /* quota */
  }
}

export function getPrefabDockDesigns(
  all: readonly DesignWire[],
  wallet: string
): DesignWire[] {
  const saved = loadPrefabDockIds(wallet);
  if (saved === null) return [...all];
  const allowed = new Set(saved);
  return all.filter((d) => allowed.has(d.id));
}

function footprintFilterKey(w: number, d: number): string {
  return `${w}x${d}`;
}

function footprintFilterLabel(w: number, d: number): string {
  return `${w}×${d}`;
}

/** Unique footprint sizes present in the catalog, sorted by area then width. */
export function footprintSizeFilterOptions(
  designs: readonly DesignWire[]
): { key: string; label: string; w: number; d: number }[] {
  const seen = new Map<string, { w: number; d: number }>();
  for (const design of designs) {
    const w = Math.max(1, Math.floor(design.footprintW));
    const d = Math.max(1, Math.floor(design.footprintD));
    const key = footprintFilterKey(w, d);
    if (!seen.has(key)) seen.set(key, { w, d });
  }
  return [...seen.entries()]
    .map(([key, { w, d }]) => ({
      key,
      label: footprintFilterLabel(w, d),
      w,
      d,
    }))
    .sort((a, b) => a.w * a.d - b.w * b.d || a.w - b.w || a.d - b.d);
}

export type PrefabDesignManageAction = "delete" | "toggleVisibility";

export type PrefabDockPickerUi = {
  root: HTMLElement;
  setWallet: (address: string) => void;
  getWallet: () => string;
  open: (opts: {
    designs: readonly DesignWire[];
    applyThumb?: (entries: { id: string; img: HTMLImageElement }[]) => void;
  }) => void;
  refreshCatalog: (designs: readonly DesignWire[]) => void;
  close: () => void;
  isOpen: () => boolean;
  getDockDesigns: (all: readonly DesignWire[]) => DesignWire[];
  onDockSelectionChange: (cb: (() => void) | null) => void;
  onDesignManage: (
    cb: ((action: PrefabDesignManageAction, design: DesignWire) => void) | null
  ) => void;
  onCreatorProfileOpen: (
    cb: ((wallet: string, kind: "self" | "other") => void) | null
  ) => void;
};

export function createPrefabDockPickerUi(): PrefabDockPickerUi {
  let wallet = "";
  let workingIds = new Set<string>();
  let catalogDesigns: readonly DesignWire[] = [];
  let sizeFilterKey = "all";
  let scopeFilter: "all" | "mine" = "all";
  let dockChangeCb: (() => void) | null = null;
  let designManageCb:
    | ((action: PrefabDesignManageAction, design: DesignWire) => void)
    | null = null;
  let creatorProfileCb:
    | ((wallet: string, kind: "self" | "other") => void)
    | null = null;
  let thumbApply: ((entries: { id: string; img: HTMLImageElement }[]) => void) | null =
    null;

  function bindCreatorIdenticon(
    btn: HTMLButtonElement,
    img: HTMLImageElement,
    creatorWallet: string
  ): void {
    const w = creatorWallet.trim();
    if (!w) {
      btn.hidden = true;
      return;
    }
    btn.hidden = false;
    btn.title = walletDisplayName(w);
    img.alt = btn.title;
    img.dataset.address = w;
    void (async (): Promise<void> => {
      try {
        const { identiconDataUrl } = await import("../game/identiconTexture.js");
        const url = await identiconDataUrl(w);
        if (img.dataset.address !== w) return;
        img.src = url;
      } catch {
        if (img.dataset.address === w) btn.hidden = true;
      }
    })();
  }

  const overlay = document.createElement("div");
  overlay.className = "signpost-overlay prefab-picker-overlay";
  overlay.hidden = true;
  overlay.setAttribute("role", "presentation");

  const dialog = document.createElement("div");
  dialog.className = "prefab-picker-overlay__dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "prefab-picker-title");

  dialog.innerHTML = `
    <div class="signpost-overlay__header prefab-picker-overlay__header">
      <div class="prefab-picker-overlay__heading">
        <span class="signpost-overlay__title" id="prefab-picker-title">Prefab library</span>
        <p class="prefab-picker-overlay__subtitle">Choose prefabs for your build menu. Tap to toggle. Right-click your prefabs to manage.</p>
      </div>
      <div class="signpost-overlay__header-actions">
        <button type="button" class="signpost-overlay__btn signpost-overlay__btn--create" data-prefab-picker-done>Done</button>
      </div>
    </div>
    <div class="prefab-picker-overlay__body">
      <div class="prefab-picker-overlay__toolbar" data-prefab-picker-toolbar hidden>
        <div class="prefab-picker-overlay__scope" role="group" aria-label="Show prefabs">
          <button type="button" class="prefab-picker-scope__btn prefab-picker-scope__btn--active" data-prefab-scope-all>All</button>
          <button type="button" class="prefab-picker-scope__btn" data-prefab-scope-mine>Mine</button>
        </div>
        <label class="prefab-picker-overlay__filter-label" for="prefab-picker-size-filter">Size</label>
        <select
          id="prefab-picker-size-filter"
          class="prefab-picker-overlay__filter-select"
          data-prefab-picker-size-filter
          aria-label="Filter by footprint size"
        >
          <option value="all">All</option>
        </select>
      </div>
      <p class="prefab-picker-overlay__empty" data-prefab-picker-empty hidden>No placeable prefabs yet.</p>
      <div class="prefab-picker-overlay__grid" data-prefab-picker-grid></div>
    </div>
  `;

  overlay.appendChild(dialog);

  const cardCtx: WorldContextMenu = createWorldContextMenu({ parent: overlay });

  const doneBtn = dialog.querySelector(
    "[data-prefab-picker-done]"
  ) as HTMLButtonElement;
  const gridEl = dialog.querySelector(
    "[data-prefab-picker-grid]"
  ) as HTMLDivElement;
  const emptyEl = dialog.querySelector(
    "[data-prefab-picker-empty]"
  ) as HTMLParagraphElement;
  const toolbarEl = dialog.querySelector(
    "[data-prefab-picker-toolbar]"
  ) as HTMLDivElement;
  const sizeFilterEl = dialog.querySelector(
    "[data-prefab-picker-size-filter]"
  ) as HTMLSelectElement;
  const scopeAllBtn = dialog.querySelector(
    "[data-prefab-scope-all]"
  ) as HTMLButtonElement;
  const scopeMineBtn = dialog.querySelector(
    "[data-prefab-scope-mine]"
  ) as HTMLButtonElement;

  function syncScopeButtons(): void {
    scopeAllBtn.classList.toggle(
      "prefab-picker-scope__btn--active",
      scopeFilter === "all"
    );
    scopeMineBtn.classList.toggle(
      "prefab-picker-scope__btn--active",
      scopeFilter === "mine"
    );
    scopeAllBtn.setAttribute("aria-pressed", scopeFilter === "all" ? "true" : "false");
    scopeMineBtn.setAttribute("aria-pressed", scopeFilter === "mine" ? "true" : "false");
  }

  function designsForScope(): DesignWire[] {
    if (scopeFilter === "mine") {
      return catalogDesigns.filter((d) => isOwnDesign(d, wallet));
    }
    return [...catalogDesigns];
  }

  function syncSizeFilterOptions(designs: readonly DesignWire[]): void {
    const options = footprintSizeFilterOptions(designs);
    sizeFilterEl.replaceChildren();
    const allOpt = document.createElement("option");
    allOpt.value = "all";
    allOpt.textContent = "All";
    sizeFilterEl.appendChild(allOpt);
    for (const opt of options) {
      const el = document.createElement("option");
      el.value = opt.key;
      el.textContent = opt.label;
      sizeFilterEl.appendChild(el);
    }
    toolbarEl.hidden = designs.length === 0;
    const validKeys = new Set(options.map((o) => o.key));
    if (sizeFilterKey !== "all" && !validKeys.has(sizeFilterKey)) {
      sizeFilterKey = "all";
    }
    sizeFilterEl.value = sizeFilterKey;
  }

  function designsForCurrentFilter(): DesignWire[] {
    const scoped = designsForScope();
    if (sizeFilterKey === "all") return scoped;
    return scoped.filter(
      (d) =>
        footprintFilterKey(
          Math.max(1, Math.floor(d.footprintW)),
          Math.max(1, Math.floor(d.footprintD))
        ) === sizeFilterKey
    );
  }

  function refreshGrid(): void {
    const scoped = designsForScope();
    const filtered = designsForCurrentFilter();
    if (catalogDesigns.length === 0) {
      emptyEl.textContent = "No placeable prefabs yet.";
      emptyEl.hidden = false;
    } else if (scopeFilter === "mine" && scoped.length === 0) {
      emptyEl.textContent = "You have not published any prefabs yet.";
      emptyEl.hidden = false;
    } else if (filtered.length === 0) {
      const opt = footprintSizeFilterOptions(scoped).find(
        (o) => o.key === sizeFilterKey
      );
      emptyEl.textContent = opt
        ? `No prefabs with footprint ${opt.label}.`
        : "No prefabs in this filter.";
      emptyEl.hidden = false;
    } else {
      emptyEl.hidden = true;
    }
    renderGrid(filtered);
  }

  function persistAndClose(): void {
    cardCtx.close();
    if (wallet.trim()) {
      savePrefabDockIds(wallet, [...workingIds]);
    }
    overlay.hidden = true;
    thumbApply = null;
    dockChangeCb?.();
  }

  function syncCardSelected(card: HTMLElement, selected: boolean): void {
    card.classList.toggle("prefab-picker-card--selected", selected);
    card.setAttribute("aria-pressed", selected ? "true" : "false");
    const check = card.querySelector(".prefab-picker-card__check");
    if (check) check.hidden = !selected;
  }

  function renderGrid(designs: readonly DesignWire[]): void {
    gridEl.replaceChildren();
    const thumbRows: { id: string; img: HTMLImageElement }[] = [];

    for (const d of designs) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "prefab-picker-card";
      card.dataset.designId = d.id;
      const selected = workingIds.has(d.id);
      if (selected) card.classList.add("prefab-picker-card--selected");
      card.setAttribute("aria-pressed", selected ? "true" : "false");
      card.setAttribute("aria-label", `${d.name}, ${d.visibility}`);

      const check = document.createElement("span");
      check.className = "prefab-picker-card__check";
      check.setAttribute("aria-hidden", "true");
      check.textContent = "✓";
      check.hidden = !selected;
      card.appendChild(check);

      const wrap = document.createElement("span");
      wrap.className = "prefab-picker-card__preview";
      const img = document.createElement("img");
      img.className = "prefab-picker-card__thumb";
      img.width = 128;
      img.height = 128;
      img.alt = "";
      img.draggable = false;
      img.decoding = "async";
      wrap.appendChild(img);
      card.appendChild(wrap);

      const meta = document.createElement("div");
      meta.className = "prefab-picker-card__meta";
      const metaText = document.createElement("div");
      metaText.className = "prefab-picker-card__meta-text";
      const nameEl = document.createElement("span");
      nameEl.className = "prefab-picker-card__name";
      nameEl.textContent = d.name;
      const visEl = document.createElement("span");
      visEl.className = `prefab-picker-card__vis prefab-picker-card__vis--${d.visibility}`;
      visEl.textContent = designVisibilityLabel(d.visibility);
      metaText.append(nameEl, visEl);
      const creatorBtn = document.createElement("button");
      creatorBtn.type = "button";
      creatorBtn.className = "prefab-picker-card__creator";
      creatorBtn.setAttribute(
        "aria-label",
        `View profile of ${walletDisplayName(d.creatorWallet)}`
      );
      const creatorImg = document.createElement("img");
      creatorImg.className = "prefab-picker-card__creator-img";
      creatorImg.width = 22;
      creatorImg.height = 22;
      creatorImg.decoding = "async";
      creatorImg.draggable = false;
      creatorBtn.appendChild(creatorImg);
      bindCreatorIdenticon(creatorBtn, creatorImg, d.creatorWallet);
      creatorBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const w = d.creatorWallet.trim();
        if (!w || !creatorProfileCb) return;
        creatorProfileCb(
          w,
          isOwnDesign(d, wallet) ? "self" : "other"
        );
      });
      meta.append(metaText, creatorBtn);
      card.appendChild(meta);

      card.addEventListener("click", (e) => {
        e.preventDefault();
        if (workingIds.has(d.id)) {
          workingIds.delete(d.id);
        } else {
          workingIds.add(d.id);
        }
        syncCardSelected(card, workingIds.has(d.id));
      });

      if (isOwnDesign(d, wallet)) {
        card.classList.add("prefab-picker-card--own");
        card.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const vis = d.visibility === "public" ? "public" : "private";
          cardCtx.open({
            kind: "items",
            clientX: e.clientX,
            clientY: e.clientY,
            ariaLabel: `Prefab: ${d.name}`,
            items: [
              {
                id: "visibility",
                label: vis === "public" ? "Make private" : "Make public",
                onSelect: () => designManageCb?.("toggleVisibility", d),
              },
              {
                id: "delete",
                label: "Delete prefab",
                destructive: true,
                onSelect: () => designManageCb?.("delete", d),
              },
            ],
          });
        });
      }

      gridEl.appendChild(card);
      thumbRows.push({ id: d.id, img });
    }

    thumbApply?.(thumbRows);
  }

  function openWorkingSet(designs: readonly DesignWire[]): void {
    const saved = loadPrefabDockIds(wallet);
    if (saved === null) {
      workingIds = new Set(designs.map((d) => d.id));
    } else {
      const valid = new Set(designs.map((d) => d.id));
      workingIds = new Set(saved.filter((id) => valid.has(id)));
    }
  }

  scopeAllBtn.addEventListener("click", (e) => {
    e.preventDefault();
    if (scopeFilter === "all") return;
    scopeFilter = "all";
    syncScopeButtons();
    refreshGrid();
  });

  scopeMineBtn.addEventListener("click", (e) => {
    e.preventDefault();
    if (scopeFilter === "mine") return;
    scopeFilter = "mine";
    syncScopeButtons();
    refreshGrid();
  });

  sizeFilterEl.addEventListener("change", () => {
    sizeFilterKey = sizeFilterEl.value;
    refreshGrid();
  });

  doneBtn.addEventListener("click", (e) => {
    e.preventDefault();
    persistAndClose();
  });

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) persistAndClose();
  });

  dialog.addEventListener("click", (e) => e.stopPropagation());

  window.addEventListener(
    "keydown",
    (e) => {
      if (overlay.hidden || e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      persistAndClose();
    },
    true
  );

  return {
    root: overlay,
    setWallet(address: string) {
      wallet = address.replace(/\s+/g, "").trim();
    },
    getWallet: () => wallet,
    open(opts) {
      thumbApply = opts.applyThumb ?? null;
      catalogDesigns = opts.designs;
      sizeFilterKey = "all";
      scopeFilter = "all";
      syncScopeButtons();
      openWorkingSet(opts.designs);
      syncSizeFilterOptions(opts.designs);
      refreshGrid();
      overlay.hidden = false;
      doneBtn.focus();
    },
    refreshCatalog(designs) {
      if (overlay.hidden) return;
      catalogDesigns = designs;
      const valid = new Set(designs.map((d) => d.id));
      for (const id of workingIds) {
        if (!valid.has(id)) workingIds.delete(id);
      }
      syncSizeFilterOptions(designsForScope());
      refreshGrid();
    },
    close() {
      cardCtx.close();
      overlay.hidden = true;
      thumbApply = null;
      catalogDesigns = [];
    },
    isOpen: () => !overlay.hidden,
    getDockDesigns(all) {
      return getPrefabDockDesigns(all, wallet);
    },
    onDockSelectionChange(cb) {
      dockChangeCb = cb;
    },
    onDesignManage(cb) {
      designManageCb = cb;
    },
    onCreatorProfileOpen(cb) {
      creatorProfileCb = cb;
    },
  };
}
