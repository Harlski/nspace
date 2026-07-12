import assert from "node:assert/strict";
import test from "node:test";

import {
  ATTENTION_MARKER_HOVER_HEIGHT_DEFAULT,
  attentionMarkerHoverLift,
} from "./attentionMarkerVisual.js";

test("attentionMarkerHoverLift increases with Hover Height", () => {
  const a = attentionMarkerHoverLift(0);
  const b = attentionMarkerHoverLift(1);
  const c = attentionMarkerHoverLift(3);
  assert.ok(b > a);
  assert.ok(c > b);
  assert.equal(ATTENTION_MARKER_HOVER_HEIGHT_DEFAULT, 1);
});
