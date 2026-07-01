import { describe, expect, it } from "vitest";
import {
  isShopPubliclyOpen,
  SHOP_COMING_SOON_BODY,
  SHOP_COMING_SOON_HEADING,
} from "./shopAccess.js";

describe("shopAccess", () => {
  it("is closed unless VITE_SHOP_ENABLED=1", () => {
    expect(isShopPubliclyOpen()).toBe(false);
  });

  it("uses COMING SOON copy", () => {
    expect(SHOP_COMING_SOON_HEADING).toBe("COMING SOON");
    expect(SHOP_COMING_SOON_BODY).toMatch(/isn't open yet/i);
  });
});
