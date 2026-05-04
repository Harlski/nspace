/**
 * Optional in-game telemetry for `?perf=1`: frame pacing, long tasks, WS payload
 * sizes, and (when enabled on Game) tick split timings. Intended for local /
 * staging diagnosis, not shipped hot path defaults.
 */

export type PerfTickSplit = {
  preRenderMs: number;
  renderMs: number;
  tailMs: number;
  triangles: number;
  drawCalls: number;
};

type TimeMsSample = { t: number; ms: number };
type LongSample = { t: number; duration: number };
type WsSample = { t: number; bytesUtf8: number; type: string };

const FRAME_RING = 200;
const LONG_RING = 40;
const WS_RING = 24;
const WINDOW_MS = 1000;

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor(p * (sorted.length - 1)))
  );
  return sorted[idx]!;
}

function windowSamples<T extends { t: number }>(
  buf: readonly (T | undefined)[],
  head: number,
  count: number,
  cap: number,
  now: number
): T[] {
  const out: T[] = [];
  const n = Math.min(count, cap);
  for (let i = 0; i < n; i++) {
    const idx = (head - 1 - i + cap * 1024) % cap;
    const s = buf[idx];
    if (!s) continue;
    if (now - s.t <= WINDOW_MS) out.push(s);
  }
  return out;
}

export type PerfTelemetry = {
  recordFrame(frameGapMs: number, tickWallMs?: number): void;
  recordWsInbound(bytesUtf8: number, type: string): void;
  formatHudLines(tickSplit: PerfTickSplit | null): string;
  dispose(): void;
};

export function createPerfTelemetry(): PerfTelemetry {
  const frameBuf: (TimeMsSample | undefined)[] = new Array(FRAME_RING);
  let frameHead = 0;
  let frameCount = 0;

  const tickBuf: (TimeMsSample | undefined)[] = new Array(FRAME_RING);
  let tickHead = 0;
  let tickCount = 0;

  const longBuf: (LongSample | undefined)[] = new Array(LONG_RING);
  let longHead = 0;
  let longCount = 0;

  const wsBuf: (WsSample | undefined)[] = new Array(WS_RING);
  let wsHead = 0;
  let wsCount = 0;

  function pushRing<T>(
    buf: (T | undefined)[],
    head: number,
    count: number,
    cap: number,
    sample: T
  ): { head: number; count: number } {
    const slot = head % cap;
    buf[slot] = sample;
    const nextHead = head + 1;
    return { head: nextHead, count: Math.min(cap, count + 1) };
  }

  let longTaskObserver: PerformanceObserver | null = null;
  try {
    longTaskObserver = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (e.entryType !== "longtask") continue;
        const lr = pushRing(longBuf, longHead, longCount, LONG_RING, {
          t: performance.now(),
          duration: e.duration,
        });
        longHead = lr.head;
        longCount = lr.count;
      }
    });
    longTaskObserver.observe({ entryTypes: ["longtask"] } as PerformanceObserverInit);
  } catch {
    longTaskObserver = null;
  }

  return {
    recordFrame(frameGapMs: number, tickWallMs?: number): void {
      const t = performance.now();
      const fr = pushRing(frameBuf, frameHead, frameCount, FRAME_RING, {
        t,
        ms: frameGapMs,
      });
      frameHead = fr.head;
      frameCount = fr.count;
      if (tickWallMs !== undefined && Number.isFinite(tickWallMs)) {
        const tr = pushRing(tickBuf, tickHead, tickCount, FRAME_RING, {
          t,
          ms: tickWallMs,
        });
        tickHead = tr.head;
        tickCount = tr.count;
      }
    },

    recordWsInbound(bytesUtf8: number, type: string): void {
      const t = performance.now();
      const wr = pushRing(wsBuf, wsHead, wsCount, WS_RING, {
        t,
        bytesUtf8,
        type,
      });
      wsHead = wr.head;
      wsCount = wr.count;
    },

    formatHudLines(tickSplit: PerfTickSplit | null): string {
      const now = performance.now();
      const mem = (performance as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } })
        .memory;

      const frames = windowSamples(frameBuf, frameHead, frameCount, FRAME_RING, now);
      const gaps = frames.map((f) => f.ms).sort((a, b) => a - b);
      const lastGap = frames.length ? frames[0]!.ms : 0;
      const p95Gap = percentile(gaps, 0.95);
      const maxGap = gaps.length ? gaps[gaps.length - 1]! : 0;
      const over33 = gaps.filter((x) => x > 33).length;

      const ticks = windowSamples(tickBuf, tickHead, tickCount, FRAME_RING, now);
      const tickMs = ticks.map((x) => x.ms).sort((a, b) => a - b);
      const p95Tick = percentile(tickMs, 0.95);
      const maxTick = tickMs.length ? tickMs[tickMs.length - 1]! : 0;

      const longs = windowSamples(longBuf, longHead, longCount, LONG_RING, now);
      const longMax =
        longs.length === 0
          ? 0
          : longs.reduce((m, x) => Math.max(m, x.duration), 0);
      const longCnt = longs.length;

      const ws = windowSamples(wsBuf, wsHead, wsCount, WS_RING, now);
      let wsMaxB = 0;
      let wsMaxType = "—";
      let wsN = 0;
      for (const w of ws) {
        wsN++;
        if (w.bytesUtf8 >= wsMaxB) {
          wsMaxB = w.bytesUtf8;
          wsMaxType = w.type;
        }
      }

      const lines = [
        "perf (last 1s window where noted)",
        `rAF Δ: last ${lastGap.toFixed(1)}ms  p95 ${p95Gap.toFixed(1)}ms  max ${maxGap.toFixed(1)}ms  >33ms: ${over33}/${gaps.length}`,
        ticks.length
          ? `tick wall: p95 ${p95Tick.toFixed(1)}ms  max ${maxTick.toFixed(1)}ms`
          : "tick wall: n/a",
        longTaskObserver
          ? `longtask: count ${longCnt}  max ${longMax.toFixed(0)}ms (browser support varies)`
          : "longtask: observer unavailable",
        wsN
          ? `ws in: msgs ${wsN}  max ${wsMaxB} B (${wsMaxType})`
          : "ws in: (no messages in window)",
        mem
          ? `heap: ${(mem.usedJSHeapSize / (1024 * 1024)).toFixed(1)} / ${(mem.totalJSHeapSize / (1024 * 1024)).toFixed(1)} MB (Chrome)`
          : "heap: n/a",
      ];

      if (tickSplit) {
        lines.push(
          `split: pre ${tickSplit.preRenderMs.toFixed(2)}ms  render ${tickSplit.renderMs.toFixed(2)}ms  tail ${tickSplit.tailMs.toFixed(2)}ms`
        );
        lines.push(
          `webgl last frame: ${tickSplit.triangles} tris  ${tickSplit.drawCalls} calls`
        );
      }

      return lines.join("\n");
    },

    dispose(): void {
      longTaskObserver?.disconnect();
      longTaskObserver = null;
    },
  };
}
