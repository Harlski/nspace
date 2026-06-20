import type { ChainClient } from "./chain/types.js";

let chainClient: ChainClient | null = null;
let balanceCacheMs = 20_000;
let balanceCache: { luna: bigint; at: number } | null = null;
let balanceFetchCoalesced: Promise<bigint> | null = null;

export function initBalanceCache(
  client: ChainClient,
  cacheMs: number
): void {
  chainClient = client;
  balanceCacheMs = cacheMs;
}

function invalidateBalanceCache(): void {
  balanceCache = null;
}

/**
 * After a confirmed send, move cached balance down by the payout amount instead of clearing
 * the cache (mirrors game-server `adjustNimBalanceCacheAfterPayout`).
 */
export function adjustBalanceCacheAfterPayout(amountLuna: bigint): void {
  if (!balanceCache) return;
  const next = balanceCache.luna - amountLuna;
  if (next < 0n) {
    balanceCache = null;
    return;
  }
  balanceCache = { luna: next, at: balanceCache.at };
}

export function peekBalanceCacheLuna(): {
  luna: bigint;
  cachedAtMs: number;
} | null {
  if (!balanceCache) return null;
  return { luna: balanceCache.luna, cachedAtMs: balanceCache.at };
}

async function fetchBalanceLunaFromChain(): Promise<bigint> {
  const client = chainClient;
  if (!client) throw new Error("balance cache not initialized");
  if (!client.isSignerConfigured()) {
    throw new Error("signer not configured");
  }
  const luna = await client.getWalletBalanceLuna();
  balanceCache = { luna, at: Date.now() };
  return luna;
}

export async function getWalletBalanceLuna(): Promise<bigint> {
  const now = Date.now();
  if (balanceCache && now - balanceCache.at < balanceCacheMs) {
    return balanceCache.luna;
  }
  if (balanceFetchCoalesced) return balanceFetchCoalesced;
  const p = fetchBalanceLunaFromChain().finally(() => {
    if (balanceFetchCoalesced === p) balanceFetchCoalesced = null;
  });
  balanceFetchCoalesced = p;
  return p;
}

export function resetBalanceCacheForTests(): void {
  balanceCache = null;
  balanceFetchCoalesced = null;
}
