import * as THREE from "three";
import type { PlayerState } from "../types.js";
import {
  auraColorForPreset,
  isGroundLingerTrail,
  trailPresetDef,
  type TrailPresetDef,
} from "./trailPresets.js";

const SKIP = "skipBlockPickAndBounds";
const AURA_KEY = "cosmeticAuraMesh";
const AURA_PRESET_KEY = "cosmeticAuraPreset";
const TRAIL_PRESET_KEY = "cosmeticTrailPreset";
const TRAIL_PUFFS_KEY = "cosmeticTrailPuffs";
const TRAIL_LAST_SPAWN_KEY = "cosmeticTrailLastSpawnAt";
const TRAIL_GROUND_LAST_POS_KEY = "cosmeticTrailGroundLastPos";

const NAMEPLATE_COLORS: Record<string, string> = {};

/** How long a walked-on floor mark stays visible (ms). */
const TRAIL_GROUND_TTL_MS = 500;
/** Tight spacing so soft blobs overlap heavily into one continuous smear (no gaps between discs). */
const TRAIL_GROUND_STEP = 0.22;
const TRAIL_GROUND_MAX_PER_TICK = 16;
const TRAIL_GROUND_SIZE = 1.7;
const TRAIL_GROUND_Y = 0.05;
/** Below identicon sprites (renderOrder 2 in Game.ts) so avatars paint on top; still depth-tests against opaque blocks. */
const TRAIL_RENDER_ORDER = 1;
/** Gallery mannequins emit ground marks faster so the ribbon reads while pacing. */
const TRAIL_GALLERY_SPAWN_INTERVAL_MS = 70;

export type CosmeticTrailPuff = {
  mesh: THREE.Object3D;
  materials: THREE.Material[];
  bornAt: number;
  ttl: number;
  baseOpacity: number;
  kind: "smoke" | "sparkle" | "ground";
};

export type PersistentDeployableFx = {
  root: THREE.Group;
  dispose: () => void;
};

const MAT_BASE_OPACITY_KEY = "trailBaseOpacity";

let sparkleTrailTexture: THREE.CanvasTexture | null = null;
let smokeTrailTexture: THREE.CanvasTexture | null = null;
let softSplatTexture: THREE.CanvasTexture | null = null;

function markTrailMaterial<M extends THREE.Material>(mat: M, baseOpacity: number): M {
  mat.userData[MAT_BASE_OPACITY_KEY] = baseOpacity;
  return mat;
}

