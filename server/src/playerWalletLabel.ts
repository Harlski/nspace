import { getEffectivePlayerDisplayName } from "./playerProfileStore.js";

/** Normalize a Nimiq wallet for map lookups (collapse whitespace, uppercase). */
export function normalizeWalletKey(address: string): string {
  return String(address ?? "")
    .replace(/\s+/g, "")
    .trim()
    .toUpperCase();
}

/** In-game display label: custom username when set, otherwise wallet shorthand. */
export function playerWalletLabel(address: string): string {
  const key = normalizeWalletKey(address);
  if (!key) return "";
  return getEffectivePlayerDisplayName(key);
}
