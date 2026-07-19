import { describe, expect, it } from "vitest";
import {
  createPaletteSvPicker,
  setPaletteSvPickerRgb,
  PALETTE_SV_PICKER,
  PALETTE_SV_FIELD,
  PALETTE_SV_HUE,
} from "./paletteSvPicker.js";

describe("createPaletteSvPicker", () => {
  it("builds SV field + hue strip", () => {
    const parts = createPaletteSvPicker({ ariaLabel: "Floor tile color" });
    expect(parts.wrap.className).toBe(PALETTE_SV_PICKER);
    expect(parts.sv.className).toBe(PALETTE_SV_FIELD);
    expect(parts.hue.className).toBe(PALETTE_SV_HUE);
    expect(parts.wrap.getAttribute("aria-label")).toBe("Floor tile color");
  });

  it("positions cursors from rgb", () => {
    const parts = createPaletteSvPicker({ ariaLabel: "Test" });
    setPaletteSvPickerRgb(parts, 0xff0000);
    expect(parts.sv.style.getPropertyValue("--palette-sv-hue")).toBe("0");
    expect(parts.svCursor.style.left).toBe("100%");
    expect(parts.svCursor.style.top).toBe("0%");
    expect(parts.hueCursor.style.top).toBe("0%");
  });
});
