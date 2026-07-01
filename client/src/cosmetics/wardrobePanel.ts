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
  createPresetSwatch,
  createUnavailableSwatch,
  loadoutSkuKey,
  PASSIVE_SLOTS,
  SLOT_LABELS,
  type PassiveSlotId,
} from "./presetSwatch.js";
import {
  bindWardrobeSlotTooltip,
  createWardrobeSlotTooltip,
  slotAriaLabel,
} from "./wardrobeSlotTip.js";
import {
  isGroupedStyleSlot,
  isMultiVariantStyleLine,
  listStyleLinesForSlot,
  representativePresetForStyleLine,
  resolveStyleLineVariants,
  styleLineById,
  WARDROBE_VARIANT_UNLOCK_HINT,
  type ResolvedStyleVariant,
  type StyleLineDef,
} from "./wardrobeStyleLines.js";
import {
  isShopPubliclyOpen,
  SHOP_COMING_SOON_BODY,
  SHOP_COMING_SOON_HEADING,
} from "./shopAccess.js";

function isPassiveSlotId(slot: string): slot is PassiveSlotId {
  return (PASSIVE_SLOTS as readonly string[]).includes(slot);
}

function nimPriceLabel(priceLuna: string): string {
  const n = Number(priceLuna);
  if (!Number.isFinite(n) || n <= 0) return "Free";
  return `${(n / 100_000).toFixed(2)} NIM`;
}

function shopSlotLabel(slot: string): string {
  if (isPassiveSlotId(slot)) return SLOT_LABELS[slot];
  if (slot === "deployable") return "Deployable";
  return slot;
}

const SLOT_COMING_SOON = new Set<PassiveSlotId>([
  "nameplate",
  "chatBubble",
]);

export const WARDROBE_SLOT_EMPTY_COPY = "Nothing to unlock yet";

export const SHOP_ACHIEVEMENTS_ONLY_COPY =
  "Earn cosmetics through Achievements - more styles coming soon.";

export type WardrobeSlotStatusInput = {
  slot: PassiveSlotId | "deployable";
  presetName: string;
  ownedSelectableCount: number;
  ownedDeployableCount?: number;
};

export function wardrobeSlotShowsEmptyIcon(input: WardrobeSlotStatusInput): boolean {
  if (input.presetName !== "None") return false;
  if (input.slot === "deployable") {
    return (input.ownedDeployableCount ?? 0) === 0;
  }
  return SLOT_COMING_SOON.has(input.slot) && input.ownedSelectableCount === 0;
}

export function wardrobeSlotStatusLabel(input: WardrobeSlotStatusInput): string {
  if (input.presetName !== "None") return input.presetName;
  if (wardrobeSlotShowsEmptyIcon(input)) return "None";
  if (input.slot === "deployable") {
    const count = input.ownedDeployableCount ?? 0;
    return count > 0 ? `${count} owned` : "";
  }
  return "None";
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
  /** Skip the mount-time fetch when the host already has wardrobe data cached. */
  initialData?: WardrobeResponse;
};

type SlotRow = {
  cosmeticSku: string | null;
  presetId: string | null;
  displayName: string;
  owned: boolean;
  shopEntry?: ShopEntry;
};

const OWNED_COSMETICS_PAGE_SIZE = 5;

function appendWardrobeSkeletonSlot(host: HTMLElement, label: string): void {
  const cell = document.createElement("div");
  cell.className = "wardrobe-slot-cell wardrobe-slot-cell--skeleton";
  const tipHost = document.createElement("div");
  tipHost.className = "wardrobe-slot-tip-host";
  const chip = document.createElement("span");
  chip.className = "wardrobe-slot wardrobe-slot--skeleton";
  chip.setAttribute("aria-hidden", "true");
  const swatch = document.createElement("span");
  swatch.className = "wardrobe-swatch wardrobe-swatch--skeleton";
  chip.appendChild(swatch);
  tipHost.appendChild(chip);
  const name = document.createElement("span");
  name.className = "wardrobe-slot__name wardrobe-slot__name--skeleton";
  name.textContent = label;
  cell.append(tipHost, name);
  host.appendChild(cell);
}

