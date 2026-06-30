/** Legacy re-exports — v1 maps removed; use cosmeticPrefabRegistry instead. */

export {
  cosmeticPrefabTint as auraColorForPreset,
  getCosmeticPrefabDef,
  isTrailPrefabDef,
  TRAIL_REF_SPARK_PATH,
  AURA_REF_MAGIC_RING,
} from "./cosmeticPrefabRegistry.js";

import { getCosmeticPrefabDef, isTrailPrefabDef } from "./cosmeticPrefabRegistry.js";

export type TrailPresetDef = {
  color: number;
  groundLinger: boolean;
  additive: boolean;
};

/** @deprecated Empty — v1 presets removed. */
export const TRAIL_LINGER_PRESETS: Record<string, TrailPresetDef> = {};

/** @deprecated Empty — v1 presets removed. */
export const AURA_PRESETS: Record<string, number> = {};

export function trailPresetDef(presetId: string): TrailPresetDef | null {
  const def = getCosmeticPrefabDef(presetId);
  if (!def || !isTrailPrefabDef(def)) return null;
  return {
    color: def.ground.sprite.tint ?? 0xffffff,
    groundLinger: true,
    additive: Boolean(def.ground.glow),
  };
}

export function isGroundLingerTrail(presetId: string): boolean {
  const def = getCosmeticPrefabDef(presetId);
  return Boolean(def && isTrailPrefabDef(def));
}
