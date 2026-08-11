/**
 * Sale Display admin bind modal + player try/buy panel.
 * Binder source: GET /api/cosmetics/shop (Published, shop-listable).
 */
import {
  createUnlockIntent,
  fetchPublishedShop,
  fetchWardrobe,
  syncUnlockPayment,
  updateLoadoutSlot,
  type ShopEntry,
} from "../cosmetics/api.js";
import type { SaleDisplayWire } from "../cosmetics/saleDisplayTypes.js";
import { isShopPubliclyOpen } from "../cosmetics/shopAccess.js";
import { loadCachedSession } from "../auth/session.js";

function nimPriceLabel(priceLuna: string): string {
  const luna = Number(priceLuna);
  if (!Number.isFinite(luna) || luna <= 0) return "Free";
  const nim = luna / 100_000;
  if (Number.isInteger(nim)) return `${nim} NIM`;
  return `${nim.toFixed(2)} NIM`;
}

function isPassiveSlot(slot: string | undefined): boolean {
  return (
    slot === "aura" ||
    slot === "nameplate" ||
    slot === "chatBubble" ||
    slot === "trail"
  );
}

export type SaleDisplayEditHandlers = {
  onBind: (id: string, cosmeticSku: string) => void;
  onClear: (id: string) => void;
  onDelete: (id: string) => void;
  onBeginMove: (id: string, x: number, z: number) => void;
};

export type SaleDisplayBuyHandlers = {
  onPreview: (slot: string, presetId: string) => void;
  onEquipped?: () => void;
};

export function createSaleDisplayPanels(host: HTMLElement): {
  promptEdit: (wire: SaleDisplayWire, handlers: SaleDisplayEditHandlers) => void;
  promptBuy: (wire: SaleDisplayWire, handlers: SaleDisplayBuyHandlers) => void;
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
      <p class="sale-display-overlay__status" id="sale-display-buy-status" hidden></p>
      <div class="sale-display-overlay__actions" id="sale-display-buy-actions"></div>
    </div>
  `;

  host.append(editOverlay, buyOverlay);

  const skuSelect = editOverlay.querySelector(
    "#sale-display-edit-sku"
  ) as HTMLSelectElement;
  const editHint = editOverlay.querySelector(
    "#sale-display-edit-hint"
  ) as HTMLElement;
  const editStatus = editOverlay.querySelector(
    "#sale-display-edit-status"
  ) as HTMLElement;
  const buyMeta = buyOverlay.querySelector(
    "#sale-display-buy-meta"
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

  function closeBuy(): void {
    buyOverlay.hidden = true;
    buyActions.replaceChildren();
  }

  function closeAll(): void {
    closeEdit();
    closeBuy();
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
            const { intent } = await createUnlockIntent(entry!.cosmeticSku);
            setBuyStatus(
              `Send ${intent.amountNimLabel} NIM. Memo: ${intent.memo}. Waiting…`
            );
            try {
              await navigator.clipboard.writeText(intent.memo);
            } catch {
              /* optional */
            }
            for (let attempt = 0; attempt < 40; attempt++) {
              await new Promise((r) => setTimeout(r, 3000));
              const synced = await syncUnlockPayment(
                intent.intentId,
                entry!.cosmeticSku
              );
              if (synced.granted) {
                setBuyStatus(`Unlocked ${entry!.displayName}!`);
                closeBuy();
                void promptBuy(wire, handlers);
                return;
              }
            }
            setBuyStatus("Still waiting for payment.", true);
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

  return {
    promptEdit,
    promptBuy: (wire, handlers) => {
      void promptBuy(wire, handlers);
    },
    closeAll,
    destroy: () => {
      closeAll();
      editOverlay.remove();
      buyOverlay.remove();
    },
  };
}
