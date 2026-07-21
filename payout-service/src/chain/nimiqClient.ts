import type { Client, PlainTransactionDetails } from "@nimiq/core";
import type {
  ChainClient,
  OnChainOutgoingTx,
  PayoutSendResult,
  TxLifecycleState,
} from "./types.js";

let clientPromise: Promise<Client> | null = null;
let nimiqMutexChain: Promise<void> = Promise.resolve();

function withNimiqMutex<T>(fn: () => Promise<T>): Promise<T> {
  const next = nimiqMutexChain.then(fn);
  nimiqMutexChain = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

function confirmTimeoutMs(): number {
  return Number(process.env.NIM_TX_CONFIRM_TIMEOUT_MS ?? 120_000);
}

function isSignerConfigured(): boolean {
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

/**
 * Waits for a broadcast transaction to confirm.
 *
 * Never throws: a transient `getTransaction` failure ("Transaction not found"
 * while the tx is still propagating) is swallowed and polling continues. This is
 * the fix for the double-payout incident - previously a transient lookup failure
 * aborted the send and the caller re-broadcast the same jobs.
 *
 * Returns the terminal state if the transaction settles or dies within the
 * timeout, otherwise `"pending"` (broadcast succeeded, confirmation still pending).
 */
async function awaitConfirmation(
  hash: string,
  initialDetails: PlainTransactionDetails
): Promise<PayoutSendResult> {
  const deadline = Date.now() + confirmTimeoutMs();
  let last = initialDetails;
  for (;;) {
    const state = last.state as TxLifecycleState;
    if (
      state === "confirmed" ||
      state === "included" ||
      state === "invalidated" ||
      state === "expired"
    ) {
      return { txHash: hash, state };
    }
    if (Date.now() >= deadline) {
      return { txHash: hash, state: "pending" };
    }
    await new Promise((r) => setTimeout(r, 2000));
    try {
      last = await withNimiqMutex(async () => {
        const client = await getClient();
        return client.getTransaction(hash);
      });
    } catch {
      // Transient lookup failure (e.g. not yet indexed by our node). Keep the
      // previous state and keep polling until the deadline.
    }
  }
}

export function createNimiqChainClient(defaultTxMessage: string): ChainClient {
  return {
    isSignerConfigured,
    async getWalletBalanceLuna() {
      return withNimiqMutex(async () => {
        const client = await getClient();
        await client.waitForConsensusEstablished();
        const keyPair = await getKeyPair();
        const senderAddr = keyPair.toAddress();
        const account = await client.getAccount(senderAddr);
        return BigInt(account.balance);
      });
    },
    async sendPayout(opts) {
      const txMessage =
        opts.txMessage?.trim() || defaultTxMessage || "You mined NIM on Nimiq.Space!";

      // Phase 1 - build, sign, broadcast. A throw here means the transaction was
      // NOT submitted to the network, so the caller may safely retry.
      const { hash, initialDetails } = await withNimiqMutex(async () => {
        const Nimiq = await import("@nimiq/core");
        const { TransactionBuilder, Address } = Nimiq;

        const client = await getClient();
        await client.waitForConsensusEstablished();
        const keyPair = await getKeyPair();
        const senderAddr = keyPair.toAddress();
        const recipient = Address.fromUserFriendlyAddress(opts.recipientAddress);
        const head = await client.getHeadBlock();
        const height = head.height;
        const networkId = await client.getNetworkId();
        const txData = new TextEncoder().encode(txMessage);
        const tx = TransactionBuilder.newBasicWithData(
          senderAddr,
          recipient,
          txData,
          opts.amountLuna,
          null,
          height,
          networkId
        );
        tx.sign(keyPair, undefined);
        const details = await client.sendTransaction(tx);
        return { hash: details.transactionHash, initialDetails: details };
      });

      // Phase 2 - the transaction is broadcast. From here we never throw; we only
      // report how far confirmation got.
      return awaitConfirmation(hash, initialDetails);
    },
    async getTransactionState(txHash) {
      try {
        const details = await withNimiqMutex(async () => {
          const client = await getClient();
          return client.getTransaction(txHash);
        });
        return details.state as TxLifecycleState;
      } catch {
        return "unknown";
      }
    },
  };
}

/**
 * Offline reconciliation helper: fetch the payout treasury's outgoing transactions
 * on-chain since `sinceBlockHeight`. Used by `scripts/reconcile-onchain.ts` to find
 * broadcast payouts that were never recorded in `nim-payout-sent.jsonl`.
 */
export async function fetchOutgoingPayoutTransactions(
  sinceBlockHeight: number
): Promise<OnChainOutgoingTx[]> {
  const client = await getClient();
  await client.waitForConsensusEstablished();
  const keyPair = await getKeyPair();
  const senderAddr = keyPair.toAddress();
  const senderUf = senderAddr.toUserFriendlyAddress();
  const all = await client.getTransactionsByAddress(
    senderAddr,
    sinceBlockHeight,
    null,
    null,
    null
  );
  return all
    .filter((t) => t.sender === senderUf)
    .map((t) => ({
      txHash: t.transactionHash,
      recipient: t.recipient,
      valueLuna: BigInt(Math.round(t.value)),
      blockHeight: typeof t.blockHeight === "number" ? t.blockHeight : null,
      timestamp: typeof t.timestamp === "number" ? t.timestamp : null,
      state: t.state as TxLifecycleState,
    }));
}

/** Resolve the treasury (payout signer) address in user-friendly format. */
export async function getTreasuryAddress(): Promise<string> {
  const keyPair = await getKeyPair();
  return keyPair.toAddress().toUserFriendlyAddress();
}

/** Current head block height (waits for consensus first). */
export async function getHeadHeight(): Promise<number> {
  const client = await getClient();
  await client.waitForConsensusEstablished();
  const head = await client.getHeadBlock();
  return head.height;
}
