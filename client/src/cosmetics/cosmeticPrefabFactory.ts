import * as THREE from "three";
import {
  getCosmeticPrefabDef,
  isAuraPrefabDef,
  isTrailPrefabDef,
  type AuraOrbitDef,
  type AuraPrefabDef,
  type AuraRippleDef,
  type KenneySpriteRef,
  type TrailPrefabDef,
} from "./cosmeticPrefabRegistry.js";

export const SKIP_BLOCK_PICK = "skipBlockPickAndBounds";
export const TRAIL_RENDER_ORDER = 1;

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

/** Test seam — clears Kenney texture cache between vitest cases. */
export function resetCosmeticPrefabTexturesForTests(): void {
  for (const tex of textureCache.values()) tex.dispose();
  textureCache.clear();
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
    textureCache.set(key, tex);
  }
  return tex;
}

function spriteMaterial(
  ref: KenneySpriteRef,
  opts?: { depthTest?: boolean }
): THREE.MeshBasicMaterial {
  const opacity = ref.opacity ?? 0.5;
  return markMaterial(
    new THREE.MeshBasicMaterial({
      map: resolveKenneyTexture(ref.file),
      color: ref.tint ?? 0xffffff,
      transparent: true,
      opacity,
      depthWrite: false,
      depthTest: opts?.depthTest ?? true,
      side: THREE.DoubleSide,
      blending: ref.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
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
  group.rotation.y = Math.random() * Math.PI;

  const materials: THREE.Material[] = [];
  const size = def.ground.sprite.size ?? def.groundSize;
  const coreMat = spriteMaterial(def.ground.sprite);
  const core = new THREE.Mesh(new THREE.PlaneGeometry(size, size), coreMat);
  core.rotation.x = -Math.PI / 2;
  core.renderOrder = TRAIL_RENDER_ORDER;
  core.userData[SKIP_BLOCK_PICK] = true;
  group.add(core);
  materials.push(coreMat);

  const glowRef = def.ground.glow;
  if (glowRef) {
    const glowSize = size * (glowRef.scale ?? 1.2);
    const glowMat = spriteMaterial({ ...glowRef, additive: true });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(glowSize, glowSize), glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.006;
    glow.renderOrder = TRAIL_RENDER_ORDER;
    glow.userData[SKIP_BLOCK_PICK] = true;
    group.add(glow);
    materials.push(glowMat);
  }

  scene.add(group);
  puffList.push({
    mesh: group,
    materials,
    bornAt: now,
    ttl: def.groundTtlMs,
    baseOpacity: def.ground.sprite.opacity ?? 0.5,
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

  const puffs = trailPuffs(group);
  const last = (group.userData[TRAIL_LAST_SPAWN_KEY] as number | undefined) ?? 0;
  const interval =
    opts?.spawnIntervalMs ??
    (alwaysSpawn ? def.gallerySpawnIntervalMs ?? def.spawnIntervalMs : def.spawnIntervalMs);
  if (now - last < interval) return;
  group.userData[TRAIL_LAST_SPAWN_KEY] = now;
  layGroundRibbon(scene, group, def, x, y, z, puffs, now);
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
      depthTest: false,
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

function addOrbitSparks(aura: THREE.Group, orbit: AuraOrbitDef): void {
  const positions = new Float32Array(orbit.count * 3);
  const seeds: AuraSparkSeed[] = [];
  for (let i = 0; i < orbit.count; i++) {
    const ang = (i / orbit.count) * Math.PI * 2;
    const rad = orbit.radius * (0.85 + Math.random() * 0.3);
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
    map: resolveKenneyTexture(orbit.sprite.file),
    color: orbit.sprite.tint ?? 0xffffff,
    size: orbit.sprite.size ?? 0.22,
    sizeAttenuation: true,
    transparent: true,
    opacity: orbit.sprite.opacity ?? 0.9,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  sparks.name = "auraSparks";
  sparks.userData[SKIP_BLOCK_PICK] = true;
  sparks.userData.sparkSeeds = seeds;
  aura.add(sparks);
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
  const glowMat = spriteMaterial(def.glow, { depthTest: false });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(glowSize, glowSize), glowMat);
  glow.name = "auraGlow";
  glow.rotation.x = -Math.PI / 2;
  glow.userData[SKIP_BLOCK_PICK] = true;
  aura.add(glow);

  if (def.frameCycle) {
    const cycleSize = def.frameCycle.sprites[0]?.size ?? glowSize * 0.6;
    const frameMat = spriteMaterial(def.frameCycle.sprites[0]!, { depthTest: false });
    const frame = new THREE.Mesh(new THREE.PlaneGeometry(cycleSize, cycleSize), frameMat);
    frame.name = "auraFrameCycle";
    frame.rotation.x = -Math.PI / 2;
    frame.position.y = 0.012;
    frame.userData[SKIP_BLOCK_PICK] = true;
    frame.userData.frameSprites = def.frameCycle.sprites;
    frame.userData.framePeriodMs = def.frameCycle.periodMs;
    aura.add(frame);
  }

  if (def.ripples) addRipples(aura, def.ripples);
  if (def.orbit) addOrbitSparks(aura, def.orbit);

  group.add(aura);
}

export function updateCosmeticAuraForGroup(group: THREE.Group, now: number): boolean {
  const aura = group.getObjectByName(AURA_KEY) as THREE.Group | undefined;
  if (!aura) return false;
  const presetId = group.userData[AURA_PRESET_KEY] as string | undefined;
  const def = presetId ? getCosmeticPrefabDef(presetId) : null;
  if (!def || !isAuraPrefabDef(def)) return false;

  const t = now * 0.001;
  const pulseHz = def.glow.pulseHz ?? 2.1;

  const glow = aura.getObjectByName("auraGlow") as THREE.Mesh | undefined;
  if (glow) {
    const mat = glow.material as THREE.MeshBasicMaterial;
    const base = (mat.userData[MAT_BASE_OPACITY_KEY] as number) ?? def.glow.opacity ?? 0.4;
    const pulse = 0.5 + 0.5 * Math.sin(t * pulseHz);
    mat.opacity = base * (0.65 + 0.35 * pulse);
    const s = 1 + 0.07 * Math.sin(t * pulseHz);
    glow.scale.set(s, s, 1);
  }

  const frame = aura.getObjectByName("auraFrameCycle") as THREE.Mesh | undefined;
  if (frame && def.frameCycle) {
    const sprites = frame.userData.frameSprites as KenneySpriteRef[];
    const periodMs = frame.userData.framePeriodMs as number;
    const idx = Math.floor((now / periodMs) % sprites.length);
    const ref = sprites[idx]!;
    const mat = frame.material as THREE.MeshBasicMaterial;
    mat.map = resolveKenneyTexture(ref.file);
    mat.color.setHex(ref.tint ?? 0xffffff);
    mat.opacity = ref.opacity ?? 0.35;
    mat.needsUpdate = true;
  }

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

  const sparks = aura.getObjectByName("auraSparks") as THREE.Points | undefined;
  if (sparks && def.orbit) {
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
  const size = def.ground.sprite.size ?? def.groundSize;

  for (let i = 0; i < count; i++) {
    const f = count === 1 ? 0 : i / (count - 1);
    const taper = 1 - f;
    const dist = 0.3 + i * PREVIEW_TRAIL_STEP;

    const coreMat = spriteMaterial({
      ...def.ground.sprite,
      opacity: (def.ground.sprite.opacity ?? 0.5) * taper,
    });
    const core = new THREE.Mesh(new THREE.PlaneGeometry(size, size), coreMat);
    core.rotation.x = -Math.PI / 2;
    core.position.set(0, def.groundY, -dist);
    core.userData[SKIP_BLOCK_PICK] = true;
    stub.add(core);

    if (def.ground.glow) {
      const glowSize = size * (def.ground.glow.scale ?? 1.2);
      const glowMat = spriteMaterial({
        ...def.ground.glow,
        opacity: (def.ground.glow.opacity ?? 0.2) * taper,
        additive: true,
      });
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(glowSize, glowSize), glowMat);
      glow.rotation.x = -Math.PI / 2;
      glow.position.set(0, def.groundY + 0.006, -dist);
      glow.userData[SKIP_BLOCK_PICK] = true;
      stub.add(glow);
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
