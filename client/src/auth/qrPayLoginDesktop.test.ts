import { describe, expect, it } from "vitest";
import {
  buildQrSpaUrlPayload,
  unwrapPlainSpaUrl,
} from "./qrPayLoginDesktop.js";

describe("buildQrSpaUrlPayload", () => {
  it("builds a plain spa URL from origin + ticketId (ignores encoded payDeepLink)", () => {
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

  it("never contains percent-encoding or a nimiqpay wrapper", () => {
    const out = buildQrSpaUrlPayload({
      ticketId: "deadbeef",
      origin: "http://192.168.1.10:5173/",
      payDeepLink: `nimiqpay://miniapp?url=${encodeURIComponent("http://x/auth/qr/deadbeef")}`,
    });
    expect(out).toBe("http://192.168.1.10:5173/auth/qr/deadbeef");
    expect(out).not.toContain("%");
    expect(out).not.toContain("nimiqpay://");
    expect(out).not.toContain("url=");
  });

  it("falls back to spaUrl when origin/ticket are missing", () => {
    const spa = "http://192.168.88.176:5173/auth/qr/abc123";
    expect(buildQrSpaUrlPayload({ spaUrl: spa })).toBe(spa);
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
