import nimiqIconsData from "nimiq-icons/icons.json";
import * as THREE from "three";
import {
  ACHIEVEMENT_CELEBRATION_DURATION_MS,
  ACHIEVEMENT_CELEBRATION_ICON_COLOR,
  ACHIEVEMENT_CELEBRATION_POP_MS,
  celebrationOpacity,
  celebrationPopScale,
  celebrationSpringYOffset,
} from "./celebrationPolicy.js";

const CELEBRATION_ICON_RASTER_PX = 128;
const NIMIQ_STARBURST_ICON_ID = "starburst";

let sharedCelebrationTexture: THREE.CanvasTexture | null = null;
let sharedCelebrationTexturePromise: Promise<THREE.CanvasTexture> | null = null;

function starburstSvgMarkup(): string {
  const ic = nimiqIconsData.icons[NIMIQ_STARBURST_ICON_ID];
  if (!ic?.body) {
    throw new Error("[achievementCelebration] nimiq-icons: missing starburst");
  }
  // Icon art is ~13×12; square viewBox avoids horizontal stretch when rasterized.
  const size = Math.max(ic.width ?? 13, ic.height ?? 12, 13);
  const body = ic.body.replace(/currentColor/g, ACHIEVEMENT_CELEBRATION_ICON_COLOR);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${String(size)} ${String(size)}" ` +
    `fill="${ACHIEVEMENT_CELEBRATION_ICON_COLOR}" aria-hidden="true">${body}</svg>`
  );
}

function drawStarburstIntoSquareCanvas(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  out: number
): void {
  ctx.clearRect(0, 0, out, out);
  const pad = out * 0.1;
  const inner = out - pad * 2;
  const iw =
    "naturalWidth" in img && img.naturalWidth > 0 ? img.naturalWidth : out;
  const ih =
    "naturalHeight" in img && img.naturalHeight > 0 ? img.naturalHeight : out;
  const scale = Math.min(inner / iw, inner / ih);
  const w = iw * scale;
  const h = ih * scale;
  const x = pad + (inner - w) * 0.5;
  const y = pad + (inner - h) * 0.5;

  const drawIcon = (shadowBlur: number, shadowAlpha: number): void => {
    ctx.save();
    ctx.shadowColor = `rgba(233, 184, 115, ${shadowAlpha})`;
    ctx.shadowBlur = shadowBlur;
    ctx.drawImage(img, x, y, w, h);
    ctx.restore();
  };

  drawIcon(out * 0.18, 0.72);
  drawIcon(out * 0.08, 0.45);
  ctx.drawImage(img, x, y, w, h);
}

/** Cached raster when preload finished; null until {@link ensureAchievementCelebrationTexture} resolves. */
export function getAchievementCelebrationTexture(): THREE.CanvasTexture | null {
  return sharedCelebrationTexture;
}

/** Rasterize Nimiq `i-nimiq:starburst` once for all celebration sprites. */
export function ensureAchievementCelebrationTexture(): Promise<THREE.CanvasTexture> {
  if (sharedCelebrationTexture) return Promise.resolve(sharedCelebrationTexture);
  if (sharedCelebrationTexturePromise) return sharedCelebrationTexturePromise;
  sharedCelebrationTexturePromise = new Promise((resolve, reject) => {
    const svg = starburstSvgMarkup();
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const out = CELEBRATION_ICON_RASTER_PX;
      const canvas = document.createElement("canvas");
      canvas.width = out;
      canvas.height = out;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("2d context unavailable"));
        return;
      }
      drawStarburstIntoSquareCanvas(ctx, img, out);
      URL.revokeObjectURL(url);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      tex.needsUpdate = true;
      sharedCelebrationTexture = tex;
      resolve(tex);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("[achievementCelebration] failed to rasterize starburst"));
    };
    img.src = url;
  });
  return sharedCelebrationTexturePromise;
}

export type AchievementCelebrationSprite = {
  id: number;
  address: string;
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  startedAt: number;
};

export type AchievementCelebrationLayout = {
  /** World-space square side length (recomputed each frame for zoom-stable screen size). */
  worldSize: number;
  /** Rest Y above the avatar group origin before spring offset. */
  baseY: number;
};

export function spawnAchievementCelebrationSprite(
  texture: THREE.CanvasTexture,
  layout: AchievementCelebrationLayout,
  address: string,
  id: number,
  startedAt: number
): AchievementCelebrationSprite {
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.renderOrder = 998;
  sprite.raycast = () => {};
  sprite.userData["skipBlockPickAndBounds"] = true;
  sprite.position.set(0, layout.baseY, 0);
  sprite.scale.set(0, 0, 1);
  return {
    id,
    address,
    sprite,
    material,
    startedAt,
  };
}

/** Advance one celebration pop; returns false when finished. */
export function updateAchievementCelebrationSprite(
  entry: AchievementCelebrationSprite,
  now: number,
  layout: AchievementCelebrationLayout
): boolean {
  const elapsed = now - entry.startedAt;
  const progress = elapsed / ACHIEVEMENT_CELEBRATION_DURATION_MS;
  if (progress >= 1) return false;
  const popProgress = Math.min(1, elapsed / ACHIEVEMENT_CELEBRATION_POP_MS);
  const scaleMul = celebrationPopScale(popProgress);
  const worldSize = layout.worldSize * scaleMul;
  entry.sprite.scale.set(worldSize, worldSize, 1);
  entry.sprite.position.y =
    layout.baseY + celebrationSpringYOffset(progress) * layout.worldSize;
  entry.material.opacity = celebrationOpacity(progress);
  return true;
}

export function disposeAchievementCelebrationSprite(
  entry: AchievementCelebrationSprite,
  sharedTexture: THREE.CanvasTexture | null
): void {
  entry.sprite.removeFromParent();
  entry.material.map = sharedTexture;
  entry.material.dispose();
}