function softSplatMap(): THREE.CanvasTexture {
  if (softSplatTexture) return softSplatTexture;
  // A smooth Gaussian blob (no plateau, no hard edge) so individual marks have no visible
  // circle outline. Overlapping blobs add up into a continuous ribbon, and because alpha
  // already approaches 0 at the rim, the fade-out reads as a soft smear instead of a row of
  // discrete discs.
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const radius = size / 2;
  // sigma chosen so alpha is ~0 by the rim, giving a featheredged blob.
  const sigma = 0.36;
  const twoSigmaSq = 2 * sigma * sigma;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x - cx) / radius;
      const ny = (y - cy) / radius;
      const r = Math.sqrt(nx * nx + ny * ny);
      // Gaussian core, then a smooth taper to exactly 0 at the rim so tiling can't leave a seam.
      let a = Math.exp(-(r * r) / twoSigmaSq);
      const edge = 1 - Math.min(1, r);
      a *= edge * edge;
      const i = (y * size + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 255;
      img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(Math.max(0, Math.min(1, a)) * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  softSplatTexture = new THREE.CanvasTexture(canvas);
  softSplatTexture.needsUpdate = true;
  return softSplatTexture;
}

function smokeTrailMap(): THREE.CanvasTexture {
  if (smokeTrailTexture) return smokeTrailTexture;
  const size = 48;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const cx = size / 2;
  const cy = size / 2;
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.48);
  gradient.addColorStop(0, "rgba(220, 220, 220, 0.75)");
  gradient.addColorStop(0.45, "rgba(180, 180, 180, 0.35)");
  gradient.addColorStop(1, "rgba(140, 140, 140, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  smokeTrailTexture = new THREE.CanvasTexture(canvas);
  smokeTrailTexture.needsUpdate = true;
  return smokeTrailTexture;
}

function sparkleTrailMap(): THREE.CanvasTexture {
  if (sparkleTrailTexture) return sparkleTrailTexture;
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const cx = size / 2;
  const cy = size / 2;
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
  gradient.addColorStop(0, "rgba(255, 255, 240, 1)");
  gradient.addColorStop(0.35, "rgba(255, 230, 140, 0.85)");
  gradient.addColorStop(1, "rgba(255, 200, 80, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  sparkleTrailTexture = new THREE.CanvasTexture(canvas);
  sparkleTrailTexture.needsUpdate = true;
  return sparkleTrailTexture;
}

function trailVisualForPreset(presetId: string): TrailPresetDef | null {
  return trailPresetDef(presetId);
}

function spawnGroundLingerMark(
  scene: THREE.Scene,
  presetId: string,
  x: number,
  y: number,
  z: number,
  puffList: CosmeticTrailPuff[],
  now: number
): void {
  const visual = trailVisualForPreset(presetId);
  if (!visual) return;

  const splat = softSplatMap();
  const group = new THREE.Group();
  group.userData[SKIP] = true;
  group.position.set(x, y + TRAIL_GROUND_Y, z);
  group.rotation.y = Math.random() * Math.PI;

  const materials: THREE.Material[] = [];
  const coreGeo = new THREE.PlaneGeometry(TRAIL_GROUND_SIZE, TRAIL_GROUND_SIZE);
  const coreMat = markTrailMaterial(
    new THREE.MeshBasicMaterial({
      map: splat,
      color: visual.color,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
      toneMapped: false,
    }),
    0.42
  );
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.rotation.x = -Math.PI / 2;
  core.renderOrder = TRAIL_RENDER_ORDER;
  core.userData[SKIP] = true;
  group.add(core);
  materials.push(coreMat);

  if (visual.additive) {
    const glowGeo = new THREE.PlaneGeometry(
      TRAIL_GROUND_SIZE * 1.25,
      TRAIL_GROUND_SIZE * 1.25
    );
    const glowMat = markTrailMaterial(
      new THREE.MeshBasicMaterial({
        map: splat,
        color: visual.color,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
        depthTest: true,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
      0.16
    );
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.006;
    glow.renderOrder = TRAIL_RENDER_ORDER;
    glow.userData[SKIP] = true;
    group.add(glow);
    materials.push(glowMat);
  }

  scene.add(group);
  puffList.push({
    mesh: group,
    materials,
    bornAt: now,
    ttl: TRAIL_GROUND_TTL_MS,
    baseOpacity: 0.42,
    kind: "ground",
  });
}

function spawnSmokePuff(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  puffList: CosmeticTrailPuff[],
  now: number
): void {
  const count = 2;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 0.16;
    positions[i * 3 + 1] = 0.1 + Math.random() * 0.1;
    positions[i * 3 + 2] = -0.24 - Math.random() * 0.18;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    map: smokeTrailMap(),
    color: 0xcccccc,
    size: 0.28,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending,
    toneMapped: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.position.set(x, y, z);
  pts.renderOrder = TRAIL_RENDER_ORDER;
  pts.userData[SKIP] = true;
  scene.add(pts);
  puffList.push({
    mesh: pts,
    materials: [mat],
    bornAt: now,
    ttl: 980,
    baseOpacity: 0.55,
    kind: "smoke",
  });
}

function spawnSparklePuff(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  puffList: CosmeticTrailPuff[],
  now: number
): void {
  const count = 3;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 0.18;
    positions[i * 3 + 1] = 0.08 + Math.random() * 0.12;
    positions[i * 3 + 2] = -0.22 - Math.random() * 0.2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    map: sparkleTrailMap(),
    color: 0xffffee,
    size: 0.16,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.position.set(x, y, z);
  pts.renderOrder = TRAIL_RENDER_ORDER;
  pts.userData[SKIP] = true;
  scene.add(pts);
  puffList.push({
    mesh: pts,
    materials: [mat],
    bornAt: now,
    ttl: 680,
    baseOpacity: 0.92,
    kind: "sparkle",
  });
}

export function nameplateColorForPreset(presetId: string | null | undefined): string | null {
  if (!presetId) return null;
  return NAMEPLATE_COLORS[presetId] ?? null;
}

export function chatBubbleClassForPreset(
  presetId: string | null | undefined
): string | null {
  if (!presetId) return null;
  return null;
}

function trailPuffs(group: THREE.Group): CosmeticTrailPuff[] {
  if (!group.userData[TRAIL_PUFFS_KEY]) {
    group.userData[TRAIL_PUFFS_KEY] = [] as CosmeticTrailPuff[];
  }
  return group.userData[TRAIL_PUFFS_KEY] as CosmeticTrailPuff[];
}

export function disposeCosmeticTrailPuffs(group: THREE.Group): void {
  const puffs = group.userData[TRAIL_PUFFS_KEY] as CosmeticTrailPuff[] | undefined;
  if (!puffs?.length) return;
  for (const puff of puffs) {
    puff.mesh.removeFromParent();
    puff.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Points) {
        child.geometry.dispose();
      }
    });
    for (const mat of puff.materials) mat.dispose();
  }
  puffs.length = 0;
  delete group.userData[TRAIL_LAST_SPAWN_KEY];
  delete group.userData[TRAIL_GROUND_LAST_POS_KEY];
}

function spawnHeadTrailPuff(
  scene: THREE.Scene,
  presetId: string,
  x: number,
  y: number,
  z: number,
  puffList: CosmeticTrailPuff[]
): void {
  const now = performance.now();
  if (presetId === "trail-smoke") {
    spawnSmokePuff(scene, x, y, z, puffList, now);
    return;
  }
  if (presetId === "trail-sparkle") {
    spawnSparklePuff(scene, x, y, z, puffList, now);
  }
}

function trailSpawnIntervalMs(presetId: string): number {
  if (isGroundLingerTrail(presetId)) return 90;
  if (presetId === "trail-smoke") return 140;
  return 110;
}

function layGroundRibbon(
  scene: THREE.Scene,
  group: THREE.Group,
  presetId: string,
  x: number,
  y: number,
  z: number,
  puffList: CosmeticTrailPuff[],
  now: number
): void {
  const gp = group.userData[TRAIL_GROUND_LAST_POS_KEY] as
    | { x: number; z: number }
    | undefined;
  if (!gp) {
    group.userData[TRAIL_GROUND_LAST_POS_KEY] = { x, z };
    spawnGroundLingerMark(scene, presetId, x, y, z, puffList, now);
    return;
  }
  let dx = x - gp.x;
  let dz = z - gp.z;
  let dist = Math.hypot(dx, dz);
  if (dist < TRAIL_GROUND_STEP) return;
  const ux = dx / dist;
  const uz = dz / dist;
  let cx = gp.x;
  let cz = gp.z;
  let placed = 0;
  while (dist >= TRAIL_GROUND_STEP && placed < TRAIL_GROUND_MAX_PER_TICK) {
    cx += ux * TRAIL_GROUND_STEP;
    cz += uz * TRAIL_GROUND_STEP;
    dist -= TRAIL_GROUND_STEP;
    placed++;
    spawnGroundLingerMark(scene, presetId, cx, y, cz, puffList, now);
  }
  group.userData[TRAIL_GROUND_LAST_POS_KEY] = { x: cx, z: cz };
}

export function updateCosmeticTrailPuffs(puffList: CosmeticTrailPuff[], now: number): boolean {
  if (puffList.length === 0) return false;
  let active = false;
  for (let i = puffList.length - 1; i >= 0; i--) {
    const puff = puffList[i]!;
    const t = (now - puff.bornAt) / puff.ttl;
    if (t >= 1) {
      puff.mesh.removeFromParent();
      puff.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Points) {
          child.geometry.dispose();
        }
      });
      for (const mat of puff.materials) mat.dispose();
      puffList.splice(i, 1);
      continue;
    }
    const fade =
      puff.kind === "ground"
        ? t < 0.55
          ? 1
          : 1 - (t - 0.55) / 0.45
        : 1 - t;
    const twinkle =
      puff.kind === "sparkle" ? 0.75 + 0.25 * Math.sin(t * Math.PI * 4) : 1;
    for (const mat of puff.materials) {
      const base = (mat.userData[MAT_BASE_OPACITY_KEY] as number) ?? puff.baseOpacity;
      mat.opacity = base * fade * twinkle;
    }
    if (puff.kind === "smoke") {
      puff.mesh.position.y += 0.016;
      puff.mesh.scale.setScalar(1 + 0.65 * t);
    } else if (puff.kind === "ground") {
      puff.mesh.scale.setScalar(1 + 0.12 * t);
    } else {
      puff.mesh.scale.setScalar(1 - 0.25 * t);
    }
    active = true;
  }
  return active;
}

