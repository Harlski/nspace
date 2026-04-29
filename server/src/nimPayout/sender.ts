import type {
  Client,
  PlainTransactionDetails,
} from "@nimiq/core";

/** 1 NIM = 100_000 Luna (smallest unit). */
export const LUNA_PER_NIM = 100_000n;

let clientPromise: Promise<Client> | null = null;

/**
 * Serialize all Nimiq client usage. Concurrent consensus/account work on one Client has
 * caused connection instability and process crashes in dev.
 */
let nimiqMutexChain: Promise<void> = Promise.resolve();

function withNimiqMutex<T>(fn: () => Promise<T>): Promise<T> {
  const next = nimiqMutexChain.then(() => fn());
  nimiqMutexChain = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

/** Set `NIM_PAYOUT_TX_TRACE=1` for a step-by-step timeline around `sendNimPayoutTransaction`. */
const NIM_PAYOUT_TX_TRACE = process.env.NIM_PAYOUT_TX_TRACE === "1";

export type NimPayoutSendTraceContext = {
  jobId: string;
  claimId: string;
};

function payoutTxTrace(
  phase: string,
  ctx: NimPayoutSendTraceContext | undefined,
  extra?: Record<string, string | number | bigint>
): void {
  if (!NIM_PAYOUT_TX_TRACE) return;
  const id =
    ctx !== undefined
      ? `job=${ctx.jobId.slice(0, 8)} claim=${ctx.claimId.slice(0, 10)}`
      : "";
  const bits: string[] = [];
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      bits.push(`${k}=${typeof v === "bigint" ? v.toString() : v}`);
    }
  }
  const tail = [id, ...bits].filter(Boolean).join(" ");
  console.log(`[nim-payout-tx] ${phase}${tail ? ` ${tail}` : ""}`);
}

const BALANCE_CACHE_MS = Math.max(
  0,
  Number(process.env.NIM_BALANCE_CACHE_MS ?? 20_000)
);

let balanceCache: { luna: bigint; at: number } | null = null;

/**
 * One shared promise for all concurrent cache-miss balance reads so they do not enqueue
 * separate mutex turns each doing consensus + getAccount (which starved the HTTP API
 * under payout load).
 */
let balanceFetchCoalesced: Promise<bigint> | null = null;

export function invalidateNimBalanceCache(): void {
  balanceCache = null;
}

/**
 * After a confirmed send, move cached balance down by the payout amount instead of clearing
 * the cache. Clearing forced every following `completeBlockClaim` onto a live balance read,
 * which queued behind `sendNimPayoutTransaction` and made mining feel stalled after a few
 * payouts in a row.
 */
function adjustNimBalanceCacheAfterPayout(amountLuna: bigint): void {
  if (!balanceCache) return;
  const next = balanceCache.luna - amountLuna;
  if (next < 0n) {
    balanceCache = null;
    return;
  }
  /** Keep `at` from the last full fetch so `NIM_BALANCE_CACHE_MS` TTL still expires. */
  balanceCache = { luna: next, at: balanceCache.at };
}

/** Non-async read of last cached payout-wallet balance (for fast paths). */
export function peekNimPayoutBalanceCacheLuna(): {
  luna: bigint;
  cachedAtMs: number;
} | null {
  if (!balanceCache) return null;
  return { luna: balanceCache.luna, cachedAtMs: balanceCache.at };
}

export function isNimPayoutSenderConfigured(): boolean {
  const k = process.env.NIM_PAYOUT_PRIVATE_KEY?.trim();
  return !!k && k.length >= 64;
}

async function getClient(): Promise<Client> {
  if (!clientPromise) {
    const Nimiq = await import("@nimiq/core");
    const { Client, ClientConfiguration } = Nimiq;
    const cfg = new ClientConfiguration();
    const net = (process.env.NIM_NETWORK ?? "testalbatross").toLowerCase();
    cfg.network(net);
    cfg.logLevel(process.env.NIM_CLIENT_LOG_LEVEL ?? "warn");
    clientPromise = Client.create(cfg.build());
  }
  return clientPromise;
}

async function getKeyPair(): Promise<import("@nimiq/core").KeyPair> {
  const Nimiq = await import("@nimiq/core");
  const hex = process.env.NIM_PAYOUT_PRIVATE_KEY?.trim();
  if (!hex) {
    throw new Error("NIM_PAYOUT_PRIVATE_KEY is not set");
  }
  return Nimiq.KeyPair.derive(Nimiq.PrivateKey.fromHex(hex));
}

function fetchBalanceLunaThroughMutex(): Promise<bigint> {
  if (balanceFetchCoalesced) return balanceFetchCoalesced;
  const p = withNimiqMutex(async () => {
    const t = Date.now();
    if (balanceCache && t - balanceCache.at < BALANCE_CACHE_MS) {
      return balanceCache.luna;
    }
    const client = await getClient();
    await client.waitForConsensusEstablished();
    const keyPair = await getKeyPair();
    const senderAddr = keyPair.toAddress();
    const account = await client.getAccount(senderAddr);
    const luna = BigInt(account.balance);
    balanceCache = { luna, at: Date.now() };
    return luna;
  }).finally(() => {
    if (balanceFetchCoalesced === p) balanceFetchCoalesced = null;
  });
  balanceFetchCoalesced = p;
  return p;
}

