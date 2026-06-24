import * as THREE from "three";
import type { PlayerState } from "../types.js";

const SKIP = "skipBlockPickAndBounds";
const AURA_KEY = "cosmeticAuraMesh";
const TRAIL_KEY = "cosmeticTrailMesh";

const AURA_COLORS: Record<string, number> = {
  "aura-glow-blue": 0x4488ff,
  "aura-glow-gold": 0xffcc44,
};

const NAMEPLATE_COLORS: Record<string, string> = {
  "nameplate-frame-simple": "#c8d4e4",
  "nameplate-frame-neon": "#00ffcc",
};

export function nameplateColorForPreset(presetId: string | null | undefined): string | null {
  if (!presetId) return null;
  return NAMEPLATE_COLORS[presetId] ?? null;
}

export function chatBubbleClassForPreset(
  presetId: string | null | undefined
): string | null {
  if (!presetId) return null;
  if (presetId === "bubble-rounded-pastel") return "chat-bubble--cosmetic-pastel";
  if (presetId === "bubble-sharp-dark") return "chat-bubble--cosmetic-dark";
  return null;
}

function ensureAura(group: THREE.Group, presetId: string | null | undefined): void {
  let mesh = group.getObjectByName(AURA_KEY) as THREE.Mesh | undefined;
  if (!presetId || !AURA_COLORS[presetId]) {
    if (mesh) {
      group.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    return;
  }
  if (!mesh) {
    const geo = new THREE.RingGeometry(0.55, 0.72, 32);
    const mat = new THREE.MeshBasicMaterial({
      color: AURA_COLORS[presetId]!,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    mesh = new THREE.Mesh(geo, mat);
    mesh.name = AURA_KEY;
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.02;
    mesh.userData[SKIP] = true;
    group.add(mesh);
  } else {
    (mesh.material as THREE.MeshBasicMaterial).color.setHex(AURA_COLORS[presetId]!);
    mesh.visible = true;
  }
}

function ensureTrail(group: THREE.Group, presetId: string | null | undefined): void {
  let mesh = group.getObjectByName(TRAIL_KEY) as THREE.Mesh | undefined;
  if (!presetId) {
    if (mesh) mesh.visible = false;
    return;
  }
  if (!mesh) {
    const geo = new THREE.SphereGeometry(0.08, 8, 8);
    const color = presetId === "trail-smoke" ? 0x888888 : 0xffffff;
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    mesh = new THREE.Mesh(geo, mat);
    mesh.name = TRAIL_KEY;
    mesh.position.set(0, 0.15, -0.35);
    mesh.userData[SKIP] = true;
    mesh.visible = false;
    group.add(mesh);
  }
  mesh.userData["cosmeticTrailPreset"] = presetId;
}

export function syncCosmeticLoadoutVfx(
  group: THREE.Group,
  player: PlayerState,
  movedRecently: boolean
): void {
  ensureAura(group, player.cosmeticAura);
  ensureTrail(group, player.cosmeticTrail);
  const trail = group.getObjectByName(TRAIL_KEY) as THREE.Mesh | undefined;
  if (trail) {
    trail.visible = movedRecently && !!player.cosmeticTrail;
  }
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
