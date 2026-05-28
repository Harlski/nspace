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
  previewDataUrl: string | null;
};

export type PrefabPublishPayload = {
  bbox: PrefabBbox;
  name: string;
  description: string;
  visibility: "private" | "public";
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
  /** Live capture thumbnail in the build preview satellite (above the dock). */
  bindSavePreviewHost: (host: HTMLElement, img: HTMLImageElement) => void;
  onSaveCapturePreviewChange: (cb: (() => void) | null) => void;
  openPublishModal: (
    bbox: PrefabBbox,
    previewDataUrl: string | null,
    onSubmit: (payload: PrefabPublishPayload) => void
  ) => void;
  closePublishModal: () => void;
  onPublishModalClose: (cb: (() => void) | null) => void;
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
  let publishModalCloseCb: (() => void) | null = null;
  let saveCapturePreviewChangeCb: (() => void) | null = null;

  const dockPanel = document.createElement("div");
  dockPanel.className = "hud-prefab-dock";
  dockPanel.hidden = true;
  dockPanel.setAttribute("role", "group");
  dockPanel.setAttribute("aria-label", "Object prefab");

  const saveSection = document.createElement("div");
  saveSection.className = "hud-prefab-save";
  saveSection.hidden = true;

  const saveHint = document.createElement("p");
  saveHint.className = "hud-prefab-save__hint";
  saveHint.textContent =
    "Click and drag on the floor to capture the area you want as a prefab.";

  let savePreviewHost: HTMLElement | null = null;
  let savePreviewImg: HTMLImageElement | null = null;

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
    saveSection.hidden = true;
    placeSection.hidden = true;
    if (!allowPublish && mode === "save") {
      mode = "place";
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

  const overlay = document.createElement("div");
  overlay.className = "prefab-publish-overlay";
  overlay.hidden = true;

  const backdrop = document.createElement("button");
  backdrop.type = "button";
  backdrop.className = "prefab-publish-overlay__backdrop";
  backdrop.setAttribute("aria-label", "Dismiss");

  const dialog = document.createElement("div");
  dialog.className = "prefab-publish-overlay__dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "prefab-publish-title");
  dialog.innerHTML = `
    <button type="button" class="prefab-publish-overlay__close" data-prefab-cancel aria-label="Close">×</button>
    <h2 class="prefab-publish-overlay__title" id="prefab-publish-title">Save prefab</h2>
    <div class="prefab-publish-overlay__main">
      <div class="prefab-publish-overlay__aside">
        <div class="prefab-publish-overlay__preview" data-prefab-publish-preview>
          <img class="prefab-publish-overlay__preview-img" data-prefab-publish-preview-img alt="" width="96" height="96" decoding="async" draggable="false" />
          <p class="prefab-publish-overlay__preview-empty" data-prefab-publish-preview-empty hidden>No blocks</p>
        </div>
        <div class="prefab-publish-overlay__vis" role="group" aria-label="Visibility">
          <button type="button" class="prefab-publish-overlay__vis-btn prefab-publish-overlay__vis-btn--active" data-prefab-vis="private" aria-pressed="true">Private</button>
          <button type="button" class="prefab-publish-overlay__vis-btn" data-prefab-vis="public" aria-pressed="false">Public</button>
        </div>
      </div>
      <div class="prefab-publish-overlay__form">
        <label class="prefab-publish-overlay__label" for="prefab-publish-name">Name</label>
        <input id="prefab-publish-name" type="text" class="prefab-publish-overlay__input" data-prefab-name maxlength="12" placeholder="My rocks" autocomplete="off" />
        <label class="prefab-publish-overlay__label" for="prefab-publish-desc">Description</label>
        <textarea id="prefab-publish-desc" class="prefab-publish-overlay__textarea" data-prefab-desc maxlength="256" rows="2" placeholder="Optional"></textarea>
        <p class="prefab-publish-overlay__error" data-prefab-error hidden></p>
      </div>
    </div>
    <div class="prefab-publish-overlay__footer">
      <button type="button" class="prefab-publish-overlay__btn prefab-publish-overlay__btn--cancel" data-prefab-cancel>Cancel</button>
      <button type="button" class="prefab-publish-overlay__btn prefab-publish-overlay__btn--publish" data-prefab-publish>Save</button>
    </div>
  `;
  overlay.append(backdrop, dialog);

  const nameInput = dialog.querySelector(
    "[data-prefab-name]"
  ) as HTMLInputElement;
  const descInput = dialog.querySelector(
    "[data-prefab-desc]"
  ) as HTMLTextAreaElement;
  const visPrivateBtn = dialog.querySelector(
    '[data-prefab-vis="private"]'
  ) as HTMLButtonElement;
  const visPublicBtn = dialog.querySelector(
    '[data-prefab-vis="public"]'
  ) as HTMLButtonElement;
  let publishVisibility: "private" | "public" = "private";

  function syncPublishVisibilityUi(): void {
    const priv = publishVisibility === "private";
    visPrivateBtn.classList.toggle(
      "prefab-publish-overlay__vis-btn--active",
      priv
    );
    visPublicBtn.classList.toggle(
      "prefab-publish-overlay__vis-btn--active",
      !priv
    );
    visPrivateBtn.setAttribute("aria-pressed", priv ? "true" : "false");
    visPublicBtn.setAttribute("aria-pressed", priv ? "false" : "true");
  }

  function setPublishVisibility(next: "private" | "public"): void {
    publishVisibility = next;
    syncPublishVisibilityUi();
  }

  visPrivateBtn.addEventListener("click", (e) => {
    e.preventDefault();
    setPublishVisibility("private");
  });
  visPublicBtn.addEventListener("click", (e) => {
    e.preventDefault();
    setPublishVisibility("public");
  });

  const errEl = dialog.querySelector(
    "[data-prefab-error]"
  ) as HTMLParagraphElement;
  const publishBtn = dialog.querySelector(
    "[data-prefab-publish]"
  ) as HTMLButtonElement;
  const publishPreviewWrap = dialog.querySelector(
    "[data-prefab-publish-preview]"
  ) as HTMLDivElement;
  const publishPreviewImg = dialog.querySelector(
    "[data-prefab-publish-preview-img]"
  ) as HTMLImageElement;
  const publishPreviewEmpty = dialog.querySelector(
    "[data-prefab-publish-preview-empty]"
  ) as HTMLParagraphElement;

  function setCapturePreview(
    previewDataUrl: string | null,
    opts?: { inModal?: boolean }
  ): void {
    const inModal = opts?.inModal ?? false;
    if (inModal) {
      publishPreviewWrap.hidden = false;
      if (previewDataUrl) {
        publishPreviewImg.src = previewDataUrl;
        publishPreviewImg.hidden = false;
        publishPreviewEmpty.hidden = true;
      } else {
        publishPreviewImg.removeAttribute("src");
        publishPreviewImg.hidden = true;
        publishPreviewEmpty.hidden = false;
      }
      return;
    }
    if (savePreviewHost && savePreviewImg) {
      if (previewDataUrl) {
        savePreviewImg.src = previewDataUrl;
        savePreviewHost.hidden = false;
      } else {
        savePreviewImg.removeAttribute("src");
        savePreviewHost.hidden = true;
      }
    }
    if (!inModal) {
      saveCapturePreviewChangeCb?.();
    }
  }

  function closePublishModal(): void {
    overlay.hidden = true;
    pendingSubmit = null;
    pendingBbox = null;
    errEl.hidden = true;
    publishBtn.disabled = false;
    publishPreviewWrap.hidden = true;
    publishPreviewImg.removeAttribute("src");
    publishModalCloseCb?.();
  }

  for (const el of dialog.querySelectorAll("[data-prefab-cancel]")) {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      closePublishModal();
    });
  }
  backdrop.addEventListener("click", (e) => {
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
    if (name.length > 12) {
      errEl.textContent = "Name must be 12 characters or fewer.";
      errEl.hidden = false;
      return;
    }
    errEl.hidden = true;
    pendingSubmit({
      bbox: pendingBbox,
      name,
      description: descInput.value.trim(),
      visibility: publishVisibility,
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
      dockPanel.hidden = true;
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
    bindSavePreviewHost(host, img) {
      savePreviewHost = host;
      savePreviewImg = img;
    },
    onSaveCapturePreviewChange(cb) {
      saveCapturePreviewChangeCb = cb;
    },
    updateStats(stats: PrefabCaptureStats | null) {
      if (!stats) {
        statsEl.textContent = "";
        setCapturePreview(null);
        return;
      }
      statsEl.textContent = `${stats.footprintW}×${stats.footprintD} · ${stats.tileCount} tiles`;
      setCapturePreview(stats.previewDataUrl);
    },
    openPublishModal(bbox, previewDataUrl, onSubmit) {
      pendingBbox = bbox;
      pendingSubmit = onSubmit;
      nameInput.value = "";
      descInput.value = "";
      setPublishVisibility("private");
      errEl.hidden = true;
      setCapturePreview(previewDataUrl, { inModal: true });
      overlay.hidden = false;
    },
    closePublishModal,
    onPublishModalClose(cb) {
      publishModalCloseCb = cb;
    },
    setPublishBusy(busy: boolean) {
      publishBtn.disabled = busy;
      publishBtn.textContent = busy ? "Saving…" : "Save";
    },
    showPublishError(message: string) {
      errEl.textContent = message;
      errEl.hidden = false;
      publishBtn.disabled = false;
      publishBtn.textContent = "Save";
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
