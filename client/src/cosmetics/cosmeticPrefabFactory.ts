import * as THREE from "three";
import {
  auraOrbitDefs,
  getCosmeticPrefabDef,
  isAuraPrefabDef,
  isTrailPrefabDef,
  type AuraOrbitDef,
  type AuraPrefabDef,
  type AuraRippleDef,
  type AuraTwirlDef,
  type KenneySpriteRef,
  type TrailPrefabDef,
} from "./cosmeticPrefabRegistry.js";

export const SKIP_BLOCK_PICK = "skipBlockPickAndBounds";
export const TRAIL_RENDER_ORDER = 1;
/** Identicon sprites draw at renderOrder 2 - aura always sits beneath the player. */
export const AURA_RENDER_ORDER = 1;

const AURA_KEY = "cosmeticAuraMesh";
const AURA_PRESET_KEY = "cosmeticAuraPreset";
const TRAIL_PRESET_KEY = "cosmeticTrailPreset";
const TRAIL_PUFFS_KEY = "cosmeticTrailPuffs";
const TRAIL_LAST_SPAWN_KEY = "cosmeticTrailLastSpawnAt";
const TRAIL_GROUND_LAST_POS_KEY = "cosmeticTrailGroundLastPos";
const TRAIL_LAST_SAMPLE_KEY = "cosmeticTrailLastSample";
const MAT_BASE_OPACITY_KEY = "trailBaseOpacity";

const KENNEY_BASE = "/assets/particles/kenney/";

export type CosmeticTrailPuff = {
  mesh: THREE.Object3D;
  materials: THREE.Material[];
  bornAt: number;
  ttl: number;
  baseOpacity: number;
  kind: "ground";
};

type AuraSparkSeed = { ang: number; rad: number; ySeed: number; speed: number };

const textureCache = new Map<string, THREE.Texture>();
let softSplatTexture: THREE.DataTexture | null = null;

/** Test seam - clears Kenney texture cache between vitest cases. */
export function resetCosmeticPrefabTexturesForTests(): void {
  for (const tex of textureCache.values()) tex.dispose();
  textureCache.clear();
  softSplatTexture?.dispose();
  softSplatTexture = null;
}

function markMaterial<M extends THREE.Material>(mat: M, baseOpacity: number): M {
  mat.userData[MAT_BASE_OPACITY_KEY] = baseOpacity;
  return mat;
}

function resolveKenneyTexture(file: string): THREE.Texture {
  const key = `${KENNEY_BASE}${file}`;
  let tex = textureCache.get(key);
  if (!tex) {
    tex = new THREE.TextureLoader().load(key);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.premultiplyAlpha = false;
    textureCache.set(key, tex);
  }
  return tex;
}

/** Floor-aligned aura billboard - additive; depthTest so blocks occlude the effect. */
function auraBillboardMaterial(ref: KenneySpriteRef): THREE.MeshBasicMaterial {
  const opacity = ref.opacity ?? 0.35;
  return markMaterial(
    new THREE.MeshBasicMaterial({
      map: resolveKenneyTexture(ref.file),
      color: ref.tint ?? 0xffffff,
      transparent: true,
      opacity,
      depthWrite: false,
      depthTest: true,
      side: THREE.FrontSide,
      blending: THREE.AdditiveBlending,
      alphaTest: 0.04,
      toneMapped: false,
    }),
    opacity
  );
}

/** Smooth Gaussian blob so overlapping floor marks smear into one ribbon (no hard quads). */
function softSplatMap(): THREE.DataTexture {
  if (softSplatTexture) return softSplatTexture;
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const radius = size / 2;
  const sigma = 0.36;
  const twoSigmaSq = 2 * sigma * sigma;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x - cx) / radius;
      const ny = (y - cy) / radius;
      const r = Math.sqrt(nx * nx + ny * ny);
      let a = Math.exp(-(r * r) / twoSigmaSq);
      const edge = 1 - Math.min(1, r);
      a *= edge * edge;
      const i = (y * size + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = Math.round(Math.max(0, Math.min(1, a)) * 255);
    }
  }
  softSplatTexture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  softSplatTexture.needsUpdate = true;
  return softSplatTexture;
}

