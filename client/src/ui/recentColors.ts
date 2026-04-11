import { BLOCK_COLOR_COUNT } from "../game/blockStyle.js";

const LS_KEY = "nspace_recent_color_ids";
const MAX_RECENT = 4;
const DEFAULT: number[] = [0, 1, 2, 3];

function clampId(id: number): number {
  return Math.max(0, Math.min(BLOCK_COLOR_COUNT - 1, Math.floor(id)));
}

export function loadRecentColorIds(): number[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [...DEFAULT];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [...DEFAULT];
    const out: number[] = [];
    for (const x of arr) {
      const n = clampId(Number(x));
      if (!out.includes(n)) out.push(n);
      if (out.length >= MAX_RECENT) break;
    }
    while (out.length < MAX_RECENT) {
      let added = false;
      for (const d of DEFAULT) {
        if (out.length >= MAX_RECENT) break;
        if (!out.includes(d)) {
          out.push(d);
          added = true;
        }
      }
      if (!added) break;
    }
    return out.slice(0, MAX_RECENT);
  } catch {
    return [...DEFAULT];
  }
}

function saveRecent(ids: readonly number[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(ids.slice(0, MAX_RECENT)));
  } catch {
    /* ignore */
  }
}

/** Push `id` to the front of recent; returns the new list. */
export function pushRecentColorId(id: number): number[] {
  const clamped = clampId(id);
  const cur = loadRecentColorIds().filter((x) => x !== clamped);
  const next = [clamped, ...cur].slice(0, MAX_RECENT);
  saveRecent(next);
  return next;
}
