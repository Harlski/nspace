#!/usr/bin/env node
/**
 * THROW AWAY — numerical comparison of movement-bandwidth methods.
 * Not production. Does not import the game server.
 *
 * Question: for N=10/20/30 click-to-walk rooms, 60s window, how do methods
 * A–K compare in UTF-8 JSON server egress and per-client ingress vs today's
 * Path Playback + cut-stream + full `state` on presence (method A)?
 *
 * Run: node .scratch/movement-bandwidth/compare-methods.mjs
 */
import { deflateRawSync, deflateSync } from "node:zlib";

const utf8 = (v) => Buffer.byteLength(JSON.stringify(v), "utf8");

// ---------------------------------------------------------------------------
// Assumptions (keep consistent with research/04-method-comparison.md)
// ---------------------------------------------------------------------------
const ASSUMPTIONS = {
  windowSec: 60,
  Ns: [10, 20, 30],
  broadcastMs: 120, // STATE_BROADCAST_MIN_MS when pose is streamed
  walksPerPlayerPerMin: 4,
  pathWaypoints: 8,
  walkDurationSec: 3,
  speed: 5,
  // Room-wide presence dumps (not per player). Parameter: set perPlayer:true to scale ×N.
  chatTypingEventsPerMin: 8, // on+off each count as 1; a pair is 2
  otherPresenceEventsPerMin: 2, // challenge / nimSend
  presencePerPlayer: false,
  concurrentBusy: 0.5,
  concurrentSocial: 0.2,
  spatialVisibleFrac: 0.4, // GUESS: ~1/3 of hub visible; use 0.4
  deflateFullStateSave: { lo: 0.4, hi: 0.6 }, // GUESS remaining 40–60%? see note
  // User: "40-60% on repetitive JSON" = savings (remaining 40–60%).
  deflateMoveOrderSave: { lo: 0.1, hi: 0.2 }, // GUESS savings on tiny unique orders
  protoJsonFrac: { lo: 0.4, hi: 0.5 }, // GUESS protobuf size / JSON size
};

const TICKS_PER_MIN = ASSUMPTIONS.windowSec / (ASSUMPTIONS.broadcastMs / 1000);

const NAMES = [
  "alice",
  "johd",
  "NimiqFan",
  "pixel-walker",
  "hub-guest",
  "mina",
  "k",
  "space-cat",
  "builder42",
  "nq-dev",
];

/** User-facing Nimiq address with spaces (~44 chars), typical JWT `sub`. */
function spacedAddress(i) {
  const hex = "37MA6QTV9YYC3K8YX0HLA1X9T68QXH5L";
  const body = `${String(i).padStart(2, "0")}${hex}`.slice(0, 32);
  const chunks = [];
  for (let k = 0; k < 32; k += 4) chunks.push(body.slice(k, k + 4));
  return `NQ${chunks.join(" ")}`;
}

function compactAddress(i) {
  return spacedAddress(i).replace(/\s+/g, "");
}

/**
 * Approximate `playerToOutState`: cosmetics always present (null or id),
 * recentAliases always present (often []), playerLevel for wallets.
 * Mix: 70% typical, 20% one cosmetic, 10% loaded (aliases + 4 cosmetics).
 */
function playerOutState(i, opts = {}) {
  const moving = Boolean(opts.moving);
  const typing = Boolean(opts.typing);
  const round3 = Boolean(opts.round3);
  const pose = moving
    ? {
        x: 12.345678901234567 + i * 0.137,
        y: 0.25,
        z: -8.123456789012345 + i * 0.041,
        vx: 3.5355339059327378,
        vz: -3.5355339059327378,
      }
    : {
        x: 10 + (i % 17),
        y: 0,
        z: 4 + (i % 11),
        vx: 0,
        vz: 0,
      };
  if (round3) {
    for (const k of ["x", "y", "z", "vx", "vz"]) {
      pose[k] = Number(pose[k].toFixed(3));
    }
  }
  const bucket = i % 10;
  const typical = {
    address: spacedAddress(i),
    displayName: NAMES[i % NAMES.length],
    recentAliases: [],
    ...pose,
    cosmeticAura: null,
    cosmeticNameplate: null,
    cosmeticChatBubble: null,
    cosmeticTrail: null,
    playerLevel: 1 + (i % 9),
  };
  if (typing) typical.chatTyping = true;
  if (bucket >= 9) {
    typical.recentAliases = ["oldname1", "oldname2", "oldname3"];
    typical.cosmeticAura = "aura-ref-sigil-twirl-01";
    typical.cosmeticNameplate = "nameplate-gold";
    typical.cosmeticChatBubble = "bubble-mint";
    typical.cosmeticTrail = "trail-dust";
    typical.worldcupCountry = "DE";
    typical.playerLevel = 12;
  } else if (bucket >= 7) {
    typical.cosmeticAura = "aura-ref-magic-ring";
    typical.recentAliases = ["prevNick"];
  }
  return typical;
}

