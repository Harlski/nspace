/**
 * In-world UI for object prefab save (drag bbox) and place (stamp catalog).
 */
import type { DesignWire } from "../net/ws.js";
import { walletDisplayName } from "../walletDisplayName.js";

export type PrefabBbox = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export type PrefabCaptureStats = {
  footprintW: number;
  footprintD: number;
  tileCount: number;
};

export type PrefabPublishPayload = {
  bbox: PrefabBbox;
  name: string;
  description: string;
  visibility: "private" | "unlisted" | "public";
  priceNim: string;
};

export type PrefabAuthoringMode = "save" | "place";

export type ObjectPrefabAuthoringUi = {
  root: HTMLElement;
  dockPanel: HTMLElement;
  statsEl: HTMLElement;
  overlay: HTMLElement;
  setPrefabToolActive: (active: boolean) => void;
  setAllowPublish: (allow: boolean) => void;
  setMode: (mode: PrefabAuthoringMode) => void;
  getMode: () => PrefabAuthoringMode;
  onModeChange: (cb: (mode: PrefabAuthoringMode) => void) => void;
  setSaveModeActive: (active: boolean) => void;
  isSaveModeActive: () => boolean;
  setPlaceModeActive: (active: boolean) => void;
  isPlaceModeActive: () => boolean;
  setPlaceableDesigns: (designs: DesignWire[]) => void;
  getPlaceableDesigns: () => readonly DesignWire[];
  selectDesign: (designId: string | null) => void;
  getSelectedDesign: () => DesignWire | null;
  getSelectedDesignId: () => string | null;
  getAllowPublish: () => boolean;
  onDesignChange: (cb: (design: DesignWire | null) => void) => void;
  onCatalogChange: (cb: (() => void) | null) => void;
  updateStats: (stats: PrefabCaptureStats | null) => void;
  openPublishModal: (
    bbox: PrefabBbox,
    onSubmit: (payload: PrefabPublishPayload) => void
  ) => void;
  closePublishModal: () => void;
  setPublishBusy: (busy: boolean) => void;
  showPublishError: (message: string) => void;
  setMobilePresetSize: (size: 3 | 4 | 6) => void;
  getMobilePresetSize: () => 3 | 4 | 6;
};

