import {
  createUnlockIntent,
  fetchWardrobe,
  syncUnlockPayment,
  updateLoadoutSlot,
  type ShopEntry,
  type WardrobeResponse,
} from "./api.js";
import { loadCachedSession } from "../auth/session.js";

const PASSIVE_SLOTS = ["aura", "nameplate", "chatBubble", "trail"] as const;

function nimLabel(luna: string): string {
  const n = Number(BigInt(luna)) / 100_000;
  return n.toFixed(n >= 1 ? 2 : 5).replace(/\.?0+$/, "");
}

export function mountWardrobePanel(
  container: HTMLElement,
  opts: {
    onLoadoutChanged?: () => void;
    refreshPayBundle?: (intent: {
      intentId: string;
      amountNimLabel: string;
      memo: string;
    }) => void;
  } = {}
): { refresh: () => Promise<void> } {
  container.classList.add("wardrobe-panel");
  const tabs = document.createElement("div");
  tabs.className = "wardrobe-panel__tabs";
  const ownedTab = document.createElement("button");
  ownedTab.type = "button";
  ownedTab.className = "wardrobe-panel__tab is-active";
  ownedTab.textContent = "Owned";
  const shopTab = document.createElement("button");
  shopTab.type = "button";
  shopTab.className = "wardrobe-panel__tab";
  shopTab.textContent = "Shop";
  tabs.append(ownedTab, shopTab);

  const body = document.createElement("div");
  body.className = "wardrobe-panel__body";
  const note = document.createElement("p");
  note.className = "wardrobe-panel__note";
  note.hidden = true;
  container.replaceChildren(tabs, body, note);

  let data: WardrobeResponse | null = null;
  let view: "owned" | "shop" = "owned";

  function showNote(text: string, isErr = false): void {
    note.hidden = false;
    note.textContent = text;
    note.classList.toggle("wardrobe-panel__note--err", isErr);
  }

  function renderOwned(): void {
    if (!data) return;
    body.replaceChildren();
    const bySku = new Map(data.shop.map((s) => [s.cosmeticSku, s]));
    for (const ent of data.entitlements) {
      const meta = bySku.get(ent.cosmeticSku);
      const slot = meta?.slot ?? "unknown";
      const row = document.createElement("div");
      row.className = "wardrobe-panel__row";
      const title = document.createElement("span");
      title.textContent = meta?.displayName ?? ent.cosmeticSku;
      row.appendChild(title);
      if (PASSIVE_SLOTS.includes(slot as (typeof PASSIVE_SLOTS)[number])) {
        const loadoutKey = `${slot}Sku` as keyof typeof data.loadout;
        const equipped = data.loadout[loadoutKey] === ent.cosmeticSku;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "wardrobe-panel__btn";
        btn.textContent = equipped ? "Unequip" : "Equip";
        btn.onclick = async () => {
          if (!loadCachedSession()?.token) return;
          try {
            const next = equipped ? null : ent.cosmeticSku;
            const slotName =
              slot === "chatBubble" ? "chatBubble" : slot;
            await updateLoadoutSlot(slotName, next);
            await refresh();
            opts.onLoadoutChanged?.();
          } catch (e) {
            showNote(String(e), true);
          }
        };
        row.appendChild(btn);
      } else {
        const tag = document.createElement("span");
        tag.className = "wardrobe-panel__tag";
        tag.textContent = "Deployable";
        row.appendChild(tag);
      }
      body.appendChild(row);
    }
  }

  function renderShop(): void {
    if (!data) return;
    body.replaceChildren();
    const collections = new Map<string, ShopEntry[]>();
    for (const item of data.shop) {
      const c = item.collection.trim() || "General";
      const list = collections.get(c) ?? [];
      list.push(item);
      collections.set(c, list);
    }
    const token = loadCachedSession()?.token;
    for (const [name, items] of [...collections.entries()].sort(([a], [b]) =>
      a.localeCompare(b)
    )) {
      const h = document.createElement("h4");
      h.className = "wardrobe-panel__collection";
      h.textContent = name;
      body.appendChild(h);
      for (const item of items) {
        const row = document.createElement("div");
        row.className = "wardrobe-panel__row";
        const info = document.createElement("div");
        info.innerHTML = `<strong>${item.displayName}</strong><br/><span>${item.description || ""}</span>`;
        row.appendChild(info);
        if (item.owned) {
          const owned = document.createElement("span");
          owned.className = "wardrobe-panel__tag";
          owned.textContent = "Owned";
          row.appendChild(owned);
        } else if (token) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "wardrobe-panel__btn wardrobe-panel__btn--buy";
          btn.textContent = `${nimLabel(item.priceLuna)} NIM`;
          btn.onclick = async () => {
            try {
              btn.disabled = true;
              const { intent } = await createUnlockIntent(item.cosmeticSku);
              showNote(
                `Send ${intent.amountNimLabel} NIM in your wallet. Memo: ${intent.memo}. Waiting for confirmation…`
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
                  item.cosmeticSku
                );
                if (synced.granted) {
                  showNote("Unlocked!");
                  await refresh();
                  break;
                }
              }
            } catch (e) {
              showNote(String(e), true);
            } finally {
              btn.disabled = false;
            }
          };
          row.appendChild(btn);
        } else {
          const guest = document.createElement("span");
          guest.className = "wardrobe-panel__tag";
          guest.textContent = "Sign in to buy";
          row.appendChild(guest);
        }
        body.appendChild(row);
      }
    }
  }

  function render(): void {
    if (view === "owned") renderOwned();
    else renderShop();
  }

  ownedTab.onclick = () => {
    view = "owned";
    ownedTab.classList.add("is-active");
    shopTab.classList.remove("is-active");
    render();
  };
  shopTab.onclick = () => {
    view = "shop";
    shopTab.classList.add("is-active");
    ownedTab.classList.remove("is-active");
    render();
  };

  async function refresh(): Promise<void> {
    const token = loadCachedSession()?.token;
    if (!token) {
      showNote("Sign in with your wallet to use Wardrobe.");
      return;
    }
    note.hidden = true;
    data = await fetchWardrobe(token);
    render();
  }

  void refresh();
  return { refresh };
}
