import { describe, expect, it } from "vitest";
import * as THREE from "three";

import {
  cameraFacingSpriteCanvasAabb,
  pickCameraFacingSpriteAtClient,
  worldToClient,
  joinTickRectAboveBubble,
  tagCallPartyRowRect,
  callerStartCancelRects,
} from "./tagCallBubblePick.js";

/** Same isometric pose Game uses (offset 18,18,18 looking at origin). */
function isometricCamera(frustumSize: number, aspect: number): THREE.OrthographicCamera {
  const camera = new THREE.OrthographicCamera(
    (frustumSize * aspect) / -2,
    (frustumSize * aspect) / 2,
    frustumSize / 2,
    frustumSize / -2,
    0.1,
    2000
  );
  camera.up.set(0, 1, 0);
  camera.position.set(18, 18, 18);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  return camera;
}

describe("Tag Call Join pick", () => {
  const frustumSize = 20;
  const rect = { left: 80, top: 40, width: 1280, height: 720 };
  const aspect = rect.width / rect.height;

  it("raycasts the Join tick even when sprite.raycast is stubbed (walk pick skip)", () => {
    const camera = isometricCamera(frustumSize, aspect);
    const avatar = new THREE.Group();
    avatar.position.set(2, 0, -3);
    const bubble = new THREE.Sprite(new THREE.SpriteMaterial());
    bubble.raycast = () => {};
    bubble.scale.set(4.2, 1, 1);
    bubble.position.set(0, 2.2, 0);
    avatar.add(bubble);
    avatar.updateWorldMatrix(true, true);

    const wp = new THREE.Vector3();
    bubble.getWorldPosition(wp);
    const right = new THREE.Vector3()
      .setFromMatrixColumn(camera.matrixWorld, 0)
      .normalize();
    const tickWorld = wp.clone().addScaledVector(right, bubble.scale.x * 0.45);
    const tick = worldToClient(camera, tickWorld.x, tickWorld.y, tickWorld.z, rect);
    expect(tick).not.toBeNull();

    const raycaster = new THREE.Raycaster();
    expect(
      pickCameraFacingSpriteAtClient(
        raycaster,
        camera,
        bubble,
        tick!.x,
        tick!.y,
        rect
      )
    ).toBe(true);

    const aabb = cameraFacingSpriteCanvasAabb(camera, bubble, rect, 0);
    expect(aabb).not.toBeNull();
    const lx = tick!.x - rect.left;
    const ly = tick!.y - rect.top;
    expect(lx).toBeGreaterThanOrEqual(aabb!.x);
    expect(lx).toBeLessThanOrEqual(aabb!.x + aabb!.w);
    expect(ly).toBeGreaterThanOrEqual(aabb!.y);
    expect(ly).toBeLessThanOrEqual(aabb!.y + aabb!.h);
  });

  it("still hits the bubble center", () => {
    const camera = isometricCamera(frustumSize, aspect);
    const bubble = new THREE.Sprite(new THREE.SpriteMaterial());
    bubble.raycast = () => {};
    bubble.scale.set(4.2, 1, 1);
    bubble.position.set(0, 2.2, 0);
    bubble.updateWorldMatrix(true, false);
    const wp = new THREE.Vector3();
    bubble.getWorldPosition(wp);
    const center = worldToClient(camera, wp.x, wp.y, wp.z, rect)!;
    const raycaster = new THREE.Raycaster();
    expect(
      pickCameraFacingSpriteAtClient(
        raycaster,
        camera,
        bubble,
        center.x,
        center.y,
        rect
      )
    ).toBe(true);
  });

  it("places the Join tick fully above the Tag Call pill", () => {
    const bubble = { x: 100, y: 200, w: 180, h: 36 };
    const tick = joinTickRectAboveBubble(bubble, 52, 8);
    expect(tick.w).toBe(52);
    expect(tick.h).toBe(52);
    expect(tick.x + tick.w / 2).toBe(bubble.x + bubble.w / 2);
    expect(tick.y + tick.h).toBe(bubble.y - 8);
    expect(tick.y + tick.h).toBeLessThanOrEqual(bubble.y);
  });

  it("stacks the party row above the pill and Start/Cancel above the party row", () => {
    const bubble = { x: 100, y: 200, w: 180, h: 36 };
    const party = tagCallPartyRowRect(bubble, 1);
    expect(party.h).toBe(26);
    expect(party.y + party.h).toBeLessThanOrEqual(bubble.y);
    const pair = callerStartCancelRects(party);
    expect(pair.start.y + pair.start.h).toBeLessThanOrEqual(party.y);
    expect(pair.cancel.y).toBe(pair.start.y);
  });
});
