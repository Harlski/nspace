#!/usr/bin/env node
/**
 * Throwaway: UTF-8 sizes for compact moveOrder path encodings.
 * Does not change production code.
 *
 * Run: node .scratch/movement-bandwidth/compact-path.mjs
 */
const utf8 = (v) => Buffer.byteLength(JSON.stringify(v), "utf8");

const DEFAULT_PATH_MOVE_SPEED = 5;
const ADDR_GROUPED = "NQ97 4M1T 4TGD VC7F LHLQ Y2DY 425N 5CVH M02Y";
const ADDR_COMPACT = ADDR_GROUPED.replace(/\s+/g, "");
const START_AT_MS = 1_720_000_000_123;
/** Mid-tile while walking +X at 0.25 u/tick (MOVE_SPEED 5, TICK_MS 50). */
const START_X = 10.25;
const START_Z = 4;
const START_TILE = { x: Math.round(START_X), z: Math.round(START_Z) };

function makeCardinalPath(n, layerChangeAt) {
  const path = [];
  let x = START_TILE.x + 1;
  let z = START_TILE.z;
  let layer = 0;
  const turnAfter = Math.max(1, Math.ceil(n * 0.6));
  for (let i = 0; i < n; i++) {
    if (i === layerChangeAt) layer = 1;
    path.push({ x, z, layer });
    if (i + 1 >= n) break;
    if (i + 1 < turnAfter) x += 1;
    else z += 1;
  }
  return path;
}

function currentMsg(path, address = ADDR_GROUPED) {
  return {
    type: "moveOrder",
    address,
    path,
    startX: START_X,
    startZ: START_Z,
    startAtMs: START_AT_MS,
    speed: DEFAULT_PATH_MOVE_SPEED,
  };
}

function flatPath(path) {
  const a = [];
  for (const w of path) a.push(w.x, w.z, w.layer);
  return a;
}

function decodeFlat(a) {
  const path = [];
  for (let i = 0; i < a.length; i += 3) {
    path.push({ x: a[i], z: a[i + 1], layer: a[i + 2] });
  }
  return path;
}

function deltaFromStart(path) {
  const d = [];
  const lc = [];
  let px = START_TILE.x;
  let pz = START_TILE.z;
  let pl = 0;
  for (let i = 0; i < path.length; i++) {
    const w = path[i];
    d.push(w.x - px, w.z - pz);
    if (w.layer !== pl) lc.push([i, w.layer]);
    px = w.x;
    pz = w.z;
    pl = w.layer;
  }
  return { d, lc };
}

function decodeDelta(d, lc) {
  const changes = new Map((lc ?? []).map(([i, layer]) => [i, layer]));
  const path = [];
  let x = START_TILE.x;
  let z = START_TILE.z;
  let layer = 0;
  for (let i = 0; i < d.length; i += 2) {
    const wi = i / 2;
    x += d[i];
    z += d[i + 1];
    if (changes.has(wi)) layer = changes.get(wi);
    path.push({ x, z, layer });
  }
  return path;
}