export function cosmeticTrailPresetForGroup(group: THREE.Group): string | null {
  return (group.userData[TRAIL_PRESET_KEY] as string | null | undefined) ?? null;
}

export function updateCosmeticTrailPuffsForGroup(group: THREE.Group, now: number): boolean {
  return updateCosmeticTrailPuffs(trailPuffs(group), now);
}

function avatarTrailMoving(group: THREE.Group, x: number, z: number): boolean {
  const key = "cosmeticTrailLastSample";
  const prev = group.userData[key] as { x: number; z: number } | undefined;
  group.userData[key] = { x, z };
  if (!prev) return false;
  return Math.hypot(x - prev.x, z - prev.z) > 0.008;
}

export function tickCosmeticTrailForAvatar(
  scene: THREE.Scene,
  group: THREE.Group,
  x: number,
  y: number,
  z: number,
  now: number
): void {
  const presetId = cosmeticTrailPresetForGroup(group);
  if (!presetId) return;
  tickCosmeticTrailSpawn(
    scene,
    group,
    presetId,
    x,
    y,
    z,
    avatarTrailMoving(group, x, z),
    now
  );
}

export function tickCosmeticTrailSpawn(
  scene: THREE.Scene,
  group: THREE.Group,
  presetId: string | null | undefined,
  x: number,
  y: number,
  z: number,
  moving: boolean,
  now: number,
  opts?: { forceSpawn?: boolean; spawnIntervalMs?: number }
): void {
  if (!presetId) return;
  const alwaysSpawn = opts?.forceSpawn === true;
  if (!alwaysSpawn && !moving) return;

  const puffs = trailPuffs(group);
  const linger = isGroundLingerTrail(presetId);

  if (!linger) {
    const last = (group.userData[TRAIL_LAST_SPAWN_KEY] as number | undefined) ?? 0;
    const interval =
      opts?.spawnIntervalMs ??
      (alwaysSpawn ? TRAIL_GALLERY_SPAWN_INTERVAL_MS : trailSpawnIntervalMs(presetId));
    if (now - last >= interval) {
      group.userData[TRAIL_LAST_SPAWN_KEY] = now;
      spawnHeadTrailPuff(scene, presetId, x, y + 0.35, z, puffs);
    }
  }

  layGroundRibbon(scene, group, presetId, x, y, z, puffs, now);
}

