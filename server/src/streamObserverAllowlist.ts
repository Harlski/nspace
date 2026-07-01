import { getAdminRuntimeSettings } from "./adminRuntimeSettingsStore.js";
import { compactWalletKey, parseWalletAddressList } from "./walletAddresses.js";

/** Lazy - env is read after `dotenv.config()` in `index.ts`. */
let streamObserverKeysCache: Set<string> | null = null;

export function invalidateStreamObserverAllowlistCache(): void {
  streamObserverKeysCache = null;
}

function getStreamObserverCompactKeys(): Set<string> {
  if (streamObserverKeysCache === null) {
    const merged = new Set<string>();
    for (const k of parseWalletAddressList(process.env.STREAM_OBSERVER_ADDRESSES)) {
      merged.add(k);
    }
    for (const k of parseWalletAddressList(getAdminRuntimeSettings().streamObserverAddresses)) {
      merged.add(k);
    }
    streamObserverKeysCache = merged;
  }
  return streamObserverKeysCache;
}

/** Wallets allowed to use cinema `?stream=1` observer sessions (full-board sync). */
export function isStreamObserver(address: string): boolean {
  const keys = getStreamObserverCompactKeys();
  if (keys.size === 0) return false;
  return keys.has(compactWalletKey(address));
}

export function streamObserverAllowlistConfigured(): boolean {
  return getStreamObserverCompactKeys().size > 0;
}

export function streamObserverEnvConfigured(): boolean {
  return parseWalletAddressList(process.env.STREAM_OBSERVER_ADDRESSES).length > 0;
}
