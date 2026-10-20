import { describe, expect, it } from "vitest";
import { buildQrSpaUrlPayload } from "./qrPayLoginDesktop.js";

describe("buildQrSpaUrlPayload", () => {
  it("uses the plain spaUrl with no deeplink wrapper or encoding", () => {
    const spa = "http://192.168.88.176:5173/auth/qr/abc123";
    expect(buildQrSpaUrlPayload({ spaUrl: spa })).toBe(spa);
    expect(buildQrSpaUrlPayload({ spaUrl: spa })).not.toContain("%");
    expect(buildQrSpaUrlPayload({ spaUrl: spa })).not.toContain("nimiqpay://");
  });

  it("unwraps and decodes a legacy percent-encoded payDeepLink", () => {
    const spa = "http://192.168.88.176:5173/auth/qr/abc123";
    expect(
      buildQrSpaUrlPayload({
        payDeepLink: `nimiqpay://miniapp?url=${encodeURIComponent(spa)}`,
      })
    ).toBe(spa);
  });

  it("prefers spaUrl over payDeepLink", () => {
    const spa = "http://192.168.1.10:5173/auth/qr/xyz";
    expect(
      buildQrSpaUrlPayload({
        spaUrl: spa,
        payDeepLink: `nimiqpay://miniapp?url=${encodeURIComponent("https://other.example/auth/qr/old")}`,
      })
    ).toBe(spa);
  });
});