function samePath(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function firstWaypointIsStartTile(path) {
  const w = path[0];
  return Boolean(w) && w.x === START_TILE.x && w.z === START_TILE.z;
}

function omitSpeed(msg) {
  const { speed, ...rest } = msg;
  return rest;
}

function compactAddr(msg) {
  return { ...msg, address: String(msg.address).replace(/\s+/g, "") };
}

function dropStart(msg) {
  const { startX, startZ, ...rest } = msg;
  return rest;
}

function loadedPlayer(i) {
  return {
    address: i === 0 ? ADDR_GROUPED : `NQ${String(i).padStart(2, "0")} 4M1T 4TGD VC7F LHLQ Y2DY 425N 5CVH M02Y`,
    displayName: i % 3 === 0 ? "alice-nimiq" : `player${i}`,
    x: 12.345678901234567 + i * 0.1,
    y: 0,
    z: -8.123456789012345,
    vx: 0,
    vz: 0,
    recentAliases: ["oldname1", "oldname2", "oldname3"],
    nimiqPay: i % 4 === 0,
    nimSendAway: false,
    chatTyping: false,
    challengeOpen: false,
    worldcupCountry: "DE",
    cosmeticAura: "aura-sparkle-01",
    cosmeticNameplate: "nameplate-gold",
    cosmeticChatBubble: "bubble-mint",
    cosmeticTrail: "trail-dust",
    playerLevel: 12,
  };
}

function slimPresence(i) {
  const p = loadedPlayer(i);
  return { address: p.address, displayName: p.displayName, chatTyping: true };
}

function fullState(n) {
  return {
    type: "state",
    players: Array.from({ length: n }, (_, i) => loadedPlayer(i)),
  };
}

function assertRoundTrip(path) {
  const flat = flatPath(path);
  if (!samePath(decodeFlat(flat), path)) {
    throw new Error(`flat round-trip failed n=${path.length}`);
  }
  const { d, lc } = deltaFromStart(path);
  if (!samePath(decodeDelta(d, lc), path)) {
    throw new Error(`delta round-trip failed n=${path.length}`);
  }
}

const WAYPOINTS = [2, 8, 20, 40];
const LAYER_AT = { 20: 12, 40: 18 };

const rows = [];
for (const n of WAYPOINTS) {
  const path = makeCardinalPath(n, LAYER_AT[n]);
  assertRoundTrip(path);
  const cur = currentMsg(path);
  const { d, lc } = deltaFromStart(path);
  const deltaMsg = {
    type: "moveOrder",
    address: ADDR_GROUPED,
    d,
    ...(lc.length ? { lc } : {}),
    startX: START_X,
    startZ: START_Z,
    startAtMs: START_AT_MS,
    speed: DEFAULT_PATH_MOVE_SPEED,
  };
  const flatMsg = {
    ...cur,
    path: flatPath(path),
  };
  const stacked = omitSpeed(
    compactAddr({
      type: "moveOrder",
      address: ADDR_GROUPED,
      d,
      ...(lc.length ? { lc } : {}),
      startX: START_X,
      startZ: START_Z,
      startAtMs: START_AT_MS,
    })
  );
  const envelopeOnly = {
    type: "moveOrder",
    address: ADDR_GROUPED,
    path: [],
    startX: START_X,
    startZ: START_Z,
    startAtMs: START_AT_MS,
    speed: DEFAULT_PATH_MOVE_SPEED,
  };
  rows.push({
    n,
    firstIsStartTile: firstWaypointIsStartTile(path),
    layerChanges: lc.length,
    pathJson: utf8(path),
    current: utf8(cur),
    flat: utf8(flatMsg),
    delta: utf8(deltaMsg),
    dropStartForced: utf8(dropStart(cur)),
    omitSpeed: utf8(omitSpeed(cur)),
    compactAddress: utf8(compactAddr(cur)),
    stackedSafe: utf8(stacked),
    envelope: utf8(envelopeOnly),
  });
}

const WALKS_PER_PLAYER_PER_MIN = 4;
const TYPING_FULL_STATES_PER_MIN = 8;
const TYPICAL_WP = 8;

function kib(n) {
  return `${(n / 1024).toFixed(1)} KiB`;
}

function roomRow(nPlayers, orderBytes) {
  const full = utf8(fullState(nPlayers));
  const presence = utf8({
    type: "stateDelta",
    players: [slimPresence(7)],
  });
  const ordersPerMin = WALKS_PER_PLAYER_PER_MIN * nPlayers;
  const egressOrderMin = orderBytes * nPlayers * ordersPerMin;
  const egressFullTypingMin = full * nPlayers * TYPING_FULL_STATES_PER_MIN;
  const egressSlimTypingMin = presence * nPlayers * TYPING_FULL_STATES_PER_MIN;
  return {
    nPlayers,
    fullStateBytes: full,
    slimPresenceDeltaBytes: presence,
    moveOrderBytes: orderBytes,
    egressPerMoveOrder: orderBytes * nPlayers,
    egressPerTypingFull: full * nPlayers,
    serverPerMin: {
      walksCurrent: egressOrderMin,
      typingFull: egressFullTypingMin,
      typingSlim: egressSlimTypingMin,
    },
  };
}

const typical = rows.find((r) => r.n === TYPICAL_WP);
const rooms = [10, 20, 30].map((n) => ({
  n,
  current: roomRow(n, typical.current),
  stacked: roomRow(n, typical.stackedSafe),
}));

const report = {
  assumptions: {
    addressGroupedChars: ADDR_GROUPED.length,
    addressCompactChars: ADDR_COMPACT.length,
    startX: START_X,
    startZ: START_Z,
    startTile: START_TILE,
    startAtMs: START_AT_MS,
    speed: DEFAULT_PATH_MOVE_SPEED,
    pathQueueIsRemainingTiles: true,
    firstWaypointIsNextTileNotStart: true,
    walksPerPlayerPerMin: WALKS_PER_PLAYER_PER_MIN,
    typingFullStatesPerMin: TYPING_FULL_STATES_PER_MIN,
    typicalWaypoints: TYPICAL_WP,
  },
  unit: rows,
  rooms,
};

function pad(v, w) {
  return String(v).padStart(w);
}

console.log(JSON.stringify(report, null, 2));
console.log("\n--- human ---");
console.log(
  `address grouped ${ADDR_GROUPED.length}c / compact ${ADDR_COMPACT.length}c; start=(${START_X},${START_Z}) tile=${START_TILE.x},${START_TILE.z}`
);
console.log(
  "wp | current | flat | delta | omitSpeed | compactAddr | dropStart* | stacked | path[] | first=start?"
);
for (const r of rows) {
  console.log(
    `${pad(r.n, 2)} | ${pad(r.current, 7)} | ${pad(r.flat, 4)} | ${pad(r.delta, 5)} | ${pad(r.omitSpeed, 9)} | ${pad(r.compactAddress, 11)} | ${pad(r.dropStartForced, 10)} | ${pad(r.stackedSafe, 7)} | ${pad(r.pathJson, 6)} | ${r.firstIsStartTile}`
  );
}
console.log("* dropStart is forced omit of startX/startZ (not valid: first waypoint is never the start tile).");
console.log(`envelope (empty path): ${rows[0].envelope} B`);
console.log("\nRoom egress /min (8 wp, 4 walks/player, 8 typing full-states):");
for (const r of rooms) {
  const saveWalk =
    r.current.serverPerMin.walksCurrent - r.stacked.serverPerMin.walksCurrent;
  const saveTyping =
    r.current.serverPerMin.typingFull - r.current.serverPerMin.typingSlim;
  console.log(
    `N=${r.n}  full-state ${r.current.fullStateBytes}B  order ${r.current.moveOrderBytes}B→${r.stacked.moveOrderBytes}B`
  );
  console.log(
    `     walks now ${kib(r.current.serverPerMin.walksCurrent)}  stacked ${kib(r.stacked.serverPerMin.walksCurrent)}  save ${kib(saveWalk)}`
  );
  console.log(
    `     typing full ${kib(r.current.serverPerMin.typingFull)}  slim-presence ${kib(r.current.serverPerMin.typingSlim)}  save ${kib(saveTyping)}`
  );
  console.log(
    `     one event egress: order ${kib(r.current.egressPerMoveOrder)} vs typing-full ${kib(r.current.egressPerTypingFull)}`
  );
}
