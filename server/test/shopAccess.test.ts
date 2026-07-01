import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { isShopPubliclyOpen } from "../src/shopAccess.js";

describe("isShopPubliclyOpen", () => {
  const prev = process.env.SHOP_ENABLED;

  afterEach(() => {
    if (prev === undefined) delete process.env.SHOP_ENABLED;
    else process.env.SHOP_ENABLED = prev;
  });

  it("is closed unless SHOP_ENABLED=1", () => {
    delete process.env.SHOP_ENABLED;
    assert.equal(isShopPubliclyOpen(), false);
    process.env.SHOP_ENABLED = "0";
    assert.equal(isShopPubliclyOpen(), false);
    process.env.SHOP_ENABLED = "1";
    assert.equal(isShopPubliclyOpen(), true);
  });
});
