import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, afterEach, beforeEach, describe, it } from "node:test";
import {
  buildCosmeticGalleryPayload,
  COSMETIC_GALLERY_JOIN_CODE,
  COSMETIC_GALLERY_ROOM_ID,
  cosmeticGalleryWelcomeExtras,
  galleryFakeAddress,
  isCosmeticGalleryEnabled,
  isCosmeticGalleryRoom,
  isShaperReachable,
  resolveCosmeticGalleryJoinCode,
} from "../src/cosmeticGallery.js";
import { isShopPubliclyOpen } from "../src/shopAccess.js";
import { patchAdminRuntimeSettings } from "../src/adminRuntimeSettingsStore.js";
import { listCosmeticPresets } from "../src/cosmeticPresets.js";

const adminDir = fs.mkdtempSync(path.join(os.tmpdir(), "nspace-gallery-shop-"));
process.env.ADMIN_RUNTIME_SETTINGS_FILE = path.join(adminDir, "settings.json");

describe("cosmeticGallery", () => {
  const prevShaperEnabled = process.env.SHAPER_ENABLED;
  const prevShopEnabled = process.env.SHOP_ENABLED;
  const prevNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.ADMIN_RUNTIME_SETTINGS_FILE = path.join(adminDir, "settings.json");
    delete process.env.SHAPER_ENABLED;
    process.env.SHOP_ENABLED = "1";
    patchAdminRuntimeSettings({ shopEnabled: true });
  });

  afterEach(() => {
    if (prevShaperEnabled === undefined) delete process.env.SHAPER_ENABLED;
    else process.env.SHAPER_ENABLED = prevShaperEnabled;
    if (prevShopEnabled === undefined) delete process.env.SHOP_ENABLED;
    else process.env.SHOP_ENABLED = prevShopEnabled;
    process.env.NODE_ENV = prevNodeEnv;
  });

  after(() => {
    fs.rmSync(adminDir, { recursive: true, force: true });
  });

  it("is enabled by default when shop is open", () => {
    assert.equal(isCosmeticGalleryEnabled(), true);
    process.env.NODE_ENV = "production";
    assert.equal(isCosmeticGalleryEnabled(), true);
    assert.equal(
      resolveCosmeticGalleryJoinCode(COSMETIC_GALLERY_JOIN_CODE),
      COSMETIC_GALLERY_ROOM_ID
    );
  });

  it("can be disabled by operators while unfinished", () => {
    process.env.SHAPER_ENABLED = "0";
    assert.equal(isCosmeticGalleryEnabled(), false);
    assert.equal(resolveCosmeticGalleryJoinCode(COSMETIC_GALLERY_JOIN_CODE), null);
    assert.equal(isShaperReachable(), false);
    assert.equal(isShopPubliclyOpen(), true);
  });

  it("blocks SPACER joins while the shop is closed", () => {
    process.env.SHOP_ENABLED = "0";
    assert.equal(resolveCosmeticGalleryJoinCode(COSMETIC_GALLERY_JOIN_CODE), null);
    assert.equal(isShaperReachable(), false);
  });

  it("maps SPACER to cosmetic-gallery", () => {
    assert.equal(resolveCosmeticGalleryJoinCode("spacer"), COSMETIC_GALLERY_ROOM_ID);
    assert.equal(resolveCosmeticGalleryJoinCode("SPACER"), COSMETIC_GALLERY_ROOM_ID);
    assert.equal(resolveCosmeticGalleryJoinCode("hub"), null);
  });

  it("does not inject auto Preset gallery into welcome extras", () => {
    assert.deepEqual(cosmeticGalleryWelcomeExtras(COSMETIC_GALLERY_ROOM_ID), {});
    assert.deepEqual(cosmeticGalleryWelcomeExtras("hub"), {});
  });

  it("keeps buildCosmeticGalleryPayload for offline layout reference only", () => {
    const { showcases } = buildCosmeticGalleryPayload();
    assert.equal(showcases.length, listCosmeticPresets().length);
  });

  it("recognizes gallery room id", () => {
    assert.equal(isCosmeticGalleryRoom(COSMETIC_GALLERY_ROOM_ID), true);
    assert.equal(isCosmeticGalleryRoom("hub"), false);
  });

  it("uses deterministic fake addresses per preset", () => {
    const a = galleryFakeAddress("test-trail", 0);
    const b = galleryFakeAddress("test-trail", 0);
    const c = galleryFakeAddress("test-aura", 1);
    assert.equal(a, b);
    assert.notEqual(a, c);
  });
});
