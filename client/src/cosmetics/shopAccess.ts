/**
 * Player-facing cosmetic shop gate (build-time). Off unless VITE_SHOP_ENABLED=1 at build.
 * Keep in sync with server `SHOP_ENABLED` for deploy profiles that open the shop.
 */
export function isShopPubliclyOpen(): boolean {
  return import.meta.env.VITE_SHOP_ENABLED === "1";
}

export const SHOP_COMING_SOON_HEADING = "COMING SOON";

export const SHOP_COMING_SOON_BODY =
  "The cosmetic shop isn't open yet. Wardrobe still holds what you've earned through Achievements.";
