import type { Client, PlainTransactionDetails } from "@nimiq/core";

let clientPromise: Promise<Client> | null = null;

let nimiqMutexChain: Promise<void> = Promise.resolve();

export function withNimiqMutex<T>(fn: () => Promise<T>): Promise<T> {
  const next = nimiqMutexChain.then(() => fn());
  nimiqMutexChain = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

export async function getNimiqClient(opts: {
  network: string;
  logLevel: string;
}): Promise<Client> {
  if (!clientPromise) {
    const Nimiq = await import("@nimiq/core");
    const { Client, ClientConfiguration } = Nimiq;
    const cfg = new ClientConfiguration();
    cfg.network(opts.network);
    cfg.logLevel(opts.logLevel);
    clientPromise = Client.create(cfg.build());
  }
  return clientPromise;
}

export async function fetchTransactionDetails(
  txHash: string,
  opts: { network: string; logLevel: string }
): Promise<PlainTransactionDetails> {
  return withNimiqMutex(async () => {
    const client = await getNimiqClient(opts);
    await client.waitForConsensusEstablished();
    return client.getTransaction(txHash.trim());
  });
}
