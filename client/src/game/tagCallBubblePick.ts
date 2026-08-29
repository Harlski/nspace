import * as THREE from "three";

export type ClientRectLike = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type CanvasAabb = { x: number; y: number; w: number; h: number };

/** On-screen size of the Join tick that sits above the Tag Call party row. */
export const TAG_JOIN_TICK_SIZE_PX = 32;
export const TAG_JOIN_TICK_GAP_PX = 6;
export const TAG_CALL_PARTY_ROW_H_PX = 26;
export const TAG_CALL_PARTY_GAP_PX = 6;
export const TAG_CALL_PARTY_ICON_PX = 20;
export const TAG_CALLER_BTN_SIZE_PX = 32;

export function tagCallPartyRowRect(
  bubble: CanvasAabb,
  partySize: number
): CanvasAabb {
  const n = Math.max(1, Math.min(8, Math.floor(partySize)));
  const w = 12 + 18 + 6 + n * (TAG_CALL_PARTY_ICON_PX + 3) + 8;
  return {
    x: bubble.x + bubble.w / 2 - w / 2,
    y: bubble.y - TAG_CALL_PARTY_ROW_H_PX - TAG_CALL_PARTY_GAP_PX,
    w,
    h: TAG_CALL_PARTY_ROW_H_PX,
  };
}

/** Place a square control centered above another AABB. */
export function controlRectCenteredAbove(
  below: CanvasAabb,
  size = TAG_JOIN_TICK_SIZE_PX,
  gap = TAG_JOIN_TICK_GAP_PX
): CanvasAabb {
  return {
    x: below.x + below.w / 2 - size / 2,
    y: below.y - size - gap,
    w: size,
    h: size,
  };
}

/** Place a square Join tick centered above a Tag Call bubble AABB. */
export function joinTickRectAboveBubble(
  bubble: CanvasAabb,
  tickSize = TAG_JOIN_TICK_SIZE_PX,
  gap = TAG_JOIN_TICK_GAP_PX
): CanvasAabb {
  return controlRectCenteredAbove(bubble, tickSize, gap);
}

export function callerStartCancelRects(party: CanvasAabb): {
  start: CanvasAabb;
  cancel: CanvasAabb;
} {
  const size = TAG_CALLER_BTN_SIZE_PX;
  const between = 8;
  const totalW = size * 2 + between;
  const x0 = party.x + party.w / 2 - totalW / 2;
  const y = party.y - size - TAG_JOIN_TICK_GAP_PX;
  return {
    start: { x: x0, y, w: size, h: size },
    cancel: { x: x0 + size + between, y, w: size, h: size },
  };
}

/** Viewport client coords from a world point (same mapping as Game.getWorldScreenPosition + rect). */
export function worldToClient(
  camera: THREE.Camera,
  x: number,
  y: number,
  z: number,
  rect: ClientRectLike
): { x: number; y: number } | null {
  const projected = new THREE.Vector3(x, y, z).project(camera);
  const sx = ((projected.x + 1) * 0.5) * rect.width;
  const sy = ((1 - projected.y) * 0.5) * rect.height;
  if (!Number.isFinite(sx) || !Number.isFinite(sy)) return null;
  return { x: rect.left + sx, y: rect.top + sy };
}

export function ndcFromClient(
  clientX: number,
  clientY: number,
  rect: ClientRectLike
): THREE.Vector2 {
  return new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1
  );
}

/** Canvas-local AABB of a camera-facing sprite (letterbox HUD coords). */
export function cameraFacingSpriteCanvasAabb(
  camera: THREE.Camera,
  sprite: THREE.Sprite,
  rect: ClientRectLike,
  padPx = 0
): CanvasAabb | null {
  sprite.updateWorldMatrix(true, false);
  camera.updateMatrixWorld();
  const wp = new THREE.Vector3();
  sprite.getWorldPosition(wp);
  const worldScale = new THREE.Vector3();
  sprite.getWorldScale(worldScale);
  const right = new THREE.Vector3()
    .setFromMatrixColumn(camera.matrixWorld, 0)
    .normalize();
  const up = new THREE.Vector3()
    .setFromMatrixColumn(camera.matrixWorld, 1)
    .normalize();
  const hw = worldScale.x / 2;
  const hh = worldScale.y / 2;
  const corners = [
    wp.clone().addScaledVector(right, -hw).addScaledVector(up, -hh),
    wp.clone().addScaledVector(right, hw).addScaledVector(up, -hh),
    wp.clone().addScaledVector(right, -hw).addScaledVector(up, hh),
    wp.clone().addScaledVector(right, hw).addScaledVector(up, hh),
  ];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of corners) {
    const p = worldToClient(camera, c.x, c.y, c.z, rect);
    if (!p) return null;
    const lx = p.x - rect.left;
    const ly = p.y - rect.top;
    minX = Math.min(minX, lx);
    minY = Math.min(minY, ly);
    maxX = Math.max(maxX, lx);
    maxY = Math.max(maxY, ly);
  }
  return {
    x: minX - padPx,
    y: minY - padPx,
    w: maxX - minX + padPx * 2,
    h: maxY - minY + padPx * 2,
  };
}

/**
 * Hit-test a camera-facing sprite at a pointer. Uses Three.js Sprite.raycast so
 * isometric ortho cameras, parent transforms, and zoom are all accounted for.
 * Safe to call when `sprite.raycast` has been stubbed to skip walk/avatar picks.
 */
export function pickCameraFacingSpriteAtClient(
  raycaster: THREE.Raycaster,
  camera: THREE.Camera,
  sprite: THREE.Sprite,
  clientX: number,
  clientY: number,
  rect: ClientRectLike
): boolean {
  if (rect.width < 1 || rect.height < 1) return false;
  sprite.updateWorldMatrix(true, false);
  camera.updateMatrixWorld();
  const ndc = ndcFromClient(clientX, clientY, rect);
  raycaster.setFromCamera(ndc, camera);
  const hits: THREE.Intersection[] = [];
  THREE.Sprite.prototype.raycast.call(sprite, raycaster, hits);
  return hits.length > 0;
}
