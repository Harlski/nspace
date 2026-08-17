#!/usr/bin/env node
/**
 * Throwaway bandwidth estimator for Path Playback / room state.
 * Run: node .scratch/movement-bandwidth/estimate-baseline.mjs
 */
const utf8 = (v) => Buffer.byteLength(JSON.stringify(v), "utf8");

const ADDR = "NQ07 37MA 6567 32XX XXXX XXXX XXXX XXXX";
const ADDR2 = "NQ88 ABCD EFGH 12IJ KL3M NOPQ RSTU VWXY";

function leanPlayer(i, moving) {
  return {
    address: i === 0 ? ADDR : `NQ${String(i).padStart(2, "0")} ${ADDR2.slice(5)}`,
    displayName: i % 3 === 0 ? "alice-nimiq" : `player${i}`,
    x: 12.345678901234567 + i * 0.1,
    y: 0,
    z: -8.123456789012345,
    vx: moving ? 5 : 0,
    vz: 0,
  };
}

function loadedPlayer(i, moving) {
  return {
    ...leanPlayer(i, moving),
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
  const p = loadedPlayer(i, false);
  return {
    address: p.address,
    displayName: p.displayName,
    chatTyping: true,
  };
}

function poseOnly(i, moving) {
  const p = leanPlayer(i, moving);
  return {
    address: p.address,
    x: Number(p.x.toFixed(3)),
    y: 0,
    z: Number(p.z.toFixed(3)),
    vx: moving ? 5 : 0,
    vz: 0,
  };
}

function compactPose(i, moving) {
  const p = leanPlayer(i, moving);
  return {
    t: "p",
    a: p.address.replace(/\s/g, ""),
    x: Number(p.x.toFixed(3)),
    y: 0,
    z: Number(p.z.toFixed(3)),
    vx: moving ? 5 : 0,
    vz: 0,
  };
}

function moveOrder(i, waypoints) {
  const p = leanPlayer(i, true);
  return {
    type: "moveOrder",
    address: p.address,
    path: Array.from({ length: waypoints }, (_, k) => ({
      x: 10 + k,
      z: 4,
      layer: 0,
    })),
    startX: p.x,
    startZ: p.z,
    startAtMs: 1720000000123,
    speed: 5,
  };
}

function moveAbort(i) {
  const p = leanPlayer(i, false);
  return {
    type: "moveAbort",
    address: p.address,
    x: p.x,
    z: p.z,
    y: 0,
    vx: 0,
    vz: 0,
  };
}

const sizes = {
  leanPlayer: utf8(leanPlayer(1, true)),
  loadedPlayer: utf8(loadedPlayer(1, true)),
  loadedPlayerIdleFlagsOmitted: utf8({
    ...leanPlayer(1, false),
    recentAliases: ["oldname1", "oldname2", "oldname3"],
    worldcupCountry: "DE",
    cosmeticAura: "aura-sparkle-01",
    cosmeticNameplate: "nameplate-gold",
    cosmeticChatBubble: "bubble-mint",
    cosmeticTrail: "trail-dust",
    playerLevel: 12,
  }),
  slimPresence: utf8(slimPresence(1)),
  poseOnly3dp: utf8(poseOnly(1, true)),
  compactPose: utf8(compactPose(1, true)),
  moveOrder2: utf8(moveOrder(1, 2)),
  moveOrder8: utf8(moveOrder(1, 8)),
  moveOrder20: utf8(moveOrder(1, 20)),
  moveAbort: utf8(moveAbort(1)),
};

const TICK_HZ = 1000 / 120;
const WALKS_PER_PLAYER_PER_MIN = 4;
const PATH_WP = 8;
const TYPING_FULL_STATES_PER_MIN = 8; // on+off counted separately
const OTHER_FULL_STATES_PER_MIN = 2;

function fullState(n, loaded) {
  const players = Array.from({ length: n }, (_, i) =>
    loaded ? loadedPlayer(i, false) : leanPlayer(i, false)
  );
  return { type: "state", players };
}

function deltaOne(nLoaded) {
  return {
    type: "stateDelta",
    players: [nLoaded ? loadedPlayer(7, true) : leanPlayer(7, true)],
  };
}

function tableForN(n, playerBytesFn) {
  const full = utf8(fullState(n, true));
  const fullLean = utf8(fullState(n, false));
  const delta = utf8(deltaOne(true));
  const deltaLean = utf8(deltaOne(false));
  const presence = utf8({
    type: "stateDelta",
    players: [slimPresence(7)],
  });
  const order = utf8(moveOrder(1, PATH_WP));
  const abort = utf8(moveAbort(1));

  const egress = (payload) => payload * n;
  const perClient = (payload) => payload;

  // Scenario A: idle after baseline — 0 tick bytes
  const idleMin = 0;

  // Scenario B: Path Playback, all walking, no social full-state
  // 4 walks/player/min * N orders * N recipients
  const ordersPerMin = WALKS_PER_PLAYER_PER_MIN * n;
  const pathPlaybackMin = egress(order) * ordersPerMin;

  // Scenario C: legacy pose stream, all walking (every 120ms full delta of N movers = sendFull)
  const legacyTickPayload = full; // all N changed -> sendFull
  const legacyMin = egress(legacyTickPayload) * TICK_HZ * 60;

  // Scenario D: social hub — Path Playback walks at 20% walking rate + typing full states
  const socialWalks = WALKS_PER_PLAYER_PER_MIN * n * 0.5; // half as many walks as "all walking"
  const socialOrdersMin = egress(order) * socialWalks;
  const socialFullMin =
    egress(full) * (TYPING_FULL_STATES_PER_MIN + OTHER_FULL_STATES_PER_MIN);
  const socialTodayMin = socialOrdersMin + socialFullMin;

  // Method B: presence as 1-player stateDelta (still loaded PlayerState)
  const socialB =
    socialOrdersMin +
    egress(delta) * (TYPING_FULL_STATES_PER_MIN + OTHER_FULL_STATES_PER_MIN);

  // Method C: slim presence-only
  const socialC =
    socialOrdersMin +
    egress(presence) *
      (TYPING_FULL_STATES_PER_MIN + OTHER_FULL_STATES_PER_MIN);

  // Method H: + 1Hz pose for 20% walkers
  const walkers = Math.max(1, Math.round(n * 0.2));
  const heartbeatMsg = utf8({
    type: "stateDelta",
    players: Array.from({ length: walkers }, (_, i) => poseOnly(i, true)),
  });
  const heartbeatMin = egress(heartbeatMsg) * 60;

  return {
    n,
    bytes: {
      fullLoaded: full,
      fullLean,
      deltaLoadedOne: delta,
      deltaLeanOne: deltaLean,
      presenceOnlyDelta: presence,
      moveOrder8: order,
      moveAbort: abort,
    },
    serverBytesPerMin: {
      idle: idleMin,
      allWalkingPathPlayback: pathPlaybackMin,
      allWalkingLegacyStream: legacyMin,
      socialHubToday: socialTodayMin,
      socialHubPresenceDeltaLoaded: socialB,
      socialHubPresenceSlim: socialC,
      socialHubSlimPlus1HzHeartbeat: socialC + heartbeatMin,
    },
    perClientBytesPerMin: {
      idle: 0,
      allWalkingPathPlayback: pathPlaybackMin / n,
      allWalkingLegacyStream: legacyMin / n,
      socialHubToday: socialTodayMin / n,
      socialHubPresenceDeltaLoaded: socialB / n,
      socialHubPresenceSlim: socialC / n,
      socialHubSlimPlus1HzHeartbeat: (socialC + heartbeatMin) / n,
    },
    perEventEgress: {
      fullState: egress(full),
      deltaOneLoaded: egress(delta),
      presenceSlim: egress(presence),
      moveOrder8: egress(order),
    },
  };
}

const report = {
  unitSizes: sizes,
  tickHz: TICK_HZ,
  assumptions: {
    STATE_BROADCAST_MIN_MS: 120,
    walksPerPlayerPerMin: WALKS_PER_PLAYER_PER_MIN,
    pathWaypoints: PATH_WP,
    typingFullStatesPerMin: TYPING_FULL_STATES_PER_MIN,
    otherFullStatesPerMin: OTHER_FULL_STATES_PER_MIN,
    loadedPlayerIncludesAliasesAndCosmetics: true,
    fanOut: "payloadBytes * N recipients",
  },
  rooms: [10, 20, 30].map((n) => tableForN(n)),
};

function kib(n) {
  return `${(n / 1024).toFixed(1)} KiB`;
}

console.log(JSON.stringify(report, null, 2));
console.log("\n--- human ---");
console.log("unit sizes (utf8):", sizes);
for (const row of report.rooms) {
  console.log(`\nN=${row.n}`);
  console.log("  full state loaded", row.bytes.fullLoaded, kib(row.bytes.fullLoaded));
  console.log("  1-player stateDelta loaded", row.bytes.deltaLoadedOne);
  console.log("  presence-only delta", row.bytes.presenceOnlyDelta);
  console.log("  moveOrder 8wp", row.bytes.moveOrder8);
  console.log("  SERVER /min:");
  for (const [k, v] of Object.entries(row.serverBytesPerMin)) {
    console.log(`    ${k}: ${kib(v)} (${v} B)`);
  }
  console.log("  PER CLIENT /min:");
  for (const [k, v] of Object.entries(row.perClientBytesPerMin)) {
    console.log(`    ${k}: ${kib(v)}`);
  }
}
