import type {
  Client,
  PlainTransactionDetails,
} from "@nimiq/core";

/** 1 NIM = 100_000 Luna (smallest unit). */
export const LUNA_PER_NIM = 100_000n;

let clientPromise: Promise<Client> | null = null;

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

export async function getNimPayoutWalletBalanceLuna(): Promise<bigint> {
  const client = await getClient();
  await client.waitForConsensusEstablished();
  const keyPair = await getKeyPair();
  const senderAddr = keyPair.toAddress();
  const account = await client.getAccount(senderAddr);
  return BigInt(account.balance);
}

/**
 * Connects to Nimiq (light client), waits for consensus, builds and signs a basic transfer,
 * broadcasts it, then polls until included or confirmed (or timeout).
 */
export async function sendNimPayoutTransaction(
  recipientUserFriendlyAddress: string,
  amountLuna: bigint
): Promise<{ txHash: string; details: PlainTransactionDetails }> {
  const Nimiq = await import("@nimiq/core");
  const {
    TransactionBuilder,
    Address,
  } = Nimiq;

  const client = await getClient();
  await client.waitForConsensusEstablished();

  const keyPair = await getKeyPair();
  const senderAddr = keyPair.toAddress();
  const recipient = Address.fromUserFriendlyAddress(
    recipientUserFriendlyAddress
  );

  const head = await client.getHeadBlock();
  const height = head.height;
  const networkId = await client.getNetworkId();
  const txMessage =
    process.env.NIM_PAYOUT_TX_MESSAGE?.trim() ||
    "You mined NIM on Nimiq Space!";
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

  const details = await client.sendTransaction(tx);
  const hash = details.transactionHash;

  const deadline = Date.now() + Number(process.env.NIM_TX_CONFIRM_TIMEOUT_MS ?? 120_000);
  let last = details;
  while (Date.now() < deadline) {
    if (last.state === "confirmed" || last.state === "included") {
      return { txHash: hash, details: last };
    }
    if (last.state === "invalidated" || last.state === "expired") {
      throw new Error(`Transaction ${last.state}`);
    }
    await new Promise((r) => setTimeout(r, 2000));
    last = await client.getTransaction(hash);
  }

  throw new Error("Timed out waiting for transaction to be included");
}
