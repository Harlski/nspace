/**
 * In-process diagnostics for `/admin/system`: event-loop lag, memory samples,
 * and a small ring buffer of lines (WS metrics + periodic samples).
 */

import {
  monitorEventLoopDelay,
  PerformanceObserver,
  performance,
  constants as perfConstants,
} from "node:perf_hooks";

const SAMPLE_MS = 5000;
const SERIES_CAP = 120;
const LOG_CAP = 250;
const LOG_LINE_MAX = 480;

/**
 * Fine-grained event-loop stall detector. A timer scheduled every `STALL_PROBE_MS` that
 * fires late by more than `STALL_LOG_MS` means the loop was blocked - useful to correlate
 * timestamped stalls with `[nim-payout]` / `[nim-mutex]` lines in docker logs. The 5s
 * `monitorEventLoopDelay` sampler above only reports aggregates to `/admin/system`; this
 * prints the *moment* a stall happened to the console. `EVENT_LOOP_STALL_LOG_MS=0` disables.
 */
const STALL_PROBE_MS = 250;
const STALL_LOG_MS = Math.max(0, Number(process.env.EVENT_LOOP_STALL_LOG_MS ?? 50));

let stallTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * GC attribution for stalls. A `PerformanceObserver` on GC events lets each stall line
 * report how much of the blocked window V8 spent collecting - the cheapest way to decide
 * whether a stall is garbage collection (tune heap/allocation) or application code (add
 * per-op timing to the suspect job). Entries live on the `performance.now()` timeline, so
 * the stall probe tracks its window on that same clock. No `--expose-gc` needed.
 */
type GcEvent = { end: number; duration: number; kind: number };
const gcRing: GcEvent[] = [];
const GC_RING_MAX_AGE_MS = 30_000;
let gcObserver: PerformanceObserver | null = null;

function gcKindLabel(kind: number): string {
  switch (kind) {
    case perfConstants.NODE_PERFORMANCE_GC_MAJOR:
      return "major";
    case perfConstants.NODE_PERFORMANCE_GC_MINOR:
      return "minor";
    case perfConstants.NODE_PERFORMANCE_GC_INCREMENTAL:
      return "incremental";
    case perfConstants.NODE_PERFORMANCE_GC_WEAKCB:
      return "weakcb";
    default:
      return "gc";
  }
}

/** Move any queued GC entries into the ring and prune stale ones. */
function drainGcEntries(): void {
  if (!gcObserver) return;
  const nowPerf = performance.now();
  for (const e of gcObserver.takeRecords()) {
    const kind = (e as unknown as { detail?: { kind?: number } }).detail?.kind ?? 0;
    gcRing.push({ end: e.startTime + e.duration, duration: e.duration, kind });
  }
  const cutoff = nowPerf - GC_RING_MAX_AGE_MS;
  let drop = 0;
  while (drop < gcRing.length && gcRing[drop].end < cutoff) drop++;
  if (drop > 0) gcRing.splice(0, drop);
}

/** Summarise GC that finished within [windowStartPerf, windowEndPerf]. */
function gcSummaryForWindow(windowStartPerf: number, windowEndPerf: number): string {
  let totalMs = 0;
  const counts = new Map<number, number>();
  for (const g of gcRing) {
    if (g.end < windowStartPerf || g.end > windowEndPerf) continue;
    totalMs += g.duration;
    counts.set(g.kind, (counts.get(g.kind) ?? 0) + 1);
  }
  if (counts.size === 0) return "gc 0 ms";
  const parts = [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([kind, n]) => `${n} ${gcKindLabel(kind)}`);
  return `gc ${Math.round(totalMs)} ms in window: ${parts.join(", ")}`;
}

export type AdminSystemLogLevel = "info" | "warn" | "error";

export type AdminSystemLagPoint = { t: number; maxMs: number; meanMs: number };
export type AdminSystemMemPoint = { t: number; rssMiB: number; heapUsedMiB: number };
export type AdminSystemLogLine = { t: number; level: AdminSystemLogLevel; msg: string };

const lagSeries: AdminSystemLagPoint[] = [];
const memSeries: AdminSystemMemPoint[] = [];
const logRing: AdminSystemLogLine[] = [];

const startedAt = Date.now();

let loopMonitor: ReturnType<typeof monitorEventLoopDelay> | null = null;
let sampleTimer: ReturnType<typeof setInterval> | null = null;

function pushSeries<T>(arr: T[], row: T, cap: number): void {
  arr.push(row);
  if (arr.length > cap) arr.splice(0, arr.length - cap);
}

function truncateMsg(msg: string): string {
  const t = msg.replace(/\s+/g, " ").trim();
  if (t.length <= LOG_LINE_MAX) return t;
  return `${t.slice(0, LOG_LINE_MAX)}…`;
}