export async function getNimPayoutWalletBalanceLuna(): Promise<bigint> {
  const now = Date.now();
  if (balanceCache && now - balanceCache.at < BALANCE_CACHE_MS) {
    return balanceCache.luna;
  }
  return fetchBalanceLunaThroughMutex();
}

/**
 * Connects to Nimiq (light client), waits for consensus, builds and signs a basic transfer,
 * broadcasts it, then polls until included or confirmed (or timeout).
 *
 * The confirmation poll sleeps between attempts **without** holding `withNimiqMutex`, so
 * short operations (e.g. `getNimPayoutWalletBalanceLuna` during block claims) are not
 * blocked for the full tx confirmation duration.
 */
export async function sendNimPayoutTransaction(
  recipientUserFriendlyAddress: string,
  amountLuna: bigint,
  txMessageOverride?: string,
  trace?: NimPayoutSendTraceContext
): Promise<{ txHash: string; details: PlainTransactionDetails }> {
  payoutTxTrace("send_enter", trace, {
    amountLuna,
    to: recipientUserFriendlyAddress.slice(0, 12),
  });

  const tPhase1Queued = Date.now();
  const { hash, initialDetails } = await withNimiqMutex(async () => {
    payoutTxTrace("mutex_phase1_acquired", trace, {
      queueWaitMs: Date.now() - tPhase1Queued,
    });

    const Nimiq = await import("@nimiq/core");
    const {
      TransactionBuilder,
      Address,
    } = Nimiq;

    const t0 = Date.now();
    const client = await getClient();
    payoutTxTrace("after_getClient", trace, { stepMs: Date.now() - t0 });

    const t1 = Date.now();
    await client.waitForConsensusEstablished();
    payoutTxTrace("after_waitForConsensus", trace, { stepMs: Date.now() - t1 });

    const keyPair = await getKeyPair();
    const senderAddr = keyPair.toAddress();
    const recipient = Address.fromUserFriendlyAddress(
      recipientUserFriendlyAddress
    );

    const t2 = Date.now();
    const head = await client.getHeadBlock();
    const height = head.height;
    const networkId = await client.getNetworkId();
    payoutTxTrace("after_getHeadAndNetworkId", trace, { stepMs: Date.now() - t2 });

    const txMessage =
      txMessageOverride?.trim() ||
      process.env.NIM_PAYOUT_TX_MESSAGE?.trim() ||
      "You mined NIM on Nimiq.Space!";
    const txData = new TextEncoder().encode(txMessage);

    const tx = TransactionBuilder.newBasicWithData(
      senderAddr,
      recipient,
      txData,
      amountLuna,
      null,
      height,
      networkId
    );
    tx.sign(keyPair, undefined);

    payoutTxTrace("before_sendTransaction", trace, {});
    const t3 = Date.now();
    const details = await client.sendTransaction(tx);
    payoutTxTrace("after_sendTransaction", trace, {
      stepMs: Date.now() - t3,
      hash: details.transactionHash.slice(0, 16),
      state: String(details.state),
    });
    return { hash: details.transactionHash, initialDetails: details };
  });

  const deadline =
    Date.now() + Number(process.env.NIM_TX_CONFIRM_TIMEOUT_MS ?? 120_000);
  payoutTxTrace("poll_loop_start", trace, {
    deadlineMs: deadline - Date.now(),
    initialState: String(initialDetails.state),
  });

  let last = initialDetails;
  let pollN = 0;
  while (Date.now() < deadline) {
    if (last.state === "confirmed" || last.state === "included") {
      adjustNimBalanceCacheAfterPayout(amountLuna);
      payoutTxTrace("send_success", trace, { state: String(last.state), polls: pollN });
      return { txHash: hash, details: last };
    }
    if (last.state === "invalidated" || last.state === "expired") {
      invalidateNimBalanceCache();
      payoutTxTrace("send_tx_invalid", trace, { state: String(last.state) });
      throw new Error(`Transaction ${last.state}`);
    }
    await new Promise((r) => setTimeout(r, 2000));
    const tPollQueued = Date.now();
    last = await withNimiqMutex(async () => {
      payoutTxTrace("poll_mutex_acquired", trace, {
        poll: pollN + 1,
        queueWaitMs: Date.now() - tPollQueued,
      });
      const client = await getClient();
      return client.getTransaction(hash);
    });
    pollN += 1;
    payoutTxTrace("poll_got_tx", trace, {
      poll: pollN,
      state: String(last.state),
    });
  }

  invalidateNimBalanceCache();
  payoutTxTrace("send_timeout", trace, { polls: pollN });
  throw new Error("Timed out waiting for transaction to be included");
}
