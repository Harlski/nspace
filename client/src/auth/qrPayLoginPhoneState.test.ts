import { describe, expect, it } from "vitest";
import {
  formatQrLoginAccountAddress,
  phoneViewFromChallenge,
  readQrPhoneReceipt,
  writeQrPhoneReceipt,
} from "./qrPayLoginPhoneState.js";

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => {
      data.delete(key);
    },
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

describe("formatQrLoginAccountAddress", () => {
  it("groups a compact address into fours", () => {
    expect(formatQrLoginAccountAddress("nq07aaaabbbb")).toBe("NQ07 AAAA BBBB");
  });

  it("regroups an already spaced address", () => {
    expect(formatQrLoginAccountAddress("NQ07 AAAA BBBB")).toBe("NQ07 AAAA BBBB");
  });
});

describe("phoneViewFromChallenge", () => {
  it("shows the authorizing account after the desktop has claimed the session", () => {
    const view = phoneViewFromChallenge(
      {
        status: "fulfilled",
        address: "NQ07 AAAA BBBB",
        nimiqPay: true,
      },
      null
    );
    expect(view).toEqual({
      view: "authorized",
      receipt: { address: "NQ07 AAAA BBBB", nimiqPay: true },
    });
  });

  it("keeps a custom username and drops a blank one", () => {
    const named = phoneViewFromChallenge(
      {
        status: "fulfilled",
        address: "NQ07 AAAA BBBB",
        nimiqPay: false,
        username: " CafeGuest ",
      },
      null
    );
    expect(named).toEqual({
      view: "authorized",
      receipt: {
        address: "NQ07 AAAA BBBB",
        nimiqPay: false,
        username: "CafeGuest",
      },
    });
    const blank = phoneViewFromChallenge(
      {
        status: "fulfilled",
        address: "NQ07 AAAA BBBB",
        nimiqPay: false,
        username: "  ",
      },
      null
    );
    expect(blank).toEqual({
      view: "authorized",
      receipt: { address: "NQ07 AAAA BBBB", nimiqPay: false },
    });
  });

  it("keeps a remembered account when the ticket is already gone", () => {
    const view = phoneViewFromChallenge(
      { status: "expired" },
      { address: "NQ07 AAAA", nimiqPay: false }
    );
    expect(view.view).toBe("authorized");
  });

  it("stays on the sign-in form only while the ticket is still pending", () => {
    const view = phoneViewFromChallenge(
      {
        status: "pending",
        nonce: "abc",
        message: "Login:v1:abc",
        expiresAt: 1,
      },
      { address: "NQ07 STALE", nimiqPay: true }
    );
    expect(view).toEqual({ view: "pending" });
  });

  it("expires when nothing was authorized", () => {
    expect(phoneViewFromChallenge({ status: "expired" }, null)).toEqual({
      view: "expired",
    });
  });
});

describe("qr phone receipt storage", () => {
  it("round-trips the account for this ticket", () => {
    const storage = memoryStorage();
    writeQrPhoneReceipt(storage, "ticket-1", {
      address: "NQ07 AAAA",
      nimiqPay: true,
    });
    expect(readQrPhoneReceipt(storage, "ticket-1")).toEqual({
      address: "NQ07 AAAA",
      nimiqPay: true,
    });
    expect(readQrPhoneReceipt(storage, "other")).toBeNull();
  });
});
