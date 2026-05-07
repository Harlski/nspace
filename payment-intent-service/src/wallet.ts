/** Match game server convention: trim spaces, uppercase user-friendly address. */
export function normalizeWalletId(v: string): string {
  return String(v || "").replace(/\s+/g, "").toUpperCase();
}
