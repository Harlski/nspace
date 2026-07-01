/** Legacy re-exports - v1 maps removed; use cosmeticPrefabRegistry instead. */

export {
  cosmeticPrefabTint as auraColorForPreset,
  getCosmeticPrefabDef,
  isTrailPrefabDef,
  TRAIL_REF_SPARK_PATH,
  TRAIL_REF_SPARK_CYAN,
  TRAIL_REF_SPARK_ROSE,
  TRAIL_REF_SPARK_VIOLET,
  TRAIL_REF_SPARK_LIME,
  TRAIL_REF_PRESETS,
  AURA_REF_MAGIC_RING,
  AURA_REF_SIGIL_PRESETS,
  AURA_SIGIL_SPRITES,
  buildAuraSigilPreset,
} from "./cosmeticPrefabRegistry.js";

import { getCosmeticPrefabDef, isTrailPrefabDef } from "./cosmeticPrefabRegistry.js";

export type TrailPresetDef = {
  color: number;
  groundLinger: boolean;
  additive: boolean;
};

/** @deprecated Empty - v1 presets removed. */
export const TRAIL_LINGER_PRESETS: Record<string, TrailPresetDef> = {};

/** @deprecated Empty - v1 presets removed. */
export const AURA_PRESETS: Record<string, number> = {};

export function trailPresetDef(presetId: string): TrailPresetDef | null {
  const def = getCosmeticPrefabDef(presetId);
  if (!def || !isTrailPrefabDef(def)) return null;
  return {
    color: def.ground.splat?.tint ?? def.ground.sprite?.tint ?? 0xffffff,
    groundLinger: true,
    additive: Boolean(def.ground.glow),
  };
}

export function isGroundLingerTrail(presetId: string): boolean {
  const def = getCosmeticPrefabDef(presetId);
  return Boolean(def && isTrailPrefabDef(def));
}
