import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("./api.js", () => ({
  createUnlockIntent: vi.fn(),
  syncUnlockPayment: vi.fn(),
}));

vi.mock("../pay/sendPaymentIntent.js", () => ({
  sendPaymentIntentCheckout: vi.fn(),
  isPaymentIntentUserCancel: vi.fn((err: unknown) =>
    String(err).toLowerCase().includes("cancel")
  ),
  paymentIntentOpeningStatus: () => "Opening Nimiq Hub…",
}));

import { createUnlockIntent, syncUnlockPayment } from "./api.js";
import { sendPaymentIntentCheckout } from "../pay/sendPaymentIntent.js";
import { runCosmeticUnlockCheckout } from "./unlockCheckout.js";

const intent = {
  intentId: "intent-1",
  amountLuna: "100000",
  amountNimLabel: "1",
  recipient: "NQ07 TEST",
  memo: "nspace.cosmetic.unlock:sku",
};

describe("runCosmeticUnlockCheckout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(createUnlockIntent).mockResolvedValue({ intent });
    vi.mocked(sendPaymentIntentCheckout).mockResolvedValue(undefined);
    vi.mocked(syncUnlockPayment).mockResolvedValue({ ok: true, granted: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("opens wallet then confirms grant", async () => {
    const statuses: string[] = [];
    const pending = runCosmeticUnlockCheckout("sku-a", (m) => statuses.push(m));
    await vi.runAllTimersAsync();
    const result = await pending;
    expect(result).toEqual({ ok: true });
    expect(sendPaymentIntentCheckout).toHaveBeenCalledWith(intent);
    expect(statuses[0]).toBe("Opening Nimiq Hub…");
    expect(statuses).toContain("Confirming payment…");
  });

  it("returns cancelled when wallet dismisses", async () => {
    vi.mocked(sendPaymentIntentCheckout).mockRejectedValue(
      new Error("User cancelled")
    );
    const result = await runCosmeticUnlockCheckout("sku-a");
    expect(result).toEqual({
      ok: false,
      reason: "cancelled",
      message: "Payment cancelled.",
    });
    expect(syncUnlockPayment).not.toHaveBeenCalled();
  });
});
