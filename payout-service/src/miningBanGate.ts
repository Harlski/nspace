/**
 * Cached mining-ban list from the game server. Holds block-claim payouts only.
 */
import type { AppConfig } from "./config.js";

const MINING_BANNED_PATH = "/internal/v1/mining-banned-wallets";
const REFRESH_MS = 30_000;

let callbackBaseUrl: string | null = null;
let callbackSecret: string | null = null;
let bannedWallets = new Set<string>();
let lastRefreshMs = 0;
let refreshTimer: ReturnType<typeof setInterval> | null = null;

/** Block-claim mining payouts use grid coordinates; other rewards use sentinel tile keys. */
export function isBlockClaimMiningPayoutTileKey(tileKey: string): boolean {
  return /^\d+,\d+(,\d+)?$/.test(String(tileKey ?? "").trim());
}

function normalizeWallet(address: string): string {
  return String(address ?? "")
    .replace(/\s+/g, "")
    .trim()
    .toUpperCase();
}

export function initMiningBanGate(cfg: AppConfig): void {
  callbackBaseUrl = cfg.gameServerInternalUrl;
  callbackSecret = cfg.apiSecret;
  if (!callbackBaseUrl) return;
  void refreshMiningBannedWallets();
  if (!refreshTimer) {
    refreshTimer = setInterval(() => {
      void refreshMiningBannedWallets();
    }, REFRESH_MS);
  }
}

export function stopMiningBanGateForTests(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  bannedWallets = new Set();
  lastRefreshMs = 0;
}

export function setMiningBannedWalletsForTests(wallets: string[]): void {
  bannedWallets = new Set(wallets.map(normalizeWallet).filter(Boolean));
  lastRefreshMs = Date.now();
}

export async function refreshMiningBannedWallets(
  force = false
): Promise<void> {
  const base = callbackBaseUrl?.replace(/\/+$/, "");
  const secret = callbackSecret;
  if (!base || !secret) return;
  const now = Date.now();
  if (!force && now - lastRefreshMs < REFRESH_MS) return;
  try {
    const res = await fetch(`${base}${MINING_BANNED_PATH}`, {
      method: "GET",
      headers: { authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(
        `[payout-service] Mining ban list HTTP ${res.status}: ${text.slice(0, 200)}`
      );
      return;
    }
    const json = (await res.json()) as { wallets?: unknown };
    const list = Array.isArray(json.wallets) ? json.wallets : [];
    bannedWallets = new Set(
      list
        .filter((w): w is string => typeof w === "string")
        .map(normalizeWallet)
        .filter(Boolean)
    );
    lastRefreshMs = now;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[payout-service] Mining ban list fetch failed: ${msg}`);
  }
}

/** When true, leave the job pending (backlog) and skip on-chain send. */
export function isMiningPayoutHeldForBannedWallet(
  recipientAddress: string,
  tileKey: string
): boolean {
  if (!isBlockClaimMiningPayoutTileKey(tileKey)) return false;
  const key = normalizeWallet(recipientAddress);
  if (!key) return false;
  return bannedWallets.has(key);
}
