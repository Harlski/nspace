import type { PlainTransactionDetails } from "@nimiq/core";
import { nimJsonRpcCall } from "./rpc.js";

type RpcTxBody = {
  hash?: string;
  blockNumber?: number;
  confirmations?: number;
  from?: string;
  to?: string;
  value?: number;
  recipientData?: string;
};

function extractRpcTxData(result: unknown): RpcTxBody | null {
  if (!result || typeof result !== "object") return null;
  const wrapped = (result as { data?: unknown }).data;
  const tx = (wrapped && typeof wrapped === "object" ? wrapped : result) as RpcTxBody;
  if (!String(tx.hash ?? "").trim()) return null;
  return tx;
}

/** Fetch included tx fields from a public Nimiq JSON-RPC node (no light client). */
export async function fetchTransactionDetailsViaRpc(
  rpcUrl: string,
  txHash: string
): Promise<PlainTransactionDetails> {
  const result = await nimJsonRpcCall(rpcUrl, "getTransactionByHash", [
    txHash.trim(),
  ]);
  const tx = extractRpcTxData(result);
  if (!tx) throw new Error("transaction_not_found");

  const conf = Number(tx.confirmations ?? 0);
  const block = Number(tx.blockNumber ?? 0);
  let state: PlainTransactionDetails["state"] = "pending";
  if (block > 0 && conf > 0) state = "included";

  const recipientData = String(tx.recipientData ?? "").trim();
  return {
    state,
    recipient: String(tx.to ?? ""),
    sender: String(tx.from ?? ""),
    value: Number(tx.value ?? 0),
    confirmations: conf,
    ...(recipientData
      ? { data: { type: "raw" as const, raw: recipientData } }
      : {}),
  } as PlainTransactionDetails;
}
