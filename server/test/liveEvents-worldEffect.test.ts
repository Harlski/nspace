import assert from "node:assert/strict";
import test from "node:test";
import {
  applyLiveEarnMultiplier,
  applyWorldEffect,
  consumeLiveBoostExpiry,
  isLiveBoostActive,
  liveWorldEffectWire,
  resetLiveWorldEffectForTests,
} from "../src/liveEvents/worldEffect.js";

const NOW = Date.parse("2026-09-13T12:00:00.000Z");

test("Live Boost doubles gameplay luna only while the window is open", () => {
  resetLiveWorldEffectForTests();
  assert.equal(applyLiveEarnMultiplier(100n, NOW), 100n);

  applyWorldEffect(
    {
      kind: "live_boost",
      earnMultiplier: 2,
      untilMs: NOW + 60_000,
      liveEventId: "11111111-1111-1111-1111-111111111111",
    },
    NOW
  );
  assert.equal(isLiveBoostActive(NOW), true);
  assert.equal(applyLiveEarnMultiplier(50_000n, NOW), 100_000n);
  assert.equal(applyLiveEarnMultiplier(0n, NOW), 0n);
  assert.equal(applyLiveEarnMultiplier(50_000n, NOW + 60_000), 50_000n);

  const wire = liveWorldEffectWire(NOW);
  assert.equal(wire.active, true);
  assert.equal(wire.kind, "live_boost");
  assert.equal(wire.earnMultiplier, 2);
  assert.equal(wire.untilMs, NOW + 60_000);
});

test("overlapping Live Boosts extend the window and do not stack the multiplier", () => {
  resetLiveWorldEffectForTests();
  applyWorldEffect(
    {
      kind: "live_boost",
      earnMultiplier: 2,
      untilMs: NOW + 60_000,
      liveEventId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    },
    NOW
  );
  applyWorldEffect(
    {
      kind: "live_boost",
      earnMultiplier: 2,
      untilMs: NOW + 90_000,
      liveEventId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    },
    NOW + 10_000
  );
  assert.equal(applyLiveEarnMultiplier(10n, NOW + 10_000), 20n);
  assert.equal(liveWorldEffectWire(NOW + 10_000).untilMs, NOW + 90_000);
});

test("consumeLiveBoostExpiry fires once when the window ends", () => {
  resetLiveWorldEffectForTests();
  applyWorldEffect(
    {
      kind: "live_boost",
      earnMultiplier: 2,
      untilMs: NOW + 1_000,
      liveEventId: "11111111-1111-1111-1111-111111111111",
    },
    NOW
  );
  assert.equal(consumeLiveBoostExpiry(NOW), false);
  assert.equal(consumeLiveBoostExpiry(NOW + 1_000), true);
  assert.equal(consumeLiveBoostExpiry(NOW + 2_000), false);
  assert.deepEqual(liveWorldEffectWire(NOW + 2_000), {
    active: false,
    serverNowMs: NOW + 2_000,
  });
});
