import * as THREE from "three";
import {
  ACHIEVEMENT_CELEBRATION_DURATION_MS,
  ACHIEVEMENT_CELEBRATION_POP_MS,
  ACHIEVEMENT_TROPHY_ASSET_URL,
  celebrationOpacity,
  celebrationPopScale,
  celebrationSpringYOffset,
} from "./celebrationPolicy.js";

let sharedTrophyTexture: THREE.CanvasTexture | null = null;
let sharedTrophyTexturePromise: Promise<THREE.CanvasTexture> | null = null;

/** Load (or reuse) the shared trophy raster for Achievement Unlock Celebrations. */
export function loadAchievementTrophyTexture(): Promise<THREE.CanvasTexture> {
  if (sharedTrophyTexture) return Promise.resolve(sharedTrophyTexture);
  if (sharedTrophyTexturePromise) return sharedTrophyTexturePromise;
  sharedTrophyTexturePromise = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const size = 128;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("2d context unavailable"));
        return;
      }
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      tex.needsUpdate = true;
      sharedTrophyTexture = tex;
      resolve(tex);
    };
    img.onerror = () =>
      reject(new Error(`failed to load ${ACHIEVEMENT_TROPHY_ASSET_URL}`));
    img.src = ACHIEVEMENT_TROPHY_ASSET_URL;
  });
  return sharedTrophyTexturePromise;
}

export type AchievementCelebrationSprite = {
  id: number;
  address: string;
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  startedAt: number;
  baseScaleX: number;
  baseScaleY: number;
  baseY: number;
};

export function spawnAchievementCelebrationSprite(
  texture: THREE.CanvasTexture,
  baseScaleX: number,
  baseScaleY: number,
  baseY: number,
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
  sprite.position.set(0, baseY, 0);
  sprite.scale.set(0, 0, 1);
  return {
    id,
    address,
    sprite,
    material,
    startedAt,
    baseScaleX,
    baseScaleY,
    baseY,
  };
}

/** Advance one celebration pop; returns false when finished. */
export function updateAchievementCelebrationSprite(
  entry: AchievementCelebrationSprite,
  now: number
): boolean {
  const elapsed = now - entry.startedAt;
  const progress = elapsed / ACHIEVEMENT_CELEBRATION_DURATION_MS;
  if (progress >= 1) return false;
  const popProgress = Math.min(1, elapsed / ACHIEVEMENT_CELEBRATION_POP_MS);
  const scaleMul = celebrationPopScale(popProgress);
  entry.sprite.scale.set(
    entry.baseScaleX * scaleMul,
    entry.baseScaleY * scaleMul,
    1
  );
  entry.sprite.position.y = entry.baseY + celebrationSpringYOffset(progress);
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
