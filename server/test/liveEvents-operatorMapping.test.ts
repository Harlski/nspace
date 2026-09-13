import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { HUB_ROOM_ID } from "../src/roomLayouts.js";
import {
  parseOperatorMappingInput,
  resolveOperatorRoomId,
} from "../src/liveEvents/operatorMapping.js";
import { mapLiveEventToWorldEffect } from "../src/liveEvents/mapping.js";
import { acceptLiveEvent } from "../src/liveEvents/receive.js";

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "nspace-live-map-"));
process.env.LIVE_EVENT_STORE_FILE = path.join(TMP, "live-events.sqlite");
process.env.LIVE_EVENT_TEST_BOOST_MS = "60000";

const {
  initLiveEventStore,
  insertOperatorMapping,
  _resetLiveEventStoreForTests,
} = await import("../src/liveEvents/store.js");

const NOW = Date.parse("2026-09-13T12:00:00.000Z");
const ID = "11111111-1111-1111-1111-111111111111";

test.after(() => {
  _resetLiveEventStoreForTests();
  fs.rmSync(TMP, { recursive: true, force: true });
});

test("parseOperatorMappingInput requires a known interaction and room target", () => {
  assert.equal(
    parseOperatorMappingInput({
      eventType: "nimiqlive.twitch.subscribe",
      interactionKind: "live_boost",
      roomTarget: "current",
    }).ok,
    true
  );
  assert.equal(
    parseOperatorMappingInput({
      eventType: "not a type",
      interactionKind: "live_boost",
      roomTarget: "current",
    }).ok,
    false
  );
  assert.equal(
    parseOperatorMappingInput({
      eventType: "nimiqlive.twitch.subscribe",
      interactionKind: "explode_hub",
      roomTarget: "current",
    }).ok,
    false
  );
  assert.equal(
    parseOperatorMappingInput({
      eventType: "nimiqlive.twitch.subscribe",
      interactionKind: "gold_blocks",
      roomTarget: "other",
    }).ok,
    false
  );
  const other = parseOperatorMappingInput({
    eventType: "nimiqlive.twitch.subscribe",
    interactionKind: "gold_blocks",
    roomTarget: "other",
    roomId: HUB_ROOM_ID,
  });
  assert.equal(other.ok, true);
  if (other.ok) {
    assert.equal(other.value.roomId, HUB_ROOM_ID);
    assert.equal(other.value.interactionKind, "gold_blocks");
  }
});

test("resolveOperatorRoomId maps current, hub, and other", () => {
  assert.equal(
    resolveOperatorRoomId({ roomTarget: "current", roomId: null }, "pixel"),
    "pixel"
  );
  assert.equal(
    resolveOperatorRoomId({ roomTarget: "hub", roomId: null }, "pixel"),
    HUB_ROOM_ID
  );
  assert.equal(
    resolveOperatorRoomId(
      { roomTarget: "other", roomId: "chamber" },
      "pixel"
    ),
    "chamber"
  );
});

test("operator mapping overrides builtin Live Boost when the interaction is available", () => {
  _resetLiveEventStoreForTests();
  initLiveEventStore();
  const saved = insertOperatorMapping({
    id: "rule-subscribe",
    eventType: "nimiqlive.twitch.subscribe",
    interactionKind: "live_boost",
    roomTarget: "hub",
    roomId: null,
    enabled: true,
    createdAtMs: NOW,
    updatedAtMs: NOW,
  });
  assert.equal(saved.ok, true);
  const effect = mapLiveEventToWorldEffect(
    "nimiqlive.twitch.subscribe",
    ID,
    NOW
  );
  assert.equal(effect?.kind, "live_boost");
  assert.equal(effect?.untilMs, NOW + 60_000);
});

test("reserved interactions accept the Live Event and do not apply a World Effect", () => {
  _resetLiveEventStoreForTests();
  initLiveEventStore();
  insertOperatorMapping({
    id: "rule-test-gold",
    eventType: "nimiqlive.test",
    interactionKind: "gold_blocks",
    roomTarget: "current",
    roomId: null,
    enabled: true,
    createdAtMs: NOW,
    updatedAtMs: NOW,
  });
  const effect = mapLiveEventToWorldEffect("nimiqlive.test", ID, NOW);
  assert.equal(effect, null);
  const accepted = acceptLiveEvent(
    {
      id: ID,
      type: "nimiqlive.test",
      occurredAt: "2026-09-13T12:00:00.000Z",
      source: "nimiqlive",
      payload: {},
    },
    NOW
  );
  assert.equal(accepted.ok, true);
  if (accepted.ok) {
    assert.equal(accepted.duplicate, false);
    assert.equal(accepted.ignored, true);
    assert.equal(accepted.effect, null);
  }
});
