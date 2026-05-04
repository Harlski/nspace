/**
 * Optional in-game telemetry for `?perf=1`: frame pacing, long tasks, WS payload
 * sizes, and (when enabled on Game) tick split timings. Intended for local /
 * staging diagnosis, not shipped hot path defaults.
 */

export type PerfTickSplit = {
  preRenderMs: number;
  /** Sub-steps of `preRenderMs` (doors + voxel tween, avatars, camera + path). */
  preDoorsVoxelMs: number;
  preAvatarsMs: number;
  preCamPathMs: number;
  renderMs: number;
  /** Sub-steps of `renderMs` when fog-of-war is profiled (`scene→RT` + fullscreen composite). */
  renderSceneMs: number;
  renderCompositeMs: number;
  tailMs: number;
  triangles: number;
  drawCalls: number;
};

type TimeMsSample = { t: number; ms: number };
type LongSample = { t: number; duration: number };
type WsSample = { t: number; bytesUtf8: number; type: string };
type HeapSample = { t: number; usedBytes: number };
/** Captured when rAF gap spikes so you can see what `tick` was doing that frame. */
type HitchSample = {
  t: number;
  gapMs: number;
  tickMs: number;
  renderMs: number;
  sceneMs: number;
  preMs: number;
  tailMs: number;
  draws: number;
  tris: number;
};
type LoafSample = { t: number; durationMs: number; blockingMs: number };

/**
 * How many recent rAF intervals we retain (~30s at 60Hz). Drives FPS sparkline
 * history; text stats still use a 1s sliding window.
 */
const FRAME_RING = 1800;
const LONG_RING = 40;
const WS_RING = 24;
const WINDOW_MS = 1000;
const FPS_CHART_TOP = 72;
const IDLE_RING = 200;
const OVERLAY_RING = 120;
const HITCH_RING = 16;
const HEAP_RING = 200;
const LOAF_RING = 24;
/** rAF gaps at or above this are recorded as a hitch snapshot (if tick split known). */
const HITCH_GAP_MS = 34;

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor(p * (sorted.length - 1)))
  );
  return sorted[idx]!;
}

/** Oldest → newest `ms` samples from a time ring (frame gaps, tick wall, scene draw, …). */
function chronologicalRingMs(
  buf: readonly (TimeMsSample | undefined)[],
  head: number,
  count: number,
  cap: number,
  n: number
): number[] {
  const out: number[] = [];
  const take = Math.min(n, count);
  if (take < 1) return out;
  for (let j = 0; j < take; j++) {
    const idx = (head - take + j + cap * 1024) % cap;
    const s = buf[idx];
    if (s) out.push(s.ms);
  }
  return out;
}

/** Oldest → newest; each value is min FPS in that slice (keeps dips visible when downsampling). */
function downsampleMinFps(fps: readonly number[], targetLen: number): number[] {
  if (fps.length <= targetLen || targetLen < 4) return [...fps];
  const out: number[] = [];
  for (let i = 0; i < targetLen; i++) {
    const t0 = Math.floor((i / targetLen) * fps.length);
    const t1 = Math.floor(((i + 1) / targetLen) * fps.length);
    let m = FPS_CHART_TOP;
    const end = Math.max(t0 + 1, t1);
    for (let j = t0; j < end; j++) {
      m = Math.min(m, fps[j]!);
    }
    out.push(m);
  }
  return out;
}

/** Oldest → newest; each bucket keeps the **max** ms (preserves spikes when downsampling). */
function downsampleMaxMs(ms: readonly number[], targetLen: number): number[] {
  if (ms.length <= targetLen || targetLen < 4) return [...ms];
  const out: number[] = [];
  for (let i = 0; i < targetLen; i++) {
    const t0 = Math.floor((i / targetLen) * ms.length);
    const t1 = Math.floor(((i + 1) / targetLen) * ms.length);
    let m = 0;
    const end = Math.max(t0 + 1, t1);
    for (let j = t0; j < end; j++) {
      m = Math.max(m, ms[j]!);
    }
    out.push(m);
  }
  return out;
}

