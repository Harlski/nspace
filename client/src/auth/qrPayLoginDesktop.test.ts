import { describe, expect, it } from "vitest";
import { buildUnencodedPayQrPayload } from "./qrPayLoginDesktop.js";

describe("buildUnencodedPayQrPayload", () => {
  it("builds an unencoded deeplink from spaUrl", () => {
    const spa = "http://192.168.88.176:5173/auth/qr/abc123";
    expect(buildUnencodedPayQrPayload({ spaUrl: spa })).toBe(
      `nimiqpay://miniapp?url=${spa}`
    );
  });

  it("decodes a legacy percent-encoded payDeepLink when spaUrl is missing", () => {
    const spa = "http://192.168.88.176:5173/auth/qr/abc123";
    expect(
      buildUnencodedPayQrPayload({
        payDeepLink: `nimiqpay://miniapp?url=${encodeURIComponent(spa)}`,
      })
    ).toBe(`nimiqpay://miniapp?url=${spa}`);
  });

  it("prefers spaUrl over an encoded payDeepLink", () => {
    const spa = "http://192.168.1.10:5173/auth/qr/xyz";
    expect(
      buildUnencodedPayQrPayload({
        spaUrl: spa,
        payDeepLink: `nimiqpay://miniapp?url=${encodeURIComponent("https://other.example/auth/qr/old")}`,
      })
    ).toBe(`nimiqpay://miniapp?url=${spa}`);
  });
});
