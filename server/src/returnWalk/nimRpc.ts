/**
 * JSON-RPC helpers for Deposit verification (no in-process Nimiq light client).
 */

import { formatWalletAddressGrouped, compactWalletKey } from "../walletAddresses.js";

type JsonRpcResponse = {
  result?: unknown;
  error?: { message?: string };
};

export async function nimJsonRpcCall(
  rpcUrl: string,
  method: string,
  params: unknown[]
): Promise<unknown> {
  const url = rpcUrl.trim();
  if (!url) throw new Error("rpc_url_missing");
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json()) as JsonRpcResponse;
  if (!res.ok || json.error) {
    throw new Error(json.error?.message || `RPC HTTP ${res.status}`);
  }
  return json.result;
}

type RpcTxBody = {
  hash?: string;
  from?: string;
  fromAddress?: string;
  to?: string;
  toAddress?: string;
  value?: number | string;
};

function extractRpcTx(result: unknown): RpcTxBody | null {
  if (!result || typeof result !== "object") return null;
  const wrapped = (result as { data?: unknown }).data;
  const tx = (wrapped && typeof wrapped === "object" ? wrapped : result) as RpcTxBody;
  if (!String(tx.hash ?? "").trim()) return null;
  return tx;
}

export async function fetchTransactionDetailsViaRpc(
  rpcUrl: string,
  txHash: string
): Promise<{
  hash: string;
  sender: string;
  recipient: string;
  valueLuna: bigint;
} | null> {
  const result = await nimJsonRpcCall(rpcUrl, "getTransactionByHash", [
    txHash.trim(),
  ]);
  const tx = extractRpcTx(result);
  if (!tx) return null;
  const sender = String(tx.fromAddress ?? tx.from ?? "").trim();
  const recipient = String(tx.toAddress ?? tx.to ?? "").trim();
  const valueRaw = tx.value;
  const valueLuna =
    typeof valueRaw === "string" && /^\d+$/.test(valueRaw)
      ? BigInt(valueRaw)
      : BigInt(Math.trunc(Number(valueRaw ?? 0)));
  return {
    hash: String(tx.hash),
    sender: formatWalletAddressGrouped(compactWalletKey(sender)),
    recipient: formatWalletAddressGrouped(compactWalletKey(recipient)),
    valueLuna,
  };
}

export type RpcAddressTransaction = {
  hash?: string;
  from?: string;
  fromAddress?: string;
  to?: string;
  toAddress?: string;
  value?: number | string;
};

function normalizeRpcTransactions(result: unknown): RpcAddressTransaction[] {
  if (Array.isArray(result)) return result as RpcAddressTransaction[];
  if (result && typeof result === "object") {
    const data = (result as { data?: unknown }).data;
    if (Array.isArray(data)) return data as RpcAddressTransaction[];
  }
  return [];
}

export async function fetchRecentTransactionsForAddress(
  rpcUrl: string,
  address: string,
  limit = 40
): Promise<RpcAddressTransaction[]> {
  const addr = formatWalletAddressGrouped(compactWalletKey(address));
  const result = await nimJsonRpcCall(rpcUrl, "getTransactionsByAddress", [
    addr,
    limit,
    null,
  ]);
  return normalizeRpcTransactions(result);
}
