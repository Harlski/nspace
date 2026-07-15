/**
 * No-Walk Floor Cue — red tint + X while floor build mode is open (ADR 0011 / CONTEXT.md).
 */

import * as THREE from "three";

export const NO_WALK_FLOOR_CUE_COLOR = 0xef4444;

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
    opacity: 0.28,
    depthWrite: false,
  });
  const xPositions = new Float32Array([
    -0.3, 0, -0.3, 0.3, 0, 0.3, -0.3, 0, 0.3, 0.3, 0, -0.3,
  ]);
  const xGeom = new THREE.BufferGeometry();
  xGeom.setAttribute("position", new THREE.BufferAttribute(xPositions, 3));
  const xMat = new THREE.LineBasicMaterial({
    color: NO_WALK_FLOOR_CUE_COLOR,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });
  return { tintGeom, tintMat, xGeom, xMat };
}

/** Floor-plane Group (tint quad + X lines). Caller sets world XZ; Y ≈ 0.05. */
export function makeNoWalkFloorCueGroup(
  res: NoWalkFloorCueResources
): THREE.Group {
  const group = new THREE.Group();
  group.name = "noWalkFloorCue";
  group.userData.skipBlockPickAndBounds = true;

  const tint = new THREE.Mesh(res.tintGeom, res.tintMat);
  tint.rotation.x = -Math.PI / 2;
  tint.renderOrder = 6;
  tint.userData.skipBlockPickAndBounds = true;

  const x = new THREE.LineSegments(res.xGeom, res.xMat);
  x.position.y = 0.01;
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
