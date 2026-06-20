/**
 * World Cup soccer field visuals (CLIENT-ONLY, FEATURE-FLAGGED, DEPRECATABLE).
 *
 * Procedural Three.js decoration for the pitch: a soccer-ball texture, a grass + line
 * markings pitch surface, goal netting, and stadium stands. Everything here is cosmetic
 * (no server collision) and is created/disposed by the worldcup block in `Game.ts`. To
 * deprecate: delete this file and the `worldcup`-tagged calls that reference it.
 */
import * as THREE from "three";

import { loadIdenticonTexture } from "../game/identiconTexture.js";
import { flagEmoji } from "./countries.js";
import {
  codeFromFlagEmoji,
  getFlagImageIfReady,
  loadFlagImage,
} from "../ui/flags.js";

type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number };

let soccerBallTexture: THREE.CanvasTexture | null = null;
let pitchTexture: THREE.CanvasTexture | null = null;
let netTexture: THREE.CanvasTexture | null = null;

/** Shared stand geometry so the stands and the crowd that sits on them stay aligned. */
const STADIUM = { tiers: 4, tierH: 0.6, tierW: 1.1, gap: 1.6 } as const;

/**
 * Front-row seat on the north/south stand nearest `worldZ` (matches the tier-0 crowd row):
 * the world `z` of that stand line and the feet height `y` on top of the first tier box. Used
 * to lift Spectator avatars out of the seating geometry so they read as an audience member.
 */
export function frontRowStandSeat(
  bounds: Bounds,
  worldZ: number
): { z: number; y: number } {
  const { tierH, gap } = STADIUM;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  const lengthZ = bounds.maxZ - bounds.minZ + 1;
  const sign = worldZ >= cz ? 1 : -1;
  // Tier 0: out = gap; the box top (feet rest here) is at 0.2 + tierH/2.
  const z = cz + sign * (lengthZ / 2 + gap);
  const y = 0.2 + tierH / 2;
  return { z, y };
}

type Vec3 = [number, number, number];

