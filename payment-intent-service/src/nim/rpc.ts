type JsonRpcResponse = {
  result?: unknown;
  error?: { message?: string };
};

/** Grouped user-friendly form (spaces every 4 chars) for public Nimiq RPC nodes. */
export function formatRpcAddress(address: string): string {
  const trimmed = String(address ?? "").trim();
  if (!trimmed) return "";
  if (/\s/.test(trimmed)) return trimmed.replace(/\s+/g, " ").trim();
  const compact = trimmed.replace(/\s+/g, "").toUpperCase();
  return compact.replace(/(.{4})(?=.)/g, "$1 ");
}

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

export type RpcAddressTransaction = {
  hash?: string;
  timestamp?: number;
  toAddress?: string;
  to?: string;
  fromAddress?: string;
  from?: string;
  value?: number;
};

export function normalizeRpcTransactions(result: unknown): RpcAddressTransaction[] {
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
  limit = 120
): Promise<RpcAddressTransaction[]> {
  const addr = formatRpcAddress(address);
  const result = await nimJsonRpcCall(rpcUrl, "getTransactionsByAddress", [
    addr,
    limit,
    null,
  ]);
  return normalizeRpcTransactions(result);
}
