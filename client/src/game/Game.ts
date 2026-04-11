import * as THREE from "three";
import type { PlayerState } from "../types.js";
import { walletDisplayName } from "../walletDisplayName.js";
import {
  FOG_INNER_RADIUS,
  FOG_OUTER_RADIUS,
  ROOM_ID,
  VIEW_FRUSTUM_SIZE,
} from "./constants.js";
import { FogOfWarPass } from "./fogOfWar.js";

const LS_ZOOM_MIN = "nspace_zoom_min";
const LS_ZOOM_MAX = "nspace_zoom_max";
const LS_ZOOM_FRUSTUM = "nspace_zoom_frustum";
const LS_FOG_ENABLED = "nspace_fog_enabled";
const LS_FOG_INNER = "nspace_fog_inner";
const LS_FOG_OUTER = "nspace_fog_outer";
const LS_IDENTICON_RX = "nspace_identicon_rx_deg";
const LS_IDENTICON_RY = "nspace_identicon_ry_deg";
const LS_IDENTICON_RZ = "nspace_identicon_rz_deg";
const LS_IDENTICON_SCALE = "nspace_identicon_scale";
const LS_FLOOR_TILE_QUAD = "nspace_floor_tile_quad";
const DEFAULT_ZOOM_MIN = 4;
const DEFAULT_ZOOM_MAX = 13.44;
import { loadIdenticonTexture } from "./identiconTexture.js";
import {
  type FloorTile,
  inferStartLayerClient,
  isBaseTile,
  isWalkableTile,
  pathfindTerrain,
  snapFloorTile,
  tileKey,
  waypointWorldY,
} from "./grid.js";
import {
  type RoomBounds,
  HUB_ROOM_ID,
  getDoorsForRoom,
  getRoomBaseBounds,
  isHubSpawnSafeZone,
  normalizeRoomId,
} from "./roomLayouts.js";
import {
  BLOCK_COLOR_COUNT,
  type BlockStyleProps,
  blockColorHex,
} from "./blockStyle.js";

const LERP = 12;

/** Default scale on unit floor plane; >1 hides subpixel seams (tunable in admin). */
const DEFAULT_FLOOR_TILE_QUAD = 1.08;

/** Void (non-walkable) — water/sky tint; walkable tiles use dark gray palette below. */
const TERRAIN_WATER_COLOR = 0xa8d8ea;
/** Core room / expanded floor / door — black–gray tones (not grass). */
const TERRAIN_TILE_CORE_COLOR = 0x2d3340;
const TERRAIN_TILE_EXTRA_COLOR = 0x3d5a4a;
const TERRAIN_TILE_DOOR_COLOR = 0x5c4a32;

/** y=0 ground plane (world). */
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

const PATH_Y = 0.06;
const PATH_LINE_OPACITY_FULL = 0.95;
/** Time for the path line to fade out when cleared or goal reached. */
const PATH_FADE_DURATION_SEC = 0.22;

/**
 * Identicon billboard (2D sprite); half-height in world units — bottom at y=0, center at this value.
 * Diameter = 2 × this (matches former sphere footprint).
 */
const AVATAR_SPHERE_RADIUS = 0.4;

const NAME_LABEL_FONT =
  '600 20px system-ui, "Segoe UI", sans-serif';
const CHAT_BUBBLE_FONT =
  '500 17px system-ui, "Segoe UI", sans-serif';
const NAME_LABEL_MAX_PX = 280;
/** On-screen height (px) for the name pill; scales with ortho zoom so text stays readable. */
const NAME_LABEL_SCREEN_HEIGHT_PX = 24;
const CHAT_MAX_PX = 260;
const CHAT_LINE_HEIGHT_PX = 22;
const CHAT_VISIBLE_MS = 5000;
const CHAT_FADE_MS = 600;
const CHAT_GAP_ABOVE_NAME = 0.06;
/** Gap between identicon bottom (y=0) and name label (screen px → world in Game). */
const NAME_GAP_BELOW_IDENTICON_PX = 2;

type ChatBubbleEntry = {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  texture: THREE.CanvasTexture;
  startedAt: number;
};

function createNameLabelSprite(displayName: string): {
  sprite: THREE.Sprite;
  texture: THREE.CanvasTexture;
} {
  const padX = 10;
  const radius = 9;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  ctx.font = NAME_LABEL_FONT;
  let text =
    displayName.length > 36 ? `${displayName.slice(0, 34)}…` : displayName;
  let tw = ctx.measureText(text).width;
  while (tw > NAME_LABEL_MAX_PX - padX * 2 && text.length > 3) {
    text = `${text.slice(0, -2)}…`;
    tw = ctx.measureText(text).width;
  }
  const w = Math.ceil(Math.max(36, tw + padX * 2));
  const h = 32;
  canvas.width = w;
  canvas.height = h;
  ctx.font = NAME_LABEL_FONT;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(0,0,0,0.48)";
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, radius);
  ctx.fill();
  ctx.fillStyle = "#e8edf2";
  ctx.fillText(text, w / 2, h / 2 + 0.5);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: false,
    })
  );
  sprite.renderOrder = 999;
  sprite.userData.nameLabelTexW = w;
  sprite.userData.nameLabelTexH = h;
  /* World scale set in Game.syncNameLabelScaleAndPosition from screen px + frustum. */
  sprite.scale.set(1, 1, 1);
  sprite.position.y = 0;
  return { sprite, texture: tex };
}

function wrapChatLines(
  ctx: CanvasRenderingContext2D,
  raw: string,
  maxW: number
): string[] {
  const text = raw.length > 200 ? `${raw.slice(0, 198)}…` : raw;
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const tryLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(tryLine).width <= maxW) {
      line = tryLine;
    } else {
      if (line) lines.push(line);
      line =
        ctx.measureText(word).width > maxW
          ? word.slice(0, Math.max(1, Math.floor(maxW / 8))) + "…"
          : word;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 5);
}

function createChatBubbleSprite(text: string): {
  sprite: THREE.Sprite;
  texture: THREE.CanvasTexture;
} {
  const padX = 10;
  const padY = 8;
  const radius = 10;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  ctx.font = CHAT_BUBBLE_FONT;
  const lines = wrapChatLines(ctx, text.trim() || " ", CHAT_MAX_PX);
  const lineWidths = lines.map((ln) => ctx.measureText(ln).width);
  const innerW = Math.min(CHAT_MAX_PX, Math.max(40, ...lineWidths));
  const w = Math.ceil(innerW + padX * 2);
  const lineH = CHAT_LINE_HEIGHT_PX;
  const h = Math.ceil(padY * 2 + lines.length * lineH);
  canvas.width = w;
  canvas.height = h;
  ctx.font = CHAT_BUBBLE_FONT;
  ctx.textBaseline = "top";
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, radius);
  ctx.fill();
  ctx.fillStyle = "#f1f5f9";
  lines.forEach((ln, i) => {
    ctx.fillText(ln, padX, padY + i * lineH);
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: false,
    })
  );
  sprite.renderOrder = 1000;
  const worldW = Math.min(2.4, w * 0.0065);
  const worldH = worldW * (h / w);
  sprite.scale.set(worldW, worldH, 1);
  return { sprite, texture: tex };
}

/** Placeholder isometric block (cube) — one tile footprint, sits on floor. */
const BLOCK_SIZE = 0.82;

/**
 * If `newPath` equals `oldPath.slice(k)` for some k, returns k (tiles dropped from the start).
 * Otherwise null (new click or path jumped).
 */
function findPrefixTerrainRemoved(
  oldPath: { x: number; z: number; layer: 0 | 1 }[],
  newPath: { x: number; z: number; layer: 0 | 1 }[]
): number | null {
  if (oldPath.length === 0 || newPath.length === 0) return null;
  if (newPath.length > oldPath.length) return null;
  const k = oldPath.length - newPath.length;
  for (let i = 0; i < newPath.length; i++) {
    const o = oldPath[k + i]!;
    const n = newPath[i]!;
    if (o.x !== n.x || o.z !== n.z || o.layer !== n.layer) return null;
  }
  return k;
}

