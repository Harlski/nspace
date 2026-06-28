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
    assert.ok(showcases.length > 0);
    const trail = showcases.find((s) => s.slot === "trail");
    assert.equal(trail?.trailPaceTiles, 10);
    assert.ok(trail?.tryOnZ !== undefined);
    const deployable = showcases.find((s) => s.slot === "deployable");
    assert.equal(deployable?.kind, "floor");
    for (const s of showcases) {
      assert.match(s.fakeAddress, /^NQ/);
      assert.ok(s.label.length > 0);
    }
  });

  it("lays trail presets in parallel lanes along map length with try-on pads south", () => {
    const { showcases } = buildCosmeticGalleryPayload();
    const trails = showcases.filter((s) => s.slot === "trail");
    assert.ok(trails.length >= 5);
    const trailStartZs = [...new Set(trails.map((s) => s.z))];
    assert.equal(trailStartZs.length, 1);
    assert.equal(trailStartZs[0], -14);
    const laneXs = trails.map((s) => s.x).sort((a, b) => a - b);
    for (let i = 1; i < laneXs.length; i++) {
      assert.ok(laneXs[i]! - laneXs[i - 1]! <= 2.21);
    }
    for (const t of trails) {
      assert.equal(t.tryOnZ, t.z - 2.2);
      assert.equal(t.tryOnX, t.x);
      assert.equal(t.trailPaceTiles, 10);
    }
  });

  it("recognizes gallery room id", () => {
    assert.equal(isCosmeticGalleryRoom(COSMETIC_GALLERY_ROOM_ID), true);
    assert.equal(isCosmeticGalleryRoom("hub"), false);
  });

  it("uses deterministic fake addresses per preset", () => {
    const a = galleryFakeAddress("trail-sparkle", 0);
    const b = galleryFakeAddress("trail-sparkle", 0);
    const c = galleryFakeAddress("aura-cyan", 1);
    assert.equal(a, b);
    assert.notEqual(a, c);
  });
});
