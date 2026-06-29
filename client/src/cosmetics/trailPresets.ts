/** Shared cosmetic palette + per-slot preset definitions (v2 prefabs register here). */

/** The five signature cosmetic colours, reused across trails and auras. */
export const COSMETIC_PALETTE = {
  cyan: 0x44d4ff,
  gold: 0xffcc44,
  rose: 0xff6699,
  violet: 0xaa77ff,
  lime: 0x88ee55,
} as const;

export type TrailPresetDef = {
  color: number;
  /** Floor splat only — no head-mounted particles. */
  groundLinger: boolean;
  additive: boolean;
};

/** v2 trail prefabs register here after visual quality gate. */
export const TRAIL_LINGER_PRESETS: Record<string, TrailPresetDef> = {};

/** v2 aura prefabs register here after visual quality gate. */
export const AURA_PRESETS: Record<string, number> = {};

export function trailPresetDef(presetId: string): TrailPresetDef | null {
  return TRAIL_LINGER_PRESETS[presetId] ?? null;
}

export function isGroundLingerTrail(presetId: string): boolean {
  return trailPresetDef(presetId)?.groundLinger === true;
}

export function auraColorForPreset(presetId: string | null | undefined): number | null {
  if (!presetId) return null;
  return AURA_PRESETS[presetId] ?? null;
}
