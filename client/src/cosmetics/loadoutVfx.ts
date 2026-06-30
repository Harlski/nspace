import * as THREE from "three";
import {
  attachCosmeticPrefabSafe,
  avatarTrailMoving,
  buildStaticPreviewTrail,
  cosmeticTrailPresetForGroup,
  disposeCosmeticPrefab,
  disposeCosmeticTrailPuffs,
  orientStaticPreviewTrail,
  syncCosmeticLoadoutVfx,
  tickCosmeticPreviewMotion,
  tickCosmeticTrailForAvatar,
  tickCosmeticTrailSpawn,
  updateCosmeticAuraForGroup,
  updateCosmeticTrailPuffs,
  updateCosmeticTrailPuffsForGroup,
  type CosmeticTrailPuff,
} from "./cosmeticPrefabFactory.js";
import { cosmeticPrefabTint } from "./cosmeticPrefabRegistry.js";

export {
  attachCosmeticPrefabSafe,
  avatarTrailMoving,
  buildStaticPreviewTrail,
  cosmeticTrailPresetForGroup,
  disposeCosmeticPrefab,
  disposeCosmeticTrailPuffs,
  orientStaticPreviewTrail,
  syncCosmeticLoadoutVfx,
  tickCosmeticPreviewMotion,
  tickCosmeticTrailForAvatar,
  tickCosmeticTrailSpawn,
  updateCosmeticAuraForGroup,
  updateCosmeticTrailPuffs,
  updateCosmeticTrailPuffsForGroup,
  type CosmeticTrailPuff,
};

export type PersistentDeployableFx = {
  root: THREE.Group;
  dispose: () => void;
};

const SKIP = "skipBlockPickAndBounds";

export function nameplateColorForPreset(presetId: string | null | undefined): string | null {
  if (!presetId) return null;
  const tint = cosmeticPrefabTint(presetId);
  if (tint === null) return null;
  return `#${tint.toString(16).padStart(6, "0")}`;
}

export function chatBubbleClassForPreset(
  presetId: string | null | undefined
): string | null {
  if (!presetId) return null;
  return null;
}

export function spawnDeployableVfx(
  scene: THREE.Scene,
  presetId: string,
  x: number,
  z: number,
  expiresAt: number
): void {
  const color = presetId === "deployable-confetti-burst" ? 0xff66aa : 0xffffff;
  const geo = new THREE.RingGeometry(0.2, 0.9, 24);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, 0.06, z);
  mesh.userData[SKIP] = true;
  scene.add(mesh);
  const ttl = Math.max(500, expiresAt - Date.now());
  window.setTimeout(() => {
    scene.remove(mesh);
    geo.dispose();
    mat.dispose();
  }, ttl);
}

export function attachPersistentDeployableVfx(
  scene: THREE.Scene,
  presetId: string,
  x: number,
  z: number
): PersistentDeployableFx {
  const color = presetId === "deployable-confetti-burst" ? 0xff66aa : 0xffffff;
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  root.userData[SKIP] = true;

  const geo = new THREE.RingGeometry(0.2, 0.9, 24);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.06;
  mesh.userData[SKIP] = true;
  root.add(mesh);
  scene.add(root);

  return {
    root,
    dispose: () => {
      root.removeFromParent();
      geo.dispose();
      mat.dispose();
    },
  };
}

export function spawnDeployablePreviewBurst(
  scene: THREE.Scene,
  presetId: string,
  x: number,
  z: number
): PersistentDeployableFx {
  return attachPersistentDeployableVfx(scene, presetId, x, z);
}
