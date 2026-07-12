import assert from "node:assert/strict";
import test from "node:test";

import {
  clearRoomAttentionMarkers,
  createAttentionMarkerStore,
  listAttentionMarkers,
  moveAttentionMarker,
  normalizeAttentionMarker,
  removeAttentionMarker,
  replaceAllAttentionMarkers,
  upsertAttentionMarker,
} from "../src/attentionMarker/index.js";

test("normalizeAttentionMarker accepts tile, hover height, color with defaults", () => {
  const m = normalizeAttentionMarker({ x: 3, z: -2 });
  assert.ok(m);
  assert.equal(m.x, 3);
  assert.equal(m.z, -2);
  assert.equal(m.hoverHeight, 1);
  assert.equal(m.colorRgb, 0xffffff);
});

test("normalizeAttentionMarker clamps hoverHeight to 0..3", () => {
  assert.equal(normalizeAttentionMarker({ x: 0, z: 0, hoverHeight: -1 })?.hoverHeight, 0);
  assert.equal(normalizeAttentionMarker({ x: 0, z: 0, hoverHeight: 9 })?.hoverHeight, 3);
  assert.equal(normalizeAttentionMarker({ x: 0, z: 0, hoverHeight: 2 })?.hoverHeight, 2);
});

test("normalizeAttentionMarker rejects non-finite tile coords", () => {
  assert.equal(normalizeAttentionMarker({ x: NaN, z: 0 }), null);
  assert.equal(normalizeAttentionMarker({ x: 0, z: Infinity }), null);
});

test("upsert replaces the single marker on a tile", () => {
  const store = createAttentionMarkerStore();
  upsertAttentionMarker(store, "hub", {
    x: 1,
    z: 2,
    hoverHeight: 1,
    colorRgb: 0xffffff,
  });
  upsertAttentionMarker(store, "hub", {
    x: 1,
    z: 2,
    hoverHeight: 3,
    colorRgb: 0xff0000,
  });
  const list = listAttentionMarkers(store, "hub");
  assert.equal(list.length, 1);
  assert.equal(list[0]?.hoverHeight, 3);
  assert.equal(list[0]?.colorRgb, 0xff0000);
});

test("move clears source and replaces destination", () => {
  const store = createAttentionMarkerStore();
  upsertAttentionMarker(store, "hub", {
    x: 0,
    z: 0,
    hoverHeight: 2,
    colorRgb: 0x00ff00,
  });
  upsertAttentionMarker(store, "hub", {
    x: 5,
    z: 5,
    hoverHeight: 0,
    colorRgb: 0x0000ff,
  });
  const moved = moveAttentionMarker(store, "hub", 0, 0, 5, 5);
  assert.ok(moved);
  assert.equal(moved.x, 5);
  assert.equal(moved.z, 5);
  assert.equal(moved.hoverHeight, 2);
  assert.equal(moved.colorRgb, 0x00ff00);
  assert.equal(listAttentionMarkers(store, "hub").length, 1);
  assert.equal(removeAttentionMarker(store, "hub", 0, 0), false);
});

test("replaceAllAttentionMarkers sets the room layer exactly", () => {
  const store = createAttentionMarkerStore();
  upsertAttentionMarker(store, "tutorial", {
    x: 1,
    z: 1,
    hoverHeight: 1,
    colorRgb: 0xffffff,
  });
  replaceAllAttentionMarkers(store, "tutorial", [
    { x: 2, z: 3, hoverHeight: 0, colorRgb: 0x111111 },
    { x: 4, z: 5, hoverHeight: 3, colorRgb: 0x222222 },
  ]);
  const list = listAttentionMarkers(store, "tutorial");
  assert.equal(list.length, 2);
  assert.deepEqual(
    list.map((m) => `${m.x},${m.z}`).sort(),
    ["2,3", "4,5"]
  );
});

test("rooms are isolated; clearRoom removes one room only", () => {
  const store = createAttentionMarkerStore();
  upsertAttentionMarker(store, "a", {
    x: 0,
    z: 0,
    hoverHeight: 1,
    colorRgb: 0xffffff,
  });
  upsertAttentionMarker(store, "b", {
    x: 0,
    z: 0,
    hoverHeight: 1,
    colorRgb: 0xffffff,
  });
  clearRoomAttentionMarkers(store, "a");
  assert.equal(listAttentionMarkers(store, "a").length, 0);
  assert.equal(listAttentionMarkers(store, "b").length, 1);
});
