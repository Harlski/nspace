/**
 * Return Walk constants. Vocabulary matches Resident CONTEXT.md. Do not invent synonyms.
 */

import { LUNA_PER_NIM } from "../payoutGateway.js";
import { compactWalletKey } from "../walletAddresses.js";

/** Stream Faucet hot wallet. Return Gold must not pay from this address. */
export const STREAM_FAUCET_ADDRESS =
  "NQ21 F410 VXJB UK02 6TLG 8YHT 4M4B L664 NPM7";

export const STREAM_FAUCET_COMPACT = compactWalletKey(STREAM_FAUCET_ADDRESS);

/** Credited Deposit size that opens a Return Walk. */
export const RETURN_WALK_DEPOSIT_NIM = 1000;

export const RETURN_WALK_DEPOSIT_LUNA =
  BigInt(RETURN_WALK_DEPOSIT_NIM) * LUNA_PER_NIM;

/** Each Upgrade / Return Gold claim is 1 NIM. */
export const RETURN_GOLD_NIM = 1;

export const RETURN_GOLD_LUNA = BigInt(RETURN_GOLD_NIM) * LUNA_PER_NIM;

/** Unpaid Invoice lifetime. */
export const INVOICE_TTL_MS = 30 * 60 * 1000;

/** Upgrade Window length. Upgrades fire at independent random delays in this span. */
export const UPGRADE_WINDOW_MS = 20_000;

/** How many Upgrades one window schedules. */
export const UPGRADES_PER_WINDOW = 8;

/**
 * Chebyshev radius (max(|dx|, |dz|)) around Resident pose at fire time.
 * Eligible ordinary solids in this square are drawn uniformly at random,
 * including tiles that are not orthogonally adjacent.
 */
export const UPGRADE_VICINITY_RADIUS = 8;

export const INVOICE_ID_PREFIX = "inv-";

export type InvoiceStatus = "unpaid" | "credited" | "expired";

export type PublicRoomKind =
  | "commons"
  | "public"
  | "playSpace"
  | "tutorial"
  | "matchPitch";

export type GoldKind = "goldBlock" | "returnGold";
