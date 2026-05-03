/**
 * Hardcoded billboard adverts (admin placement UI). Keep in sync with
 * `server/src/billboardAdvertsCatalog.ts` until nimiq.space/advertise is wired.
 */

/** Max adverts in one billboard rotation (matches server `BILLBOARD_MAX_SLIDES`). */
export const BILLBOARD_MAX_ADVERT_SLOTS = 8;

export type BillboardAdvertCatalogEntry = {
  id: string;
  name: string;
  /** Empty = billboard art only; no “Visit” pill when standing on the footprint. */
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
