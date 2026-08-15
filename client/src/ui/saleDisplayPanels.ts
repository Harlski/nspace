/**
 * Sale Display admin bind modal + player try/buy panel.
 * Binder source: GET /api/cosmetics/shop (Published, shop-listable).
 */
import {
  fetchPublishedShop,
  fetchWardrobe,
  updateLoadoutSlot,
  type ShopEntry,
  type WardrobeResponse,
} from "../cosmetics/api.js";
import { runCosmeticUnlockCheckout } from "../cosmetics/unlockCheckout.js";
import type { SaleDisplayWire } from "../cosmetics/saleDisplayTypes.js";
import { isShopPubliclyOpen } from "../cosmetics/shopAccess.js";
import {
  PASSIVE_SLOTS,
  loadoutSkuKey,
  type PassiveSlotId,
} from "../cosmetics/presetSwatch.js";
import { loadCachedSession } from "../auth/session.js";

function nimPriceLabel(priceLuna: string): string {
  const luna = Number(priceLuna);
  if (!Number.isFinite(luna) || luna <= 0) return "Free";
  const nim = luna / 100_000;
  if (Number.isInteger(nim)) return `${nim} NIM`;
  return `${nim.toFixed(2)} NIM`;
}

function isPassiveSlot(slot: string | undefined): slot is PassiveSlotId {
  return (
    slot === "aura" ||
    slot === "nameplate" ||
    slot === "chatBubble" ||
    slot === "trail"
  );
}

/** Self loadout presets with one Slot overridden by the item being bought. */
export function purchasePreviewPresets(
  wardrobe: WardrobeResponse,
  purchase: { slot: string; presetId: string }
): Partial<Record<PassiveSlotId, string | null>> {
  const bySku = new Map(wardrobe.shop.map((s) => [s.cosmeticSku, s]));
  const out: Partial<Record<PassiveSlotId, string | null>> = {};
  for (const slot of PASSIVE_SLOTS) {
    const sku = wardrobe.loadout[loadoutSkuKey(slot)];
    out[slot] = sku ? bySku.get(sku)?.presetId ?? null : null;
  }
  if (isPassiveSlot(purchase.slot) && purchase.presetId) {
    out[purchase.slot] = purchase.presetId;
  }
  return out;
}

export type SaleDisplayEditHandlers = {
  onBind: (id: string, cosmeticSku: string) => void;
  onClear: (id: string) => void;
  onDelete: (id: string) => void;
  onBeginMove: (id: string, x: number, z: number) => void;
  onSetWalk?: (
    id: string,
    walk: { enabled: boolean; tiles: { x: number; z: number }[] }
  ) => void;
  onBeginSetPath?: (
    id: string,
    draft: {
      enabled: boolean;
      tiles: { x: number; z: number }[];
      x: number;
      z: number;
    }
  ) => void;
};

export type SaleDisplayBuyHandlers = {
  onPreview: (slot: string, presetId: string) => void;
  onPreviewCanvas?: (canvas: HTMLCanvasElement | null, wallet: string) => void;
  onPreviewCosmeticsChange?: (
    presets: Partial<Record<PassiveSlotId, string | null>>
  ) => void;
  onEquipped?: () => void;
};

export type SaleDisplayPathPickBarHandlers = {
  onConfirm: () => void;
  onCancel: () => void;
};

