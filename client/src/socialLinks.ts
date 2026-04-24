/** Shared with main menu and in-game brand modal. */
export const TELEGRAM_URL = "https://t.me/nimiqspace";
export const X_URL = "https://x.com/nimiqspace";
export const NIMIQ_WALLET_URL = "https://wallet.nimiq.com";

/**
 * Recipient deep link for Nimiq Wallet (same string encoded in the Nimiq Space payment QR).
 * Opens wallet.nimiq.com with the recipient pre-selected for sending.
 */
export function nimiqWalletRecipientDeepLink(recipientRaw: string): string {
  const normalized = recipientRaw.replace(/\s+/g, "").trim().toUpperCase();
  return `${NIMIQ_WALLET_URL}/nimiq:${normalized}`;
}
