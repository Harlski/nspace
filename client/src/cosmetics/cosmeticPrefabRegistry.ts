/** Declarative v2 cosmetic prefab definitions (Kenney sprites + optional custom PNGs). */

export type CosmeticPrefabSlot = "trail" | "aura";

export type KenneySpriteRef = {
  /** Filename under `/assets/particles/kenney/`. */
  file: string;
  tint?: number;
  opacity?: number;
  size?: number;
  additive?: boolean;
};

export type TrailGroundDecalDef = {
  sprite: KenneySpriteRef;
  /** Optional second splat with additive blending. */
  glow?: KenneySpriteRef & { scale?: number };
};

export type TrailPrefabDef = {
  slot: "trail";
  presetId: string;
  movementGated: true;
  spawnIntervalMs: number;
  gallerySpawnIntervalMs?: number;
  groundTtlMs: number;
  groundStep: number;
  groundMaxPerTick: number;
  groundY: number;
  groundSize: number;
  ground: TrailGroundDecalDef;
};

export type AuraRippleDef = {
  count: number;
  periodMs: number;
  minRadius: number;
  maxRadius: number;
  color: number;
  opacity?: number;
};

export type AuraOrbitDef = {
  sprite: KenneySpriteRef;
  count: number;
  radius: number;
};

export type AuraPrefabDef = {
  slot: "aura";
  presetId: string;
  yOffset: number;
  glow: KenneySpriteRef & { pulseHz?: number };
  ripples?: AuraRippleDef;
  orbit?: AuraOrbitDef;
  /** Looped billboard frame cycle at feet (optional). */
  frameCycle?: {
    sprites: KenneySpriteRef[];
    periodMs: number;
  };
};

export type CosmeticPrefabDef = TrailPrefabDef | AuraPrefabDef;

/** Reference trail — warm spark footprints (quality-gate template). */
export const TRAIL_REF_SPARK_PATH: TrailPrefabDef = {
  slot: "trail",
  presetId: "trail-ref-spark-path",
  movementGated: true,
  spawnIntervalMs: 90,
  gallerySpawnIntervalMs: 70,
  groundTtlMs: 520,
  groundStep: 0.22,
  groundMaxPerTick: 16,
  groundY: 0.05,
  groundSize: 1.35,
  ground: {
    sprite: { file: "spark_03.png", tint: 0xffcc44, opacity: 0.58, size: 1.35 },
    glow: {
      file: "spark_01.png",
      tint: 0xffee88,
      opacity: 0.2,
      size: 1.35,
      scale: 1.15,
      additive: true,
    },
  },
};

/** Reference aura — violet magic ring with orbiting motes (quality-gate template). */
export const AURA_REF_MAGIC_RING: AuraPrefabDef = {
  slot: "aura",
  presetId: "aura-ref-magic-ring",
  yOffset: 0.04,
  glow: {
    file: "magic_01.png",
    tint: 0xaa77ff,
    opacity: 0.42,
    size: 1.85,
    additive: true,
    pulseHz: 2.1,
  },
  ripples: {
    count: 3,
    periodMs: 2200,
    minRadius: 0.4,
    maxRadius: 1.5,
    color: 0xaa77ff,
    opacity: 0.55,
  },
  orbit: {
    sprite: { file: "spark_05.png", tint: 0xcc99ff, opacity: 0.88, size: 0.22 },
    count: 10,
    radius: 0.64,
  },
  frameCycle: {
    sprites: [
      { file: "magic_01.png", tint: 0xaa77ff, opacity: 0.35, size: 1.1 },
      { file: "magic_02.png", tint: 0xaa77ff, opacity: 0.35, size: 1.1 },
      { file: "magic_03.png", tint: 0xaa77ff, opacity: 0.35, size: 1.1 },
      { file: "magic_04.png", tint: 0xaa77ff, opacity: 0.35, size: 1.1 },
    ],
    periodMs: 720,
  },
};

const REGISTRY: Readonly<Record<string, CosmeticPrefabDef>> = {
  [TRAIL_REF_SPARK_PATH.presetId]: TRAIL_REF_SPARK_PATH,
  [AURA_REF_MAGIC_RING.presetId]: AURA_REF_MAGIC_RING,
};

export function getCosmeticPrefabDef(presetId: string): CosmeticPrefabDef | null {
  const id = String(presetId ?? "").trim();
  if (!id) return null;
  return REGISTRY[id] ?? null;
}

export function listCosmeticPrefabDefs(): ReadonlyArray<CosmeticPrefabDef> {
  return Object.values(REGISTRY);
}

export function isTrailPrefabDef(def: CosmeticPrefabDef): def is TrailPrefabDef {
  return def.slot === "trail";
}

export function isAuraPrefabDef(def: CosmeticPrefabDef): def is AuraPrefabDef {
  return def.slot === "aura";
}

/** Primary tint for wardrobe swatches / admin chips. */
export function cosmeticPrefabTint(presetId: string): number | null {
  const def = getCosmeticPrefabDef(presetId);
  if (!def) return null;
  if (isTrailPrefabDef(def)) return def.ground.sprite.tint ?? null;
  return def.glow.tint ?? null;
}
