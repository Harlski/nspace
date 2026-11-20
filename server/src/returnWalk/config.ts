/**
 * Resident allowlist and Server Wallet for Return Walk.
 * Fail closed: empty allowlist means no wallet may create Invoices.
 */

import {
  compactWalletKey,
  formatWalletAddressGrouped,
  parseWalletAddressList,
} from "../walletAddresses.js";
import { STREAM_FAUCET_COMPACT } from "./constants.js";

let residentKeysCache: Set<string> | null = null;

export function invalidateReturnWalkConfigCache(): void {
  residentKeysCache = null;
}

function residentCompactKeys(): Set<string> {
  if (residentKeysCache === null) {
    residentKeysCache = new Set(
      parseWalletAddressList(process.env.RESIDENT_ADDRESSES)
    );
  }
  return residentKeysCache;
}

/** True when the JWT wallet is the configured NimiqLIVE Resident wallet. */
export function isResidentWallet(address: string): boolean {
  const keys = residentCompactKeys();
  if (keys.size === 0) return false;
  return keys.has(compactWalletKey(address));
}

export function residentAllowlistConfigured(): boolean {
  return residentCompactKeys().size > 0;
}

/**
 * On-chain Server Wallet that receives Deposits (Invoice `to`).
 * Distinct from the Stream Faucet and from the Resident key.
 */
export function getServerWalletAddress(): string | null {
  const raw = String(process.env.RETURN_WALK_SERVER_WALLET_ADDRESS ?? "").trim();
  if (!raw) return null;
  const compact = compactWalletKey(raw);
  if (!compact) return null;
  if (compact === STREAM_FAUCET_COMPACT) {
    console.error(
      "[return-walk] RETURN_WALK_SERVER_WALLET_ADDRESS must not be the Stream Faucet"
    );
    return null;
  }
  return formatWalletAddressGrouped(compact);
}

export function getServerWalletCompact(): string | null {
  const grouped = getServerWalletAddress();
  return grouped ? compactWalletKey(grouped) : null;
}

export function getNimRpcUrl(): string | null {
  const s = String(process.env.NIM_RPC_URL ?? "").trim();
  return s || null;
}
