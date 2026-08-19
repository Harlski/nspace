/**
 * Feedback loop for: entering your Private Room from Hub keeps Hub coordinates
 * instead of landing at Join Spawn / the teleporter space.
 *
 * Home → Private Room is createInvite + joinRoom on the existing WebSocket.
 */
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import type { WebSocket } from "ws";

import { PLAY_SPACE_BOUNDS } from "../src/directInvite/playSpaceLayout.js";
import {
  _resetInviteStoreForTests,
  createInvite,
} from "../src/directInvite/store.js";
import { buildShellFromLegacyPlaySpaceLayout } from "../src/playSpaceTemplate/buildShell.js";
import { wireTemplateForTests } from "../src/playSpaceTemplate/store.js";
import {
  CHAMBER_DEFAULT_SPAWN,
  CHAMBER_ROOM_ID,
  PIXEL_DEFAULT_SPAWN,
  PIXEL_ROOM_ID,
} from "../src/roomLayouts.js";
import { addClient, getWalletCurrentRoomId } from "../src/rooms.js";

const HOST = "NQ07 TESTPRIVATEROOMJOINSPAWN00000001";
/** Distinct from Hub default spawn (-5, 0) and from Play Space center (0, 0). */
const STANDING = { x: 3, z: 2 } as const;
const TELEPORTER_JOIN_SPAWN = { x: 4, z: -3 } as const;
const TEMPLATE_ID = "test-private-room-join-spawn";

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

function lastWelcome(sock: FakeSocket): WireMsg | undefined {
  for (let i = sock.sent.length - 1; i >= 0; i--) {
    if (sock.sent[i]?.type === "welcome") return sock.sent[i];
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

async function sendJoin(sock: FakeSocket, roomId: string): Promise<void> {
  sock.emit("message", JSON.stringify({ type: "joinRoom", roomId }));
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
}

test("joinRoom to Private Room from Hub does not keep Hub standing coordinates", async () => {
  _resetInviteStoreForTests();
  const shell = buildShellFromLegacyPlaySpaceLayout();
  shell.joinSpawn = { ...TELEPORTER_JOIN_SPAWN };
  wireTemplateForTests({
    id: TEMPLATE_ID,
    displayName: "Spawn loop lounge",
    description: "",
    archived: false,
    isDefault: false,
    sourceRoomId: null,
    buildShell: shell,
    createdAtMs: 1,
    updatedAtMs: 1,
    lastSyncedAtMs: null,
  });

  const invite = createInvite({
    hostWallet: HOST,
    hostOriginRoomId: CHAMBER_ROOM_ID,
    activity: "worldcup-match",
    templateId: TEMPLATE_ID,
  });

  const sock = new FakeSocket();
  addClient(CHAMBER_ROOM_ID, asWs(sock), HOST, {
    x: STANDING.x,
    z: STANDING.z,
  });
  const hubWelcome = selfPose(lastWelcome(sock));
  assert.equal(hubWelcome.roomId, CHAMBER_ROOM_ID);
  assert.equal(hubWelcome.x, STANDING.x);
  assert.equal(hubWelcome.z, STANDING.z);

  await sendJoin(sock, invite.lobbyRoomId);
  const failed = [...sock.sent].reverse().find((m) => m.type === "joinRoomFailed");
  assert.equal(failed, undefined, `joinRoomFailed: ${JSON.stringify(failed)}`);

  const landed = selfPose(lastWelcome(sock));
  assert.equal(landed.roomId, invite.lobbyRoomId);
  assert.equal(getWalletCurrentRoomId(HOST), invite.lobbyRoomId);

  assert.notEqual(
    landed.x,
    STANDING.x,
    `Private Room spawn reused Hub X ${STANDING.x} (expected Join Spawn ${TELEPORTER_JOIN_SPAWN.x})`
  );
  assert.notEqual(
    landed.z,
    STANDING.z,
    `Private Room spawn reused Hub Z ${STANDING.z} (expected Join Spawn ${TELEPORTER_JOIN_SPAWN.z})`
  );
  assert.deepEqual(
    { x: landed.x, z: landed.z },
    { x: TELEPORTER_JOIN_SPAWN.x, z: TELEPORTER_JOIN_SPAWN.z }
  );

  sock.close();
  _resetInviteStoreForTests();
});

test("joinRoom to Private Room from Hub default spawn (-5, 0) lands on Join Spawn", async () => {
  _resetInviteStoreForTests();
  const shell = buildShellFromLegacyPlaySpaceLayout();
  shell.joinSpawn = { ...TELEPORTER_JOIN_SPAWN };
  wireTemplateForTests({
    id: TEMPLATE_ID,
    displayName: "Spawn loop lounge",
    description: "",
    archived: false,
    isDefault: false,
    sourceRoomId: null,
    buildShell: shell,
    createdAtMs: 1,
    updatedAtMs: 1,
    lastSyncedAtMs: null,
  });

  const invite = createInvite({
    hostWallet: HOST,
    hostOriginRoomId: CHAMBER_ROOM_ID,
    activity: "worldcup-match",
    templateId: TEMPLATE_ID,
  });

  const sock = new FakeSocket();
  addClient(CHAMBER_ROOM_ID, asWs(sock), HOST, {
    x: CHAMBER_DEFAULT_SPAWN.x,
    z: CHAMBER_DEFAULT_SPAWN.z,
  });
  await sendJoin(sock, invite.lobbyRoomId);
  const landed = selfPose(lastWelcome(sock));
  assert.equal(landed.roomId, invite.lobbyRoomId);
  assert.notDeepEqual(
    { x: landed.x, z: landed.z },
    { x: CHAMBER_DEFAULT_SPAWN.x, z: CHAMBER_DEFAULT_SPAWN.z },
    "Private Room spawn copied Hub default spawn (-5, 0)"
  );
  assert.deepEqual(
    { x: landed.x, z: landed.z },
    { x: TELEPORTER_JOIN_SPAWN.x, z: TELEPORTER_JOIN_SPAWN.z }
  );

  sock.close();
  _resetInviteStoreForTests();
});

test("joinRoom to Pixel from Hub standing tile does not keep Hub coordinates", async () => {
  const sock = new FakeSocket();
  addClient(CHAMBER_ROOM_ID, asWs(sock), HOST, {
    x: CHAMBER_DEFAULT_SPAWN.x,
    z: CHAMBER_DEFAULT_SPAWN.z,
  });
  await sendJoin(sock, PIXEL_ROOM_ID);
  const landed = selfPose(lastWelcome(sock));
  assert.equal(landed.roomId, PIXEL_ROOM_ID);
  assert.notDeepEqual(
    { x: landed.x, z: landed.z },
    { x: CHAMBER_DEFAULT_SPAWN.x, z: CHAMBER_DEFAULT_SPAWN.z }
  );
  assert.deepEqual(
    { x: landed.x, z: landed.z },
    { x: PIXEL_DEFAULT_SPAWN.x, z: PIXEL_DEFAULT_SPAWN.z }
  );
  sock.close();
});

test("Play Space Join Spawn tile is inside lounge bounds", () => {
  assert.ok(
    TELEPORTER_JOIN_SPAWN.x >= PLAY_SPACE_BOUNDS.minX &&
      TELEPORTER_JOIN_SPAWN.x <= PLAY_SPACE_BOUNDS.maxX &&
      TELEPORTER_JOIN_SPAWN.z >= PLAY_SPACE_BOUNDS.minZ &&
      TELEPORTER_JOIN_SPAWN.z <= PLAY_SPACE_BOUNDS.maxZ
  );
});