function splatMaterial(
  tint: number,
  opacity: number,
  additive: boolean
): THREE.MeshBasicMaterial {
  return markMaterial(
    new THREE.MeshBasicMaterial({
      map: softSplatMap(),
      color: tint,
      transparent: true,
      opacity,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      toneMapped: false,
    }),
    opacity
  );
}

function spriteMaterial(
  ref: KenneySpriteRef,
  opts?: { depthTest?: boolean }
): THREE.MeshBasicMaterial {
  const opacity = ref.opacity ?? 0.5;
  const additive = ref.additive === true;
  return markMaterial(
    new THREE.MeshBasicMaterial({
      map: resolveKenneyTexture(ref.file),
      color: ref.tint ?? 0xffffff,
      transparent: true,
      opacity,
      depthWrite: false,
      depthTest: opts?.depthTest ?? true,
      side: THREE.DoubleSide,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      /** Drop dark PNG fringe texels so square quads don't read as black diamonds. */
      alphaTest: additive ? 0.04 : 0.02,
      toneMapped: false,
    }),
    opacity
  );
}

function trailPuffs(group: THREE.Group): CosmeticTrailPuff[] {
  if (!group.userData[TRAIL_PUFFS_KEY]) {
    group.userData[TRAIL_PUFFS_KEY] = [] as CosmeticTrailPuff[];
  }
  return group.userData[TRAIL_PUFFS_KEY] as CosmeticTrailPuff[];
}

function spawnGroundDecal(
  scene: THREE.Scene,
  def: TrailPrefabDef,
  x: number,
  y: number,
  z: number,
  puffList: CosmeticTrailPuff[],
  now: number
): void {
  const group = new THREE.Group();
  group.userData[SKIP_BLOCK_PICK] = true;
  group.position.set(x, y + def.groundY, z);
  group.scale.setScalar(0.9 + Math.random() * 0.2);

  const materials: THREE.Material[] = [];
  const splat = def.ground.splat;
  const sprite = def.ground.sprite;
  const size = splat?.size ?? sprite?.size ?? def.groundSize;
  let baseOpacity = 0.5;

  if (splat) {
    baseOpacity = splat.opacity ?? 0.42;
    const coreMat = splatMaterial(splat.tint, baseOpacity, false);
    const core = new THREE.Mesh(new THREE.PlaneGeometry(size, size), coreMat);
    core.rotation.x = -Math.PI / 2;
    core.renderOrder = TRAIL_RENDER_ORDER;
    core.userData[SKIP_BLOCK_PICK] = true;
    group.add(core);
    materials.push(coreMat);
  } else if (sprite) {
    group.rotation.y = Math.random() * Math.PI * 2;
    baseOpacity = sprite.opacity ?? 0.5;
    const coreMat = spriteMaterial(sprite);
    const core = new THREE.Mesh(new THREE.PlaneGeometry(size, size), coreMat);
    core.rotation.x = -Math.PI / 2;
    core.renderOrder = TRAIL_RENDER_ORDER;
    core.userData[SKIP_BLOCK_PICK] = true;
    group.add(core);
    materials.push(coreMat);
  }

  const glowRef = def.ground.glow;
  if (glowRef) {
    const glowWrap = new THREE.Group();
    glowWrap.rotation.y = Math.random() * Math.PI * 2;
    const glowSize = size * (glowRef.scale ?? 1.2);
    const glowMat = spriteMaterial({ ...glowRef, additive: true });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(glowSize, glowSize), glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.006;
    glow.renderOrder = TRAIL_RENDER_ORDER;
    glow.userData[SKIP_BLOCK_PICK] = true;
    glowWrap.add(glow);
    group.add(glowWrap);
    materials.push(glowMat);
  }

  scene.add(group);
  puffList.push({
    mesh: group,
    materials,
    bornAt: now,
    ttl: def.groundTtlMs,
    baseOpacity,
    kind: "ground",
  });
}

