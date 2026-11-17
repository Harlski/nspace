import { afterEach, describe, expect, it, vi } from "vitest";
import { mountQrPayLoginPhonePage } from "./qrPayLoginPhone.js";

vi.mock("../game/identiconTexture.js", () => ({
  identiconDataUrl: vi.fn(async () => "data:image/svg+xml,ok"),
}));

const ADDRESS = "NQ07 AAAABBBBCCCCDDDDEEEEFFFFGGGGHHHHIIII";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("mountQrPayLoginPhonePage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
    document.body.innerHTML = "";
    delete (window as { nimiqPay?: unknown }).nimiqPay;
  });

  it("shows the authorizing account instead of the sign-in form", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/challenge")) {
          return jsonResponse({
            status: "fulfilled",
            address: ADDRESS,
            nimiqPay: true,
          });
        }
        return jsonResponse({ error: "not_found" }, 404);
      })
    );

    const app = document.createElement("div");
    document.body.appendChild(app);
    const cleanup = mountQrPayLoginPhonePage(app, "ticket-1");

    await vi.waitFor(() => {
      expect(app.querySelector("#qr-pay-phone-address")?.textContent).toContain(
        "NQ07"
      );
    });

    expect(app.querySelector("#qr-pay-phone-title")?.textContent).toBe("Signed in");
    expect(app.querySelector("#qr-pay-phone-title")?.textContent).not.toBe(
      "Sign in on this device"
    );
    expect(app.querySelector("#qr-pay-phone-method")?.textContent).toBe("Nimiq Pay");
    expect(app.querySelector("#qr-pay-phone-account")?.hasAttribute("hidden")).toBe(
      false
    );
    expect((app.querySelector("#qr-pay-phone-actions") as HTMLElement).hidden).toBe(
      true
    );
    expect(app.textContent).not.toContain("Sign in on this device");

    cleanup();
  });

  it("keeps the account on screen when a reload finds the ticket already claimed", async () => {
    sessionStorage.setItem(
      "nspace.qrPayLogin.phoneReceipt",
      JSON.stringify({
        "ticket-1": { address: ADDRESS, nimiqPay: false, at: Date.now() },
      })
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ status: "expired" }))
    );

    const app = document.createElement("div");
    document.body.appendChild(app);
    const cleanup = mountQrPayLoginPhonePage(app, "ticket-1");

    await vi.waitFor(() => {
      expect(app.querySelector("#qr-pay-phone-address")?.textContent).toContain(
        "AAAA"
      );
    });
    expect(app.querySelector("#qr-pay-phone-method")?.textContent).toBe(
      "Nimiq Wallet"
    );
    expect(app.textContent).not.toContain("Sign in on this device");
    cleanup();
  });

  it("shows the sign-in form only while the ticket is still pending", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          status: "pending",
          nonce: "abc",
          message: "Login:v1:abc",
          expiresAt: Date.now() + 60_000,
        })
      )
    );

    const app = document.createElement("div");
    document.body.appendChild(app);
    const cleanup = mountQrPayLoginPhonePage(app, "ticket-1");

    await vi.waitFor(() => {
      expect(app.querySelector("#qr-pay-phone-title")?.textContent).toBe(
        "Sign in on this device"
      );
    });
    expect((app.querySelector("#qr-pay-phone-sign") as HTMLButtonElement).hidden).toBe(
      false
    );
    cleanup();
  });

  it("asks for a final yes before requesting the wallet signature", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        status: "pending",
        nonce: "abc",
        message: "Login:v1:abc",
        expiresAt: Date.now() + 60_000,
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const app = document.createElement("div");
    document.body.appendChild(app);
    const cleanup = mountQrPayLoginPhonePage(app, "ticket-1");

    await vi.waitFor(() => {
      expect(app.querySelector("#qr-pay-phone-title")?.textContent).toBe(
        "Sign in on this device"
      );
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    (app.querySelector("#qr-pay-phone-sign") as HTMLButtonElement).click();
    expect(app.querySelector("#qr-pay-phone-title")?.textContent).toBe("Are you sure?");
    expect(app.querySelector("#qr-pay-phone-sign")?.textContent).toBe("Yes, sign in");
    expect((app.querySelector("#qr-pay-phone-cancel") as HTMLButtonElement).hidden).toBe(
      false
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);

    (app.querySelector("#qr-pay-phone-cancel") as HTMLButtonElement).click();
    expect(app.querySelector("#qr-pay-phone-title")?.textContent).toBe(
      "Sign in on this device"
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it("does not sign automatically inside Nimiq Pay", async () => {
    (window as { nimiqPay?: unknown }).nimiqPay = {};
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        status: "pending",
        nonce: "abc",
        message: "Login:v1:abc",
        expiresAt: Date.now() + 60_000,
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const app = document.createElement("div");
    document.body.appendChild(app);
    const cleanup = mountQrPayLoginPhonePage(app, "ticket-1");

    await vi.waitFor(() => {
      expect(app.querySelector("#qr-pay-phone-title")?.textContent).toBe(
        "Sign in on this device"
      );
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(app.textContent).not.toContain("Are you sure?");
    cleanup();
  });
});
