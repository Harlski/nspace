import { isMiningBanned } from "./moderationStore.js";
import { isGuestWallet } from "./worldcup/goalReward.js";

export const BLOCK_CLAIM_MSG_MINING_RESTRICTED =
  "Mining is restricted on this account.";

export const BLOCK_CLAIM_MSG_GUEST =
  "Connect a wallet to earn NIM from mining.";

function normalizeWallet(address: string): string {
  return String(address ?? "")
    .replace(/\s+/g, "")
    .trim()
    .toUpperCase();
}

/** When non-null, block claim begin/complete for this wallet. */
export function blockClaimAccessDeniedReason(
  address: string
): string | null {
  if (isGuestWallet(address)) return BLOCK_CLAIM_MSG_GUEST;
  if (isMiningBanned(normalizeWallet(address))) {
    return BLOCK_CLAIM_MSG_MINING_RESTRICTED;
  }
  return null;
}