const AURA_RIPPLE_COUNT = 3;
const AURA_RIPPLE_PERIOD_MS = 2200;
const AURA_RIPPLE_MIN_RADIUS = 0.4;
const AURA_RIPPLE_MAX_RADIUS = 1.5;
const AURA_SPARK_COUNT = 12;
const AURA_SPARK_RADIUS = 0.66;

type AuraSparkSeed = { ang: number; rad: number; ySeed: number; speed: number };

function disposeAura(aura: THREE.Object3D): void {
  aura.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Points) {
      child.geometry.dispose();
      const mat = child.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat.dispose();
    }
  });
  aura.removeFromParent();
}

/**
 * Animated ground aura: a pulsing glow disc, expanding sonar ripples, and a ring of orbiting
 * sparks. All elements are floor-radial or camera-facing points, so they read correctly at any
 * of the four locked camera corners. Built once per preset; {@link updateCosmeticAuraForGroup}
 * drives the motion each frame.
 */
function ensureAura(group: THREE.Group, presetId: string | null | undefined): void {
  const existing = group.getObjectByName(AURA_KEY) as THREE.Group | undefined;
  const color = auraColorForPreset(presetId);
  if (!presetId || color === null) {
    if (existing) disposeAura(existing);
    delete group.userData[AURA_PRESET_KEY];
    return;
  }
  if (existing && group.userData[AURA_PRESET_KEY] === presetId) return;
  if (existing) disposeAura(existing);

  const aura = new THREE.Group();
  aura.name = AURA_KEY;
  aura.position.y = 0.04;
  aura.userData[SKIP] = true;
  group.userData[AURA_PRESET_KEY] = presetId;

  const splat = softSplatMap();

  const glowMat = markTrailMaterial(
    new THREE.MeshBasicMaterial({
      map: splat,
      color,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
    0.4
  );
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), glowMat);
  glow.name = "auraGlow";
  glow.rotation.x = -Math.PI / 2;
  glow.userData[SKIP] = true;
  aura.add(glow);

  const ripples: THREE.Mesh[] = [];
  for (let i = 0; i < AURA_RIPPLE_COUNT; i++) {
    const ringMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    // Unit ring (inner 0.86, outer 1.0); scaled to the live radius each frame.
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 48), ringMat);
    ring.name = "auraRipple";
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.005;
    ring.userData[SKIP] = true;
    ring.userData.rippleOffset = i / AURA_RIPPLE_COUNT;
    aura.add(ring);
    ripples.push(ring);
  }

  const positions = new Float32Array(AURA_SPARK_COUNT * 3);
  const seeds: AuraSparkSeed[] = [];
  for (let i = 0; i < AURA_SPARK_COUNT; i++) {
    const ang = (i / AURA_SPARK_COUNT) * Math.PI * 2;
    const rad = AURA_SPARK_RADIUS * (0.85 + Math.random() * 0.3);
    seeds.push({
      ang,
      rad,
      ySeed: Math.random() * Math.PI * 2,
      speed: 0.8 + Math.random() * 0.5,
    });
    positions[i * 3] = Math.cos(ang) * rad;
    positions[i * 3 + 1] = 0.3;
    positions[i * 3 + 2] = Math.sin(ang) * rad;
  }
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const sparkMat = new THREE.PointsMaterial({
    map: sparkleTrailMap(),
    color,
    size: 0.22,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  sparks.name = "auraSparks";
  sparks.userData[SKIP] = true;
  sparks.userData.sparkSeeds = seeds;
  aura.add(sparks);

  group.add(aura);
}

/** Drives the aura's pulse, sonar ripples, and orbiting sparks. Returns true if it animated. */
export function updateCosmeticAuraForGroup(group: THREE.Group, now: number): boolean {
  const aura = group.getObjectByName(AURA_KEY) as THREE.Group | undefined;
  if (!aura) return false;
  const t = now * 0.001;

  const glow = aura.getObjectByName("auraGlow") as THREE.Mesh | undefined;
  if (glow) {
    const mat = glow.material as THREE.MeshBasicMaterial;
    const base = (mat.userData[MAT_BASE_OPACITY_KEY] as number) ?? 0.4;
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.1);
    mat.opacity = base * (0.65 + 0.35 * pulse);
    const s = 1 + 0.07 * Math.sin(t * 2.1);
    glow.scale.set(s, s, 1);
  }

  for (const child of aura.children) {
    const off = child.userData.rippleOffset as number | undefined;
    if (off === undefined) continue;
    const ring = child as THREE.Mesh;
    const p = ((now / AURA_RIPPLE_PERIOD_MS + off) % 1 + 1) % 1;
    const radius =
      AURA_RIPPLE_MIN_RADIUS + p * (AURA_RIPPLE_MAX_RADIUS - AURA_RIPPLE_MIN_RADIUS);
    ring.scale.set(radius, radius, 1);
    // Fade in quickly, then out — so each ripple blooms and dissolves like sonar.
    const fade = Math.sin(p * Math.PI);
    (ring.material as THREE.MeshBasicMaterial).opacity = 0.55 * fade;
  }

  const sparks = aura.getObjectByName("auraSparks") as THREE.Points | undefined;
  if (sparks) {
    const seeds = sparks.userData.sparkSeeds as AuraSparkSeed[] | undefined;
    const attr = sparks.geometry.getAttribute("position") as THREE.BufferAttribute;
    if (seeds) {
      for (let i = 0; i < seeds.length; i++) {
        const s = seeds[i]!;
        const a = s.ang + t * s.speed;
        const y = 0.28 + 0.16 * Math.sin(t * 2.2 + s.ySeed);
        attr.setXYZ(i, Math.cos(a) * s.rad, y, Math.sin(a) * s.rad);
      }
      attr.needsUpdate = true;
    }
  }

  return true;
}

