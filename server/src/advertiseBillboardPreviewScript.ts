import {
  BILLBOARD_BLOCK_SIZE_WORLD,
  BILLBOARD_RECOMMENDED_UPLOAD_PX,
  billboardFaceAspectRatio,
  PAID_BILLBOARD_ORIENTATION,
} from "./billboardImageSpec.js";
import {
  BILLBOARD_FACE_HEIGHT_TILES,
  BILLBOARD_HORIZONTAL_WIDTH_TILES,
} from "./billboards.js";

/** Zoom - wide enough for billboard + standing identicon. */
const PREVIEW_FRUSTUM_SIZE = 5.35;

/** Rotate the miniature scene counter-clockwise (viewed from above). */
const PREVIEW_SCENE_YAW_RAD = Math.PI / 2;

/** Matches `AVATAR_SPHERE_RADIUS * 2` in `client/src/game/Game.ts`. */
const PREVIEW_AVATAR_DIAMETER = 0.8;

/** Raise look-at Y so the scene sits lower in the canvas (less empty space above). */
const PREVIEW_LOOK_AT_Y_LIFT = 1.65;

/** Standing tile offset in front of the billboard face (+local Z). */
const PREVIEW_STAND_Z = 1.35;

/** Matches `cameraOffsetBase` in `client/src/game/Game.ts` (isometric offset). */
const PREVIEW_CAMERA_OFFSET = 18;

/**
 * Inline ES module for `/advertise` - mini Three.js scene matching in-game orthographic view.
 * Loaded via import map (Three 0.174, same as client).
 */