function buildWardrobeLayoutSkeleton(): HTMLElement {
  const layout = document.createElement("div");
  layout.className = "wardrobe-layout wardrobe-layout--skeleton";

  const grid = document.createElement("div");
  grid.className = "wardrobe-doll__grid";
  const colLeft = document.createElement("div");
  colLeft.className = "wardrobe-doll__col wardrobe-doll__col--left";
  const center = document.createElement("div");
  center.className = "wardrobe-doll__slot wardrobe-doll__slot--center";
  const colRight = document.createElement("div");
  colRight.className = "wardrobe-doll__col wardrobe-doll__col--right";

  appendWardrobeSkeletonSlot(colLeft, SLOT_LABELS.nameplate);
  appendWardrobeSkeletonSlot(colLeft, SLOT_LABELS.aura);

  const dollWrapSkeleton = document.createElement("div");
  dollWrapSkeleton.className = "wardrobe-doll wardrobe-doll--interactive wardrobe-doll--skeleton";
  const canvasSkeleton = document.createElement("div");
  canvasSkeleton.className = "wardrobe-doll__canvas wardrobe-doll__canvas--skeleton";
  canvasSkeleton.setAttribute("aria-label", "Avatar preview loading");
  dollWrapSkeleton.appendChild(canvasSkeleton);
  center.appendChild(dollWrapSkeleton);

  appendWardrobeSkeletonSlot(colRight, SLOT_LABELS.chatBubble);
  appendWardrobeSkeletonSlot(colRight, SLOT_LABELS.trail);
  grid.append(colLeft, center, colRight);
  layout.appendChild(grid);

  const deployableRow = document.createElement("div");
  deployableRow.className = "wardrobe-doll__deployable-row";
  appendWardrobeSkeletonSlot(deployableRow, "Deployable");
  layout.appendChild(deployableRow);
  return layout;
}

/** Reserve profile / panel space before wardrobe data and WebGL preview are ready. */
export function mountWardrobePanelSkeleton(container: HTMLElement): void {
  container.classList.add("wardrobe-panel");
  container.replaceChildren();
  const body = document.createElement("div");
  body.className = "wardrobe-panel__body";
  body.appendChild(buildWardrobeLayoutSkeleton());
  container.appendChild(body);
}

