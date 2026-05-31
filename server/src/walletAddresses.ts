import { Address } from "@nimiq/core";

/** Compact Nimiq wallet key (strip spaces, uppercase). */
export function compactWalletKey(address: string): string {
  return String(address || "").replace(/\s+/g, "").trim().toUpperCase();
}

/** Parse comma/semicolon-separated Nimiq addresses (spaces inside an address are optional). */
export function parseWalletAddressList(raw: string | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  if (!raw) return out;
  for (const part of raw.split(/[,;]+/)) {
    const c = compactWalletKey(part);
    if (c && !seen.has(c)) {
      seen.add(c);
      out.push(c);
    }
  }
  return out;
}

/** Grouped display form (spaces every 4 chars) for admin UI. */
export function formatWalletAddressGrouped(compact: string): string {
  return compact.replace(/(.{4})(?=.)/g, "$1 ");
}

function isPlausibleNimiqAddress(compact: string): boolean {
  try {
    Address.fromUserFriendlyAddress(compact);
    return true;
  } catch {
    return false;
  }
}

/** Normalize admin-entered stream wallet field (comma-separated; spaces optional). */
export function normalizeStreamObserverAddressesField(raw: string): string {
  const keys = parseWalletAddressList(raw);
  for (const k of keys) {
    if (!isPlausibleNimiqAddress(k)) {
      throw new Error(`invalid_nimiq_address:${k.slice(0, 8)}`);
    }
  }
  return keys.map(formatWalletAddressGrouped).join(", ");
}