function layGroundRibbon(
  scene: THREE.Scene,
  group: THREE.Group,
  def: TrailPrefabDef,
  x: number,
  y: number,
  z: number,
  puffList: CosmeticTrailPuff[],
  now: number
): void {
  const step = def.groundStep;
  const gp = group.userData[TRAIL_GROUND_LAST_POS_KEY] as
    | { x: number; z: number }
    | undefined;
  if (!gp) {
    group.userData[TRAIL_GROUND_LAST_POS_KEY] = { x, z };
    spawnGroundDecal(scene, def, x, y, z, puffList, now);
    return;
  }
  let dx = x - gp.x;
  let dz = z - gp.z;
  let dist = Math.hypot(dx, dz);
  if (dist < step) return;
  const ux = dx / dist;
  const uz = dz / dist;
  let cx = gp.x;
  let cz = gp.z;
  let placed = 0;
  while (dist >= step && placed < def.groundMaxPerTick) {
    cx += ux * step;
    cz += uz * step;
    dist -= step;
    placed++;
    spawnGroundDecal(scene, def, cx, y, cz, puffList, now);
  }
  group.userData[TRAIL_GROUND_LAST_POS_KEY] = { x: cx, z: cz };
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
  delete group.userData[TRAIL_LAST_SAMPLE_KEY];
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
    const fade = t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45;
    for (const mat of puff.materials) {
      const base = (mat.userData[MAT_BASE_OPACITY_KEY] as number) ?? puff.baseOpacity;
      mat.opacity = base * fade;
    }
    puff.mesh.scale.setScalar(1 + 0.1 * t);
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

export function avatarTrailMoving(group: THREE.Group, x: number, z: number): boolean {
  const prev = group.userData[TRAIL_LAST_SAMPLE_KEY] as { x: number; z: number } | undefined;
  group.userData[TRAIL_LAST_SAMPLE_KEY] = { x, z };
  if (!prev) return false;
  return Math.hypot(x - prev.x, z - prev.z) > 0.008;
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
  const def = getCosmeticPrefabDef(presetId);
  if (!def || !isTrailPrefabDef(def)) return;

  const alwaysSpawn = opts?.forceSpawn === true;
  if (!alwaysSpawn && def.movementGated && !moving) return;

  layGroundRibbon(scene, group, def, x, y, z, trailPuffs(group), now);
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

function addRipples(aura: THREE.Group, ripples: AuraRippleDef): void {
  for (let i = 0; i < ripples.count; i++) {
    const ringMat = new THREE.MeshBasicMaterial({
      color: ripples.color,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 48), ringMat);
    ring.name = "auraRipple";
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.005;
    ring.userData[SKIP_BLOCK_PICK] = true;
    ring.userData.rippleOffset = i / ripples.count;
    aura.add(ring);
  }
}

function orbitSparkMaterial(orbit: AuraOrbitDef): THREE.PointsMaterial {
  return new THREE.PointsMaterial({
    map: resolveKenneyTexture(orbit.sprite.file),
    color: orbit.sprite.tint ?? 0xffffff,
    size: orbit.sprite.size ?? 0.22,
    sizeAttenuation: true,
    transparent: true,
    opacity: orbit.sprite.opacity ?? 0.9,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    alphaTest: 0.04,
    toneMapped: false,
  });
}

function addOrbitSparks(aura: THREE.Group, orbit: AuraOrbitDef, layerIndex: number): void {
  const speedMul = orbit.speedMul ?? 1;
  const positions = new Float32Array(orbit.count * 3);
  const seeds: AuraSparkSeed[] = [];
  for (let i = 0; i < orbit.count; i++) {
    const ang = (i / orbit.count) * Math.PI * 2;
    const rad = orbit.radius * (0.85 + Math.random() * 0.3);
    seeds.push({
      ang,
      rad,
      ySeed: Math.random() * Math.PI * 2,
      speed: (0.8 + Math.random() * 0.5) * speedMul,
    });
    positions[i * 3] = Math.cos(ang) * rad;
    positions[i * 3 + 1] = 0.3;
    positions[i * 3 + 2] = Math.sin(ang) * rad;
  }
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const sparks = new THREE.Points(sparkGeo, orbitSparkMaterial(orbit));
  sparks.name = `auraOrbit${layerIndex}`;
  sparks.renderOrder = AURA_RENDER_ORDER;
  sparks.userData[SKIP_BLOCK_PICK] = true;
  sparks.userData.sparkSeeds = seeds;
  aura.add(sparks);
}

function addFloorDisc(
  parent: THREE.Group,
  name: string,
  radius: number,
  makeMaterial: () => THREE.MeshBasicMaterial,
  y: number,
  segments = 48
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, segments), makeMaterial());
  mesh.name = name;
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  mesh.renderOrder = AURA_RENDER_ORDER;
  mesh.userData[SKIP_BLOCK_PICK] = true;
  parent.add(mesh);
  return mesh;
}