function omitPose(p) {
  const { x, y, z, vx, vz, ...rest } = p;
  return rest;
}

function compactPlayerKeys(p) {
  const out = {
    a: p.address,
    n: p.displayName,
    x: p.x,
    y: p.y,
    z: p.z,
    vx: p.vx,
    vz: p.vz,
  };
  if (p.recentAliases) out.ra = p.recentAliases;
  if (p.nimiqPay) out.np = p.nimiqPay;
  if (p.nimSendAway) out.aw = p.nimSendAway;
  if (p.chatTyping) out.ty = p.chatTyping;
  if (p.challengeOpen) out.ch = p.challengeOpen;
  if (p.worldcupCountry != null) out.cc = p.worldcupCountry;
  if ("cosmeticAura" in p) out.ca = p.cosmeticAura;
  if ("cosmeticNameplate" in p) out.cn = p.cosmeticNameplate;
  if ("cosmeticChatBubble" in p) out.cb = p.cosmeticChatBubble;
  if ("cosmeticTrail" in p) out.ct = p.cosmeticTrail;
  if (p.adminInvisible) out.ai = p.adminInvisible;
  if (p.frozen) out.fz = p.frozen;
  if (p.playerLevel != null) out.lv = p.playerLevel;
  return out;
}

function dropNullCosmetics(p) {
  const out = { ...p };
  for (const k of [
    "cosmeticAura",
    "cosmeticNameplate",
    "cosmeticChatBubble",
    "cosmeticTrail",
  ]) {
    if (out[k] == null) delete out[k];
  }
  if (Array.isArray(out.recentAliases) && out.recentAliases.length === 0) {
    delete out.recentAliases;
  }
  return out;
}

function slimPose(i, opts = {}) {
  const p = playerOutState(i, { moving: true, round3: opts.round3 });
  return {
    t: "p",
    a: compactAddress(i),
    x: p.x,
    z: p.z,
    y: p.y,
    vx: p.vx,
    vz: p.vz,
  };
}

function moveOrder(i, waypoints, opts = {}) {
  const p = playerOutState(i, { moving: true, round3: opts.round3 });
  return {
    type: "moveOrder",
    address: p.address,
    path: Array.from({ length: waypoints }, (_, k) => ({
      x: 10 + k,
      z: 4 + (i % 3),
      layer: 0,
    })),
    startX: p.x,
    startZ: p.z,
    startAtMs: 1_720_000_000_123,
    speed: ASSUMPTIONS.speed,
  };
}

function moveAbort(i, opts = {}) {
  const p = playerOutState(i, { moving: false, round3: opts.round3 });
  return {
    type: "moveAbort",
    address: p.address,
    x: p.x,
    z: p.z,
    y: p.y,
    vx: 0,
    vz: 0,
  };
}

function roster(n, opts = {}) {
  const walkers = opts.walkers ?? 0;
  return Array.from({ length: n }, (_, i) => {
    const moving = i < walkers;
    let p = playerOutState(i, {
      moving,
      typing: Boolean(opts.typingIndex === i),
      round3: opts.round3,
    });
    if (opts.omitWalkerPose && moving) p = omitPose(p);
    if (opts.compactKeys) p = compactPlayerKeys(p);
    if (opts.dropNulls) p = dropNullCosmetics(p);
    return p;
  });
}

function stateMsg(n, opts = {}) {
  const typeKey = opts.compactKeys ? "s" : "type";
  const playersKey = opts.compactKeys ? "p" : "players";
  const typeVal = opts.compactKeys ? "s" : "state";
  return { [typeKey]: typeVal, [playersKey]: roster(n, opts) };
}

