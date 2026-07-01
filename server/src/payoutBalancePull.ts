/**
 * Locally cached payout-wallet balance pulled from the Payout Service.
 * Claim fund-gating reads this cache synchronously - no network on the hot path.
 */
import {
  fetchBalanceFromService,
  isPayoutServiceClientConfigured,
} from "./payoutServiceClient.js";

const BALANCE_CACHE_MS = Math.max(
  0,
  Number(process.env.NIM_BALANCE_CACHE_MS ?? 20_000)
);

/** Background refresh so peek is usually non-null (claim gate avoids network). */
const BALANCE_BACKGROUND_REFRESH_MS = Math.max(
  5_000,
  Number(process.env.NIM_BALANCE_BACKGROUND_REFRESH_MS ?? 45_000)
);

let pulledBalanceCache: { luna: bigint; at: number } | null = null;
let pullInFlight: Promise<bigint | null> | null = null;
let refreshTimer: ReturnType<typeof setInterval> | null = null;

export function peekPulledBalanceCacheLuna(): {
  luna: bigint;
  cachedAtMs: number;
} | null {
  if (!pulledBalanceCache) return null;
  return {
    luna: pulledBalanceCache.luna,
    cachedAtMs: pulledBalanceCache.at,
  };
}

function storePulledBalance(luna: bigint): bigint {
  pulledBalanceCache = { luna, at: Date.now() };
  return luna;
}

export async function pullBalanceFromService(): Promise<bigint | null> {
  if (!isPayoutServiceClientConfigured()) return null;
  if (pullInFlight) return pullInFlight;
  const p = (async () => {
    const r = await fetchBalanceFromService();
    if (!r.ok) return null;
    return storePulledBalance(r.balanceLuna);
  })().finally(() => {
    if (pullInFlight === p) pullInFlight = null;
  });
  pullInFlight = p;
  return p;
}

export async function getPulledBalanceLuna(): Promise<bigint> {
  const now = Date.now();
  if (
    pulledBalanceCache &&
    now - pulledBalanceCache.at < BALANCE_CACHE_MS
  ) {
    return pulledBalanceCache.luna;
  }
  const pulled = await pullBalanceFromService();
  if (pulled !== null) return pulled;
  if (pulledBalanceCache) return pulledBalanceCache.luna;
  throw new Error("payout_service_balance_unavailable");
}

export function startPayoutBalancePullLoop(): void {
  if (!isPayoutServiceClientConfigured()) return;
  if (refreshTimer) return;
  const tick = (): void => {
    void pullBalanceFromService().catch(() => {
      /* next interval retries */
    });
  };
  setTimeout(tick, 3000);
  refreshTimer = setInterval(tick, BALANCE_BACKGROUND_REFRESH_MS);
}

export function resetPulledBalanceCacheForTests(): void {
  pulledBalanceCache = null;
  pullInFlight = null;
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

/** Test hook: set cache without a network pull. */
export function setPulledBalanceCacheForTests(luna: bigint, atMs?: number): void {
  pulledBalanceCache = { luna, at: atMs ?? Date.now() };
}
