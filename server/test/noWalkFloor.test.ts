import assert from "node:assert/strict";
import test from "node:test";

import {
  addNoWalkFloor,
  clearRoomNoWalkFloor,
  createNoWalkFloorStore,
  hasNoWalkFloor,
  listNoWalkFloorTiles,
  noWalkFloorTileKey,
  removeNoWalkFloor,
  replaceAllNoWalkFloor,
} from "../src/noWalkFloor/index.js";

test("noWalkFloorTileKey is x,z", () => {
  assert.equal(noWalkFloorTileKey(3, -2), "3,-2");
});

test("addNoWalkFloor marks a tile; has reports it; list returns sorted tiles", () => {
  const store = createNoWalkFloorStore();
  assert.equal(addNoWalkFloor(store, "hub", 2, 1), true);
  assert.equal(addNoWalkFloor(store, "hub", 2, 1), false);
  assert.equal(hasNoWalkFloor(store, "hub", 2, 1), true);
  assert.equal(hasNoWalkFloor(store, "hub", 0, 0), false);
  assert.deepEqual(listNoWalkFloorTiles(store, "hub"), [{ x: 2, z: 1 }]);
});

test("removeNoWalkFloor clears a marked tile", () => {
  const store = createNoWalkFloorStore();
  addNoWalkFloor(store, "hub", 1, 1);
  assert.equal(removeNoWalkFloor(store, "hub", 1, 1), true);
  assert.equal(removeNoWalkFloor(store, "hub", 1, 1), false);
  assert.equal(hasNoWalkFloor(store, "hub", 1, 1), false);
});

test("replaceAllNoWalkFloor accepts keys and {x,z}; isolates rooms", () => {
  const store = createNoWalkFloorStore();
  addNoWalkFloor(store, "hub", 0, 0);
  addNoWalkFloor(store, "other", 9, 9);
  const listed = replaceAllNoWalkFloor(store, "hub", ["2,3", { x: 1, z: 4 }, "bad"]);
  assert.deepEqual(listed, [
    { x: 2, z: 3 },
    { x: 1, z: 4 },
  ]);
  assert.equal(hasNoWalkFloor(store, "hub", 0, 0), false);
  assert.equal(hasNoWalkFloor(store, "other", 9, 9), true);
});

test("clearRoomNoWalkFloor removes only that room", () => {
  const store = createNoWalkFloorStore();
  addNoWalkFloor(store, "hub", 1, 0);
  addNoWalkFloor(store, "other", 2, 0);
  clearRoomNoWalkFloor(store, "hub");
  assert.deepEqual(listNoWalkFloorTiles(store, "hub"), []);
  assert.equal(hasNoWalkFloor(store, "other", 2, 0), true);
});