function deltaOne(i, opts = {}) {
  let p = playerOutState(i, {
    moving: Boolean(opts.moving),
    typing: opts.typing !== false,
    round3: opts.round3,
  });
  if (opts.omitPose) p = omitPose(p);
  if (opts.compactKeys) p = compactPlayerKeys(p);
  if (opts.dropNulls) p = dropNullCosmetics(p);
  if (opts.compactKeys) {
    return { t: "d", p: [p] };
  }
  return { type: "stateDelta", players: [p] };
}

function roundDeep(v) {
  if (typeof v === "number") return Number(v.toFixed(3));
  if (Array.isArray(v)) return v.map(roundDeep);
  if (v && typeof v === "object") {
    const o = {};
    for (const [k, val] of Object.entries(v)) o[k] = roundDeep(val);
    return o;
  }
  return v;
}

/** Naive packed-binary size guess for one slim pose (no protobuf codegen). */
function packedSlimPoseBytes() {
  // uint8 type + 36-byte compact address + 5 * float32
  return 1 + 36 + 5 * 4;
}

function packedMoveOrderBytes(waypoints) {
  // uint8 type + 36 addr + startX/Z float32 + startAtMs uint64 + speed float32
  // + u8 count + waypoints (int16 x, int16 z, u8 layer)
  return 1 + 36 + 4 + 4 + 8 + 4 + 1 + waypoints * (2 + 2 + 1);
}

function packedPlayerStateBytes(p) {
  let n = 36; // address
  n += Buffer.byteLength(p.displayName, "utf8") + 1;
  n += 5 * 4; // pose float32
  n += 1; // playerLevel
  n += 1; // flag bitfield (typing, challenge, …)
  for (const k of [
    "cosmeticAura",
    "cosmeticNameplate",
    "cosmeticChatBubble",
    "cosmeticTrail",
  ]) {
    const s = p[k];
    n += s ? Buffer.byteLength(s, "utf8") + 1 : 1;
  }
  if (Array.isArray(p.recentAliases)) {
    n += 1;
    for (const a of p.recentAliases) n += Buffer.byteLength(a, "utf8") + 1;
  }
  return n;
}

function zlibRatio(buf, raw = false) {
  const z = raw ? deflateRawSync(buf) : deflateSync(buf);
  return z.length / buf.length;
}

function kib(bytes) {
  return bytes / 1024;
}

function fmtKib(bytes) {
  return kib(bytes).toFixed(1);
}

function pctVs(a, b) {
  if (a === 0) return b === 0 ? "0%" : "n/a";
  const p = ((b - a) / a) * 100;
  const sign = p > 0 ? "+" : "";
  return `${sign}${p.toFixed(0)}%`;
}

function presenceEventsPerMin() {
  const base =
    ASSUMPTIONS.chatTypingEventsPerMin + ASSUMPTIONS.otherPresenceEventsPerMin;
  return ASSUMPTIONS.presencePerPlayer ? (n) => base * n : () => base;
}

function walkStartsPerMin(n) {
  return ASSUMPTIONS.walksPerPlayerPerMin * n;
}

function concurrentWalkers(n, frac) {
  return Math.max(0, Math.round(n * frac));
}

function fanoutRecipients(n, movement, spatialFrac) {
  if (!movement) return n;
  return Math.max(1, Math.round(n * spatialFrac));
}