function ensureTrailPreset(group: THREE.Group, presetId: string | null | undefined): void {
  const prev = group.userData[TRAIL_PRESET_KEY] as string | null | undefined;
  if (prev === presetId) return;
  group.userData[TRAIL_PRESET_KEY] = presetId ?? null;
  if (!presetId) disposeCosmeticTrailPuffs(group);
}

export function syncCosmeticLoadoutVfx(
  group: THREE.Group,
  player: PlayerState,
  _movedRecently: boolean
): void {
  group.userData.cosmeticChatBubble = player.cosmeticChatBubble ?? null;
  ensureAura(group, player.cosmeticAura);
  ensureTrailPreset(group, player.cosmeticTrail);
}

export function spawnDeployableVfx(
  scene: THREE.Scene,
  presetId: string,
  x: number,
  z: number,
  expiresAt: number
): void {
  const color = presetId === "deployable-confetti-burst" ? 0xff66aa : 0xffffff;
  const geo = new THREE.RingGeometry(0.2, 0.9, 24);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, 0.06, z);
  mesh.userData[SKIP] = true;
  scene.add(mesh);
  const ttl = Math.max(500, expiresAt - Date.now());
  window.setTimeout(() => {
    scene.remove(mesh);
    geo.dispose();
    mat.dispose();
  }, ttl);
}

