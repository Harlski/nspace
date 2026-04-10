import * as THREE from "three";
import Identicons from "@nimiq/identicons";

/**
 * Nimiq wallet identicon as a texture (deterministic from address string).
 */
export async function loadIdenticonTexture(
  address: string
): Promise<THREE.CanvasTexture> {
  const dataUrl = await Identicons.toDataUrl(address);
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