function vNorm(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
function vDot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function vCross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

/** The 12 icosahedron vertices, normalized — these are the centers of the 12 black pentagons
 * on a truncated-icosahedron (classic Telstar) ball. */
function icosahedronVertices(): Vec3[] {
  const g = (1 + Math.sqrt(5)) / 2; // golden ratio
  const raw: Vec3[] = [
    [0, 1, g],
    [0, 1, -g],
    [0, -1, g],
    [0, -1, -g],
    [1, g, 0],
    [1, -g, 0],
    [-1, g, 0],
    [-1, -g, 0],
    [g, 0, 1],
    [g, 0, -1],
    [-g, 0, 1],
    [-g, 0, -1],
  ];
  return raw.map(vNorm);
}

/**
 * Classic black-pentagon-on-white ball, rendered per-texel on the equirectangular map so the
 * pentagons stay identical everywhere — including at the poles, which previously collapsed into
 * a solid black circle. For each texel we reconstruct its 3D direction on the sphere (matching
 * Three.js `SphereGeometry` UVs), find the nearest of the 12 pentagon centers, and run a regular
 * pentagon test in that center's tangent plane (one edge facing each neighbor). Because the test
 * is intrinsic to the sphere, all 12 pentagons read the same regardless of where they land on
 * the equirectangular seam or poles.
 */
export function makeSoccerBallTexture(): THREE.CanvasTexture {
  if (soccerBallTexture) return soccerBallTexture;
  const w = 1024;
  const h = 512;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  const centers = icosahedronVertices();
  // Precompute a tangent frame per center so one pentagon edge-normal points at a neighbour
  // (on a real ball the seam between two black pentagons runs through the hexagons between them).
  const frames = centers.map((c) => {
    // Nearest other centre = a neighbour; its tangential projection is an edge-normal direction.
    let best = -2;
    let nb: Vec3 = [0, 0, 0];
    for (const o of centers) {
      if (o === c) continue;
      const d = vDot(c, o);
      if (d > best) {
        best = d;
        nb = o;
      }
    }
    const dot = vDot(nb, c);
    let e1: Vec3 = [nb[0] - dot * c[0], nb[1] - dot * c[1], nb[2] - dot * c[2]];
    e1 = vNorm(e1);
    const e2 = vNorm(vCross(c, e1));
    return { e1, e2 };
  });

  // Pentagon size (angular). circumradius -> apothem for a regular pentagon.
  const circumradius = 0.42; // radians, centre-to-corner
  const apothem = circumradius * Math.cos(Math.PI / 5);
  const aa = 0.012; // anti-alias half-width (radians)

  const white: Vec3 = [0xf2, 0xf2, 0xef];
  const black: Vec3 = [0x16, 0x16, 0x1b];

  const img = ctx.createImageData(w, h);
  const data = img.data;
  for (let py = 0; py < h; py++) {
    // Three.js sphere UV: v_tex = 1 - theta/PI, canvas top (py=0) -> theta=0 (top pole).
    const theta = (py / (h - 1)) * Math.PI;
    const sinT = Math.sin(theta);
    const cosT = Math.cos(theta);
    for (let px = 0; px < w; px++) {
      const phi = (px / w) * Math.PI * 2;
      // Direction matching SphereGeometry: x=-cos(phi)sin(theta), y=cos(theta), z=sin(phi)sin(theta)
      const d: Vec3 = [-Math.cos(phi) * sinT, cosT, Math.sin(phi) * sinT];

      // Nearest pentagon centre.
      let bi = 0;
      let bdot = -2;
      for (let i = 0; i < centers.length; i++) {
        const dd = vDot(d, centers[i]!);
        if (dd > bdot) {
          bdot = dd;
          bi = i;
        }
      }
      const ang = Math.acos(Math.max(-1, Math.min(1, bdot))); // angular distance to centre

      // Azimuth around the centre, relative to its edge-normal frame.
      const f = frames[bi]!;
      const tx = vDot(d, f.e1);
      const ty = vDot(d, f.e2);
      const az = Math.atan2(ty, tx);
      // Local angle to the nearest of 5 edge-normals (spaced 72deg).
      const step = (Math.PI * 2) / 5;
      const local = ((((az + step / 2) % step) + step) % step) - step / 2;
      // Pentagon boundary radius at this azimuth (flat/gnomonic approx is fine at this size).
      const boundary = apothem / Math.cos(local);
      const sd = boundary - ang; // >0 inside the pentagon

      const t = sd > aa ? 1 : sd < -aa ? 0 : (sd + aa) / (2 * aa); // 1 = black
      // Soft top-down shading so the white isn't flat (independent of pattern).
      const shade = 0.9 + 0.1 * cosT;
      const r = (black[0] * t + white[0] * (1 - t)) * shade;
      const g = (black[1] * t + white[1] * (1 - t)) * shade;
      const b = (black[2] * t + white[2] * (1 - t)) * shade;

      const o = (py * w + px) * 4;
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  soccerBallTexture = tex;
  return tex;
}

/**
 * Grass with mow stripes plus standard white markings (touchlines, halfway line, center
 * circle/spot, penalty + goal areas at each end, corner arcs). Sized to the pitch aspect.
 */
export function makePitchTexture(): THREE.CanvasTexture {
  if (pitchTexture) return pitchTexture;
  // Pitch is 21 wide (X) x 15 deep (Z); keep the canvas at the same aspect.
  const w = 1050;
  const h = 750;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  // Mow stripes along the length (X).
  const stripes = 10;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#3a8f3a" : "#348534";
    ctx.fillRect((i * w) / stripes, 0, w / stripes + 1, h);
  }

  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.lineWidth = 5;
  const m = 28; // outer margin (touchline inset)
  const left = m;
  const right = w - m;
  const top = m;
  const bottom = h - m;
  const midX = w / 2;
  const midY = h / 2;

  // Touchlines.
  ctx.strokeRect(left, top, right - left, bottom - top);
  // Halfway line.
  ctx.beginPath();
  ctx.moveTo(midX, top);
  ctx.lineTo(midX, bottom);
  ctx.stroke();
  // Center circle + spot.
  ctx.beginPath();
  ctx.arc(midX, midY, 95, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.beginPath();
  ctx.arc(midX, midY, 6, 0, Math.PI * 2);
  ctx.fill();

  const penDepth = 150;
  const penHalf = 200;
  const goalDepth = 60;
  const goalHalf = 110;
  // Penalty + goal areas at both ends.
  for (const side of [-1, 1]) {
    const endX = side === -1 ? left : right;
    const penX = side === -1 ? left + penDepth : right - penDepth;
    const goalX = side === -1 ? left + goalDepth : right - goalDepth;
    ctx.strokeRect(
      Math.min(endX, penX),
      midY - penHalf,
      penDepth,
      penHalf * 2
    );
    ctx.strokeRect(
      Math.min(endX, goalX),
      midY - goalHalf,
      goalDepth,
      goalHalf * 2
    );
    // Penalty spot.
    ctx.beginPath();
    ctx.arc(side === -1 ? left + 100 : right - 100, midY, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Corner arcs.
  const ca = 16;
  for (const [cx, cy, a0] of [
    [left, top, 0],
    [right, top, Math.PI / 2],
    [right, bottom, Math.PI],
    [left, bottom, -Math.PI / 2],
  ] as const) {
    ctx.beginPath();
    ctx.arc(cx, cy, ca, a0, a0 + Math.PI / 2);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  pitchTexture = tex;
  return tex;
}

/** Transparent white mesh grid for goal netting (tiled via wrap + repeat). */
export function makeNetTexture(): THREE.CanvasTexture {
  if (netTexture) return netTexture;
  const s = 64;
  const canvas = document.createElement("canvas");
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, s, s);
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  // Diamond mesh.
  ctx.moveTo(0, s / 2);
  ctx.lineTo(s / 2, 0);
  ctx.lineTo(s, s / 2);
  ctx.lineTo(s / 2, s);
  ctx.closePath();
  ctx.moveTo(s / 2, 0);
  ctx.lineTo(s / 2, s);
  ctx.moveTo(0, s / 2);
  ctx.lineTo(s, s / 2);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 3);
  tex.needsUpdate = true;
  netTexture = tex;
  return tex;
}

/** Shared net material (transparent). The texture is a module singleton, so disposing the
 * material on room change does not free it — avoids per-entry texture leaks. */
function makeNetMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    map: makeNetTexture(),
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    opacity: 0.9,
  });
}

/** Flat textured pitch surface, laid over the gray floor tiles. Cosmetic (no picking). */
export function makePitchSurface(bounds: Bounds): THREE.Mesh {
  const width = bounds.maxX - bounds.minX + 1;
  const depth = bounds.maxZ - bounds.minZ + 1;
  const geo = new THREE.PlaneGeometry(width, depth);
  const mat = new THREE.MeshStandardMaterial({
    map: makePitchTexture(),
    roughness: 0.95,
    metalness: 0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(
    (bounds.minX + bounds.maxX) / 2,
    0.02,
    (bounds.minZ + bounds.maxZ) / 2
  );
  mesh.userData["skipBlockPickAndBounds"] = true;
  mesh.raycast = () => {};
  mesh.renderOrder = 1;
  return mesh;
}

/**
 * Net panels (back + two sides + roof) behind a goal mouth. `lineX` is the post line (world
 * X), `zNear`/`zFar` the post Z positions, `postHeight` the crossbar height, `isWest` which
 * way the net extends (away from the pitch interior).
 */
export function buildGoalNet(args: {
  lineX: number;
  zNear: number;
  zFar: number;
  postHeight: number;
  isWest: boolean;
}): THREE.Group {
  const { lineX, zNear, zFar, postHeight, isWest } = args;
  const depth = 1.2;
  const backX = isWest ? lineX - depth : lineX + depth;
  const width = zFar - zNear;
  const zMid = (zNear + zFar) / 2;
  const group = new THREE.Group();

  // Back panel (vertical, spans the mouth width).
  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(width, postHeight),
    makeNetMaterial()
  );
  back.position.set(backX, postHeight / 2, zMid);
  back.rotation.y = Math.PI / 2;
  group.add(back);

  // Side panels.
  for (const zc of [zNear, zFar]) {
    const side = new THREE.Mesh(
      new THREE.PlaneGeometry(depth, postHeight),
      makeNetMaterial()
    );
    side.position.set((lineX + backX) / 2, postHeight / 2, zc);
    group.add(side);
  }

  // Roof panel.
  const roof = new THREE.Mesh(
    new THREE.PlaneGeometry(depth, width),
    makeNetMaterial()
  );
  roof.position.set((lineX + backX) / 2, postHeight, zMid);
  roof.rotation.x = Math.PI / 2;
  group.add(roof);

  group.traverse((o) => {
    o.userData["skipBlockPickAndBounds"] = true;
    o.raycast = () => {};
  });
  return group;
}

/** Tiered stadium stands ringing the pitch (cosmetic; players cannot leave the pitch). */
export function buildStadium(bounds: Bounds): THREE.Group {
  const group = new THREE.Group();
  const { tiers, tierH, tierW, gap } = STADIUM;
  const seatColors = [0x2f6fb0, 0x3a7fc0, 0xc94f4f, 0xe0b23a];
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  const lengthX = bounds.maxX - bounds.minX + 1;
  const lengthZ = bounds.maxZ - bounds.minZ + 1;

  const addMesh = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): void => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.userData["skipBlockPickAndBounds"] = true;
    mesh.raycast = () => {};
    group.add(mesh);
  };

  for (let tier = 0; tier < tiers; tier++) {
    const mat = new THREE.MeshStandardMaterial({
      color: seatColors[tier % seatColors.length]!,
      roughness: 0.85,
      metalness: 0,
    });
    const out = gap + tier * tierW;
    const y = 0.2 + tier * tierH;
    // North/south stands run along X (full width so they reach the corners).
    for (const sign of [1, -1]) {
      addMesh(
        new THREE.BoxGeometry(lengthX + out * 2, tierH, tierW),
        mat,
        cx,
        y,
        cz + sign * (lengthZ / 2 + out)
      );
    }
    // East/west stands run along Z.
    for (const sign of [1, -1]) {
      addMesh(
        new THREE.BoxGeometry(tierW, tierH, lengthZ + out * 2),
        mat,
        cx + sign * (lengthX / 2 + out),
        y,
        cz
      );
    }
    // Corner posts fill the outer notch where the side stands meet, so rotating the
    // camera never reveals a gap between adjacent stands.
    for (const sx of [1, -1]) {
      for (const sz of [1, -1]) {
        addMesh(
          new THREE.BoxGeometry(tierW, tierH, tierW),
          mat,
          cx + sx * (lengthX / 2 + out),
          y,
          cz + sz * (lengthZ / 2 + out)
        );
      }
    }
  }
  return group;
}

