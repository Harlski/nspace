import * as THREE from "three";
import { billboardPlaneCenterXZ } from "./billboardFootprintMath.js";

const FACE_HEIGHT_TILES = 3;

/**
 * Push the plane slightly along its **world-space** −normal so it sits off the floor /
 * footprint consistently for every yaw. Must be applied to the group (or derived from
 * yaw), not `mesh.position.z` — parent-space mesh position does not rotate with
 * `mesh.rotation.y`, so a local Z offset would stay world-fixed and break alignment.
 */
function billboardPlaneNormalInset(blockSize: number): number {
  return blockSize * (0.52 / 0.82);
}

/** World XZ of +local Z (plane front normal) after rotation.y = yaw * π/2. */
function billboardPlaneWorldNormalXZ(yawSteps: number): { nx: number; nz: number } {
  const θ = (Math.max(0, Math.min(3, Math.floor(yawSteps))) * Math.PI) / 2;
  return { nx: Math.sin(θ), nz: Math.cos(θ) };
}

export function billboardFaceSize(
  orientation: "horizontal" | "vertical",
  blockSize: number
): { faceW: number; faceH: number } {
  const faceW = orientation === "horizontal" ? 4 : 2;
  const faceH = FACE_HEIGHT_TILES * blockSize;
  return { faceW, faceH };
}

/** Solid black plane while the real slide image is loading or if load fails. */
export function makeFallbackBillboardTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createBillboardRoot(
  spec: {
    anchorX: number;
    anchorZ: number;
    orientation: "horizontal" | "vertical";
    yawSteps: number;
  },
  blockSize: number,
  texture: THREE.Texture
): THREE.Group {
  const { faceW, faceH } = billboardFaceSize(spec.orientation, blockSize);
  const group = new THREE.Group();
  const geo = new THREE.PlaneGeometry(faceW, faceH);
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
    /** Must write depth so avatars/sprites depth-test against the plane, not only the floor. */
    depthWrite: true,
    /** Drop nearly invisible texels so semi-transparent PNG edges do not smear the depth buffer. */
    alphaTest: 0.001,
  });
  const mesh = new THREE.Mesh(geo, mat);
  /** Draw before player sprites (higher renderOrder) so the plane writes depth first. */
  mesh.renderOrder = -20;
  const yawSteps = Math.max(0, Math.min(3, Math.floor(spec.yawSteps)));
  mesh.rotation.y = (yawSteps * Math.PI) / 2;
  mesh.position.set(0, 0, 0);
  const { cx, cz } = billboardPlaneCenterXZ(
    spec.anchorX,
    spec.anchorZ,
    spec.orientation,
    spec.yawSteps
  );
  const cy = faceH / 2;
  const inset = billboardPlaneNormalInset(blockSize);
  const { nx, nz } = billboardPlaneWorldNormalXZ(yawSteps);
  group.position.set(cx - nx * inset, cy, cz - nz * inset);
  group.add(mesh);
  group.userData["billboardMat"] = mat;
  group.userData["billboardMesh"] = mesh;
  return group;
}

/** Updates pose when footprint size (orientation) matches existing plane geometry. */
export function updateBillboardRootPose(
  root: THREE.Group,
  spec: {
    anchorX: number;
    anchorZ: number;
    orientation: "horizontal" | "vertical";
    yawSteps: number;
  },
  blockSize: number
): void {
  const { faceW, faceH } = billboardFaceSize(spec.orientation, blockSize);
  const mesh = root.userData["billboardMesh"] as THREE.Mesh | undefined;
  if (!mesh) return;
  const geo = mesh.geometry as THREE.PlaneGeometry;
  if (
    Math.abs(geo.parameters.width - faceW) > 1e-3 ||
    Math.abs(geo.parameters.height - faceH) > 1e-3
  ) {
    return;
  }
  const yawSteps = Math.max(0, Math.min(3, Math.floor(spec.yawSteps)));
  mesh.rotation.y = (yawSteps * Math.PI) / 2;
  mesh.position.set(0, 0, 0);
  const { cx, cz } = billboardPlaneCenterXZ(
    spec.anchorX,
    spec.anchorZ,
    spec.orientation,
    spec.yawSteps
  );
  const cy = faceH / 2;
  const inset = billboardPlaneNormalInset(blockSize);
  const { nx, nz } = billboardPlaneWorldNormalXZ(yawSteps);
  root.position.set(cx - nx * inset, cy, cz - nz * inset);
}

export function disposeBillboardRoot(root: THREE.Group): void {
  root.traverse((child: THREE.Object3D) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      const m = child.material as THREE.MeshBasicMaterial;
      if (m.map) m.map.dispose();
      m.dispose();
    }
  });
}
