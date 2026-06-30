import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  buildCosmeticGalleryPayload,
  COSMETIC_GALLERY_JOIN_CODE,
  COSMETIC_GALLERY_ROOM_ID,
  galleryFakeAddress,
  isCosmeticGalleryEnabled,
  isCosmeticGalleryRoom,
  resolveCosmeticGalleryJoinCode,
} from "../src/cosmeticGallery.js";

describe("cosmeticGallery", () => {
  const prevShaperEnabled = process.env.SHAPER_ENABLED;
  const prevNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    delete process.env.SHAPER_ENABLED;
  });

  afterEach(() => {
    if (prevShaperEnabled === undefined) delete process.env.SHAPER_ENABLED;
    else process.env.SHAPER_ENABLED = prevShaperEnabled;
    process.env.NODE_ENV = prevNodeEnv;
  });

  it("is enabled by default and reachable in production", () => {
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
  });

  it("maps SPACER to cosmetic-gallery", () => {
    assert.equal(resolveCosmeticGalleryJoinCode("spacer"), COSMETIC_GALLERY_ROOM_ID);
    assert.equal(resolveCosmeticGalleryJoinCode("SPACER"), COSMETIC_GALLERY_ROOM_ID);
    assert.equal(resolveCosmeticGalleryJoinCode("hub"), null);
  });

  it("builds one showcase per preset", () => {
    const { showcases } = buildCosmeticGalleryPayload();
    assert.equal(showcases.length, 2);
    assert.ok(showcases.some((s) => s.presetId === "trail-ref-spark-path"));
    assert.ok(showcases.some((s) => s.presetId === "aura-ref-magic-ring"));
  });

  it("lays trail presets in parallel lanes when any exist", () => {
    const { showcases } = buildCosmeticGalleryPayload();
    const trails = showcases.filter((s) => s.slot === "trail");
    assert.equal(trails.length, 1);
    assert.equal(trails[0]!.trailPaceTiles, 10);
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