function addTwirlLayer(aura: THREE.Group, twirl: AuraTwirlDef): void {
  const size = twirl.size ?? 1.3;
  const spin = new THREE.Group();
  spin.name = "auraTwirlSpin";
  spin.userData[SKIP_BLOCK_PICK] = true;
  spin.userData.spinHz = twirl.spinHz;
  addFloorDisc(spin, "auraTwirl", size * 0.5, () => auraBillboardMaterial(twirl), 0.018);
  aura.add(spin);
}

function ensureAura(group: THREE.Group, presetId: string | null | undefined): void {
  const existing = group.getObjectByName(AURA_KEY) as THREE.Group | undefined;
  const raw = presetId ? getCosmeticPrefabDef(presetId) : null;
  const def = raw && isAuraPrefabDef(raw) ? raw : null;

  if (!def) {
    if (existing) disposeAura(existing);
    delete group.userData[AURA_PRESET_KEY];
    return;
  }
  if (existing && group.userData[AURA_PRESET_KEY] === presetId) return;
  if (existing) disposeAura(existing);

  const aura = new THREE.Group();
  aura.name = AURA_KEY;
  aura.position.y = def.yOffset;
  aura.userData[SKIP_BLOCK_PICK] = true;
  group.userData[AURA_PRESET_KEY] = presetId;

  const glowSize = def.glow.size ?? 1.9;
  const makeGlowMaterial = (): THREE.MeshBasicMaterial =>
    def.glow.softSplat || !def.glow.file
      ? splatMaterial(def.glow.tint, def.glow.opacity ?? 0.36, true)
      : auraBillboardMaterial({
          file: def.glow.file,
          tint: def.glow.tint,
          opacity: def.glow.opacity,
          additive: true,
        });
  addFloorDisc(aura, "auraGlow", glowSize * 0.5, makeGlowMaterial, 0);

  if (def.twirl) addTwirlLayer(aura, def.twirl);
  if (def.ripples) addRipples(aura, def.ripples);
  auraOrbitDefs(def).forEach((orbit, i) => addOrbitSparks(aura, orbit, i));

  group.add(aura);
}

function pulseFloorDisc(
  aura: THREE.Group,
  meshName: string,
  baseOpacity: number,
  pulse: number,
  scalePulse: number
): void {
  const mesh = aura.getObjectByName(meshName) as THREE.Mesh | undefined;
  if (!mesh) return;
  mesh.scale.set(scalePulse, scalePulse, 1);
  const mat = mesh.material as THREE.MeshBasicMaterial;
  const base = (mat.userData[MAT_BASE_OPACITY_KEY] as number) ?? baseOpacity;
  mat.opacity = base * pulse;
}

function updateAuraOrbitSparks(aura: THREE.Group, t: number): void {
  for (const child of aura.children) {
    const seeds = child.userData.sparkSeeds as AuraSparkSeed[] | undefined;
    if (!seeds?.length || !(child instanceof THREE.Points)) continue;
    const attr = child.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < seeds.length; i++) {
      const s = seeds[i]!;
      const a = s.ang + t * s.speed;
      const y = 0.34 + 0.24 * Math.sin(t * 2.2 + s.ySeed);
      attr.setXYZ(i, Math.cos(a) * s.rad, y, Math.sin(a) * s.rad);
    }
    attr.needsUpdate = true;
  }
}

