/**
 * Soft Density: stage a modest visible subset of Ambient Cast Face Tokens,
 * cycling through a larger unique set over time.
 */

export const AMBIENT_CAST_VISIBLE_CAP = 12;

export function selectSoftDensityTokens(
  tokens: string[],
  opts: {
    visibleCap?: number;
    /** Monotonic cycle index (e.g. floor(now / cycleMs)). */
    cycleIndex?: number;
  } = {}
): string[] {
  const cap = Math.max(0, opts.visibleCap ?? AMBIENT_CAST_VISIBLE_CAP);
  if (tokens.length === 0 || cap === 0) return [];
  if (tokens.length <= cap) return [...tokens];
  const cycle = Math.max(0, Math.floor(opts.cycleIndex ?? 0));
  const start = (cycle * cap) % tokens.length;
  const out: string[] = [];
  for (let i = 0; i < cap; i++) {
    out.push(tokens[(start + i) % tokens.length]!);
  }
  return out;
}
