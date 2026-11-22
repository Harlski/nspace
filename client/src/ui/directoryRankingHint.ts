/**
 * Public Directory hint-strip countdown. The server sends the next popularity
 * rebind as an absolute timestamp plus its own clock, so every client counts
 * the same interval down.
 */

export type DirectoryRankingClock = {
  nextAtMs: number;
  serverNowMs: number;
  intervalMs: number;
  /** Client `Date.now()` when this schedule arrived. */
  receivedAtMs: number;
};

const PHRASE_PREFIX = "Room rankings update in ";

export function directoryRankingSecondsRemaining(
  clock: DirectoryRankingClock,
  nowMs: number
): number {
  const serverNow = clock.serverNowMs + (nowMs - clock.receivedAtMs);
  let next = clock.nextAtMs;
  const interval = Math.max(1, Math.floor(clock.intervalMs));
  if (next <= serverNow) {
    const behind = serverNow - next;
    const steps = Math.floor(behind / interval) + 1;
    next += steps * interval;
  }
  return Math.max(1, Math.ceil((next - serverNow) / 1000));
}

export function formatDirectoryRankingHint(secondsRemaining: number): string {
  const sec = Math.max(0, Math.floor(secondsRemaining));
  if (sec >= 3600) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${PHRASE_PREFIX}${h}:${pad2(m)}:${pad2(s)}`;
  }
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${PHRASE_PREFIX}${m}:${pad2(s)}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Swap the clock in a hint that already leads with the ranking phrase.
 * Keeps a trailing build hint (` · B: blocks`) in place.
 * Returns null when the strip is showing something else, or the clock text
 * is already current.
 */
export function applyDirectoryRankingClock(
  current: string,
  phrase: string
): string | null {
  if (!current.startsWith(PHRASE_PREFIX) || !phrase.startsWith(PHRASE_PREFIX)) {
    return null;
  }
  const sep = current.indexOf(" · ");
  const rest = sep === -1 ? "" : current.slice(sep);
  const next = phrase + rest;
  return next === current ? null : next;
}