export function mountWardrobePanel(
  container: HTMLElement,
  walletAddress: string,
  opts: PreviewHandlers = {}
): {
  refresh: (opts?: { force?: boolean }) => Promise<void>;
  revertAllPreview: () => void;
  disposePreviewCanvas: () => void;
  setView: (next: "wardrobe" | "shop") => void;
  getData: () => WardrobeResponse | null;
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
  /** Preset highlighted in the open slot dropdown (owned or locked preview). */
  let selectedPreviewPresetId: string | null = null;
  /** Style Line drill-in when the open slot uses grouped rows. */
  let openStyleLineId: string | null = null;
  /** Featured shop card selected for Wardrobe Preview on the mini doll. */
  let selectedShopSku: string | null = null;
  let slotDropdownPage = 0;
  let previewCanvas: HTMLCanvasElement | null = null;
  // The avatar preview is an expensive WebGL canvas. We keep the SAME element across wardrobe
  // re-renders (e.g. opening/closing a slot dropdown) so its renderer/scene is never torn down
  // and rebuilt - re-parenting a canvas in the DOM preserves its WebGL context, so there is no
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
    selectedPreviewPresetId = null;
    openStyleLineId = null;
    selectedShopSku = null;
    syncPreviewWebGl();
  }

  function ownedSkuSet(): Set<string> {
    return new Set((data?.entitlements ?? []).map((e) => e.cosmeticSku));
  }

  function shopEntriesForSlot(slot: PassiveSlotId): ShopEntry[] {
    return (data?.shop ?? []).filter((s) => s.slot === slot);
  }

  function skuForPreview(slot: PassiveSlotId, presetId: string | null): string | null {
    if (!presetId || !data) return null;
    const entry = data.shop.find((s) => s.slot === slot && s.presetId === presetId);
    if (!entry) return null;
    return ownedSkuSet().has(entry.cosmeticSku) ? entry.cosmeticSku : null;
  }

  function selectPreview(slot: PassiveSlotId, presetId: string | null): void {
    selectedPreviewPresetId = presetId;
    setSlotPreview(slot, presetId);
  }

  function syncEquipButton(dropdown: HTMLElement, slot: PassiveSlotId): void {
    const equipBtn = dropdown.querySelector<HTMLButtonElement>(
      ".wardrobe-dropdown__actions .wardrobe-panel__btn--accent"
    );
    if (!equipBtn) return;
    if (selectedPreviewPresetId === null) {
      equipBtn.disabled = false;
      return;
    }
    equipBtn.disabled = skuForPreview(slot, selectedPreviewPresetId) === null;
  }

  function setSlotPreview(slot: PassiveSlotId, presetId: string | null): void {
    slotPreview.set(slot, presetId);
    opts.onPreviewSlot?.(slot, presetId);
    syncPreviewWebGl();
  }

  function closeDropdown(revertUncommitted = true): void {
    if (openSlot && revertUncommitted) revertSlotPreview(openSlot);
    openSlot = null;
    selectedPreviewPresetId = null;
    openStyleLineId = null;
    slotDropdownPage = 0;
  }

  function ownedRowsForSlot(slot: PassiveSlotId): SlotRow[] {
    return rowsForSlot(slot).slice(1);
  }

  function ownedCosmeticsPageCount(slot: PassiveSlotId): number {
    const owned = ownedRowsForSlot(slot).length;
    return Math.max(1, Math.ceil(owned / OWNED_COSMETICS_PAGE_SIZE));
  }

  function ownedCosmeticsPageIndex(slot: PassiveSlotId): number {
    const pages = ownedCosmeticsPageCount(slot);
    return Math.min(Math.max(0, slotDropdownPage), pages - 1);
  }

  function pageIndexForSelectedOwnedRow(slot: PassiveSlotId): number {
    const sku = skuForPreview(slot, selectedPreviewPresetId);
    if (!sku) return 0;
    const idx = ownedRowsForSlot(slot).findIndex((r) => r.cosmeticSku === sku);
    if (idx < 0) return 0;
    return Math.floor(idx / OWNED_COSMETICS_PAGE_SIZE);
  }

  function ownedRowsForPage(slot: PassiveSlotId): SlotRow[] {
    const owned = ownedRowsForSlot(slot);
    const page = ownedCosmeticsPageIndex(slot);
    const start = page * OWNED_COSMETICS_PAGE_SIZE;
    return owned.slice(start, start + OWNED_COSMETICS_PAGE_SIZE);
  }

  function appendSlotDropdownRow(
    dropdown: HTMLElement,
    slot: PassiveSlotId,
    row: SlotRow,
    opts?: { selected?: boolean }
  ): void {
    const rowEl = document.createElement("button");
    rowEl.type = "button";
    rowEl.className = "wardrobe-dropdown__row";
    const selected =
      opts?.selected ??
      (row.presetId === null
        ? selectedPreviewPresetId === null
        : row.presetId === selectedPreviewPresetId);
    if (selected) rowEl.classList.add("is-selected");
    const swatch = createPresetSwatch(row.presetId, slot);
    const text = document.createElement("span");
    text.className = "wardrobe-dropdown__row-text";
    text.textContent = row.displayName;
    rowEl.append(swatch, text);
    rowEl.onclick = () => {
      selectPreview(slot, row.presetId);
      dropdown.querySelectorAll(".wardrobe-dropdown__row").forEach((el) => {
        el.classList.toggle("is-selected", el === rowEl);
      });
      syncEquipButton(dropdown, slot);
    };
    rowEl.dataset.sku = row.cosmeticSku ?? "";
    dropdown.querySelector(".wardrobe-dropdown__body")?.appendChild(rowEl);
  }

  function appendStyleLineRow(
    dropdown: HTMLElement,
    slot: PassiveSlotId,
    line: StyleLineDef,
    variants: ResolvedStyleVariant[]
  ): void {
    const rowEl = document.createElement("button");
    rowEl.type = "button";
    rowEl.className = "wardrobe-dropdown__row wardrobe-dropdown__row--style-line";
    if (isMultiVariantStyleLine(line)) rowEl.classList.add("wardrobe-dropdown__row--has-picker");
    const activeInLine =
      selectedPreviewPresetId !== null &&
      line.variants.some((v) => v.presetId === selectedPreviewPresetId);
    if (activeInLine) rowEl.classList.add("is-selected");
    const repPreset = representativePresetForStyleLine(
      line,
      variants,
      selectedPreviewPresetId
    );
    const swatch = createPresetSwatch(repPreset, slot);
    const text = document.createElement("span");
    text.className = "wardrobe-dropdown__row-text";
    text.textContent = line.label;
    rowEl.append(swatch, text);
    if (isMultiVariantStyleLine(line)) {
      const chevron = document.createElement("span");
      chevron.className = "wardrobe-dropdown__row-chevron";
      chevron.setAttribute("aria-hidden", "true");
      chevron.textContent = "›";
      rowEl.appendChild(chevron);
    }
    rowEl.onclick = () => {
      if (isMultiVariantStyleLine(line)) {
        openStyleLineId = line.id;
        refreshSlotDropdownBody(dropdown, slot);
        return;
      }
      const only = variants[0];
      if (!only) return;
      selectPreview(slot, only.presetId);
      dropdown
        .querySelectorAll(".wardrobe-dropdown__row--style-line")
        .forEach((el) => {
          el.classList.toggle("is-selected", el === rowEl);
        });
      syncEquipButton(dropdown, slot);
    };
    dropdown.querySelector(".wardrobe-dropdown__body")?.appendChild(rowEl);
  }

  function variantPickerCaption(variant: ResolvedStyleVariant): string {
    if (variant.owned) return variant.variantLabel;
    return `${variant.variantLabel} · ${WARDROBE_VARIANT_UNLOCK_HINT}`;
  }

  function renderVariantPicker(
    host: HTMLElement,
    dropdown: HTMLElement,
    slot: PassiveSlotId,
    line: StyleLineDef,
    variants: ResolvedStyleVariant[]
  ): void {
    host.className = "wardrobe-dropdown__body wardrobe-variant-picker";
    const backBtn = document.createElement("button");
    backBtn.type = "button";
    backBtn.className = "wardrobe-variant-picker__back";
    backBtn.textContent = "← Back";
    backBtn.setAttribute("aria-label", `Back to ${SLOT_LABELS[slot]} styles`);
    backBtn.onclick = () => {
      openStyleLineId = null;
      refreshSlotDropdownBody(dropdown, slot);
    };

    const title = document.createElement("div");
    title.className = "wardrobe-variant-picker__title";
    title.textContent = `${line.variantPickerTitle}: ${line.label}`;

    const grid = document.createElement("div");
    grid.className = "wardrobe-variant-picker__grid";
    grid.setAttribute("role", "listbox");
    grid.setAttribute("aria-label", line.variantPickerTitle);

    let captionVariant =
      variants.find((v) => v.presetId === selectedPreviewPresetId) ??
      variants.find((v) => v.owned) ??
      variants[0];

    for (const variant of variants) {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "wardrobe-variant-tile";
      tile.setAttribute("role", "option");
      tile.title = variant.displayName;
      if (variant.presetId === selectedPreviewPresetId) {
        tile.classList.add("is-selected");
      }
      if (!variant.owned) tile.classList.add("wardrobe-variant-tile--locked");
      const swatch = createPresetSwatch(variant.presetId, slot, {
        locked: !variant.owned,
      });
      tile.appendChild(swatch);
      tile.onclick = () => {
        selectPreview(slot, variant.presetId);
        captionVariant = variant;
        grid.querySelectorAll(".wardrobe-variant-tile").forEach((el) => {
          el.classList.toggle("is-selected", el === tile);
        });
        caption.textContent = variantPickerCaption(variant);
        syncEquipButton(dropdown, slot);
      };
      grid.appendChild(tile);
    }

    const caption = document.createElement("p");
    caption.className = "wardrobe-variant-picker__caption";
    caption.textContent = captionVariant
      ? variantPickerCaption(captionVariant)
      : "";

    host.append(backBtn, title, grid, caption);
  }

  function renderStyleLineList(
    host: HTMLElement,
    dropdown: HTMLElement,
    slot: PassiveSlotId
  ): void {
    host.className = "wardrobe-dropdown__body wardrobe-dropdown__list";
    const noneRow: SlotRow = {
      cosmeticSku: null,
      presetId: null,
      displayName: "None (unequip)",
      owned: true,
    };
    appendSlotDropdownRow(dropdown, slot, noneRow);
    const ownedSkus = ownedSkuSet();
    const shop = shopEntriesForSlot(slot);
    for (const line of listStyleLinesForSlot(slot)) {
      appendStyleLineRow(
        dropdown,
        slot,
        line,
        resolveStyleLineVariants(line, shop, ownedSkus)
      );
    }
  }

  function renderFlatOwnedList(host: HTMLElement, dropdown: HTMLElement, slot: PassiveSlotId): void {
    host.className = "wardrobe-dropdown__body wardrobe-dropdown__list";
    const rows = rowsForSlot(slot);
    if (rows[0]) appendSlotDropdownRow(dropdown, slot, rows[0]);
    for (const row of ownedRowsForPage(slot)) {
      appendSlotDropdownRow(dropdown, slot, row);
    }
  }

  function refreshSlotDropdownPager(dropdown: HTMLElement, slot: PassiveSlotId): void {
    dropdown.querySelector(".wardrobe-dropdown__pager")?.remove();
    if (isGroupedStyleSlot(slot)) return;

    const pageCount = ownedCosmeticsPageCount(slot);
    if (pageCount <= 1) return;

    const page = ownedCosmeticsPageIndex(slot);
    const pager = document.createElement("div");
    pager.className = "wardrobe-dropdown__pager";
    const prevBtn = document.createElement("button");
    prevBtn.type = "button";
    prevBtn.className = "wardrobe-dropdown__pager-btn";
    prevBtn.textContent = "<";
    prevBtn.setAttribute("aria-label", "Previous owned cosmetics page");
    prevBtn.disabled = page <= 0;
    const label = document.createElement("span");
    label.className = "wardrobe-dropdown__pager-label";
    label.textContent = `${page + 1} / ${pageCount}`;
    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "wardrobe-dropdown__pager-btn";
    nextBtn.textContent = ">";
    nextBtn.setAttribute("aria-label", "Next owned cosmetics page");
    nextBtn.disabled = page >= pageCount - 1;
    prevBtn.onclick = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (slotDropdownPage <= 0) return;
      slotDropdownPage -= 1;
      refreshSlotDropdownBody(dropdown, slot);
    };
    nextBtn.onclick = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (slotDropdownPage >= pageCount - 1) return;
      slotDropdownPage += 1;
      refreshSlotDropdownBody(dropdown, slot);
    };
    pager.append(prevBtn, label, nextBtn);
    dropdown.appendChild(pager);
  }

  function refreshSlotDropdownBody(dropdown: HTMLElement, slot: PassiveSlotId): void {
    dropdown.querySelector(".wardrobe-dropdown__body")?.remove();
    dropdown.querySelector(".wardrobe-dropdown__pager")?.remove();

    const bodyHost = document.createElement("div");
    dropdown.appendChild(bodyHost);

    if (isGroupedStyleSlot(slot)) {
      const line = openStyleLineId ? styleLineById(openStyleLineId) : null;
      if (line && line.slot === slot) {
        renderVariantPicker(
          bodyHost,
          dropdown,
          slot,
          line,
          resolveStyleLineVariants(line, shopEntriesForSlot(slot), ownedSkuSet())
        );
      } else {
        renderStyleLineList(bodyHost, dropdown, slot);
      }
    } else {
      renderFlatOwnedList(bodyHost, dropdown, slot);
      refreshSlotDropdownPager(dropdown, slot);
    }
    syncEquipButton(dropdown, slot);
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

  function ownedDeployableCount(): number {
    if (!data) return 0;
    const owned = new Set(data.entitlements.map((e) => e.cosmeticSku));
    return data.shop.filter(
      (entry) => entry.slot === "deployable" && owned.has(entry.cosmeticSku)
    ).length;
  }

  function fillSlotNameLabel(el: HTMLSpanElement, input: WardrobeSlotStatusInput): string {
    const label = wardrobeSlotStatusLabel(input);
    if (wardrobeSlotShowsEmptyIcon(input)) {
      el.className = "wardrobe-slot__name";
      el.setAttribute("aria-label", WARDROBE_SLOT_EMPTY_COPY);
      el.textContent = "None";
      return "None";
    }
    el.className = "wardrobe-slot__name";
    el.removeAttribute("aria-label");
    el.textContent = label;
    return label || "None";
  }

  function renderSlotButton(slot: PassiveSlotId, host: HTMLElement): void {
    if (!data) return;
    const skuKey = loadoutSkuKey(slot);
    const equippedSku = data.loadout[skuKey];
    const preset = effectivePreset(slot);
    const presetName = cosmeticNameForPreset(slot, preset);
    const statusInput: WardrobeSlotStatusInput = {
      slot,
      presetName,
      ownedSelectableCount: Math.max(0, rowsForSlot(slot).length - 1),
    };
    const ariaStatus = wardrobeSlotShowsEmptyIcon(statusInput)
      ? WARDROBE_SLOT_EMPTY_COPY
      : wardrobeSlotStatusLabel(statusInput) || "None";
    const tipHost = document.createElement("div");
    tipHost.className = "wardrobe-slot-tip-host";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "wardrobe-slot";
    btn.dataset.slot = slot;
    btn.setAttribute("aria-label", slotAriaLabel(SLOT_LABELS[slot], ariaStatus));
    if (equippedSku) btn.classList.add("wardrobe-slot--equipped");
    if (openSlot === slot) btn.classList.add("wardrobe-slot--open");
    const swatch = wardrobeSlotShowsEmptyIcon(statusInput)
      ? createUnavailableSwatch()
      : createPresetSwatch(preset, slot);
    btn.appendChild(swatch);
    tipHost.append(btn, createWardrobeSlotTooltip(SLOT_LABELS[slot]));
    bindWardrobeSlotTooltip(tipHost, btn, { editable: true });
    btn.onclick = () => {
      if (openSlot === slot) {
        closeDropdown(true);
        render();
        return;
      }
      const prev = openSlot;
      if (prev) revertSlotPreview(prev);
      openSlot = slot;
      openStyleLineId = null;
      selectedPreviewPresetId = effectivePreset(slot);
      slotDropdownPage = pageIndexForSelectedOwnedRow(slot);
      render();
    };
    const name = document.createElement("span");
    fillSlotNameLabel(name, statusInput);
    const cell = document.createElement("div");
    cell.className = "wardrobe-slot-cell";
    cell.append(tipHost, name);
    host.appendChild(cell);
  }

  function renderDeployableSlot(host: HTMLElement): void {
    const count = ownedDeployableCount();
    const statusInput: WardrobeSlotStatusInput = {
      slot: "deployable",
      presetName: "None",
      ownedSelectableCount: 0,
      ownedDeployableCount: count,
    };
    const ariaStatus = wardrobeSlotShowsEmptyIcon(statusInput)
      ? WARDROBE_SLOT_EMPTY_COPY
      : wardrobeSlotStatusLabel(statusInput) || "None";
    const tipHost = document.createElement("div");
    tipHost.className = "wardrobe-slot-tip-host";
    const chip = document.createElement("span");
    chip.className = `wardrobe-slot wardrobe-slot--readonly${
      count > 0 ? " wardrobe-slot--equipped" : ""
    }`;
    chip.setAttribute("aria-label", slotAriaLabel("Deployable", ariaStatus));
    chip.tabIndex = 0;
    const swatch = wardrobeSlotShowsEmptyIcon(statusInput)
      ? createUnavailableSwatch()
      : createPresetSwatch(null);
    chip.appendChild(swatch);
    tipHost.append(chip, createWardrobeSlotTooltip("Deployable"));
    bindWardrobeSlotTooltip(tipHost, chip);
    const name = document.createElement("span");
    fillSlotNameLabel(name, statusInput);
    const cell = document.createElement("div");
    cell.className = "wardrobe-slot-cell wardrobe-slot-cell--deployable";
    cell.append(tipHost, name);
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
      const sku = skuForPreview(slot, selectedPreviewPresetId);
      void equipSku(slot, sku).then(() => {
        selectedPreviewPresetId = sku ? selectedPreviewPresetId : null;
        openStyleLineId = null;
        render();
      });
    };
    actions.append(equipBtn, cancelBtn);
    dropdown.appendChild(actions);

    refreshSlotDropdownBody(dropdown, slot);

    anchorHost.appendChild(dropdown);
  }

  function renderWardrobeSkeleton(): void {
    body.replaceChildren();
    body.appendChild(buildWardrobeLayoutSkeleton());
  }

  function renderShopSkeleton(): void {
    body.replaceChildren();
    const layout = document.createElement("div");
    layout.className = "wardrobe-shop wardrobe-shop--skeleton";
    const heading = document.createElement("h3");
    heading.className = "wardrobe-shop__heading";
    heading.textContent = "Shop";
    const block = document.createElement("div");
    block.className = "wardrobe-shop__skeleton-block";
    block.setAttribute("aria-hidden", "true");
    layout.append(heading, block);
    body.appendChild(layout);
  }

  function renderWardrobeTab(): void {
    if (!data) return;
    // NB: do NOT dispose the preview canvas here - `renderDollPreview` reuses it so re-renders
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

    const deployableRow = document.createElement("div");
    deployableRow.className = "wardrobe-doll__deployable-row";
    renderDeployableSlot(deployableRow);
    layout.appendChild(deployableRow);

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

  function previewShopEntry(entry: ShopEntry): void {
    selectedShopSku = entry.cosmeticSku;
    if (isPassiveSlotId(entry.slot)) {
      setSlotPreview(entry.slot, entry.presetId);
    }
    syncShopRowPreviewHighlight();
  }

  function syncShopRowPreviewHighlight(): void {
    body.querySelectorAll(".wardrobe-shop__row").forEach((el) => {
      el.classList.toggle(
        "is-previewing",
        (el as HTMLElement).dataset.sku === selectedShopSku
      );
    });
  }

  function renderShopRowMeta(entry: ShopEntry, host: HTMLElement): void {
    if (!entry.owned) {
      const price = document.createElement("span");
      price.className = "wardrobe-shop__row-price";
      price.textContent = nimPriceLabel(entry.priceLuna);
      host.appendChild(price);
      return;
    }
    const tag = document.createElement("span");
    tag.className = "wardrobe-panel__tag wardrobe-shop__row-owned";
    tag.textContent = "Owned";
    host.appendChild(tag);
    if (entry.slot === "deployable") {
      const hint = document.createElement("span");
      hint.className = "wardrobe-shop__hint wardrobe-shop__row-hint";
      hint.textContent = "Action Wheel → Items";
      host.appendChild(hint);
    }
  }

  function renderShopRowActions(
    entry: ShopEntry,
    previewCol: HTMLElement,
    primaryCol: HTMLElement
  ): void {
    const isDeployable = entry.slot === "deployable";
    if (isPassiveSlotId(entry.slot)) {
      const previewBtn = document.createElement("button");
      previewBtn.type = "button";
      previewBtn.className =
        "wardrobe-panel__btn wardrobe-panel__btn--ghost wardrobe-shop__row-btn";
      previewBtn.textContent = "Preview";
      previewBtn.onclick = () => previewShopEntry(entry);
      previewCol.appendChild(previewBtn);
    } else {
      previewCol.setAttribute("aria-hidden", "true");
    }

    if (!entry.owned) {
      const buyBtn = document.createElement("button");
      buyBtn.type = "button";
      buyBtn.className =
        "wardrobe-panel__btn wardrobe-panel__btn--buy wardrobe-shop__row-btn";
      buyBtn.textContent = "Buy";
      buyBtn.onclick = () => void buyEntry(entry, buyBtn);
      primaryCol.appendChild(buyBtn);
      return;
    }
    if (isDeployable) return;
    if (isPassiveSlotId(entry.slot)) {
      const equipBtn = document.createElement("button");
      equipBtn.type = "button";
      equipBtn.className =
        "wardrobe-panel__btn wardrobe-panel__btn--accent wardrobe-shop__row-btn";
      equipBtn.textContent = "Equip";
      equipBtn.onclick = () => {
        void equipSku(entry.slot as PassiveSlotId, entry.cosmeticSku).then(() => {
          selectedShopSku = entry.cosmeticSku;
          render();
        });
      };
      primaryCol.appendChild(equipBtn);
    }
  }

  function renderShopRow(entry: ShopEntry): HTMLElement {
    const row = document.createElement("div");
    row.className = "wardrobe-shop__row";
    row.dataset.sku = entry.cosmeticSku;
    if (selectedShopSku === entry.cosmeticSku) row.classList.add("is-previewing");

    const card = document.createElement("div");
    card.className = "wardrobe-shop__row-card";

    const label = document.createElement("div");
    label.className = "wardrobe-shop__row-label";
    const name = document.createElement("span");
    name.className = "wardrobe-shop__row-name";
    name.textContent = entry.displayName;
    const sep = document.createElement("span");
    sep.className = "wardrobe-shop__row-sep";
    sep.textContent = "-";
    sep.setAttribute("aria-hidden", "true");
    const slot = document.createElement("em");
    slot.className = "wardrobe-shop__row-slot";
    slot.textContent = shopSlotLabel(entry.slot);
    label.append(name, sep, slot);

    const meta = document.createElement("div");
    meta.className = "wardrobe-shop__row-meta";
    renderShopRowMeta(entry, meta);

    card.append(label, meta);

    const actions = document.createElement("div");
    actions.className = "wardrobe-shop__row-actions";
    const previewCol = document.createElement("div");
    previewCol.className =
      "wardrobe-shop__row-action-col wardrobe-shop__row-action-col--preview";
    const primaryCol = document.createElement("div");
    primaryCol.className =
      "wardrobe-shop__row-action-col wardrobe-shop__row-action-col--primary";
    renderShopRowActions(entry, previewCol, primaryCol);
    actions.append(previewCol, primaryCol);

    row.append(card, actions);
    return row;
  }

  function renderShopTab(): void {
    disposePreviewCanvas();
    body.replaceChildren();
    const layout = document.createElement("div");
    layout.className = "wardrobe-shop";

    const heading = document.createElement("h3");
    heading.className = "wardrobe-shop__heading";
    heading.textContent = "Shop";
    layout.appendChild(heading);

    if (!isShopPubliclyOpen()) {
      const soon = document.createElement("p");
      soon.className = "wardrobe-shop__coming-soon";
      soon.textContent = SHOP_COMING_SOON_HEADING;
      layout.appendChild(soon);
      const detail = document.createElement("p");
      detail.className = "wardrobe-shop__desc wardrobe-shop__desc--achievements";
      detail.textContent = SHOP_COMING_SOON_BODY;
      layout.appendChild(detail);
      body.appendChild(layout);
      return;
    }

    const intro = document.createElement("p");
    intro.className = "wardrobe-shop__desc wardrobe-shop__desc--achievements";
    intro.textContent = SHOP_ACHIEVEMENTS_ONLY_COPY;
    layout.appendChild(intro);

    const featured = data?.featured ?? [];
    if (featured.length === 0) {
      selectedShopSku = null;
    } else {
      const featuredHeading = document.createElement("h4");
      featuredHeading.className = "wardrobe-shop__subheading";
      featuredHeading.textContent = "Featured today";
      layout.appendChild(featuredHeading);
      if (selectedShopSku && !featured.some((e) => e.cosmeticSku === selectedShopSku)) {
        selectedShopSku = null;
      }
      const list = document.createElement("div");
      list.className = "wardrobe-shop__list";
      list.setAttribute("role", "list");
      list.setAttribute("aria-label", "Featured cosmetics");
      for (const entry of featured) list.appendChild(renderShopRow(entry));
      layout.appendChild(list);
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
    if (view === "wardrobe") {
      if (!data) renderWardrobeSkeleton();
      else renderWardrobeTab();
    } else if (!data) {
      renderShopSkeleton();
    } else {
      renderShopTab();
    }
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

  function wardrobeDataFingerprint(next: WardrobeResponse): string {
    return JSON.stringify(next);
  }

  async function refresh(opts?: { force?: boolean }): Promise<void> {
    const token = loadCachedSession()?.token;
    if (!token) {
      showNote("Sign in with your wallet to use Wardrobe.");
      return;
    }
    note.hidden = true;
    const next = await fetchWardrobe({ force: opts?.force });
    if (data && wardrobeDataFingerprint(data) === wardrobeDataFingerprint(next)) {
      return;
    }
    data = next;
    render();
  }

  if (opts.initialData) {
    data = opts.initialData;
  }
  render();
  return {
    refresh,
    revertAllPreview,
    disposePreviewCanvas,
    setView,
    getData: () => data,
  };
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
    const presetName = preset ? humanizePresetId(preset) : "None";
    const tipHost = document.createElement("div");
    tipHost.className = "wardrobe-slot-tip-host";
    const chip = document.createElement("span");
    chip.className = `wardrobe-slot wardrobe-slot--readonly${
      preset ? " wardrobe-slot--equipped" : ""
    }`;
    chip.setAttribute("aria-label", slotAriaLabel(SLOT_LABELS[slot], presetName));
    chip.tabIndex = 0;
    const swatch = createPresetSwatch(preset, slot);
    chip.appendChild(swatch);
    tipHost.append(chip, createWardrobeSlotTooltip(SLOT_LABELS[slot]));
    bindWardrobeSlotTooltip(tipHost, chip);
    const name = document.createElement("span");
    name.className = "wardrobe-slot__name";
    name.textContent = presetName;
    const cell = document.createElement("div");
    cell.className = "wardrobe-slot-cell";
    cell.append(tipHost, name);
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
