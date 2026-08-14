/**
 * Player-facing cosmetic shop gate. Open by default; set SHOP_ENABLED=0 to
 * hard-close (blocks Shaper joins, featured shelf purchases, and unlock
 * intents) regardless of the admin runtime checkbox.
 */

import { getAdminRuntimeSettings } from "./adminRuntimeSettingsStore.js";

export function shopEnabledFromEnvFlag(value: string | undefined): boolean {
  return value !== "0";
}

export function isShopEnvEnabled(): boolean {
  return shopEnabledFromEnvFlag(process.env.SHOP_ENABLED);
}

export function isShopOpenFromFlags(opts: {
  envFlag: string | undefined;
  adminShopEnabled: boolean;
}): boolean {
  return shopEnabledFromEnvFlag(opts.envFlag) && opts.adminShopEnabled;
}

export function isShopPubliclyOpen(): boolean {
  return isShopOpenFromFlags({
    envFlag: process.env.SHOP_ENABLED,
    adminShopEnabled: getAdminRuntimeSettings().shopEnabled,
  });
}