export function attachPersistentDeployableVfx(
  scene: THREE.Scene,
  presetId: string,
  x: number,
  z: number
): PersistentDeployableFx {
  const color = presetId === "deployable-confetti-burst" ? 0xff66aa : 0xffffff;
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  root.userData[SKIP] = true;

  const geo = new THREE.RingGeometry(0.2, 0.9, 24);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.06;
  mesh.userData[SKIP] = true;
  root.add(mesh);
  scene.add(root);

  return {
    root,
    dispose: () => {
      root.removeFromParent();
      geo.dispose();
      mat.dispose();
    },
  };
}

/**
 * Per-frame motion for the Wardrobe Preview avatar (profile + editable wardrobe).
 *
 * The avatar is intentionally **static** — it does not drift or move. The trail is shown as a
 * fixed, persistent stub laid once via {@link buildStaticPreviewTrail}, so all that animates
 * here is the aura (a stationary effect). `phaseRad` is retained for signature stability but is
 * no longer used for positional motion.
 */
export function tickCosmeticPreviewMotion(
  _scene: THREE.Scene,
  group: THREE.Group,
  now: number,
  _phaseRad: number
): boolean {
  group.position.x = 0;
  group.position.z = 0;
  return updateCosmeticAuraForGroup(group, now);
}