/**
 * Ground apron under and around the stadium. Fills the gap between the pitch edge and the
 * first stand tier (which would otherwise show the sky background) and extends well past the
 * stands so rotating/tilting the camera never reveals the background behind the ground.
 */
export function buildStadiumGround(bounds: Bounds): THREE.Mesh {
  const { tiers, tierW, gap } = STADIUM;
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  const lengthX = bounds.maxX - bounds.minX + 1;
  const lengthZ = bounds.maxZ - bounds.minZ + 1;
  const outMax = gap + (tiers - 1) * tierW + tierW / 2;
  const standHalf = Math.max(lengthX, lengthZ) / 2 + outMax;
  const size = (standHalf + 26) * 2;
  const geo = new THREE.PlaneGeometry(size, size);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x2c6b34,
    roughness: 0.98,
    metalness: 0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  // Just below the pitch surface (y=0.02) and the stand bases so it never z-fights.
  mesh.position.set(cx, -0.02, cz);
  mesh.userData["skipBlockPickAndBounds"] = true;
  mesh.raycast = () => {};
  return mesh;
}

// ---------------------------------------------------------------------------
// Cheering crowd (client-only). A ring of seated Nimiq-identicon spectators on
// the stands that bob idly, cheer in synchronized waves, throw up emoji, wave
// the champion's flag, and erupt on a goal.
// ---------------------------------------------------------------------------

