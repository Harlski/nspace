/**
 * Feedback loop for Rooms browser → Join on your own private wallet room:
 * landing is not Join Spawn (feels random), some floor tiles cannot be
 * removed, and some tiles cannot be walked.
 *
 * Rooms browser Join is `joinRoom` on the existing WebSocket (not a new connect).
 */
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type { WebSocket } from "ws";

import { CHAMBER_DEFAULT_SPAWN, CHAMBER_ROOM_ID } from "../src/roomLayouts.js";
import { addClient, getWalletCurrentRoomId } from "../src/rooms.js";

const HOST = "NQ07 TESTOWNEDROOMMENUJOIN0000000001";
const HOST_EDGE = "NQ07 TESTOWNEDROOMEDGEJOIN00000001";
/** Distinct from Hub default spawn (-5, 0) and from a 9×9 room center (0, 0). */
const JOIN_SPAWN = { x: 3, z: 3 } as const;
const ADJACENT = { x: 2, z: 3 } as const;
/** 30×30 room is -15..14; these sit outside Hub bounds (-12..12). */
const EDGE_SPAWN = { x: 14, z: 14 } as const;
const EDGE_ADJACENT = { x: 13, z: 14 } as const;

const ROOMS_JSON = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "data",
  "rooms.json"
);

type WireMsg = { type: string; [k: string]: unknown };

class FakeSocket extends EventEmitter {
  readyState = 1;
  sent: WireMsg[] = [];
  send(data: string): void {
    this.sent.push(JSON.parse(data) as WireMsg);
  }
  close(): void {
    this.emit("close");
  }
}

function asWs(sock: FakeSocket): WebSocket {
  return sock as unknown as WebSocket;
}

async function pump(): Promise<void> {
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
}

async function send(sock: FakeSocket, msg: Record<string, unknown>): Promise<void> {
  sock.emit("message", JSON.stringify(msg));
  await pump();
}

function lastOfType(sock: FakeSocket, type: string): WireMsg | undefined {
  for (let i = sock.sent.length - 1; i >= 0; i--) {
    if (sock.sent[i]?.type === type) return sock.sent[i];
  }
  return undefined;
}

function selfPose(welcome: WireMsg | undefined): { x: number; z: number; roomId: string } {
  assert.ok(welcome, "expected a welcome message");
  const self = welcome.self as { x?: number; z?: number } | undefined;
  assert.ok(self && Number.isFinite(self.x) && Number.isFinite(self.z));
  return {
    x: self.x as number,
    z: self.z as number,
    roomId: String(welcome.roomId ?? ""),
  };
}

function snapshotRoomsJson(): Buffer | null {
  try {
    return fs.readFileSync(ROOMS_JSON);
  } catch {
    return null;
  }
}

function restoreRoomsJson(snapshot: Buffer | null): void {
  try {
    if (snapshot) fs.writeFileSync(ROOMS_JSON, snapshot);
  } catch {
    /* test process may not have a rooms file */
  }
}

async function createPrivateOwnedRoom(
  sock: FakeSocket,
  size: { widthTiles: number; heightTiles: number } = { widthTiles: 9, heightTiles: 9 }
): Promise<string> {
  const before = sock.sent.length;
  await send(sock, {
    type: "createRoom",
    widthTiles: size.widthTiles,
    heightTiles: size.heightTiles,
    displayName: "Rooms menu spawn loop",
    isPublic: false,
  });
  const failed = sock.sent
    .slice(before)
    .find((m) => m.type === "chat" && String(m.text ?? "").includes("at most"));
  assert.equal(failed, undefined, `createRoom failed: ${JSON.stringify(failed)}`);
  const welcome = lastOfType(sock, "welcome");
  const landed = selfPose(welcome);
  assert.notEqual(landed.roomId, CHAMBER_ROOM_ID, "createRoom should teleport into the new room");
  return landed.roomId;
}

async function cleanupRoom(sock: FakeSocket, roomId: string): Promise<void> {
  await send(sock, { type: "deleteRoom", roomId });
}

const roomsJsonSnapshot = snapshotRoomsJson();
test.after(() => restoreRoomsJson(roomsJsonSnapshot));