// ---------------------------------------------------------------------------
// Unit sizes
// ---------------------------------------------------------------------------
function measureUnits() {
  const idle = playerOutState(1, { moving: false });
  const walking = playerOutState(1, { moving: true });
  const typing = playerOutState(1, { moving: false, typing: true });
  const loaded = playerOutState(9, { moving: true });
  const units = {
    idleTypical: utf8(idle),
    walkingTypical: utf8(walking),
    typingTypical: utf8(typing),
    loadedWalking: utf8(loaded),
    idleNoNulls: utf8(dropNullCosmetics(idle)),
    idleOmitPose: utf8(omitPose(idle)),
    walkingOmitPose: utf8(omitPose(walking)),
    idleCompactKeys: utf8(compactPlayerKeys(idle)),
    walkingRound3: utf8(playerOutState(1, { moving: true, round3: true })),
    walkingUnrounded: utf8(walking),
    slimPose: utf8(slimPose(1)),
    slimPoseRound3: utf8(slimPose(1, { round3: true })),
    slimPoseCompactAddrAlready: utf8(slimPose(1)),
    moveOrder8: utf8(moveOrder(1, 8)),
    moveOrder8Round3: utf8(moveOrder(1, 8, { round3: true })),
    moveAbort: utf8(moveAbort(1)),
    deltaOneTyping: utf8(deltaOne(3, { moving: false, typing: true })),
    deltaOneTypingWalker: utf8(deltaOne(3, { moving: true, typing: true })),
    deltaOneTypingOmitPose: utf8(
      deltaOne(3, { moving: true, typing: true, omitPose: true })
    ),
    packedSlimPose: packedSlimPoseBytes(),
    packedMoveOrder8: packedMoveOrderBytes(8),
    packedIdlePlayer: packedPlayerStateBytes(idle),
  };

  const full = {};
  for (const n of ASSUMPTIONS.Ns) {
    full[`stateN${n}`] = utf8(stateMsg(n, { walkers: 0 }));
    full[`stateN${n}BusyWalk`] = utf8(
      stateMsg(n, { walkers: concurrentWalkers(n, ASSUMPTIONS.concurrentBusy) })
    );
    full[`stateN${n}OmitBusyPose`] = utf8(
      stateMsg(n, {
        walkers: concurrentWalkers(n, ASSUMPTIONS.concurrentBusy),
        omitWalkerPose: true,
      })
    );
    full[`stateN${n}Round3`] = utf8(
      stateMsg(n, {
        walkers: concurrentWalkers(n, ASSUMPTIONS.concurrentBusy),
        round3: true,
      })
    );
    full[`stateN${n}Compact`] = utf8(
      stateMsg(n, { walkers: 0, compactKeys: true })
    );
    full[`stateN${n}DropNulls`] = utf8(
      stateMsg(n, { walkers: 0, dropNulls: true })
    );
  }

  const deflate = {};
  for (const n of ASSUMPTIONS.Ns) {
    const json = JSON.stringify(stateMsg(n, { walkers: 0 }));
    const buf = Buffer.from(json, "utf8");
    deflate[`fullStateN${n}_deflate`] = zlibRatio(buf);
    deflate[`fullStateN${n}_deflateRaw`] = zlibRatio(buf, true);
    // Context-takeover proxy: concat 4 nearly-identical dumps.
    const dumps = [0, 1, 2, 3].map((k) =>
      JSON.stringify(
        stateMsg(n, { walkers: 0, typingIndex: k % n })
      )
    );
    const concat = Buffer.from(dumps.join(""), "utf8");
    deflate[`fullStateN${n}_4xConcatDeflateRaw`] = zlibRatio(concat, true);
    const order = Buffer.from(JSON.stringify(moveOrder(n, 8)), "utf8");
    deflate[`moveOrder_deflateRaw`] = zlibRatio(order, true);
  }

  return { units, full, deflate };
}

