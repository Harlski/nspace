/**
 * Server-driven slideshow phase so all clients show the same slide at time `t`.
 */
export function billboardSlideshowPhaseIndex(
  b: {
    slides: readonly string[];
    intervalMs: number;
    slideDurationsMs?: readonly number[];
    createdAt: number;
    slideshowEpochMs?: number;
  },
  nowMs: number
): number {
  const n = Math.max(1, b.slides.length);
  const durations = b.slideDurationsMs;
  if (Array.isArray(durations) && durations.length === n) {
    const total = durations.reduce(
      (sum, d) => sum + Math.max(1000, Math.floor(Number(d)) || 8000),
      0
    );
    const t0 = Number(b.slideshowEpochMs ?? b.createdAt) || 0;
    const elapsed = (((nowMs - t0) % total) + total) % total;
    let acc = 0;
    for (let i = 0; i < n; i++) {
      const dur = Math.max(1000, Math.floor(Number(durations[i])) || 8000);
      if (elapsed < acc + dur) return i;
      acc += dur;
    }
    return 0;
  }
  const iv = Math.max(1000, Math.floor(Number(b.intervalMs)) || 8000);
  const t0 = Number(b.slideshowEpochMs ?? b.createdAt) || 0;
  const phase = Math.floor((nowMs - t0) / iv);
  const m = phase % n;
  return ((m % n) + n) % n;
}