test("Rooms browser joinRoom to own private room lands on Join Spawn", async () => {
  const sock = new FakeSocket();
  addClient(CHAMBER_ROOM_ID, asWs(sock), HOST, {
    x: CHAMBER_DEFAULT_SPAWN.x,
    z: CHAMBER_DEFAULT_SPAWN.z,
  });
  const roomId = await createPrivateOwnedRoom(sock);

  await send(sock, {
    type: "updateRoom",
    roomId,
    joinSpawn: { ...JOIN_SPAWN },
  });
  const spawnDenied = [...sock.sent]
    .reverse()
    .find(
      (m) =>
        m.type === "chat" &&
        String(m.text ?? "").toLowerCase().includes("entry spawn")
    );
  assert.equal(
    spawnDenied,
    undefined,
    `joinSpawn rejected: ${JSON.stringify(spawnDenied)}`
  );

  await send(sock, { type: "joinRoom", roomId: CHAMBER_ROOM_ID });
  assert.equal(getWalletCurrentRoomId(HOST), CHAMBER_ROOM_ID);

  sock.sent.length = 0;
  await send(sock, { type: "joinRoom", roomId });
  const failed = lastOfType(sock, "joinRoomFailed");
  assert.equal(failed, undefined, `joinRoomFailed: ${JSON.stringify(failed)}`);

  const landed = selfPose(lastOfType(sock, "welcome"));
  assert.equal(landed.roomId, roomId);
  assert.equal(getWalletCurrentRoomId(HOST), roomId);
  assert.notDeepEqual(
    { x: landed.x, z: landed.z },
    { x: CHAMBER_DEFAULT_SPAWN.x, z: CHAMBER_DEFAULT_SPAWN.z },
    "Rooms browser join reused Hub coordinates"
  );
  assert.notDeepEqual(
    { x: landed.x, z: landed.z },
    { x: 0, z: 0 },
    "Rooms browser join landed at room center instead of Join Spawn"
  );
  assert.deepEqual(
    { x: landed.x, z: landed.z },
    { x: JOIN_SPAWN.x, z: JOIN_SPAWN.z },
    `expected Join Spawn ${JOIN_SPAWN.x},${JOIN_SPAWN.z}; got ${landed.x},${landed.z}`
  );

  await cleanupRoom(sock, roomId);
  sock.close();
});

test("owner can remove a nearby empty floor tile in their private room", async () => {
  const sock = new FakeSocket();
  addClient(CHAMBER_ROOM_ID, asWs(sock), HOST, {
    x: CHAMBER_DEFAULT_SPAWN.x,
    z: CHAMBER_DEFAULT_SPAWN.z,
  });
  const roomId = await createPrivateOwnedRoom(sock);
  await send(sock, {
    type: "updateRoom",
    roomId,
    joinSpawn: { ...JOIN_SPAWN },
  });
  await send(sock, { type: "joinRoom", roomId: CHAMBER_ROOM_ID });
  await send(sock, { type: "joinRoom", roomId });
  const landed = selfPose(lastOfType(sock, "welcome"));
  assert.deepEqual({ x: landed.x, z: landed.z }, { x: JOIN_SPAWN.x, z: JOIN_SPAWN.z });

  sock.sent.length = 0;
  await send(sock, { type: "removeExtraFloor", x: ADJACENT.x, z: ADJACENT.z });
  const delta = lastOfType(sock, "removedBaseFloorDelta") as
    | { add?: string[]; roomId?: string }
    | undefined;
  assert.ok(delta, "expected removedBaseFloorDelta after removing an empty base tile");
  assert.equal(delta.roomId, roomId);
  assert.ok(
    (delta.add ?? []).includes(`${ADJACENT.x},${ADJACENT.z}`),
    `removedBaseFloorDelta.add missing ${ADJACENT.x},${ADJACENT.z}: ${JSON.stringify(delta)}`
  );

  await cleanupRoom(sock, roomId);
  sock.close();
});

