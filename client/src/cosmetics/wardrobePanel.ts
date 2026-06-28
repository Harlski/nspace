import {
  createUnlockIntent,
  fetchWardrobe,
  syncUnlockPayment,
  updateLoadoutSlot,
  type ShopEntry,
  type WardrobeResponse,
} from "./api.js";
import { loadCachedSession } from "../auth/session.js";
import {
  loadoutSkuKey,
  PASSIVE_SLOTS,
  presetSwatchClass,
  SLOT_LABELS,
  type PassiveSlotId,
} from "./presetSwatch.js";

function isPassiveSlotId(slot: string): slot is PassiveSlotId {
  return (PASSIVE_SLOTS as readonly string[]).includes(slot);
}

function nimPriceLabel(priceLuna: string): string {
  const n = Number(priceLuna);
  if (!Number.isFinite(n) || n <= 0) return "Free";
  return `${(n / 100_000).toFixed(2)} NIM`;
}


function humanizePresetId(presetId: string): string {
  return presetId
    .split("-")
    .map((part) => (part ? part[0]!.toUpperCase() + part.slice(1) : part))
    .join(" ");
}

type PreviewHandlers = {
  onPreviewSlot?: (slot: PassiveSlotId, presetId: string | null | undefined) => void;
  onLoadoutChanged?: () => void;
  onPreviewCanvas?: (canvas: HTMLCanvasElement | null, wallet: string) => void;
  onPreviewCosmeticsChange?: (
    presets: Partial<Record<PassiveSlotId, string | null>>
  ) => void;
  /** Navigate to the in-world cosmetic shop (Shaper room). */
  onVisitCosmeticShop?: () => void;
  /** Hide the panel's own Wardrobe/Shop tab strip (the host drives view via `setView`). */
  hideTabs?: boolean;
};

type SlotRow = {
  cosmeticSku: string | null;
  presetId: string | null;
  displayName: string;
  owned: boolean;
  shopEntry?: ShopEntry;
};

