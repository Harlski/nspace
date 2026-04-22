/**
 * Normalizes a Nimiq user-friendly address for `@nimiq/identicons` hashing.
 * Compact strings (no spaces) produce a different image than wallets show.
 */
export function toNimiqUserFriendlyForIdenticon(addr: string): string {
  const raw = String(addr).trim();
  if (!raw) return raw;
  if (/\s/.test(raw)) {
    return raw.replace(/\s+/g, " ").trim();
  }
  const compact = raw.replace(/\s+/g, "").toUpperCase();
  if (compact.length <= 8) return raw;
  const chunks: string[] = [];
  for (let i = 0; i < compact.length; i += 4) {
    chunks.push(compact.slice(i, i + 4));
  }
  return chunks.join(" ");
}
