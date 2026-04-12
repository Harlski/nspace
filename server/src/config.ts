/**
 * Server configuration and admin accounts
 */

/** Wallet addresses with admin privileges */
export const ADMIN_ADDRESSES = new Set([
  "NQ97 4M1T 4TGD VC7F LHLQ Y2DY 425N 5CVH M02Y",
]);

/** Check if a wallet address has admin privileges */
export function isAdmin(address: string): boolean {
  return ADMIN_ADDRESSES.has(address);
}
