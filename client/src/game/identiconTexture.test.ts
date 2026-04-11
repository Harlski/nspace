import { describe, expect, it } from "vitest";
import { identiconDataUrl } from "./identiconTexture.js";

describe("identiconDataUrl", () => {
  it("returns a base64 SVG data URL", async () => {
    const url = await identiconDataUrl(
      "NQ1000000000000000000000000000000000000"
    );
    expect(url.startsWith("data:image/svg+xml;base64,")).toBe(true);
  });

  it("includes composed sprite paths (not only the empty base layer)", async () => {
    const url = await identiconDataUrl(
      "NQ1000000000000000000000000000000000000"
    );
    const b64 = url.slice("data:image/svg+xml;base64,".length);
    const decoded = atob(b64);
    // Without IdenticonsAssets, the library renders only background + circle (~1k).
    // With assets, the SVG contains many path segments from face/top/side/bottom.
    expect(decoded.length).toBeGreaterThan(4000);
    expect(decoded.match(/<path/g)?.length ?? 0).toBeGreaterThan(10);
  });

  it("is visually deterministic for the same address (clip ids use Math.random)", async () => {
    const a = "NQABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const u1 = await identiconDataUrl(a);
    const u2 = await identiconDataUrl(a);
    const norm = (url: string) =>
      atob(url.slice("data:image/svg+xml;base64,".length)).replace(
        /hexagon-clip-\d+/g,
        "hexagon-clip-X"
      );
    expect(norm(u1)).toBe(norm(u2));
  });
});
