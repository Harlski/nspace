/**
 * HUD-facing payout hot-wallet balance resolution.
 * Pulls from the Payout Service; optionally falls back to a local fake in dev.
 */
import { LUNA_PER_NIM, isPayoutSenderConfigured } from "./payoutGateway.js";
import {
  devFakePayoutBalanceLuna,
  isDevFakePayoutBalanceEnabled,
  peekPulledBalanceCacheLuna,
  readPulledBalance,
} from "./payoutBalancePull.js";

export type PayoutBalanceApiBody = {
  configured: boolean;
  hasNim: boolean;
  balanceNim: string;
  stale?: true;
  devFake?: true;
  error?: string;
};

export type PayoutBalanceApiResult = {
  status: 200 | 503;
  body: PayoutBalanceApiBody;
};

export {
  isDevFakePayoutBalanceEnabled,
  devFakePayoutBalanceLuna,
} from "./payoutBalancePull.js";

function formatBalanceNim(luna: bigint): string {
  return (Number(luna) / Number(LUNA_PER_NIM)).toFixed(4);
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

function balanceApiTimeoutMs(): number {
  return Math.max(3000, Number(process.env.NIM_BALANCE_API_TIMEOUT_MS ?? 28_000));
}

function staleMaxMs(): number {
  return Math.max(0, Number(process.env.NIM_BALANCE_API_STALE_MAX_MS ?? 300_000));
}

function okBody(luna: bigint, extra?: Partial<PayoutBalanceApiBody>): PayoutBalanceApiResult {
  return {
    status: 200,
    body: {
      configured: true,
      hasNim: luna > 0n,
      balanceNim: formatBalanceNim(luna),
      ...extra,
    },
  };
}

/**
 * Resolve the JSON payload for GET /api/nim/payout-balance.
 * When `NIM_PAYOUT_DEV_FAKE_BALANCE` is on and the live pull fails, returns a
 * local fake balance so HUD / claim gating stay usable without chain consensus.
 */
export async function resolvePayoutBalanceApi(): Promise<PayoutBalanceApiResult> {
  if (!isPayoutSenderConfigured()) {
    if (isDevFakePayoutBalanceEnabled()) {
      const luna = devFakePayoutBalanceLuna();
      return okBody(luna, { configured: true, hasNim: luna > 0n, devFake: true });
    }
    return {
      status: 200,
      body: { configured: false, hasNim: false, balanceNim: "0.0000" },
    };
  }

  try {
    const read = await withTimeout(
      readPulledBalance(),
      balanceApiTimeoutMs(),
      "getPayoutWalletBalanceLuna"
    );
    return okBody(read.luna, read.fromDevFake ? { devFake: true } : undefined);
  } catch (err) {
    console.error("[nim/payout-balance]", err);

    const maxStale = staleMaxMs();
    if (maxStale > 0) {
      const peek = peekPulledBalanceCacheLuna();
      const age = peek ? Date.now() - peek.cachedAtMs : Infinity;
      if (peek && age <= maxStale) {
        return okBody(peek.luna, { stale: true });
      }
    }

    if (isDevFakePayoutBalanceEnabled()) {
      const luna = devFakePayoutBalanceLuna();
      return okBody(luna, { devFake: true });
    }

    return {
      status: 503,
      body: {
        error: "nim_unavailable",
        configured: true,
        hasNim: false,
        balanceNim: "0.0000",
      },
    };
  }
}
