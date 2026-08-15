import { describe, expect, it } from "vitest";
import {
  isStandingOnSaleDisplayBuyPad,
  saleDisplayBuyPadTile,
} from "./saleDisplayBuyPad.js";

describe("saleDisplayBuyPad", () => {
  it("places the pad one tile on +Z", () => {
    expect(saleDisplayBuyPadTile(3, 7)).toEqual({ x: 3, z: 8 });
  });

  it("recognizes standing on the pad tile", () => {
    expect(isStandingOnSaleDisplayBuyPad(3, 8, 3, 7)).toBe(true);
    expect(isStandingOnSaleDisplayBuyPad(3, 7, 3, 7)).toBe(false);
    expect(isStandingOnSaleDisplayBuyPad(4, 8, 3, 7)).toBe(false);
  });
});
