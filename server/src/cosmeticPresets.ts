/** Code-defined cosmetic presets (v1 — not admin-authored). */

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

const PRESETS: ReadonlyArray<CosmeticPreset> = [
  { presetId: "aura-glow-blue", label: "Blue Glow Aura", slot: "aura" },
  { presetId: "aura-glow-gold", label: "Gold Glow Aura", slot: "aura" },
  {
    presetId: "nameplate-frame-simple",
    label: "Simple Frame Nameplate",
    slot: "nameplate",
  },
  {
    presetId: "nameplate-frame-neon",
    label: "Neon Frame Nameplate",
    slot: "nameplate",
  },
  {
    presetId: "bubble-rounded-pastel",
    label: "Pastel Rounded Bubble",
    slot: "chatBubble",
  },
  {
    presetId: "bubble-sharp-dark",
    label: "Dark Sharp Bubble",
    slot: "chatBubble",
  },
  { presetId: "trail-sparkle", label: "Sparkle Trail", slot: "trail" },
  { presetId: "trail-smoke", label: "Smoke Trail", slot: "trail" },
  {
    presetId: "deployable-confetti-burst",
    label: "Confetti Burst",
    slot: "deployable",
    deployDefaults: {
      cooldownSec: 30,
      durationSec: 8,
      roomCap: 5,
      deployRange: 3,
    },
  },
];

export function listCosmeticPresets(): ReadonlyArray<CosmeticPreset> {
  return PRESETS;
}

export function getCosmeticPreset(
  presetId: string
): CosmeticPreset | undefined {
  const id = String(presetId ?? "").trim();
  return PRESETS.find((p) => p.presetId === id);
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
