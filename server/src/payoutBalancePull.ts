/**
 * Locally cached payout-wallet balance pulled from the Payout Service.
 * Claim fund-gating reads this cache synchronously - no network on the hot path.
 * When `NIM_PAYOUT_DEV_FAKE_BALANCE` is on, a failed pull seeds a local fake balance
 * so local play (HUD + claims) still works without chain consensus.
 */
import {
  fetchBalanceFromService,
  isPayoutServiceClientConfigured,
} from "./payoutServiceClient.js";

const LUNA_PER_NIM = 100_000n;

const BALANCE_CACHE_MS = Math.max(
  0,
  Number(process.env.NIM_BALANCE_CACHE_MS ?? 20_000)
);

/** Background refresh so peek is usually non-null (claim gate avoids network). */
const BALANCE_BACKGROUND_REFRESH_MS = Math.max(
  5_000,
  Number(process.env.NIM_BALANCE_BACKGROUND_REFRESH_MS ?? 45_000)
);

type PulledCache = {
  luna: bigint;
  at: number;
  fromDevFake?: true;
};

let pulledBalanceCache: PulledCache | null = null;
let pullInFlight: Promise<bigint | null> | null = null;
let refreshTimer: ReturnType<typeof setInterval> | null = null;

function envFlagOn(name: string): boolean {
  const v = String(process.env[name] ?? "")
    .trim()
    .toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export function isDevFakePayoutBalanceEnabled(): boolean {
  return envFlagOn("NIM_PAYOUT_DEV_FAKE_BALANCE");
}

export function devFakePayoutBalanceLuna(): bigint {
  const raw = Number(process.env.NIM_PAYOUT_DEV_FAKE_BALANCE_NIM ?? "100");
  const nim = Number.isFinite(raw) && raw > 0 ? raw : 100;
  return BigInt(Math.round(nim * Number(LUNA_PER_NIM)));
}

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

function storePulledBalance(luna: bigint, fromDevFake?: true): bigint {
  pulledBalanceCache = {
    luna,
    at: Date.now(),
    ...(fromDevFake ? { fromDevFake: true as const } : {}),
  };
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

export type PulledBalanceRead = {
  luna: bigint;
  fromDevFake?: true;
};

/**
 * Read hot-wallet balance for HUD / claim gating.
 * Prefers live Payout Service; falls back to cache; then optional dev fake.
 */
export async function readPulledBalance(): Promise<PulledBalanceRead> {
  const now = Date.now();
  if (
    pulledBalanceCache &&
    now - pulledBalanceCache.at < BALANCE_CACHE_MS
  ) {
    return {
      luna: pulledBalanceCache.luna,
      ...(pulledBalanceCache.fromDevFake ? { fromDevFake: true as const } : {}),
    };
  }
  const pulled = await pullBalanceFromService();
  if (pulled !== null) return { luna: pulled };
  if (pulledBalanceCache) {
    return {
      luna: pulledBalanceCache.luna,
      ...(pulledBalanceCache.fromDevFake ? { fromDevFake: true as const } : {}),
    };
  }
  if (isDevFakePayoutBalanceEnabled()) {
    const luna = storePulledBalance(devFakePayoutBalanceLuna(), true);
    return { luna, fromDevFake: true };
  }
  throw new Error("payout_service_balance_unavailable");
}

export async function getPulledBalanceLuna(): Promise<bigint> {
  return (await readPulledBalance()).luna;
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
