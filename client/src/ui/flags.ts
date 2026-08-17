/**
 * Country-flag rendering as Twemoji images.
 *
 * Windows ships no country-flag glyphs, so flag emoji fall back to the two regional-indicator
 * letters (e.g. "AT") in Chromium/Brave. We render flags as self-hosted Twemoji SVGs instead.
 * Assets live in `client/public/flags/<cc>.svg` (see `scripts/fetch-flag-svgs.mjs`).
 * Mosquito (🦟) uses native system text when the font has the glyph, and the same
 * Twemoji path (`client/public/emoji/1f99f.svg`) when it does not (common on Windows).
 * Same-origin assets keep canvas `drawImage` untainted.
 *
 * This module is intentionally free of any World Cup dependency so chat / profile code can use
 * it even when the seasonal feature is removed.
 */

const VALID = /^[A-Z]{2}$/;
const REGIONAL_BASE = 0x1f1e6;
const REGIONAL_LAST = 0x1f1ff;

/** Mosquito (U+1F99F). Native when the font has it; otherwise Twemoji. */
export const MOSQUITO_EMOJI = "\u{1F99F}";

/** Same-origin Twemoji SVG for the mosquito glyph. */
export function mosquitoAssetUrl(): string {
  return "/emoji/1f99f.svg";
}

const MOSQUITO_PROBE_FONT =
  '16px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
/** A code point that never has a glyph; used to recognize tofu. */
const MISSING_GLYPH = "\uFFFE";

let mosquitoTwemojiOverride: boolean | null = null;
let mosquitoTwemojiCached: boolean | null = null;

function glyphPixelBuffer(
  text: string,
  fillStyle = "#000"
): Uint8ClampedArray | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 24;
  canvas.height = 24;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = fillStyle;
  ctx.textBaseline = "top";
  ctx.font = MOSQUITO_PROBE_FONT;
  ctx.fillText(text, 2, 2);
  return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
}

function pixelBuffersEqual(a: Uint8ClampedArray, b: Uint8ClampedArray): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function bufferHasInk(data: Uint8ClampedArray): boolean {
  for (let i = 3; i < data.length; i += 4) {
    if ((data[i] ?? 0) > 0) return true;
  }
  return false;
}

/** Color emoji fonts ignore fillStyle; tofu uses it. */
function hasNonFillColor(data: Uint8ClampedArray): boolean {
  for (let i = 0; i < data.length; i += 4) {
    if ((data[i + 3] ?? 0) === 0) continue;
    if (data[i] !== 0 || data[i + 1] !== 0 || data[i + 2] !== 255) return true;
  }
  return false;
}

function probeMosquitoNeedsTwemoji(): boolean {
  try {
    const fill = "rgb(0, 0, 255)";
    const mosquito = glyphPixelBuffer(MOSQUITO_EMOJI, fill);
    const missing = glyphPixelBuffer(MISSING_GLYPH, fill);
    if (!mosquito || !missing) return false;
    if (hasNonFillColor(mosquito)) return false;
    if (!bufferHasInk(mosquito)) return true;
    return pixelBuffersEqual(mosquito, missing);
  } catch {
    return false;
  }
}

/** True when this client cannot paint 🦟 as a system glyph. */
export function mosquitoNeedsTwemoji(): boolean {
  if (mosquitoTwemojiOverride !== null) return mosquitoTwemojiOverride;
  if (mosquitoTwemojiCached === null) {
    mosquitoTwemojiCached = probeMosquitoNeedsTwemoji();
  }
  return mosquitoTwemojiCached;
}

/** Test-only: force Twemoji on/off, or `null` to use the live probe. */
export function setMosquitoTwemojiOverrideForTests(needs: boolean | null): void {
  mosquitoTwemojiOverride = needs;
}

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

function createMosquitoImg(opts?: FlagImgOpts): HTMLImageElement {
  const img = document.createElement("img");
  img.className = opts?.className ?? "flag-emoji";
  img.src = mosquitoAssetUrl();
  img.alt = MOSQUITO_EMOJI;
  img.draggable = false;
  img.decoding = "async";
  img.loading = "lazy";
  if (opts?.size) {
    img.style.width = opts.size;
    img.style.height = opts.size;
  }
  if (opts?.title) img.title = opts.title;
  return img;
}

/**
 * Append `text` to `parent`, replacing flag emoji (and mosquito, when this client
 * has no glyph) with `<img>` glyphs and keeping the rest as plain text nodes
 * (XSS-safe - never uses innerHTML). Other emoji stay as text.
 */
