import { describe, expect, it } from "vitest";
import {
  hsvToRgbNumber,
  rgbToHsv,
  hueDegToBlockColorRgb,
  blockColorRgbToHueDeg,
} from "./blockStyle.js";

describe("rgbToHsv / hsvToRgbNumber", () => {
  it("round-trips saturated colors", () => {
    const samples = [0xff0000, 0x00ff00, 0x0000ff, 0xe8574a, 0x3d5a4a];
    for (const rgb of samples) {
      const { h, s, v } = rgbToHsv(rgb);
      const back = hsvToRgbNumber(h, s, v);
      const dr = Math.abs(((back >> 16) & 0xff) - ((rgb >> 16) & 0xff));
      const dg = Math.abs(((back >> 8) & 0xff) - ((rgb >> 8) & 0xff));
      const db = Math.abs((back & 0xff) - (rgb & 0xff));
      expect(dr).toBeLessThanOrEqual(1);
      expect(dg).toBeLessThanOrEqual(1);
      expect(db).toBeLessThanOrEqual(1);
    }
  });

  it("maps black and white to zero chroma", () => {
    expect(rgbToHsv(0x000000)).toEqual({ h: 0, s: 0, v: 0 });
    expect(rgbToHsv(0xffffff)).toEqual({ h: 0, s: 0, v: 1 });
  });

  it("keeps hueDeg helper aligned with hsv for chroma colors", () => {
    const rgb = hueDegToBlockColorRgb(120);
    expect(blockColorRgbToHueDeg(rgb)).toBe(120);
  });
});
