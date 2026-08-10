import assert from "node:assert/strict";
import test from "node:test";

import { canPlaceSaleDisplay } from "../src/saleDisplays/policy.js";

test("canPlaceSaleDisplay requires admin", () => {
  assert.equal(
    canPlaceSaleDisplay({
      isAdmin: false,
      isCosmeticGallery: true,
      canPlaceBlocks: true,
    }),
    false
  );
});

test("canPlaceSaleDisplay allows admin in The Shaper even when blocks are locked", () => {
  assert.equal(
    canPlaceSaleDisplay({
      isAdmin: true,
      isCosmeticGallery: true,
      canPlaceBlocks: false,
    }),
    true
  );
});

test("canPlaceSaleDisplay outside Shaper follows canPlaceBlocks", () => {
  assert.equal(
    canPlaceSaleDisplay({
      isAdmin: true,
      isCosmeticGallery: false,
      canPlaceBlocks: false,
    }),
    false
  );
  assert.equal(
    canPlaceSaleDisplay({
      isAdmin: true,
      isCosmeticGallery: false,
      canPlaceBlocks: true,
    }),
    true
  );
});
