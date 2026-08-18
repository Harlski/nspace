/**
 * Feedback loop for live "avatars teleport back to the start of their path".
 *
 * rooms.ts `maybeBroadcastMoveOrder` stamps `startX/startZ` from `conn.player`,
 * which only advances when the tick runs. Analytic `playerPoseNow` can already
 * be metres ahead if the event loop is late — the same lag that crawls stepped
 * walks (see tickLagMoveSpeed.test.ts).
 *
 * A later moveOrder with startAtMs=now and startX=stale origin makes every
 * observer Path Playback jump back to the start.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { buildMoveOrderOutMsg } from "../src/moveOrderBroadcast.js";
import {
  DEFAULT_PATH_MOVE_SPEED,
  poseAlongPathAtTime,
  type PathMoveBounds,
  type PathWaypoint,
} from "../src/pathPosition.js";
import {
  gameplayPoseFromConn,
  moveOrderStartFromGameplay,
  snapshotPathMoveBegin,
} from "../src/playerPathPose.js";

const FLAT_Y = (): number => 0;
const OPEN_BOUNDS: PathMoveBounds = {
  minX: -1000,
  maxX: 1000,
  minZ: -1000,
  maxZ: 1000,
};

test("replacement moveOrder stamps start from analytic pose, not unticked conn.player", () => {
  const player = { x: 0, y: 0, z: 0, vx: 0, vz: 0 };
  const pathQueue: PathWaypoint[] = [{ x: 15, z: 0, layer: 0 }];
  const startAtMs = 1_000_000;
  const pathMove = snapshotPathMoveBegin({ player, pathQueue, startAtMs });
  assert.ok(pathMove);

  const nowMs = startAtMs + 1000;
  const live = gameplayPoseFromConn({
    player,
    pathQueue,
    pathMove,
    nowMs,
    bounds: OPEN_BOUNDS,
    waypointY: FLAT_Y,
  });
  assert.ok(
    live.x > 4 && live.x < 6,
    `analytic pose after 1s at ${DEFAULT_PATH_MOVE_SPEED} u/s should be ~5, got ${live.x}`
  );
  const start = moveOrderStartFromGameplay({
    player,
    pathQueue,
    pathMove,
    nowMs,
    bounds: OPEN_BOUNDS,
    waypointY: FLAT_Y,
  });
  assert.ok(
    start.startX > 4 && start.startX < 6,
    `moveOrder start must be analytic pose (~5), got ${start.startX}`
  );
  assert.equal(player.x, 0, "conn.player is unchanged until the tick copies analytic pose");

  const msg = buildMoveOrderOutMsg({
    address: "NQ97 TEST",
    pathQueue,
    startX: start.startX,
    startZ: start.startZ,
    startAtMs: nowMs,
    serverNowMs: nowMs,
    walkId: 2,
  });

  const observer = poseAlongPathAtTime({
    startPose: { x: msg.startX, y: 0, z: msg.startZ, vx: 0, vz: 0 },
    pathQueue: msg.path,
    startAtMs: msg.startAtMs,
    nowMs,
    bounds: OPEN_BOUNDS,
    waypointY: FLAT_Y,
    speed: msg.speed,
  });
  assert.ok(
    observer.pose.x > 4,
    `observer Path Playback teleported back to x=${observer.pose.x} while live pose is x=${live.x.toFixed(2)}`
  );
});
