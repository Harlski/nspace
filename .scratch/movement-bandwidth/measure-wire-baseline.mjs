#!/usr/bin/env node
/**
 * Throwaway: UTF-8 JSON sizes of movement-related WS payloads as rooms.ts emits them.
 * Run: node .scratch/movement-bandwidth/measure-wire-baseline.mjs
 *
 * Mirrors:
 * - PlayerState / playerToOutState (server/src/rooms.ts)
 * - buildMoveOrderOutMsg / buildMoveAbortOutMsg
 * - JSON.stringify per recipient, Buffer.byteLength(..., "utf8")
 */
const utf8 = (v) => Buffer.byteLength(JSON.stringify(v), "utf8");

/** Nimiq user-friendly address: 9×4 chars + 8 spaces = 44 (JWT `sub` / conn.player.address). */
function userFriendlyAddress(i) {
  const compact =
    `NQ${String(10 + (i % 89)).padStart(2, "0")}${String(100000 + i).slice(-4)}T4TGDVC7FLHLQY2DY425N5CVHM02Y`.slice(
      0,
      36
    );
  if (compact.length !== 36) throw new Error(`compact ${compact.length}`);
  return compact.match(/.{4}/g).join(" ");
}

function walletDisplayName(addr) {
  const a = addr.trim();
  return `${a.slice(0, 4)}${a.slice(-4)}`;
}

/** Cardinal grid step (typical pathfind). Same lerp as pathPosition.stepHumanAlongPath. */
function cardinalWalkPose(startX, startZ, goalX, goalZ, elapsedMs, speed = 5) {
  const pose = { x: startX, y: 0, z: startZ, vx: 0, vz: 0 };
  const path = [{ x: goalX, z: goalZ, layer: 0 }];
  const dt = 0.05;
  let t = 0;
  while (t < elapsedMs / 1000 && path.length) {
    const goal = path[0];
    const dx = goal.x - pose.x;
    const dz = goal.z - pose.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.04) {
      pose.x = goal.x;
      pose.z = goal.z;
      pose.vx = 0;
      pose.vz = 0;
      path.shift();
      t += dt;
      continue;
    }
    const step = speed * dt;
    const u = Math.min(1, step / dist);
    pose.x += dx * u;
    pose.z += dz * u;
    pose.vx = (dx / dist) * speed;
    pose.vz = (dz / dist) * speed;
    t += dt;
  }
  return pose;
}

function diagonalWalkPose() {
  const pose = { x: 0, y: 0, z: 0, vx: 0, vz: 0 };
  const dx = 1;
  const dz = 1;
  const dist = Math.hypot(dx, dz);
  const speed = 5;
  const dt = 0.05;
  const step = speed * dt;
  const u = Math.min(1, step / dist);
  pose.x += dx * u;
  pose.z += dz * u;
  pose.vx = (dx / dist) * speed;
  pose.vz = (dz / dist) * speed;
  return pose;
}

/**
 * Hypothetical 7-field object (not what playerToOutState emits).
 */
function leanPlayer(i, pose) {
  const address = userFriendlyAddress(i);
  return {
    address,
    displayName: walletDisplayName(address),
    x: pose.x,
    y: pose.y,
    z: pose.z,
    vx: pose.vx,
    vz: pose.vz,
  };
}

/**
 * Actual idle wallet snapshot from playerToOutState:
 * conn.player spread (recentAliases always) + 4 cosmetic keys (null if unequipped)
 * + playerLevel for NQ wallets. Ephemeral flags only when true.
 */
function actualIdleOutState(i, pose) {
  return {
    ...leanPlayer(i, pose),
    recentAliases: [],
    cosmeticAura: null,
    cosmeticNameplate: null,
    cosmeticChatBubble: null,
    cosmeticTrail: null,
    playerLevel: 3,
  };
}

/**
 * Loaded: cosmetics (real production preset ids), 3 aliases (USERNAME_MAX_LEN=12),
 * nimiqPay, worldcupCountry, playerLevel. No false ephemeral flags (those are omitted).
 */
function loadedOutState(i, pose) {
  const address = userFriendlyAddress(i);
  return {
    address,
    displayName: "StarWalker12",
    x: pose.x,
    y: pose.y,
    z: pose.z,
    vx: pose.vx,
    vz: pose.vz,
    recentAliases: ["OldAlias01", "PrevName", "WalletTag"],
    nimiqPay: true,
    worldcupCountry: "DE",
    cosmeticAura: "aura-ref-magic-ring",
    cosmeticNameplate: "nameplate-frame-neon",
    cosmeticChatBubble: "bubble-rounded-pastel",
    cosmeticTrail: "trail-ref-spark-path",
    playerLevel: 12,
  };
}

function loadedTyping(i, pose) {
  return { ...loadedOutState(i, pose), chatTyping: true };
}

function stateMsg(players) {
  return { type: "state", players };
}

function deltaMsg(players) {
  return { type: "stateDelta", players };
}