export function mountWardrobePanel(
  container: HTMLElement,
  walletAddress: string,
  opts: PreviewHandlers = {}
): {
  refresh: () => Promise<void>;
  revertAllPreview: () => void;
  disposePreviewCanvas: () => void;
  setView: (next: "wardrobe" | "shop") => void;
} {
  container.classList.add("wardrobe-panel");
  const tabs = document.createElement("div");
  tabs.className = "wardrobe-panel__tabs";
  const wardrobeTab = document.createElement("button");
  wardrobeTab.type = "button";
  wardrobeTab.className = "wardrobe-panel__tab is-active";
  wardrobeTab.textContent = "Wardrobe";
  const shopTab = document.createElement("button");
  shopTab.type = "button";
  shopTab.className = "wardrobe-panel__tab";
  shopTab.textContent = "Shop";
  tabs.append(wardrobeTab, shopTab);

  const body = document.createElement("div");
  body.className = "wardrobe-panel__body";
  const note = document.createElement("p");
  note.className = "wardrobe-panel__note";
  note.hidden = true;
  container.replaceChildren(...(opts.hideTabs ? [body, note] : [tabs, body, note]));

  let data: WardrobeResponse | null = null;
  let view: "wardrobe" | "shop" = "wardrobe";
  let openSlot: PassiveSlotId | null = null;
  /** Per-slot preview override; missing key = use saved loadout. */
  const slotPreview = new Map<PassiveSlotId, string | null>();
  let selectedRowSku: string | null = null;
  let previewCanvas: HTMLCanvasElement | null = null;
  // The avatar preview is an expensive WebGL canvas. We keep the SAME element across wardrobe
  // re-renders (e.g. opening/closing a slot dropdown) so its renderer/scene is never torn down
  // and rebuilt — re-parenting a canvas in the DOM preserves its WebGL context, so there is no
  // visible re-render flicker. It is only disposed when leaving the Wardrobe tab or unmounting.
  let dollWrap: HTMLDivElement | null = null;

  function disposePreviewCanvas(): void {
    if (!previewCanvas) return;
    opts.onPreviewCanvas?.(null, walletAddress);
    previewCanvas = null;
    dollWrap = null;
  }

  function syncPreviewWebGl(): void {
    opts.onPreviewCosmeticsChange?.(effectivePresets());
  }

  function showNote(text: string, isErr = false): void {
    note.hidden = false;
    note.textContent = text;
    note.classList.toggle("wardrobe-panel__note--err", isErr);
  }

  function shopBySku(): Map<string, ShopEntry> {
    return new Map((data?.shop ?? []).map((s) => [s.cosmeticSku, s]));
  }

  function presetForLoadoutSlot(slot: PassiveSlotId): string | null {
    if (!data) return null;
    const sku = data.loadout[loadoutSkuKey(slot)];
    if (!sku) return null;
    return shopBySku().get(sku)?.presetId ?? null;
  }

  function effectivePreset(slot: PassiveSlotId): string | null {
    if (slotPreview.has(slot)) return slotPreview.get(slot) ?? null;
    return presetForLoadoutSlot(slot);
  }

  function effectivePresets(): Partial<Record<PassiveSlotId, string | null>> {
    const out: Partial<Record<PassiveSlotId, string | null>> = {};
    for (const slot of PASSIVE_SLOTS) out[slot] = effectivePreset(slot);
    return out;
  }

  function revertSlotPreview(slot: PassiveSlotId): void {
    if (!slotPreview.has(slot)) return;
    slotPreview.delete(slot);
    opts.onPreviewSlot?.(slot, undefined);
    syncPreviewWebGl();
  }

  function revertAllPreview(): void {
    for (const slot of [...slotPreview.keys()]) revertSlotPreview(slot);
    slotPreview.clear();
    selectedRowSku = null;
    syncPreviewWebGl();
  }

  function setSlotPreview(slot: PassiveSlotId, presetId: string | null): void {
    slotPreview.set(slot, presetId);
    opts.onPreviewSlot?.(slot, presetId);
    syncPreviewWebGl();
  }

  function closeDropdown(revertUncommitted = true): void {
    if (openSlot && revertUncommitted) revertSlotPreview(openSlot);
    openSlot = null;
    selectedRowSku = null;
  }

  function rowsForSlot(slot: PassiveSlotId): SlotRow[] {
    if (!data) return [];
    const shop = data.shop.filter((s) => s.slot === slot);
    const rows: SlotRow[] = [
      {
        cosmeticSku: null,
        presetId: null,
        displayName: "None (unequip)",
        owned: true,
      },
    ];
    for (const ent of data.entitlements) {
      const meta = shop.find((s) => s.cosmeticSku === ent.cosmeticSku);
      if (!meta || meta.slot !== slot) continue;
      rows.push({
        cosmeticSku: ent.cosmeticSku,
        presetId: meta.presetId,
        displayName: meta.displayName,
        owned: true,
        shopEntry: meta,
      });
    }
    return rows;
  }

  async function equipSku(slot: PassiveSlotId, sku: string | null): Promise<void> {
    if (!loadCachedSession()?.token) return;
    try {
      await updateLoadoutSlot(slot, sku);
      slotPreview.delete(slot);
      opts.onPreviewSlot?.(slot, undefined);
      await refresh();
      opts.onLoadoutChanged?.();
      showNote(sku ? "Equipped." : "Unequipped.");
    } catch (e) {
      showNote(String(e), true);
    }
  }

  function renderDollPreview(parent: HTMLElement, compact = false): void {
    // Reuse the existing canvas if we already have one: just re-attach it without re-binding
    // the WebGL renderer, so toggling slot dropdowns doesn't rebuild the avatar preview.
    if (dollWrap && previewCanvas) {
      parent.appendChild(dollWrap);
      syncPreviewWebGl();
      if (previewCanvas.clientWidth < 2) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => syncPreviewWebGl());
        });
      }
      return;
    }
    const wrap = document.createElement("div");
    wrap.className = compact
      ? "wardrobe-doll wardrobe-doll--mini"
      : "wardrobe-doll wardrobe-doll--interactive";
    const canvas = document.createElement("canvas");
    canvas.className = "wardrobe-doll__canvas";
    canvas.width = compact ? 112 : 168;
    canvas.height = compact ? 112 : 168;
    canvas.setAttribute("aria-label", "Avatar preview on a floor tile");
    wrap.appendChild(canvas);
    parent.appendChild(wrap);
    previewCanvas = canvas;
    dollWrap = wrap;
    opts.onPreviewCanvas?.(canvas, walletAddress);
    syncPreviewWebGl();
    if (canvas.clientWidth < 2) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => syncPreviewWebGl());
      });
    }
  }

  function cosmeticNameForPreset(slot: PassiveSlotId, preset: string | null): string {
    if (!preset) return "None";
    const entry = data?.shop.find((s) => s.slot === slot && s.presetId === preset);
    return entry?.displayName ?? humanizePresetId(preset);
  }

  function renderSlotButton(slot: PassiveSlotId, host: HTMLElement): void {
    if (!data) return;
    const skuKey = loadoutSkuKey(slot);
    const equippedSku = data.loadout[skuKey];
    const cell = document.createElement("div");
    cell.className = "wardrobe-slot-cell";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "wardrobe-slot";
    btn.dataset.slot = slot;
    if (equippedSku) btn.classList.add("wardrobe-slot--equipped");
    if (openSlot === slot) btn.classList.add("wardrobe-slot--open");
    const label = document.createElement("span");
    label.className = "wardrobe-slot__label";
    label.textContent = SLOT_LABELS[slot];
    btn.appendChild(label);
    const preset = effectivePreset(slot);
    if (preset) {
      const chip = document.createElement("span");
      chip.className = presetSwatchClass(preset, slot);
      chip.setAttribute("aria-hidden", "true");
      btn.appendChild(chip);
    }
    btn.onclick = () => {
      if (openSlot === slot) {
        closeDropdown(true);
        render();
        return;
      }
      const prev = openSlot;
      if (prev) revertSlotPreview(prev);
      openSlot = slot;
      selectedRowSku = data!.loadout[loadoutSkuKey(slot)];
      render();
    };
    const name = document.createElement("span");
    name.className = "wardrobe-slot__name";
    name.textContent = cosmeticNameForPreset(slot, preset);
    cell.append(btn, name);
    host.appendChild(cell);
  }

  function renderSlotDropdown(slot: PassiveSlotId, anchorHost: HTMLElement): void {
    body.querySelector(".wardrobe-dropdown")?.remove();
    const dropdown = document.createElement("div");
    dropdown.className = "wardrobe-dropdown";
    dropdown.dataset.slot = slot;

    const actions = document.createElement("div");
    actions.className = "wardrobe-dropdown__actions";
    const equipBtn = document.createElement("button");
    equipBtn.type = "button";
    equipBtn.className = "wardrobe-panel__btn wardrobe-panel__btn--accent";
    equipBtn.textContent = "Equip";
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "wardrobe-panel__btn wardrobe-panel__btn--ghost";
    cancelBtn.textContent = "Cancel";
    cancelBtn.onclick = () => {
      revertSlotPreview(slot);
      closeDropdown(false);
      render();
    };
    equipBtn.onclick = () => {
      const row = rowsForSlot(slot).find((r) => r.cosmeticSku === selectedRowSku);
      const sku = row?.cosmeticSku ?? null;
      void equipSku(slot, sku).then(() => {
        closeDropdown(false);
        render();
      });
    };
    actions.append(equipBtn, cancelBtn);
    dropdown.appendChild(actions);

    for (const row of rowsForSlot(slot)) {
      const rowEl = document.createElement("button");
      rowEl.type = "button";
      rowEl.className = "wardrobe-dropdown__row";
      if (row.cosmeticSku === selectedRowSku) rowEl.classList.add("is-selected");
      const swatch = document.createElement("span");
      swatch.className = row.presetId
        ? presetSwatchClass(row.presetId, slot)
        : "wardrobe-swatch wardrobe-swatch--empty";
      const text = document.createElement("span");
      text.className = "wardrobe-dropdown__row-text";
      text.textContent = row.displayName;
      rowEl.append(swatch, text);
      rowEl.onclick = () => {
        selectedRowSku = row.cosmeticSku;
        setSlotPreview(slot, row.presetId);
        dropdown.querySelectorAll(".wardrobe-dropdown__row").forEach((el) => {
          el.classList.toggle("is-selected", el === rowEl);
        });
      };
      rowEl.dataset.sku = row.cosmeticSku ?? "";
      dropdown.appendChild(rowEl);
    }

    anchorHost.appendChild(dropdown);
  }

  function renderWardrobeTab(): void {
    if (!data) return;
    // NB: do NOT dispose the preview canvas here — `renderDollPreview` reuses it so re-renders
    // (slot dropdown open/close, equip refresh) don't tear down and rebuild the WebGL avatar.
    body.replaceChildren();
    const layout = document.createElement("div");
    layout.className = "wardrobe-layout";

    const grid = document.createElement("div");
    grid.className = "wardrobe-doll__grid";
    const colLeft = document.createElement("div");
    colLeft.className = "wardrobe-doll__col wardrobe-doll__col--left";
    const center = document.createElement("div");
    center.className = "wardrobe-doll__slot wardrobe-doll__slot--center";
    const colRight = document.createElement("div");
    colRight.className = "wardrobe-doll__col wardrobe-doll__col--right";

    renderSlotButton("nameplate", colLeft);
    renderSlotButton("aura", colLeft);
    renderDollPreview(center);
    renderSlotButton("chatBubble", colRight);
    renderSlotButton("trail", colRight);
    grid.append(colLeft, center, colRight);
    layout.appendChild(grid);

    body.appendChild(layout);
    if (openSlot) renderSlotDropdown(openSlot, layout);
  }

  async function buyEntry(entry: ShopEntry, btn: HTMLButtonElement): Promise<void> {
    if (!loadCachedSession()?.token) {
      showNote("Sign in with your wallet to buy.", true);
      return;
    }
    const original = btn.textContent;
    try {
      btn.disabled = true;
      const { intent } = await createUnlockIntent(entry.cosmeticSku);
      showNote(
        `Send ${intent.amountNimLabel} NIM in your wallet. Memo: ${intent.memo}. Waiting for confirmation…`
      );
      try {
        await navigator.clipboard.writeText(intent.memo);
      } catch {
        /* clipboard optional */
      }
      for (let attempt = 0; attempt < 40; attempt++) {
        await new Promise((r) => setTimeout(r, 3000));
        const synced = await syncUnlockPayment(intent.intentId, entry.cosmeticSku);
        if (synced.granted) {
          showNote(`Unlocked ${entry.displayName}!`);
          await refresh();
          return;
        }
      }
      showNote("Still waiting for payment. Check back once it confirms.", true);
    } catch (e) {
      showNote(String(e), true);
    } finally {
      btn.disabled = false;
      if (original !== null) btn.textContent = original;
    }
  }

  function renderShopCard(entry: ShopEntry): HTMLElement {
    const card = document.createElement("div");
    card.className = "wardrobe-shop__card";
    card.dataset.sku = entry.cosmeticSku;

    const swatch = document.createElement("span");
    swatch.className = presetSwatchClass(entry.presetId, entry.slot);
    swatch.setAttribute("aria-hidden", "true");

    const meta = document.createElement("div");
    meta.className = "wardrobe-shop__meta";
    const name = document.createElement("strong");
    name.className = "wardrobe-shop__name";
    name.textContent = entry.displayName;
    const sub = document.createElement("span");
    sub.className = "wardrobe-shop__sub";
    const group = entry.collection?.trim() || SLOT_LABELS[entry.slot as PassiveSlotId] || entry.slot;
    sub.textContent = entry.owned ? group : `${group} · ${nimPriceLabel(entry.priceLuna)}`;
    meta.append(name, sub);

    const actions = document.createElement("div");
    actions.className = "wardrobe-shop__card-actions";

    const isDeployable = entry.slot === "deployable";
    if (!entry.owned) {
      const buyBtn = document.createElement("button");
      buyBtn.type = "button";
      buyBtn.className = "wardrobe-panel__btn wardrobe-panel__btn--buy";
      buyBtn.textContent = "Buy";
      buyBtn.onclick = () => void buyEntry(entry, buyBtn);
      actions.appendChild(buyBtn);
    } else if (isDeployable) {
      const tag = document.createElement("span");
      tag.className = "wardrobe-panel__tag";
      tag.textContent = "Owned";
      const hint = document.createElement("span");
      hint.className = "wardrobe-shop__hint";
      hint.textContent = "Use from Action Wheel → Items";
      actions.append(tag, hint);
    } else if (isPassiveSlotId(entry.slot)) {
      const slot = entry.slot;
      const equipBtn = document.createElement("button");
      equipBtn.type = "button";
      equipBtn.className = "wardrobe-panel__btn wardrobe-panel__btn--accent";
      equipBtn.textContent = "Equip";
      equipBtn.onclick = () => void equipSku(slot, entry.cosmeticSku);
      actions.appendChild(equipBtn);
    } else {
      const tag = document.createElement("span");
      tag.className = "wardrobe-panel__tag";
      tag.textContent = "Owned";
      actions.appendChild(tag);
    }

    card.append(swatch, meta, actions);
    return card;
  }

  function renderShopTab(): void {
    disposePreviewCanvas();
    body.replaceChildren();
    const layout = document.createElement("div");
    layout.className = "wardrobe-shop";

    const heading = document.createElement("h3");
    heading.className = "wardrobe-shop__heading";
    heading.textContent = "Featured today";
    layout.appendChild(heading);

    const featured = data?.featured ?? [];
    if (featured.length === 0) {
      const empty = document.createElement("p");
      empty.className = "wardrobe-shop__desc";
      empty.textContent = "No items featured right now. Check back soon.";
      layout.appendChild(empty);
    } else {
      const grid = document.createElement("div");
      grid.className = "wardrobe-shop__grid";
      for (const entry of featured) grid.appendChild(renderShopCard(entry));
      layout.appendChild(grid);
    }

    const shaper = document.createElement("div");
    shaper.className = "wardrobe-shop__shaper";
    const shaperCopy = document.createElement("p");
    shaperCopy.className = "wardrobe-shop__desc";
    shaperCopy.textContent =
      "Want to try a look before you buy? Visit The Shaper to preview cosmetics in-world.";
    const goBtn = document.createElement("button");
    goBtn.type = "button";
    goBtn.className = "wardrobe-panel__btn wardrobe-panel__btn--ghost wardrobe-shop__go";
    goBtn.textContent = "Go to The Shaper";
    goBtn.onclick = () => opts.onVisitCosmeticShop?.();
    shaper.append(shaperCopy, goBtn);
    layout.appendChild(shaper);

    body.appendChild(layout);
  }

  function render(): void {
    note.hidden = true;
    if (view === "wardrobe") renderWardrobeTab();
    else renderShopTab();
  }

  function setView(next: "wardrobe" | "shop"): void {
    view = next;
    wardrobeTab.classList.toggle("is-active", next === "wardrobe");
    shopTab.classList.toggle("is-active", next === "shop");
    closeDropdown(true);
    render();
  }
  wardrobeTab.onclick = () => setView("wardrobe");
  shopTab.onclick = () => setView("shop");

  async function refresh(): Promise<void> {
    const token = loadCachedSession()?.token;
    if (!token) {
      showNote("Sign in with your wallet to use Wardrobe.");
      return;
    }
    note.hidden = true;
    data = await fetchWardrobe();
    render();
  }

  void refresh();
  return { refresh, revertAllPreview, disposePreviewCanvas, setView };
}