export function createObjectPrefabAuthoringUi(): ObjectPrefabAuthoringUi {
  let prefabToolActive = false;
  let allowPublish = false;
  let mode: PrefabAuthoringMode = "place";
  let mobilePresetSize: 3 | 4 | 6 = 3;
  let pendingSubmit: ((payload: PrefabPublishPayload) => void) | null = null;
  let pendingBbox: PrefabBbox | null = null;
  let placeableDesigns: DesignWire[] = [];
  let selectedDesignId: string | null = null;
  let modeChangeCb: ((mode: PrefabAuthoringMode) => void) | null = null;
  let designChangeCb: ((design: DesignWire | null) => void) | null = null;
  let catalogChangeCb: (() => void) | null = null;

  const dockPanel = document.createElement("div");
  dockPanel.className = "hud-prefab-dock";
  dockPanel.hidden = true;
  dockPanel.setAttribute("role", "group");
  dockPanel.setAttribute("aria-label", "Object prefab");

  const modeRow = document.createElement("div");
  modeRow.className = "hud-prefab-dock__mode";
  const saveModeBtn = document.createElement("button");
  saveModeBtn.type = "button";
  saveModeBtn.className = "hud-prefab-dock__mode-btn";
  saveModeBtn.textContent = "Save";
  const placeModeBtn = document.createElement("button");
  placeModeBtn.type = "button";
  placeModeBtn.className = "hud-prefab-dock__mode-btn hud-prefab-dock__mode-btn--active";
  placeModeBtn.textContent = "Place";
  modeRow.appendChild(saveModeBtn);
  modeRow.appendChild(placeModeBtn);
  modeRow.hidden = true;

  const saveSection = document.createElement("div");
  saveSection.className = "hud-prefab-save";
  saveSection.hidden = true;

  const saveHint = document.createElement("p");
  saveHint.className = "hud-prefab-save__hint";
  saveHint.textContent =
    "Click and drag on the floor to capture the area you want as a prefab.";

  const statsEl = document.createElement("p");
  statsEl.className = "hud-prefab-save__stats";
  statsEl.textContent = "";

  if (window.matchMedia("(pointer: coarse)").matches) {
    saveHint.textContent =
      "Press on the floor, then drag to the opposite corner to capture your prefab area.";
  }

  saveSection.appendChild(saveHint);
  saveSection.appendChild(statsEl);

  const placeMeta = document.createElement("div");
  placeMeta.className = "hud-prefab-place-meta";
  placeMeta.hidden = true;
  const creatorRow = document.createElement("div");
  creatorRow.className = "hud-prefab-place-meta__creator";
  const creatorLabel = document.createElement("span");
  creatorLabel.className = "hud-prefab-place-meta__creator-label";
  creatorLabel.textContent = "Created by:";
  const creatorIdenticon = document.createElement("img");
  creatorIdenticon.className = "hud-prefab-place-meta__identicon";
  creatorIdenticon.alt = "";
  creatorIdenticon.width = 18;
  creatorIdenticon.height = 18;
  creatorIdenticon.decoding = "async";
  creatorIdenticon.draggable = false;
  creatorIdenticon.hidden = true;
  const creatorWalletEl = document.createElement("span");
  creatorWalletEl.className = "hud-prefab-place-meta__wallet";
  creatorRow.append(creatorLabel, creatorIdenticon, creatorWalletEl);
  placeMeta.appendChild(creatorRow);

  const placeSection = document.createElement("div");
  placeSection.className = "hud-prefab-place";
  const designList = document.createElement("div");
  designList.className = "hud-prefab-place__list";
  designList.setAttribute("role", "listbox");
  designList.setAttribute("aria-label", "Prefabs you can place");
  const designEmpty = document.createElement("p");
  designEmpty.className = "hud-prefab-place__empty";
  designEmpty.textContent = "No prefabs yet.";
  designEmpty.hidden = true;
  placeSection.appendChild(designList);
  placeSection.appendChild(designEmpty);

  dockPanel.appendChild(modeRow);
  dockPanel.appendChild(saveSection);
  dockPanel.appendChild(placeMeta);
  dockPanel.appendChild(placeSection);

  function syncPlaceMeta(): void {
    const saveOn = mode === "save";
    const design = selectedDesign();
    placeMeta.hidden = saveOn || !design;
    if (!design || saveOn) {
      creatorIdenticon.hidden = true;
      creatorIdenticon.removeAttribute("src");
      creatorIdenticon.removeAttribute("data-address");
      creatorWalletEl.textContent = "";
      return;
    }
    const wallet = design.creatorWallet.trim();
    creatorWalletEl.textContent = walletDisplayName(wallet);
    creatorWalletEl.title = wallet;
    creatorIdenticon.hidden = false;
    creatorIdenticon.dataset.address = wallet;
    void (async (): Promise<void> => {
      try {
        const { identiconDataUrl } = await import("../game/identiconTexture.js");
        const url = await identiconDataUrl(wallet);
        if (creatorIdenticon.dataset.address !== wallet) return;
        creatorIdenticon.src = url;
      } catch {
        if (creatorIdenticon.dataset.address === wallet) {
          creatorIdenticon.hidden = true;
        }
      }
    })();
  }

  function selectedDesign(): DesignWire | null {
    if (!selectedDesignId) return null;
    return placeableDesigns.find((d) => d.id === selectedDesignId) ?? null;
  }

  function syncDesignActiveStates(): void {
    for (const el of designList.querySelectorAll(".hud-prefab-place__item")) {
      const on =
        (el as HTMLElement).dataset.designId === selectedDesignId;
      el.classList.toggle("hud-prefab-place__item--active", on);
      if (on) el.setAttribute("aria-selected", "true");
      else el.removeAttribute("aria-selected");
    }
  }

  function syncModeChrome(): void {
    const saveOn = mode === "save";
    saveModeBtn.classList.toggle("hud-prefab-dock__mode-btn--active", saveOn);
    placeModeBtn.classList.toggle("hud-prefab-dock__mode-btn--active", !saveOn);
    saveSection.hidden = !saveOn;
    placeSection.hidden = true;
    saveModeBtn.hidden = !allowPublish;
    if (!allowPublish && mode === "save") {
      mode = "place";
      saveSection.hidden = true;
      placeSection.hidden = false;
    }
    syncPlaceMeta();
  }

  function emitMode(): void {
    syncModeChrome();
    modeChangeCb?.(mode);
    catalogChangeCb?.();
  }

  function emitDesign(): void {
    syncPlaceMeta();
    designChangeCb?.(selectedDesign());
  }

  function rebuildDesignList(): void {
    const prev = selectedDesignId;
    designList.replaceChildren();
    if (placeableDesigns.length === 0) {
      selectedDesignId = null;
      designEmpty.hidden = false;
      designList.hidden = true;
      emitDesign();
      return;
    }
    designEmpty.hidden = true;
    designList.hidden = false;
    for (const d of placeableDesigns) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "hud-prefab-place__item";
      btn.dataset.designId = d.id;
      btn.setAttribute("role", "option");
      const price = d.priceLuna === "0" ? "free" : `${d.priceLuna} luna`;
      btn.title = `${d.name} · ${d.footprintW}×${d.footprintD} · ${price}`;
      btn.textContent = d.name;
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectedDesignId = d.id;
        for (const el of designList.querySelectorAll(".hud-prefab-place__item")) {
          el.classList.toggle(
            "hud-prefab-place__item--active",
            (el as HTMLElement).dataset.designId === d.id
          );
        }
        emitDesign();
      });
      designList.appendChild(btn);
    }
    const keep = prev && placeableDesigns.some((d) => d.id === prev);
    selectedDesignId = keep ? prev! : placeableDesigns[0]!.id;
    syncDesignActiveStates();
    emitDesign();
    catalogChangeCb?.();
  }

  saveModeBtn.addEventListener("click", (e) => {
    e.preventDefault();
    if (!allowPublish) return;
    mode = "save";
    emitMode();
  });

  placeModeBtn.addEventListener("click", (e) => {
    e.preventDefault();
    mode = "place";
    emitMode();
  });

  const overlay = document.createElement("div");
  overlay.className = "signpost-overlay prefab-publish-overlay";
  overlay.hidden = true;

  const dialog = document.createElement("div");
  dialog.className = "signpost-overlay__dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.innerHTML = `
    <div class="signpost-overlay__header">
      <span class="signpost-overlay__title">Publish object</span>
      <div class="signpost-overlay__header-actions">
        <button type="button" class="signpost-overlay__btn signpost-overlay__btn--cancel" data-prefab-cancel>Cancel</button>
        <button type="button" class="signpost-overlay__btn signpost-overlay__btn--create" data-prefab-publish>Publish</button>
      </div>
    </div>
    <div class="signpost-overlay__body">
      <label class="signpost-overlay__label">Name</label>
      <input type="text" class="prefab-publish-overlay__input" data-prefab-name maxlength="64" placeholder="House, rocks, arch…" />
      <label class="signpost-overlay__label">Description (optional)</label>
      <textarea class="signpost-overlay__textarea prefab-publish-overlay__textarea" data-prefab-desc maxlength="256" rows="2"></textarea>
      <label class="signpost-overlay__label">Visibility</label>
      <select class="prefab-publish-overlay__select" data-prefab-visibility>
        <option value="private">Private</option>
        <option value="unlisted">Unlisted</option>
        <option value="public">Public</option>
      </select>
      <p class="prefab-publish-overlay__error" data-prefab-error hidden></p>
    </div>
  `;
  overlay.appendChild(dialog);

  const nameInput = dialog.querySelector(
    "[data-prefab-name]"
  ) as HTMLInputElement;
  const descInput = dialog.querySelector(
    "[data-prefab-desc]"
  ) as HTMLTextAreaElement;
  const visSelect = dialog.querySelector(
    "[data-prefab-visibility]"
  ) as HTMLSelectElement;
  const errEl = dialog.querySelector(
    "[data-prefab-error]"
  ) as HTMLParagraphElement;
  const cancelBtn = dialog.querySelector(
    "[data-prefab-cancel]"
  ) as HTMLButtonElement;
  const publishBtn = dialog.querySelector(
    "[data-prefab-publish]"
  ) as HTMLButtonElement;

  function closePublishModal(): void {
    overlay.hidden = true;
    pendingSubmit = null;
    pendingBbox = null;
    errEl.hidden = true;
    publishBtn.disabled = false;
  }

  cancelBtn.addEventListener("click", (e) => {
    e.preventDefault();
    closePublishModal();
  });

  publishBtn.addEventListener("click", (e) => {
    e.preventDefault();
    if (!pendingSubmit || !pendingBbox) return;
    const name = nameInput.value.trim();
    if (!name) {
      errEl.textContent = "Name is required.";
      errEl.hidden = false;
      return;
    }
    errEl.hidden = true;
    pendingSubmit({
      bbox: pendingBbox,
      name,
      description: descInput.value.trim(),
      visibility: visSelect.value as "private" | "unlisted" | "public",
      priceNim: "0",
    });
  });

  const root = document.createElement("div");
  root.className = "hud-prefab-authoring-root";
  root.appendChild(overlay);

  syncModeChrome();

  return {
    root,
    dockPanel,
    statsEl,
    overlay,
    setPrefabToolActive(active: boolean) {
      prefabToolActive = active;
      dockPanel.hidden = !active;
      if (!active) closePublishModal();
    },
    setAllowPublish(allow: boolean) {
      allowPublish = allow;
      if (allow && mode === "save") {
        /* keep */
      } else if (!allow && mode === "save") {
        mode = "place";
      }
      syncModeChrome();
    },
    setMode(next: PrefabAuthoringMode) {
      if (next === "save" && !allowPublish) {
        mode = "place";
      } else {
        mode = next;
      }
      emitMode();
    },
    getMode: () => mode,
    onModeChange(cb) {
      modeChangeCb = cb;
    },
    setSaveModeActive(active: boolean) {
      if (active) this.setMode("save");
      else if (mode === "save") this.setMode("place");
    },
    isSaveModeActive: () => prefabToolActive && mode === "save",
    setPlaceModeActive(active: boolean) {
      if (active) this.setMode("place");
      else if (mode === "place" && allowPublish) this.setMode("save");
    },
    isPlaceModeActive: () => prefabToolActive && mode === "place",
    setPlaceableDesigns(designs: DesignWire[]) {
      placeableDesigns = designs.filter((d) => d.kind === "object");
      rebuildDesignList();
    },
    getPlaceableDesigns: () => placeableDesigns,
    selectDesign(designId: string | null) {
      if (designId && !placeableDesigns.some((d) => d.id === designId)) {
        return;
      }
      if (placeableDesigns.length === 0) {
        selectedDesignId = null;
      } else {
        selectedDesignId = designId ?? placeableDesigns[0]!.id;
      }
      syncDesignActiveStates();
      emitDesign();
      catalogChangeCb?.();
    },
    getSelectedDesign: selectedDesign,
    getSelectedDesignId: () => selectedDesignId,
    getAllowPublish: () => allowPublish,
    onDesignChange(cb) {
      designChangeCb = cb;
    },
    onCatalogChange(cb) {
      catalogChangeCb = cb;
    },
    updateStats(stats: PrefabCaptureStats | null) {
      if (!stats) {
        statsEl.textContent = "";
        return;
      }
      statsEl.textContent = `${stats.footprintW}×${stats.footprintD} · ${stats.tileCount} tiles`;
    },
    openPublishModal(bbox, onSubmit) {
      pendingBbox = bbox;
      pendingSubmit = onSubmit;
      nameInput.value = "";
      descInput.value = "";
      visSelect.value = "private";
      errEl.hidden = true;
      overlay.hidden = false;
      nameInput.focus();
    },
    closePublishModal,
    setPublishBusy(busy: boolean) {
      publishBtn.disabled = busy;
      publishBtn.textContent = busy ? "Publishing…" : "Publish";
    },
    showPublishError(message: string) {
      errEl.textContent = message;
      errEl.hidden = false;
      publishBtn.disabled = false;
      publishBtn.textContent = "Publish";
    },
    setMobilePresetSize(size: 3 | 4 | 6) {
      mobilePresetSize = size;
    },
    getMobilePresetSize: () => mobilePresetSize,
  };
}

export function nimToLunaString(nim: string): string {
  const trimmed = nim.trim();
  if (!trimmed || trimmed === "0") return "0";
  const parts = trimmed.split(".");
  const whole = parts[0] ?? "0";
  const frac = (parts[1] ?? "").padEnd(4, "0").slice(0, 4);
  const luna = BigInt(whole) * 100000n + BigInt(frac || "0");
  return luna.toString();
}
