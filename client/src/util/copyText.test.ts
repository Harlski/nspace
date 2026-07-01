import { describe, it, expect, vi, afterEach } from "vitest";
import { bindCopyToClipboardControl, copyTextToClipboard } from "./copyText.js";

describe("copyTextToClipboard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses navigator.clipboard when available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    await expect(copyTextToClipboard(" NQ123 ")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("NQ123");
  });
});

describe("bindCopyToClipboardControl", () => {
  it("copies on touch pointerup", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const btn = document.createElement("button");
    document.body.appendChild(btn);
    bindCopyToClipboardControl(btn, () => "wallet-id");
    btn.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        pointerId: 1,
        pointerType: "touch",
      })
    );
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith("wallet-id");
    btn.remove();
  });
});
