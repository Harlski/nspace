import assert from "node:assert/strict";
import test from "node:test";
import { buildDockContextParamVisible } from "./buildDockContextParams.js";

const base = {
  tool: "block" as const,
  pyramid: false,
  hex: false,
  sphere: false,
  ramp: false,
  plainCube: true,
  minimalInspector: false,
  blockParams: true,
};

test("unlock-pad-config shows when unlockPadConfig is set, even if minimalInspector", () => {
  assert.equal(
    buildDockContextParamVisible("unlock-pad-config", {
      ...base,
      tool: "unlock-pad",
      minimalInspector: true,
      unlockPadConfig: true,
    }),
    true
  );
  assert.equal(
    buildDockContextParamVisible("unlock-pad-config", {
      ...base,
      tool: "unlock-pad",
      minimalInspector: true,
      unlockPadConfig: false,
    }),
    false
  );
});

test("unlock-pad-config does not show for ordinary block placement", () => {
  assert.equal(
    buildDockContextParamVisible("unlock-pad-config", {
      ...base,
      unlockPadConfig: false,
    }),
    false
  );
});

test("attention-marker-hover shows when attentionMarkerHover is set", () => {
  assert.equal(
    buildDockContextParamVisible("attention-marker-hover", {
      ...base,
      tool: "attention-marker",
      minimalInspector: true,
      attentionMarkerHover: true,
    }),
    true
  );
});
