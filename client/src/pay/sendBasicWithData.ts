import { isNimiqPayMiniApp } from "../auth/nimiq.js";
import { buildNimiqPaySendParams } from "./nimiqPayTxParams.js";

export type BasicTxWithDataRequest = {
  recipient: string;
  amountLuna: string | number;
  memo: string;
};

function isProviderErrorResponse(
  x: unknown
): x is { error: { message?: string; type?: string } } {
  if (typeof x !== "object" || x === null || !("error" in x)) return false;
  const err = (x as { error: unknown }).error;
  return typeof err === "object" && err !== null;
}

function providerErrorText(err: { message?: string; type?: string }): string {
  return String(err.message || err.type || "nimiq_pay_payment_failed");
}

function extractThrownMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (isProviderErrorResponse(err)) return providerErrorText(err.error);
  return String(err ?? "nimiq_pay_payment_failed");
}

function recipientGrouped(raw: string): string {
  return String(raw ?? "").trim();
}

function recipientCompact(raw: string): string {
  return String(raw ?? "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

function isUserAbortMessage(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes("cancel") ||
    lower.includes("abort") ||
    lower.includes("denied") ||
    lower.includes("reject") ||
    lower.includes("dismiss") ||
    lower.includes("closed")
  );
}

/** True when the page is inside Nimiq Pay (host injects `window.nimiqPay`). */
export function shouldUseNimiqPaySend(): boolean {
  if (typeof window === "undefined") return false;
  if (isNimiqPayMiniApp()) return true;
  return window.nimiq != null;
}

/**
 * Send a basic tx with memo via Nimiq Pay.
 * Uses `@nimiq/mini-app-sdk` `init()` → `window.nimiq` (not `window.nimiqPay`).
 * DEV `?payEmulate` may stub `window.nimiqPay.sendBasicTransactionWithData`.
 *
 * Do **not** pass `validityStartHeight` — a stale `getBlockNumber()` from an
 * unsynced Pay instance causes "wallet validity end reached". Let the wallet
 * fill the current height.
 */
export async function sendBasicTransactionWithDataViaPay(
  tx: BasicTxWithDataRequest
): Promise<void> {
  const memo = String(tx.memo ?? "").trim();
  if (!memo) throw new Error("missing_memo");
  const luna = Math.floor(Number(String(tx.amountLuna ?? "").trim()));
  if (!Number.isFinite(luna) || luna < 1) throw new Error("invalid_amount");
  const grouped = recipientGrouped(String(tx.recipient ?? ""));
  const compact = recipientCompact(String(tx.recipient ?? ""));
  if (!grouped && !compact) throw new Error("missing_recipient");

  // Local payEmulate stub hung off the host marker object.
  const hostStub = window.nimiqPay?.sendBasicTransactionWithData;
  if (typeof hostStub === "function") {
    const stubTx = buildNimiqPaySendParams({
      recipient: grouped || compact,
      value: luna,
      memo,
    });
    await hostStub({
      recipient: stubTx.recipient,
      value: BigInt(stubTx.value),
      data: stubTx.data,
      extraData: stubTx.extraData,
      recipientData: stubTx.recipientData,
    });
    return;
  }

  const { init } = await import("@nimiq/mini-app-sdk");
  const nimiq = await init({ timeout: 10_000 });

  // Grouped address first (Pay UI), then compact. Memo is hex `data` + UTF-8
  // `extraData` on every attempt so a successful first send still verifies.
  const attempts = [grouped || compact, compact || grouped];

  let lastMsg = "nimiq_pay_payment_failed";
  for (let i = 0; i < attempts.length; i++) {
    const recipient = attempts[i]!;
    if (i > 0 && recipient === attempts[0]) continue;
    try {
      const result = await nimiq.sendBasicTransactionWithData(
        buildNimiqPaySendParams({ recipient, value: luna, memo })
      );
      if (typeof result === "string" && result.trim()) return;
      if (isProviderErrorResponse(result)) {
        lastMsg = providerErrorText(result.error);
        const lower = lastMsg.toLowerCase();
        if (isUserAbortMessage(lower)) {
          throw new Error(lastMsg);
        }
        const retryable =
          lower.includes("invalid_amount") ||
          lower.includes("invalid amount") ||
          lower.includes("data") ||
          lower.includes("hex") ||
          lower.includes("recipient") ||
          lower.includes("address");
        if (retryable) continue;
        throw new Error(lastMsg);
      }
      if (result == null) return;
      lastMsg = "nimiq_pay_unexpected_response";
      break;
    } catch (e) {
      lastMsg = extractThrownMessage(e);
      if (isUserAbortMessage(lastMsg)) throw new Error(lastMsg);
      const lower = lastMsg.toLowerCase();
      const retryable =
        lower.includes("invalid_amount") ||
        lower.includes("invalid amount") ||
        lower.includes("data") ||
        lower.includes("hex") ||
        lower.includes("recipient") ||
        lower.includes("address");
      if (!retryable) throw e instanceof Error ? e : new Error(lastMsg);
    }
  }
  throw new Error(lastMsg);
}
