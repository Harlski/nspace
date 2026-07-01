/** Total visible lifetime for one Achievement Unlock Celebration (8s). */
export const ACHIEVEMENT_CELEBRATION_DURATION_MS = 8000;

/** Delay between staggered celebration pops on the same avatar when several unlock at once. */
export const ACHIEVEMENT_CELEBRATION_STAGGER_MS = 1200;

/** Elastic scale-in duration at the start of a celebration pop. */
export const ACHIEVEMENT_CELEBRATION_POP_MS = 200;

/** Nimiq `i-nimiq:starburst` fill (`text-neutral` / brand gold on dark UI). */
export const ACHIEVEMENT_CELEBRATION_ICON_COLOR = "#E9B873";

/** Screen height for the celebration icon sprite above an avatar (constant on-screen px). */
export const ACHIEVEMENT_CELEBRATION_ICON_SCREEN_HEIGHT_PX = 40;

/** Peak pop rise as a fraction of icon world size. */
const CELEBRATION_POP_RISE_FRAC = 0.28;

/** Gentle hover amplitude as a fraction of icon world size (applied after pop-in). */
const CELEBRATION_HOVER_AMP_FRAC = 0.07;

/** Hover cycles across the hold phase (after initial settle). */
const CELEBRATION_HOVER_CYCLES = 2.4;

/**
 * Vertical motion for a celebration pop: quick rise, brief settle, then gentle hover until fade.
 * Return value is multiplied by icon world size at render time.
 */
export function celebrationSpringYOffset(progress: number): number {
  const clamped = Math.min(1, Math.max(0, progress));
  const riseFrac = 0.03;
  const settleEnd = 0.07;
  if (clamped < riseFrac) {
    const u = clamped / riseFrac;
    const eased = 1 - (1 - u) ** 3;
    return CELEBRATION_POP_RISE_FRAC * eased;
  }
  if (clamped < settleEnd) {
    const u = (clamped - riseFrac) / (settleEnd - riseFrac);
    const damp = Math.exp(-7.5 * u);
    const wobble = 0.62 + 0.38 * Math.cos(Math.PI * 2 * 1.55 * u);
    return CELEBRATION_POP_RISE_FRAC * damp * wobble;
  }

  const fadeStart = 0.9;
  let hoverFade = 1;
  if (clamped > fadeStart) {
    hoverFade = 1 - (clamped - fadeStart) / (1 - fadeStart);
  }
  const hoverProgress = (clamped - settleEnd) / (1 - settleEnd);
  return (
    CELEBRATION_HOVER_AMP_FRAC *
    Math.sin(hoverProgress * Math.PI * 2 * CELEBRATION_HOVER_CYCLES) *
    hoverFade
  );
}

/** Scale 0→1 with slight overshoot for the pop-in (progress 0..1 over pop window). */
export function celebrationPopScale(popProgress: number): number {
  const t = Math.min(1, Math.max(0, popProgress));
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

/** Opacity fade during the last ~15% of the celebration lifetime (long hold at full opacity). */
export function celebrationOpacity(progress: number): number {
  const fadeStart = 0.85;
  if (progress <= fadeStart) return 1;
  return 1 - (progress - fadeStart) / (1 - fadeStart);
}
