/**
 * Country-flag rendering as Twemoji images.
 *
 * Windows ships no country-flag glyphs, so flag emoji fall back to the two regional-indicator
 * letters (e.g. "AT") in Chromium/Brave. We render flags as self-hosted Twemoji SVGs instead.
 * Assets live in `client/public/flags/<cc>.svg` (see `scripts/fetch-flag-svgs.mjs`) and are
 * served same-origin so `drawImage` onto canvases (3D crowd banners) stays untainted.
 *
 * This module is intentionally free of any World Cup dependency so chat / profile code can use
 * it even when the seasonal feature is removed.
 */

const VALID = /^[A-Z]{2}$/;
const REGIONAL_BASE = 0x1f1e6;
const REGIONAL_LAST = 0x1f1ff;

/** A regional-indicator flag emoji sequence (two letters), for locating flags in free text. */
const FLAG_RE = /[\u{1F1E6}-\u{1F1FF}]{2}/gu;

/** URL of the self-hosted flag SVG for an ISO alpha-2 code, or null if the code is invalid. */
export function flagAssetUrl(code: string): string | null {
  const cc = code.trim().toUpperCase();
  if (!VALID.test(cc)) return null;
  return `/flags/${cc.toLowerCase()}.svg`;
}

/** ISO alpha-2 code for a single regional-indicator pair (e.g. "🇧🇷" → "BR"), or null. */
export function codeFromFlagEmoji(emoji: string): string | null {
  const cps = [...emoji.trim()];
  if (cps.length !== 2) return null;
  const a = cps[0]!.codePointAt(0)!;
  const b = cps[1]!.codePointAt(0)!;
  if (a < REGIONAL_BASE || a > REGIONAL_LAST || b < REGIONAL_BASE || b > REGIONAL_LAST) {
    return null;
  }
  return String.fromCharCode(65 + (a - REGIONAL_BASE), 65 + (b - REGIONAL_BASE));
}

type FlagImgOpts = { className?: string; size?: string; title?: string };

/** Create an `<img>` element for a flag, or null if the code is invalid. */
export function createFlagImg(
  code: string,
  opts?: FlagImgOpts
): HTMLImageElement | null {
  const url = flagAssetUrl(code);
  if (!url) return null;
  const img = document.createElement("img");
  img.className = opts?.className ?? "flag-emoji";
  img.src = url;
  img.alt = code.trim().toUpperCase(); // graceful text fallback if the asset 404s
  img.draggable = false;
  img.decoding = "async";
  img.loading = "lazy"; // the country picker mounts ~200 flags at once
  if (opts?.size) {
    img.style.width = opts.size;
    img.style.height = opts.size;
  }
  if (opts?.title) img.title = opts.title;
  return img;
}

/**
 * Append `text` to `parent`, replacing any flag emoji with `<img>` flags and keeping the rest as
 * plain text nodes (XSS-safe — never uses innerHTML). Non-flag emoji are left as text (they
 * render fine on Windows). Use for chat lines / labels that may contain a flag.
 */
export function appendTextWithFlags(
  parent: Node,
  text: string,
  opts?: FlagImgOpts
): void {
  let last = 0;
  for (const m of text.matchAll(FLAG_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) {
      parent.appendChild(document.createTextNode(text.slice(last, idx)));
    }
    const code = codeFromFlagEmoji(m[0]);
    const img = code ? createFlagImg(code, opts) : null;
    parent.appendChild(img ?? document.createTextNode(m[0]));
    last = idx + m[0].length;
  }
  if (last < text.length) {
    parent.appendChild(document.createTextNode(text.slice(last)));
  }
}

/** If `text` is exactly one flag emoji (the Flag Emote case), its ISO code; else null. */
export function soleFlagCode(text: string): string | null {
  return codeFromFlagEmoji(text.trim());
}

// --- Canvas / texture image loading (3D crowd banners, billboards, chat bubbles) -----------

const imgCache = new Map<string, HTMLImageElement>();
const pending = new Map<string, Promise<HTMLImageElement | null>>();

/** A decoded flag image if it is already loaded (for synchronous canvas draws), else null. */
export function getFlagImageIfReady(code: string): HTMLImageElement | null {
  return imgCache.get(code.trim().toUpperCase()) ?? null;
}

/** Load (and cache) the flag image for canvas drawing. Resolves null on invalid/failed load. */
export function loadFlagImage(code: string): Promise<HTMLImageElement | null> {
  const cc = code.trim().toUpperCase();
  const ready = imgCache.get(cc);
  if (ready) return Promise.resolve(ready);
  const inFlight = pending.get(cc);
  if (inFlight) return inFlight;
  const url = flagAssetUrl(cc);
  if (!url) return Promise.resolve(null);
  const p = new Promise<HTMLImageElement | null>((resolvePromise) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      imgCache.set(cc, img);
      pending.delete(cc);
      resolvePromise(img);
    };
    img.onerror = () => {
      pending.delete(cc);
      resolvePromise(null);
    };
    img.src = url;
  });
  pending.set(cc, p);
  return p;
}
