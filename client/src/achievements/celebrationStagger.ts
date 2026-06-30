import { ACHIEVEMENT_CELEBRATION_STAGGER_MS } from "./celebrationPolicy.js";

/**
 * Returns delay (ms) before the next trophy pop for `address`, and advances the per-avatar
 * schedule so burst unlocks stagger (~1.2s apart).
 */
export function nextCelebrationDelayMs(
  nextPlayAtByAddress: Map<string, number>,
  address: string,
  nowMs: number
): number {
  const scheduled = nextPlayAtByAddress.get(address) ?? nowMs;
  const delay = Math.max(0, scheduled - nowMs);
  nextPlayAtByAddress.set(
    address,
    Math.max(nowMs, scheduled) + ACHIEVEMENT_CELEBRATION_STAGGER_MS
  );
  return delay;
}

/** Drop schedule state once a burst finishes (no pending stagger slots). */
export function clearCelebrationSchedule(
  nextPlayAtByAddress: Map<string, number>,
  address: string
): void {
  nextPlayAtByAddress.delete(address);
}