const PREVIEW_TRAIL_STUB_NAME = "cosmeticPreviewTrailStub";
/** World length of the persistent preview trail stub (~2 tiles). */
const PREVIEW_TRAIL_LENGTH = 2;
const PREVIEW_TRAIL_STEP = 0.2;
/**
 * Base yaw at orbit yaw 0. The stub's marks lie along local −Z; with this camera (corner view
 * from +X/+Y/+Z) a base yaw of 0 sends them toward world −Z, which projects to screen
 * north-east. {@link orientStaticPreviewTrail} adds the live camera yaw so it stays north-east
 * as the preview orbits.
 */
const PREVIEW_TRAIL_BASE_YAW = 0;

function disposePreviewTrailStub(group: THREE.Group): void {
  const existing = group.getObjectByName(PREVIEW_TRAIL_STUB_NAME);
  if (!existing) return;
  existing.removeFromParent();
  existing.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      const mat = child.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat.dispose();
    }
  });
}

/**
 * Lays a fixed, **non-fading** trail stub behind the static preview avatar. Reuses the in-game
 * soft ground-mark look (a colored core + optional additive glow) so the profile sample matches
 * what the trail looks like while walking. The stub tapers along its length (full at the feet,
 * fading toward the tail) — a permanent spatial gradient, not a time-based fade, so it never
 * disappears. Rebuild whenever the equipped trail changes; pass a null/uncolored preset to clear.
 */
export function buildStaticPreviewTrail(
  group: THREE.Group,
  presetId: string | null | undefined
): void {
  disposePreviewTrailStub(group);
  const visual = presetId ? trailVisualForPreset(presetId) : null;
  if (!presetId || !visual) return;

  const stub = new THREE.Group();
  stub.name = PREVIEW_TRAIL_STUB_NAME;
  stub.userData[SKIP] = true;
  const splat = softSplatMap();
  const count = Math.max(1, Math.round(PREVIEW_TRAIL_LENGTH / PREVIEW_TRAIL_STEP));

  for (let i = 0; i < count; i++) {
    const f = count === 1 ? 0 : i / (count - 1);
    const taper = 1 - f;
    const dist = 0.3 + i * PREVIEW_TRAIL_STEP;

    const coreMat = new THREE.MeshBasicMaterial({
      map: splat,
      color: visual.color,
      transparent: true,
      opacity: 0.5 * taper,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
      toneMapped: false,
    });
    const core = new THREE.Mesh(
      new THREE.PlaneGeometry(TRAIL_GROUND_SIZE, TRAIL_GROUND_SIZE),
      coreMat
    );
    core.rotation.x = -Math.PI / 2;
    core.position.set(0, 0.05, -dist);
    core.userData[SKIP] = true;
    stub.add(core);

    if (visual.additive) {
      const glowMat = new THREE.MeshBasicMaterial({
        map: splat,
        color: visual.color,
        transparent: true,
        opacity: 0.22 * taper,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      });
      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(TRAIL_GROUND_SIZE * 1.25, TRAIL_GROUND_SIZE * 1.25),
        glowMat
      );
      glow.rotation.x = -Math.PI / 2;
      glow.position.set(0, 0.056, -dist);
      glow.userData[SKIP] = true;
      stub.add(glow);
    }
  }

  stub.rotation.y = PREVIEW_TRAIL_BASE_YAW;
  group.add(stub);
}

/**
 * Keeps the preview trail stub pointing away from the viewer as the preview camera orbits
 * through its four corners. `cameraYawRad` is the preview camera's orbit yaw.
 */
export function orientStaticPreviewTrail(group: THREE.Group, cameraYawRad: number): void {
  const stub = group.getObjectByName(PREVIEW_TRAIL_STUB_NAME);
  if (stub) stub.rotation.y = PREVIEW_TRAIL_BASE_YAW + cameraYawRad;
}

export function spawnDeployablePreviewBurst(
  scene: THREE.Scene,
  presetId: string,
  x: number,
  z: number
): PersistentDeployableFx {
  return attachPersistentDeployableVfx(scene, presetId, x, z);
}
