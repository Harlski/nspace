import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "nspace-live-events-"));
process.env.LIVE_EVENT_STORE_FILE = path.join(TMP, "live-events.sqlite");
process.env.LIVE_EVENT_TEST_BOOST_MS = "60000";

const {
  acceptLiveEvent,
  parseLiveEventEnvelope,
} = await import("../src/liveEvents/receive.js");
const {
  initLiveEventStore,
  hasAcceptedLiveEventId,
  latestLiveBoostUntilMs,
  persistAcceptedLiveEvent,
  _resetLiveEventStoreForTests,
} = await import("../src/liveEvents/store.js");

const NOW = Date.parse("2026-09-13T12:00:00.000Z");
const TEST_BODY = {
  id: "11111111-1111-1111-1111-111111111111",
  type: "nimiqlive.test",
  occurredAt: "2026-09-13T12:00:00.000Z",
  source: "nimiqlive",
  payload: {},
};

test.after(() => {
  _resetLiveEventStoreForTests();
  fs.rmSync(TMP, { recursive: true, force: true });
});

test("parseLiveEventEnvelope accepts the NimiqLIVE test envelope", () => {
  const parsed = parseLiveEventEnvelope(TEST_BODY);
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.envelope.id, TEST_BODY.id);
    assert.equal(parsed.envelope.type, "nimiqlive.test");
    assert.equal(parsed.envelope.source, "nimiqlive");
  }
});

test("parseLiveEventEnvelope rejects bad id, source, and payload", () => {
  assert.equal(parseLiveEventEnvelope({ ...TEST_BODY, id: "not-a-uuid" }).ok, false);
  assert.equal(parseLiveEventEnvelope({ ...TEST_BODY, source: "twitch" }).ok, false);
  assert.equal(parseLiveEventEnvelope({ ...TEST_BODY, payload: [] }).ok, false);
  assert.equal(parseLiveEventEnvelope({ ...TEST_BODY, occurredAt: "soon" }).ok, false);
});

test("acceptLiveEvent persists id, maps test type, and ignores unknown types", () => {
  _resetLiveEventStoreForTests();
  initLiveEventStore();

  const first = acceptLiveEvent(TEST_BODY, NOW);
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.duplicate, false);
  assert.equal(first.ignored, false);
  assert.equal(first.effect?.kind, "live_boost");
  assert.equal(first.effect?.untilMs, NOW + 60_000);
  assert.equal(hasAcceptedLiveEventId(TEST_BODY.id), true);
  assert.equal(latestLiveBoostUntilMs(NOW), NOW + 60_000);

  const retry = acceptLiveEvent(TEST_BODY, NOW + 5_000);
  assert.equal(retry.ok, true);
  if (!retry.ok) return;
  assert.equal(retry.duplicate, true);
  assert.equal(retry.effect, null);
  assert.equal(latestLiveBoostUntilMs(NOW + 5_000), NOW + 60_000);

  const unknown = acceptLiveEvent(
    {
      ...TEST_BODY,
      id: "22222222-2222-2222-2222-222222222222",
      type: "nimiqlive.twitch.subscribe",
      payload: { user: "alice" },
    },
    NOW
  );
  assert.equal(unknown.ok, true);
  if (!unknown.ok) return;
  assert.equal(unknown.duplicate, false);
  assert.equal(unknown.ignored, true);
  assert.equal(unknown.effect, null);
});

test("accepted Live Event ids survive a store reopen (process restart)", () => {
  _resetLiveEventStoreForTests();
  initLiveEventStore();
  persistAcceptedLiveEvent(
    {
      id: "33333333-3333-3333-3333-333333333333",
      type: "nimiqlive.test",
      occurredAt: TEST_BODY.occurredAt,
      source: "nimiqlive",
      payload: {},
    },
    {
      kind: "live_boost",
      earnMultiplier: 2,
      untilMs: NOW + 90_000,
      liveEventId: "33333333-3333-3333-3333-333333333333",
    },
    NOW
  );
  _resetLiveEventStoreForTests();
  initLiveEventStore();
  assert.equal(hasAcceptedLiveEventId("33333333-3333-3333-3333-333333333333"), true);
  assert.equal(latestLiveBoostUntilMs(NOW), NOW + 90_000);
});