function updateTwirlSigil(aura: THREE.Group, twirl: AuraTwirlDef, t: number): void {
  const spin = aura.getObjectByName("auraTwirlSpin") as THREE.Group | undefined;
  const mesh = aura.getObjectByName("auraTwirl") as THREE.Mesh | undefined;
  if (!spin || !mesh) return;
  const spinHz = (spin.userData.spinHz as number) ?? twirl.spinHz;
  spin.rotation.y = t * spinHz * Math.PI * 2;
  const pulseHz = twirl.pulseHz ?? 0.55;
  const pulseScaleAmt = twirl.pulseScale ?? 0.2;
  const breathe = 0.5 + 0.5 * Math.sin(t * pulseHz * Math.PI * 2);
  const scale = 1 + pulseScaleAmt * (breathe * 2 - 1);
  spin.scale.set(scale, scale, scale);
  const mat = mesh.material as THREE.MeshBasicMaterial;
  const base = (mat.userData[MAT_BASE_OPACITY_KEY] as number) ?? twirl.opacity ?? 0.7;
  mat.opacity = base * (0.84 + 0.16 * breathe);
}

export function updateCosmeticAuraForGroup(group: THREE.Group, now: number): boolean {
  const aura = group.getObjectByName(AURA_KEY) as THREE.Group | undefined;
  if (!aura) return false;
  const presetId = group.userData[AURA_PRESET_KEY] as string | undefined;
  const def = presetId ? getCosmeticPrefabDef(presetId) : null;
  if (!def || !isAuraPrefabDef(def)) return false;

  const t = now * 0.001;
  const pulseHz = def.glow.pulseHz ?? 2.1;
  const pulse = 0.78 + 0.22 * (0.5 + 0.5 * Math.sin(t * pulseHz));
  const scalePulse = 1 + 0.14 * Math.sin(t * pulseHz);
  pulseFloorDisc(aura, "auraGlow", def.glow.opacity ?? 0.4, pulse, scalePulse);

  if (def.twirl) updateTwirlSigil(aura, def.twirl, t);

  if (def.ripples) {
    for (const child of aura.children) {
      const off = child.userData.rippleOffset as number | undefined;
      if (off === undefined) continue;
      const ring = child as THREE.Mesh;
      const p = ((now / def.ripples.periodMs + off) % 1 + 1) % 1;
      const radius =
        def.ripples.minRadius + p * (def.ripples.maxRadius - def.ripples.minRadius);
      ring.scale.set(radius, radius, 1);
      const fade = Math.sin(p * Math.PI);
      (ring.material as THREE.MeshBasicMaterial).opacity =
        (def.ripples.opacity ?? 0.55) * fade;
    }
  }

  updateAuraOrbitSparks(aura, t);

  return true;
}

function ensureTrailPreset(group: THREE.Group, presetId: string | null | undefined): void {
  const prev = group.userData[TRAIL_PRESET_KEY] as string | null | undefined;
  if (prev === presetId) return;
  group.userData[TRAIL_PRESET_KEY] = presetId ?? null;
  if (!presetId || !getCosmeticPrefabDef(presetId)) disposeCosmeticTrailPuffs(group);
}

export function syncCosmeticLoadoutVfx(
  group: THREE.Group,
  loadout: {
    cosmeticAura?: string | null;
    cosmeticTrail?: string | null;
    cosmeticChatBubble?: string | null;
  },
  _movedRecently: boolean
): void {
  group.userData.cosmeticChatBubble = loadout.cosmeticChatBubble ?? null;
  ensureAura(group, loadout.cosmeticAura);
  ensureTrailPreset(group, loadout.cosmeticTrail);
}

const PREVIEW_TRAIL_STUB_NAME = "cosmeticPreviewTrailStub";
const PREVIEW_TRAIL_LENGTH = 2;
const PREVIEW_TRAIL_STEP = 0.2;
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