// ---------------------------------------------------------------------------
// Traffic model
// ---------------------------------------------------------------------------
function methodBytes({ n, concurrentFrac, spatialFrac, method, units }) {
  const walkers = concurrentWalkers(n, concurrentFrac);
  const starts = walkStartsPerMin(n);
  const presenceN = presenceEventsPerMin()(n);
  const orderBytes = units.moveOrder8;
  const orderBytesF = units.moveOrder8Round3;
  const fullBytes = utf8(stateMsg(n, { walkers }));
  const fullRound = utf8(stateMsg(n, { walkers, round3: true }));
  const fullCompact = utf8(stateMsg(n, { walkers, compactKeys: true }));
  const fullOmitPose = utf8(stateMsg(n, { walkers, omitWalkerPose: true }));
  const delta = units.deltaOneTyping;
  const deltaWalker = units.deltaOneTypingWalker;
  const deltaNoPose = units.deltaOneTypingOmitPose;
  const expectedDelta = (omitWhenWalking) => {
    // One subject per presence event; P(walking)=concurrentFrac.
    const walkingPay = omitWhenWalking ? deltaNoPose : deltaWalker;
    return concurrentFrac * walkingPay + (1 - concurrentFrac) * delta;
  };

  const moveRecipients = fanoutRecipients(n, true, spatialFrac);
  const allRecipients = n;

  // Default: Path Playback (no pose stream).
  let movePayloadPerMin = starts * orderBytes;
  let presencePayloadPerMin = presenceN * fullBytes;
  let extraPayloadPerMin = 0;
  let moveFan = allRecipients;
  let presenceFan = allRecipients;
  let extraFan = allRecipients;

  switch (method) {
    case "A":
      break;
    case "B":
      presencePayloadPerMin = presenceN * expectedDelta(false);
      break;
    case "C":
      presencePayloadPerMin = presenceN * expectedDelta(true);
      break;
    case "D":
      // C's presence deltas + omit pose on leftover full `state`.
      // Steady 60s occupancy has no extra full `state`; bytes ≈ C.
      // Model D as C presence + if a full dump still happened, omit walker pose.
      // For vs-A table we apply omit-pose to A's full dumps AND B-style deltas:
      // presence is still 1-player (like C) because D is specified as stacked on C.
      presencePayloadPerMin = presenceN * expectedDelta(true);
      break;
    case "D-on-A":
      presencePayloadPerMin = presenceN * fullOmitPose;
      break;
    case "E": {
      // Counterfactual: 120ms slim pose for walkers (cut-stream OFF), plus A's rest.
      const slimBatch = utf8({
        t: "p",
        players: Array.from({ length: Math.max(walkers, 1) }, (_, i) =>
          slimPose(i)
        ),
      });
      extraPayloadPerMin = walkers > 0 ? TICKS_PER_MIN * slimBatch : 0;
      extraFan = allRecipients;
      break;
    }
    case "E-fullCloneStream": {
      const batch = utf8({
        type: "stateDelta",
        players: roster(n, { walkers }).slice(0, Math.max(walkers, 1)),
      });
      extraPayloadPerMin = walkers > 0 ? TICKS_PER_MIN * batch : 0;
      extraFan = allRecipients;
      break;
    }
    case "F":
      movePayloadPerMin = starts * orderBytesF;
      presencePayloadPerMin = presenceN * fullRound;
      break;
    case "G":
      presencePayloadPerMin = presenceN * fullCompact;
      break;
    case "H": {
      const hb = utf8({
        t: "p",
        players: Array.from({ length: Math.max(walkers, 1) }, (_, i) =>
          slimPose(i)
        ),
      });
      extraPayloadPerMin = walkers > 0 ? 60 * hb : 0;
      extraFan = allRecipients;
      break;
    }
    case "H-fullClone": {
      const hb = utf8({
        type: "stateDelta",
        players: roster(n, { walkers }).slice(0, Math.max(walkers, 1)),
      });
      extraPayloadPerMin = walkers > 0 ? 60 * hb : 0;
      extraFan = allRecipients;
      break;
    }
    case "I":
      moveFan = moveRecipients;
      break;
    case "J": {
      const saveFull =
        (ASSUMPTIONS.deflateFullStateSave.lo +
          ASSUMPTIONS.deflateFullStateSave.hi) /
        2;
      const saveOrd =
        (ASSUMPTIONS.deflateMoveOrderSave.lo +
          ASSUMPTIONS.deflateMoveOrderSave.hi) /
        2;
      movePayloadPerMin = starts * orderBytes * (1 - saveOrd);
      presencePayloadPerMin = presenceN * fullBytes * (1 - saveFull);
      break;
    }
    case "J-empirical": {
      const json = Buffer.from(
        JSON.stringify(stateMsg(n, { walkers })),
        "utf8"
      );
      const ord = Buffer.from(JSON.stringify(moveOrder(1, 8)), "utf8");
      const rFull = zlibRatio(json, true);
      const rOrd = zlibRatio(ord, true);
      movePayloadPerMin = starts * orderBytes * rOrd;
      presencePayloadPerMin = presenceN * fullBytes * rFull;
      break;
    }
    case "K": {
      const frac =
        (ASSUMPTIONS.protoJsonFrac.lo + ASSUMPTIONS.protoJsonFrac.hi) / 2;
      movePayloadPerMin = starts * orderBytes * frac;
      presencePayloadPerMin = presenceN * fullBytes * frac;
      break;
    }
    case "K-packed": {
      const packedFull =
        2 +
        roster(n, { walkers }).reduce((s, p) => s + packedPlayerStateBytes(p), 0);
      movePayloadPerMin = starts * packedMoveOrderBytes(8);
      presencePayloadPerMin = presenceN * packedFull;
      break;
    }
    case "G-dropNulls":
      presencePayloadPerMin =
        presenceN * utf8(stateMsg(n, { walkers, dropNulls: true }));
      break;
    case "B+C+D":
      presencePayloadPerMin = presenceN * expectedDelta(true);
      break;
    case "B+I":
      presencePayloadPerMin = presenceN * expectedDelta(false);
      moveFan = moveRecipients;
      break;
    case "B+C+D+I":
      presencePayloadPerMin = presenceN * expectedDelta(true);
      moveFan = moveRecipients;
      break;
    case "B+C+D+H":
      presencePayloadPerMin = presenceN * expectedDelta(true);
      extraPayloadPerMin =
        walkers > 0
          ? 60 *
            utf8({
              t: "p",
              players: Array.from({ length: Math.max(walkers, 1) }, (_, i) =>
                slimPose(i)
              ),
            })
          : 0;
      extraFan = allRecipients;
      break;
    case "B+J": {
      const saveFull =
        (ASSUMPTIONS.deflateFullStateSave.lo +
          ASSUMPTIONS.deflateFullStateSave.hi) /
        2;
      const saveOrd =
        (ASSUMPTIONS.deflateMoveOrderSave.lo +
          ASSUMPTIONS.deflateMoveOrderSave.hi) /
        2;
      presencePayloadPerMin =
        presenceN * expectedDelta(false) * (1 - saveFull);
      movePayloadPerMin = starts * orderBytes * (1 - saveOrd);
      break;
    }
    case "B+K": {
      const frac =
        (ASSUMPTIONS.protoJsonFrac.lo + ASSUMPTIONS.protoJsonFrac.hi) / 2;
      presencePayloadPerMin = presenceN * expectedDelta(false) * frac;
      movePayloadPerMin = starts * orderBytes * frac;
      break;
    }
    default:
      throw new Error(`unknown method ${method}`);
  }

  const server =
    movePayloadPerMin * moveFan +
    presencePayloadPerMin * presenceFan +
    extraPayloadPerMin * extraFan;
  return {
    server,
    perClient: server / n,
    parts: {
      move: movePayloadPerMin * moveFan,
      presence: presencePayloadPerMin * presenceFan,
      extra: extraPayloadPerMin * extraFan,
    },
  };
}

