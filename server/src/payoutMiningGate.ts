import { listOpenMiningChallengeWallets, miningClaimDenialReason } from "./miningChallenge.js";
import { isMiningBanned, listMiningBannedWalletKeys } from "./moderationStore.js";
import { normalizeWalletKey } from "./playerWalletLabel.js";

/** Block-claim mining payouts use grid coordinates; other rewards use sentinel tile keys. */
export function isBlockClaimMiningPayoutTileKey(tileKey: string): boolean {
  return /^\d+,\d+(,\d+)?$/.test(String(tileKey ?? "").trim());
}

/** When true, keep the pay-intent in backlog and do not deliver or send on-chain. */
export function shouldHoldMiningPayoutForBannedWallet(
  recipientAddress: string,
  tileKey: string
): boolean {
  if (!isBlockClaimMiningPayoutTileKey(tileKey)) return false;
  const key = normalizeWalletKey(recipientAddress);
  if (!key) return false;
  if (miningClaimDenialReason(key) !== null) return true;
  return isMiningBanned(key);
}

/** Wallets whose block-claim payouts must stay held: Mining Restriction or an open Mining Challenge. */
export function listMiningPayoutHeldWalletKeys(): string[] {
  const held = new Set(listMiningBannedWalletKeys());
  for (const wallet of listOpenMiningChallengeWallets()) held.add(wallet);
  return [...held];
}
