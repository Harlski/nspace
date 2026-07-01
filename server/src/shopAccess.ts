/**
 * Player-facing cosmetic shop gate. Off by default until operators set SHOP_ENABLED=1.
 * Blocks Shaper joins, featured shelf purchases, and unlock intents while closed.
 */
export function isShopPubliclyOpen(): boolean {
  return process.env.SHOP_ENABLED === "1";
}
