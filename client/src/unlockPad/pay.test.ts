import { describe, expect, it } from "vitest";
import {
  buildUnlockPadHubCheckoutRequest,
  isUnlockPadPaymentUserCancel,
} from "./pay.js";

describe("buildUnlockPadHubCheckoutRequest", () => {
  const base = {
    intentId: "intent-1",
    amountLuna: "100000",
    amountNimLabel: "1",
    recipient: "NQ07 0000 0000 0000 0000 0000 0000 0000 0000",
    memo: "nspace.unlock_pad:abc",
  };

  it("builds Hub checkout with luna value and memo as extraData", () => {
    expect(buildUnlockPadHubCheckoutRequest(base)).toEqual({
      appName: "Nimiq Space",
      recipient: base.recipient,
      value: 100000,
      extraData: base.memo,
    });
  });

  it("rejects missing memo", () => {
    expect(() =>
      buildUnlockPadHubCheckoutRequest({ ...base, memo: "  " })
    ).toThrow("missing_memo");
  });

  it("rejects invalid amount", () => {
    expect(() =>
      buildUnlockPadHubCheckoutRequest({ ...base, amountLuna: "0" })
    ).toThrow("invalid_amount");
  });
});

describe("isUnlockPadPaymentUserCancel", () => {
  it("detects cancel-like errors", () => {
    expect(isUnlockPadPaymentUserCancel(new Error("Request aborted"))).toBe(
      true
    );
    expect(isUnlockPadPaymentUserCancel("User cancelled")).toBe(true);
    expect(isUnlockPadPaymentUserCancel("popup closed")).toBe(true);
    expect(isUnlockPadPaymentUserCancel("network_error")).toBe(false);
  });
});
