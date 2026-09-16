import { peekDailyEarnRemaining } from "../dailyEarnAllowance.js";
import { totalPointsForWallet } from "../achievementStore.js";
import { canBeginClaimableBlockEarn } from "../playerLevel.js";
import { hasOpenReturnWalkBudget } from "./store.js";
import { isResidentWallet } from "./config.js";

/**
 * A Return Walk is open when Resident has a credited Invoice with Return Budget > 0
 * and Daily Earn is not exhausted.
 */
export function isReturnWalkOpen(opts: {
  residentWallet: string;
  nowMs?: number;
}): boolean {
  if (!isResidentWallet(opts.residentWallet)) return false;
  if (!hasOpenReturnWalkBudget()) return false;
  const peek = peekDailyEarnRemaining({
    wallet: opts.residentWallet,
    achievementPoints: totalPointsForWallet(opts.residentWallet),
    nowMs: opts.nowMs ?? Date.now(),
  });
  return canBeginClaimableBlockEarn(peek.remainingLuna);
}