export class Game {
  readonly scene: THREE.Scene;
  readonly camera: THREE.OrthographicCamera;
  readonly renderer: THREE.WebGLRenderer;
  private readonly canvasHost: HTMLElement;
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private readonly hit = new THREE.Vector3();
  private selfAddress = "";
  private selfMesh: THREE.Group | null = null;
  /** Authoritative position from server; selfMesh lerps toward this each frame. */
  private selfTargetPos: THREE.Vector3 | null = null;
  private readonly others = new Map<string, THREE.Group>();
  private readonly chatBubbleByAddress = new Map<string, ChatBubbleEntry>();
  private readonly targetPos = new Map<string, THREE.Vector3>();
  private ro: ResizeObserver;
  private tileHighlight: THREE.Mesh;
  private readonly tileHighlightMat: THREE.MeshBasicMaterial;
  private tileClickHandler:
    | ((x: number, z: number, layer?: 0 | 1) => void)
    | null = null;
  private placeBlockHandler: ((x: number, z: number) => void) | null = null;
  private moveBlockHandler:
    | ((fromX: number, fromZ: number, toX: number, toZ: number) => void)
    | null = null;
  private obstacleSelectHandler: ((x: number, z: number) => void) | null = null;
  private placeExtraFloorHandler: ((x: number, z: number) => void) | null = null;
  private removeExtraFloorHandler: ((x: number, z: number) => void) | null = null;
  private buildMode = false;
  /** Place walkable tiles outside the core room (toggle with F). */
  private floorExpandMode = false;
  private readonly extraFloorKeys = new Set<string>();
  /** One plane per walkable tile (core grid + extra); void shows scene background only. */
  private readonly walkableFloorMeshes = new Map<string, THREE.Mesh>();
  /** Shared 1×1 geometry; `floorTileQuadSize` scales each mesh to hide edge seams. */
  private readonly walkableFloorPlaneGeom = new THREE.PlaneGeometry(1, 1);
  private floorTileQuadSize = DEFAULT_FLOOR_TILE_QUAD;
  /** All placed objects (solid and walk-through). */
  private readonly placedObjects = new Map<string, BlockStyleProps>();
  /** Styles applied when placing new blocks in build mode. */
  private placementHalf = false;
  private placementQuarter = false;
  private placementHex = false;
  private placementRamp = false;
  private placementRampDir = 0;
  private placementColorId = 0;
  /** Subset of tile keys that block pathfinding (not passable). */
  private readonly blockingTileKeys = new Set<string>();
  private readonly blockMeshes = new Map<string, THREE.Group>();
  /** After "Move", next click on an empty tile relocates the object. */
  private repositionFrom: FloorTile | null = null;
  /** Destination tile + layer; remaining route is recomputed each frame from current position. */
  private pathGoal: { ft: FloorTile; layer: 0 | 1 } | null = null;
  private roomId = ROOM_ID;
  private roomBounds: RoomBounds = getRoomBaseBounds(ROOM_ID);
  private doors: {
    x: number;
    z: number;
    targetRoomId: string;
    spawnX: number;
    spawnZ: number;
  }[] = getDoorsForRoom(ROOM_ID).map((d) => ({ ...d }));
  private readonly doorTileKeys = new Set<string>();
  /** Previous tile key for the local avatar; used to detect stepping onto a door. */
  private selfLastTileKey: string | null = null;
  private roomChangeHandler:
    | ((
        targetRoomId: string,
        spawnX: number,
        spawnZ: number
      ) => void)
    | null = null;
  private pathFadingOut = false;
  private lastTerrainPath: { x: number; z: number; layer: 0 | 1 }[] | null =
    null;
  /** Selected obstacle tile key in build mode (`tileKey`); white outline. */
  private selectedBlockKey: string | null = null;
  private readonly selectionOutline: THREE.LineSegments;
  private readonly selectionOutlineMat: THREE.LineBasicMaterial;
  private readonly pathGeom = new THREE.BufferGeometry();
  private readonly pathLine: THREE.Line;
  /** Fades out segments that were just walked (prefix trimmed from main path). */
  private trailFadingOut = false;
  private readonly trailGeom = new THREE.BufferGeometry();
  private readonly trailLine: THREE.Line;

  /** World XZ point the camera orbits (isometric offset applied on top). */
  private readonly cameraLookAt = new THREE.Vector3(0, 0, 0);
  private readonly cameraOffset = new THREE.Vector3(18, 18, 18);
  /** Player can move this far from the look target (world units per axis) before the view pans. */
  private readonly cameraFollowDeadZone = 3.2;
  private readonly cameraFollowSmoothing = 12;
  private cameraFollowReady = false;

  /** Orthographic vertical half-extent (world units); smaller = zoomed in. */
  private frustumSize: number;
  private zoomMin: number;
  private zoomMax: number;
  private readonly fogOfWar: FogOfWarPass;
  /** Extra highlight on solid block tops when hovering in walk mode. */
  private readonly blockTopHighlight: THREE.Mesh;
  /** Server max place distance (world units); 0 = unlimited (no ring overlay). */
  private placeRadiusBlocks = 5;
  private readonly placementHintGeom: THREE.PlaneGeometry;
  private readonly placementHintMat: THREE.MeshBasicMaterial;
  private readonly placementHintMeshes = new Map<string, THREE.Mesh>();
  /** Active touch pointers on the canvas (for two-finger pinch zoom). */
  private readonly touchPointers = new Map<
    number,
    { x: number; y: number }
  >();
  /** Previous inter-touch distance (px) while pinching; 0 = not established yet. */
  private pinchLastDistancePx = 0;

  /** Identicon sphere Euler (degrees); applied to all player avatars. */
  private identiconRotDeg = { x: 0, y: 0, z: 0 };
  /** Uniform scale of the identicon sphere mesh (texture “zoom” via size). */
  private identiconScale = 1;
  private readonly identiconEulerScratch = new THREE.Euler();

