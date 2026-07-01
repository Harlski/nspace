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
  /** Gaussian floor splat - overlapping marks smear into a continuous ribbon. */
  splat?: { tint: number; opacity?: number; size?: number };
  /** Kenney sprite core when `splat` is omitted. */
  sprite?: KenneySpriteRef;
  /** Optional additive layer (Kenney sparkle, etc.). */
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
  /** Orbit speed multiplier; negative reverses direction. */
  speedMul?: number;
};

export type AuraTwirlDef = KenneySpriteRef & {
  spinHz: number;
  size?: number;
  /** Size breathe rate (Hz); defaults when omitted. */
  pulseHz?: number;
  /** Peak scale swing as a fraction of base size (0.2 → 80%–120%). */
  pulseScale?: number;
};

export type AuraFootGlowDef = {
  tint: number;
  opacity?: number;
  size?: number;
  pulseHz?: number;
  /** Procedural Gaussian blob - no square PNG footprint. */
  softSplat?: boolean;
  /** Kenney sprite (must use additive billboarding in renderer). */
  file?: string;
  additive?: boolean;
};

export type AuraPrefabDef = {
  slot: "aura";
  presetId: string;
  yOffset: number;
  glow: AuraFootGlowDef;
  ripples?: AuraRippleDef;
  /** @deprecated Prefer `orbits`. */
  orbit?: AuraOrbitDef;
  orbits?: AuraOrbitDef[];
  twirl?: AuraTwirlDef;
};

export type CosmeticPrefabDef = TrailPrefabDef | AuraPrefabDef;

/** Signature palette - spark trail colour variants share the same prefab shape. */
export const TRAIL_SPARK_COLORS = {
  gold: { tint: 0xffcc44, glow: 0xffee88, id: "path", label: "Spark Path (reference)" },
  cyan: { tint: 0x44d4ff, glow: 0xaaeeff, id: "cyan", label: "Spark Path: Cyan" },
  rose: { tint: 0xff6699, glow: 0xffaac8, id: "rose", label: "Spark Path: Rose" },
  violet: { tint: 0xaa77ff, glow: 0xccbbff, id: "violet", label: "Spark Path: Violet" },
  lime: { tint: 0x88ee55, glow: 0xccff99, id: "lime", label: "Spark Path: Lime" },
} as const;

export function buildSparkTrailPreset(
  colorKey: keyof typeof TRAIL_SPARK_COLORS
): TrailPrefabDef {
  const c = TRAIL_SPARK_COLORS[colorKey];
  const presetId =
    colorKey === "gold" ? "trail-ref-spark-path" : `trail-ref-spark-${c.id}`;
  return {
    slot: "trail",
    presetId,
    movementGated: true,
    spawnIntervalMs: 90,
    gallerySpawnIntervalMs: 70,
    groundTtlMs: 520,
    groundStep: 0.22,
    groundMaxPerTick: 16,
    groundY: 0.05,
    groundSize: 1.35,
    ground: {
      splat: { tint: c.tint, opacity: 0.42, size: 1.35 },
      glow: {
        file: "spark_01.png",
        tint: c.glow,
        opacity: 0.16,
        size: 1.35,
        scale: 1.15,
        additive: true,
      },
    },
  };
}

export const TRAIL_REF_SPARK_PATH = buildSparkTrailPreset("gold");
export const TRAIL_REF_SPARK_CYAN = buildSparkTrailPreset("cyan");
export const TRAIL_REF_SPARK_ROSE = buildSparkTrailPreset("rose");
export const TRAIL_REF_SPARK_VIOLET = buildSparkTrailPreset("violet");
export const TRAIL_REF_SPARK_LIME = buildSparkTrailPreset("lime");

export const TRAIL_REF_PRESETS: ReadonlyArray<TrailPrefabDef> = [
  TRAIL_REF_SPARK_PATH,
  TRAIL_REF_SPARK_CYAN,
  TRAIL_REF_SPARK_ROSE,
  TRAIL_REF_SPARK_VIOLET,
  TRAIL_REF_SPARK_LIME,
];

/** Kenney magic + twirl floor sigils - one preset each for Shaper comparison. */
export const AURA_SIGIL_SPRITES = [
  { file: "magic_01.png", slug: "magic-01", label: "Magic 01" },
  { file: "magic_02.png", slug: "magic-02", label: "Magic 02" },
  { file: "magic_03.png", slug: "magic-03", label: "Magic 03" },
  { file: "magic_04.png", slug: "magic-04", label: "Magic 04" },
  { file: "magic_05.png", slug: "magic-05", label: "Magic 05" },
  { file: "twirl_01.png", slug: "twirl-01", label: "Twirl 01" },
  { file: "twirl_02.png", slug: "twirl-02", label: "Twirl 02" },
  { file: "twirl_03.png", slug: "twirl-03", label: "Twirl 03" },
] as const;