/** Append one diagnostic line (shown on `/admin/system` and included in snapshot). */
export function appendAdminSystemLog(level: AdminSystemLogLevel, msg: string): void {
  const row: AdminSystemLogLine = {
    t: Date.now(),
    level,
    msg: truncateMsg(msg),
  };
  logRing.push(row);
  if (logRing.length > LOG_CAP) logRing.splice(0, logRing.length - LOG_CAP);
}

function sampleOnce(): void {
  const t = Date.now();
  const mu = process.memoryUsage();
  const rssMiB = mu.rss / (1024 * 1024);
  const heapUsedMiB = mu.heapUsed / (1024 * 1024);

  pushSeries(memSeries, { t, rssMiB, heapUsedMiB }, SERIES_CAP);

  if (loopMonitor) {
    const maxMs = loopMonitor.max / 1e6;
    const meanMs = loopMonitor.mean / 1e6;
    loopMonitor.reset();
    pushSeries(lagSeries, { t, maxMs, meanMs }, SERIES_CAP);
    if (maxMs >= 25) {
      appendAdminSystemLog(
        "warn",
        `[system] event loop delay high: max ${maxMs.toFixed(1)} ms, mean ${meanMs.toFixed(1)} ms (sample ${SAMPLE_MS} ms)`
      );
    }
  }
}

export function getAdminSystemSnapshot(): {
  now: number;
  uptimeSec: number;
  process: {
    pid: number;
    node: string;
    rssMiB: number;
    heapTotalMiB: number;
    heapUsedMiB: number;
    externalMiB: number;
  };
  sampling: { intervalMs: number; seriesCap: number };
  lagSeries: AdminSystemLagPoint[];
  memSeries: AdminSystemMemPoint[];
  logs: AdminSystemLogLine[];
} {
  const mu = process.memoryUsage();
  return {
    now: Date.now(),
    uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
    process: {
      pid: process.pid,
      node: process.version,
      rssMiB: mu.rss / (1024 * 1024),
      heapTotalMiB: mu.heapTotal / (1024 * 1024),
      heapUsedMiB: mu.heapUsed / (1024 * 1024),
      externalMiB: (mu.external ?? 0) / (1024 * 1024),
    },
    sampling: { intervalMs: SAMPLE_MS, seriesCap: SERIES_CAP },
    lagSeries: [...lagSeries],
    memSeries: [...memSeries],
    logs: [...logRing],
  };
}

function startGcObserver(): void {
  if (gcObserver) return;
  try {
    gcObserver = new PerformanceObserver(() => drainGcEntries());
    gcObserver.observe({ entryTypes: ["gc"], buffered: false });
  } catch {
    gcObserver = null;
    appendAdminSystemLog("warn", "[system] GC observer unavailable; stall lines omit GC attribution");
  }
}

function startEventLoopStallProbe(): void {
  if (stallTimer || STALL_LOG_MS <= 0) return;
  let expected = Date.now() + STALL_PROBE_MS;
  let lastTickPerf = performance.now();
  const tick = (): void => {
    const now = Date.now();
    const nowPerf = performance.now();
    const lateMs = now - expected;
    if (lateMs >= STALL_LOG_MS) {
      drainGcEntries();
      const gcSummary = gcSummaryForWindow(lastTickPerf, nowPerf);
      const msg = `[event-loop] stall ${lateMs} ms ending at ${new Date(now).toISOString()} (${gcSummary})`;
      console.warn(msg);
      appendAdminSystemLog("warn", msg);
    }
    lastTickPerf = nowPerf;
    expected = Date.now() + STALL_PROBE_MS;
    stallTimer = setTimeout(tick, STALL_PROBE_MS);
    if (typeof stallTimer.unref === "function") stallTimer.unref();
  };
  stallTimer = setTimeout(tick, STALL_PROBE_MS);
  if (typeof stallTimer.unref === "function") stallTimer.unref();
}

/** Start periodic sampling (idempotent). */
export function startAdminSystemMonitor(): void {
  if (sampleTimer) return;
  try {
    loopMonitor = monitorEventLoopDelay({ resolution: 20 });
    loopMonitor.enable();
  } catch {
    loopMonitor = null;
    appendAdminSystemLog("warn", "[system] monitorEventLoopDelay unavailable; lag charts disabled");
  }

  appendAdminSystemLog("info", "[system] monitor started");
  sampleTimer = setInterval(sampleOnce, SAMPLE_MS);
  if (typeof sampleTimer.unref === "function") sampleTimer.unref();
  sampleOnce();
  startGcObserver();
  startEventLoopStallProbe();
}
