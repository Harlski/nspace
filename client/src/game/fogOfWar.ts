import * as THREE from "three";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";

/** Filled when `FogOfWarPass.render` is called with `timingsOut` (perf mode). */
export type FogOfWarRenderTimings = {
  /** `renderer.render(scene, camera)` to RT or backbuffer. */
  sceneMs: number;
  /** Full-screen fog composite (0 when fog pass is disabled). */
  compositeMs: number;
};

/**
 * Fog of war: darkens pixels where the camera ray through the pixel hits the
 * ground plane (y=0) farther than `outerRadius` from the local player in XZ.
 * Uses ray–plane intersection (no depth readback), which matches orthographic
 * views reliably.
 */
export class FogOfWarPass {
  private readonly renderTarget: THREE.WebGLRenderTarget;
  private readonly fsQuad: FullScreenQuad;
  private readonly material: THREE.ShaderMaterial;
  private enabled = false;

  constructor(innerRadius: number, outerRadius: number) {
    const w = 4;
    const h = 4;
    this.renderTarget = new THREE.WebGLRenderTarget(w, h, {
      depthBuffer: true,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });

    this.material = new THREE.ShaderMaterial({
      name: "FogOfWar",
      depthTest: false,
      depthWrite: false,
      /** Scene is rendered to RT without tone mapping; avoid applying it again. */
      toneMapped: false,
      uniforms: {
        tDiffuse: { value: null as THREE.Texture | null },
        cameraNear: { value: 0.1 },
        cameraFar: { value: 2000 },
        cameraInverseProjectionMatrix: { value: new THREE.Matrix4() },
        cameraMatrixWorld: { value: new THREE.Matrix4() },
        uPlayerPos: { value: new THREE.Vector3(0, 0, 0) },
        uFogInner: { value: innerRadius },
        uFogOuter: { value: outerRadius },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform float cameraNear;
        uniform float cameraFar;
        uniform mat4 cameraInverseProjectionMatrix;
        uniform mat4 cameraMatrixWorld;
        uniform vec3 uPlayerPos;
        uniform float uFogInner;
        uniform float uFogOuter;

        varying vec2 vUv;

        void main() {
          vec4 sceneColor = texture2D(tDiffuse, vUv);

          vec2 ndc = vec2(vUv.x * 2.0 - 1.0, vUv.y * 2.0 - 1.0);
          float ndcZ = (cameraNear + cameraFar) / (cameraNear - cameraFar);
          vec4 vClip = vec4(ndc.xy, ndcZ, 1.0);
          vec4 vView = cameraInverseProjectionMatrix * vClip;
          vec3 viewPos = vView.xyz / vView.w;
          vec3 ro = (cameraMatrixWorld * vec4(viewPos, 1.0)).xyz;
          vec3 rd = normalize((cameraMatrixWorld * vec4(0.0, 0.0, -1.0, 0.0)).xyz);

          vec4 outColor;
          if (abs(rd.y) < 1e-5) {
            outColor = sceneColor;
          } else {
            float t = -ro.y / rd.y;
            if (t < 0.0) {
              outColor = sceneColor;
            } else {
              vec3 hit = ro + rd * t;
              float d = length(hit.xz - uPlayerPos.xz);
              float fog = smoothstep(uFogInner, uFogOuter, d);
              vec3 fogColor = vec3(0.04, 0.05, 0.08);
              outColor = vec4(mix(sceneColor.rgb, fogColor, fog * 0.85), sceneColor.a);
            }
          }

          gl_FragColor = outColor;
          #include <colorspace_fragment>
        }
      `,
    });

    this.fsQuad = new FullScreenQuad(this.material);
  }

  setRadii(inner: number, outer: number): void {
    this.material.uniforms.uFogInner.value = inner;
    this.material.uniforms.uFogOuter.value = outer;
  }

  getRadii(): { inner: number; outer: number } {
    return {
      inner: this.material.uniforms.uFogInner.value as number,
      outer: this.material.uniforms.uFogOuter.value as number,
    };
  }

  setEnabled(value: boolean): void {
    this.enabled = value;
  }

  getEnabled(): boolean {
    return this.enabled;
  }

  setPlayerPosition(x: number, z: number): void {
    this.material.uniforms.uPlayerPos.value.set(x, 0, z);
  }

  setSize(width: number, height: number, pixelRatio: number): void {
    const w = Math.max(1, Math.floor(width * pixelRatio));
    const h = Math.max(1, Math.floor(height * pixelRatio));
    this.renderTarget.setSize(w, h);
  }

  render(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.OrthographicCamera,
    timingsOut?: FogOfWarRenderTimings
  ): void {
    camera.updateMatrixWorld();
    if (!this.enabled) {
      renderer.setRenderTarget(null);
      if (timingsOut) {
        const t0 = performance.now();
        renderer.render(scene, camera);
        timingsOut.sceneMs = performance.now() - t0;
        timingsOut.compositeMs = 0;
      } else {
        renderer.render(scene, camera);
      }
      return;
    }

    const u = this.material.uniforms;
    u.cameraNear.value = camera.near;
    u.cameraFar.value = camera.far;
    u.cameraInverseProjectionMatrix.value.copy(camera.projectionMatrixInverse);
    u.cameraMatrixWorld.value.copy(camera.matrixWorld);

    renderer.setRenderTarget(this.renderTarget);
    if (timingsOut) {
      const t0 = performance.now();
      renderer.render(scene, camera);
      timingsOut.sceneMs = performance.now() - t0;
    } else {
      renderer.render(scene, camera);
    }

    u.tDiffuse.value = this.renderTarget.texture;

    renderer.setRenderTarget(null);
    if (timingsOut) {
      const t1 = performance.now();
      this.fsQuad.render(renderer);
      timingsOut.compositeMs = performance.now() - t1;
    } else {
      this.fsQuad.render(renderer);
    }
  }

  dispose(): void {
    this.renderTarget.dispose();
    this.material.dispose();
  }
}