export function createSaleDisplayPanels(host: HTMLElement): {
  promptEdit: (wire: SaleDisplayWire, handlers: SaleDisplayEditHandlers) => void;
  promptBuy: (wire: SaleDisplayWire, handlers: SaleDisplayBuyHandlers) => void;
  showPathPickBar: (
    opts: { tileCount: number; handlers: SaleDisplayPathPickBarHandlers }
  ) => void;
  updatePathPickBar: (tileCount: number) => void;
  hidePathPickBar: () => void;
  closeAll: () => void;
  destroy: () => void;
} {
  const editOverlay = document.createElement("div");
  editOverlay.className = "sale-display-overlay";
  editOverlay.hidden = true;
  editOverlay.innerHTML = `
    <div class="sale-display-overlay__panel" role="dialog" aria-modal="true" aria-labelledby="sale-display-edit-title">
      <h2 id="sale-display-edit-title" class="sale-display-overlay__title">Sale Display</h2>
      <p class="sale-display-overlay__hint" id="sale-display-edit-hint"></p>
      <label class="sale-display-overlay__field">
        <span>Published Catalog Entry</span>
        <select id="sale-display-edit-sku" class="sale-display-overlay__select" size="8"></select>
      </label>
      <div class="sale-display-overlay__walk" id="sale-display-edit-walk" hidden>
        <label class="sale-display-overlay__check">
          <input type="checkbox" id="sale-display-edit-walk-enabled" />
          <span>Mannequin walks</span>
        </label>
        <p class="sale-display-overlay__walk-meta" id="sale-display-edit-walk-meta"></p>
        <div class="sale-display-overlay__actions sale-display-overlay__actions--walk">
          <button type="button" class="sale-display-overlay__btn sale-display-overlay__btn--ghost" data-act="set-path">Set path</button>
          <button type="button" class="sale-display-overlay__btn sale-display-overlay__btn--ghost" data-act="clear-path">Clear path</button>
          <button type="button" class="sale-display-overlay__btn" data-act="save-walk">Save walk</button>
        </div>
      </div>
      <p class="sale-display-overlay__status" id="sale-display-edit-status" hidden></p>
      <div class="sale-display-overlay__actions">
        <button type="button" class="sale-display-overlay__btn" data-act="bind">Bind</button>
        <button type="button" class="sale-display-overlay__btn sale-display-overlay__btn--ghost" data-act="clear">Clear</button>
        <button type="button" class="sale-display-overlay__btn sale-display-overlay__btn--ghost" data-act="move">Move</button>
        <button type="button" class="sale-display-overlay__btn sale-display-overlay__btn--danger" data-act="delete">Remove</button>
        <button type="button" class="sale-display-overlay__btn sale-display-overlay__btn--ghost" data-act="cancel">Cancel</button>
      </div>
    </div>
  `;

  const buyOverlay = document.createElement("div");
  buyOverlay.className = "sale-display-overlay";
  buyOverlay.hidden = true;
  buyOverlay.innerHTML = `
    <div class="sale-display-overlay__panel" role="dialog" aria-modal="true" aria-labelledby="sale-display-buy-title">
      <h2 id="sale-display-buy-title" class="sale-display-overlay__title">For sale</h2>
      <p class="sale-display-overlay__hint" id="sale-display-buy-meta"></p>
      <div class="sale-display-overlay__preview" id="sale-display-buy-preview" hidden>
        <div class="wardrobe-doll wardrobe-doll--mini sale-display-overlay__doll">
          <canvas class="wardrobe-doll__canvas" width="112" height="112" aria-label="You with this cosmetic — click to cycle background"></canvas>
        </div>
      </div>
      <p class="sale-display-overlay__status" id="sale-display-buy-status" hidden></p>
      <div class="sale-display-overlay__actions" id="sale-display-buy-actions"></div>
    </div>
  `;

  host.append(editOverlay, buyOverlay);

  const pathBar = document.createElement("div");
  pathBar.className = "sale-display-path-bar";
  pathBar.hidden = true;
  pathBar.innerHTML = `
    <div class="sale-display-path-bar__inner" role="region" aria-label="Mannequin walk path">
      <p class="sale-display-path-bar__title">Sale Display walk path</p>
      <p class="sale-display-path-bar__meta" id="sale-display-path-bar-meta"></p>
      <div class="sale-display-path-bar__actions">
        <button type="button" class="sale-display-overlay__btn sale-display-overlay__btn--ghost" data-path-act="cancel">Cancel</button>
        <button type="button" class="sale-display-overlay__btn" data-path-act="confirm">Confirm path</button>
      </div>
    </div>
  `;
  host.appendChild(pathBar);

  const pathBarMeta = pathBar.querySelector(
    "#sale-display-path-bar-meta"
  ) as HTMLElement;
  let pathBarHandlers: SaleDisplayPathPickBarHandlers | null = null;

  function setPathBarMeta(tileCount: number): void {
    pathBarMeta.textContent =
      tileCount === 0
        ? "Click tiles to add. Click a selected tile to undo from there. Needs ≥2 tiles to walk."
        : tileCount === 1
          ? "1 tile selected — add another, or Cancel. Needs ≥2 to walk."
          : `${tileCount} tiles selected — Confirm to save, or Cancel to discard.`;
  }

  function hidePathPickBar(): void {
    pathBar.hidden = true;
    pathBarHandlers = null;
  }

  function updatePathPickBar(tileCount: number): void {
    if (pathBar.hidden) return;
    setPathBarMeta(tileCount);
  }

  function showPathPickBar(opts: {
    tileCount: number;
    handlers: SaleDisplayPathPickBarHandlers;
  }): void {
    pathBarHandlers = opts.handlers;
    setPathBarMeta(opts.tileCount);
    pathBar.hidden = false;
  }

  pathBar.querySelectorAll("[data-path-act]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const act = (btn as HTMLElement).dataset.pathAct;
      if (act === "confirm") pathBarHandlers?.onConfirm();
      if (act === "cancel") pathBarHandlers?.onCancel();
    });
  });

  const skuSelect = editOverlay.querySelector(
    "#sale-display-edit-sku"
  ) as HTMLSelectElement;
  const editHint = editOverlay.querySelector(
    "#sale-display-edit-hint"
  ) as HTMLElement;
  const editStatus = editOverlay.querySelector(
    "#sale-display-edit-status"
  ) as HTMLElement;
  const walkSection = editOverlay.querySelector(
    "#sale-display-edit-walk"
  ) as HTMLElement;
  const walkEnabledInput = editOverlay.querySelector(
    "#sale-display-edit-walk-enabled"
  ) as HTMLInputElement;
  const walkMeta = editOverlay.querySelector(
    "#sale-display-edit-walk-meta"
  ) as HTMLElement;
  const buyMeta = buyOverlay.querySelector(
    "#sale-display-buy-meta"
  ) as HTMLElement;
  const buyPreviewHost = buyOverlay.querySelector(
    "#sale-display-buy-preview"
  ) as HTMLElement;
  const buyStatus = buyOverlay.querySelector(
    "#sale-display-buy-status"
  ) as HTMLElement;
  const buyActions = buyOverlay.querySelector(
    "#sale-display-buy-actions"
  ) as HTMLElement;

  let editHandlers: SaleDisplayEditHandlers | null = null;
  let editWire: SaleDisplayWire | null = null;
  let shopEntries: ShopEntry[] = [];
  let buyHandlers: SaleDisplayBuyHandlers | null = null;
  let buyPreviewBound = false;
  let editWalkTiles: { x: number; z: number }[] = [];

  /** Live canvas only — dispose recycles WebGL surfaces after forceContextLoss. */
  function buyPreviewCanvasEl(): HTMLCanvasElement {
    let canvas = buyPreviewHost.querySelector("canvas");
    if (canvas instanceof HTMLCanvasElement) return canvas;
    const doll = buyPreviewHost.querySelector(".sale-display-overlay__doll");
    canvas = document.createElement("canvas");
    canvas.className = "wardrobe-doll__canvas";
    canvas.width = 112;
    canvas.height = 112;
    canvas.setAttribute(
      "aria-label",
      "You with this cosmetic — click to cycle background"
    );
    (doll ?? buyPreviewHost).appendChild(canvas);
    return canvas;
  }

  function refreshWalkMeta(): void {
    const n = editWalkTiles.length;
    walkMeta.textContent =
      n === 0
        ? "No path set. Need at least 2 tiles to walk."
        : n === 1
          ? "1 tile selected — add one more for walking."
          : `${n} path tiles (walk when enabled).`;
  }

  function setEditStatus(text: string | null): void {
    if (!text) {
      editStatus.hidden = true;
      editStatus.textContent = "";
      return;
    }
    editStatus.hidden = false;
    editStatus.textContent = text;
  }

  function setBuyStatus(text: string | null, error = false): void {
    if (!text) {
      buyStatus.hidden = true;
      buyStatus.textContent = "";
      buyStatus.classList.remove("sale-display-overlay__status--error");
      return;
    }
    buyStatus.hidden = false;
    buyStatus.textContent = text;
    buyStatus.classList.toggle("sale-display-overlay__status--error", error);
  }

  function closeEdit(): void {
    editOverlay.hidden = true;
    editHandlers = null;
    editWire = null;
  }

  function releaseBuyPreview(): void {
    if (!buyPreviewBound) return;
    const wallet = loadCachedSession()?.address ?? "";
    buyHandlers?.onPreviewCanvas?.(null, wallet);
    buyPreviewBound = false;
    buyPreviewHost.hidden = true;
  }

  function closeBuy(): void {
    releaseBuyPreview();
    buyOverlay.hidden = true;
    buyActions.replaceChildren();
    buyHandlers = null;
  }

  async function bindBuyPreview(
    handlers: SaleDisplayBuyHandlers,
    entry: ShopEntry
  ): Promise<void> {
    if (!isPassiveSlot(entry.slot) || !entry.presetId) {
      releaseBuyPreview();
      return;
    }
    const session = loadCachedSession();
    if (!session?.token || !session.address) {
      releaseBuyPreview();
      return;
    }
    try {
      const wardrobe = await fetchWardrobe();
      const presets = purchasePreviewPresets(wardrobe, {
        slot: entry.slot,
        presetId: entry.presetId,
      });
      buyPreviewHost.hidden = false;
      if (!buyPreviewBound) {
        const canvas = buyPreviewCanvasEl();
        handlers.onPreviewCanvas?.(canvas, session.address);
        buyPreviewBound = true;
      }
      handlers.onPreviewCosmeticsChange?.(presets);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          handlers.onPreviewCosmeticsChange?.(presets);
        });
      });
    } catch {
      releaseBuyPreview();
    }
  }

  async function populateShopList(selectedSku: string | null): Promise<void> {
    skuSelect.replaceChildren();
    setEditStatus("Loading catalog…");
    try {
      shopEntries = await fetchPublishedShop();
      shopEntries.sort((a, b) =>
        a.displayName.localeCompare(b.displayName, undefined, {
          sensitivity: "base",
        })
      );
      const empty = document.createElement("option");
      empty.value = "";
      empty.textContent = shopEntries.length
        ? "— Choose a Catalog Entry —"
        : "No Published shop entries";
      skuSelect.appendChild(empty);
      for (const e of shopEntries) {
        const opt = document.createElement("option");
        opt.value = e.cosmeticSku;
        opt.textContent = `${e.displayName} (${e.slot}) · ${nimPriceLabel(e.priceLuna)}`;
        if (selectedSku && e.cosmeticSku === selectedSku) opt.selected = true;
        skuSelect.appendChild(opt);
      }
      setEditStatus(null);
    } catch (err) {
      setEditStatus(`Failed to load shop: ${String(err)}`);
    }
  }

  editOverlay.addEventListener("click", (ev) => {
    if (ev.target === editOverlay) closeEdit();
  });
  buyOverlay.addEventListener("click", (ev) => {
    if (ev.target === buyOverlay) closeBuy();
  });

  editOverlay.querySelectorAll("[data-act]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const act = (btn as HTMLElement).dataset.act;
      if (!editWire || !editHandlers) return;
      if (act === "cancel") {
        closeEdit();
        return;
      }
      if (act === "bind") {
        const sku = skuSelect.value.trim();
        if (!sku) {
          setEditStatus("Pick a Published Catalog Entry first.");
          return;
        }
        editHandlers.onBind(editWire.id, sku);
        closeEdit();
        return;
      }
      if (act === "clear") {
        editHandlers.onClear(editWire.id);
        closeEdit();
        return;
      }
      if (act === "move") {
        editHandlers.onBeginMove(editWire.id, editWire.x, editWire.z);
        closeEdit();
        return;
      }
      if (act === "delete") {
        editHandlers.onDelete(editWire.id);
        closeEdit();
        return;
      }
      if (act === "set-path") {
        editHandlers.onBeginSetPath?.(editWire.id, {
          enabled: walkEnabledInput.checked,
          tiles: editWalkTiles.map((t) => ({ x: t.x, z: t.z })),
          x: editWire.x,
          z: editWire.z,
        });
        closeEdit();
        return;
      }
      if (act === "clear-path") {
        editWalkTiles = [];
        refreshWalkMeta();
        return;
      }
      if (act === "save-walk") {
        editHandlers.onSetWalk?.(editWire.id, {
          enabled: walkEnabledInput.checked,
          tiles: editWalkTiles,
        });
        setEditStatus(
          walkEnabledInput.checked && editWalkTiles.length < 2
            ? "Saved — walking needs ≥2 tiles (stays put until then)."
            : "Walk settings saved."
        );
      }
    });
  });

  function promptEdit(
    wire: SaleDisplayWire,
    handlers: SaleDisplayEditHandlers
  ): void {
    closeBuy();
    editWire = wire;
    editHandlers = handlers;
    editWalkTiles = (wire.walkTiles ?? []).map((t) => ({ x: t.x, z: t.z }));
    walkEnabledInput.checked = wire.walkEnabled === true;
    const showWalk =
      wire.kind === "mannequin" ||
      (Boolean(wire.cosmeticSku) && !wire.bindInactive && wire.kind !== "floor");
    walkSection.hidden = !showWalk;
    refreshWalkMeta();
    const bound = wire.cosmeticSku
      ? wire.bindInactive
        ? `Bound SKU inactive for players: ${wire.cosmeticSku}`
        : `Currently bound: ${wire.label ?? wire.cosmeticSku}`
      : "Unbound — players cannot see this fixture.";
    editHint.textContent = bound;
    editOverlay.hidden = false;
    void populateShopList(wire.cosmeticSku);
  }

  async function promptBuy(
    wire: SaleDisplayWire,
    handlers: SaleDisplayBuyHandlers
  ): Promise<void> {
    closeEdit();
    releaseBuyPreview();
    buyHandlers = handlers;
    buyActions.replaceChildren();
    setBuyStatus(null);
    const title = buyOverlay.querySelector(
      "#sale-display-buy-title"
    ) as HTMLElement;
    title.textContent = wire.label?.trim() || "Cosmetic";
    buyMeta.textContent = wire.slot
      ? `${wire.slot}${wire.kind ? ` · ${wire.kind}` : ""}`
      : "";

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className =
      "sale-display-overlay__btn sale-display-overlay__btn--ghost";
    closeBtn.textContent = "Close";
    closeBtn.onclick = () => closeBuy();

    if (!wire.cosmeticSku || !wire.presetId || wire.bindInactive) {
      setBuyStatus("This display is not available.", true);
      buyActions.appendChild(closeBtn);
      buyOverlay.hidden = false;
      return;
    }

    if (!isShopPubliclyOpen()) {
      setBuyStatus("The shop is closed right now.", true);
      buyActions.appendChild(closeBtn);
      buyOverlay.hidden = false;
      return;
    }

    let entry: ShopEntry | null = null;
    let owned = false;
    try {
      if (loadCachedSession()?.token) {
        const wardrobe = await fetchWardrobe();
        entry =
          wardrobe.shop.find((s) => s.cosmeticSku === wire.cosmeticSku) ?? null;
        owned = Boolean(entry?.owned);
      } else {
        const shop = await fetchPublishedShop();
        entry = shop.find((s) => s.cosmeticSku === wire.cosmeticSku) ?? null;
      }
    } catch {
      entry = {
        cosmeticSku: wire.cosmeticSku,
        presetId: wire.presetId,
        slot: wire.slot ?? "aura",
        displayName: wire.label ?? wire.cosmeticSku,
        description: "",
        collection: "",
        priceLuna: "0",
      };
    }

    if (!entry) {
      entry = {
        cosmeticSku: wire.cosmeticSku,
        presetId: wire.presetId,
        slot: wire.slot ?? "aura",
        displayName: wire.label ?? wire.cosmeticSku,
        description: "",
        collection: "",
        priceLuna: "0",
      };
    }

    buyMeta.textContent = owned
      ? `${entry.slot} · Owned`
      : `${entry.slot} · ${nimPriceLabel(entry.priceLuna)}`;

    void bindBuyPreview(handlers, entry);

    if (isPassiveSlot(entry.slot) && entry.presetId) {
      const previewBtn = document.createElement("button");
      previewBtn.type = "button";
      previewBtn.className =
        "sale-display-overlay__btn sale-display-overlay__btn--ghost";
      previewBtn.textContent = "Try on";
      previewBtn.onclick = () => handlers.onPreview(entry!.slot, entry!.presetId);
      buyActions.appendChild(previewBtn);
    }

    if (!owned) {
      const buyBtn = document.createElement("button");
      buyBtn.type = "button";
      buyBtn.className = "sale-display-overlay__btn";
      buyBtn.textContent = "Buy";
      buyBtn.onclick = () => {
        void (async () => {
          if (!loadCachedSession()?.token) {
            setBuyStatus("Sign in with your wallet to buy.", true);
            return;
          }
          const original = buyBtn.textContent;
          try {
            buyBtn.disabled = true;
            const result = await runCosmeticUnlockCheckout(
              entry!.cosmeticSku,
              (msg) => setBuyStatus(msg)
            );
            if (result.ok) {
              setBuyStatus(`Unlocked ${entry!.displayName}!`);
              closeBuy();
              void promptBuy(wire, handlers);
              return;
            }
            setBuyStatus(result.message, true);
          } catch (e) {
            setBuyStatus(String(e), true);
          } finally {
            buyBtn.disabled = false;
            if (original !== null) buyBtn.textContent = original;
          }
        })();
      };
      buyActions.appendChild(buyBtn);
    } else if (isPassiveSlot(entry.slot)) {
      const equipBtn = document.createElement("button");
      equipBtn.type = "button";
      equipBtn.className = "sale-display-overlay__btn";
      equipBtn.textContent = "Equip";
      equipBtn.onclick = () => {
        void updateLoadoutSlot(entry!.slot, entry!.cosmeticSku)
          .then(() => {
            setBuyStatus("Equipped.");
            handlers.onEquipped?.();
            void bindBuyPreview(handlers, entry!);
          })
          .catch((e) => setBuyStatus(String(e), true));
      };
      buyActions.appendChild(equipBtn);
    } else if (entry.slot === "deployable") {
      setBuyStatus("Owned — use Action Wheel → Items to place.");
    }

    buyActions.appendChild(closeBtn);
    buyOverlay.hidden = false;
  }

  function closeAll(): void {
    closeEdit();
    closeBuy();
    hidePathPickBar();
  }

  return {
    promptEdit,
    promptBuy: (wire, handlers) => {
      void promptBuy(wire, handlers);
    },
    showPathPickBar,
    updatePathPickBar,
    hidePathPickBar,
    closeAll,
    destroy: () => {
      closeAll();
      editOverlay.remove();
      buyOverlay.remove();
      pathBar.remove();
    },
  };
}