export type PerfSparklineCharts = {
  gapMs: HTMLCanvasElement;
  tickMs: HTMLCanvasElement;
  /** Full `fogOfWar.render` wall time (scene→RT + fog composite when enabled). */
  renderMs: HTMLCanvasElement;
  /** `renderer.render(scene)` slice only (see text HUD “render detail”). */
  sceneMs: HTMLCanvasElement;
};

function paintMsSparklineFromRing(
  canvas: HTMLCanvasElement,
  buf: readonly (TimeMsSample | undefined)[],
  head: number,
  count: number,
  cap: number,
  label: string,
  refMs: readonly number[],
  strokeRgb: string
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const rect = canvas.getBoundingClientRect();
  const wCss = Math.max(32, Math.floor(rect.width));
  const hCss = Math.max(36, Math.floor(rect.height));
  const dpr = Math.min(
    typeof window !== "undefined" ? window.devicePixelRatio ?? 1 : 1,
    2
  );
  const wPx = Math.floor(wCss * dpr);
  const hPx = Math.floor(hCss * dpr);
  if (canvas.width !== wPx || canvas.height !== hPx) {
    canvas.width = wPx;
    canvas.height = hPx;
    canvas.style.width = `${wCss}px`;
    canvas.style.height = `${hCss}px`;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const w = wCss;
  const h = hCss;
  const padL = 24;
  const padR = 4;
  const padT = 5;
  const padB = 12;
  const cw = Math.max(1, w - padL - padR);
  const ch = Math.max(1, h - padT - padB);

  ctx.fillStyle = "rgba(10, 12, 18, 0.96)";
  ctx.fillRect(0, 0, w, h);

  const raw = chronologicalRingMs(buf, head, count, cap, cap);
  const bucketCount = Math.min(200, Math.max(40, Math.floor(cw * 1.15)));
  const series =
    raw.length > bucketCount * 2 ? downsampleMaxMs(raw, bucketCount) : raw;

  let mx = 0;
  for (const v of series) mx = Math.max(mx, v);
  const yMax = Math.max(6, Math.min(90, mx * 1.08 + 0.5));
  const yAt = (msVal: number) =>
    padT + ch * (1 - Math.min(1, Math.max(0, msVal) / yMax));

  ctx.strokeStyle = "rgba(55, 65, 85, 0.65)";
  ctx.lineWidth = 1;
  ctx.font = "9px ui-monospace, Menlo, monospace";
  ctx.fillStyle = "rgba(150, 160, 180, 0.75)";
  for (const ref of refMs) {
    if (ref <= 0 || ref > yMax * 1.01) continue;
    const y = yAt(ref);
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(padL + cw, y);
    ctx.stroke();
    ctx.fillText(`${ref.toFixed(0)}`, 2, y + 3);
  }

  ctx.fillStyle = "rgba(130, 140, 160, 0.55)";
  ctx.fillText(label, 2, padT + 9);
  const approxSec = Math.round(FRAME_RING / 60);
  ctx.fillStyle = "rgba(120, 130, 150, 0.5)";
  ctx.fillText(`←~${approxSec}s`, padL, h - 3);

  if (series.length < 2) {
    ctx.fillStyle = "rgba(180, 190, 210, 0.65)";
    ctx.fillText("…", padL + 4, padT + ch * 0.5);
    return;
  }

  const n = series.length;
  const stepX = cw / Math.max(1, n - 1);

  ctx.beginPath();
  ctx.strokeStyle = "rgba(100, 120, 160, 0.28)";
  ctx.moveTo(padL, yAt(0));
  ctx.lineTo(padL + cw, yAt(0));
  ctx.stroke();

  ctx.beginPath();
  ctx.strokeStyle = strokeRgb;
  ctx.lineWidth = 1.15;
  for (let i = 0; i < n; i++) {
    const x = padL + i * stepX;
    const y = yAt(series[i]!);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  const last = series[n - 1] ?? 0;
  ctx.fillStyle =
    last > 33 ? "rgba(255, 160, 130, 0.95)" : "rgba(200, 220, 245, 0.92)";
  ctx.font = "10px ui-monospace, Menlo, monospace";
  ctx.fillText(`${last.toFixed(2)}`, padL + cw - 30, padT + 10);
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
  /**
   * `handlerMs` = wall time for this rAF callback excluding the perf HUD block
   * (tick + portal sync + emoji anchor + debug text). Call `recordOverlay` after
   * drawing the perf panel to measure that cost without delaying pacing samples.
   */
  recordFrame(
    frameGapMs: number,
    tickWallMs?: number,
    handlerMs?: number,
    /** When `?perf=1` and Game split enabled, pass `game.getPerfTickSplit()` to log hitch detail. */
    hitchSplit?: PerfTickSplit | null
  ): void;
  recordOverlay(overlayMs: number): void;
  recordWsInbound(bytesUtf8: number, type: string): void;
  formatHudLines(tickSplit: PerfTickSplit | null): string;
  /** Draw rolling instantaneous FPS from recent rAF gaps (oldest left, newest right). */
  renderFpsChart(canvas: HTMLCanvasElement): void;
  /** Compact ms sparklines aligned with the FPS chart window (~30s). */
  renderPerfSparklines(charts: PerfSparklineCharts): void;
  dispose(): void;
};

export function createPerfTelemetry(): PerfTelemetry {
  const frameBuf: (TimeMsSample | undefined)[] = new Array(FRAME_RING);
  let frameHead = 0;
  let frameCount = 0;

  const tickBuf: (TimeMsSample | undefined)[] = new Array(FRAME_RING);
  let tickHead = 0;
  let tickCount = 0;

  const renderBlockBuf: (TimeMsSample | undefined)[] = new Array(FRAME_RING);
  let renderBlockHead = 0;
  let renderBlockCount = 0;

  const sceneBuf: (TimeMsSample | undefined)[] = new Array(FRAME_RING);
  let sceneHead = 0;
  let sceneCount = 0;

  const longBuf: (LongSample | undefined)[] = new Array(LONG_RING);
  let longHead = 0;
  let longCount = 0;

  const wsBuf: (WsSample | undefined)[] = new Array(WS_RING);
  let wsHead = 0;
  let wsCount = 0;

  const idleBuf: (TimeMsSample | undefined)[] = new Array(IDLE_RING);
  let idleHead = 0;
  let idleCount = 0;
  const overlayBuf: (TimeMsSample | undefined)[] = new Array(OVERLAY_RING);
  let overlayHead = 0;
  let overlayCount = 0;
  let lastHandlerMsForIdle = 0;

  const hitchBuf: (HitchSample | undefined)[] = new Array(HITCH_RING);
  let hitchHead = 0;
  let hitchCount = 0;

  const heapBuf: (HeapSample | undefined)[] = new Array(HEAP_RING);
  let heapHead = 0;
  let heapCount = 0;

  const loafBuf: (LoafSample | undefined)[] = new Array(LOAF_RING);
  let loafHead = 0;
  let loafCount = 0;

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

  let loafObserver: PerformanceObserver | null = null;
  try {
    const supported = (
      PerformanceObserver as unknown as {
        supportedEntryTypes?: readonly string[];
      }
    ).supportedEntryTypes;
    if (supported?.includes?.("long-animation-frame")) {
      loafObserver = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          if (e.entryType !== "long-animation-frame") continue;
          const ext = e as PerformanceEntry & { blockingDuration?: number };
          const lr = pushRing(loafBuf, loafHead, loafCount, LOAF_RING, {
            t: performance.now(),
            durationMs: ext.duration,
            blockingMs: Math.max(0, ext.blockingDuration ?? 0),
          });
          loafHead = lr.head;
          loafCount = lr.count;
        }
      });
      loafObserver.observe({ type: "long-animation-frame", buffered: true });
    }
  } catch {
    loafObserver = null;
  }

  return {
    recordFrame(
      frameGapMs: number,
      tickWallMs?: number,
      handlerMs?: number,
      hitchSplit?: PerfTickSplit | null
    ): void {
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
      {
        const rm =
          hitchSplit && Number.isFinite(hitchSplit.renderMs)
            ? hitchSplit.renderMs
            : 0;
        const rr = pushRing(
          renderBlockBuf,
          renderBlockHead,
          renderBlockCount,
          FRAME_RING,
          { t, ms: rm }
        );
        renderBlockHead = rr.head;
        renderBlockCount = rr.count;
      }
      {
        const sm =
          hitchSplit && Number.isFinite(hitchSplit.renderSceneMs)
            ? hitchSplit.renderSceneMs
            : 0;
        const sr = pushRing(sceneBuf, sceneHead, sceneCount, FRAME_RING, {
          t,
          ms: sm,
        });
        sceneHead = sr.head;
        sceneCount = sr.count;
      }
      if (handlerMs !== undefined && Number.isFinite(handlerMs)) {
        if (lastHandlerMsForIdle > 0) {
          const idleEst = Math.max(0, frameGapMs - lastHandlerMsForIdle);
          const ir = pushRing(idleBuf, idleHead, idleCount, IDLE_RING, {
            t,
            ms: idleEst,
          });
          idleHead = ir.head;
          idleCount = ir.count;
        }
        lastHandlerMsForIdle = handlerMs;
      }

      const mem = (performance as { memory?: { usedJSHeapSize: number } }).memory;
      if (mem && Number.isFinite(mem.usedJSHeapSize)) {
        const hr = pushRing(heapBuf, heapHead, heapCount, HEAP_RING, {
          t,
          usedBytes: mem.usedJSHeapSize,
        });
        heapHead = hr.head;
        heapCount = hr.count;
      }

      if (
        frameGapMs >= HITCH_GAP_MS &&
        hitchSplit &&
        tickWallMs !== undefined &&
        Number.isFinite(tickWallMs)
      ) {
        const hi = pushRing(hitchBuf, hitchHead, hitchCount, HITCH_RING, {
          t,
          gapMs: frameGapMs,
          tickMs: tickWallMs,
          renderMs: hitchSplit.renderMs,
          sceneMs: hitchSplit.renderSceneMs,
          preMs: hitchSplit.preRenderMs,
          tailMs: hitchSplit.tailMs,
          draws: hitchSplit.drawCalls,
          tris: hitchSplit.triangles,
        });
        hitchHead = hi.head;
        hitchCount = hi.count;
      }
    },

    recordOverlay(overlayMs: number): void {
      if (!Number.isFinite(overlayMs)) return;
      const t = performance.now();
      const or = pushRing(overlayBuf, overlayHead, overlayCount, OVERLAY_RING, {
        t,
        ms: overlayMs,
      });
      overlayHead = or.head;
      overlayCount = or.count;
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

      const idles = windowSamples(idleBuf, idleHead, idleCount, IDLE_RING, now);
      const idleArr = idles.map((x) => x.ms).sort((a, b) => a - b);
      const p95Idle = percentile(idleArr, 0.95);
      const maxIdle = idleArr.length ? idleArr[idleArr.length - 1]! : 0;

      const overlays = windowSamples(
        overlayBuf,
        overlayHead,
        overlayCount,
        OVERLAY_RING,
        now
      );
      const overMs = overlays.map((x) => x.ms).sort((a, b) => a - b);
      const p95Over = percentile(overMs, 0.95);
      const maxOver = overMs.length ? overMs[overMs.length - 1]! : 0;

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

      const heaps = windowSamples(heapBuf, heapHead, heapCount, HEAP_RING, now);
      let heapSwingMb = 0;
      if (heaps.length >= 2) {
        let lo = heaps[0]!.usedBytes;
        let hi = heaps[0]!.usedBytes;
        for (const h of heaps) {
          lo = Math.min(lo, h.usedBytes);
          hi = Math.max(hi, h.usedBytes);
        }
        heapSwingMb = (hi - lo) / (1024 * 1024);
      }

      const loafs = windowSamples(loafBuf, loafHead, loafCount, LOAF_RING, now);
      let loafMax = 0;
      let loafBlockMax = 0;
      for (const l of loafs) {
        loafMax = Math.max(loafMax, l.durationMs);
        loafBlockMax = Math.max(loafBlockMax, l.blockingMs);
      }

      const hitchLines: string[] = [];
      const hitchTake = Math.min(3, hitchCount);
      for (let i = 0; i < hitchTake; i++) {
        const idx = (hitchHead - 1 - i + HITCH_RING * 1024) % HITCH_RING;
        const h = hitchBuf[idx];
        if (!h) continue;
        hitchLines.push(
          `hitch ${i === 0 ? "last" : `−${i}`}: gap ${h.gapMs.toFixed(0)}ms  tick ${h.tickMs.toFixed(
            1
          )}ms  render ${h.renderMs.toFixed(1)} (scene ${h.sceneMs.toFixed(1)})  pre ${h.preMs.toFixed(
            1
          )}  tail ${h.tailMs.toFixed(1)}  draws ${h.draws}`
        );
      }

      const lines: string[] = [
        "perf (last 1s window where noted)",
        `rAF Δ: last ${lastGap.toFixed(1)}ms  p95 ${p95Gap.toFixed(1)}ms  max ${maxGap.toFixed(1)}ms  >33ms: ${over33}/${gaps.length}`,
        ticks.length
          ? `tick wall: p95 ${p95Tick.toFixed(1)}ms  max ${maxTick.toFixed(1)}ms`
          : "tick wall: n/a",
        idles.length
          ? `est. rAF wait (gap−prev handler): p95 ${p95Idle.toFixed(1)}ms  max ${maxIdle.toFixed(1)}ms`
          : "est. rAF wait: (collecting…)",
        overlays.length
          ? `perf HUD draw: p95 ${p95Over.toFixed(2)}ms  max ${maxOver.toFixed(2)}ms`
          : "",
        longTaskObserver
          ? `longtask: count ${longCnt}  max ${longMax.toFixed(0)}ms (browser support varies)`
          : "longtask: observer unavailable",
        wsN
          ? `ws in: msgs ${wsN}  max ${wsMaxB} B (${wsMaxType})`
          : "ws in: (no messages in window)",
        mem
          ? `heap: ${(mem.usedJSHeapSize / (1024 * 1024)).toFixed(1)} / ${(mem.totalJSHeapSize / (1024 * 1024)).toFixed(1)} MB (Chrome)${
              heaps.length >= 4
                ? `  swing(1s): ${heapSwingMb.toFixed(1)} MB (GC pressure hint)`
                : ""
            }`
          : "heap: n/a",
        loafObserver
          ? loafs.length
            ? `LoAF: count ${loafs.length}  max ${loafMax.toFixed(0)}ms  blocking max ${loafBlockMax.toFixed(0)}ms (Chrome; style/layout/scripts)`
            : "LoAF: (none in window — good)"
          : "LoAF: observer n/a (need Chrome + long-animation-frame)",
        ...hitchLines,
      ];

      if (tickSplit) {
        lines.push(
          `split: pre ${tickSplit.preRenderMs.toFixed(2)}ms  render ${tickSplit.renderMs.toFixed(2)}ms  tail ${tickSplit.tailMs.toFixed(2)}ms`
        );
        lines.push(
          `render detail: scene draw ${tickSplit.renderSceneMs.toFixed(2)}ms  fog composite ${tickSplit.renderCompositeMs.toFixed(2)}ms`
        );
        lines.push(
          `pre detail: doors+vox ${tickSplit.preDoorsVoxelMs.toFixed(2)}ms  avatars ${tickSplit.preAvatarsMs.toFixed(2)}ms  cam+path+fogPos ${tickSplit.preCamPathMs.toFixed(2)}ms`
        );
        lines.push(
          `webgl last frame: ${tickSplit.triangles} tris  ${tickSplit.drawCalls} calls`
        );
      }

      return lines.filter((s) => s.length > 0).join("\n");
    },

    renderFpsChart(canvas: HTMLCanvasElement): void {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      const wCss = Math.max(64, Math.floor(rect.width));
      const hCss = Math.max(40, Math.floor(rect.height));
      const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio ?? 1 : 1, 2);
      const wPx = Math.floor(wCss * dpr);
      const hPx = Math.floor(hCss * dpr);
      if (canvas.width !== wPx || canvas.height !== hPx) {
        canvas.width = wPx;
        canvas.height = hPx;
        canvas.style.width = `${wCss}px`;
        canvas.style.height = `${hCss}px`;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const w = wCss;
      const h = hCss;
      const padL = 34;
      const padR = 6;
      const padT = 8;
      const padB = 16;
      const cw = Math.max(1, w - padL - padR);
      const ch = Math.max(1, h - padT - padB);

      ctx.fillStyle = "rgba(10, 12, 18, 0.96)";
      ctx.fillRect(0, 0, w, h);

      const gaps = chronologicalRingMs(
        frameBuf,
        frameHead,
        frameCount,
        FRAME_RING,
        FRAME_RING
      );
      const fpsRaw = gaps.map((ms) =>
        ms > 0.25 ? Math.min(FPS_CHART_TOP, 1000 / ms) : 0
      );
      const bucketCount = Math.min(
        640,
        Math.max(96, Math.floor(cw * 1.25))
      );
      const fps =
        fpsRaw.length > bucketCount * 2
          ? downsampleMinFps(fpsRaw, bucketCount)
          : fpsRaw;

      const yForFps = (fpsVal: number) => {
        const t = Math.max(0, Math.min(1, fpsVal / FPS_CHART_TOP));
        return padT + ch * (1 - t);
      };

      ctx.strokeStyle = "rgba(55, 65, 85, 0.75)";
      ctx.lineWidth = 1;
      ctx.font = "10px ui-monospace, Menlo, monospace";
      ctx.fillStyle = "rgba(160, 170, 190, 0.85)";
      for (const ref of [30, 60]) {
        const y = yForFps(ref);
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(padL + cw, y);
        ctx.stroke();
        ctx.fillText(`${ref}`, 4, y + 3);
      }

      ctx.fillStyle = "rgba(130, 140, 160, 0.55)";
      ctx.fillText("FPS", 4, padT + 10);
      const approxSec = Math.round(FRAME_RING / 60);
      ctx.fillText(`← ~${approxSec}s`, padL, h - 4);

      if (fps.length < 2) {
        ctx.fillStyle = "rgba(180, 190, 210, 0.7)";
        ctx.fillText("collecting…", padL + 4, padT + ch * 0.45);
        return;
      }

      const n = fps.length;
      const stepX = cw / Math.max(1, n - 1);

      ctx.beginPath();
      ctx.strokeStyle = "rgba(100, 120, 160, 0.35)";
      ctx.moveTo(padL, yForFps(0));
      ctx.lineTo(padL + cw, yForFps(0));
      ctx.stroke();

      ctx.beginPath();
      ctx.strokeStyle = "rgba(120, 200, 255, 0.92)";
      ctx.lineWidth = 1.25;
      for (let i = 0; i < n; i++) {
        const x = padL + i * stepX;
        const y = yForFps(fps[i]!);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      const last =
        fpsRaw.length > 0 ? fpsRaw[fpsRaw.length - 1]! : fps[n - 1] ?? 0;
      ctx.fillStyle =
        last < 45 ? "rgba(255, 140, 120, 0.95)" : "rgba(200, 230, 255, 0.95)";
      ctx.font = "11px ui-monospace, Menlo, monospace";
      ctx.fillText(`${last.toFixed(0)}`, padL + cw - 22, padT + 11);
    },

    renderPerfSparklines(charts: PerfSparklineCharts): void {
      paintMsSparklineFromRing(
        charts.gapMs,
        frameBuf,
        frameHead,
        frameCount,
        FRAME_RING,
        "rAF Δ ms",
        [16.67, 33.33],
        "rgba(255, 200, 140, 0.9)"
      );
      paintMsSparklineFromRing(
        charts.tickMs,
        tickBuf,
        tickHead,
        tickCount,
        FRAME_RING,
        "tick total",
        [16.67, 33],
        "rgba(150, 200, 255, 0.92)"
      );
      paintMsSparklineFromRing(
        charts.renderMs,
        renderBlockBuf,
        renderBlockHead,
        renderBlockCount,
        FRAME_RING,
        "render pass",
        [16.67, 33],
        "rgba(255, 190, 120, 0.9)"
      );
      paintMsSparklineFromRing(
        charts.sceneMs,
        sceneBuf,
        sceneHead,
        sceneCount,
        FRAME_RING,
        "scene draw",
        [16.67, 33],
        "rgba(110, 235, 185, 0.9)"
      );
    },

    dispose(): void {
      longTaskObserver?.disconnect();
      longTaskObserver = null;
      loafObserver?.disconnect();
      loafObserver = null;
      lastHandlerMsForIdle = 0;
    },
  };
}
