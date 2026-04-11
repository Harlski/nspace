/**
 * Human-facing wallet label: first 4 + last 4 characters, no gap (e.g. `NQAB` + `C123` → `NQABC123`).
 * Short strings (≤8 chars) are returned as-is (e.g. dev ids).
 */
export function walletDisplayName(address: string): string {
  const a = address.trim();
  if (a.length <= 8) return a;
  return `${a.slice(0, 4)}${a.slice(-4)}`;
}
