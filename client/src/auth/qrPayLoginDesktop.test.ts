import { describe, expect, it } from "vitest";
import {
  buildQrLoginPayload,
  buildQrSpaUrlPayload,
  resolveQrSpaOrigin,
  unwrapPlainSpaUrl,
} from "./qrPayLoginDesktop.js";

describe("resolveQrSpaOrigin", () => {
  it("uses server LAN origin when the page is localhost", () => {
    expect(
      resolveQrSpaOrigin({
        origin: "http://localhost:5173",
        spaUrl: "http://192.168.1.51:5173/auth/qr/abc",
      })
    ).toBe("http://192.168.1.51:5173");
  });

  it("keeps the page origin when already on a LAN host", () => {
    expect(
      resolveQrSpaOrigin({
        origin: "http://192.168.1.10:5173",
        spaUrl: "http://192.168.1.51:5173/auth/qr/abc",
      })
    ).toBe("http://192.168.1.10:5173");
  });
});

describe("buildQrSpaUrlPayload", () => {
  it("builds a plain spa URL from origin + ticketId", () => {
    const spa = "http://192.168.88.176:5173/auth/qr/abc123";
    expect(
      buildQrSpaUrlPayload({
        ticketId: "abc123",
        origin: "http://192.168.88.176:5173",
        spaUrl: "https://ignored.example/auth/qr/old",
        payDeepLink: `nimiqpay://miniapp?url=${encodeURIComponent(spa)}`,
      })
    ).toBe(spa);
  });

  it("replaces localhost with server LAN spaUrl in dev", () => {
    expect(
      buildQrSpaUrlPayload({
        ticketId: "abc123",
        origin: "http://localhost:5173",
        spaUrl: "http://192.168.1.51:5173/auth/qr/other",
      })
    ).toBe("http://192.168.1.51:5173/auth/qr/abc123");
  });

  it("unwraps and decodes a legacy percent-encoded payDeepLink", () => {
    const spa = "http://192.168.88.176:5173/auth/qr/abc123";
    expect(
      buildQrSpaUrlPayload({
        payDeepLink: `nimiqpay://miniapp?url=${encodeURIComponent(spa)}`,
      })
    ).toBe(spa);
  });
});

describe("buildQrLoginPayload", () => {
  const base = {
    ticketId: "deadbeef",
    origin: "http://192.168.1.10:5173",
  };

  it("pay mode uses unencoded nimiqpay miniapp deeplink", () => {
    const out = buildQrLoginPayload("pay", base);
    expect(out).toBe(
      "nimiqpay://miniapp?url=http://192.168.1.10:5173/auth/qr/deadbeef"
    );
    expect(out).not.toContain("%");
  });

  it("wallet mode uses plain spa URL for Hub / Wallet sign in browser", () => {
    const out = buildQrLoginPayload("wallet", base);
    expect(out).toBe("http://192.168.1.10:5173/auth/qr/deadbeef");
    expect(out).not.toContain("nimiqpay://");
    expect(out).not.toContain("%");
  });

  it("pay mode on localhost embeds the server LAN host", () => {
    const out = buildQrLoginPayload("pay", {
      ticketId: "deadbeef",
      origin: "http://127.0.0.1:5173",
      spaUrl: "http://192.168.1.51:5173/auth/qr/x",
    });
    expect(out).toBe(
      "nimiqpay://miniapp?url=http://192.168.1.51:5173/auth/qr/deadbeef"
    );
  });
});

describe("unwrapPlainSpaUrl", () => {
  it("decodes percent-encoded http in a deeplink", () => {
    expect(
      unwrapPlainSpaUrl(
        "nimiqpay://miniapp?url=http%3A%2F%2F192.168.1.1%3A5173%2Fauth%2Fqr%2Fx"
      )
    ).toBe("http://192.168.1.1:5173/auth/qr/x");
  });

  it("passes through a plain spa URL", () => {
    expect(unwrapPlainSpaUrl("https://nimiq.space/auth/qr/t")).toBe(
      "https://nimiq.space/auth/qr/t"
    );
  });
});
