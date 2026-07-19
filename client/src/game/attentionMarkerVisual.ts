/**
 * Attention Marker client visuals — fixed V glyph, glow, bounce offset helpers.
 * Baseline (co-occupant top) is resolved by Game when positioning.
 */

import * as THREE from "three";

export const ATTENTION_MARKER_HOVER_HEIGHT_DEFAULT = 1;
export const ATTENTION_MARKER_STEP_Y = 0.45;
export const ATTENTION_MARKER_BOUNCE_AMP = 0.08;
export const ATTENTION_MARKER_BOUNCE_SPEED = 2.2;
export const ATTENTION_MARKER_SIZE_PERCENT_DEFAULT = 100;
export const ATTENTION_MARKER_SIZE_PERCENT_MIN = 20;
export const ATTENTION_MARKER_SIZE_PERCENT_MAX = 100;
export const ATTENTION_MARKER_SIZE_PERCENT_STEP = 10;

export type AttentionMarkerWire = {
  x: number;
  z: number;
  hoverHeight: number;
  sizePercent: number;
  colorRgb: number;
};

/** World Y offset from co-occupant top (or floor) for a Hover Height step. */
export function attentionMarkerHoverLift(hoverHeight: number): number {
  const h = Math.max(0, Math.min(3, Math.floor(hoverHeight)));
  return h * ATTENTION_MARKER_STEP_Y + 0.35;
}

/** Uniform scale factor from Size percent (20..100 → 0.2..1). */
export function attentionMarkerScaleFromPercent(sizePercent: number): number {
  const p = clampAttentionMarkerSizePercent(sizePercent);
  return p / 100;
}

export function clampAttentionMarkerSizePercent(n: number): number {
  if (!Number.isFinite(n)) return ATTENTION_MARKER_SIZE_PERCENT_DEFAULT;
  const stepped =
    Math.round(n / ATTENTION_MARKER_SIZE_PERCENT_STEP) *
    ATTENTION_MARKER_SIZE_PERCENT_STEP;
  return Math.max(
    ATTENTION_MARKER_SIZE_PERCENT_MIN,
    Math.min(ATTENTION_MARKER_SIZE_PERCENT_MAX, stepped)
  );
}

export function attentionMarkerBounceOffset(timeSec: number): number {
  return (
    Math.sin(timeSec * ATTENTION_MARKER_BOUNCE_SPEED * Math.PI * 2) *
    ATTENTION_MARKER_BOUNCE_AMP
  );
}

/**
 * Dock / inspector bake backgrounds are light; near-white markers vanish.
 * Return a readable slate when the authored tint would wash out.
 */
export function attentionMarkerPreviewContrastRgb(colorRgb: number): number {
  const c = (colorRgb >>> 0) & 0xffffff;
  const r = (c >> 16) & 0xff;
  const g = (c >> 8) & 0xff;
  const b = c & 0xff;
  if (r + g + b >= 560) return 0x1e293b;
  return c;
}

/** Build a V group with body + soft glow shell (apex at the bottom). */
export function makeAttentionMarkerGroup(
  colorRgb: number,
  opts?: { ghost?: boolean }
): THREE.Group {
  const group = new THREE.Group();
  group.name = "attentionMarker";
  group.userData.skipBlockPickAndBounds = true;
  group.userData.attentionMarker = true;

  const color = new THREE.Color(colorRgb >>> 0);
  const ghost = opts?.ghost === true;
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive: color.clone(),
    emissiveIntensity: ghost ? 0.55 : 0.85,
    metalness: 0.1,
    roughness: 0.35,
    transparent: ghost,
    opacity: ghost ? 0.62 : 1,
  });
  const glowMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: ghost ? 0.18 : 0.28,
    depthWrite: false,
  });

  // Explicit V outline in XY: apex at y=0, arms open upward.
  const shape = new THREE.Shape();
  const t = 0.1;
  shape.moveTo(-0.4, 0.9);
  shape.lineTo(-0.4 + t * 1.5, 0.9);
  shape.lineTo(0, 0.2);
  shape.lineTo(0.4 - t * 1.5, 0.9);
  shape.lineTo(0.4, 0.9);
  shape.lineTo(0, 0);
  shape.closePath();

  const bodyGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.12,
    bevelEnabled: false,
  });
  bodyGeo.translate(0, 0, -0.06);
  const body = new THREE.Mesh(bodyGeo, mat);
  body.userData.skipBlockPickAndBounds = true;
  group.add(body);

  const glowShape = new THREE.Shape();
  const gt = 0.16;
  glowShape.moveTo(-0.46, 0.96);
  glowShape.lineTo(-0.46 + gt * 1.5, 0.96);
  glowShape.lineTo(0, 0.14);
  glowShape.lineTo(0.46 - gt * 1.5, 0.96);
  glowShape.lineTo(0.46, 0.96);
  glowShape.lineTo(0, -0.06);
  glowShape.closePath();
  const glowGeo = new THREE.ExtrudeGeometry(glowShape, {
    depth: 0.08,
    bevelEnabled: false,
  });
  glowGeo.translate(0, 0, -0.04);
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.userData.skipBlockPickAndBounds = true;
  group.add(glow);

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
