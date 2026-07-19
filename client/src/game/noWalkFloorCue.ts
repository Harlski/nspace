/**
 * No-Walk Floor Cue — red tint + X while floor build mode is open (ADR 0011 / CONTEXT.md).
 *
 * Geometry lives in local XY; the group is rotated so XY = world floor XZ (flush with the tile).
 */

import * as THREE from "three";

export const NO_WALK_FLOOR_CUE_COLOR = 0xef4444;

/**
 * World Y for the cue group: just above `WALKABLE_FLOOR_TOP_Y` (0.01).
 * Keep tiny so the overlay reads painted on the tile, not floating.
 */
export const NO_WALK_FLOOR_CUE_Y = 0.014;

export type NoWalkFloorCueResources = {
  tintGeom: THREE.PlaneGeometry;
  tintMat: THREE.MeshBasicMaterial;
  xGeom: THREE.BufferGeometry;
  xMat: THREE.LineBasicMaterial;
};

export function createNoWalkFloorCueResources(): NoWalkFloorCueResources {
  const tintGeom = new THREE.PlaneGeometry(0.92, 0.92);
  const tintMat = new THREE.MeshBasicMaterial({
    color: NO_WALK_FLOOR_CUE_COLOR,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    side: THREE.DoubleSide,
  });
  // Local XY (group rotates so this lies on the floor). Two segments → X.
  const xPositions = new Float32Array([
    -0.3, -0.3, 0, 0.3, 0.3, 0, -0.3, 0.3, 0, 0.3, -0.3, 0,
  ]);
  const xGeom = new THREE.BufferGeometry();
  xGeom.setAttribute("position", new THREE.BufferAttribute(xPositions, 3));
  const xMat = new THREE.LineBasicMaterial({
    color: NO_WALK_FLOOR_CUE_COLOR,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });
  return { tintGeom, tintMat, xGeom, xMat };
}

/** Floor-plane Group (tint quad + X). Caller sets world XZ; Y = {@link NO_WALK_FLOOR_CUE_Y}. */
export function makeNoWalkFloorCueGroup(
  res: NoWalkFloorCueResources
): THREE.Group {
  const group = new THREE.Group();
  group.name = "noWalkFloorCue";
  group.userData.skipBlockPickAndBounds = true;
  // Local XY → world XZ (flat on the floor).
  group.rotation.x = -Math.PI / 2;

  const tint = new THREE.Mesh(res.tintGeom, res.tintMat);
  tint.renderOrder = 6;
  tint.userData.skipBlockPickAndBounds = true;

  const x = new THREE.LineSegments(res.xGeom, res.xMat);
  // Local +Z becomes world +Y after group rot — nudge slightly above the tint.
  x.position.z = 0.002;
  x.renderOrder = 7;
  x.userData.skipBlockPickAndBounds = true;

  group.add(tint);
  group.add(x);
  return group;
}

export function disposeNoWalkFloorCueResources(
  res: NoWalkFloorCueResources | null
): void {
  if (!res) return;
  res.tintGeom.dispose();
  res.tintMat.dispose();
  res.xGeom.dispose();
  res.xMat.dispose();
}

/**
 * Self-owned cue for one-shot WebGL bakes (dock thumbs). Safe to dispose with the parent slot.
 */
export function makeEphemeralNoWalkFloorCueGroup(): THREE.Group {
  const res = createNoWalkFloorCueResources();
  const group = makeNoWalkFloorCueGroup(res);
  group.userData.noWalkFloorCueOwnedRes = res;
  return group;
}
