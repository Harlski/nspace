import { compactWalletKey, parseWalletAddressList } from "../walletAddresses.js";

/**
 * NimiqLIVE Wallet allowlist: the only addresses that may POST Live Events.
 * Env `LIVE_EVENT_ADDRESSES` (comma/semicolon-separated). Fail closed when empty.
 */
export function liveEventAllowlistKeys(): string[] {
  return parseWalletAddressList(process.env.LIVE_EVENT_ADDRESSES);
}

export function liveEventAllowlistConfigured(): boolean {
  return liveEventAllowlistKeys().length > 0;
}

export function isLiveEventWallet(address: string): boolean {
  const key = compactWalletKey(address);
  if (!key) return false;
  return liveEventAllowlistKeys().includes(key);
}
