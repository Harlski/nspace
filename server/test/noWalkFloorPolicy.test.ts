import assert from "node:assert/strict";
import test from "node:test";

import { canPaintNoWalkFloor } from "../src/noWalkFloor/policy.js";

test("canPaintNoWalkFloor allows owners/builders in editable rooms", () => {
  assert.equal(
    canPaintNoWalkFloor({
      isAdmin: false,
      canEditContent: true,
      isHub: false,
      isPixel: false,
      isCanvas: false,
      isWorldCupField: false,
      isCosmeticGallery: false,
    }),
    true
  );
});

test("canPaintNoWalkFloor denies Pixel, Canvas, World Cup, and cosmetic gallery", () => {
  const base = {
    isAdmin: true,
    canEditContent: true,
    isHub: false,
    isPixel: false,
    isCanvas: false,
    isWorldCupField: false,
    isCosmeticGallery: false,
  };
  assert.equal(canPaintNoWalkFloor({ ...base, isPixel: true }), false);
  assert.equal(canPaintNoWalkFloor({ ...base, isCanvas: true }), false);
  assert.equal(canPaintNoWalkFloor({ ...base, isWorldCupField: true }), false);
  assert.equal(canPaintNoWalkFloor({ ...base, isCosmeticGallery: true }), false);
});

test("canPaintNoWalkFloor on Hub requires admin", () => {
  assert.equal(
    canPaintNoWalkFloor({
      isAdmin: false,
      canEditContent: true,
      isHub: true,
      isPixel: false,
      isCanvas: false,
      isWorldCupField: false,
      isCosmeticGallery: false,
    }),
    false
  );
  assert.equal(
    canPaintNoWalkFloor({
      isAdmin: true,
      canEditContent: true,
      isHub: true,
      isPixel: false,
      isCanvas: false,
      isWorldCupField: false,
      isCosmeticGallery: false,
    }),
    true
  );
});
