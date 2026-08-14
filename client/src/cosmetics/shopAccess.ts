/**
 * Player-facing cosmetic shop gate. Compile-time `VITE_SHOP_ENABLED=0` still
 * force-closes that SPA. Live sessions follow the server Shop-open flag from
 * welcome / `shopAccess` so `/admin/settings` can close Shop without a rebuild.
 */

export function shopEnabledFromEnvFlag(value: string | undefined): boolean {
  return value !== "0";
}

let sessionShopOpen: boolean | null = null;
let sessionShaperReachable: boolean | null = null;

export function applySessionShopAccess(opts: {
  shopOpen?: boolean;
  shaperReachable?: boolean;
}): void {
  if (typeof opts.shopOpen === "boolean") {
    sessionShopOpen = opts.shopOpen;
  }
  if (typeof opts.shaperReachable === "boolean") {
    sessionShaperReachable = opts.shaperReachable;
  }
}

/** Test hook: drop session overrides so the next assertion sees compile-time env. */
export function resetSessionShopAccess(): void {
  sessionShopOpen = null;
  sessionShaperReachable = null;
}

export function isShopPubliclyOpen(): boolean {
  if (!shopEnabledFromEnvFlag(import.meta.env.VITE_SHOP_ENABLED)) return false;
  if (sessionShopOpen !== null) return sessionShopOpen;
  return true;
}

export function isShaperReachable(): boolean {
  if (!isShopPubliclyOpen()) return false;
  if (sessionShaperReachable !== null) return sessionShaperReachable;
  return true;
}

export const SHOP_COMING_SOON_HEADING = "COMING SOON";

export const SHOP_COMING_SOON_BODY =
  "The cosmetic shop isn't open yet. Wardrobe still holds what you've earned through Achievements.";
