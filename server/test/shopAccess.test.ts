import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, afterEach, describe, it } from "node:test";
import {
  isShopEnvEnabled,
  isShopOpenFromFlags,
  isShopPubliclyOpen,
} from "../src/shopAccess.js";
import { patchAdminRuntimeSettings } from "../src/adminRuntimeSettingsStore.js";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nspace-shop-access-"));
const settingsFile = path.join(dir, "settings.json");
process.env.ADMIN_RUNTIME_SETTINGS_FILE = settingsFile;

const prevShop = process.env.SHOP_ENABLED;

after(() => {
  fs.rmSync(dir, { recursive: true, force: true });
  delete process.env.ADMIN_RUNTIME_SETTINGS_FILE;
  if (prevShop === undefined) delete process.env.SHOP_ENABLED;
  else process.env.SHOP_ENABLED = prevShop;
});

describe("isShopOpenFromFlags", () => {
  it("is open unless env is 0 or admin checkbox is off", () => {
    assert.equal(
      isShopOpenFromFlags({ envFlag: undefined, adminShopEnabled: true }),
      true
    );
    assert.equal(
      isShopOpenFromFlags({ envFlag: "1", adminShopEnabled: true }),
      true
    );
    assert.equal(
      isShopOpenFromFlags({ envFlag: "0", adminShopEnabled: true }),
      false
    );
    assert.equal(
      isShopOpenFromFlags({ envFlag: undefined, adminShopEnabled: false }),
      false
    );
    assert.equal(
      isShopOpenFromFlags({ envFlag: "0", adminShopEnabled: false }),
      false
    );
  });
});

describe("isShopPubliclyOpen", () => {
  afterEach(() => {
    process.env.ADMIN_RUNTIME_SETTINGS_FILE = settingsFile;
    patchAdminRuntimeSettings({ shopEnabled: true });
    if (prevShop === undefined) delete process.env.SHOP_ENABLED;
    else process.env.SHOP_ENABLED = prevShop;
  });

  it("defaults on when env is unset and admin flag is default", () => {
    delete process.env.SHOP_ENABLED;
    patchAdminRuntimeSettings({ shopEnabled: true });
    assert.equal(isShopPubliclyOpen(), true);
    assert.equal(isShopEnvEnabled(), true);
  });

  it("env kill switch closes even when admin checkbox is on", () => {
    patchAdminRuntimeSettings({ shopEnabled: true });
    process.env.SHOP_ENABLED = "0";
    assert.equal(isShopPubliclyOpen(), false);
    assert.equal(isShopEnvEnabled(), false);
  });

  it("admin checkbox off closes when env is not 0", () => {
    process.env.SHOP_ENABLED = "1";
    patchAdminRuntimeSettings({ shopEnabled: false });
    assert.equal(isShopPubliclyOpen(), false);
    assert.equal(isShopEnvEnabled(), true);
  });
});