export function buildAuraSigilPreset(
  file: string,
  slug: string
): AuraPrefabDef {
  return {
    slot: "aura",
    presetId: `aura-ref-sigil-${slug}`,
    yOffset: 0.04,
    glow: {
      softSplat: true,
      tint: 0x8866cc,
      opacity: 0.42,
      size: 2.1,
      pulseHz: 2.2,
    },
    twirl: {
      file,
      tint: 0xccb8ff,
      opacity: 0.78,
      size: 1.55,
      additive: true,
      spinHz: 0.28,
      pulseHz: 0.55,
      pulseScale: 0.24,
    },
  };
}

export const AURA_REF_SIGIL_PRESETS: ReadonlyArray<AuraPrefabDef> =
  AURA_SIGIL_SPRITES.map((s) => buildAuraSigilPreset(s.file, s.slug));

/** Reference aura - soft foot glow, rotating sigil, dual orbiting motes. */
export const AURA_REF_MAGIC_RING: AuraPrefabDef = {
  slot: "aura",
  presetId: "aura-ref-magic-ring",
  yOffset: 0.04,
  glow: {
    softSplat: true,
    tint: 0xaa77ff,
    opacity: 0.72,
    size: 2.35,
    pulseHz: 2.4,
  },
  twirl: {
    file: "magic_01.png",
    tint: 0xbb88ff,
    opacity: 0.68,
    size: 1.5,
    additive: true,
    spinHz: 0.32,
    pulseHz: 0.6,
    pulseScale: 0.2,
  },
  orbits: [
    {
      sprite: { file: "spark_05.png", tint: 0xddbbff, opacity: 1, size: 0.42 },
      count: 14,
      radius: 0.88,
      speedMul: 1.15,
    },
    {
      sprite: { file: "star_05.png", tint: 0xffffff, opacity: 0.95, size: 0.3 },
      count: 12,
      radius: 0.52,
      speedMul: -1.5,
    },
  ],
};

const REGISTRY: Readonly<Record<string, CosmeticPrefabDef>> = Object.fromEntries(
  [...TRAIL_REF_PRESETS, AURA_REF_MAGIC_RING, ...AURA_REF_SIGIL_PRESETS].map((def) => [
    def.presetId,
    def,
  ])
);

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
  if (isTrailPrefabDef(def)) return def.ground.splat?.tint ?? def.ground.sprite?.tint ?? null;
  return def.glow.tint ?? null;
}

/** Sprite thumbnail tint - glow/twirl colours shown on Kenney PNG previews. */
export function cosmeticPresetPreviewTint(presetId: string): number | null {
  const def = getCosmeticPrefabDef(presetId);
  if (!def) return null;
  if (isTrailPrefabDef(def)) {
    return (
      def.ground.glow?.tint ??
      def.ground.splat?.tint ??
      def.ground.sprite?.tint ??
      null
    );
  }
  if (isAuraPrefabDef(def)) {
    return def.twirl?.tint ?? def.glow.tint ?? null;
  }
  return null;
}

export function auraOrbitDefs(def: AuraPrefabDef): AuraOrbitDef[] {
  if (def.orbits?.length) return def.orbits;
  if (def.orbit) return [def.orbit];
  return [];
}

const KENNEY_PARTICLE_BASE = "/assets/particles/kenney/";

/** Kenney PNG used in-game for wardrobe / shop swatch thumbnails. */
export function cosmeticPresetPreviewSpriteFile(presetId: string): string | null {
  const def = getCosmeticPrefabDef(presetId);
  if (!def) return null;
  if (isTrailPrefabDef(def)) {
    return def.ground.glow?.file ?? def.ground.sprite?.file ?? null;
  }
  if (isAuraPrefabDef(def)) {
    return def.twirl?.file ?? auraOrbitDefs(def)[0]?.sprite.file ?? null;
  }
  return null;
}

export function cosmeticPresetPreviewSpriteUrl(presetId: string): string | null {
  const file = cosmeticPresetPreviewSpriteFile(presetId);
  return file ? `${KENNEY_PARTICLE_BASE}${file}` : null;
}