const emojiTexCache = new Map<string, THREE.CanvasTexture>();

function makeEmojiTexture(emoji: string): THREE.CanvasTexture {
  const cached = emojiTexCache.get(emoji);
  if (cached) return cached;
  const s = 64;
  const canvas = document.createElement("canvas");
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext("2d")!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  const drawText = (): void => {
    ctx.clearRect(0, 0, s, s);
    ctx.font = "48px system-ui, 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(emoji, s / 2, s / 2 + 2);
    tex.needsUpdate = true;
  };
  const drawFlag = (img: HTMLImageElement): void => {
    ctx.clearRect(0, 0, s, s);
    const pad = 3;
    ctx.drawImage(img, pad, pad, s - pad * 2, s - pad * 2);
    tex.needsUpdate = true;
  };

  // Country flags become Twemoji images (Windows shows them as "AT" otherwise); other emoji
  // (cheer reactions) keep the system emoji font. Flag images load async, so redraw on ready.
  const code = codeFromFlagEmoji(emoji);
  if (code) {
    const ready = getFlagImageIfReady(code);
    if (ready) drawFlag(ready);
    else void loadFlagImage(code).then((img) => img && drawFlag(img));
  } else {
    drawText();
  }
  tex.needsUpdate = true;
  emojiTexCache.set(emoji, tex);
  return tex;
}

type Seat = {
  x: number;
  z: number;
  feetY: number;
  phase: number;
  /** wave ordering 0..1 along the stand so cheers ripple. */
  waveT: number;
  /** Continuous 0..1 position around the whole stadium ring, so a single la-ola crest can
   *  travel through all four stands as one loop (unlike per-stand {@link waveT}). */
  ringT: number;
  /** Which pitch half this seat sits on (west = "a", east = "b"); drives the 1v1 split. */
  side: "a" | "b";
  /** Flag emoji this seat currently waves, or null. Assigned by the set*Flags methods. */
  flag: string | null;
};

type EmoteBubble = {
  sprite: THREE.Sprite;
  mat: THREE.SpriteMaterial;
  vy: number;
  life: number;
  maxLife: number;
};

const CHEER_EMOJIS = ["\u26BD", "\uD83C\uDF89", "\u2764\uFE0F", "\uD83D\uDC4F", "\uD83D\uDE4C"];

