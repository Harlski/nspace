import { describe, expect, it } from "vitest";
import {
  buildHubCheckoutRequest,
  isPaymentIntentUserCancel,
} from "./sendPaymentIntent.js";

describe("buildHubCheckoutRequest", () => {
  const base = {
    amountLuna: "100000",
    recipient: "NQ07 0000 0000 0000 0000 0000 0000 0000 0000",
    memo: "nspace.cosmetic.unlock:abc",
  };

  it("builds Hub checkout with luna value and memo as extraData", () => {
    expect(buildHubCheckoutRequest(base)).toEqual({
      appName: "Nimiq Space",
      recipient: base.recipient,
      value: 100000,
      extraData: base.memo,
    });
  });

  it("rejects missing memo", () => {
    expect(() => buildHubCheckoutRequest({ ...base, memo: "  " })).toThrow(
      "missing_memo"
    );
  });

  it("rejects invalid amount", () => {
    expect(() =>
      buildHubCheckoutRequest({ ...base, amountLuna: "0" })
    ).toThrow("invalid_amount");
  });
});

describe("isPaymentIntentUserCancel", () => {
  it("detects cancel-like errors", () => {
    expect(isPaymentIntentUserCancel(new Error("Request aborted"))).toBe(true);
    expect(isPaymentIntentUserCancel("User cancelled")).toBe(true);
    expect(isPaymentIntentUserCancel("popup closed")).toBe(true);
    expect(isPaymentIntentUserCancel("network_error")).toBe(false);
  });
});
