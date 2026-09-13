import assert from "node:assert/strict";
import test from "node:test";
import {
  LIVE_EVENT_TYPE_TEST,
  mapLiveEventToWorldEffect,
} from "../src/liveEvents/mapping.js";

const ID = "11111111-1111-1111-1111-111111111111";
const NOW = Date.parse("2026-09-13T12:00:00.000Z");

function withBoostMs(t: test.TestContext, value: string | undefined): void {
  const prev = process.env.LIVE_EVENT_TEST_BOOST_MS;
  if (value === undefined) delete process.env.LIVE_EVENT_TEST_BOOST_MS;
  else process.env.LIVE_EVENT_TEST_BOOST_MS = value;
  t.after(() => {
    if (prev === undefined) delete process.env.LIVE_EVENT_TEST_BOOST_MS;
    else process.env.LIVE_EVENT_TEST_BOOST_MS = prev;
  });
}

test("nimiqlive.test maps to a reversible Live Boost World Effect", (t) => {
  withBoostMs(t, "60000");
  const effect = mapLiveEventToWorldEffect(LIVE_EVENT_TYPE_TEST, ID, NOW);
  assert.deepEqual(effect, {
    kind: "live_boost",
    earnMultiplier: 2,
    untilMs: NOW + 60_000,
    liveEventId: ID,
  });
});

test("unknown Live Event types map to no World Effect", () => {
  assert.equal(
    mapLiveEventToWorldEffect("nimiqlive.twitch.subscribe", ID, NOW),
    null
  );
});

test("Live Boost duration is clamped and not taken from the Live Event", (t) => {
  withBoostMs(t, "5");
  const short = mapLiveEventToWorldEffect(LIVE_EVENT_TYPE_TEST, ID, NOW);
  assert.equal(short?.untilMs, NOW + 15_000);

  withBoostMs(t, "99999999");
  const long = mapLiveEventToWorldEffect(LIVE_EVENT_TYPE_TEST, ID, NOW);
  assert.equal(long?.untilMs, NOW + 15 * 60_000);
});
