/** First 4 + … + last 4 (readable short display). */
export function formatWalletAddressShort(address: string): string {
  const t = address.trim();
  if (t.length <= 8) return t;
  return `${t.slice(0, 4)}…${t.slice(-4)}`;
}

/** First 4 + last 4 concatenated, e.g. NQ97ABCD — for “Connect as …”. */
export function formatWalletAddressConnectAs(address: string): string {
  const t = address.trim();
  if (t.length <= 8) return t;
  return `${t.slice(0, 4)}${t.slice(-4)}`;
}
