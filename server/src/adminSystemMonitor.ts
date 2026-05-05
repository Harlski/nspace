/**
 * In-process diagnostics for `/admin/system`: event-loop lag, memory samples,
 * and a small ring buffer of lines (WS metrics + periodic samples).
 */

import { monitorEventLoopDelay } from "node:perf_hooks";

const SAMPLE_MS = 5000;
const SERIES_CAP = 120;
const LOG_CAP = 250;
const LOG_LINE_MAX = 480;

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
}
