/** UTF-8 text to lowercase hex (Nimiq RPC `data` / `recipientData`). */
export function utf8ToHex(text: string): string {
  const bytes = new TextEncoder().encode(String(text ?? ""));
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += ("0" + bytes[i]!.toString(16)).slice(-2);
  }
  return hex;
}

/**
 * Payload for `sendBasicTransactionWithData`.
 *
 * Nimiq names the same memo three ways:
 * - Mini-app / RPC `data` is hex-encoded UTF-8 (plaintext is not valid hex, so
 *   a host that treats `data` as RPC hex drops it and the tx has no message).
 * - Hub checkout uses `extraData` as UTF-8.
 * - `getTransactionByHash` returns `recipientData` as hex.
 */
export type NimiqPaySendBasicWithDataParams = {
  recipient: string;
  value: number;
  data: string;
  extraData: string;
  recipientData: string;
};

export function buildNimiqPaySendParams(opts: {
  recipient: string;
  value: number;
  memo: string;
}): NimiqPaySendBasicWithDataParams {
  const memo = String(opts.memo ?? "").trim();
  if (!memo) throw new Error("missing_memo");
  const recipient = String(opts.recipient ?? "").trim();
  if (!recipient) throw new Error("missing_recipient");
  const value = Math.floor(Number(opts.value));
  if (!Number.isFinite(value) || value < 1) throw new Error("invalid_amount");
  const hex = utf8ToHex(memo);
  return {
    recipient,
    value,
    data: hex,
    extraData: memo,
    recipientData: hex,
  };
}