function moveOrderMsg(i, waypointCount, startPose) {
  const address = userFriendlyAddress(i);
  const path = Array.from({ length: waypointCount }, (_, k) => ({
    x: 10 + k,
    z: 4,
    layer: 0,
  }));
  return {
    type: "moveOrder",
    address,
    path,
    startX: startPose.x,
    startZ: startPose.z,
    startAtMs: 1720000000123,
    speed: 5,
  };
}

function moveAbortMsg(i, pose) {
  return {
    type: "moveAbort",
    address: userFriendlyAddress(i),
    x: pose.x,
    z: pose.z,
    y: pose.y,
    vx: pose.vx,
    vz: pose.vz,
  };
}

const idlePose = { x: 12, y: 0, z: -8, vx: 0, vz: 0 };
const walkCardinal = cardinalWalkPose(12, -8, 13, -8, 150);
const walkDiagonal = diagonalWalkPose();

const TICK_HZ = 1000 / 120;

const samples = {
  addressLen: userFriendlyAddress(1).length,
  address: userFriendlyAddress(1),
  displayName: walletDisplayName(userFriendlyAddress(1)),
  idlePose,
  walkCardinal,
  walkDiagonal,
  json: {
    leanIdle: JSON.stringify(leanPlayer(1, idlePose)),
    actualIdle: JSON.stringify(actualIdleOutState(1, idlePose)),
    loadedIdle: JSON.stringify(loadedOutState(1, idlePose)),
    actualWalkCardinal: JSON.stringify(actualIdleOutState(1, walkCardinal)),
    actualWalkDiagonal: JSON.stringify(actualIdleOutState(1, walkDiagonal)),
    moveOrder8idleStart: JSON.stringify(moveOrderMsg(1, 8, idlePose)),
    moveAbortIdle: JSON.stringify(moveAbortMsg(1, idlePose)),
    deltaActualWalk: JSON.stringify(deltaMsg([actualIdleOutState(1, walkCardinal)])),
  },
};

const unit = {
  leanIdle: utf8(leanPlayer(1, idlePose)),
  leanWalkCardinal: utf8(leanPlayer(1, walkCardinal)),
  leanWalkDiagonal: utf8(leanPlayer(1, walkDiagonal)),
  actualIdle: utf8(actualIdleOutState(1, idlePose)),
  actualWalkCardinal: utf8(actualIdleOutState(1, walkCardinal)),
  actualWalkDiagonal: utf8(actualIdleOutState(1, walkDiagonal)),
  loadedIdle: utf8(loadedOutState(1, idlePose)),
  loadedWalkCardinal: utf8(loadedOutState(1, walkCardinal)),
  loadedTyping: utf8(loadedTyping(1, idlePose)),
  deltaLeanIdle: utf8(deltaMsg([leanPlayer(1, idlePose)])),
  deltaActualIdle: utf8(deltaMsg([actualIdleOutState(1, idlePose)])),
  deltaActualWalkCardinal: utf8(deltaMsg([actualIdleOutState(1, walkCardinal)])),
  deltaActualWalkDiagonal: utf8(deltaMsg([actualIdleOutState(1, walkDiagonal)])),
  deltaLoadedWalk: utf8(deltaMsg([loadedOutState(1, walkCardinal)])),
  deltaLoadedTyping: utf8(deltaMsg([loadedTyping(1, idlePose)])),
  moveOrder2idle: utf8(moveOrderMsg(1, 2, idlePose)),
  moveOrder8idle: utf8(moveOrderMsg(1, 8, idlePose)),
  moveOrder20idle: utf8(moveOrderMsg(1, 20, idlePose)),
  moveOrder8walkStart: utf8(moveOrderMsg(1, 8, walkCardinal)),
  moveAbortIdle: utf8(moveAbortMsg(1, idlePose)),
  moveAbortWalk: utf8(moveAbortMsg(1, walkCardinal)),
  moveAbortDiagonal: utf8(moveAbortMsg(1, walkDiagonal)),
};

