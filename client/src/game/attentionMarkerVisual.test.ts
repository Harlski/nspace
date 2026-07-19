import assert from "node:assert/strict";
import test from "node:test";

import {
  ATTENTION_MARKER_HOVER_HEIGHT_DEFAULT,
  ATTENTION_MARKER_SIZE_PERCENT_DEFAULT,
  attentionMarkerHoverLift,
  attentionMarkerPreviewContrastRgb,
  attentionMarkerScaleFromPercent,
  clampAttentionMarkerSizePercent,
} from "./attentionMarkerVisual.js";

test("attentionMarkerHoverLift increases with Hover Height", () => {
  const a = attentionMarkerHoverLift(0);
  const b = attentionMarkerHoverLift(1);
  const c = attentionMarkerHoverLift(3);
  assert.ok(b > a);
  assert.ok(c > b);
  assert.equal(ATTENTION_MARKER_HOVER_HEIGHT_DEFAULT, 1);
});

test("clampAttentionMarkerSizePercent steps 20..100 by 10", () => {
  assert.equal(clampAttentionMarkerSizePercent(10), 20);
  assert.equal(clampAttentionMarkerSizePercent(55), 60);
  assert.equal(clampAttentionMarkerSizePercent(70), 70);
  assert.equal(clampAttentionMarkerSizePercent(200), 100);
  assert.equal(ATTENTION_MARKER_SIZE_PERCENT_DEFAULT, 100);
  assert.equal(attentionMarkerScaleFromPercent(50), 0.5);
  assert.equal(attentionMarkerScaleFromPercent(20), 0.2);
});

test("attentionMarkerPreviewContrastRgb darkens near-white for light bake BGs", () => {
  assert.notEqual(attentionMarkerPreviewContrastRgb(0xffffff), 0xffffff);
  assert.equal(attentionMarkerPreviewContrastRgb(0xff8800), 0xff8800);
});