export function appendTextWithFlags(
  parent: Node,
  text: string,
  opts?: FlagImgOpts
): void {
  const glyphRe = mosquitoNeedsTwemoji()
    ? /(?:[\u{1F1E6}-\u{1F1FF}]{2}|\u{1F99F})/gu
    : /[\u{1F1E6}-\u{1F1FF}]{2}/gu;
  let last = 0;
  for (const m of text.matchAll(glyphRe)) {
    const idx = m.index ?? 0;
    if (idx > last) {
      parent.appendChild(document.createTextNode(text.slice(last, idx)));
    }
    const token = m[0];
    if (token === MOSQUITO_EMOJI) {
      parent.appendChild(createMosquitoImg(opts));
    } else {
      const code = codeFromFlagEmoji(token);
      const img = code ? createFlagImg(code, opts) : null;
      parent.appendChild(img ?? document.createTextNode(token));
    }
    last = idx + token.length;
  }
  if (last < text.length) {
    parent.appendChild(document.createTextNode(text.slice(last)));
  }
}

/** If `text` is exactly one flag emoji (the Flag Emote case), its ISO code; else null. */
export function soleFlagCode(text: string): string | null {
  return codeFromFlagEmoji(text.trim());
}

/** True when `text` is exactly the mosquito emoji (paste or Emote Wheel). */
export function isSoleMosquitoEmoji(text: string): boolean {
  return text.trim() === MOSQUITO_EMOJI;
}

export type MosquitoLineSeg =
  | { kind: "text"; text: string; width: number }
  | { kind: "mosquito"; width: number };

/** Split a canvas bubble line so missing mosquito glyphs can be drawn as Twemoji. */
export function layoutLineWithMosquitoGlyphs(
  line: string,
  measure: (s: string) => number,
  mosquitoSize: number
): { segs: MosquitoLineSeg[]; totalWidth: number } {
  const segs: MosquitoLineSeg[] = [];
  let last = 0;
  let totalWidth = 0;
  const re = /\u{1F99F}/gu;
  for (const m of line.matchAll(re)) {
    const idx = m.index ?? 0;
    if (idx > last) {
      const text = line.slice(last, idx);
      const width = measure(text);
      segs.push({ kind: "text", text, width });
      totalWidth += width;
    }
    segs.push({ kind: "mosquito", width: mosquitoSize });
    totalWidth += mosquitoSize;
    last = idx + m[0].length;
  }
  if (last < line.length) {
    const text = line.slice(last);
    const width = measure(text);
    segs.push({ kind: "text", text, width });
    totalWidth += width;
  }
  return { segs, totalWidth };
}

// --- Canvas / texture image loading (3D crowd banners, billboards, chat bubbles) -----------

const imgCache = new Map<string, HTMLImageElement>();
const pending = new Map<string, Promise<HTMLImageElement | null>>();

function loadCachedImage(
  cacheKey: string,
  url: string
): Promise<HTMLImageElement | null> {
  const ready = imgCache.get(cacheKey);
  if (ready) return Promise.resolve(ready);
  const inFlight = pending.get(cacheKey);
  if (inFlight) return inFlight;
  const p = new Promise<HTMLImageElement | null>((resolvePromise) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      imgCache.set(cacheKey, img);
      pending.delete(cacheKey);
      resolvePromise(img);
    };
    img.onerror = () => {
      pending.delete(cacheKey);
      resolvePromise(null);
    };
    img.src = url;
  });
  pending.set(cacheKey, p);
  return p;
}

const MOSQUITO_CACHE_KEY = "MOSQUITO";

/** A decoded mosquito image if it is already loaded, else null. */
export function getMosquitoImageIfReady(): HTMLImageElement | null {
  return imgCache.get(MOSQUITO_CACHE_KEY) ?? null;
}

/** Load (and cache) the mosquito Twemoji for canvas drawing. */
export function loadMosquitoImage(): Promise<HTMLImageElement | null> {
  return loadCachedImage(MOSQUITO_CACHE_KEY, mosquitoAssetUrl());
}

/** A decoded flag image if it is already loaded (for synchronous canvas draws), else null. */
export function getFlagImageIfReady(code: string): HTMLImageElement | null {
  return imgCache.get(code.trim().toUpperCase()) ?? null;
}

/** Load (and cache) the flag image for canvas drawing. Resolves null on invalid/failed load. */
export function loadFlagImage(code: string): Promise<HTMLImageElement | null> {
  const cc = code.trim().toUpperCase();
  const url = flagAssetUrl(cc);
  if (!url) return Promise.resolve(null);
  return loadCachedImage(cc, url);
}
