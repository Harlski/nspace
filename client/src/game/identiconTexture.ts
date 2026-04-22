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

/** PNG data URL for use in `<img src>` (e.g. lobby). */
export function identiconDataUrl(address: string): Promise<string> {
  return Identicons.toDataUrl(toNimiqUserFriendlyForIdenticon(address));
}

/**
 * Nimiq wallet identicon as a texture (deterministic from address string).
 */
export async function loadIdenticonTexture(
  address: string
): Promise<THREE.CanvasTexture> {
  const dataUrl = await Identicons.toDataUrl(
    toNimiqUserFriendlyForIdenticon(address)
  );
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const size = 128;
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
      resolve(tex);
    };
    img.onerror = () => reject(new Error("identicon_load"));
    img.src = dataUrl;
  });
}