export function advertiseBillboardPreviewModuleScript(): string {
  const blockSize = BILLBOARD_BLOCK_SIZE_WORLD;
  const faceW = BILLBOARD_HORIZONTAL_WIDTH_TILES;
  const faceH = BILLBOARD_FACE_HEIGHT_TILES * blockSize;
  const aspectRatio = billboardFaceAspectRatio(PAID_BILLBOARD_ORIENTATION);
  const recW = BILLBOARD_RECOMMENDED_UPLOAD_PX.width;
  const recH = BILLBOARD_RECOMMENDED_UPLOAD_PX.height;
  const footprintTiles = BILLBOARD_HORIZONTAL_WIDTH_TILES;
  const floorQuad = 1.01;
  const sceneYawRad = PREVIEW_SCENE_YAW_RAD;
  const avatarDiameter = PREVIEW_AVATAR_DIAMETER;
  const lookAtYLift = PREVIEW_LOOK_AT_Y_LIFT;
  const standZ = PREVIEW_STAND_Z;

  return `
import * as THREE from "three";

var BLOCK_SIZE = ${blockSize};
var FACE_W = ${faceW};
var FACE_H = ${faceH};
var BILLBOARD_ASPECT = ${aspectRatio};
var REC_W = ${recW};
var REC_H = ${recH};
var FOOTPRINT_TILES = ${footprintTiles};
var FLOOR_QUAD = ${floorQuad};
var CAMERA_OFFSET = ${PREVIEW_CAMERA_OFFSET};
var FRUSTUM_SIZE = ${PREVIEW_FRUSTUM_SIZE};
var SCENE_YAW = ${sceneYawRad};
var AVATAR_DIAMETER = ${avatarDiameter};
var LOOK_AT_Y_LIFT = ${lookAtYLift};
var STAND_Z = ${standZ};

function billboardPlaneCenterXZ(anchorX, anchorZ, widthTiles) {
  return { cx: anchorX + (widthTiles - 1) * 0.5, cz: anchorZ };
}

function AdvertBillboardPreview(canvas) {
  this.canvas = canvas;
  this._warnEl = null;
  this._url = "";
  this._wallet = "";
  this._raf = 0;
  this._imageLoadGen = 0;
  this._fadeRaf = 0;

  this.scene = new THREE.Scene();
  this.scene.background = new THREE.Color(0x0f1419);

  var amb = new THREE.AmbientLight(0xffffff, 0.62);
  this.scene.add(amb);
  var dir = new THREE.DirectionalLight(0xfff8f0, 0.72);
  dir.position.set(8, 20, 10);
  this.scene.add(dir);

  this.rootGroup = new THREE.Group();
  this.rootGroup.rotation.y = SCENE_YAW;
  this.scene.add(this.rootGroup);

  var floorMat = new THREE.MeshBasicMaterial({ color: 0x3d5a4c });
  var floorGeo = new THREE.PlaneGeometry(FLOOR_QUAD, FLOOR_QUAD);
  this.floorMeshes = [];
  for (var i = 0; i < FOOTPRINT_TILES; i++) {
    var tile = new THREE.Mesh(floorGeo, floorMat);
    tile.rotation.x = -Math.PI / 2;
    tile.position.set(i, 0.01, 0);
    this.rootGroup.add(tile);
    this.floorMeshes.push(tile);
  }

  var boardGeo = new THREE.PlaneGeometry(FACE_W, FACE_H);
  this.boardMat = new THREE.MeshBasicMaterial({
    color: 0x111111,
    transparent: true,
    opacity: 1,
    side: THREE.DoubleSide,
    depthWrite: true,
    alphaTest: 0.001,
  });
  this.boardMesh = new THREE.Mesh(boardGeo, this.boardMat);
  this.boardMesh.renderOrder = -20;
  this.boardMesh.rotation.y = 0;
  this.boardFadeMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
    alphaTest: 0.001,
  });
  this.boardFadeMesh = new THREE.Mesh(boardGeo, this.boardFadeMat);
  this.boardFadeMesh.renderOrder = -19;
  this.boardFadeMesh.rotation.y = 0;

  var anchorX = 0;
  var anchorZ = 0;
  var yawSteps = 0;
  var center = billboardPlaneCenterXZ(anchorX, anchorZ, FOOTPRINT_TILES);
  var cy = FACE_H * 0.5;
  var inset = BLOCK_SIZE * (0.52 / 0.82);
  var nx = 0;
  var nz = 1;
  this.boardGroup = new THREE.Group();
  this.boardGroup.add(this.boardMesh);
  this.boardGroup.add(this.boardFadeMesh);
  this.boardGroup.position.set(center.cx - nx * inset, cy, center.cz - nz * inset);
  this.rootGroup.add(this.boardGroup);

  var standTile = new THREE.Mesh(floorGeo, floorMat);
  standTile.rotation.x = -Math.PI / 2;
  standTile.position.set(center.cx, 0.01, STAND_Z);
  this.rootGroup.add(standTile);

  this.avatarGroup = new THREE.Group();
  this.avatarMat = new THREE.SpriteMaterial({
    color: 0x8899aa,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });
  this.avatarSprite = new THREE.Sprite(this.avatarMat);
  this.avatarSprite.renderOrder = 2;
  this.avatarSprite.scale.set(AVATAR_DIAMETER, AVATAR_DIAMETER, 1);
  this.avatarSprite.position.y = AVATAR_DIAMETER / 2;
  this.avatarGroup.position.set(center.cx, 0, STAND_Z);
  this.avatarGroup.add(this.avatarSprite);
  this.rootGroup.add(this.avatarGroup);

  this.lookAt = new THREE.Vector3(
    center.cx,
    cy * 0.5 + LOOK_AT_Y_LIFT,
    center.cz + STAND_Z * 0.38
  );
  var aspect = Math.max(0.5, (canvas.clientWidth || 280) / Math.max(1, canvas.clientHeight || 200));
  this.camera = new THREE.OrthographicCamera(
    (-FRUSTUM_SIZE * aspect) / 2,
    (FRUSTUM_SIZE * aspect) / 2,
    FRUSTUM_SIZE / 2,
    -FRUSTUM_SIZE / 2,
    0.1,
    2000
  );
  this.camera.up.set(0, 1, 0);
  this.camera.position.set(
    this.lookAt.x + CAMERA_OFFSET,
    this.lookAt.y + CAMERA_OFFSET,
    this.lookAt.z + CAMERA_OFFSET
  );
  this.camera.lookAt(this.lookAt);

  this.renderer = null;
  this._loader = new THREE.TextureLoader();
  this._loader.setCrossOrigin("anonymous");
  this._onResize = this._resize.bind(this);
  if (typeof ResizeObserver !== "undefined") {
    this._ro = new ResizeObserver(this._onResize);
    this._ro.observe(canvas);
  } else {
    window.addEventListener("resize", this._onResize);
  }
  this._floorGeo = floorGeo;
  var self = this;
  this._onContextLost = function (e) {
    e.preventDefault();
    self.renderer = null;
  };
  this._onContextRestored = function () {
    self._resize();
  };
  canvas.addEventListener("webglcontextlost", this._onContextLost);
  canvas.addEventListener("webglcontextrestored", this._onContextRestored);
  this._resize();
}

AdvertBillboardPreview.prototype._canvasReady = function () {
  var c = this.canvas;
  if (!c || !c.isConnected) return false;
  if (c.hidden) return false;
  if (c.closest("[hidden]")) return false;
  return c.clientWidth > 0 && c.clientHeight > 0;
};

AdvertBillboardPreview.prototype._ensureRenderer = function () {
  if (this._disposed || this.renderer) return !!this.renderer;
  if (!this._canvasReady()) return false;
  try {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    return true;
  } catch (e) {
    console.warn("[adv-preview] WebGL unavailable:", e);
    return false;
  }
};

AdvertBillboardPreview.prototype.dispose = function () {
  if (this._disposed) return;
  this._disposed = true;
  if (this._raf) cancelAnimationFrame(this._raf);
  this._raf = 0;
  if (this._fadeRaf) cancelAnimationFrame(this._fadeRaf);
  this._fadeRaf = 0;
  if (this._ro) this._ro.disconnect();
  else window.removeEventListener("resize", this._onResize);
  if (this.canvas && this._onContextLost) {
    this.canvas.removeEventListener("webglcontextlost", this._onContextLost);
    this.canvas.removeEventListener("webglcontextrestored", this._onContextRestored);
  }
  if (this.boardMat.map) {
    this.boardMat.map.dispose();
    this.boardMat.map = null;
  }
  this.boardMat.dispose();
  if (this.boardFadeMat.map) {
    this.boardFadeMat.map.dispose();
    this.boardFadeMat.map = null;
  }
  this.boardFadeMat.dispose();
  if (this.avatarMat.map) {
    if (!identiconTexPool.has(this.avatarMat.map)) {
      this.avatarMat.map.dispose();
    }
    this.avatarMat.map = null;
  }
  this.avatarMat.dispose();
  if (this.boardMesh && this.boardMesh.geometry) this.boardMesh.geometry.dispose();
  if (this._floorGeo) this._floorGeo.dispose();
  if (this.renderer) {
    this.renderer.dispose();
    if (typeof this.renderer.forceContextLoss === "function") {
      this.renderer.forceContextLoss();
    }
    this.renderer = null;
  }
};

AdvertBillboardPreview.prototype._resize = function () {
  var w = this.canvas.clientWidth || 0;
  var h = this.canvas.clientHeight || 0;
  if (!w || !h) return;
  var aspect = w / h;
  this.camera.left = (-FRUSTUM_SIZE * aspect) / 2;
  this.camera.right = (FRUSTUM_SIZE * aspect) / 2;
  this.camera.top = FRUSTUM_SIZE / 2;
  this.camera.bottom = -FRUSTUM_SIZE / 2;
  this.camera.updateProjectionMatrix();
  if (!this._ensureRenderer()) return;
  this.renderer.setSize(w, h, false);
  this._render();
};

AdvertBillboardPreview.prototype._render = function () {
  if (!this._ensureRenderer()) return;
  this.renderer.render(this.scene, this.camera);
};

AdvertBillboardPreview.prototype.setWarnElement = function (el) {
  this._warnEl = el;
};

AdvertBillboardPreview.prototype.setWallet = function (wallet) {
  var next = String(wallet || "").trim();
  if (next === this._wallet) return;
  this._wallet = next;
  if (!next) {
    this._applyIdenticonTexture(null);
    return;
  }
  var cached = identiconTexByWallet.get(next);
  if (cached) {
    this._applyIdenticonTexture(cached);
    return;
  }
  var self = this;
  var reqWallet = next;
  fetch("/api/identicon/" + encodeURIComponent(next))
    .then(function (r) {
      return r.json();
    })
    .then(function (j) {
      var url = String((j && j.identicon) || "");
      if (!url || self._wallet !== reqWallet) return;
      if (identiconTexByWallet.has(reqWallet)) {
        self._applyIdenticonTexture(identiconTexByWallet.get(reqWallet));
        return;
      }
      self._loader.load(
        url,
        function (tex) {
          if (self._wallet !== reqWallet) {
            tex.dispose();
            return;
          }
          tex.colorSpace = THREE.SRGBColorSpace;
          identiconTexByWallet.set(reqWallet, tex);
          identiconTexPool.add(tex);
          self._applyIdenticonTexture(tex);
        },
        undefined,
        function () {
          if (self._wallet === reqWallet) self._applyIdenticonTexture(null);
        }
      );
    })
    .catch(function () {
      if (self._wallet === reqWallet) self._applyIdenticonTexture(null);
    });
};

AdvertBillboardPreview.prototype._applyIdenticonTexture = function (tex) {
  if (tex) {
    this.avatarMat.map = tex;
    this.avatarMat.color.set(0xffffff);
  } else {
    this.avatarMat.map = null;
    this.avatarMat.color.set(0x8899aa);
  }
  this.avatarMat.needsUpdate = true;
  this._render();
};

AdvertBillboardPreview.prototype._crossfadeBoardTexture = function (newTex) {
  var self = this;
  if (!this.boardMat.map) {
    this.boardMat.map = newTex;
    this.boardMat.color.set(0xffffff);
    this.boardMat.opacity = 1;
    this.boardMat.needsUpdate = true;
    this.boardFadeMat.opacity = 0;
    this.boardFadeMat.map = null;
    this._render();
    return;
  }
  if (this.boardMat.map === newTex) {
    this.boardMat.opacity = 1;
    this.boardFadeMat.opacity = 0;
    this._render();
    return;
  }
  if (this._fadeRaf) cancelAnimationFrame(this._fadeRaf);
  this.boardFadeMat.map = newTex;
  this.boardFadeMat.color.set(0xffffff);
  this.boardFadeMat.opacity = 0;
  this.boardFadeMat.needsUpdate = true;
  this.boardMat.opacity = 1;
  var start = performance.now();
  var dur = 220;
  function tick(now) {
    if (self._disposed) return;
    var t = Math.min(1, (now - start) / dur);
    self.boardFadeMat.opacity = t;
    self.boardMat.opacity = 1 - t;
    self._render();
    if (t < 1) {
      self._fadeRaf = requestAnimationFrame(tick);
    } else {
      var old = self.boardMat.map;
      self.boardMat.map = newTex;
      self.boardMat.color.set(0xffffff);
      self.boardMat.opacity = 1;
      self.boardMat.needsUpdate = true;
      self.boardFadeMat.opacity = 0;
      self.boardFadeMat.map = null;
      self.boardFadeMat.needsUpdate = true;
      if (old && old !== newTex) old.dispose();
      self._fadeRaf = 0;
      self._render();
    }
  }
  this._fadeRaf = requestAnimationFrame(tick);
};

AdvertBillboardPreview.prototype._setWarn = function (msg) {
  if (!this._warnEl) return;
  if (!msg) {
    this._warnEl.hidden = true;
    this._warnEl.textContent = "";
    return;
  }
  this._warnEl.textContent = msg;
  this._warnEl.hidden = false;
};

AdvertBillboardPreview.prototype.setImageUrl = function (url) {
  var next = String(url || "").trim();
  if (next === this._url) return;
  this._url = next;
  this._imageLoadGen += 1;
  var gen = this._imageLoadGen;
  this._setWarn("");
  if (!next) {
    if (this._fadeRaf) cancelAnimationFrame(this._fadeRaf);
    this._fadeRaf = 0;
    if (this.boardMat.map) {
      this.boardMat.map.dispose();
      this.boardMat.map = null;
    }
    if (this.boardFadeMat.map) {
      this.boardFadeMat.map.dispose();
      this.boardFadeMat.map = null;
    }
    this.boardMat.color.set(0x111111);
    this.boardMat.opacity = 1;
    this.boardFadeMat.opacity = 0;
    this._render();
    return;
  }
  var self = this;
  this._loader.load(
    next,
    function (tex) {
      if (self._disposed || gen !== self._imageLoadGen) {
        tex.dispose();
        return;
      }
      tex.colorSpace = THREE.SRGBColorSpace;
      self._crossfadeBoardTexture(tex);
      var img = tex.image;
      if (img && img.width && img.height) {
        var ar = img.width / img.height;
        if (Math.abs(ar - BILLBOARD_ASPECT) > 0.12) {
          self._setWarn(
            "Your image is " +
              img.width +
              "×" +
              img.height +
              " px. For best results use " +
              REC_W +
              "×" +
              REC_H +
              " px."
          );
        }
      }
    },
    undefined,
    function () {
      if (gen !== self._imageLoadGen) return;
      self._setWarn("Could not load image - check the URL is public HTTPS");
      self._render();
    }
  );
};

var previewByCanvas = new WeakMap();
var identiconTexByWallet = new Map();
var identiconTexPool = new Set();

export function disposeAdvertBillboardPreview(canvas) {
  if (!canvas) return;
  var existing = previewByCanvas.get(canvas);
  if (!existing) return;
  existing.dispose();
  previewByCanvas.delete(canvas);
}

export function disposeAdvertBillboardPreviewsIn(container) {
  if (!container || !container.querySelectorAll) return;
  var canvases = container.querySelectorAll(
    "canvas.adv-preview-canvas, canvas.cp-preview-canvas"
  );
  for (var i = 0; i < canvases.length; i++) {
    disposeAdvertBillboardPreview(canvases[i]);
  }
}

export function mountAdvertBillboardPreview(canvas, warnEl) {
  var existing = previewByCanvas.get(canvas);
  if (existing) {
    if (warnEl) existing.setWarnElement(warnEl);
    return existing;
  }
  var preview = new AdvertBillboardPreview(canvas);
  preview.setWarnElement(warnEl);
  previewByCanvas.set(canvas, preview);
  return preview;
}

export function updateAdvertBillboardPreview(canvas, opts) {
  if (!canvas) return null;
  opts = opts || {};
  var preview = mountAdvertBillboardPreview(canvas, opts.warnEl || null);
  if (opts.wallet !== undefined) preview.setWallet(opts.wallet);
  if (opts.imageUrl !== undefined) preview.setImageUrl(opts.imageUrl);
  return preview;
}

export function bindAdvertBillboardPreview(imageInput, canvas, warnEl) {
  if (!imageInput || !canvas) return null;
  var preview = mountAdvertBillboardPreview(canvas, warnEl);
  preview.setWallet(canvas.getAttribute("data-wallet") || "");
  var sync = function () {
    var active = previewByCanvas.get(canvas);
    if (active) active.setImageUrl(imageInput.value);
  };
  if (imageInput.dataset.advPreviewBound !== "1") {
    imageInput.dataset.advPreviewBound = "1";
    imageInput.addEventListener("input", sync);
    imageInput.addEventListener("change", sync);
  }
  sync();
  return preview;
}

window.__advBindBillboardPreview = bindAdvertBillboardPreview;
window.__advMountBillboardPreview = mountAdvertBillboardPreview;
window.__advUpdateBillboardPreview = updateAdvertBillboardPreview;
window.__advDisposeBillboardPreviewsIn = disposeAdvertBillboardPreviewsIn;
window.__advPreviewModuleReady = true;
document.dispatchEvent(new Event("adv-preview-ready"));
`;
}