  constructor(canvasHost: HTMLElement) {
    this.canvasHost = canvasHost;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(TERRAIN_WATER_COLOR);

    this.zoomMin = Game.readZoomBound(LS_ZOOM_MIN, DEFAULT_ZOOM_MIN);
    this.zoomMax = Game.readZoomBound(LS_ZOOM_MAX, DEFAULT_ZOOM_MAX);
    if (this.zoomMin >= this.zoomMax) {
      this.zoomMin = DEFAULT_ZOOM_MIN;
      this.zoomMax = DEFAULT_ZOOM_MAX;
    }
    const savedFrustum = Game.readZoomBound(LS_ZOOM_FRUSTUM, VIEW_FRUSTUM_SIZE);
    this.frustumSize = Game.clampZoom(
      savedFrustum,
      this.zoomMin,
      this.zoomMax,
      VIEW_FRUSTUM_SIZE
    );

    this.identiconRotDeg = {
      x: Game.readIdenticonDeg(LS_IDENTICON_RX, 0),
      y: Game.readIdenticonDeg(LS_IDENTICON_RY, 0),
      z: Game.readIdenticonDeg(LS_IDENTICON_RZ, 0),
    };
    this.identiconScale = Game.readIdenticonScale(LS_IDENTICON_SCALE, 1);
    this.floorTileQuadSize = Game.readFloorTileQuad(
      LS_FLOOR_TILE_QUAD,
      DEFAULT_FLOOR_TILE_QUAD
    );

    const aspect = 16 / 9;
    this.camera = new THREE.OrthographicCamera(
      (this.frustumSize * aspect) / -2,
      (this.frustumSize * aspect) / 2,
      this.frustumSize / 2,
      this.frustumSize / -2,
      0.1,
      2000
    );
    this.applyCameraPose();

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(1);
    this.canvasHost.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.cursor = "pointer";

    const amb = new THREE.AmbientLight(0xffffff, 0.62);
    this.scene.add(amb);
    const dir = new THREE.DirectionalLight(0xfff8f0, 0.72);
    dir.position.set(8, 20, 10);
    this.scene.add(dir);

    this.tileHighlightMat = new THREE.MeshBasicMaterial({
      color: 0x2dd4bf,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    this.tileHighlight = new THREE.Mesh(
      new THREE.PlaneGeometry(0.92, 0.92),
      this.tileHighlightMat
    );
    this.tileHighlight.rotation.x = -Math.PI / 2;
    this.tileHighlight.position.set(0, 0.02, 0);
    this.tileHighlight.visible = false;
    this.scene.add(this.tileHighlight);

    const topHiMat = new THREE.MeshBasicMaterial({
      color: 0x2dd4bf,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    });
    this.blockTopHighlight = new THREE.Mesh(
      new THREE.PlaneGeometry(0.82, 0.82),
      topHiMat
    );
    this.blockTopHighlight.rotation.x = -Math.PI / 2;
    this.blockTopHighlight.visible = false;
    this.scene.add(this.blockTopHighlight);

    this.placementHintGeom = new THREE.PlaneGeometry(0.92, 0.92);
    this.placementHintMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
    });

    this.pathGeom.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(6), 3)
    );
    this.pathLine = new THREE.Line(
      this.pathGeom,
      new THREE.LineBasicMaterial({
        color: 0x2dd4bf,
        depthTest: true,
        transparent: true,
        opacity: PATH_LINE_OPACITY_FULL,
      })
    );
    this.pathLine.visible = false;
    this.pathLine.frustumCulled = false;
    this.scene.add(this.pathLine);

    this.trailGeom.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(6), 3)
    );
    this.trailLine = new THREE.Line(
      this.trailGeom,
      new THREE.LineBasicMaterial({
        color: 0x2dd4bf,
        depthTest: true,
        transparent: true,
        opacity: PATH_LINE_OPACITY_FULL,
      })
    );
    this.trailLine.visible = false;
    this.trailLine.frustumCulled = false;
    this.scene.add(this.trailLine);

    this.selectionOutlineMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      depthTest: true,
      linewidth: 3,
    });
    this.selectionOutline = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      this.selectionOutlineMat
    );
    this.selectionOutline.visible = false;
    this.selectionOutline.frustumCulled = false;
    this.scene.add(this.selectionOutline);

    const fogInner = Game.readFogNumber(LS_FOG_INNER, FOG_INNER_RADIUS);
    const fogOuter = Game.readFogNumber(LS_FOG_OUTER, FOG_OUTER_RADIUS);
    const fogR = Game.normalizeFogRadii(fogInner, fogOuter);
    this.fogOfWar = new FogOfWarPass(fogR.inner, fogR.outer);
    this.fogOfWar.setEnabled(localStorage.getItem(LS_FOG_ENABLED) === "1");

    const onResize = (): void => this.resize();
    this.ro = new ResizeObserver(onResize);
    this.ro.observe(this.canvasHost);
    onResize();

    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointermove", this.onPointerMove, {
      passive: false,
    });
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerUp);
    canvas.addEventListener("wheel", this.onWheel, {
      passive: false,
    });

    this.rebuildDoorKeys();
    this.syncWalkableFloorMeshes();
  }

  private rebuildDoorKeys(): void {
    this.doorTileKeys.clear();
    for (const d of this.doors) {
      this.doorTileKeys.add(tileKey(d.x, d.z));
    }
  }

  getRoomId(): string {
    return this.roomId;
  }

  /** Snapshot for debug HUD (room layout, counts, local pose). */
  getDebugStats(): {
    roomId: string;
    bounds: RoomBounds;
    doorCount: number;
    obstacleCount: number;
    extraFloorCount: number;
    remotePlayerCount: number;
    /** Local + remote avatars in scene (matches server list when in sync). */
    avatarCount: number;
    selfPosition: { x: number; y: number; z: number } | null;
    zoomFrustum: number;
    fogEnabled: boolean;
    fogInner: number;
    fogOuter: number;
    buildMode: boolean;
    floorExpandMode: boolean;
  } {
    const self = this.selfMesh;
    const r = this.getFogOfWarRadii();
    return {
      roomId: this.roomId,
      bounds: { ...this.roomBounds },
      doorCount: this.doors.length,
      obstacleCount: this.placedObjects.size,
      extraFloorCount: this.extraFloorKeys.size,
      remotePlayerCount: this.others.size,
      avatarCount: (self ? 1 : 0) + this.others.size,
      selfPosition: self
        ? {
            x: self.position.x,
            y: self.position.y,
            z: self.position.z,
          }
        : null,
      zoomFrustum: this.frustumSize,
      fogEnabled: this.getFogOfWarEnabled(),
      fogInner: r.inner,
      fogOuter: r.outer,
      buildMode: this.buildMode,
      floorExpandMode: this.floorExpandMode,
    };
  }

  applyRoomFromWelcome(msg: {
    roomId: string;
    roomBounds: RoomBounds;
    doors: {
      x: number;
      z: number;
      targetRoomId: string;
      spawnX: number;
      spawnZ: number;
    }[];
    placeRadiusBlocks?: number;
  }): void {
    this.roomId = msg.roomId;
    this.roomBounds = msg.roomBounds;
    this.doors = msg.doors.map((d) => ({ ...d }));
    if (
      msg.placeRadiusBlocks !== undefined &&
      Number.isFinite(msg.placeRadiusBlocks)
    ) {
      this.placeRadiusBlocks = Math.max(
        0,
        Math.min(64, msg.placeRadiusBlocks)
      );
    }
    this.rebuildDoorKeys();
    this.pathGoal = null;
    this.selfLastTileKey = null;
    this.lastTerrainPath = null;
    this.selectedBlockKey = null;
    this.selectionOutline.visible = false;
    this.hideTrailImmediate();
    this.beginPathFadeOut();
    this.syncWalkableFloorMeshes();
    this.refreshPathLine();
    this.syncPlacementRangeHints();
  }

  setRoomChangeHandler(
    fn: ((targetRoomId: string, spawnX: number, spawnZ: number) => void) | null
  ): void {
    this.roomChangeHandler = fn;
  }

  private static readZoomBound(key: string, fallback: number): number {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }

  private static clampFloorTileQuad(n: number): number {
    if (!Number.isFinite(n)) return DEFAULT_FLOOR_TILE_QUAD;
    return Math.min(1.08, Math.max(1.0, n));
  }

  private static readFloorTileQuad(key: string, fallback: number): number {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? Game.clampFloorTileQuad(n) : fallback;
  }

  private static readIdenticonDeg(key: string, fallback: number): number {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? Game.clampIdenticonDeg(n) : fallback;
  }

  private static clampIdenticonDeg(n: number): number {
    return Math.max(-360, Math.min(360, n));
  }

  private static readIdenticonScale(key: string, fallback: number): number {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? Game.clampIdenticonScale(n) : fallback;
  }

  private static clampIdenticonScale(n: number): number {
    return Math.max(0.25, Math.min(3, n));
  }

  private static clampZoom(
    v: number,
    min: number,
    max: number,
    fallback: number
  ): number {
    const lo = Math.min(min, max);
    const hi = Math.max(min, max);
    if (!Number.isFinite(v)) return fallback;
    return Math.max(lo, Math.min(hi, v));
  }

  private static readFogNumber(key: string, fallback: number): number {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  }

  /** Clamp fog radii to sane ranges; keeps inner ≤ outer with a minimum band. */
  static normalizeFogRadii(
    inner: number,
    outer: number
  ): { inner: number; outer: number } {
    const MAX_R = 400;
    const MIN_BAND = 0.5;
    let lo = Number(inner);
    let hi = Number(outer);
    if (!Number.isFinite(lo)) lo = FOG_INNER_RADIUS;
    if (!Number.isFinite(hi)) hi = FOG_OUTER_RADIUS;
    lo = Math.max(0, Math.min(lo, MAX_R));
    hi = Math.max(0, Math.min(hi, MAX_R));
    if (hi <= lo) hi = lo + MIN_BAND;
    if (hi > MAX_R) {
      hi = MAX_R;
      lo = Math.min(lo, hi - MIN_BAND);
    }
    return { inner: lo, outer: hi };
  }

  getFogOfWarEnabled(): boolean {
    return this.fogOfWar.getEnabled();
  }

  setFogOfWarEnabled(enabled: boolean): void {
    this.fogOfWar.setEnabled(enabled);
    localStorage.setItem(LS_FOG_ENABLED, enabled ? "1" : "0");
  }

  getFogOfWarRadii(): { inner: number; outer: number } {
    return this.fogOfWar.getRadii();
  }

  setFogOfWarRadii(inner: number, outer: number): void {
    const r = Game.normalizeFogRadii(inner, outer);
    this.fogOfWar.setRadii(r.inner, r.outer);
    localStorage.setItem(LS_FOG_INNER, String(r.inner));
    localStorage.setItem(LS_FOG_OUTER, String(r.outer));
  }

  getZoomFrustumSize(): number {
    return this.frustumSize;
  }

  getZoomBounds(): { min: number; max: number } {
    return { min: this.zoomMin, max: this.zoomMax };
  }

  /** Uniform XY scale on shared 1×1 floor quads (reduces seam flicker when > 1). Persists in localStorage. */
  getFloorTileQuadSize(): number {
    return this.floorTileQuadSize;
  }

  setFloorTileQuadSize(size: number): void {
    this.floorTileQuadSize = Game.clampFloorTileQuad(size);
    try {
      localStorage.setItem(LS_FLOOR_TILE_QUAD, String(this.floorTileQuadSize));
    } catch {
      /* ignore quota */
    }
    this.applyFloorTileQuadScale();
  }

  private applyFloorTileQuadScale(): void {
    const s = this.floorTileQuadSize;
    for (const [, mesh] of this.walkableFloorMeshes) {
      mesh.scale.set(s, s, 1);
    }
  }

  /**
   * Sets allowed zoom range (orthographic frustum vertical half-extent).
   * Persists to localStorage; clamps current frustum into the new range.
   */
  setZoomBounds(min: number, max: number): void {
    let lo = Number(min);
    let hi = Number(max);
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return;
    if (lo >= hi) {
      lo = DEFAULT_ZOOM_MIN;
      hi = DEFAULT_ZOOM_MAX;
    }
    this.zoomMin = lo;
    this.zoomMax = hi;
    localStorage.setItem(LS_ZOOM_MIN, String(this.zoomMin));
    localStorage.setItem(LS_ZOOM_MAX, String(this.zoomMax));
    this.frustumSize = Game.clampZoom(
      this.frustumSize,
      this.zoomMin,
      this.zoomMax,
      VIEW_FRUSTUM_SIZE
    );
    localStorage.setItem(LS_ZOOM_FRUSTUM, String(this.frustumSize));
    this.applyOrthographicFrustum();
    this.refreshAllNameLabelScales();
    this.refreshChatBubbleVerticalPositions();
  }

  setZoomFrustumSize(size: number): void {
    this.frustumSize = Game.clampZoom(
      size,
      this.zoomMin,
      this.zoomMax,
      VIEW_FRUSTUM_SIZE
    );
    localStorage.setItem(LS_ZOOM_FRUSTUM, String(this.frustumSize));
    this.applyOrthographicFrustum();
    this.refreshAllNameLabelScales();
    this.refreshChatBubbleVerticalPositions();
  }

  /** Euler angles (degrees) for the identicon sphere mesh (XYZ order). */
  getIdenticonRotationDegrees(): { x: number; y: number; z: number } {
    return { ...this.identiconRotDeg };
  }

  /**
   * Rotates the textured sphere for every avatar; persisted for tuning orientation.
   */
  setIdenticonRotationDegrees(x: number, y: number, z: number): void {
    this.identiconRotDeg = {
      x: Game.clampIdenticonDeg(x),
      y: Game.clampIdenticonDeg(y),
      z: Game.clampIdenticonDeg(z),
    };
    localStorage.setItem(LS_IDENTICON_RX, String(this.identiconRotDeg.x));
    localStorage.setItem(LS_IDENTICON_RY, String(this.identiconRotDeg.y));
    localStorage.setItem(LS_IDENTICON_RZ, String(this.identiconRotDeg.z));
    this.applyIdenticonTransformToAllAvatars();
  }

  getIdenticonScale(): number {
    return this.identiconScale;
  }

  /** Uniform scale of the textured sphere (0.25–3). Persists to localStorage. */
  setIdenticonScale(scale: number): void {
    this.identiconScale = Game.clampIdenticonScale(scale);
    localStorage.setItem(LS_IDENTICON_SCALE, String(this.identiconScale));
    this.applyIdenticonTransformToAllAvatars();
    this.refreshChatBubbleVerticalPositions();
  }

  private getIdenticonEuler(): THREE.Euler {
    const d = THREE.MathUtils.degToRad;
    this.identiconEulerScratch.set(
      d(this.identiconRotDeg.x),
      d(this.identiconRotDeg.y),
      d(this.identiconRotDeg.z),
      "XYZ"
    );
    return this.identiconEulerScratch;
  }

  private applyIdenticonTransformToAllAvatars(): void {
    const e = this.getIdenticonEuler();
    const s = this.identiconScale;
    const d = AVATAR_SPHERE_RADIUS * 2 * s;
    const apply = (g: THREE.Group | null): void => {
      if (!g) return;
      const identicon = g.userData.identiconMesh as THREE.Sprite | undefined;
      if (identicon) {
        identicon.rotation.copy(e);
        identicon.scale.set(d, d, 1);
        identicon.position.y = AVATAR_SPHERE_RADIUS * s;
      }
      this.updateAvatarNameLabelHeight(g);
    };
    apply(this.selfMesh);
    for (const [, g] of this.others) apply(g);
  }

  /** Vertical world distance matching `px` at current canvas height & ortho frustum. */
  private pixelToWorldY(px: number): number {
    const h = this.canvasHost.clientHeight;
    if (h < 1) return px * 0.001;
    return (px / h) * this.frustumSize;
  }

  /** Horizontal world distance matching `px` at current canvas width & ortho frustum. */
  private pixelToWorldX(px: number): number {
    const w = this.canvasHost.clientWidth;
    const h = this.canvasHost.clientHeight;
    if (w < 1) return px * 0.001;
    return (px / w) * this.frustumSize * (w / h);
  }

  /** Keeps name tags near constant on-screen size at any orthographic zoom. */
  private syncNameLabelScaleAndPosition(g: THREE.Group): void {
    const nameSprite = g.userData.nameSprite as THREE.Sprite | undefined;
    if (!nameSprite) return;
    const tw = nameSprite.userData.nameLabelTexW as number | undefined;
    const th = nameSprite.userData.nameLabelTexH as number | undefined;
    if (!tw || !th) return;
    let worldH = this.pixelToWorldY(NAME_LABEL_SCREEN_HEIGHT_PX);
    let worldW = worldH * (tw / th);
    const maxW = this.pixelToWorldX(NAME_LABEL_MAX_PX);
    if (worldW > maxW) {
      const s = maxW / worldW;
      worldW *= s;
      worldH *= s;
    }
    nameSprite.scale.set(worldW, worldH, 1);
    this.updateAvatarNameLabelHeight(g);
  }

  private refreshAllNameLabelScales(): void {
    if (this.selfMesh) this.syncNameLabelScaleAndPosition(this.selfMesh);
    for (const [, g] of this.others) this.syncNameLabelScaleAndPosition(g);
  }

  private updateAvatarNameLabelHeight(g: THREE.Group): void {
    const nameSprite = g.userData.nameSprite as THREE.Sprite | undefined;
    if (!nameSprite) return;
    const worldH = nameSprite.scale.y;
    const gapWorld = this.pixelToWorldY(NAME_GAP_BELOW_IDENTICON_PX);
    nameSprite.position.y = -gapWorld - worldH / 2;
  }

  private refreshChatBubbleVerticalPositions(): void {
    for (const [addr, entry] of this.chatBubbleByAddress) {
      const g =
        addr === this.selfAddress
          ? this.selfMesh
          : this.others.get(addr) ?? null;
      if (!g) continue;
      const nameSprite = g.userData.nameSprite as THREE.Sprite | undefined;
      const sprite = entry.sprite;
      if (nameSprite) {
        const nh = nameSprite.scale.y;
        const ny = nameSprite.position.y;
        const nameTop = ny + nh / 2;
        const ch = sprite.scale.y;
        sprite.position.y = nameTop + CHAT_GAP_ABOVE_NAME + ch / 2;
      } else {
        sprite.position.y =
          AVATAR_SPHERE_RADIUS * 2 * this.identiconScale + 0.45;
      }
    }
  }

  private applyOrthographicFrustum(): void {
    const w = this.canvasHost.clientWidth;
    const h = this.canvasHost.clientHeight;
    const aspect = w > 0 && h > 0 ? w / h : 16 / 9;
    const f = this.frustumSize;
    this.camera.left = (f * aspect) / -2;
    this.camera.right = (f * aspect) / 2;
    this.camera.top = f / 2;
    this.camera.bottom = f / -2;
    this.camera.updateProjectionMatrix();
  }

  private readonly onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const scale = Math.exp(-e.deltaY * 0.0015);
    const next = this.frustumSize / scale;
    this.setZoomFrustumSize(next);
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    if (e.pointerType !== "touch") return;
    this.touchPointers.delete(e.pointerId);
    if (this.touchPointers.size < 2) {
      this.pinchLastDistancePx = 0;
    }
  };

  /** Screen distance between first two active touches (px). */
  private pinchScreenDistancePx(): number | null {
    const it = this.touchPointers.values();
    const a = it.next().value;
    const b = it.next().value;
    if (!a || !b) return null;
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  setTileClickHandler(
    handler: ((x: number, z: number, layer?: 0 | 1) => void) | null
  ): void {
    this.tileClickHandler = handler;
  }

  setPlaceBlockHandler(handler: ((x: number, z: number) => void) | null): void {
    this.placeBlockHandler = handler;
  }

  setMoveBlockHandler(
    handler:
      | ((fromX: number, fromZ: number, toX: number, toZ: number) => void)
      | null
  ): void {
    this.moveBlockHandler = handler;
  }

  setObstacleSelectHandler(
    handler: ((x: number, z: number) => void) | null
  ): void {
    this.obstacleSelectHandler = handler;
  }

  setPlaceExtraFloorHandler(
    handler: ((x: number, z: number) => void) | null
  ): void {
    this.placeExtraFloorHandler = handler;
  }

  setRemoveExtraFloorHandler(
    handler: ((x: number, z: number) => void) | null
  ): void {
    this.removeExtraFloorHandler = handler;
  }

  getPlacedAt(x: number, z: number): BlockStyleProps | null {
    return this.placedObjects.get(tileKey(x, z)) ?? null;
  }

  getPlacementBlockStyle(): {
    half: boolean;
    quarter: boolean;
    hex: boolean;
    ramp: boolean;
    rampDir: number;
    colorId: number;
  } {
    return {
      half: this.placementHalf,
      quarter: this.placementQuarter,
      hex: this.placementHex,
      ramp: this.placementRamp,
      rampDir: this.placementRampDir,
      colorId: this.placementColorId,
    };
  }

  setPlacementBlockStyle(p: {
    half?: boolean;
    quarter?: boolean;
    hex?: boolean;
    ramp?: boolean;
    rampDir?: number;
    colorId?: number;
  }): void {
    if (p.quarter === true) {
      this.placementQuarter = true;
      this.placementHalf = false;
    } else if (p.quarter === false) {
      this.placementQuarter = false;
    }
    if (p.half === true) {
      this.placementHalf = true;
      this.placementQuarter = false;
    } else if (p.half === false && p.quarter !== true) {
      this.placementHalf = false;
    }
    if (p.hex !== undefined) this.placementHex = p.hex;
    if (p.ramp === true) {
      this.placementRamp = true;
      this.placementHex = false;
    } else if (p.ramp === false) {
      this.placementRamp = false;
    }
    if (p.rampDir !== undefined) {
      this.placementRampDir = Math.max(0, Math.min(3, Math.floor(p.rampDir)));
    }
    if (p.colorId !== undefined) {
      this.placementColorId = Math.max(
        0,
        Math.min(BLOCK_COLOR_COUNT - 1, Math.floor(p.colorId))
      );
    }
  }

  setSelectedBlockKey(key: string | null): void {
    if (this.selectedBlockKey === key) return;
    this.selectedBlockKey = key;
    this.refreshSelectionOutline();
  }

  clearSelectedBlock(): void {
    this.selectedBlockKey = null;
    this.refreshSelectionOutline();
  }

  getSelectedBlockTile(): { x: number; z: number } | null {
    if (!this.selectedBlockKey) return null;
    const [x, z] = this.selectedBlockKey.split(",").map(Number);
    if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
    return { x: x!, z: z! };
  }

  private refreshSelectionOutline(): void {
    if (!this.selectedBlockKey || !this.buildMode) {
      this.selectionOutline.visible = false;
      return;
    }
    const g = this.blockMeshes.get(this.selectedBlockKey);
    if (!g) {
      this.selectionOutline.visible = false;
      return;
    }
    const box = new THREE.Box3().setFromObject(g);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    if (size.x < 1e-6 || size.y < 1e-6 || size.z < 1e-6) {
      this.selectionOutline.visible = false;
      return;
    }
    // Add padding to make outline more visible
    const padding = 0.04;
    size.x += padding;
    size.y += padding;
    size.z += padding;
    const prev = this.selectionOutline.geometry;
    const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
    const edges = new THREE.EdgesGeometry(geo, 50);
    geo.dispose();
    this.selectionOutline.geometry = edges;
    prev.dispose();
    this.selectionOutline.position.copy(center);
    this.selectionOutline.rotation.set(0, 0, 0);
    this.selectionOutline.visible = true;
  }

  beginReposition(x: number, z: number): void {
    this.repositionFrom = { x, y: z };
    this.syncHighlightColor();
  }

  cancelReposition(): void {
    this.repositionFrom = null;
    this.syncHighlightColor();
  }

  isRepositioning(): boolean {
    return this.repositionFrom !== null;
  }

  setBuildMode(on: boolean): void {
    this.buildMode = on;
    if (on) this.floorExpandMode = false;
    if (!on) {
      this.repositionFrom = null;
      this.clearSelectedBlock();
    }
    this.syncHighlightColor();
    this.refreshSelectionOutline();
    this.syncPlacementRangeHints();
  }

  getBuildMode(): boolean {
    return this.buildMode;
  }

  setFloorExpandMode(on: boolean): void {
    this.floorExpandMode = on;
    if (on) {
      this.buildMode = false;
      this.repositionFrom = null;
    }
    this.syncHighlightColor();
    this.syncPlacementRangeHints();
  }

  getFloorExpandMode(): boolean {
    return this.floorExpandMode;
  }

  /** Extra walkable tiles outside the core grid (server-synced). */
  setExtraFloorTiles(tiles: readonly { x: number; z: number }[]): void {
    this.extraFloorKeys.clear();
    for (const t of tiles) {
      this.extraFloorKeys.add(tileKey(t.x, t.z));
    }
    this.syncWalkableFloorMeshes();
    this.refreshPathLine();
    this.syncPlacementRangeHints();
  }

  /** Wire format matches server obstacle tiles. */
  setObstacles(
    tiles: readonly {
      x: number;
      z: number;
      passable: boolean;
      half?: boolean;
      quarter?: boolean;
      hex?: boolean;
      ramp?: boolean;
      rampDir?: number;
      colorId?: number;
    }[]
  ): void {
    this.placedObjects.clear();
    this.blockingTileKeys.clear();
    for (const t of tiles) {
      const k = tileKey(t.x, t.z);
      const quarter = Boolean(t.quarter);
      const half = quarter ? false : Boolean(t.half);
      const ramp = Boolean(t.ramp);
      const rampDir = Math.max(0, Math.min(3, Math.floor(t.rampDir ?? 0)));
      const hex = ramp ? false : Boolean(t.hex);
      const colorId = Math.max(
        0,
        Math.min(BLOCK_COLOR_COUNT - 1, Math.floor(t.colorId ?? 0))
      );
      this.placedObjects.set(k, {
        passable: t.passable,
        half,
        quarter,
        hex,
        ramp,
        rampDir,
        colorId,
      });
      if (!t.passable && !ramp) this.blockingTileKeys.add(k);
    }
    this.syncBlockMeshes();
    this.refreshPathLine();
    this.refreshSelectionOutline();
    this.syncPlacementRangeHints();
  }

  /** Floor tiles where a new block can be placed (within server place radius, empty, walkable). */
  private syncPlacementRangeHints(): void {
    for (const [, m] of this.placementHintMeshes) {
      this.scene.remove(m);
    }
    this.placementHintMeshes.clear();
    if (!this.buildMode || !this.selfMesh || this.placeRadiusBlocks <= 0) {
      return;
    }
    const R = this.placeRadiusBlocks;
    const px = this.selfMesh.position.x;
    const pz = this.selfMesh.position.z;
    const here = snapFloorTile(px, pz);
    const minX = Math.floor(px - R) - 1;
    const maxX = Math.ceil(px + R) + 1;
    const minZ = Math.floor(pz - R) - 1;
    const maxZ = Math.ceil(pz + R) + 1;
    for (let tx = minX; tx <= maxX; tx++) {
      for (let tz = minZ; tz <= maxZ; tz++) {
        if (Math.hypot(px - tx, pz - tz) > R + 1e-6) continue;
        if (!this.tileWalkable({ x: tx, y: tz })) continue;
        const k = tileKey(tx, tz);
        if (this.placedObjects.has(k)) continue;
        if (this.hubNoBuildTile(tx, tz)) continue;
        if (tx === here.x && tz === here.y) continue;
        const mesh = new THREE.Mesh(this.placementHintGeom, this.placementHintMat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(tx, 0.018, tz);
        mesh.renderOrder = 1;
        this.scene.add(mesh);
        this.placementHintMeshes.set(k, mesh);
      }
    }
  }

  private syncHighlightColor(): void {
    if (this.repositionFrom) {
      this.tileHighlightMat.color.setHex(0xc084fc);
      return;
    }
    if (this.floorExpandMode) {
      this.tileHighlightMat.color.setHex(0x34d399);
      return;
    }
    if (this.buildMode) {
      this.tileHighlightMat.color.setHex(0xf59e0b);
      return;
    }
    this.tileHighlightMat.color.setHex(0x2dd4bf);
  }

  private tileWalkable(ft: FloorTile): boolean {
    return isWalkableTile(ft.x, ft.y, this.extraFloorKeys, this.roomId);
  }

  /** Hub center safe zone: no new blocks or reposition targets. */
  private hubNoBuildTile(x: number, z: number): boolean {
    return (
      normalizeRoomId(this.roomId) === HUB_ROOM_ID && isHubSpawnSafeZone(x, z)
    );
  }

  private pickWalkableTile(
    clientX: number,
    clientY: number
  ): FloorTile | null {
    const t = this.pickFloor(clientX, clientY);
    if (!t) return null;
    return this.tileWalkable(t) ? t : null;
  }

  private updateNdc(clientX: number, clientY: number): boolean {
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return false;
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width < 1e-6 || rect.height < 1e-6) return false;
    this.ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    return true;
  }

  /** Tile hover uses pointer move; touch-first devices get bogus post-touch “mouse” moves — skip hover. */
  private static canShowPointerHoverTiles(): boolean {
    if (typeof window === "undefined") return true;
    return (
      window.matchMedia("(hover: hover)").matches &&
      window.matchMedia("(pointer: fine)").matches
    );
  }

  /**
   * Infinite line vs y=0 plane. `Ray.intersectPlane` rejects t&lt;0, which breaks orthographic
   * picking when the intersection lies behind the ray origin — use full line intersection.
   */
  /** Tile under cursor: `x` = column (world X), `y` = row (world Z). */
  private pickFloor(clientX: number, clientY: number): FloorTile | null {
    if (!this.updateNdc(clientX, clientY)) return null;
    this.camera.updateMatrixWorld();
    this.camera.updateProjectionMatrix();
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const ray = this.raycaster.ray;
    const n = floorPlane.normal;
    const denom = n.dot(ray.direction);
    if (Math.abs(denom) < 1e-8) return null;
    const t = -(n.dot(ray.origin) + floorPlane.constant) / denom;
    this.hit.copy(ray.direction).multiplyScalar(t).add(ray.origin);
    if (!Number.isFinite(this.hit.x) || !Number.isFinite(this.hit.z)) return null;
    return snapFloorTile(this.hit.x, this.hit.z);
  }

  /** Returns `tileKey` if the ray hits a placed block mesh, else null. */
  private pickBlockKey(clientX: number, clientY: number): string | null {
    if (!this.updateNdc(clientX, clientY)) return null;
    this.camera.updateMatrixWorld();
    this.camera.updateProjectionMatrix();
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const roots = [...this.blockMeshes.values()];
    const hits = this.raycaster.intersectObjects(roots, true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o) {
        const k = o.userData["tileKey"] as string | undefined;
        if (k) return k;
        o = o.parent;
      }
    }
    return null;
  }

  private onPointerMove = (e: PointerEvent): void => {
    if (e.pointerType === "touch") {
      this.touchPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    if (this.touchPointers.size >= 2) {
      const d = this.pinchScreenDistancePx();
      if (d !== null && d > 1e-3) {
        if (this.pinchLastDistancePx > 0) {
          const next =
            this.frustumSize * (this.pinchLastDistancePx / d);
          this.setZoomFrustumSize(next);
        }
        this.pinchLastDistancePx = d;
      }
      e.preventDefault();
      return;
    }

    if (!Game.canShowPointerHoverTiles()) {
      this.tileHighlight.visible = false;
      this.blockTopHighlight.visible = false;
      return;
    }
    if (this.floorExpandMode) {
      const t = this.pickFloor(e.clientX, e.clientY);
      if (!t) {
        this.tileHighlight.visible = false;
        return;
      }
      this.tileHighlight.position.set(t.x, 0.03, t.y);
      this.tileHighlight.visible = true;
      return;
    }
    if (this.buildMode) {
      this.blockTopHighlight.visible = false;
    } else {
      const blockHit = this.pickBlockKey(e.clientX, e.clientY);
      if (blockHit) {
        const meta = this.placedObjects.get(blockHit);
        if (meta && !meta.passable && !meta.ramp) {
          const [bx, bz] = blockHit.split(",").map(Number);
          const h = this.obstacleHeight(meta);
          this.tileHighlight.position.set(bx!, 0.02, bz!);
          this.tileHighlight.visible = true;
          this.blockTopHighlight.position.set(bx!, h + 0.03, bz!);
          this.blockTopHighlight.visible = true;
          return;
        }
      }
      this.blockTopHighlight.visible = false;
    }
    const p = this.pickWalkableTile(e.clientX, e.clientY);
    if (!p) {
      this.tileHighlight.visible = false;
      return;
    }
    this.tileHighlight.position.set(p.x, 0.02, p.y);
    this.tileHighlight.visible = true;
  };

  private onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    if (e.pointerType === "touch") {
      this.touchPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.touchPointers.size >= 2) {
        this.pinchLastDistancePx = 0;
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }
    if (!this.selfMesh) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.pointerType === "touch") {
      this.tileHighlight.visible = false;
      this.blockTopHighlight.visible = false;
    }

    if (this.floorExpandMode) {
      const dest = this.pickFloor(e.clientX, e.clientY);
      if (!dest) return;
      const k = tileKey(dest.x, dest.y);
      if (e.shiftKey) {
        if (isBaseTile(dest.x, dest.y, this.roomId)) return;
        if (!this.extraFloorKeys.has(k)) return;
        this.removeExtraFloorHandler?.(dest.x, dest.y);
        return;
      }
      this.placeExtraFloorHandler?.(dest.x, dest.y);
      return;
    }

    if (this.buildMode) {
      if (this.repositionFrom) {
        if (!this.moveBlockHandler) {
          this.cancelReposition();
        } else {
          const blockHit = this.pickBlockKey(e.clientX, e.clientY);
          if (blockHit) {
            const [bx, bz] = blockHit.split(",").map(Number);
            this.cancelReposition();
            const wasAlreadySelected = this.selectedBlockKey === blockHit;
            this.setSelectedBlockKey(blockHit);
            if (!wasAlreadySelected) {
              this.obstacleSelectHandler?.(bx!, bz!);
            }
            return;
          }
          const dest = this.pickFloor(e.clientX, e.clientY);
          if (!dest) return;
          if (!this.tileWalkable(dest)) return;
          const destK = tileKey(dest.x, dest.y);
          if (this.placedObjects.has(destK)) return;
          if (this.hubNoBuildTile(dest.x, dest.y)) return;
          const here = snapFloorTile(this.selfMesh.position.x, this.selfMesh.position.z);
          if (here.x === dest.x && here.y === dest.y) return;
          const from = this.repositionFrom;
          this.moveBlockHandler(from.x, from.y, dest.x, dest.y);
          this.cancelReposition();
          return;
        }
      }

      const blockHit = this.pickBlockKey(e.clientX, e.clientY);
      if (blockHit) {
        const [bx, bz] = blockHit.split(",").map(Number);
        const wasAlreadySelected = this.selectedBlockKey === blockHit;
        this.setSelectedBlockKey(blockHit);
        if (!wasAlreadySelected) {
          this.obstacleSelectHandler?.(bx!, bz!);
        }
        return;
      }

      const dest = this.pickFloor(e.clientX, e.clientY);
      if (!dest) return;
      if (!this.tileWalkable(dest)) return;
      if (!this.placeBlockHandler) return;
      const k = tileKey(dest.x, dest.y);
      if (this.placedObjects.has(k)) return;
      if (this.hubNoBuildTile(dest.x, dest.y)) return;
      const here = snapFloorTile(this.selfMesh.position.x, this.selfMesh.position.z);
      if (here.x === dest.x && here.y === dest.y) return;
      this.placeBlockHandler(dest.x, dest.y);
      return;
    }

    const blockForWalk = this.pickBlockKey(e.clientX, e.clientY);
    if (blockForWalk) {
      const bm = this.placedObjects.get(blockForWalk);
      if (bm && !bm.passable && !bm.ramp) {
        const [bx, bz] = blockForWalk.split(",").map(Number);
        if (!this.tileClickHandler) return;
        this.pathGoal = { ft: { x: bx!, y: bz! }, layer: 1 };
        this.refreshPathLine();
        this.tileClickHandler(bx!, bz!, 1);
        return;
      }
    }
    const dest = this.pickWalkableTile(e.clientX, e.clientY);
    if (!dest) return;
    if (!this.tileClickHandler) return;
    const k = tileKey(dest.x, dest.y);
    if (this.blockingTileKeys.has(k)) return;
    this.pathGoal = { ft: dest, layer: 0 };
    this.refreshPathLine();
    this.tileClickHandler(dest.x, dest.y, 0);
  };

  setSelf(address: string, displayName?: string): void {
    this.selfAddress = address;
    this.cameraFollowReady = false;
    this.selfTargetPos = null;
    if (this.selfMesh) {
      this.disposeAvatarGroup(this.selfMesh);
      this.scene.remove(this.selfMesh);
      this.selfMesh = null;
    }
    const label = displayName || walletDisplayName(address);
    const g = this.makeAvatar(address, label);
    this.selfMesh = g;
    this.scene.add(g);
  }

  dispose(): void {
    this.ro.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointermove", this.onPointerMove);
    canvas.removeEventListener("pointerdown", this.onPointerDown);
    canvas.removeEventListener("pointerup", this.onPointerUp);
    canvas.removeEventListener("pointercancel", this.onPointerUp);
    canvas.removeEventListener("wheel", this.onWheel);
    if (this.selfMesh) {
      this.disposeAvatarGroup(this.selfMesh);
      this.scene.remove(this.selfMesh);
      this.selfMesh = null;
    }
    this.selfTargetPos = null;
    for (const [, g] of this.others) {
      this.disposeAvatarGroup(g);
      this.scene.remove(g);
    }
    this.others.clear();
    this.targetPos.clear();
    for (const [, mesh] of this.blockMeshes) {
      this.scene.remove(mesh);
      mesh.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
      });
    }
    this.blockMeshes.clear();
    for (const [, mesh] of this.walkableFloorMeshes) {
      this.scene.remove(mesh);
      (mesh.material as THREE.Material).dispose();
    }
    this.walkableFloorMeshes.clear();
    this.walkableFloorPlaneGeom.dispose();
    this.pathGeom.dispose();
    (this.pathLine.material as THREE.Material).dispose();
    this.trailGeom.dispose();
    (this.trailLine.material as THREE.Material).dispose();
    this.selectionOutline.geometry.dispose();
    this.selectionOutlineMat.dispose();
    this.tileHighlightMat.dispose();
    this.blockTopHighlight.geometry.dispose();
    (this.blockTopHighlight.material as THREE.Material).dispose();
    for (const [, m] of this.placementHintMeshes) {
      this.scene.remove(m);
    }
    this.placementHintMeshes.clear();
    this.placementHintGeom.dispose();
    this.placementHintMat.dispose();
    this.fogOfWar.dispose();
    this.renderer.dispose();
  }

  private pathLineMat(): THREE.LineBasicMaterial {
    return this.pathLine.material as THREE.LineBasicMaterial;
  }

  private trailLineMat(): THREE.LineBasicMaterial {
    return this.trailLine.material as THREE.LineBasicMaterial;
  }

  private hideTrailImmediate(): void {
    this.trailFadingOut = false;
    this.trailLine.visible = false;
    this.trailLineMat().opacity = PATH_LINE_OPACITY_FULL;
  }

  private spawnTrailFadeTerrain(
    removed: { x: number; z: number; layer: 0 | 1 }[]
  ): void {
    if (removed.length < 2) return;
    const placed = this.placedObjects;
    const arr = new Float32Array(removed.length * 3);
    for (let i = 0; i < removed.length; i++) {
      const t = removed[i]!;
      arr[i * 3] = t.x;
      arr[i * 3 + 1] = waypointWorldY(t.layer, t.x, t.z, placed) + PATH_Y;
      arr[i * 3 + 2] = t.z;
    }
    this.trailGeom.setAttribute(
      "position",
      new THREE.BufferAttribute(arr, 3)
    );
    this.trailGeom.computeBoundingSphere();
    const mat = this.trailLineMat();
    mat.opacity = PATH_LINE_OPACITY_FULL;
    this.trailLine.visible = true;
    this.trailFadingOut = true;
  }

  private resetPathLineOpacity(): void {
    this.pathFadingOut = false;
    this.pathLineMat().opacity = PATH_LINE_OPACITY_FULL;
  }

  /** Starts a quick opacity fade; line stays visible until fully transparent. */
  private beginPathFadeOut(): void {
    if (!this.pathLine.visible) return;
    if (this.pathLineMat().opacity <= 0.01) return;
    this.pathFadingOut = true;
  }

  private updatePathFade(dt: number): void {
    const rate = PATH_LINE_OPACITY_FULL / PATH_FADE_DURATION_SEC;

    if (this.pathFadingOut) {
      const mat = this.pathLineMat();
      mat.opacity -= rate * dt;
      if (mat.opacity <= 0.01) {
        mat.opacity = 0;
        this.pathLine.visible = false;
        this.pathFadingOut = false;
      }
    }

    if (this.trailFadingOut) {
      const mat = this.trailLineMat();
      mat.opacity -= rate * dt;
      if (mat.opacity <= 0.01) {
        mat.opacity = 0;
        this.trailLine.visible = false;
        this.trailFadingOut = false;
      }
    }
  }

  /** Polyline through tile centers with terrain layer heights (matches server `pathfindTerrain`). */
  private setPathPolylineTerrain(
    path: { x: number; z: number; layer: 0 | 1 }[]
  ): void {
    if (path.length < 2) {
      this.lastTerrainPath = null;
      this.beginPathFadeOut();
      return;
    }

    if (this.lastTerrainPath) {
      const k = findPrefixTerrainRemoved(this.lastTerrainPath, path);
      if (k !== null && k > 0) {
        this.spawnTrailFadeTerrain(this.lastTerrainPath.slice(0, k + 1));
      } else if (k === null) {
        this.hideTrailImmediate();
      }
    }

    this.resetPathLineOpacity();
    const placed = this.placedObjects;
    const arr = new Float32Array(path.length * 3);
    for (let i = 0; i < path.length; i++) {
      const t = path[i]!;
      const y = waypointWorldY(t.layer, t.x, t.z, placed) + PATH_Y;
      if (
        !Number.isFinite(t.x) ||
        !Number.isFinite(t.z) ||
        !Number.isFinite(y)
      ) {
        this.lastTerrainPath = null;
        this.beginPathFadeOut();
        return;
      }
      arr[i * 3] = t.x;
      arr[i * 3 + 1] = y;
      arr[i * 3 + 2] = t.z;
    }
    this.pathGeom.setAttribute(
      "position",
      new THREE.BufferAttribute(arr, 3)
    );
    this.pathGeom.computeBoundingSphere();
    this.pathLine.visible = true;

    this.lastTerrainPath = path.map((p) => ({
      x: p.x,
      z: p.z,
      layer: p.layer,
    }));
  }

  /** Updates the line to only the remaining route (BFS around obstacles, same as server). */
  private refreshPathLine(): void {
    if (!this.pathGoal || !this.selfMesh) {
      this.lastTerrainPath = null;
      this.hideTrailImmediate();
      this.beginPathFadeOut();
      return;
    }
    const here = snapFloorTile(this.selfMesh.position.x, this.selfMesh.position.z);
    if (here.x === this.pathGoal.ft.x && here.y === this.pathGoal.ft.y) {
      const curLayer = inferStartLayerClient(
        this.selfMesh.position.x,
        this.selfMesh.position.z,
        this.selfMesh.position.y,
        this.placedObjects
      );
      if (curLayer === this.pathGoal.layer) {
        this.pathGoal = null;
        this.lastTerrainPath = null;
        this.hideTrailImmediate();
        this.beginPathFadeOut();
        return;
      }
    }
    const startLayer = inferStartLayerClient(
      this.selfMesh.position.x,
      this.selfMesh.position.z,
      this.selfMesh.position.y,
      this.placedObjects
    );
    const remaining = pathfindTerrain(
      here.x,
      here.y,
      startLayer,
      this.pathGoal.ft.x,
      this.pathGoal.ft.y,
      this.pathGoal.layer,
      this.placedObjects,
      this.extraFloorKeys,
      this.roomId
    );
    if (!remaining || remaining.length < 2) {
      this.pathGoal = null;
      this.lastTerrainPath = null;
      this.hideTrailImmediate();
      this.beginPathFadeOut();
      return;
    }
    this.setPathPolylineTerrain(remaining);
  }

  /** When the player moves onto a door tile (after path completes), switch rooms. */
  private checkDoorTransition(): void {
    if (!this.selfMesh || !this.roomChangeHandler) return;
    if (this.pathGoal !== null) return;
    const here = snapFloorTile(this.selfMesh.position.x, this.selfMesh.position.z);
    const k = tileKey(here.x, here.y);
    const prev = this.selfLastTileKey;
    if (prev !== null && prev !== k) {
      for (const d of this.doors) {
        if (d.x === here.x && d.z === here.y) {
          this.roomChangeHandler(d.targetRoomId, d.spawnX, d.spawnZ);
          break;
        }
      }
    }
    this.selfLastTileKey = k;
  }

  /** Visual floor only where avatars can walk (core + extra); gaps show scene background only. */
  private syncWalkableFloorMeshes(): void {
    const b = this.roomBounds;
    const seen = new Set<string>();
    for (let x = b.minX; x <= b.maxX; x++) {
      for (let z = b.minZ; z <= b.maxZ; z++) {
        seen.add(tileKey(x, z));
      }
    }
    for (const k of this.extraFloorKeys) {
      seen.add(k);
    }

    for (const k of seen) {
      const [x, z] = k.split(",").map(Number);
      const wx = x!;
      const wz = z!;
      const isExtra = !isBaseTile(wx, wz, this.roomId);
      const isDoor = this.doorTileKeys.has(k);
      let mesh = this.walkableFloorMeshes.get(k);
      if (!mesh) {
        const baseColor = isDoor
          ? TERRAIN_TILE_DOOR_COLOR
          : isExtra
            ? TERRAIN_TILE_EXTRA_COLOR
            : TERRAIN_TILE_CORE_COLOR;
        mesh = new THREE.Mesh(
          this.walkableFloorPlaneGeom,
          new THREE.MeshStandardMaterial({
            color: baseColor,
            roughness: isExtra ? 0.88 : 0.9,
            metalness: isExtra ? 0.06 : 0.05,
          })
        );
        mesh.scale.set(
          this.floorTileQuadSize,
          this.floorTileQuadSize,
          1
        );
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(wx, 0.01, wz);
        mesh.userData["isExtra"] = isExtra;
        mesh.userData["isDoor"] = isDoor;
        this.scene.add(mesh);
        this.walkableFloorMeshes.set(k, mesh);
      } else {
        const wantExtra = isExtra;
        const wantDoor = isDoor;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (
          mesh.userData["isExtra"] !== wantExtra ||
          mesh.userData["isDoor"] !== wantDoor
        ) {
          mat.color.setHex(
            wantDoor
              ? TERRAIN_TILE_DOOR_COLOR
              : wantExtra
                ? TERRAIN_TILE_EXTRA_COLOR
                : TERRAIN_TILE_CORE_COLOR
          );
          mat.roughness = wantExtra ? 0.88 : 0.9;
          mat.metalness = wantExtra ? 0.06 : 0.05;
          mesh.userData["isExtra"] = wantExtra;
          mesh.userData["isDoor"] = wantDoor;
        }
      }
    }
    for (const [k, mesh] of [...this.walkableFloorMeshes]) {
      if (!seen.has(k)) {
        this.scene.remove(mesh);
        (mesh.material as THREE.Material).dispose();
        this.walkableFloorMeshes.delete(k);
      }
    }
    this.applyFloorTileQuadScale();
  }

  private syncBlockMeshes(): void {
    const seen = new Set(this.placedObjects.keys());
    for (const k of seen) {
      const meta = this.placedObjects.get(k)!;
      const parts = k.split(",").map(Number);
      const wx = parts[0]!;
      const wz = parts[1]!;
      const h = this.obstacleHeight(meta);
      let g = this.blockMeshes.get(k);
      const prev = g?.userData["blockMeta"] as BlockStyleProps | undefined;
      const unchanged =
        g &&
        prev &&
        prev.passable === meta.passable &&
        prev.half === meta.half &&
        prev.quarter === meta.quarter &&
        prev.hex === meta.hex &&
        prev.ramp === meta.ramp &&
        prev.rampDir === meta.rampDir &&
        prev.colorId === meta.colorId;
      if (unchanged) {
        continue;
      }
      if (g) {
        this.scene.remove(g);
        g.traverse((child: THREE.Object3D) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            (child.material as THREE.Material).dispose();
          }
        });
        this.blockMeshes.delete(k);
      }
      g = this.makeBlockMesh(meta);
      g.userData.tileKey = k;
      g.userData.blockMeta = { ...meta };
      g.position.set(wx, h / 2, wz);
      this.scene.add(g);
      this.blockMeshes.set(k, g);
    }
    for (const [k, mesh] of [...this.blockMeshes]) {
      if (!seen.has(k)) {
        this.scene.remove(mesh);
        mesh.traverse((child: THREE.Object3D) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            (child.material as THREE.Material).dispose();
          }
        });
        this.blockMeshes.delete(k);
      }
    }
    this.refreshSelectionOutline();
  }

  private obstacleHeight(meta: BlockStyleProps): number {
    if (meta.quarter) return BLOCK_SIZE * 0.25;
    if (meta.half) return BLOCK_SIZE * 0.5;
    return BLOCK_SIZE;
  }

  /** Wedge with low edge at −X and high edge at +X, then rotated by `rampDir` (0–3). */
  private makeRampGeometry(h: number, rampDir: number): THREE.BufferGeometry {
    const b = BLOCK_SIZE * 0.5;
    const pos = new Float32Array([
      -b, 0, -b, -b, 0, b, b, 0, b, b, 0, -b, b, h, b, b, h, -b,
    ]);
    const idx = [
      0, 2, 1, 0, 3, 2, 0, 1, 4, 0, 4, 5, 0, 5, 3, 1, 2, 4, 3, 5, 2, 2, 3, 5, 2,
      5, 4,
    ];
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geom.setIndex(idx);
    geom.applyMatrix4(
      new THREE.Matrix4().makeRotationY((-(rampDir & 3) * Math.PI) / 2)
    );
    geom.computeVertexNormals();
    return geom;
  }

  private makeBlockMesh(meta: BlockStyleProps): THREE.Group {
    const h = this.obstacleHeight(meta);
    const g = new THREE.Group();
    const base = blockColorHex(meta.colorId);
    const mat = new THREE.MeshStandardMaterial({
      color: base,
      roughness: 0.65,
      metalness: 0.15,
      transparent: meta.passable,
      opacity: meta.passable ? 0.45 : 1,
      depthWrite: !meta.passable,
    });
    if (meta.ramp) {
      const geom = this.makeRampGeometry(h, meta.rampDir);
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.y = -h / 2;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      g.add(mesh);
      return g;
    }
    if (meta.hex) {
      const r = BLOCK_SIZE * 0.5 * 0.94;
      const geom = new THREE.CylinderGeometry(r, r, h, 6);
      const mesh = new THREE.Mesh(geom, mat);
      mesh.rotation.y = Math.PI / 6;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      g.add(mesh);
    } else {
      const geom = new THREE.BoxGeometry(BLOCK_SIZE, h, BLOCK_SIZE);
      const mesh = new THREE.Mesh(geom, mat);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      g.add(mesh);
    }
    return g;
  }

  resize(): void {
    const w = this.canvasHost.clientWidth;
    const h = this.canvasHost.clientHeight;
    const dpr = Math.min(window.devicePixelRatio, 2);
    this.renderer.setSize(w, h, false);
    this.renderer.setPixelRatio(dpr);
    this.applyOrthographicFrustum();
    this.fogOfWar.setSize(w, h, dpr);
    this.refreshAllNameLabelScales();
    this.refreshChatBubbleVerticalPositions();
  }

  syncState(players: PlayerState[]): void {
    const seen = new Set<string>();
    for (const p of players) {
      seen.add(p.address);
      const py = Number.isFinite(p.y) ? p.y : 0;
      if (p.address === this.selfAddress) {
        if (this.selfMesh) {
          if (!this.selfTargetPos) {
            this.selfTargetPos = new THREE.Vector3(p.x, py, p.z);
            this.selfMesh.position.set(p.x, py, p.z);
          } else {
            this.selfTargetPos.set(p.x, py, p.z);
          }
          const ox = this.selfMesh.position.x;
          const oy = this.selfMesh.position.y;
          const oz = this.selfMesh.position.z;
          const jumped =
            Math.hypot(p.x - ox, p.z - oz) > 6 || Math.abs(py - oy) > 1.5;
          if (jumped) {
            this.selfMesh.position.set(p.x, py, p.z);
          }
          if (!this.cameraFollowReady || jumped) {
            this.cameraLookAt.set(p.x, py, p.z);
            this.applyCameraPose();
            this.cameraFollowReady = true;
          }
        }
        continue;
      }
      let g = this.others.get(p.address);
      if (!g) {
        g = this.makeAvatar(p.address, p.displayName);
        this.others.set(p.address, g);
        this.scene.add(g);
        this.targetPos.set(p.address, new THREE.Vector3(p.x, py, p.z));
        g.position.set(p.x, py, p.z);
      }
      const t = this.targetPos.get(p.address);
      if (t) t.set(p.x, py, p.z);
    }
    for (const addr of this.others.keys()) {
      if (!seen.has(addr)) {
        const g = this.others.get(addr);
        if (g) {
          this.disposeAvatarGroup(g);
          this.scene.remove(g);
        }
        this.others.delete(addr);
        this.targetPos.delete(addr);
      }
    }
    this.syncPlacementRangeHints();
  }

  tick(dt: number): void {
    if (this.selfMesh && this.selfTargetPos) {
      const t = this.selfTargetPos;
      const mx = this.selfMesh.position.x;
      const my = this.selfMesh.position.y;
      const mz = this.selfMesh.position.z;
      const jumped =
        Math.hypot(t.x - mx, t.z - mz) > 6 || Math.abs(t.y - my) > 1.5;
      if (jumped) {
        this.selfMesh.position.copy(t);
      } else {
        this.selfMesh.position.lerp(t, 1 - Math.exp(-LERP * dt));
      }
    }
    for (const [addr, g] of this.others) {
      const t = this.targetPos.get(addr);
      if (!t) continue;
      g.position.lerp(t, 1 - Math.exp(-LERP * dt));
    }
    this.updateCameraFollow(dt);
    this.refreshPathLine();
    this.checkDoorTransition();
    this.updatePathFade(dt);
    const px = this.selfMesh
      ? this.selfMesh.position.x
      : this.cameraLookAt.x;
    const pz = this.selfMesh
      ? this.selfMesh.position.z
      : this.cameraLookAt.z;
    this.fogOfWar.setPlayerPosition(px, pz);
    this.fogOfWar.render(this.renderer, this.scene, this.camera);
    this.updateChatBubbles();
  }

  private applyCameraPose(): void {
    this.camera.position.set(
      this.cameraLookAt.x + this.cameraOffset.x,
      this.cameraLookAt.y + this.cameraOffset.y,
      this.cameraLookAt.z + this.cameraOffset.z
    );
    this.camera.lookAt(this.cameraLookAt);
  }

  /** Pans only when the local player nears the edge of the dead zone (soft follow). */
  private updateCameraFollow(dt: number): void {
    if (!this.selfMesh || !this.cameraFollowReady) return;
    const px = this.selfMesh.position.x;
    const py = this.selfMesh.position.y;
    const pz = this.selfMesh.position.z;
    const m = this.cameraFollowDeadZone;
    let tx = this.cameraLookAt.x;
    let ty = this.cameraLookAt.y;
    let tz = this.cameraLookAt.z;
    if (px > tx + m) tx = px - m;
    else if (px < tx - m) tx = px + m;
    if (pz > tz + m) tz = pz - m;
    else if (pz < tz - m) tz = pz + m;
    if (py > ty + m) ty = py - m;
    else if (py < ty - m) ty = py + m;
    const alpha = 1 - Math.exp(-this.cameraFollowSmoothing * dt);
    this.cameraLookAt.x += (tx - this.cameraLookAt.x) * alpha;
    this.cameraLookAt.y += (ty - this.cameraLookAt.y) * alpha;
    this.cameraLookAt.z += (tz - this.cameraLookAt.z) * alpha;
    this.applyCameraPose();
  }

  /** Shows a short-lived speech bubble above the player (used for chat). */
  showChatBubble(
    fromAddress: string,
    text: string,
    displayNameFallback?: string
  ): void {
    let g: THREE.Group | null = null;
    if (fromAddress && this.selfAddress === fromAddress) {
      g = this.selfMesh;
    } else if (fromAddress) {
      g = this.others.get(fromAddress) ?? null;
    }
    if (!g && displayNameFallback) {
      for (const [, grp] of this.others) {
        if (grp.userData.displayName === displayNameFallback) {
          g = grp;
          break;
        }
      }
      if (
        !g &&
        this.selfMesh?.userData.displayName === displayNameFallback
      ) {
        g = this.selfMesh;
      }
    }
    if (!g) return;
    const addr = (g.userData.address as string) || fromAddress;
    this.removeChatBubbleEntry(addr);
    const { sprite, texture } = createChatBubbleSprite(text);
    const mat = sprite.material as THREE.SpriteMaterial;
    const nameSprite = g.userData.nameSprite as THREE.Sprite | undefined;
    if (nameSprite) {
      const nh = nameSprite.scale.y;
      const ny = nameSprite.position.y;
      const nameTop = ny + nh / 2;
      const ch = sprite.scale.y;
      sprite.position.y = nameTop + CHAT_GAP_ABOVE_NAME + ch / 2;
    } else {
      sprite.position.y =
        AVATAR_SPHERE_RADIUS * 2 * this.identiconScale + 0.45;
    }
    g.add(sprite);
    this.chatBubbleByAddress.set(addr, {
      sprite,
      material: mat,
      texture,
      startedAt: performance.now(),
    });
  }

  private removeChatBubbleEntry(addr: string): void {
    const entry = this.chatBubbleByAddress.get(addr);
    if (!entry) return;
    entry.sprite.removeFromParent();
    entry.texture.dispose();
    entry.material.dispose();
    this.chatBubbleByAddress.delete(addr);
  }

  private updateChatBubbles(): void {
    const now = performance.now();
    for (const [addr, entry] of this.chatBubbleByAddress) {
      const elapsed = now - entry.startedAt;
      if (elapsed >= CHAT_VISIBLE_MS + CHAT_FADE_MS) {
        this.removeChatBubbleEntry(addr);
        continue;
      }
      if (elapsed > CHAT_VISIBLE_MS) {
        const t = (elapsed - CHAT_VISIBLE_MS) / CHAT_FADE_MS;
        entry.material.opacity = Math.max(0, 1 - t);
      } else {
        entry.material.opacity = 1;
      }
    }
  }

  private disposeAvatarGroup(g: THREE.Group): void {
    const addr = g.userData.address as string | undefined;
    if (addr) this.removeChatBubbleEntry(addr);
    g.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh) {
        const mat = child.material as THREE.MeshStandardMaterial;
        if (mat.map) mat.map.dispose();
        child.geometry.dispose();
        mat.dispose();
      }
      if (child instanceof THREE.Sprite) {
        const sm = child.material as THREE.SpriteMaterial;
        if (sm.map) sm.map.dispose();
        sm.dispose();
      }
    });
  }

  private makeAvatar(address: string, displayName?: string): THREE.Group {
    const g = new THREE.Group();
    g.userData.address = address;
    g.userData.displayName = displayName ?? "";
    const s = this.identiconScale;
    const d = AVATAR_SPHERE_RADIUS * 2 * s;
    const mat = new THREE.SpriteMaterial({
      color: 0x8899aa,
      transparent: true,
      depthTest: true,
      depthWrite: false,
    });
    const body = new THREE.Sprite(mat);
    body.renderOrder = 2;
    body.scale.set(d, d, 1);
    body.position.y = AVATAR_SPHERE_RADIUS * s;
    body.rotation.copy(this.getIdenticonEuler());
    g.userData.identiconMesh = body;
    g.add(body);

    void loadIdenticonTexture(address)
      .then((tex) => {
        if (g.userData["address"] !== address) {
          tex.dispose();
          return;
        }
        mat.map = tex;
        mat.color.setHex(0xffffff);
        mat.needsUpdate = true;
      })
      .catch(() => {
        /* Invalid / non-wallet ids (e.g. server NPCs) keep the placeholder material. */
      });

    const label = displayName || walletDisplayName(address);
    const { sprite: nameSprite, texture: nameTex } =
      createNameLabelSprite(label);
    g.userData.nameSprite = nameSprite;
    g.userData.nameTexture = nameTex;
    g.add(nameSprite);
    this.syncNameLabelScaleAndPosition(g);
    return g;
  }
}
