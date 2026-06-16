/** Set before in-WebView navigation to another mini-app; consumed on next Nimiq Space load. */
const STORAGE_KEY = "nspace_game_return_resume_v1";

/** How long after leaving we still auto-enter the game (server resume window is 10 min). */
const AUTO_RESUME_MAX_AGE_MS = 10 * 60 * 1000;

type ResumeMarker = { at: number };

function readMarker(): ResumeMarker | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as ResumeMarker;
    if (!o || typeof o.at !== "number" || !Number.isFinite(o.at)) return null;
    return o;
  } catch {
    return null;
  }
}

/** Call immediately before `location.assign` away to another mini-app in the same WebView. */
export function markGameReturnResume(): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ at: Date.now() }));
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * True when the user left for another mini-app recently and should skip the login menu.
 * Clears the marker when consumed.
 */
export function consumeGameReturnResume(): boolean {
  const m = readMarker();
  if (!m) return false;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  return Date.now() - m.at <= AUTO_RESUME_MAX_AGE_MS;
}
