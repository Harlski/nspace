/**
 * Server-driven slideshow phase so all clients show the same slide at time `t`.
 */
export function billboardSlideshowPhaseIndex(
  b: {
    slides: readonly string[];
    intervalMs: number;
    createdAt: number;
    slideshowEpochMs?: number;
  },
  nowMs: number
): number {
  const n = Math.max(1, b.slides.length);
  const iv = Math.max(
    1000,
    Math.floor(Number(b.intervalMs)) || 8000
  );
  const t0 = Number(b.slideshowEpochMs ?? b.createdAt) || 0;
  const phase = Math.floor((nowMs - t0) / iv);
  const m = phase % n;
  return ((m % n) + n) % n;
}
