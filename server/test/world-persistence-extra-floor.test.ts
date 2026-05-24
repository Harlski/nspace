import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

function normalizeRoomId(id: string): string {
  return id.trim().toLowerCase();
}

async function loadPersistenceModule(dataDir: string) {
  process.env.WORLD_STATE_DIR = dataDir;
  const modPath = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    "../src/worldPersistence.ts"
  );
  const importUrl = `${pathToFileURL(modPath).href}?test=${Date.now()}-${Math.random()}`;
  return import(importUrl) as Promise<{
    loadWorldState: (
      roomPlaced: Map<string, Map<string, unknown>>,
      roomExtraFloor: Map<string, Map<string, number>>,
      roomBaseFloorColors: Map<string, Map<string, number>>,
      roomBaseFloorRemoved: Map<string, Set<string>>,
      lastSpawnByRoom: Map<string, Map<string, { x: number; z: number; y?: number }>>,
      normalize: (roomId: string) => string
    ) => void;
  }>;
}

test("loadWorldState merges legacy extra floor when split room file is empty", async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nspace-extra-floor-"));
  const dataDir = path.join(tempRoot, "data");
  const roomsDir = path.join(dataDir, "rooms");
  fs.mkdirSync(roomsDir, { recursive: true });

  fs.writeFileSync(
    path.join(dataDir, "world-state.json"),
    JSON.stringify({
      version: 1,
      rooms: {
        hub: {
          obstacles: [],
          extraFloor: ["10,10", "10,11", "11,11"],
          spawns: {},
        },
      },
    })
  );
  fs.writeFileSync(
    path.join(roomsDir, "hub.json"),
    JSON.stringify({
      version: 1,
      roomId: "hub",
      obstacles: [],
      extraFloor: [],
    })
  );

  const { loadWorldState } = await loadPersistenceModule(dataDir);
  const roomExtraFloor = new Map<string, Map<string, number>>();
  const roomBaseFloorColors = new Map<string, Map<string, number>>();
  loadWorldState(
    new Map(),
    roomExtraFloor,
    roomBaseFloorColors,
    new Map(),
    new Map(),
    normalizeRoomId
  );

  const hub = roomExtraFloor.get("hub");
  assert.ok(hub);
  assert.equal(hub.size, 3);
  assert.ok(hub.has("10,10"));
  assert.ok(hub.has("10,11"));
  assert.ok(hub.has("11,11"));
});

test("loadWorldState accepts legacy tile-key strings and { tile } objects", async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nspace-extra-floor-"));
  const dataDir = path.join(tempRoot, "data");
  fs.mkdirSync(dataDir, { recursive: true });

  fs.writeFileSync(
    path.join(dataDir, "world-state.json"),
    JSON.stringify({
      version: 1,
      rooms: {
        hub: {
          obstacles: [],
          extraFloor: [" 10,10 ", { tile: "10,11" }, { x: 11, z: 11 }],
          spawns: {},
        },
      },
    })
  );

  const { loadWorldState } = await loadPersistenceModule(dataDir);
  const roomExtraFloor = new Map<string, Map<string, number>>();
  const roomBaseFloorColors = new Map<string, Map<string, number>>();
  loadWorldState(
    new Map(),
    roomExtraFloor,
    roomBaseFloorColors,
    new Map(),
    new Map(),
    normalizeRoomId
  );

  const hub = roomExtraFloor.get("hub");
  assert.ok(hub);
  assert.equal(hub.size, 3);
});