test("owner can walk onto a nearby empty floor tile in their private room", async () => {
  const sock = new FakeSocket();
  addClient(CHAMBER_ROOM_ID, asWs(sock), HOST, {
    x: CHAMBER_DEFAULT_SPAWN.x,
    z: CHAMBER_DEFAULT_SPAWN.z,
  });
  const roomId = await createPrivateOwnedRoom(sock);
  await send(sock, {
    type: "updateRoom",
    roomId,
    joinSpawn: { ...JOIN_SPAWN },
  });
  await send(sock, { type: "joinRoom", roomId: CHAMBER_ROOM_ID });
  await send(sock, { type: "joinRoom", roomId });

  sock.sent.length = 0;
  await send(sock, { type: "moveTo", x: ADJACENT.x, z: ADJACENT.z });
  const rejected = lastOfType(sock, "moveAbort");
  const order = lastOfType(sock, "moveOrder") as
    | { path?: Array<{ x?: number; z?: number }>; address?: string }
    | undefined;
  assert.equal(rejected, undefined, `moveAbort: ${JSON.stringify(rejected)}`);
  assert.ok(order, "expected moveOrder for a walk onto an empty adjacent tile");
  const dest = order.path?.at(-1);
  assert.ok(dest, "moveOrder path empty");
  assert.equal(dest.x, ADJACENT.x);
  assert.equal(dest.z, ADJACENT.z);

  await cleanupRoom(sock, roomId);
  sock.close();
});

test("Rooms browser join to 30x30 private room lands on edge Join Spawn", async () => {
  const sock = new FakeSocket();
  addClient(CHAMBER_ROOM_ID, asWs(sock), HOST_EDGE, {
    x: CHAMBER_DEFAULT_SPAWN.x,
    z: CHAMBER_DEFAULT_SPAWN.z,
  });
  const roomId = await createPrivateOwnedRoom(sock, {
    widthTiles: 30,
    heightTiles: 30,
  });
  await send(sock, {
    type: "updateRoom",
    roomId,
    joinSpawn: { ...EDGE_SPAWN },
  });
  const spawnDenied = [...sock.sent]
    .reverse()
    .find(
      (m) =>
        m.type === "chat" &&
        String(m.text ?? "").toLowerCase().includes("entry spawn")
    );
  assert.equal(
    spawnDenied,
    undefined,
    `edge joinSpawn rejected: ${JSON.stringify(spawnDenied)}`
  );

  await send(sock, { type: "joinRoom", roomId: CHAMBER_ROOM_ID });
  sock.sent.length = 0;
  await send(sock, { type: "joinRoom", roomId });
  const landed = selfPose(lastOfType(sock, "welcome"));
  assert.equal(landed.roomId, roomId);
  assert.deepEqual(
    { x: landed.x, z: landed.z },
    { x: EDGE_SPAWN.x, z: EDGE_SPAWN.z },
    `30x30 edge Join Spawn expected ${EDGE_SPAWN.x},${EDGE_SPAWN.z}; got ${landed.x},${landed.z}`
  );

  sock.sent.length = 0;
  await send(sock, {
    type: "removeExtraFloor",
    x: EDGE_ADJACENT.x,
    z: EDGE_ADJACENT.z,
  });
  const delta = lastOfType(sock, "removedBaseFloorDelta") as
    | { add?: string[] }
    | undefined;
  assert.ok(
    delta && (delta.add ?? []).includes(`${EDGE_ADJACENT.x},${EDGE_ADJACENT.z}`),
    `could not remove 30x30 edge floor ${EDGE_ADJACENT.x},${EDGE_ADJACENT.z}: ${JSON.stringify(delta)}`
  );

  await send(sock, { type: "joinRoom", roomId: CHAMBER_ROOM_ID });
  await send(sock, { type: "joinRoom", roomId });
  sock.sent.length = 0;
  await send(sock, { type: "moveTo", x: EDGE_SPAWN.x, z: EDGE_SPAWN.z - 1 });
  const order = lastOfType(sock, "moveOrder") as
    | { path?: Array<{ x?: number; z?: number }> }
    | undefined;
  assert.ok(order, "expected moveOrder along the 30x30 edge");
  const dest = order.path?.at(-1);
  assert.equal(dest?.x, EDGE_SPAWN.x);
  assert.equal(dest?.z, EDGE_SPAWN.z - 1);

  await cleanupRoom(sock, roomId);
  sock.close();
});
