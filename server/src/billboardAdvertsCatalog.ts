/**
 * Hardcoded billboard adverts (admin placement). Future: load from nimiq.space/advertise API.
 * IDs must match `client/src/game/billboardAdvertsCatalog.ts`.
 */
export type BillboardAdvertCatalogEntry = {
  id: string;
  /** Shown on “Visit {name}” and in the placement UI. */
  name: string;
  /** HTTPS target after user confirms; empty = no visit affordance. */
  visitUrl: string;
  slides: readonly string[];
  intervalMs: number;
};

export const BILLBOARD_ADVERTS_CATALOG: readonly BillboardAdvertCatalogEntry[] =
  [
    {
      id: "nimiq_bb",
      name: "Nimiq",
      visitUrl: "https://nimiq.com/",
      slides: ["/nimiq-bb.png"],
      intervalMs: 8000,
    },
    {
      id: "nimiqlive_bb",
      name: "Nimiq Live",
      visitUrl: "https://twitch.tv/nimiqlive",
      slides: ["/nimiqlive-bb.png"],
      intervalMs: 8000,
    },
    {
      id: "join_nimiqspace_telegram_bb",
      name: "Nimiq Space Telegram",
      visitUrl: "https://t.me/nimiqspace",
      slides: ["/join-nimiqspace-telegram-bb.png"],
      intervalMs: 8000,
    },
    {
      id: "ai_bb",
      name: "Cute Penguin",
      visitUrl: "",
      slides: ["/ai-bb.png"],
      intervalMs: 8000,
    },
  ];

export function getBillboardAdvertById(
  id: string
): BillboardAdvertCatalogEntry | undefined {
  const k = String(id ?? "").trim();
  return BILLBOARD_ADVERTS_CATALOG.find((a) => a.id === k);
}

/** Must match `BILLBOARD_MAX_SLIDES` in `billboards.ts`. */
const BILLBOARD_MAX_ADVERT_SLOTS = 8;

/**
 * Parse ordered catalog ids from a client `placeBillboard` / `updateBillboard` message.
 * Accepts `advertIds: string[]` or legacy single `advertId`.
 */
export function parseBillboardAdvertIdsFromMessage(msg: {
  advertIds?: unknown;
  advertId?: unknown;
}): string[] | null {
  let ids: string[] = [];
  if (Array.isArray(msg.advertIds)) {
    ids = msg.advertIds
      .map((x) => String(x ?? "").trim())
      .filter(Boolean)
      .slice(0, BILLBOARD_MAX_ADVERT_SLOTS);
  }
  if (ids.length === 0) {
    const one = String(msg.advertId ?? "").trim();
    if (one) ids = [one];
  }
  if (ids.length === 0) return null;
  for (const id of ids) {
    if (!getBillboardAdvertById(id)) return null;
  }
  return ids;
}

/** Every advert in the rotation must have https visitUrl when a URL is set. */
export function validateAdvertRotationVisitHttps(
  ids: readonly string[]
): boolean {
  for (const id of ids) {
    const ad = getBillboardAdvertById(id);
    if (!ad) return false;
    const v = String(ad.visitUrl ?? "").trim();
    if (!v) continue;
    try {
      if (new URL(v).protocol !== "https:") return false;
    } catch {
      return false;
    }
  }
  return true;
}