export function mountWardrobeReadOnly(
  container: HTMLElement,
  walletAddress: string,
  loadout: Partial<Record<PassiveSlotId, string | null>>,
  _deployables: Array<{ presetId: string; displayName: string }>,
  opts: Pick<PreviewHandlers, "onPreviewCanvas" | "onPreviewCosmeticsChange"> = {}
): { disposePreviewCanvas: () => void } {
  container.classList.add("wardrobe-panel", "wardrobe-panel--readonly");
  container.replaceChildren();

  let previewCanvas: HTMLCanvasElement | null = null;
  function disposePreviewCanvas(): void {
    if (!previewCanvas) return;
    opts.onPreviewCanvas?.(null, walletAddress);
    previewCanvas = null;
  }

  const layout = document.createElement("div");
  layout.className = "wardrobe-layout";

  const grid = document.createElement("div");
  grid.className = "wardrobe-doll__grid";
  const colLeft = document.createElement("div");
  colLeft.className = "wardrobe-doll__col wardrobe-doll__col--left";
  const center = document.createElement("div");
  center.className = "wardrobe-doll__slot wardrobe-doll__slot--center";
  const colRight = document.createElement("div");
  colRight.className = "wardrobe-doll__col wardrobe-doll__col--right";

  for (const [slot, host] of [
    ["nameplate", colLeft],
    ["aura", colLeft],
    ["chatBubble", colRight],
    ["trail", colRight],
  ] as const) {
    const preset = loadout[slot] ?? null;
    const cell = document.createElement("div");
    cell.className = "wardrobe-slot-cell";
    const chip = document.createElement("span");
    chip.className = `wardrobe-slot wardrobe-slot--readonly${
      preset ? " wardrobe-slot--equipped" : ""
    }`;
    const label = document.createElement("span");
    label.className = "wardrobe-slot__label";
    label.textContent = SLOT_LABELS[slot];
    chip.appendChild(label);
    if (preset) {
      const sw = document.createElement("span");
      sw.className = presetSwatchClass(preset, slot);
      sw.setAttribute("aria-hidden", "true");
      chip.appendChild(sw);
    }
    const name = document.createElement("span");
    name.className = "wardrobe-slot__name";
    name.textContent = preset ? humanizePresetId(preset) : "None";
    cell.append(chip, name);
    host.appendChild(cell);
  }

  const dollWrap = document.createElement("div");
  dollWrap.className = "wardrobe-doll wardrobe-doll--interactive";
  const canvas = document.createElement("canvas");
  canvas.className = "wardrobe-doll__canvas";
  canvas.width = 168;
  canvas.height = 168;
  canvas.setAttribute("aria-label", "Equipped cosmetics preview");
  dollWrap.appendChild(canvas);
  center.appendChild(dollWrap);
  previewCanvas = canvas;
  opts.onPreviewCanvas?.(canvas, walletAddress);
  opts.onPreviewCosmeticsChange?.({
    aura: loadout.aura ?? null,
    nameplate: loadout.nameplate ?? null,
    chatBubble: loadout.chatBubble ?? null,
    trail: loadout.trail ?? null,
  });

  grid.append(colLeft, center, colRight);
  layout.appendChild(grid);

  container.appendChild(layout);
  return { disposePreviewCanvas };
}