// --- La Ola (Mexican wave) tuning ---------------------------------------------
/** Raising-hands emoji that marks the crest as it travels around the ring. */
const OLA_EMOJI = "\uD83D\uDE4C";
/** Half-width of the standing crest as a fraction of the ring (a narrow band). */
const OLA_HALF_WIDTH = 0.06;
/** Peak lift (world units) of a spectator at the very centre of the crest. */
const OLA_LIFT = 0.42;
/** Seconds for the crest to travel one full lap around the stadium. */
const OLA_LAP_SECONDS = 3;
/** Laps the crest makes before petering out (random within range, inclusive). */
const OLA_LAPS_MIN = 2;
const OLA_LAPS_MAX = 3;
/** Throttle (seconds) between bursts of hands-up emoji along the crest. */
const OLA_HAND_INTERVAL = 0.1;

/** Center height of a seated spectator identicon above its seat. */
const CROWD_AVATAR_CENTER_Y = 0.58;

/**
 * Animated spectator crowd for the soccer field. Cosmetic and client-only: each spectator is
 * a billboarded **Nimiq identicon** sprite seated on the stands (drawn from a small shared
 * pool of identicons), plus an emote-bubble pool, idle bob, ambient synchronized "wave"
 * cheers, and a big eruption via {@link cheer} (called on `goalScored`).
 */
export class WorldcupCrowd {
  readonly group = new THREE.Group();
  private readonly seats: Seat[] = [];
  private readonly avatars: { sprite: THREE.Sprite; seat: Seat }[] = [];
  /** Shared identicon materials (one per pooled face); reused across spectators. */
  private readonly poolMats: THREE.SpriteMaterial[] = [];
  private readonly poolTextures: THREE.CanvasTexture[] = [];
  private readonly bubbles: EmoteBubble[] = [];
  private readonly banners: {
    sprite: THREE.Sprite;
    mat: THREE.SpriteMaterial;
    seat: Seat;
    phase: number;
  }[] = [];
  private t = 0;
  private ambientTimer = 5;
  /** Decaying cheer envelopes: ambient wave + goal eruption. */
  private waveEnv = 0;
  private goalEnv = 0;
  /** La Ola: countdown to the next ambient Mexican wave. */
  private olaTimer = 18 + Math.random() * 30;
  /** True while a la-ola crest is sweeping the stands. */
  private olaActive = false;
  /** Crest start position on the ring (0..1) for the current la ola. */
  private olaStart = 0;
  /** Travel direction of the crest (+1 / -1), randomized per la ola. */
  private olaDir = 1;
  /** Laps completed so far this la ola (advances toward {@link olaLapsTotal}). */
  private olaProgress = 0;
  /** Laps this la ola will make before stopping. */
  private olaLapsTotal = OLA_LAPS_MIN;
  /** Throttle accumulator for spawning hands-up emoji along the crest. */
  private olaHandTimer = 0;
  /** True while at least one seat is waving a flag (gates the banner sway animation). */
  private hasAnyFlag = false;
  private disposed = false;