const MAIN_METHODS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"];
const EXTRA_METHODS = [
  "D-on-A",
  "E-fullCloneStream",
  "H-fullClone",
  "J-empirical",
  "K-packed",
  "G-dropNulls",
  "B+C+D",
  "B+I",
  "B+C+D+I",
  "B+C+D+H",
  "B+J",
  "B+K",
];

function scenario(name, concurrentFrac) {
  const measured = measureUnits();
  const rows = {};
  for (const method of [...MAIN_METHODS, ...EXTRA_METHODS]) {
    rows[method] = {};
    for (const n of ASSUMPTIONS.Ns) {
      rows[method][n] = methodBytes({
        n,
        concurrentFrac,
        spatialFrac: ASSUMPTIONS.spatialVisibleFrac,
        method,
        units: measured.units,
      });
    }
  }
  return { name, concurrentFrac, measured, rows };
}

function printTable(title, scen) {
  const a = scen.rows.A;
  console.log(`\n### ${title}\n`);
  console.log(
    "| Method | N=10 server KiB/min | N=20 | N=30 | N=10 /client | N=20 /client | N=30 /client | vs A at N=30 |"
  );
  console.log("|---|---:|---:|---:|---:|---:|---:|---:|");
  for (const m of MAIN_METHODS) {
    const r = scen.rows[m];
    console.log(
      `| ${m} | ${fmtKib(r[10].server)} | ${fmtKib(r[20].server)} | ${fmtKib(r[30].server)} | ${fmtKib(r[10].perClient)} | ${fmtKib(r[20].perClient)} | ${fmtKib(r[30].perClient)} | ${pctVs(a[30].server, r[30].server)} |`
    );
  }
  console.log("\nExtra / sensitivity (same assumptions):\n");
  console.log(
    "| Variant | N=10 server | N=20 | N=30 | vs A N=30 |"
  );
  console.log("|---|---:|---:|---:|---:|");
  for (const m of EXTRA_METHODS) {
    const r = scen.rows[m];
    console.log(
      `| ${m} | ${fmtKib(r[10].server)} | ${fmtKib(r[20].server)} | ${fmtKib(r[30].server)} | ${pctVs(a[30].server, r[30].server)} |`
    );
  }
  console.log("\nPart split at N=30 (server bytes/min):\n");
  console.log("| Method | moveOrder | presence | extra (stream/heartbeat) |");
  console.log("|---|---:|---:|---:|");
  for (const m of ["A", "B", "C", "D", "E", "H", "I", "J", "K"]) {
    const p = scen.rows[m][30].parts;
    console.log(
      `| ${m} | ${fmtKib(p.move)} | ${fmtKib(p.presence)} | ${fmtKib(p.extra)} |`
    );
  }

  const stacked = ["B+C+D", "B+I", "B+C+D+I", "B+C+D+H", "B+J", "B+K"];
  console.log("\nStacked on B (N=10/20/30 server KiB/min, vs A and vs B at N=30):\n");
  console.log("| Stack | N=10 | N=20 | N=30 | vs A N=30 | vs B N=30 |");
  console.log("|---|---:|---:|---:|---:|---:|");
  const b = scen.rows.B;
  for (const m of stacked) {
    const r = scen.rows[m];
    console.log(
      `| ${m} | ${fmtKib(r[10].server)} | ${fmtKib(r[20].server)} | ${fmtKib(r[30].server)} | ${pctVs(a[30].server, r[30].server)} | ${pctVs(b[30].server, r[30].server)} |`
    );
  }
}

