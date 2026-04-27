/** First 4 + … + last 4 (readable short display). */
export function formatWalletAddressShort(address: string): string {
  const t = address.trim();
  if (t.length <= 8) return t;
  return `${t.slice(0, 4)}…${t.slice(-4)}`;
}

/** Normalized (no spaces), first 4 + spaced ellipsis + last 4, e.g. `NQ00 … 1234`. */
export function formatWalletAddressGap4(address: string): string {
  const c = address.replace(/\s+/g, "").trim().toUpperCase();
  if (c.length <= 8) return c;
  return `${c.slice(0, 4)} … ${c.slice(-4)}`;
}

/** First 4 + last 4 concatenated, e.g. NQ97ABCD — for “Connect as …”. */
export function formatWalletAddressConnectAs(address: string): string {
  const t = address.trim();
  if (t.length <= 8) return t;
  return `${t.slice(0, 4)}${t.slice(-4)}`;
}

/** Full address in groups of four (uppercase, spaces), for readable ID-style display. */
export function formatWalletAddressSpaced(address: string): string {
  const c = address.replace(/\s+/g, "").trim().toUpperCase();
  if (!c) return "";
  const parts: string[] = [];
  for (let i = 0; i < c.length; i += 4) {
    parts.push(c.slice(i, i + 4));
  }
  return parts.join(" ");
}