export function buildStaticPreviewTrail(
  group: THREE.Group,
  presetId: string | null | undefined
): void {
  disposePreviewTrailStub(group);
  const def = presetId ? getCosmeticPrefabDef(presetId) : null;
  if (!presetId || !def || !isTrailPrefabDef(def)) return;

  const stub = new THREE.Group();
  stub.name = PREVIEW_TRAIL_STUB_NAME;
  stub.userData[SKIP_BLOCK_PICK] = true;
  const count = Math.max(1, Math.round(PREVIEW_TRAIL_LENGTH / PREVIEW_TRAIL_STEP));
  const splat = def.ground.splat;
  const sprite = def.ground.sprite;
  const size = splat?.size ?? sprite?.size ?? def.groundSize;

  for (let i = 0; i < count; i++) {
    const f = count === 1 ? 0 : i / (count - 1);
    const taper = 1 - f;
    const dist = 0.3 + i * PREVIEW_TRAIL_STEP;

    if (splat) {
      const coreMat = splatMaterial(splat.tint, (splat.opacity ?? 0.42) * taper, false);
      const core = new THREE.Mesh(new THREE.PlaneGeometry(size, size), coreMat);
      core.rotation.x = -Math.PI / 2;
      core.position.set(0, def.groundY, -dist);
      core.userData[SKIP_BLOCK_PICK] = true;
      stub.add(core);
    } else if (sprite) {
      const mark = new THREE.Group();
      mark.rotation.y = ((i * 0.53 + 0.17) % 1) * Math.PI * 2;
      mark.position.set(0, 0, -dist);
      const coreMat = spriteMaterial({
        ...sprite,
        opacity: (sprite.opacity ?? 0.5) * taper,
      });
      const core = new THREE.Mesh(new THREE.PlaneGeometry(size, size), coreMat);
      core.rotation.x = -Math.PI / 2;
      core.position.y = def.groundY;
      core.userData[SKIP_BLOCK_PICK] = true;
      mark.add(core);
      stub.add(mark);
    }

    if (def.ground.glow) {
      const glowWrap = new THREE.Group();
      glowWrap.rotation.y = ((i * 0.7 + 0.31) % 1) * Math.PI * 2;
      glowWrap.position.set(0, 0, -dist);
      const glowSize = size * (def.ground.glow.scale ?? 1.2);
      const glowMat = spriteMaterial({
        ...def.ground.glow,
        opacity: (def.ground.glow.opacity ?? 0.2) * taper,
        additive: true,
      });
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(glowSize, glowSize), glowMat);
      glow.rotation.x = -Math.PI / 2;
      glow.position.y = def.groundY + 0.006;
      glow.userData[SKIP_BLOCK_PICK] = true;
      glowWrap.add(glow);
      stub.add(glowWrap);
    }
  }

  stub.rotation.y = PREVIEW_TRAIL_BASE_YAW;
  group.add(stub);
}

export function orientStaticPreviewTrail(group: THREE.Group, cameraYawRad: number): void {
  const stub = group.getObjectByName(PREVIEW_TRAIL_STUB_NAME);
  if (stub) stub.rotation.y = PREVIEW_TRAIL_BASE_YAW + cameraYawRad;
}

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

/** Unknown presetId: no throw, no attach. */
export function attachCosmeticPrefabSafe(
  group: THREE.Group,
  presetId: string | null | undefined,
  slot: "trail" | "aura"
): boolean {
  if (!presetId || !getCosmeticPrefabDef(presetId)) return false;
  if (slot === "trail") {
    ensureTrailPreset(group, presetId);
    return cosmeticTrailPresetForGroup(group) === presetId;
  }
  ensureAura(group, presetId);
  return group.userData[AURA_PRESET_KEY] === presetId;
}

export function disposeCosmeticPrefab(group: THREE.Group): void {
  const aura = group.getObjectByName(AURA_KEY);
  if (aura) disposeAura(aura);
  delete group.userData[AURA_PRESET_KEY];
  disposeCosmeticTrailPuffs(group);
  delete group.userData[TRAIL_PRESET_KEY];
  disposePreviewTrailStub(group);
}