function stringifyCostNote() {
  console.log(`
## CPU sketch (not a benchmark)

Today \`broadcast()\` in rooms.ts JSON.stringifies **per recipient** after the
admin-invisibility filter. A full \`state\` of N players is O(N) to encode and
is encoded N times, then sent N times: encode work ~ N² × |PlayerState|.

At N=30, one typing toggle is 30 × stringify(~10 KiB) plus 30 socket writes.
Method B drops that to 30 × stringify(~0.4 KiB). Methods J/K add codec CPU
on every frame; Path Playback already removed the 8.33 Hz pose encode.

Tick still runs at 20 Hz and still snapshots/compares up to 8.33 Hz even when
CUT_MOVEMENT_STREAM suppresses the send (walking rooms pay CPU without bytes).
`);
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
const busy = scenario("busy-walk", ASSUMPTIONS.concurrentBusy);
const social = scenario("social-hub", ASSUMPTIONS.concurrentSocial);

console.log("# Movement bandwidth method comparison (computed)\n");
console.log("Assumptions:", JSON.stringify(ASSUMPTIONS, null, 2));
console.log(
  `\nDuty-cycle note: 4 walks/min × 3s = 20% of the time walking, which matches` +
    ` social-hub concurrent=0.2. Busy-walk concurrent=0.5 is **occupancy only**` +
    ` (heartbeat / omit-pose / spatial); walk *starts* stay 4/min as specified.` +
    ` A physically consistent 50% duty cycle would be 10 starts/min.`
);

console.log("\n## Unit sizes (UTF-8 JSON bytes)\n");
console.log(JSON.stringify(busy.measured.units, null, 2));
console.log("\n## Full-state sizes\n");
console.log(JSON.stringify(busy.measured.full, null, 2));
console.log("\n## Empirical zlib ratios (compressed/original)\n");
console.log(JSON.stringify(busy.measured.deflate, null, 2));

printTable("Busy walk (50% concurrent walkers, 4 starts/min, 10 presence events/min)", busy);
printTable("Social hub (20% concurrent walkers, 4 starts/min, 10 presence events/min)", social);

stringifyCostNote();

// Machine-readable dump for the research doc / later tickets.
const out = {
  assumptions: ASSUMPTIONS,
  ticksPerMin: TICKS_PER_MIN,
  units: busy.measured.units,
  full: busy.measured.full,
  deflate: busy.measured.deflate,
  busy: Object.fromEntries(
    Object.entries(busy.rows).map(([m, byN]) => [
      m,
      Object.fromEntries(
        Object.entries(byN).map(([n, v]) => [
          n,
          {
            serverKiB: kib(v.server),
            perClientKiB: kib(v.perClient),
            vsA: v.server / busy.rows.A[n].server,
            partsKiB: {
              move: kib(v.parts.move),
              presence: kib(v.parts.presence),
              extra: kib(v.parts.extra),
            },
          },
        ])
      ),
    ])
  ),
  social: Object.fromEntries(
    Object.entries(social.rows).map(([m, byN]) => [
      m,
      Object.fromEntries(
        Object.entries(byN).map(([n, v]) => [
          n,
          {
            serverKiB: kib(v.server),
            perClientKiB: kib(v.perClient),
            vsA: v.server / social.rows.A[n].server,
            partsKiB: {
              move: kib(v.parts.move),
              presence: kib(v.parts.presence),
              extra: kib(v.parts.extra),
            },
          },
        ])
      ),
    ])
  ),
};

console.log("\n## JSON_DUMP");
console.log(JSON.stringify(out, null, 2));
