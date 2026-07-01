import * as THREE from "three";
// Use the ESM bundle entry so `IdenticonsAssets` is available; the package
// `browser` field points at identicons.min.js which has no named export.
import Identicons, { IdenticonsAssets } from "@nimiq/identicons/dist/identicons.bundle.min.js";
import { toNimiqUserFriendlyForIdenticon } from "../nimiqIdenticonAddress.js";

/**
 * @nimiq/identicons loads sprite parts from `IdenticonsAssets` only if that
 * name exists as a **global**. The ESM bundle exports the string but does not
 * set `globalThis`, so Vite/Rollup builds fall back to fetching
 * `/node_modules/@nimiq/identicons/dist/identicons.min.svg` (404) and only the
 * base hex/circle renders.
 */
type IdenticonsGlobal = typeof globalThis & { IdenticonsAssets?: string };
const identiconsGlobal = globalThis as IdenticonsGlobal;
if (identiconsGlobal.IdenticonsAssets === undefined) {
  identiconsGlobal.IdenticonsAssets = IdenticonsAssets;
}

function identiconCacheKey(address: string): string {
  return toNimiqUserFriendlyForIdenticon(address);
}

const dataUrlPending = new Map<string, Promise<string>>();
const dataUrlResolved = new Map<string, string>();
const texturePending = new Map<string, Promise<THREE.CanvasTexture>>();
const textureResolved = new Map<string, THREE.CanvasTexture>();

/**
 * SVG data URL for `<img src>` (e.g. lobby).
 * `@nimiq/identicons` composes the face from embedded sprite paths into one SVG document;
 * `toDataUrl()` returns `data:image/svg+xml;base64,...` - plate / background shapes are normal SVG fills, not separate HTML.
 */
export function identiconDataUrl(address: string): Promise<string> {
  const key = identiconCacheKey(address);
  if (!key) return Promise.resolve("");
  const resolved = dataUrlResolved.get(key);
  if (resolved) return Promise.resolve(resolved);
  let pending = dataUrlPending.get(key);
  if (!pending) {
    pending = Identicons.toDataUrl(key).then((url) => {
      dataUrlResolved.set(key, url);
      return url;
    });
    dataUrlPending.set(key, pending);
  }
  return pending;
}

async function buildIdenticonTexture(key: string): Promise<THREE.CanvasTexture> {
  const dataUrl = await identiconDataUrl(key);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      // 256 (was 128): the wardrobe/profile preview renders the identicon large on high-DPR
      // screens, where 128px upscaled looked soft. SVG source rasterizes crisply at 256, and the
      // extra texture cost is negligible for the small in-world avatar billboards.
      const size = 256;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("no_2d"));
        return;
      }
      ctx.drawImage(img, 0, 0, size, size);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      textureResolved.set(key, tex);
      resolve(tex);
    };
    img.onerror = () => reject(new Error("identicon_load"));
    img.src = dataUrl;
  });
}

/**
 * Nimiq wallet identicon as a texture (deterministic from address string).
 */
export function loadIdenticonTexture(
  address: string
): Promise<THREE.CanvasTexture> {
  const key = identiconCacheKey(address);
  if (!key) return Promise.reject(new Error("identicon_empty"));
  const resolved = textureResolved.get(key);
  if (resolved) return Promise.resolve(resolved);
  let pending = texturePending.get(key);
  if (!pending) {
    pending = buildIdenticonTexture(key).catch((err) => {
      texturePending.delete(key);
      throw err;
    });
    texturePending.set(key, pending);
  }
  return pending;
}

/** Synchronous lookup after {@link loadIdenticonTexture} has resolved for this address. */
export function peekIdenticonTexture(
  address: string
): THREE.CanvasTexture | undefined {
  const key = identiconCacheKey(address);
  return key ? textureResolved.get(key) : undefined;
}

/** Shared identicon textures must not be disposed with individual avatar sprites. */
export function isCachedIdenticonTexture(tex: THREE.Texture): boolean {
  for (const cached of textureResolved.values()) {
    if (cached === tex) return true;
  }
  return false;
}

/** Start generating SVG + raster textures so UI can reuse them without a visible placeholder flash. */
export function warmIdenticonCache(address: string): void {
  const key = identiconCacheKey(address);
  if (!key) return;
  void identiconDataUrl(key);
  void loadIdenticonTexture(key);
}