function roomRow(n) {
  const poseFor = (i) => ({
    x: 10 + (i % 7),
    y: 0,
    z: -3 - (i % 5),
    vx: 0,
    vz: 0,
  });
  const leanPlayersIdle = Array.from({ length: n }, (_, i) =>
    leanPlayer(i, poseFor(i))
  );
  const actualPlayersIdle = Array.from({ length: n }, (_, i) =>
    actualIdleOutState(i, poseFor(i))
  );
  const loadedPlayersIdle = Array.from({ length: n }, (_, i) =>
    loadedOutState(i, poseFor(i))
  );
  const actualPlayersWalk = Array.from({ length: n }, (_, i) =>
    actualIdleOutState(i, walkCardinal)
  );
  const loadedPlayersWalk = Array.from({ length: n }, (_, i) =>
    loadedOutState(i, walkCardinal)
  );

  const fullLeanIdle = utf8(stateMsg(leanPlayersIdle));
  const fullActualIdle = utf8(stateMsg(actualPlayersIdle));
  const fullLoadedIdle = utf8(stateMsg(loadedPlayersIdle));
  const fullActualWalk = utf8(stateMsg(actualPlayersWalk));
  const fullLoadedWalk = utf8(stateMsg(loadedPlayersWalk));
  const delta1ActualWalk = unit.deltaActualWalkCardinal;
  const deltaNActualWalk = utf8(deltaMsg(actualPlayersWalk));
  const order8 = unit.moveOrder8idle;
  const abort = unit.moveAbortIdle;

  const egress = (bytes) => bytes * n;
  const hz = TICK_HZ;

  return {
    n,
    bytes: {
      fullStateLeanIdle: fullLeanIdle,
      fullStateActualIdle: fullActualIdle,
      fullStateLoadedIdle: fullLoadedIdle,
      fullStateActualWalk: fullActualWalk,
      fullStateLoadedWalk: fullLoadedWalk,
      stateDelta1ActualWalk: delta1ActualWalk,
      stateDeltaNActualWalk: deltaNActualWalk,
      moveOrder8: order8,
      moveAbort: abort,
    },
    perEvent: {
      fullStateLeanIdle: {
        payload: fullLeanIdle,
        serverEgress: egress(fullLeanIdle),
        clientIngress: fullLeanIdle,
      },
      fullStateActualIdle: {
        payload: fullActualIdle,
        serverEgress: egress(fullActualIdle),
        clientIngress: fullActualIdle,
      },
      fullStateLoadedIdle: {
        payload: fullLoadedIdle,
        serverEgress: egress(fullLoadedIdle),
        clientIngress: fullLoadedIdle,
      },
      stateDelta1ActualWalk: {
        payload: delta1ActualWalk,
        serverEgress: egress(delta1ActualWalk),
        clientIngress: delta1ActualWalk,
      },
      moveOrder8: {
        payload: order8,
        serverEgress: egress(order8),
        clientIngress: order8,
      },
      moveAbort: {
        payload: abort,
        serverEgress: egress(abort),
        clientIngress: abort,
      },
    },
    perSecond: {
      A_idle: { serverEgress: 0, clientIngress: 0, note: "no tick send once baseline matches" },
      B_cutStream_ordersOnly: (walksPerPlayerPerSec) => {
        const ordersPerSec = walksPerPlayerPerSec * n;
        const server = egress(order8) * ordersPerSec;
        return {
          walksPerPlayerPerSec,
          ordersPerSec,
          serverEgress: server,
          clientIngress: server / n,
        };
      },
      C_legacy_allWalking_sendFull: {
        hz,
        payload: fullActualWalk,
        serverEgress: egress(fullActualWalk) * hz,
        clientIngress: fullActualWalk * hz,
      },
      C_legacy_allWalking_sendFullLoaded: {
        hz,
        payload: fullLoadedWalk,
        serverEgress: egress(fullLoadedWalk) * hz,
        clientIngress: fullLoadedWalk * hz,
      },
      C_legacy_oneWalker_delta: {
        hz,
        payload: delta1ActualWalk,
        serverEgress: egress(delta1ActualWalk) * hz,
        clientIngress: delta1ActualWalk * hz,
      },
      D_oneFullStateEvent: {
        payload: fullActualIdle,
        serverEgress: egress(fullActualIdle),
        clientIngress: fullActualIdle,
        note: "multiply by events/sec (chatTyping on/off each fires one)",
      },
    },
  };
}

const rooms = [10, 20, 30].map(roomRow);

function kibps(bytesPerSec) {
  return `${(bytesPerSec / 1024).toFixed(2)} KiB/s`;
}

console.log(JSON.stringify({ samples, unit, tickHz: TICK_HZ, rooms }, null, 2));
console.log("\n--- human ---");
console.log("address", samples.address, "len", samples.addressLen);
console.log("unit", unit);
for (const r of rooms) {
  console.log(`\nN=${r.n}`);
  console.log("  full actual idle", r.bytes.fullStateActualIdle, "egress", r.perEvent.fullStateActualIdle.serverEgress);
  console.log("  full loaded idle", r.bytes.fullStateLoadedIdle);
  console.log("  delta 1 actual walk", r.bytes.stateDelta1ActualWalk);
  console.log("  moveOrder 8", r.bytes.moveOrder8);
  console.log("  A idle /s", 0);
  const bCont8 = r.perSecond.B_cutStream_ordersOnly(5 / 8);
  console.log("  B continuous 8wp walks/s", bCont8, kibps(bCont8.serverEgress));
  console.log("  C all walk sendFull /s", r.perSecond.C_legacy_allWalking_sendFull, kibps(r.perSecond.C_legacy_allWalking_sendFull.serverEgress));
  console.log("  C 1 walker delta /s", r.perSecond.C_legacy_oneWalker_delta, kibps(r.perSecond.C_legacy_oneWalker_delta.serverEgress));
  console.log("  D one full-state event egress", r.perSecond.D_oneFullStateEvent.serverEgress);
}
