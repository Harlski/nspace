const tintCache = new Map<string, string>();

function cacheKey(src: string, tint: number): string {
  return `${src}#${(tint >>> 0).toString(16).padStart(6, "0")}`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load sprite: ${src}`));
    img.src = src;
  });
}

/** Match in-game MeshBasicMaterial tint - multiply Kenney sprite RGB by preset colour. */
export async function tintedKenneySpriteDataUrl(
  src: string,
  tint: number
): Promise<string> {
  const key = cacheKey(src, tint);
  const hit = tintCache.get(key);
  if (hit) return hit;

  const img = await loadImage(src);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return src;

  ctx.drawImage(img, 0, 0);
  // Match Three.js MeshBasicMaterial map × color - black Kenney backdrop stays dark.
  ctx.globalCompositeOperation = "multiply";
  const r = (tint >> 16) & 255;
  const g = (tint >> 8) & 255;
  const b = tint & 255;
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, w, h);

  const dataUrl = canvas.toDataURL("image/png");
  tintCache.set(key, dataUrl);
  return dataUrl;
}

/** Test seam - clears tinted sprite cache between vitest cases. */
export function resetCosmeticSwatchTintCacheForTests(): void {
  tintCache.clear();
}
