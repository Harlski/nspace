/** Code-defined cosmetic presets — v2 prefabs register here after visual quality gate. */

export type CosmeticSlot =
  | "aura"
  | "nameplate"
  | "chatBubble"
  | "trail"
  | "deployable";

export type PassiveSlot = Exclude<CosmeticSlot, "deployable">;

export type DeployDefaults = {
  cooldownSec: number;
  durationSec: number;
  roomCap: number;
  deployRange: number;
};

export type CosmeticPreset = {
  presetId: string;
  label: string;
  slot: CosmeticSlot;
  deployDefaults?: DeployDefaults;
};

export const DEPLOY_PARAM_LIMITS = {
  cooldownSec: { min: 5, max: 3600 },
  durationSec: { min: 1, max: 60 },
  roomCap: { min: 1, max: 20 },
  deployRange: { min: 1, max: 5 },
} as const;

/** Fixtures for automated tests only (`COSMETIC_STORE_TEST_PRESETS=1`). */
const TEST_FIXTURE_PRESETS: ReadonlyArray<CosmeticPreset> = [
  { presetId: "test-aura", label: "Test Aura", slot: "aura" },
  { presetId: "test-aura-gold", label: "Test Gold Aura", slot: "aura" },
  {
    presetId: "test-nameplate",
    label: "Test Nameplate",
    slot: "nameplate",
  },
  {
    presetId: "test-bubble",
    label: "Test Bubble",
    slot: "chatBubble",
  },
  { presetId: "test-trail", label: "Test Trail", slot: "trail" },
  { presetId: "test-trail-alt", label: "Test Trail Alt", slot: "trail" },
  { presetId: "test-trail-smoke", label: "Test Smoke Trail", slot: "trail" },
  {
    presetId: "test-deployable",
    label: "Test Deployable",
    slot: "deployable",
    deployDefaults: {
      cooldownSec: 30,
      durationSec: 8,
      roomCap: 5,
      deployRange: 3,
    },
  },
];

const PRODUCTION_PRESETS: ReadonlyArray<CosmeticPreset> = [];

function activePresets(): ReadonlyArray<CosmeticPreset> {
  if (process.env.COSMETIC_STORE_TEST_PRESETS === "1") {
    return TEST_FIXTURE_PRESETS;
  }
  return PRODUCTION_PRESETS;
}

export function listCosmeticPresets(): ReadonlyArray<CosmeticPreset> {
  return activePresets();
}

export function getCosmeticPreset(
  presetId: string
): CosmeticPreset | undefined {
  const id = String(presetId ?? "").trim();
  return activePresets().find((p) => p.presetId === id);
}

export function isPassiveSlot(slot: CosmeticSlot): slot is PassiveSlot {
  return slot !== "deployable";
}

export function slotForPreset(presetId: string): CosmeticSlot | null {
  return getCosmeticPreset(presetId)?.slot ?? null;
}

export function clampDeployParam(
  field: keyof DeployDefaults,
  value: number
): number | null {
  if (!Number.isFinite(value)) return null;
  const v = Math.floor(value);
  const { min, max } = DEPLOY_PARAM_LIMITS[field];
  if (v < min || v > max) return null;
  return v;
}

export function resolveDeployRules(
  presetId: string,
  overrides: Partial<DeployDefaults> | null | undefined
): DeployDefaults | null {
  const preset = getCosmeticPreset(presetId);
  if (!preset || preset.slot !== "deployable" || !preset.deployDefaults) {
    return null;
  }
  const base = preset.deployDefaults;
  return {
    cooldownSec: overrides?.cooldownSec ?? base.cooldownSec,
    durationSec: overrides?.durationSec ?? base.durationSec,
    roomCap: overrides?.roomCap ?? base.roomCap,
    deployRange: overrides?.deployRange ?? base.deployRange,
  };
}
