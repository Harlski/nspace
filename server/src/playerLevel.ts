/**
 * Player Level and Daily Earn Allowance (pure helpers).
 * See docs/adr/0014-player-level-daily-earn-allowance.md and CONTEXT.md.
 */

import { LUNA_PER_NIM } from "./payoutGateway.js";

/** NIM/day ceiling for Levels 1–10; Level 11+ is uncapped. */
export const DAILY_EARN_ALLOWANCE_NIM_BY_LEVEL: readonly number[] = [
  10, 15, 20, 30, 40, 50, 65, 80, 90, 100,
];

/** First Level with no Level-based daily NIM ceiling. */
export const DAILY_EARN_ALLOWANCE_UNCAPPED_LEVEL = 11;

export function playerLevelFromPoints(achievementPoints: number): number {
  const pts = Math.max(0, Math.floor(Number(achievementPoints) || 0));
  return Math.floor(pts / 100) + 1;
}

/**
 * Daily Earn Allowance ceiling in luna for a Level, or `null` when uncapped.
 */
export function dailyEarnAllowanceLuna(level: number): bigint | null {
  const lv = Math.max(1, Math.floor(Number(level) || 1));
  if (lv >= DAILY_EARN_ALLOWANCE_UNCAPPED_LEVEL) return null;
  const nim = DAILY_EARN_ALLOWANCE_NIM_BY_LEVEL[lv - 1] ?? 10;
  return BigInt(nim) * LUNA_PER_NIM;
}

export type DailyEarnAllowanceDecision = {
  /** Luna to enqueue (0 when nothing remains). */
  payLuna: bigint;
  /** True when pay was reduced or zeroed by the ceiling. */
  allowanceBound: boolean;
  remainingAfterLuna: bigint | null;
};

/**
 * Partial-fill a proposed gameplay payout against remaining Daily Earn Allowance.
 * `ceilingLuna === null` means uncapped (Level 11+).
 */
export function applyDailyEarnAllowance(args: {
  proposedLuna: bigint;
  spentLuna: bigint;
  ceilingLuna: bigint | null;
}): DailyEarnAllowanceDecision {
  const proposed =
    args.proposedLuna > 0n ? args.proposedLuna : 0n;
  const spent = args.spentLuna > 0n ? args.spentLuna : 0n;
  if (args.ceilingLuna === null) {
    return {
      payLuna: proposed,
      allowanceBound: false,
      remainingAfterLuna: null,
    };
  }
  const ceiling = args.ceilingLuna > 0n ? args.ceilingLuna : 0n;
  const remaining = ceiling > spent ? ceiling - spent : 0n;
  const payLuna = proposed < remaining ? proposed : remaining;
  return {
    payLuna,
    allowanceBound: payLuna < proposed,
    remainingAfterLuna: remaining - payLuna,
  };
}

/**
 * Whether a claimable-block earn may begin given peeked Daily Earn remaining.
 * `null` remaining means uncapped (Level 11+).
 */
export function canBeginClaimableBlockEarn(
  remainingLuna: bigint | null
): boolean {
  if (remainingLuna === null) return true;
  return remainingLuna > 0n;
}
