import type { LiveWorldEffectWire, WorldEffect } from "./types.js";

/**
 * In-memory Live Boost (double gameplay NIM). Persisted until-ms is restored
 * from the Live Event store on process start; this module is the hot-path
 * multiplier used by room authority.
 */
let boostUntilMs = 0;
let boostWasActive = false;

export function resetLiveWorldEffectForTests(): void {
  boostUntilMs = 0;
  boostWasActive = false;
}

export function applyWorldEffect(effect: WorldEffect, nowMs: number = Date.now()): void {
  if (effect.kind === "live_boost") {
    if (effect.untilMs > boostUntilMs) boostUntilMs = effect.untilMs;
    boostWasActive = boostUntilMs > nowMs;
  }
}

export function restoreLiveBoostUntilMs(
  untilMs: number | null,
  nowMs: number = Date.now()
): void {
  boostUntilMs = untilMs && untilMs > nowMs ? untilMs : 0;
  boostWasActive = boostUntilMs > nowMs;
}

export function isLiveBoostActive(nowMs: number = Date.now()): boolean {
  return boostUntilMs > nowMs;
}

/** Double proposed gameplay luna while Live Boost is active. */
export function applyLiveEarnMultiplier(
  luna: bigint,
  nowMs: number = Date.now()
): bigint {
  if (luna <= 0n) return luna;
  if (!isLiveBoostActive(nowMs)) return luna;
  return luna * 2n;
}

export function liveWorldEffectWire(nowMs: number = Date.now()): LiveWorldEffectWire {
  if (!isLiveBoostActive(nowMs)) {
    return { active: false, serverNowMs: nowMs };
  }
  return {
    active: true,
    kind: "live_boost",
    earnMultiplier: 2,
    untilMs: boostUntilMs,
    serverNowMs: nowMs,
  };
}

/**
 * Returns true once when Live Boost crosses from active to expired so callers
 * can broadcast a clear snapshot without doing it every tick.
 */
export function consumeLiveBoostExpiry(nowMs: number = Date.now()): boolean {
  const active = isLiveBoostActive(nowMs);
  if (boostWasActive && !active) {
    boostWasActive = false;
    return true;
  }
  if (active) boostWasActive = true;
  return false;
}
