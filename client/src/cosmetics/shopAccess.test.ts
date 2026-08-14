import { afterEach, describe, expect, it } from "vitest";
import {
  applySessionShopAccess,
  isShaperReachable,
  isShopPubliclyOpen,
  resetSessionShopAccess,
  shopEnabledFromEnvFlag,
  SHOP_COMING_SOON_BODY,
  SHOP_COMING_SOON_HEADING,
} from "./shopAccess.js";

describe("shopAccess", () => {
  afterEach(() => {
    resetSessionShopAccess();
  });

  it("treats unset and non-0 as open; 0 closes", () => {
    expect(shopEnabledFromEnvFlag(undefined)).toBe(true);
    expect(shopEnabledFromEnvFlag("1")).toBe(true);
    expect(shopEnabledFromEnvFlag("0")).toBe(false);
  });

  it("is open by default at build time unless VITE_SHOP_ENABLED=0", () => {
    expect(isShopPubliclyOpen()).toBe(
      shopEnabledFromEnvFlag(import.meta.env.VITE_SHOP_ENABLED)
    );
  });

  it("follows the server Shop-open flag in a live session", () => {
    applySessionShopAccess({ shopOpen: false, shaperReachable: false });
    if (shopEnabledFromEnvFlag(import.meta.env.VITE_SHOP_ENABLED)) {
      expect(isShopPubliclyOpen()).toBe(false);
      expect(isShaperReachable()).toBe(false);
      applySessionShopAccess({ shopOpen: true, shaperReachable: true });
      expect(isShopPubliclyOpen()).toBe(true);
      expect(isShaperReachable()).toBe(true);
      applySessionShopAccess({ shopOpen: true, shaperReachable: false });
      expect(isShopPubliclyOpen()).toBe(true);
      expect(isShaperReachable()).toBe(false);
    } else {
      expect(isShopPubliclyOpen()).toBe(false);
    }
  });

  it("uses COMING SOON copy", () => {
    expect(SHOP_COMING_SOON_HEADING).toBe("COMING SOON");
    expect(SHOP_COMING_SOON_BODY).toMatch(/isn't open yet/i);
  });
});
