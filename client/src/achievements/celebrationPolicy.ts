/** Total visible lifetime for one Achievement Unlock Celebration (~1.4s). */
export const ACHIEVEMENT_CELEBRATION_DURATION_MS = 1400;

/** Delay between staggered trophy pops on the same avatar when several unlock at once. */
export const ACHIEVEMENT_CELEBRATION_STAGGER_MS = 1200;

/** Elastic scale-in duration at the start of a celebration pop. */
export const ACHIEVEMENT_CELEBRATION_POP_MS = 200;

/** Shared trophy texture path (bundled static asset, no runtime fetch). */
export const ACHIEVEMENT_TROPHY_ASSET_URL =
  "/assets/achievements/trophy.svg";

/** Screen height for the trophy sprite above an avatar. */
export const ACHIEVEMENT_TROPHY_SCREEN_HEIGHT_PX = 36;

/**
 * Vertical spring offset (world units) for a celebration pop; matches mining floater wobble,
 * shortened to {@link ACHIEVEMENT_CELEBRATION_DURATION_MS}.
 */
export function celebrationSpringYOffset(progress: number, peak = 0.28): number {
  const clamped = Math.min(1, Math.max(0, progress));
  const riseFrac = 0.2;
  if (clamped < riseFrac) {
    const u = clamped / riseFrac;
    const eased = 1 - (1 - u) ** 3;
    return peak * eased;
  }
  const u = (clamped - riseFrac) / (1 - riseFrac);
  const damp = Math.exp(-7.5 * u);
  const wobble = 0.62 + 0.38 * Math.cos(Math.PI * 2 * 1.55 * u);
  return peak * damp * wobble;
}

/** Scale 0→1 with slight overshoot for the pop-in (progress 0..1 over pop window). */
export function celebrationPopScale(popProgress: number): number {
  const t = Math.min(1, Math.max(0, popProgress));
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

/** Opacity fade during the last quarter of the celebration lifetime. */
export function celebrationOpacity(progress: number): number {
  const fadeStart = 0.76;
  if (progress <= fadeStart) return 1;
  return 1 - (progress - fadeStart) / (1 - fadeStart);
}
