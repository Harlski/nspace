import { isNimiqPayMiniApp } from "../auth/nimiq.js";

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
 */
export async function sendBasicTransactionWithDataViaPay(
  tx: BasicTxWithDataRequest
): Promise<void> {
  const recipient = String(tx.recipient ?? "").trim();
  if (!recipient) throw new Error("missing_recipient");
  const memo = String(tx.memo ?? "").trim();
  if (!memo) throw new Error("missing_memo");
  const luna = Math.floor(Number(String(tx.amountLuna ?? "").trim()));
  if (!Number.isFinite(luna) || luna < 1) throw new Error("invalid_amount");

  // Local payEmulate stub hung off the host marker object.
  const hostStub = window.nimiqPay?.sendBasicTransactionWithData;
  if (typeof hostStub === "function") {
    await hostStub({
      recipient,
      value: BigInt(luna),
      data: memo,
    });
    return;
  }

  const { init } = await import("@nimiq/mini-app-sdk");
  const nimiq = await init({ timeout: 10_000 });
  let validityStartHeight: number | undefined;
  try {
    const height = await nimiq.getBlockNumber();
    if (typeof height === "number" && Number.isFinite(height)) {
      validityStartHeight = height;
    }
  } catch {
    // Optional; Pay can fill it in.
  }

  const result = await nimiq.sendBasicTransactionWithData({
    recipient,
    value: luna,
    data: memo,
    ...(validityStartHeight != null ? { validityStartHeight } : {}),
  });
  if (isProviderErrorResponse(result)) {
    throw new Error(providerErrorText(result.error));
  }
}