  constructor(bounds: Bounds) {
    this.seats = WorldcupCrowd.buildSeats(bounds);
    const n = this.seats.length;

    // A small pool of Nimiq identicons reused across the crowd (one shared material per
    // face) keeps draw setup cheap; identicons load async and fill in once ready.
    const poolSize = Math.min(40, Math.max(8, Math.floor(n / 5)));
    for (let i = 0; i < poolSize; i++) {
      const mat = new THREE.SpriteMaterial({
        color: 0xbfc7d4,
        transparent: true,
        depthWrite: false,
      });
      this.poolMats.push(mat);
      void loadIdenticonTexture(WorldcupCrowd.randomIdenticonSeed())
        .then((tex) => {
          if (this.disposed) {
            tex.dispose();
            return;
          }
          this.poolTextures.push(tex);
          mat.map = tex;
          mat.color.setHex(0xffffff);
          mat.needsUpdate = true;
        })
        .catch(() => {
          /* keep the neutral placeholder color on failure */
        });
    }

    for (let i = 0; i < n; i++) {
      const seat = this.seats[i]!;
      const sprite = new THREE.Sprite(this.poolMats[i % poolSize]!);
      // Uniform scale: identicons are square, so keep width == height (no skew).
      sprite.scale.set(0.9, 0.9, 1);
      sprite.position.set(seat.x, seat.feetY + CROWD_AVATAR_CENTER_Y, seat.z);
      sprite.raycast = () => {};
      sprite.userData["skipBlockPickAndBounds"] = true;
      this.group.add(sprite);
      this.avatars.push({ sprite, seat });
    }

    // Emote bubble pool.
    for (let i = 0; i < 22; i++) {
      const mat = new THREE.SpriteMaterial({
        transparent: true,
        depthWrite: false,
        opacity: 0,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(0.7, 0.7, 0.7);
      sprite.visible = false;
      sprite.raycast = () => {};
      sprite.userData["skipBlockPickAndBounds"] = true;
      this.group.add(sprite);
      this.bubbles.push({ sprite, mat, vy: 0, life: 0, maxLife: 1 });
    }

    // Held-up champion-flag banners, dotted around the stands (shown when a flag is set).
    const bannerCount = Math.min(14, Math.max(6, Math.floor(this.seats.length / 14)));
    for (let i = 0; i < bannerCount; i++) {
      const seat = this.seats[
        Math.floor((i / bannerCount) * this.seats.length)
      ]!;
      const mat = new THREE.SpriteMaterial({
        transparent: true,
        depthWrite: false,
        opacity: 0,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(0.95, 0.95, 0.95);
      sprite.visible = false;
      sprite.raycast = () => {};
      sprite.userData["skipBlockPickAndBounds"] = true;
      this.group.add(sprite);
      this.banners.push({ sprite, mat, seat, phase: Math.random() * Math.PI * 2 });
    }
  }

  /** Champion mode: every seat waves the same flag (ISO alpha-2 code, or null to clear). */
  setFlag(code: string | null): void {
    const emoji = code ? flagEmoji(code) : null;
    for (const s of this.seats) s.flag = emoji;
    this.refreshFlags();
  }

  /** 1v1 split: west-half seats wave side a's flag, east-half seats wave side b's. */
  setSideFlags(aCode: string | null, bCode: string | null): void {
    const aEmoji = aCode ? flagEmoji(aCode) : null;
    const bEmoji = bCode ? flagEmoji(bCode) : null;
    for (const s of this.seats) s.flag = s.side === "a" ? aEmoji : bEmoji;
    this.refreshFlags();
  }

  /**
   * Free Play: distribute the distinct country codes evenly across the stands. When no codes are
   * given (nobody on the field has picked a country), fall back to the champion flag.
   */
  setRosterFlags(codes: string[], fallbackCode: string | null): void {
    const clean = codes.filter((c) => /^[A-Z]{2}$/.test(c.trim().toUpperCase()));
    if (clean.length === 0) {
      this.setFlag(fallbackCode);
      return;
    }
    const emojis = clean.map((c) => flagEmoji(c));
    for (let i = 0; i < this.seats.length; i++) {
      this.seats[i]!.flag = emojis[i % emojis.length]!;
    }
    this.refreshFlags();
  }

  /** Re-skin the held-up banners from each banner-seat's assigned flag. */
  private refreshFlags(): void {
    this.hasAnyFlag = this.seats.some((s) => s.flag !== null);
    for (const b of this.banners) {
      const emoji = b.seat.flag;
      if (emoji) {
        b.mat.map = makeEmojiTexture(emoji);
        b.mat.needsUpdate = true;
        b.sprite.visible = true;
        b.mat.opacity = 0.95;
      } else {
        b.sprite.visible = false;
        b.mat.opacity = 0;
      }
    }
  }

  private static buildSeats(bounds: Bounds): Seat[] {
    const { tiers, tierH, tierW, gap } = STADIUM;
    const lengthX = bounds.maxX - bounds.minX + 1;
    const lengthZ = bounds.maxZ - bounds.minZ + 1;
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cz = (bounds.minZ + bounds.maxZ) / 2;
    const spacing = 1.35;
    const seats: Seat[] = [];
    for (let tier = 0; tier < tiers; tier++) {
      const out = gap + tier * tierW;
      const feetY = 0.2 + tier * tierH + tierH / 2;
      // North / south stands (run along X).
      const countX = Math.floor(lengthX / spacing);
      for (const sign of [1, -1]) {
        const z = cz + sign * (lengthZ / 2 + out);
        for (let i = 0; i < countX; i++) {
          const x =
            bounds.minX + 0.5 + (i + 0.5) * (lengthX / countX) +
            (Math.random() - 0.5) * 0.25;
          seats.push({
            x,
            z,
            feetY,
            phase: Math.random() * Math.PI * 2,
            waveT: (x - bounds.minX) / lengthX,
            ringT: WorldcupCrowd.ringPos(x, z, cx, cz),
            side: x < cx ? "a" : "b",
            flag: null,
          });
        }
      }
      // East / west stands (run along Z).
      const countZ = Math.floor(lengthZ / spacing);
      for (const sign of [1, -1]) {
        const x = cx + sign * (lengthX / 2 + out);
        for (let i = 0; i < countZ; i++) {
          const z =
            bounds.minZ + 0.5 + (i + 0.5) * (lengthZ / countZ) +
            (Math.random() - 0.5) * 0.25;
          seats.push({
            x,
            z,
            feetY,
            phase: Math.random() * Math.PI * 2,
            waveT: (z - bounds.minZ) / lengthZ,
            ringT: WorldcupCrowd.ringPos(x, z, cx, cz),
            side: x < cx ? "a" : "b",
            flag: null,
          });
        }
      }
    }
    return seats;
  }

  /** Continuous 0..1 angular position of a seat around the stadium ring (atan2 about the
   *  pitch centre). Good enough as a loop parameter for the la-ola crest even though the
   *  stands are rectangular rather than circular. */
  private static ringPos(x: number, z: number, cx: number, cz: number): number {
    return (Math.atan2(z - cz, x - cx) / (Math.PI * 2) + 1) % 1;
  }

  /** Shortest distance between two 0..1 ring positions, accounting for wraparound. */
  private static ringDist(a: number, b: number): number {
    const d = Math.abs(a - b);
    return Math.min(d, 1 - d);
  }

  /** A varied, non-wallet seed string so each pooled identicon looks distinct. */
  private static randomIdenticonSeed(): string {
    return `NQ${Math.floor(Math.random() * 1e12).toString(36).toUpperCase()}`;
  }

  /** Trigger a synchronized celebration. intensity ~1 = goal eruption. */
  cheer(intensity = 1): void {
    this.goalEnv = Math.max(this.goalEnv, Math.min(1.2, intensity));
    // A goal is the bigger moment: abandon any in-progress la ola so the whole crowd
    // can erupt together, and hold the next one off until things calm down.
    if (this.olaActive) {
      this.olaActive = false;
      this.scheduleNextOla();
    }
    const count = Math.round(8 + intensity * 10);
    this.spawnBubbles(count, intensity >= 1);
  }

  /** Begin a Mexican wave: a single hands-up crest that loops the stadium a few times. */
  private startOla(): void {
    this.olaActive = true;
    this.olaStart = Math.random();
    this.olaDir = Math.random() < 0.5 ? 1 : -1;
    this.olaProgress = 0;
    this.olaLapsTotal =
      OLA_LAPS_MIN + Math.floor(Math.random() * (OLA_LAPS_MAX - OLA_LAPS_MIN + 1));
    this.olaHandTimer = 0;
  }

  /** Arm the slow ambient timer for the next la ola. */
  private scheduleNextOla(): void {
    this.olaTimer = 45 + Math.random() * 45;
  }

  /** Pop a couple of hands-up emoji above seats currently inside the crest band. */
  private spawnOlaHands(crest: number): void {
    const candidates: Seat[] = [];
    for (const s of this.seats) {
      if (WorldcupCrowd.ringDist(s.ringT, crest) < OLA_HALF_WIDTH) candidates.push(s);
    }
    if (candidates.length === 0) return;
    let popped = 0;
    for (const b of this.bubbles) {
      if (popped >= 2) break;
      if (b.life > 0) continue;
      const seat = candidates[(Math.random() * candidates.length) | 0]!;
      b.mat.map = makeEmojiTexture(OLA_EMOJI);
      b.mat.needsUpdate = true;
      b.sprite.position.set(
        seat.x + (Math.random() - 0.5) * 0.3,
        seat.feetY + 0.95,
        seat.z
      );
      b.maxLife = 0.9 + Math.random() * 0.4;
      b.life = b.maxLife;
      b.vy = 0.7 + Math.random() * 0.4;
      b.sprite.visible = true;
      b.mat.opacity = 1;
      popped += 1;
    }
  }

  private spawnBubbles(count: number, goal: boolean): void {
    let spawned = 0;
    for (const b of this.bubbles) {
      if (spawned >= count) break;
      if (b.life > 0) continue;
      const seat = this.seats[(Math.random() * this.seats.length) | 0]!;
      let emoji: string;
      if (seat.flag && Math.random() < (goal ? 0.5 : 0.35)) {
        // Wave this seat's allegiance flag (its side in a 1v1, or a field player's country).
        emoji = seat.flag;
      } else if (goal) {
        emoji = CHEER_EMOJIS[(Math.random() * 3) | 0]!; // ball / party / heart
      } else {
        emoji = CHEER_EMOJIS[3 + ((Math.random() * 2) | 0)]!; // clap / raise
      }
      b.mat.map = makeEmojiTexture(emoji);
      b.mat.needsUpdate = true;
      b.sprite.position.set(
        seat.x + (Math.random() - 0.5) * 0.3,
        seat.feetY + 0.95,
        seat.z
      );
      b.maxLife = 1.1 + Math.random() * 0.7;
      b.life = b.maxLife;
      b.vy = 0.9 + Math.random() * 0.5;
      b.sprite.visible = true;
      b.mat.opacity = 1;
      spawned += 1;
    }
  }

  /**
   * Advance the la-ola state machine. Returns the current crest position on the ring (or
   * null when no wave is running) and a 0..1 fade that eases the crest in at the start and
   * out as it peters out on the final lap.
   */
  private updateOla(dt: number): { crest: number | null; fade: number } {
    // Start a new wave only during calm, on the slow ambient timer.
    if (!this.olaActive) {
      this.olaTimer -= dt;
      if (this.olaTimer <= 0 && this.goalEnv <= 0.01) {
        this.startOla();
      } else {
        return { crest: null, fade: 0 };
      }
    }

    this.olaProgress += dt / OLA_LAP_SECONDS;
    if (this.olaProgress >= this.olaLapsTotal) {
      this.olaActive = false;
      this.scheduleNextOla();
      return { crest: null, fade: 0 };
    }

    const raw = this.olaStart + this.olaDir * this.olaProgress;
    const crest = ((raw % 1) + 1) % 1;
    const remaining = this.olaLapsTotal - this.olaProgress;
    const fade = Math.max(0, Math.min(1, this.olaProgress / 0.4, remaining / 0.6));

    this.olaHandTimer -= dt;
    if (this.olaHandTimer <= 0) {
      this.olaHandTimer = OLA_HAND_INTERVAL;
      this.spawnOlaHands(crest);
    }
    return { crest, fade };
  }

  /** Advance animation. Returns true while anything is moving (keeps the field rendering). */
  update(dt: number): boolean {
    this.t += dt;
    // Decay cheer envelopes.
    this.goalEnv = Math.max(0, this.goalEnv - dt * 0.5);
    this.waveEnv = Math.max(0, this.waveEnv - dt * 0.6);
    // Ambient synchronized cheer every few seconds.
    this.ambientTimer -= dt;
    if (this.ambientTimer <= 0) {
      this.ambientTimer = 7 + Math.random() * 6;
      this.waveEnv = 0.7;
      this.spawnBubbles(4, false);
    }

    // La Ola: a rarer Mexican wave that fires on a slow timer during calm. A single crest
    // of standing, hands-up spectators travels around the whole ring a couple of laps.
    const { crest: olaCrest, fade: olaFade } = this.updateOla(dt);

    const env = Math.max(this.waveEnv, this.goalEnv);
    for (const { sprite, seat } of this.avatars) {
      const bob = Math.sin(this.t * 1.8 + seat.phase) * 0.03;
      let jump = 0;
      if (this.goalEnv > 0.01) {
        // Goal: everyone jumps in sync.
        jump =
          this.goalEnv * 0.5 * Math.abs(Math.sin(this.t * 8 + seat.phase * 0.2));
      } else if (this.waveEnv > 0.01) {
        // Ambient: a wave ripples around the stands.
        const phase = this.t * 3 - seat.waveT * Math.PI * 4;
        jump = this.waveEnv * 0.32 * Math.max(0, Math.sin(phase));
      }
      let olaLift = 0;
      if (olaCrest !== null) {
        const d = WorldcupCrowd.ringDist(seat.ringT, olaCrest);
        if (d < OLA_HALF_WIDTH) {
          const k = 1 - d / OLA_HALF_WIDTH; // 1 at crest centre -> 0 at the band edge
          olaLift = OLA_LIFT * olaFade * Math.sin((k * Math.PI) / 2);
        }
      }
      sprite.position.y =
        seat.feetY + CROWD_AVATAR_CENTER_Y + bob + jump + olaLift;
    }

    // Wave the held-up banners (held above the head, gently swaying).
    if (this.hasAnyFlag) {
      for (const ban of this.banners) {
        if (!ban.sprite.visible) continue;
        const sway = Math.sin(this.t * 3 + ban.phase) * 0.12;
        const lift = (0.04 + env * 0.18) * Math.abs(Math.sin(this.t * 4 + ban.phase));
        ban.sprite.position.set(
          ban.seat.x + sway,
          ban.seat.feetY + 1.15 + lift,
          ban.seat.z
        );
      }
    }

    let bubblesActive = false;
    for (const b of this.bubbles) {
      if (b.life <= 0) continue;
      bubblesActive = true;
      b.life -= dt;
      b.sprite.position.y += b.vy * dt;
      b.mat.opacity = Math.max(0, b.life / b.maxLife);
      if (b.life <= 0) {
        b.sprite.visible = false;
        b.mat.opacity = 0;
      }
    }
    void env;
    void bubblesActive;
    // The crowd bobs continuously, so keep the field room rendering while it exists.
    return true;
  }

  dispose(): void {
    this.disposed = true;
    for (const m of this.poolMats) m.dispose();
    for (const t of this.poolTextures) t.dispose();
    for (const b of this.bubbles) b.mat.dispose();
    for (const b of this.banners) b.mat.dispose();
    this.group.clear();
  }
}
