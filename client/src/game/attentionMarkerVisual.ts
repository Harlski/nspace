/**
 * Attention Marker client visuals — fixed V glyph, glow, bounce offset helpers.
 * Baseline (co-occupant top) is resolved by Game when positioning.
 */

import * as THREE from "three";

export const ATTENTION_MARKER_HOVER_HEIGHT_DEFAULT = 1;
export const ATTENTION_MARKER_STEP_Y = 0.45;
export const ATTENTION_MARKER_BOUNCE_AMP = 0.08;
export const ATTENTION_MARKER_BOUNCE_SPEED = 2.2;

export type AttentionMarkerWire = {
  x: number;
  z: number;
  hoverHeight: number;
  colorRgb: number;
};

/** World Y offset from co-occupant top (or floor) for a Hover Height step. */
export function attentionMarkerHoverLift(hoverHeight: number): number {
  const h = Math.max(0, Math.min(3, Math.floor(hoverHeight)));
  return h * ATTENTION_MARKER_STEP_Y + 0.35;
}

export function attentionMarkerBounceOffset(timeSec: number): number {
  return (
    Math.sin(timeSec * ATTENTION_MARKER_BOUNCE_SPEED * Math.PI * 2) *
    ATTENTION_MARKER_BOUNCE_AMP
  );
}

/** Build a V group with body + soft glow shell. */
export function makeAttentionMarkerGroup(colorRgb: number): THREE.Group {
  const group = new THREE.Group();
  group.name = "attentionMarker";
  group.userData.skipBlockPickAndBounds = true;
  group.userData.attentionMarker = true;

  const color = new THREE.Color(colorRgb >>> 0);
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive: color.clone(),
    emissiveIntensity: 0.85,
    metalness: 0.1,
    roughness: 0.35,
  });
  const glowMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });

  const addLeg = (sign: 1 | -1) => {
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.9, 0.14),
      mat.clone()
    );
    leg.rotation.z = (sign * -28 * Math.PI) / 180;
    leg.position.set(sign * -0.2, 0.38, 0);
    leg.userData.skipBlockPickAndBounds = true;
    group.add(leg);
    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 1.05, 0.22),
      glowMat.clone()
    );
    glow.rotation.copy(leg.rotation);
    glow.position.copy(leg.position);
    glow.userData.skipBlockPickAndBounds = true;
    group.add(glow);
  };
  addLeg(1);
  addLeg(-1);

  return group;
}

export function tintAttentionMarkerGroup(
  group: THREE.Group,
  colorRgb: number
): void {
  const color = new THREE.Color(colorRgb >>> 0);
  group.traverse((obj: THREE.Object3D) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const m = obj.material;
    if (Array.isArray(m)) return;
    if (m instanceof THREE.MeshStandardMaterial) {
      m.color.copy(color);
      m.emissive.copy(color);
    } else if (m instanceof THREE.MeshBasicMaterial) {
      m.color.copy(color);
    }
  });
}
