import type { Client, PlainTransactionDetails } from "@nimiq/core";
import type { ChainClient, PayoutSendResult } from "./types.js";

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

async function pollUntilIncluded(
  hash: string,
  initialDetails: PlainTransactionDetails
): Promise<PayoutSendResult> {
  const deadline =
    Date.now() + Number(process.env.NIM_TX_CONFIRM_TIMEOUT_MS ?? 120_000);
  let last = initialDetails;
  while (Date.now() < deadline) {
    if (last.state === "confirmed" || last.state === "included") {
      return { txHash: hash, state: String(last.state) };
    }
    if (last.state === "invalidated" || last.state === "expired") {
      throw new Error(`Transaction ${last.state}`);
    }
    await new Promise((r) => setTimeout(r, 2000));
    last = await withNimiqMutex(async () => {
      const client = await getClient();
      return client.getTransaction(hash);
    });
  }
  throw new Error("Timed out waiting for transaction to be included");
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

      return pollUntilIncluded(hash, initialDetails);
    },
  };
}
