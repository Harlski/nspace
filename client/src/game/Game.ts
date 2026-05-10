import * as THREE from "three";
import type { PlayerState } from "../types.js";
import type {
  BillboardState,
  ObstacleProps,
  RoomBackgroundNeutral,
} from "../net/ws.js";
import { remotePlayerIsNpc } from "../remotePlayerNpc.js";
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
const LS_BLOCK_VISUAL_SCALE = "nspace_block_visual_scale";
const DEFAULT_ZOOM_MIN = 6.5;
const DEFAULT_ZOOM_MAX = 13.44;
import { loadIdenticonTexture } from "./identiconTexture.js";
import {
  createBillboardRoot,
  disposeBillboardRoot,
  makeFallbackBillboardTexture,
  updateBillboardRootPose,
} from "./billboardVisual.js";
import { billboardFootprintTilesXZ } from "./billboardFootprintMath.js";
import { BILLBOARD_VERTICAL_PLACEMENT_TEMP_DISABLED } from "./billboardPlacementFlags.js";
import { pickBillboardVisitOnFootprintTile } from "./billboardVisitProximity.js";
import { billboardSlideshowPhaseIndex } from "./billboardSlideshowPhase.js";
import {
  BILLBOARD_ADVERTS_CATALOG,
  DEFAULT_BILLBOARD_CHART_FALLBACK_ADVERT_ID,
  getBillboardAdvertById,
  getFirstSlideUrlForAdvertId,
} from "./billboardAdvertsCatalog.js";
import {
  drawNimBillboardCandles,
  drawNimChartRefreshCountdown,
  ensureNimChartFontsLoaded,
  fetchNimBillboardOhlc,
  nimChartTitleForRange,
  NIM_BILLBOARD_CHART_FONT,
  NIM_BILLBOARD_CHART_H,
  NIM_BILLBOARD_CHART_W,
  type NimBillboardChartRange,
  type NimOhlcCandle,
} from "./billboardNimChart.js";
import {
  blockKey,
  type FloorTile,
  floorWalkableTerrain,
  gatePassageNeighborHintsOk,
  inferStartLayerClient,
  isBaseTile,
  isGatePassableForMover,
  isWalkableTile,
  type PathfindMoverContext,
  pathfindTerrain,
  snapFloorTile,
  tileKey,
  waypointWorldY,
  isOrthogonallyAdjacentToFloorTile,
} from "./grid.js";
import {
  type RoomBounds,
  HUB_ROOM_ID,
  CANVAS_ROOM_ID,
  getDoorsForRoom,
  getRoomBaseBounds,
  isBuiltinRoomId,
  isHubSpawnSafeZone,
  normalizeRoomId,
  registerClientRoomBounds,
} from "./roomLayouts.js";
import {
  BLOCK_COLOR_COUNT,
  type BlockStyleProps,
  blockColorHex,
  clampPyramidBaseScale,
  normalizeBlockPrismParts,
} from "./blockStyle.js";

const LERP = 12;
/**
 * Local-player render smoothing: extrapolate between sparse server snapshots using
 * velocity from state. Must match server `MOVE_SPEED` in `server/src/rooms.ts`.
 */
const SERVER_PLAYER_MOVE_SPEED = 5;
/** Max time (s) to extrapolate ahead of last snapshot (avoids runaway if WS stalls). */
const SELF_EXTRAP_MAX_AGE_SEC = 0.35;
/** Exponential smoothing toward extrapolated goal (local self only; others use {@link LERP}). */
const LERP_SELF = 20;
/** Do not extrapolate past the walk goal along server velocity (world units, ~last tile). */
const SELF_EXTRAP_GOAL_ALONG_BUFFER = 0.12;
/**
 * Max horizontal offset (world units) from the last server snapshot when extrapolating.
 * Without a cap, vx·Δt could approach a full tile between state ticks and path preview
 * (`inferStartLayerClient` + `pathfindTerrain`) would draw rooftop-height routes over air.
 */
const SELF_EXTRAP_MAX_OFFSET_XZ = 0.22;
/** Default scale on unit floor plane; >1 hides subpixel seams (tunable in admin). */
const DEFAULT_FLOOR_TILE_QUAD = 1.08;
/** 1 = match server footprint; scale geometry only (grid Y unchanged) to debug floor seam flicker. */
const DEFAULT_BLOCK_VISUAL_SCALE = 1;
/** Walkable floor tile thickness in world Y; top stays near y≈0, volume extends downward. */
const WALKABLE_FLOOR_TILE_THICKNESS = 0.16;

function readWebglRenderScale(): number {
  if (typeof location === "undefined") return 1;
  const raw = new URLSearchParams(location.search).get("webglRenderScale");
  if (raw === null) return 1;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0.25, Math.min(1, n)) : 1;
}

function createWalkableFloorTileMaterials(
  isPortalGlow: boolean,
  isExtra: boolean
): THREE.MeshStandardMaterial {
  const topHex = isPortalGlow
    ? TERRAIN_TILE_DOOR_COLOR
    : isExtra
      ? TERRAIN_TILE_EXTRA_COLOR
      : TERRAIN_TILE_CORE_COLOR;
  const roughTop = isPortalGlow ? 0.3 : isExtra ? 0.88 : 0.9;
  const metalTop = isPortalGlow ? 0.5 : isExtra ? 0.06 : 0.05;
  return new THREE.MeshStandardMaterial({
    color: topHex,
    roughness: roughTop,
    metalness: metalTop,
    emissive: isPortalGlow ? TERRAIN_TILE_DOOR_EMISSIVE : 0x000000,
    emissiveIntensity: isPortalGlow ? TERRAIN_TILE_DOOR_EMISSIVE_INTENSITY : 0,
  });
}

function applyWalkableFloorTileMaterials(
  mesh: THREE.Mesh,
  isPortalGlow: boolean,
  isExtra: boolean
): void {
  const topHex = isPortalGlow
    ? TERRAIN_TILE_DOOR_COLOR
    : isExtra
      ? TERRAIN_TILE_EXTRA_COLOR
      : TERRAIN_TILE_CORE_COLOR;
  const roughTop = isPortalGlow ? 0.3 : isExtra ? 0.88 : 0.9;
  const metalTop = isPortalGlow ? 0.5 : isExtra ? 0.06 : 0.05;
  const material = mesh.material;
  if (Array.isArray(material)) {
    for (const mat of material) mat.dispose();
    mesh.material = createWalkableFloorTileMaterials(isPortalGlow, isExtra);
    return;
  }
  const mat = material as THREE.MeshStandardMaterial;
  mat.color.setHex(topHex);
  mat.roughness = roughTop;
  mat.metalness = metalTop;
  if (isPortalGlow) {
    mat.emissive.setHex(TERRAIN_TILE_DOOR_EMISSIVE);
    mat.emissiveIntensity = TERRAIN_TILE_DOOR_EMISSIVE_INTENSITY;
  } else {
    mat.emissive.setHex(0x000000);
    mat.emissiveIntensity = 0;
  }
}

function disposeWalkableFloorMeshMaterials(mesh: THREE.Mesh): void {
  const m = mesh.material;
  if (Array.isArray(m)) {
    for (const mat of m) mat.dispose();
  } else {
    (m as THREE.Material).dispose();
  }
}

/** Void (non-walkable) — water/sky tint; walkable tiles use dark gray palette below. */
const TERRAIN_WATER_COLOR = 0xa8d8ea;
/** Core room / expanded floor / door — black–gray tones (not grass). */
const TERRAIN_TILE_CORE_COLOR = 0x2d3340;
const TERRAIN_TILE_EXTRA_COLOR = 0x3d5a4a;
/** Door tiles glow with cyan/teal portal effect */
const TERRAIN_TILE_DOOR_COLOR = 0x06b6d4;
const TERRAIN_TILE_DOOR_EMISSIVE = 0x0891b2;
const TERRAIN_TILE_DOOR_EMISSIVE_INTENSITY = 0.7;
const TERRAIN_TILE_DOOR_MARKER_COLOR = 0xf8fafc;
const TERRAIN_TILE_DOOR_MARKER_SIZE = 1;
const TERRAIN_TILE_DOOR_MARKER_HEIGHT = 2.72;
const TERRAIN_TILE_DOOR_MARKER_ALPHA_BOTTOM = 0.9;
const TERRAIN_TILE_DOOR_MARKER_ALPHA_TOP = 0;
export type VoxelTextSpec = {
  id: string;
  text: string;
  roomId: string;
  x: number;
  y: number;
  z: number;
  yawDeg: number;
  unit: number;
  letterSpacing: number;
  color: number;
  emissive: number;
  emissiveIntensity: number;
  zTween: boolean;
  zTweenAmp: number;
  zTweenSpeed: number;
};

const VOXEL_TEXT_MOVE_STEP = 0.5;
const VOXEL_TEXT_ROTATE_STEP_RAD = Math.PI / 12;

type InspectorTilePreviewPort = {
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  /** Floor + block parent (origin at tile center). */
  content: THREE.Group;
  blockSlot: THREE.Group;
  floor: THREE.Mesh;
  resizeObserver: ResizeObserver;
  lastSig: string;
};

/** Ortho half-extent (vertical, world units); larger = smaller subject in frame. */
const INSPECTOR_PREVIEW_HALF_V = 1.02;
/** Slightly shrink the tile + block together vs full-size preview. */
const INSPECTOR_PREVIEW_SCENE_SCALE = 0.72;
const VOXEL_TEXT_MIN_UNIT = 0.05;
const VOXEL_TEXT_DEFAULT_Z_TWEEN_AMP = 0.18;
const VOXEL_TEXT_DEFAULT_Z_TWEEN_SPEED = 1.4;
const VOXEL_GLYPH_UNKNOWN: readonly string[] = [
  "11111",
  "00001",
  "00010",
  "00100",
  "00100",
  "00000",
  "00100",
];
const VOXEL_FONT_5X7: Record<string, readonly string[]> = {
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01110"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00001", "00001", "00001", "00001", "10001", "10001", "01110"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "10001", "11001", "10101", "10011", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
};

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
/** Same metrics as {@link NAME_LABEL_FONT}; used when tab is hidden / NIM send flow (italic only, no icon). */
const NAME_LABEL_FONT_AWAY =
  'italic 600 20px system-ui, "Segoe UI", sans-serif';
const NAME_LABEL_TEXT_ACTIVE = "#e8edf2";
/** Slightly transparent name when inactive (away tab / NIM send flow). */
const NAME_LABEL_TEXT_AWAY = "rgba(232, 237, 242, 0.72)";
const NAME_LABEL_PILL_ACTIVE = "rgba(0,0,0,0.48)";
const NAME_LABEL_PILL_AWAY = "rgba(0,0,0,0.36)";
const CHAT_BUBBLE_FONT =
  '500 17px system-ui, "Segoe UI", sans-serif';
const NAME_LABEL_MAX_PX = 280;
/** On-screen height (px) for the name pill; scales with ortho zoom so text stays readable. */
const NAME_LABEL_SCREEN_HEIGHT_PX = 24;
/** Target screen height for chat bubbles (similar to name labels for consistent readability). */
const CHAT_BUBBLE_MIN_HEIGHT_PX = 30;
const CHAT_MAX_PX = 260;
const CHAT_MAX_WIDTH_SCREEN_PX = 450; // Maximum screen width when zoomed in (more generous)
const CHAT_LINE_HEIGHT_PX = 22;
/** Emoji-only bubbles scale this much larger on screen than normal chat (HUD log unchanged). */
const CHAT_BUBBLE_EMOJI_SCREEN_SCALE = 2;
/** Canvas supersampling: sharper sprites when scaled. */
const CHAT_BUBBLE_RASTER_NORMAL = 2;
const CHAT_BUBBLE_RASTER_EMOJI = 2;
const CHAT_VISIBLE_MS = 5000;
const CHAT_FADE_MS = 600;
/** Gap between identicon bottom (y=0) and name label (screen px → world in Game). */
const NAME_GAP_BELOW_IDENTICON_PX = 2;
/** "Typing…" indicator above the name tag (world scales with zoom). */
const TYPING_DOTS_SCREEN_HEIGHT_PX = 12;
const TYPING_DOTS_RASTER = 2;
const TYPING_DOTS_W = 44;
const TYPING_DOTS_H = 16;

type ChatBubbleEntry = {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  texture: THREE.CanvasTexture;
  startedAt: number;
  texWidth: number;
  texHeight: number;
  /** Larger on-screen bubble for emoji-only messages (quick reactions). */
  emojiOnly: boolean;
};

type TypingIndicatorEntry = {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  texture: THREE.CanvasTexture;
  canvas: HTMLCanvasElement;
  /** Logical width/height in px (unscaled canvas coordinates). */
  texWidth: number;
  texHeight: number;
  lastAnimStep: number;
};

/** Same rule as HUD: only emoji / VS16 / ZWJ / spaces, no letters or digits. */
function isEmojiOnlyBubbleText(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 32) return false;
  if (/[\p{L}\p{N}]/u.test(t)) return false;
  return /^[\s\p{Extended_Pictographic}\uFE0F\u200D]+$/u.test(t);
}

function makeTypingIndicatorEntry(): TypingIndicatorEntry {
  const canvas = document.createElement("canvas");
  canvas.width = TYPING_DOTS_W * TYPING_DOTS_RASTER;
  canvas.height = TYPING_DOTS_H * TYPING_DOTS_RASTER;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.renderOrder = 1001;
  return {
    sprite,
    material: mat,
    texture: tex,
    canvas,
    texWidth: TYPING_DOTS_W,
    texHeight: TYPING_DOTS_H,
    lastAnimStep: -1,
  };
}

function drawTypingDotsToCanvas(
  entry: TypingIndicatorEntry,
  step: number
): void {
  const { canvas, texture, texHeight: h } = entry;
  const ctx = canvas.getContext("2d")!;
  const r = TYPING_DOTS_RASTER;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(r, 0, 0, r, 0, 0);
  const lit = 1 + (step % 3);
  const dotR = 2.2;
  const y = h * 0.5;
  for (let i = 0; i < 3; i++) {
    const on = i < lit;
    ctx.fillStyle = on
      ? "rgba(226, 232, 240, 0.98)"
      : "rgba(148, 163, 184, 0.4)";
    ctx.beginPath();
    ctx.arc(10 + i * 12, y, dotR, 0, Math.PI * 2);
    ctx.fill();
  }
  texture.needsUpdate = true;
}

function createNameLabelSprite(
  displayName: string,
  opts?: { away?: boolean }
): {
  sprite: THREE.Sprite;
  texture: THREE.CanvasTexture;
} {
  const away = Boolean(opts?.away);
  const padX = 10;
  const radius = 9;
  const h = 32;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const labelFont = away ? NAME_LABEL_FONT_AWAY : NAME_LABEL_FONT;
  ctx.font = labelFont;
  let text =
    displayName.length > 36 ? `${displayName.slice(0, 34)}…` : displayName;
  let tw = ctx.measureText(text).width;
  const maxTextW = NAME_LABEL_MAX_PX - padX * 2;
  while (tw > maxTextW && text.length > 3) {
    text = `${text.slice(0, -2)}…`;
    tw = ctx.measureText(text).width;
  }
  const w = Math.ceil(Math.max(36, padX + tw + padX));
  canvas.width = w;
  canvas.height = h;
  ctx.font = labelFont;
  ctx.textBaseline = "middle";
  ctx.fillStyle = away ? NAME_LABEL_PILL_AWAY : NAME_LABEL_PILL_ACTIVE;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, radius);
  ctx.fill();
  ctx.textAlign = "left";
  ctx.fillStyle = away ? NAME_LABEL_TEXT_AWAY : NAME_LABEL_TEXT_ACTIVE;
  ctx.fillText(text, padX, h / 2 + 0.5);
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

function createChatBubbleSprite(
  text: string,
  opts?: { emojiOnly?: boolean }
): {
  sprite: THREE.Sprite;
  texture: THREE.CanvasTexture;
  width: number;
  height: number;
} {
  const emojiOnly = opts?.emojiOnly ?? false;
  const raster = emojiOnly
    ? CHAT_BUBBLE_RASTER_EMOJI
    : CHAT_BUBBLE_RASTER_NORMAL;
  const padX = 5;
  const padY = 4;
  const radius = 10;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { alpha: true })!;
  ctx.font = CHAT_BUBBLE_FONT;
  const lines = wrapChatLines(ctx, text.trim() || " ", CHAT_MAX_PX);
  const lineWidths = lines.map((ln) => Math.ceil(ctx.measureText(ln).width));
  const maxLineW = Math.max(1, ...lineWidths);
  const innerW = Math.min(CHAT_MAX_PX, maxLineW);
  const w = Math.ceil(innerW + padX * 2);
  const lineH = CHAT_LINE_HEIGHT_PX;
  const h = Math.ceil(padY * 2 + lines.length * lineH);

  canvas.width = Math.max(1, Math.floor(w * raster));
  canvas.height = Math.max(1, Math.floor(h * raster));
  ctx.setTransform(raster, 0, 0, raster, 0, 0);
  ctx.font = CHAT_BUBBLE_FONT;
  ctx.textBaseline = "middle";
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const hair = Math.max(1, 2 / raster);

  // Drop shadow (bubble)
  ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
  ctx.beginPath();
  ctx.roundRect(2, 2, w, h, radius);
  ctx.fill();

  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, "rgba(255, 255, 255, 0.98)");
  gradient.addColorStop(1, "rgba(248, 250, 252, 0.98)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, radius);
  ctx.fill();

  ctx.strokeStyle = "rgba(203, 213, 225, 0.8)";
  ctx.lineWidth = hair;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, radius);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0, 0, 0, 0.12)";
  ctx.shadowBlur = 2 / raster;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 1 / raster;
  ctx.fillStyle = "#1e293b";
  lines.forEach((ln, i) => {
    const cy = padY + i * lineH + lineH / 2;
    ctx.fillText(ln, w / 2, cy);
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: false,
    })
  );
  sprite.renderOrder = 1000;
  sprite.scale.set(1, 1, 1);
  return { sprite, texture: tex, width: w, height: h };
}

/** Placeholder isometric block (cube) — one tile footprint, sits on floor. */
const BLOCK_SIZE = 0.82;

/** GPU particles around active (minable) claimable blocks. */
const MINEABLE_SPARKLE_COUNT = 48;

/**
 * Children of a placed-block `THREE.Group` with this flag are **purely decorative**:
 * omitted from build-mode selection `Box3`, and they do not participate in block ray picks.
 * Reuse for future per-block VFX (auras, particles, etc.).
 */
const SKIP_BLOCK_PICK_AND_BOUNDS = "skipBlockPickAndBounds";

function makeMineableSparklePoints(hVis: number, vis: number): THREE.Points {
  const n = MINEABLE_SPARKLE_COUNT;
  /** Tight shell just outside the mesh hull (depthTest off keeps glints visible). */
  const sphereR =
    0.42 * Math.hypot(BLOCK_SIZE * vis, hVis, BLOCK_SIZE * vis) + 0.012;
  const base = new Float32Array(n * 3);
  const phases = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const sinp = Math.sin(phi);
    base[i * 3] = sphereR * sinp * Math.cos(theta);
    base[i * 3 + 1] = sphereR * Math.cos(phi) * 0.9;
    base[i * 3 + 2] = sphereR * sinp * Math.sin(theta);
    phases[i] = Math.random() * Math.PI * 2;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(base.slice(), 3));
  /** World-space point radius so glints scale with orthographic zoom like block geometry (unlike fixed px). */
  const minSpan = Math.min(BLOCK_SIZE * vis, hVis);
  const pointWorldSize = minSpan * 0.03;
  const mat = new THREE.PointsMaterial({
    /** No `map` — small hardware squares (crisp, pixel-ish when zoomed in). */
    color: 0xfffff8,
    size: pointWorldSize,
    sizeAttenuation: true,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    /** Most shell points lie *behind* block faces from isometric views; depth-on discards them. */
    depthTest: false,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geom, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 12;
  pts.userData.isMineableSparkle = true;
  pts.userData[SKIP_BLOCK_PICK_AND_BOUNDS] = true;
  pts.userData.sparkleBasePositions = base;
  pts.userData.sparklePhases = phases;
  /** Decorative shell must not steal picks or inflate the white selection wireframe. */
  pts.raycast = (_raycaster: THREE.Raycaster, _intersects: THREE.Intersection[]) => {};
  return pts;
}

/** World-space AABB of solid block meshes only (excludes {@link SKIP_BLOCK_PICK_AND_BOUNDS} children). */
function blockGroupWorldBoundsForSelectionOutline(
  group: THREE.Object3D
): THREE.Box3 | null {
  group.updateMatrixWorld(true);
  const box = new THREE.Box3();
  let any = false;
  group.traverse((obj: THREE.Object3D) => {
    if (obj.userData[SKIP_BLOCK_PICK_AND_BOUNDS]) return;
    if (obj instanceof THREE.Mesh) {
      const b = new THREE.Box3().setFromObject(obj);
      if (b.isEmpty()) return;
      if (!any) {
        box.copy(b);
        any = true;
      } else {
        box.union(b);
      }
    }
  });
  return any ? box : null;
}

function disposePlacedBlockGroupContents(g: THREE.Object3D): void {
  g.traverse((child: THREE.Object3D) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      (child.material as THREE.Material).dispose();
    } else if (child instanceof THREE.Points) {
      child.geometry.dispose();
      (child.material as THREE.Material).dispose();
    }
  });
}

/**
 * If `newPath` equals `oldPath.slice(k)` for some k, returns k (tiles dropped from the start).
 * Otherwise null (new click or path jumped).
 */
const FLOATING_REWARD_TEXT_OUTLINE_PX = 10;
/** Thicker stroke when mining reward uses 2× font (`nimLogo`). */
const FLOATING_REWARD_MINING_TEXT_OUTLINE_PX = 18;
const FLOATING_REWARD_LOGO_OUTLINE_PX = 3;
const FLOATING_REWARD_MINING_LOGO_OUTLINE_PX = 6;
const FLOATING_REWARD_DEFAULT_DURATION_MS = 2000;
/** Plain floaters (spring motion): extra time for damped settle before fade-out. */
const FLOATING_SPRING_DURATION_MS = 2600;
/** Mining reward floater stays 1s longer than generic floaters (TODO). */
const FLOATING_REWARD_MINING_DURATION_MS = 3000;
const FLOATING_REWARD_MINING_FONT = "bold 64px 'Muli', sans-serif";
const FLOATING_REWARD_MINING_LOGO_H = 72;
const FLOATING_REWARD_MINING_GAP = 14;
const FLOATING_REWARD_MINING_CANVAS_H = 120;
const FLOATING_REWARD_TEXT_SHADOW_BLUR = 10;
const FLOATING_REWARD_TEXT_SHADOW_OFFSET_X = 4;
const FLOATING_REWARD_TEXT_SHADOW_OFFSET_Y = 5;
/** Extra canvas padding so shadow + outline are not clipped. */
const FLOATING_REWARD_TEXT_SHADOW_PAD =
  FLOATING_REWARD_TEXT_SHADOW_BLUR +
  Math.max(
    Math.abs(FLOATING_REWARD_TEXT_SHADOW_OFFSET_X),
    Math.abs(FLOATING_REWARD_TEXT_SHADOW_OFFSET_Y)
  );

function fillTextWithWhiteOutline(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fillColor: string,
  outlinePx: number = FLOATING_REWARD_TEXT_OUTLINE_PX
): void {
  ctx.save();
  ctx.shadowColor = "rgba(255, 255, 255, 0.48)";
  ctx.shadowBlur = FLOATING_REWARD_TEXT_SHADOW_BLUR;
  ctx.shadowOffsetX = FLOATING_REWARD_TEXT_SHADOW_OFFSET_X;
  ctx.shadowOffsetY = FLOATING_REWARD_TEXT_SHADOW_OFFSET_Y;
  ctx.fillStyle = fillColor;
  ctx.fillText(text, x, y);
  ctx.restore();

  ctx.save();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.lineWidth = outlinePx;
  ctx.strokeStyle = "#000";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fillColor;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** White silhouette ring behind the colored logo (canvas has no stroke for drawImage). */
function drawImageWithWhiteOutline(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  x: number,
  y: number,
  w: number,
  h: number,
  outlinePx: number
): void {
  const corners: [number, number][] = [
    [-outlinePx, 0],
    [outlinePx, 0],
    [0, -outlinePx],
    [0, outlinePx],
    [-outlinePx, -outlinePx],
    [outlinePx, -outlinePx],
    [-outlinePx, outlinePx],
    [outlinePx, outlinePx],
  ];
  ctx.save();
  ctx.filter = "brightness(0) invert(1)";
  for (const [ox, oy] of corners) {
    ctx.drawImage(img, x + ox, y + oy, w, h);
  }
  ctx.filter = "none";
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();
}

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
  private renderDirty = true;
  private continuousRenderUntilMono = 0;
  private lastSceneMutation: { reason: string; atMono: number } | null = null;
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private readonly hit = new THREE.Vector3();
  private selfAddress = "";
  private selfMesh: THREE.Group | null = null;
  /** Authoritative position from server; selfMesh lerps toward extrapolated goal each frame. */
  private selfTargetPos: THREE.Vector3 | null = null;
  /** Monotonic clock (ms) when the last self snapshot arrived from the server. */
  private selfLastServerRecvMs = 0;
  /** Last server horizontal velocity (world units/s) for local dead reckoning. */
  private selfServerVx = 0;
  private selfServerVz = 0;
  private readonly selfExtrapGoal = new THREE.Vector3();
  private readonly others = new Map<string, THREE.Group>();
  private readonly chatBubbleByAddress = new Map<string, ChatBubbleEntry>();
  private readonly typingIndicatorByAddress = new Map<string, TypingIndicatorEntry>();
  private readonly floatingTexts = new Map<string, {
    sprite: THREE.Sprite;
    material: THREE.SpriteMaterial;
    texture: THREE.CanvasTexture;
    startedAt: number;
    startY: number;
    /** Total visible lifetime in ms (mining rewards use longer). */
    durationMs: number;
    /** `classic` = legacy ease-up + fade; `spring` = half-rise then damped settle. */
    verticalMotion: "classic" | "spring";
  }>();
  private readonly targetPos = new Map<string, THREE.Vector3>();
  private ro: ResizeObserver;
  private tileHighlight: THREE.Mesh;
  private readonly tileHighlightMat: THREE.MeshBasicMaterial;
  private tileClickHandler:
    | ((x: number, z: number, layer?: 0 | 1) => void)
    | null = null;
  private placeBlockHandler: ((x: number, z: number) => void) | null = null;
  /** When set, next empty floor click in build mode sets teleporter destination X/Z. */
  private teleporterDestPickHandler: ((x: number, z: number) => void) | null =
    null;
  private claimBlockHandler: ((x: number, z: number, y: number) => void) | null =
    null;
  /** Walk mode: double primary click on an adjacent gate invokes open / denied feedback. */
  private gateDoubleOpenHandler:
    | ((x: number, z: number, y: number) => void)
    | null = null;
  private lastGatePrimaryTap: { key: string; at: number } | null = null;
  private static readonly GATE_DOUBLE_TAP_MS = 420;
  private moveBlockHandler:
    | ((fromX: number, fromZ: number, toX: number, toZ: number) => void)
    | null = null;
  private obstacleSelectHandler: ((x: number, z: number, y: number) => void) | null =
    null;
  private placeExtraFloorHandler: ((x: number, z: number) => void) | null = null;
  /**
   * When set, the next successful walkable floor pointer-up in floor-expand mode
   * invokes this with tile coords then clears (room entry spawn pick).
   */
  private roomEntrySpawnPickHandler: ((x: number, z: number) => void) | null =
    null;
  private removeExtraFloorHandler: ((x: number, z: number) => void) | null = null;
  private buildMode = false;
  /** Place walkable tiles outside the core room (toggle with F). */
  private floorExpandMode = false;
  private readonly extraFloorKeys = new Set<string>();
  /** Base tiles carved out in custom rooms (server-synced). */
  private readonly removedBaseFloorKeys = new Set<string>();
  /** Mining/claiming state for experimental claimable blocks */
  private miningState: {
    blockX: number;
    blockZ: number;
    startTime: number;
    duration: number; // milliseconds
  } | null = null;
  /** One slab mesh per walkable tile (core grid + extra); void shows scene background only. */
  private readonly walkableFloorMeshes = new Map<string, THREE.Mesh>();
  private readonly walkableFloorVisualMeshes: THREE.InstancedMesh[] = [];
  /** White marker blocks on door tiles (teleport squares). */
  private readonly doorMarkerMeshes = new Map<string, THREE.Mesh>();
  /** Same pillar effect on player-placed teleporters once a destination is set. */
  private readonly teleporterMarkerMeshes = new Map<string, THREE.Mesh>();
  /** Sorted `tileKey` list for active teleporter tiles; `null` = not yet synced. */
  private teleporterPortalFloorSig: string | null = null;
  /** Decorative voxel text meshes keyed by object id. */
  private readonly voxelTextMeshes = new Map<string, THREE.InstancedMesh>();
  private readonly voxelTextSpecs = new Map<string, VoxelTextSpec>();
  private activeVoxelTextId: string | null = null;
  private readonly voxelGlyphCache = new Map<string, readonly string[]>();
  /**
   * Shared unit footprint in XZ with fixed thickness in Y; `floorTileQuadSize` scales XZ only.
   * Top face sits near y=0 after positioning; thickness extends downward.
   */
  private readonly walkableFloorTileGeom = new THREE.BoxGeometry(
    1,
    WALKABLE_FLOOR_TILE_THICKNESS,
    1
  );
  private floorTileQuadSize = DEFAULT_FLOOR_TILE_QUAD;
  /** Uniform scale on block/ramp/hex geometry only; bottoms stay on layer planes. */
  private blockVisualScale = DEFAULT_BLOCK_VISUAL_SCALE;
  /** All placed objects (solid and walk-through), keyed by blockKey(x,z,y). */
  private readonly placedObjects = new Map<string, BlockStyleProps>();
  /** Styles applied when placing new blocks in build mode. */
  private placementHalf = false;
  private placementQuarter = false;
  private placementHex = false;
  private placementPyramid = false;
  private placementSphere = false;
  private placementRamp = false;
  private placementRampDir = 0;
  private placementColorId = 0;
  private placementPyramidBaseScale = 1;
  private placementClaimable = false;
  /** Live props for the object-edit tile inspector 3D preview (null = panel closed). */
  private inspectorSelectionObstacle: ObstacleProps | null = null;
  /** Tile coords for selection preview (gates need true tile for exit alignment). */
  private inspectorSelectionTileRef: { x: number; z: number; y: number } | null =
    null;
  /** Off-main-scene 1×1 tile + block mesh for build bar / object panel. */
  private inspectorPlacementPort: InspectorTilePreviewPort | null = null;
  private inspectorSelectionPort: InspectorTilePreviewPort | null = null;
  /** Subset of tile keys that block pathfinding (not passable). */
  private readonly blockingTileKeys = new Set<string>();
  private readonly blockMeshes = new Map<string, THREE.Group>();
  /** After "Move", next click on an empty tile relocates the object. */
  private repositionFrom: FloorTile | null = null;
  /** Destination tile + layer; remaining route is recomputed each frame from current position. */
  private pathGoal: { ft: FloorTile; layer: 0 | 1 } | null = null;
  /**
   * Optional route shown while primary button is held before `pointerup` (deferred walk).
   * Does not send movement to the server; cleared when the real `pathGoal` is set.
   */
  private pathPreviewGoal: { ft: FloorTile; layer: 0 | 1 } | null = null;
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
  /** Selected obstacle key in build mode (`blockKey(x,z,y)`); white outline. */
  private selectedBlockKey: string | null = null;
  private readonly selectionOutline: THREE.LineSegments;
  private readonly selectionOutlineMat: THREE.LineBasicMaterial;
  /** Floor tile highlight for teleporter warp destination (same room only). */
  private readonly teleporterLinkHighlight: THREE.Mesh;
  private readonly teleporterLinkHighlightMat: THREE.MeshBasicMaterial;
  private readonly pathGeom = new THREE.BufferGeometry();
  private readonly pathLine: THREE.Line;
  /** Fades out segments that were just walked (prefix trimmed from main path). */
  private trailFadingOut = false;
  private readonly trailGeom = new THREE.BufferGeometry();
  private readonly trailLine: THREE.Line;

  /** World XZ point the camera orbits (isometric offset applied on top). */
  private readonly cameraLookAt = new THREE.Vector3(0, 0, 0);
  private readonly cameraOffsetBase = new THREE.Vector3(18, 18, 18);
  private readonly worldUp = new THREE.Vector3(0, 1, 0);
  private readonly cameraOrbitOffsetScratch = new THREE.Vector3();
  /** Yaw (rad): world +Y rotation of the isometric offset (desktop right-drag; fixed circle). */
  private cameraOrbitYawRad = 0;
  /** Desktop right-drag orbit; suppresses avatar context menu after a real drag. */
  private rightOrbitDrag: {
    pointerId: number;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
  } | null = null;
  private suppressAvatarContextMenuFromRightOrbit = false;
  /** After orbit drag release: ease yaw to nearest 90° corner. */
  private cameraOrbitEase: {
    fromYaw: number;
    deltaYaw: number;
    startedAtMs: number;
    durationMs: number;
  } | null = null;
  private static readonly CAMERA_ORBIT_RAD_PER_PX = 0.0035;
  /** Yaw snap step (rad): four isometric corners around the player (default / diagonal / opposite / diagonal). */
  private static readonly CAMERA_ORBIT_SNAP_STEP_RAD = Math.PI / 2;
  private static readonly CAMERA_ORBIT_EASE_MS = 240;
  private static readonly RIGHT_ORBIT_SUPPRESS_CONTEXTMENU_PX = 8;
  /** Base dead zone size (fraction of default frustum); scales with zoom for consistent screen-space behavior. */
  private readonly cameraFollowDeadZoneBase = 3.2;
  private readonly cameraFollowSmoothing = 12;
  private cameraFollowReady = false;
  /** Look-ahead offset based on movement direction (world units). */
  private readonly cameraLookAhead = new THREE.Vector3(0, 0, 0);
  private readonly cameraLookAheadSmoothing = 8;
  /** Previous position for velocity calculation. */
  private selfPrevPos = new THREE.Vector3(0, 0, 0);
  
  /** Orthographic vertical half-extent (world units); smaller = zoomed in. */
  private frustumSize: number;
  private zoomMin: number;
  private zoomMax: number;
  private zoomLocked = false;
  private zoomLockedFrustum: number | null = null;
  private readonly fogOfWar: FogOfWarPass;
  /** Extra highlight on solid block tops when hovering in walk mode. */
  private readonly blockTopHighlight: THREE.Mesh;
  /** Server max place distance (world units); 0 = unlimited (no ring overlay). */
  private placeRadiusBlocks = 5;
  private readonly placementHintGeom: THREE.PlaneGeometry;
  private readonly placementHintMat: THREE.MeshBasicMaterial;
  private readonly placementHintMeshes = new Map<string, THREE.Mesh>();
  /** Gate tool: soft green/red on exit vs front neighbor tiles (matches server gate layout rules). */
  private gateFloorHintsActive = false;
  private repositionGateHint: {
    fromX: number;
    fromZ: number;
    fromYLevel: number;
    exitX: number;
    exitZ: number;
    colorId: number;
    rampDir: number;
    quarter: boolean;
    half: boolean;
    adminAddress: string;
    authorizedAddresses: string[];
  } | null = null;
  /**
   * While repositioning a gate, the placed mesh at the source tile keeps this exit (world coords)
   * so panel/server preview updates do not rotate the solid block — only the transparent ghost does.
   */
  private repositionGatePlacedVisualFreeze: { exitX: number; exitZ: number } | null =
    null;
  /** Last pointer position (px) for refreshing gate move / neighbor previews without pointer motion. */
  private readonly lastPointerClientPixels = { x: 0, y: 0 };
  private repositionGateGhostGroup: THREE.Group | null = null;
  private repositionGateGhostSig = "";
  /** Stack level of the obstacle being moved; used with `repositionFrom` for `blockKey` and ghost height. */
  private repositionSourceYLevel = 0;
  /** Non-gate obstacle move: translucent mesh at valid hover (same material path as placement ghost). */
  private repositionObstacleGhostGroup: THREE.Group | null = null;
  private repositionObstacleGhostSig = "";
  private gateNeighborExitHint: THREE.Mesh | null = null;
  private gateNeighborFrontHint: THREE.Mesh | null = null;
  private readonly gateNeighborOkMat: THREE.MeshBasicMaterial;
  private readonly gateNeighborBadMat: THREE.MeshBasicMaterial;
  /** Active touch pointers on the canvas (for two-finger pinch zoom). */
  private readonly touchPointers = new Map<
    number,
    { x: number; y: number }
  >();
  /** Previous inter-touch distance (px) while pinching; 0 = not established yet. */
  private pinchLastDistancePx = 0;
  /**
   * Two-finger session: pinch zoom vs rotate camera (twist), disambiguated from movement.
   * `null` until one gesture clearly dominates.
   */
  private touchTwoFingerMode: "pinch" | "rotate" | null = null;
  private touchTwistPrevAngleRad = 0;
  private touchTwistPrevAngleValid = false;
  private static readonly TOUCH_TWIST_MIN_SEP_PX = 24;
  private static readonly TOUCH_TWIST_COMMIT_RAD = 0.014;
  private static readonly TOUCH_PINCH_COMMIT_REL = 0.014;
  private static readonly TOUCH_TWIST_VS_PINCH_RATIO = 2.2;
  /** Maps finger-line angle delta (rad) to camera yaw; 1 ≈ 1:1 with twist angle. */
  private static readonly TOUCH_TWIST_YAW_SCALE = 1;
  /**
   * Primary pointer: path / `tileClickHandler` runs on pointerup (finger lift or mouse
   * release) at release coordinates, not on first contact.
   */
  private pendingPrimaryWalk: {
    pointerId: number;
    startX: number;
    startY: number;
  } | null = null;
  /** Cancel deferred walk if the pointer moves farther than this before release (px). */
  private static readonly PENDING_WALK_CANCEL_DRAG_PX = 32;
  /**
   * Touch build: show placement ghost on pointerdown; commit on pointerup only if the
   * finger is still over the same floor tile as the initial touch.
   */
  private pendingBuildPlace: {
    pointerId: number;
    startTileX: number;
    startTileZ: number;
  } | null = null;
  /** Last pointer (px) over billboard place/reposition hover; used to refresh preview after R. */
  private lastBillboardPointerClientX = 0;
  private lastBillboardPointerClientY = 0;
  /** Translucent mesh for the block that would be placed in build mode. */
  private placementPreviewGroup: THREE.Group | null = null;
  private placementPreviewStyleSig = "";
  private placementPreviewAnchor: { x: number; z: number; y: number } | null =
    null;

  /** Right-click self (desktop) or long-press on self (touch) opens quick emoji in HUD. */
  private selfQuickEmojiOpener: (() => void) | null = null;
  /** Touch: hold on own avatar; release before timer runs walks from release point. */
  private selfEmojiTouchSession: {
    pointerId: number;
    startX: number;
    startY: number;
    timer: ReturnType<typeof setTimeout>;
  } | null = null;
  private static readonly SELF_EMOJI_LONGPRESS_MS = 480;
  private static readonly SELF_EMOJI_LONGPRESS_MOVE_PX = 14;

  private gateContextOpener:
    | ((
        pick: {
          blockKey: string;
          clientX: number;
          clientY: number;
        }
      ) => void)
    | null = null;

  /** Right-click / long-press other human (non-NPC) avatar — HUD context menu. */
  private otherPlayerContextOpener:
    | ((p: {
        targets: Array<{ address: string; displayName: string }>;
        clientX: number;
        clientY: number;
        /** True when your avatar is in front on this ray; HUD shows Emote first if supported. */
        emoteRowFirst?: boolean;
      }) => void)
    | null = null;
  private otherProfileTouchSession: {
    pointerId: number;
    startX: number;
    startY: number;
    timer: ReturnType<typeof setTimeout>;
    targets: Array<{ address: string; displayName: string }>;
    emoteRowFirst: boolean;
  } | null = null;
  private static readonly OTHER_PROFILE_LONGPRESS_MS = 480;
  private static readonly OTHER_PROFILE_LONGPRESS_MOVE_PX = 14;

  /** Canvas room tile claims: map of "x,z" => address */
  private readonly canvasClaims = new Map<string, string>();
  /** Canvas room identicon meshes */
  private readonly canvasIdenticonMeshes = new Map<string, THREE.Mesh>();
  /** Time elapsed for door tile pulse animation */
  private doorPulseTime = 0;
  /** Phase clock for active claimable (minable) block sparkle particles. */
  private mineableSparkleAnimTime = 0;
  /** Signboards (admin-placed message signs) */
  private readonly signboards = new Map<
    string,
    {
      id: string;
      x: number;
      z: number;
      message: string;
      createdBy: string;
      createdAt: number;
    }
  >();
  private signboardHoverHandler:
    | ((signboard: {
        id: string;
        x: number;
        z: number;
        message: string;
        createdBy: string;
        createdAt: number;
      } | null) => void)
    | null = null;

  private billboardSyncGen = 0;
  private readonly billboardRoots = new Map<string, THREE.Group>();
  private readonly billboardSpecs = new Map<string, BillboardState>();
  /**
   * Floor (y=0) tile keys `x,z` under a billboard footprint — server stores passable
   * half-height markers for walkability; we skip drawing them so only the plane shows.
   */
  private readonly billboardFootprintFloorKeys = new Set<string>();
  /** When set, selection outline follows the billboard plane (not floor block AABB). */
  private selectedBillboardId: string | null = null;
  /** Browser `setInterval` id (numeric). */
  private readonly billboardTimers = new Map<string, number>();
  /** Billboard tool: show footprint + ghost before modal. */
  private billboardPlacementPreview = false;
  private billboardPlacementDraft: {
    orientation: "horizontal" | "vertical";
    yawSteps: number;
    advertIds: string[];
    intervalSec: number;
    /** Last chart range chosen in the modal (independent of which tab is active). */
    liveChartRange: NimBillboardChartRange;
    /** Catalog slide shown when OHLC cannot be loaded (Other tab). */
    liveChartFallbackAdvertId: string;
    /** Cycle 24h ↔ 7d on the live chart (Other tab). */
    liveChartRangeCycle: boolean;
    /** Seconds per range when `liveChartRangeCycle`. */
    liveChartCycleIntervalSec: number;
    /** Last Images vs Other tab (restored when reopening the modal). */
    billboardSourceTab: "images" | "other";
  } = {
    orientation: "horizontal",
    yawSteps: 0,
    advertIds: [BILLBOARD_ADVERTS_CATALOG[0]?.id ?? "nimiq_bb"],
    intervalSec: 8,
    liveChartRange: "24h",
    liveChartFallbackAdvertId: DEFAULT_BILLBOARD_CHART_FALLBACK_ADVERT_ID,
    liveChartRangeCycle: false,
    liveChartCycleIntervalSec: 20,
    billboardSourceTab: "images",
  };
  private repositionBillboardId: string | null = null;
  private repositionDraftYaw = 0;
  private readonly billboardFootprintPreviewGeom: THREE.PlaneGeometry;
  private readonly billboardFootprintPreviewValidMat: THREE.MeshBasicMaterial;
  private readonly billboardFootprintPreviewInvalidMat: THREE.MeshBasicMaterial;
  private readonly billboardFootprintPreviewMeshes: THREE.Mesh[] = [];
  private billboardInteractGhost: THREE.Group | null = null;
  private billboardInteractGhostSig = "";
  private readonly billboardPreviewPlaceholderTex: THREE.CanvasTexture;

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
    this.blockVisualScale = Game.readBlockVisualScale(
      LS_BLOCK_VISUAL_SCALE,
      DEFAULT_BLOCK_VISUAL_SCALE
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
      alpha: false,
      antialias: false,
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
      new THREE.PlaneGeometry(
        BLOCK_SIZE * this.blockVisualScale,
        BLOCK_SIZE * this.blockVisualScale
      ),
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
    this.gateNeighborOkMat = new THREE.MeshBasicMaterial({
      color: 0x22c55e,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
    });
    this.gateNeighborBadMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    });

    this.billboardFootprintPreviewGeom = new THREE.PlaneGeometry(0.92, 0.92);
    this.billboardFootprintPreviewValidMat = new THREE.MeshBasicMaterial({
      color: 0x22c55e,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
    this.billboardFootprintPreviewInvalidMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    });
    this.billboardPreviewPlaceholderTex = makeFallbackBillboardTexture();

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

    this.teleporterLinkHighlightMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    this.teleporterLinkHighlight = new THREE.Mesh(
      new THREE.PlaneGeometry(0.92, 0.92),
      this.teleporterLinkHighlightMat
    );
    this.teleporterLinkHighlight.rotation.x = -Math.PI / 2;
    this.teleporterLinkHighlight.position.set(0, 0.024, 0);
    this.teleporterLinkHighlight.visible = false;
    this.scene.add(this.teleporterLinkHighlight);

    this.roomEntrySpawnRingMat = new THREE.MeshBasicMaterial({
      color: 0x34d399,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.roomEntrySpawnRing = new THREE.Mesh(
      new THREE.RingGeometry(0.22, 0.42, 48),
      this.roomEntrySpawnRingMat
    );
    this.roomEntrySpawnRing.rotation.x = -Math.PI / 2;
    this.roomEntrySpawnRing.visible = false;
    this.scene.add(this.roomEntrySpawnRing);

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
    canvas.addEventListener("contextmenu", this.onCanvasContextMenu, {
      passive: false,
      capture: true,
    });

    // Touch pinch/twist: always release pointer ids at window level so lifts outside
    // the canvas (or missed canvas events) cannot leave stale entries in touchPointers.
    window.addEventListener("pointerup", this.onWindowTouchPointerEnd, true);
    window.addEventListener("pointercancel", this.onWindowTouchPointerEnd, true);
    document.addEventListener("visibilitychange", this.onDocumentVisibilityChange);
    window.addEventListener("pagehide", this.onWindowPageHide);

    this.rebuildDoorKeys();
    this.syncWalkableFloorMeshes();
    this.syncVoxelWordSign();
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

  /**
   * When standing on a billboard footprint tile with a visit URL, returns
   * metadata for the HUD “Visit …” pill (same placement as portal Enter).
   */
  getStandingBillboardVisitOffer(): {
    visitName: string;
    visitUrl: string;
  } | null {
    if (!this.selfMesh) return null;
    const t = snapFloorTile(this.selfMesh.position.x, this.selfMesh.position.z);
    const hit = pickBillboardVisitOnFootprintTile(
      t.x,
      t.y,
      this.billboardSpecs.values(),
      Date.now()
    );
    if (!hit?.visitUrl) return null;
    return { visitName: hit.visitName, visitUrl: hit.visitUrl };
  }

  getSelfPosition(): { x: number; y: number; z: number } | null {
    if (!this.selfMesh) return null;
    return {
      x: this.selfMesh.position.x,
      y: this.selfMesh.position.y,
      z: this.selfMesh.position.z,
    };
  }

  getSelfScreenPosition(
    yOffset = 1.05
  ): { x: number; y: number } | null {
    if (!this.selfMesh) return null;
    const world = new THREE.Vector3(
      this.selfMesh.position.x,
      this.selfMesh.position.y + yOffset,
      this.selfMesh.position.z
    );
    const projected = world.project(this.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    const sx = ((projected.x + 1) * 0.5) * rect.width;
    const sy = ((1 - projected.y) * 0.5) * rect.height;
    if (!Number.isFinite(sx) || !Number.isFinite(sy)) return null;
    return { x: sx, y: sy };
  }

  getPlaceRadiusBlocks(): number {
    return this.placeRadiusBlocks;
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
    walkableFloorMeshCount: number;
    lastSceneMutation: { reason: string; msAgo: number } | null;
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
      walkableFloorMeshCount: this.walkableFloorMeshes.size,
      lastSceneMutation: this.lastSceneMutation
        ? {
            reason: this.lastSceneMutation.reason,
            msAgo: Math.round(performance.now() - this.lastSceneMutation.atMono),
          }
        : null,
    };
  }

  private markSceneMutation(reason: string): void {
    this.lastSceneMutation = { reason, atMono: performance.now() };
    this.requestRender();
  }

  private requestRender(continuousMs = 0): void {
    this.renderDirty = true;
    if (continuousMs > 0) {
      this.continuousRenderUntilMono = Math.max(
        this.continuousRenderUntilMono,
        performance.now() + continuousMs
      );
    }
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
    const prevRoomId = this.roomId;
    this.roomId = msg.roomId;
    this.roomBounds = msg.roomBounds;
    registerClientRoomBounds(msg.roomId, msg.roomBounds);
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
    
    // Clear all obstacles and floor tiles from previous room
    this.placedObjects.clear();
    this.blockingTileKeys.clear();
    this.extraFloorKeys.clear();
    this.removedBaseFloorKeys.clear();

    // Clear block meshes from scene
    for (const [, mesh] of this.blockMeshes) {
      this.scene.remove(mesh);
      disposePlacedBlockGroupContents(mesh);
    }
    this.blockMeshes.clear();
    this.clearTeleporterMarkers();

    this.rebuildDoorKeys();
    this.pathGoal = null;
    this.pathPreviewGoal = null;
    this.lastTerrainPath = null;
    this.selectedBlockKey = null;
    this.selectionOutline.visible = false;
    this.teleporterLinkHighlight.visible = false;
    this.roomJoinSpawnTile = null;
    this.roomEntrySpawnRing.visible = false;
    this.roomEntrySpawnPickHandler = null;
    this.hideTrailImmediate();
    this.beginPathFadeOut();
    this.syncWalkableFloorMeshes();
    this.syncVoxelWordSign();
    this.refreshPathLine();
    this.syncPlacementRangeHints();
    this.markSceneMutation("applyRoomFromWelcome");
    
    // Clear canvas identicons when leaving canvas room
    if (normalizeRoomId(prevRoomId) === CANVAS_ROOM_ID && normalizeRoomId(this.roomId) !== CANVAS_ROOM_ID) {
      this.clearCanvasIdenticons();
    }
  }

  setRoomJoinSpawnFromWelcome(
    tile: { x: number; z: number; customized: boolean } | null
  ): void {
    this.roomJoinSpawnTile = tile;
    this.syncRoomEntrySpawnMarker(performance.now() * 0.001);
  }

  private syncRoomEntrySpawnMarker(phaseSec: number): void {
    const ring = this.roomEntrySpawnRing;
    if (!this.floorExpandMode || !this.roomJoinSpawnTile) {
      ring.visible = false;
      return;
    }
    const t = this.roomJoinSpawnTile;
    ring.position.set(
      t.x,
      0.042 + 0.012 * Math.sin(phaseSec * 3.6),
      t.z
    );
    const pulse = 1 + 0.06 * Math.sin(phaseSec * 2.8);
    ring.scale.set(pulse, pulse, 1);
    this.roomEntrySpawnRingMat.color.setHex(
      t.customized ? 0x2dd4bf : 0x6ee7b7
    );
    this.roomEntrySpawnRingMat.opacity =
      0.72 + 0.2 * Math.sin(phaseSec * 2.2);
    ring.visible = true;
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

  private static clampBlockVisualScale(n: number): number {
    if (!Number.isFinite(n)) return DEFAULT_BLOCK_VISUAL_SCALE;
    return Math.min(1.06, Math.max(0.86, n));
  }

  private static readBlockVisualScale(key: string, fallback: number): number {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const v = Number(raw);
    return Number.isFinite(v) ? Game.clampBlockVisualScale(v) : fallback;
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
    this.requestRender();
  }

  getFogOfWarRadii(): { inner: number; outer: number } {
    return this.fogOfWar.getRadii();
  }

  setFogOfWarRadii(inner: number, outer: number): void {
    const r = Game.normalizeFogRadii(inner, outer);
    this.fogOfWar.setRadii(r.inner, r.outer);
    localStorage.setItem(LS_FOG_INNER, String(r.inner));
    localStorage.setItem(LS_FOG_OUTER, String(r.outer));
    this.requestRender();
  }

  getZoomFrustumSize(): number {
    return this.frustumSize;
  }

  getZoomBounds(): { min: number; max: number } {
    return { min: this.zoomMin, max: this.zoomMax };
  }

  setZoomLocked(locked: boolean, forcedFrustum?: number): void {
    this.zoomLocked = locked;
    if (!locked) {
      this.zoomLockedFrustum = null;
      return;
    }
    const target = Number.isFinite(forcedFrustum)
      ? Number(forcedFrustum)
      : this.zoomMin;
    this.zoomLockedFrustum = Game.clampZoom(
      target,
      this.zoomMin,
      this.zoomMax,
      VIEW_FRUSTUM_SIZE
    );
    this.setZoomFrustumSize(this.zoomLockedFrustum, false);
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

  /** Uniform mesh scale for cubes/ramps/hex blocks; layer stacking unchanged. Persists locally. */
  getBlockVisualScale(): number {
    return this.blockVisualScale;
  }

  setBlockVisualScale(scale: number): void {
    this.blockVisualScale = Game.clampBlockVisualScale(scale);
    try {
      localStorage.setItem(LS_BLOCK_VISUAL_SCALE, String(this.blockVisualScale));
    } catch {
      /* ignore quota */
    }
    this.refreshBlockTopHighlightFootprint();
    this.syncBlockMeshes();
  }

  private refreshBlockTopHighlightFootprint(): void {
    const w = BLOCK_SIZE * this.blockVisualScale;
    const prev = this.blockTopHighlight.geometry;
    this.blockTopHighlight.geometry = new THREE.PlaneGeometry(w, w);
    prev.dispose();
  }

  private applyFloorTileQuadScale(): void {
    const s = this.floorTileQuadSize;
    for (const [, mesh] of this.walkableFloorMeshes) {
      mesh.scale.set(s, 1, s);
    }
    this.rebuildWalkableFloorVisualMeshes();
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
    if (this.zoomLocked && this.zoomLockedFrustum !== null) {
      this.frustumSize = Game.clampZoom(
        this.zoomLockedFrustum,
        this.zoomMin,
        this.zoomMax,
        VIEW_FRUSTUM_SIZE
      );
    }
    localStorage.setItem(LS_ZOOM_FRUSTUM, String(this.frustumSize));
    this.applyOrthographicFrustum();
    this.refreshAllNameLabelScales();
    this.refreshChatBubbleVerticalPositions();
    this.refreshAllTypingIndicatorLayouts();
    this.requestRender();
  }

  setZoomFrustumSize(size: number, persist = true): void {
    if (this.zoomLocked && persist) return;
    const target =
      this.zoomLocked && this.zoomLockedFrustum !== null
        ? this.zoomLockedFrustum
        : size;
    this.frustumSize = Game.clampZoom(
      target,
      this.zoomMin,
      this.zoomMax,
      VIEW_FRUSTUM_SIZE
    );
    if (persist) {
      localStorage.setItem(LS_ZOOM_FRUSTUM, String(this.frustumSize));
    }
    this.applyOrthographicFrustum();
    this.refreshAllNameLabelScales();
    this.refreshChatBubbleVerticalPositions();
    this.refreshAllTypingIndicatorLayouts();
    this.requestRender();
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
    this.refreshAllTypingIndicatorLayouts();
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
      
      // Update scale and position based on current zoom
      this.syncChatBubbleScaleAndPosition(entry);
    }
  }

  /** Keeps chat bubbles near constant on-screen size at any orthographic zoom (like name labels). */
  private syncChatBubbleScaleAndPosition(entry: ChatBubbleEntry): void {
    const tw = entry.texWidth;
    const th = entry.texHeight;
    
    // Calculate world scale to maintain consistent screen height (scales with zoom like name tags)
    const basePlain = Math.max(
      CHAT_BUBBLE_MIN_HEIGHT_PX,
      th * 0.5
    );
    const targetScreenHeight = entry.emojiOnly
      ? basePlain * CHAT_BUBBLE_EMOJI_SCREEN_SCALE
      : basePlain;
    
    // Calculate height first - this is our priority for readability
    let worldH = this.pixelToWorldY(targetScreenHeight);
    
    // Calculate width based on aspect ratio
    let worldW = worldH * (tw / th);
    
    // Use a much more generous maximum width constraint
    const maxW = this.pixelToWorldX(CHAT_MAX_WIDTH_SCREEN_PX);
    if (worldW > maxW) {
      // Only clamp width, preserve height for readability
      worldW = maxW;
    }
    
    entry.sprite.scale.set(worldW, worldH, 1);
    
    // Position chat bubble above the avatar
    const avatarTop = AVATAR_SPHERE_RADIUS * 2 * this.identiconScale;
    const ch = worldH;
    const gapAboveAvatar = 0.12;
    entry.sprite.position.y = avatarTop + gapAboveAvatar + ch / 2;
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

  private readonly onCanvasContextMenu = (e: MouseEvent): void => {
    if (this.suppressAvatarContextMenuFromRightOrbit) {
      this.suppressAvatarContextMenuFromRightOrbit = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (!this.buildMode && this.gateContextOpener) {
      const bk = this.pickBlockKey(e.clientX, e.clientY);
      if (bk) {
        const m = this.placedObjects.get(bk);
        if (m?.gate) {
          e.preventDefault();
          e.stopPropagation();
          this.gateContextOpener({
            blockKey: bk,
            clientX: e.clientX,
            clientY: e.clientY,
          });
          return;
        }
      }
    }
    const g = this.pickClosestAvatarGroupAt(e.clientX, e.clientY);
    if (!g) return;
    const address = String(g.userData.address ?? "");
    const displayName = String(g.userData.displayName ?? "");
    if (g === this.selfMesh) {
      const others = this.pickAllOtherHumanAvatarsAt(e.clientX, e.clientY);
      if (others.length > 0 && this.otherPlayerContextOpener) {
        e.preventDefault();
        e.stopPropagation();
        this.otherPlayerContextOpener({
          targets: others,
          clientX: e.clientX,
          clientY: e.clientY,
          emoteRowFirst:
            !!this.selfQuickEmojiOpener &&
            this.rayPickHitsSelfAvatar(e.clientX, e.clientY),
        });
        return;
      }
      if (!this.selfQuickEmojiOpener) return;
      e.preventDefault();
      e.stopPropagation();
      this.selfQuickEmojiOpener();
      return;
    }
    if (remotePlayerIsNpc(address, displayName)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (!this.otherPlayerContextOpener) return;
    const targets = this.pickAllOtherHumanAvatarsAt(e.clientX, e.clientY);
    if (targets.length === 0) return;
    e.preventDefault();
    e.stopPropagation();
    this.otherPlayerContextOpener({
      targets,
      clientX: e.clientX,
      clientY: e.clientY,
      emoteRowFirst:
        !!this.selfQuickEmojiOpener &&
        this.rayPickHitsSelfAvatar(e.clientX, e.clientY),
    });
  };

  private readonly onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    if (this.zoomLocked) return;
    const scale = Math.exp(-e.deltaY * 0.0015);
    const next = this.frustumSize / scale;
    this.setZoomFrustumSize(next);
    this.requestRender(250);
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    this.requestRender(250);
    const isCancel = e.type === "pointercancel";
    if (
      this.rightOrbitDrag &&
      this.rightOrbitDrag.pointerId === e.pointerId
    ) {
      const d = this.rightOrbitDrag;
      const dragDist = Math.hypot(e.clientX - d.startX, e.clientY - d.startY);
      if (dragDist > Game.RIGHT_ORBIT_SUPPRESS_CONTEXTMENU_PX) {
        this.suppressAvatarContextMenuFromRightOrbit = true;
      }
      try {
        if (this.renderer.domElement.hasPointerCapture?.(e.pointerId)) {
          this.renderer.domElement.releasePointerCapture(e.pointerId);
        }
      } catch {
        /* ignore */
      }
      this.rightOrbitDrag = null;
      this.renderer.domElement.style.cursor = "pointer";
      this.beginCameraOrbitEaseToNearestCorner();
    }
    if (
      this.selfEmojiTouchSession &&
      this.selfEmojiTouchSession.pointerId === e.pointerId
    ) {
      clearTimeout(this.selfEmojiTouchSession.timer);
      this.selfEmojiTouchSession = null;
      if (!isCancel) {
        this.tryExecuteWalkNavigationAt(e.clientX, e.clientY);
      }
    }
    if (
      this.otherProfileTouchSession &&
      this.otherProfileTouchSession.pointerId === e.pointerId
    ) {
      clearTimeout(this.otherProfileTouchSession.timer);
      this.otherProfileTouchSession = null;
      if (!isCancel) {
        this.tryExecuteWalkNavigationAt(e.clientX, e.clientY);
      }
    }
    if (this.pendingPrimaryWalk && this.pendingPrimaryWalk.pointerId === e.pointerId) {
      if (isCancel) {
        this.clearPendingPrimaryWalk();
      } else if (e.button === 0) {
        const p = this.pendingPrimaryWalk;
        const slop =
          Math.hypot(e.clientX - p.startX, e.clientY - p.startY) <=
          Game.PENDING_WALK_CANCEL_DRAG_PX;
        this.clearPendingPrimaryWalk(slop);
        if (slop) {
          if (!this.tryGateDoubleOpenAt(e.clientX, e.clientY)) {
            this.tryExecuteWalkNavigationAt(e.clientX, e.clientY);
          }
        } else {
          this.refreshPathLine();
        }
      }
    }

    if (this.pendingBuildPlace && this.pendingBuildPlace.pointerId === e.pointerId) {
      const pb = this.pendingBuildPlace;
      this.pendingBuildPlace = null;
      try {
        if (this.renderer.domElement.hasPointerCapture?.(e.pointerId)) {
          this.renderer.domElement.releasePointerCapture(e.pointerId);
        }
      } catch {
        /* ignore */
      }
      this.clearPlacementPreview();
      if (!isCancel && e.button === 0) {
        const t = this.tryBuildPlacementFloorTile(e.clientX, e.clientY);
        const placeFn = this.placeBlockHandler;
        if (
          placeFn &&
          t &&
          t.x === pb.startTileX &&
          t.z === pb.startTileZ
        ) {
          placeFn(t.x, t.z);
        }
      }
    }

    if (e.pointerType !== "touch") return;
    this.releaseTouchPointerId(e.pointerId);
  };

  private readonly onWindowTouchPointerEnd = (e: PointerEvent): void => {
    if (e.pointerType !== "touch") return;
    this.releaseTouchPointerId(e.pointerId);
  };

  private readonly onDocumentVisibilityChange = (): void => {
    if (document.visibilityState === "hidden") {
      this.flushTouchPointerGestureState();
    }
  };

  private readonly onWindowPageHide = (): void => {
    this.flushTouchPointerGestureState();
  };

  /**
   * Drop one tracked touch from pinch/twist state. Idempotent if `pointerId` is unknown.
   * When the last of a two-finger rotate session lifts, runs the same corner ease as desktop.
   */
  private releaseTouchPointerId(pointerId: number): void {
    if (!this.touchPointers.has(pointerId)) return;
    const hadTwoTouches = this.touchPointers.size >= 2;
    const endingRotateOrbit =
      hadTwoTouches && this.touchTwoFingerMode === "rotate";
    this.touchPointers.delete(pointerId);
    if (this.touchPointers.size < 2) {
      this.pinchLastDistancePx = 0;
      this.touchTwoFingerMode = null;
      this.touchTwistPrevAngleValid = false;
      if (endingRotateOrbit) {
        this.beginCameraOrbitEaseToNearestCorner();
      }
    }
  }

  /** Clear all tracked touches (tab background, bfcache, recovery from stuck state). */
  private flushTouchPointerGestureState(): void {
    this.clearPendingBuildPlace();
    const endingRotateOrbit =
      this.touchPointers.size >= 2 && this.touchTwoFingerMode === "rotate";
    this.touchPointers.clear();
    this.pinchLastDistancePx = 0;
    this.touchTwoFingerMode = null;
    this.touchTwistPrevAngleValid = false;
    if (endingRotateOrbit) {
      this.beginCameraOrbitEaseToNearestCorner();
    }
  }

  /** Signed shortest angle delta from `prevRad` to `currRad` (radians). */
  private static touchAngleDeltaRad(prevRad: number, currRad: number): number {
    let d = currRad - prevRad;
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  private sortedTouchPair(): [
    { x: number; y: number },
    { x: number; y: number },
  ] | null {
    if (this.touchPointers.size < 2) return null;
    const arr = [...this.touchPointers.entries()].sort((u, v) => u[0] - v[0]);
    const a = arr[0]?.[1];
    const b = arr[1]?.[1];
    if (!a || !b) return null;
    return [a, b];
  }

  /** Inter-touch distance and line angle (stable pointer order) for pinch vs twist. */
  private twoTouchScreenGeometry(): {
    dist: number;
    angleRad: number;
  } | null {
    const pair = this.sortedTouchPair();
    if (!pair) return null;
    const [p0, p1] = pair;
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1e-6) return null;
    return { dist, angleRad: Math.atan2(dy, dx) };
  }

  setTileClickHandler(
    handler: ((x: number, z: number, layer?: 0 | 1) => void) | null
  ): void {
    this.tileClickHandler = handler;
  }

  setPlaceBlockHandler(handler: ((x: number, z: number) => void) | null): void {
    this.placeBlockHandler = handler;
  }

  setTeleporterDestPickHandler(
    handler: ((x: number, z: number) => void) | null
  ): void {
    this.teleporterDestPickHandler = handler;
  }

  isTeleporterDestPickActive(): boolean {
    return this.teleporterDestPickHandler !== null;
  }

  setClaimBlockHandler(
    handler: ((x: number, z: number, y: number) => void) | null
  ): void {
    this.claimBlockHandler = handler;
  }

  setGateDoubleOpenHandler(
    handler: ((x: number, z: number, y: number) => void) | null
  ): void {
    this.gateDoubleOpenHandler = handler;
  }

  setMoveBlockHandler(
    handler:
      | ((fromX: number, fromZ: number, toX: number, toZ: number) => void)
      | null
  ): void {
    this.moveBlockHandler = handler;
  }

  setObstacleSelectHandler(
    handler: ((x: number, z: number, y: number) => void) | null
  ): void {
    this.obstacleSelectHandler = handler;
  }

  /** `null` clears any in-progress long-press; non-null replaces the opener. */
  setSelfQuickEmojiOpener(handler: (() => void) | null): void {
    this.selfQuickEmojiOpener = handler;
    if (!handler) this.clearSelfEmojiTouchSession();
  }

  /** `null` clears any in-progress long-press on another player’s avatar. */
  setOtherPlayerContextOpener(
    handler:
      | ((p: {
          targets: Array<{ address: string; displayName: string }>;
          clientX: number;
          clientY: number;
          emoteRowFirst?: boolean;
        }) => void)
      | null
  ): void {
    this.otherPlayerContextOpener = handler;
    if (!handler) this.clearOtherProfileTouchSession();
  }

  setGateContextOpener(
    handler:
      | ((pick: {
          blockKey: string;
          clientX: number;
          clientY: number;
        }) => void)
      | null
  ): void {
    this.gateContextOpener = handler;
  }

  /** Placement ramp direction 0–3 (also used as gate exit cardinal). */
  getPlacementRampDir(): number {
    return this.placementRampDir;
  }

  private clearSelfEmojiTouchSession(): void {
    if (!this.selfEmojiTouchSession) return;
    clearTimeout(this.selfEmojiTouchSession.timer);
    this.selfEmojiTouchSession = null;
  }

  private clearOtherProfileTouchSession(): void {
    if (!this.otherProfileTouchSession) return;
    clearTimeout(this.otherProfileTouchSession.timer);
    this.otherProfileTouchSession = null;
  }

  setPlaceExtraFloorHandler(
    handler: ((x: number, z: number) => void) | null
  ): void {
    this.placeExtraFloorHandler = handler;
  }

  /** Arm next floor-expand click to set room entry spawn (cleared after fire or mode exit). */
  setRoomEntrySpawnPickHandler(
    handler: ((x: number, z: number) => void) | null
  ): void {
    this.roomEntrySpawnPickHandler = handler;
  }

  setRemoveExtraFloorHandler(
    handler: ((x: number, z: number) => void) | null
  ): void {
    this.removeExtraFloorHandler = handler;
  }

  getPlacedAt(x: number, z: number, y = 0): BlockStyleProps | null {
    return (
      this.placedObjects.get(blockKey(x, z, y)) ??
      (y === 0 ? this.placedObjects.get(tileKey(x, z)) : undefined) ??
      null
    );
  }

  /** Feet tile has a configured one-way teleporter; use Enter to warp. */
  getStandingTeleporter(): {
    targetRoomId: string;
    targetX: number;
    targetZ: number;
    targetRoomDisplayName?: string;
  } | null {
    if (!this.selfMesh) return null;
    const here = snapFloorTile(this.selfMesh.position.x, this.selfMesh.position.z);
    const m = this.topBlockAtTile(here.x, here.y)?.meta ?? null;
    const tp = m?.teleporter;
    if (!tp || ("pending" in tp && tp.pending) || !("targetRoomId" in tp)) {
      return null;
    }
    const tpd = tp as {
      targetRoomId: string;
      targetX: number;
      targetZ: number;
      targetRoomDisplayName?: string;
    };
    const snap = tpd.targetRoomDisplayName?.trim();
    return {
      targetRoomId: tpd.targetRoomId,
      targetX: tpd.targetX,
      targetZ: tpd.targetZ,
      ...(snap ? { targetRoomDisplayName: snap } : {}),
    };
  }

  getPlacementBlockStyle(): {
    half: boolean;
    quarter: boolean;
    hex: boolean;
    pyramid: boolean;
    pyramidBaseScale: number;
    sphere: boolean;
    ramp: boolean;
    rampDir: number;
    colorId: number;
    claimable: boolean;
  } {
    return {
      half: this.placementHalf,
      quarter: this.placementQuarter,
      hex: this.placementHex,
      pyramid: this.placementPyramid,
      pyramidBaseScale: this.placementPyramid
        ? this.placementPyramidBaseScale
        : 1,
      sphere: this.placementSphere,
      ramp: this.placementRamp,
      rampDir: this.placementRampDir,
      colorId: this.placementColorId,
      claimable: this.placementClaimable,
    };
  }

  setPlacementBlockStyle(p: {
    half?: boolean;
    quarter?: boolean;
    hex?: boolean;
    pyramid?: boolean;
    pyramidBaseScale?: number;
    sphere?: boolean;
    ramp?: boolean;
    rampDir?: number;
    colorId?: number;
    claimable?: boolean;
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
    if (p.pyramid !== undefined) this.placementPyramid = p.pyramid;
    if (p.sphere !== undefined) this.placementSphere = p.sphere;
    if (p.ramp === true) {
      this.placementRamp = true;
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
    if (p.claimable !== undefined) {
      this.placementClaimable = p.claimable;
    }
    if (p.pyramidBaseScale !== undefined) {
      this.placementPyramidBaseScale = clampPyramidBaseScale(p.pyramidBaseScale);
    }
    const prism = normalizeBlockPrismParts({
      hex: this.placementHex,
      pyramid: this.placementPyramid,
      sphere: this.placementSphere,
      ramp: this.placementRamp,
    });
    this.placementHex = prism.hex;
    this.placementPyramid = prism.pyramid;
    this.placementSphere = prism.sphere;
    this.placementRamp = prism.ramp;
    if (!this.placementPyramid) {
      this.placementPyramidBaseScale = 1;
    } else {
      this.placementPyramidBaseScale = clampPyramidBaseScale(
        this.placementPyramidBaseScale
      );
    }
    const anchor = this.placementPreviewAnchor;
    if (anchor) {
      this.syncPlacementPreviewAt(anchor.x, anchor.z, anchor.y);
    }
    this.renderInspectorTilePreview("placement");
  }

  setSelectedBlockKey(key: string | null): void {
    this.selectedBillboardId = null;
    if (this.selectedBlockKey === key) return;
    this.selectedBlockKey = key;
    this.refreshSelectionOutline();
  }

  clearSelectedBlock(): void {
    this.selectedBlockKey = null;
    this.selectedBillboardId = null;
    this.refreshSelectionOutline();
  }

  getSelectedBillboardId(): string | null {
    return this.selectedBillboardId;
  }

  getBillboardState(id: string): BillboardState | null {
    return this.billboardSpecs.get(id) ?? null;
  }

  getSelectedBlockTile(): { x: number; z: number; y: number } | null {
    if (this.selectedBillboardId) {
      const spec = this.billboardSpecs.get(this.selectedBillboardId);
      if (spec) {
        return { x: spec.anchorX, z: spec.anchorZ, y: 0 };
      }
    }
    if (!this.selectedBlockKey) return null;
    const [x, z, yRaw] = this.selectedBlockKey.split(",").map(Number);
    const y = Number.isFinite(yRaw) ? Math.max(0, Math.min(2, Math.floor(yRaw ?? 0))) : 0;
    if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
    return { x: x!, z: z!, y };
  }

  private selectBillboard(id: string): void {
    this.selectedBlockKey = null;
    this.selectedBillboardId = id;
    this.refreshSelectionOutline();
  }

  private billboardIdForFloorTile(x: number, z: number, y: number): string | null {
    if (y !== 0) return null;
    for (const b of this.billboardSpecs.values()) {
      const tiles = billboardFootprintTilesXZ(
        b.anchorX,
        b.anchorZ,
        b.orientation,
        b.yawSteps
      );
      if (tiles.some((t) => t.x === x && t.z === z)) return b.id;
    }
    return null;
  }

  private clearBillboardFootprintPreviewTiles(): void {
    for (const m of this.billboardFootprintPreviewMeshes) {
      m.visible = false;
    }
  }

  private syncBillboardFootprintHighlightTiles(
    tiles: readonly { x: number; z: number }[],
    valid: boolean
  ): void {
    const mat = valid
      ? this.billboardFootprintPreviewValidMat
      : this.billboardFootprintPreviewInvalidMat;
    while (this.billboardFootprintPreviewMeshes.length < tiles.length) {
      const m = new THREE.Mesh(this.billboardFootprintPreviewGeom, mat);
      m.rotation.x = -Math.PI / 2;
      m.renderOrder = 3;
      this.scene.add(m);
      this.billboardFootprintPreviewMeshes.push(m);
    }
    for (let i = 0; i < tiles.length; i++) {
      const m = this.billboardFootprintPreviewMeshes[i]!;
      const t = tiles[i]!;
      m.material = mat;
      m.position.set(t.x, 0.024, t.z);
      m.visible = true;
    }
    for (let i = tiles.length; i < this.billboardFootprintPreviewMeshes.length; i++) {
      this.billboardFootprintPreviewMeshes[i]!.visible = false;
    }
  }

  private removeBillboardInteractGhost(): void {
    if (!this.billboardInteractGhost) return;
    const root = this.billboardInteractGhost;
    this.scene.remove(root);
    const mesh = root.userData["billboardMesh"] as THREE.Mesh | undefined;
    if (mesh) {
      mesh.geometry.dispose();
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.map = null;
      mat.dispose();
    }
    this.billboardInteractGhost = null;
    this.billboardInteractGhostSig = "";
  }

  private clearRepositionBillboardVisualState(): void {
    if (this.repositionBillboardId) {
      this.applyBillboardRepositionVisualDim(false, this.repositionBillboardId);
    }
    this.repositionBillboardId = null;
    this.clearBillboardFootprintPreviewTiles();
    this.removeBillboardInteractGhost();
  }

  private applyBillboardRepositionVisualDim(on: boolean, id: string): void {
    const root = this.billboardRoots.get(id);
    if (!root) return;
    const mesh = root.userData["billboardMesh"] as THREE.Mesh | undefined;
    const mat = mesh?.material as THREE.MeshBasicMaterial | undefined;
    if (!mat) return;
    mat.transparent = true;
    mat.opacity = on ? 0.34 : 1;
    mat.depthWrite = false;
  }

  private isBillboardFootprintFreeForPlace(
    anchorX: number,
    anchorZ: number,
    orientation: "horizontal" | "vertical",
    yawSteps: number
  ): boolean {
    const tiles = billboardFootprintTilesXZ(
      anchorX,
      anchorZ,
      orientation,
      yawSteps
    );
    if (!this.selfMesh) return false;
    const px = this.selfMesh.position.x;
    const pz = this.selfMesh.position.z;
    const R = this.placeRadiusBlocks;
    const here = snapFloorTile(px, pz);
    for (const { x, z } of tiles) {
      if (Math.hypot(px - x, pz - z) > R + 1e-6) return false;
      if (
        !isWalkableTile(
          x,
          z,
          this.extraFloorKeys,
          this.roomId,
          this.removedBaseFloorKeys.size > 0
            ? this.removedBaseFloorKeys
            : undefined
        )
      ) {
        return false;
      }
      if (
        !floorWalkableTerrain(
          x,
          z,
          this.placedObjects,
          this.extraFloorKeys,
          this.roomId,
          this.removedBaseFloorKeys.size > 0
            ? this.removedBaseFloorKeys
            : undefined
        )
      ) {
        return false;
      }
      if (this.hubNoBuildTile(x, z)) return false;
      if (here.x === x && here.y === z) return false;
      if (this.nextOpenLevelAt(x, z) !== 0) return false;
      if (this.hasAnyBlockAtTile(x, z)) return false;
      if (this.signboards.has(tileKey(x, z))) return false;
      if (this.billboardIdForFloorTile(x, z, 0)) return false;
    }
    return true;
  }

  private isBillboardFootprintValidForMove(
    anchorX: number,
    anchorZ: number,
    orientation: "horizontal" | "vertical",
    yawSteps: number,
    movingId: string
  ): boolean {
    const spec = this.billboardSpecs.get(movingId);
    if (!spec) return false;
    const oldKeys = new Set(
      billboardFootprintTilesXZ(
        spec.anchorX,
        spec.anchorZ,
        spec.orientation,
        spec.yawSteps
      ).map((t) => `${t.x},${t.z}`)
    );
    const newTiles = billboardFootprintTilesXZ(
      anchorX,
      anchorZ,
      orientation,
      yawSteps
    );
    if (!this.selfMesh) return false;
    const px = this.selfMesh.position.x;
    const pz = this.selfMesh.position.z;
    const R = this.placeRadiusBlocks;
    const here = snapFloorTile(px, pz);
    for (const { x, z } of newTiles) {
      if (Math.hypot(px - x, pz - z) > R + 1e-6) return false;
      const ft: FloorTile = { x, y: z };
      if (!this.tileWalkable(ft)) return false;
      if (this.hubNoBuildTile(x, z)) return false;
      if (here.x === x && here.y === z) return false;
      const inOld = oldKeys.has(`${x},${z}`);
      if (!inOld) {
        if (this.nextOpenLevelAt(x, z) !== 0) return false;
        if (this.hasAnyBlockAtTile(x, z)) return false;
      }
      if (this.signboards.has(tileKey(x, z))) return false;
      const other = this.billboardIdForFloorTile(x, z, 0);
      if (other && other !== movingId) return false;
    }
    return true;
  }

  private resolveBillboardInteractTexture(): THREE.Texture {
    if (this.repositionBillboardId) {
      const root = this.billboardRoots.get(this.repositionBillboardId);
      const mesh = root?.userData["billboardMesh"] as THREE.Mesh | undefined;
      const map = (mesh?.material as THREE.MeshBasicMaterial | undefined)?.map;
      if (map) return map;
    }
    return this.billboardPreviewPlaceholderTex;
  }

  private syncBillboardInteractGhost(
    anchorX: number,
    anchorZ: number,
    orientation: "horizontal" | "vertical",
    yawSteps: number
  ): void {
    const tex = this.resolveBillboardInteractTexture();
    const sig = `${anchorX}|${anchorZ}|${orientation}|${yawSteps}|${tex.uuid}`;
    const spec = {
      anchorX,
      anchorZ,
      orientation,
      yawSteps,
    };
    if (
      this.billboardInteractGhost &&
      this.billboardInteractGhostSig === sig
    ) {
      updateBillboardRootPose(this.billboardInteractGhost, spec, BLOCK_SIZE);
      return;
    }
    this.removeBillboardInteractGhost();
    const root = createBillboardRoot(spec, BLOCK_SIZE, tex);
    const mat = root.userData["billboardMat"] as THREE.MeshBasicMaterial;
    mat.opacity = 0.4;
    mat.depthWrite = false;
    mat.needsUpdate = true;
    this.scene.add(root);
    this.billboardInteractGhost = root;
    this.billboardInteractGhostSig = sig;
  }

  private syncBillboardRepositionPreviews(
    clientX: number,
    clientY: number
  ): void {
    const bid = this.repositionBillboardId;
    const spec = bid ? this.billboardSpecs.get(bid) : undefined;
    const from = this.repositionFrom;
    if (!bid || !spec || !from) {
      this.clearBillboardFootprintPreviewTiles();
      this.removeBillboardInteractGhost();
      return;
    }
    const dest = this.pickFloor(clientX, clientY);
    if (!dest) {
      this.clearBillboardFootprintPreviewTiles();
      this.removeBillboardInteractGhost();
      return;
    }
    const nAx = spec.anchorX + (dest.x - from.x);
    const nAz = spec.anchorZ + (dest.y - from.y);
    const previewTiles = billboardFootprintTilesXZ(
      nAx,
      nAz,
      spec.orientation,
      this.repositionDraftYaw
    );
    const ok = this.isBillboardFootprintValidForMove(
      nAx,
      nAz,
      spec.orientation,
      this.repositionDraftYaw,
      bid
    );
    this.syncBillboardFootprintHighlightTiles(previewTiles, ok);
    this.syncBillboardInteractGhost(
      nAx,
      nAz,
      spec.orientation,
      this.repositionDraftYaw
    );
    this.tileHighlight.position.set(dest.x, 0.02, dest.y);
    this.tileHighlight.visible = true;
    this.clearPlacementPreview();
  }

  private syncBillboardPlacementPreviews(
    clientX: number,
    clientY: number
  ): void {
    if (!this.selfMesh || !this.placeBlockHandler) {
      this.clearBillboardFootprintPreviewTiles();
      this.removeBillboardInteractGhost();
      return;
    }
    if (this.teleporterDestPickHandler || this.repositionFrom) {
      this.clearBillboardFootprintPreviewTiles();
      this.removeBillboardInteractGhost();
      return;
    }
    if (this.pickBlockKey(clientX, clientY)) {
      this.clearBillboardFootprintPreviewTiles();
      this.removeBillboardInteractGhost();
      return;
    }
    const dest = this.pickFloor(clientX, clientY);
    if (!dest) {
      this.clearBillboardFootprintPreviewTiles();
      this.removeBillboardInteractGhost();
      return;
    }
    const orient = this.billboardPlacementDraft.orientation;
    const yaw = 0;
    const anchorX = dest.x;
    const anchorZ = dest.y;
    const placeTiles = billboardFootprintTilesXZ(anchorX, anchorZ, orient, yaw);
    const ok = this.isBillboardFootprintFreeForPlace(
      anchorX,
      anchorZ,
      orient,
      yaw
    );
    this.syncBillboardFootprintHighlightTiles(placeTiles, ok);
    this.syncBillboardInteractGhost(anchorX, anchorZ, orient, yaw);
    this.tileHighlight.position.set(anchorX, 0.02, anchorZ);
    this.tileHighlight.visible = true;
    this.clearPlacementPreview();
  }

  private pickBillboardId(clientX: number, clientY: number): string | null {
    if (!this.updateNdc(clientX, clientY)) return null;
    this.camera.updateMatrixWorld();
    this.camera.updateProjectionMatrix();
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const roots = [...this.billboardRoots.values()];
    if (roots.length === 0) return null;
    const hits = this.raycaster.intersectObjects(roots, true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o) {
        const id = o.userData["billboardId"] as string | undefined;
        if (id) return id;
        o = o.parent;
      }
    }
    return null;
  }

  private billboardSelectionOutlineGeometry(mesh: THREE.Mesh): THREE.BufferGeometry | null {
    mesh.updateMatrixWorld(true);
    const posAttr = mesh.geometry.getAttribute("position") as
      | THREE.BufferAttribute
      | undefined;
    if (!posAttr || posAttr.count < 3) return null;
    const scratch = new THREE.Vector3();
    const corners: THREE.Vector3[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < posAttr.count; i++) {
      scratch.fromBufferAttribute(posAttr, i);
      scratch.applyMatrix4(mesh.matrixWorld);
      const key = `${scratch.x.toFixed(4)},${scratch.y.toFixed(4)},${scratch.z.toFixed(4)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      corners.push(scratch.clone());
      if (corners.length >= 4) break;
    }
    if (corners.length < 3) return null;
    while (corners.length > 4) corners.pop();
    const n = corners.length;
    const positions = new Float32Array(n * 2 * 3);
    let o = 0;
    for (let i = 0; i < n; i++) {
      const a = corners[i]!;
      const b = corners[(i + 1) % n]!;
      positions[o++] = a.x;
      positions[o++] = a.y;
      positions[o++] = a.z;
      positions[o++] = b.x;
      positions[o++] = b.y;
      positions[o++] = b.z;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }

  private refreshSelectionOutline(): void {
    if (!this.buildMode) {
      this.selectionOutline.visible = false;
      this.refreshTeleporterLinkHighlight();
      return;
    }
    if (this.selectedBillboardId) {
      const root = this.billboardRoots.get(this.selectedBillboardId);
      const mesh = root?.userData["billboardMesh"] as THREE.Mesh | undefined;
      if (!mesh) {
        this.selectionOutline.visible = false;
        this.refreshTeleporterLinkHighlight();
        return;
      }
      const geo = this.billboardSelectionOutlineGeometry(mesh);
      if (!geo) {
        this.selectionOutline.visible = false;
        this.refreshTeleporterLinkHighlight();
        return;
      }
      const prev = this.selectionOutline.geometry;
      this.selectionOutline.geometry = geo;
      prev.dispose();
      this.selectionOutline.position.set(0, 0, 0);
      this.selectionOutline.rotation.set(0, 0, 0);
      this.selectionOutline.visible = true;
      this.refreshTeleporterLinkHighlight();
      return;
    }
    if (!this.selectedBlockKey) {
      this.selectionOutline.visible = false;
      this.refreshTeleporterLinkHighlight();
      return;
    }
    const g = this.blockMeshes.get(this.selectedBlockKey);
    if (!g) {
      this.selectionOutline.visible = false;
      this.refreshTeleporterLinkHighlight();
      return;
    }
    const meta = this.placedObjects.get(this.selectedBlockKey);
    const vis = this.blockVisualScale;
    const padding = 0.04;
    let size: THREE.Vector3;
    const center = new THREE.Vector3().copy(g.position);
    /** Pyramid base can scale past the tile; keep the selection box one tile so it stays predictable. */
    if (meta?.pyramid) {
      const h = this.obstacleHeight(meta);
      const foot = BLOCK_SIZE * vis;
      const sy = h * vis + padding;
      size = new THREE.Vector3(foot + padding, sy, foot + padding);
    } else {
      const box = blockGroupWorldBoundsForSelectionOutline(g);
      if (!box) {
        this.selectionOutline.visible = false;
        this.refreshTeleporterLinkHighlight();
        return;
      }
      size = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      if (size.x < 1e-6 || size.y < 1e-6 || size.z < 1e-6) {
        this.selectionOutline.visible = false;
        this.refreshTeleporterLinkHighlight();
        return;
      }
      size.x += padding;
      size.y += padding;
      size.z += padding;
    }
    if (size.x < 1e-6 || size.y < 1e-6 || size.z < 1e-6) {
      this.selectionOutline.visible = false;
      this.refreshTeleporterLinkHighlight();
      return;
    }
    const prev = this.selectionOutline.geometry;
    const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
    const edges = new THREE.EdgesGeometry(geo, 50);
    geo.dispose();
    this.selectionOutline.geometry = edges;
    prev.dispose();
    this.selectionOutline.position.copy(center);
    this.selectionOutline.rotation.set(0, 0, 0);
    this.selectionOutline.visible = true;
    this.refreshTeleporterLinkHighlight();
  }

  /** When a teleporter is selected in build mode, tint the floor tile it warps to (this room only). */
  private refreshTeleporterLinkHighlight(): void {
    if (!this.buildMode || !this.selectedBlockKey) {
      this.teleporterLinkHighlight.visible = false;
      return;
    }
    const meta = this.placedObjects.get(this.selectedBlockKey);
    const tp = meta?.teleporter;
    if (!tp || ("pending" in tp && tp.pending) || !("targetRoomId" in tp)) {
      this.teleporterLinkHighlight.visible = false;
      return;
    }
    if (normalizeRoomId(tp.targetRoomId) !== normalizeRoomId(this.roomId)) {
      this.teleporterLinkHighlight.visible = false;
      return;
    }
    this.teleporterLinkHighlight.position.set(
      tp.targetX,
      0.024,
      tp.targetZ
    );
    this.teleporterLinkHighlight.visible = true;
  }

  beginReposition(x: number, z: number, yLevel = 0): void {
    this.clearPlacementPreview();
    this.clearRepositionBillboardVisualState();
    this.repositionFrom = { x, y: z };
    const yb = Math.max(0, Math.min(2, Math.floor(yLevel)));
    this.repositionSourceYLevel = yb;
    const gateMeta = this.placedObjects.get(blockKey(x, z, yb));
    if (gateMeta?.gate) {
      const g = gateMeta.gate;
      this.repositionGateHint = {
        fromX: x,
        fromZ: z,
        fromYLevel: yb,
        exitX: g.exitX,
        exitZ: g.exitZ,
        colorId: gateMeta.colorId,
        rampDir: gateMeta.rampDir & 3,
        quarter: gateMeta.quarter,
        half: gateMeta.half,
        adminAddress: g.adminAddress,
        authorizedAddresses: [...(g.authorizedAddresses ?? [])],
      };
      this.repositionGatePlacedVisualFreeze = {
        exitX: g.exitX,
        exitZ: g.exitZ,
      };
    } else {
      this.repositionGateHint = null;
      this.repositionGatePlacedVisualFreeze = null;
    }
    const bb = this.billboardIdForFloorTile(x, z, 0);
    this.repositionBillboardId = bb;
    if (bb) {
      const spec = this.billboardSpecs.get(bb);
      this.repositionDraftYaw = spec?.yawSteps ?? 0;
      queueMicrotask(() => this.applyBillboardRepositionVisualDim(true, bb));
    }
    this.syncHighlightColor();
  }

  cancelReposition(): void {
    this.clearRepositionBillboardVisualState();
    this.repositionFrom = null;
    this.repositionGateHint = null;
    this.repositionGatePlacedVisualFreeze = null;
    this.clearPlacementPreview();
    this.syncHighlightColor();
  }

  isRepositioning(): boolean {
    return this.repositionFrom !== null;
  }

  /**
   * Re-run gate-move neighbor tint and transparent ghost using the last canvas pointer position
   * (e.g. after changing opening direction from the object panel without moving the mouse).
   */
  refreshGateRepositionPreviewsFromStoredPointer(): void {
    this.refreshGateNeighborTileHints(
      this.lastPointerClientPixels.x,
      this.lastPointerClientPixels.y,
      null
    );
  }

  setBillboardPlacementPreviewActive(active: boolean): void {
    this.billboardPlacementPreview = active;
    if (!active) {
      this.clearBillboardFootprintPreviewTiles();
      this.removeBillboardInteractGhost();
    }
  }

  getBillboardPlacementDraft(): {
    orientation: "horizontal" | "vertical";
    yawSteps: number;
    advertIds: string[];
    intervalSec: number;
    advertId: string;
    liveChartRange: NimBillboardChartRange;
    liveChartFallbackAdvertId: string;
    liveChartRangeCycle: boolean;
    liveChartCycleIntervalSec: number;
    billboardSourceTab: "images" | "other";
  } {
    const advertIds = [...this.billboardPlacementDraft.advertIds];
    return {
      orientation: this.billboardPlacementDraft.orientation,
      yawSteps: this.billboardPlacementDraft.yawSteps,
      advertIds,
      intervalSec: this.billboardPlacementDraft.intervalSec,
      advertId:
        advertIds[0] ?? BILLBOARD_ADVERTS_CATALOG[0]?.id ?? "nimiq_bb",
      liveChartRange: this.billboardPlacementDraft.liveChartRange,
      liveChartFallbackAdvertId:
        this.billboardPlacementDraft.liveChartFallbackAdvertId,
      liveChartRangeCycle: this.billboardPlacementDraft.liveChartRangeCycle,
      liveChartCycleIntervalSec:
        this.billboardPlacementDraft.liveChartCycleIntervalSec,
      billboardSourceTab: this.billboardPlacementDraft.billboardSourceTab,
    };
  }

  setBillboardPlacementDraft(patch: {
    orientation?: "horizontal" | "vertical";
    yawSteps?: number;
    advertIds?: string[];
    intervalSec?: number;
    advertId?: string;
    liveChartRange?: NimBillboardChartRange;
    liveChartFallbackAdvertId?: string;
    liveChartRangeCycle?: boolean;
    liveChartCycleIntervalSec?: number;
    billboardSourceTab?: "images" | "other";
  }): void {
    if (patch.orientation !== undefined) {
      let o = patch.orientation;
      if (BILLBOARD_VERTICAL_PLACEMENT_TEMP_DISABLED && o === "vertical") {
        o = "horizontal";
      }
      this.billboardPlacementDraft.orientation = o;
    }
    if (patch.yawSteps !== undefined) {
      this.billboardPlacementDraft.yawSteps = Math.max(
        0,
        Math.min(3, Math.floor(patch.yawSteps))
      );
    }
    if (patch.advertIds !== undefined) {
      const cleaned = patch.advertIds
        .map((x) => String(x ?? "").trim())
        .filter((id) => BILLBOARD_ADVERTS_CATALOG.some((a) => a.id === id))
        .slice(0, 8);
      if (cleaned.length > 0) {
        this.billboardPlacementDraft.advertIds = cleaned;
      }
    }
    if (patch.advertId !== undefined && patch.advertIds === undefined) {
      const k = String(patch.advertId ?? "").trim();
      const ok = BILLBOARD_ADVERTS_CATALOG.some((a) => a.id === k);
      this.billboardPlacementDraft.advertIds = [
        ok ? k : (BILLBOARD_ADVERTS_CATALOG[0]?.id ?? "nimiq_bb"),
      ];
    }
    if (patch.intervalSec !== undefined) {
      const s = Math.floor(Number(patch.intervalSec));
      if (Number.isFinite(s)) {
        this.billboardPlacementDraft.intervalSec = Math.max(
          1,
          Math.min(300, s)
        );
      }
    }
    if (patch.liveChartRange !== undefined) {
      const r = patch.liveChartRange;
      this.billboardPlacementDraft.liveChartRange =
        r === "7d" || r === "24h" ? r : "24h";
    }
    if (patch.billboardSourceTab !== undefined) {
      this.billboardPlacementDraft.billboardSourceTab = patch.billboardSourceTab;
    }
    if (patch.liveChartFallbackAdvertId !== undefined) {
      const k = String(patch.liveChartFallbackAdvertId ?? "").trim();
      this.billboardPlacementDraft.liveChartFallbackAdvertId =
        getBillboardAdvertById(k)?.id ?? DEFAULT_BILLBOARD_CHART_FALLBACK_ADVERT_ID;
    }
    if (patch.liveChartRangeCycle !== undefined) {
      this.billboardPlacementDraft.liveChartRangeCycle = Boolean(
        patch.liveChartRangeCycle
      );
    }
    if (patch.liveChartCycleIntervalSec !== undefined) {
      const s = Math.floor(Number(patch.liveChartCycleIntervalSec));
      if (Number.isFinite(s)) {
        this.billboardPlacementDraft.liveChartCycleIntervalSec = Math.max(
          5,
          Math.min(300, s)
        );
      }
    }
  }

  /** R key (+1 per press) while repositioning a billboard (placement yaw is fixed). */
  cycleBillboardInteractionYaw(delta: 1 | -1): boolean {
    if (!this.buildMode) return false;
    if (this.repositionBillboardId) {
      this.repositionDraftYaw = (this.repositionDraftYaw + delta + 4) % 4;
      this.syncBillboardRepositionPreviews(
        this.lastBillboardPointerClientX,
        this.lastBillboardPointerClientY
      );
      return true;
    }
    return false;
  }

  getRepositioningBillboardId(): string | null {
    return this.repositionBillboardId;
  }

  getBillboardRepositionYaw(): number {
    return this.repositionDraftYaw;
  }

  /**
   * Build mode: M toggles reposition from current selection; second M cancels
   * without sending a move (same as cancel).
   */
  tryToggleRepositionWithKeyboard(): boolean {
    if (!this.buildMode) return false;
    if (this.teleporterDestPickHandler) return false;
    if (this.isRepositioning()) {
      this.cancelReposition();
      return true;
    }
    if (!this.moveBlockHandler) return false;
    const t = this.getSelectedBlockTile();
    if (!t) return false;
    this.beginReposition(t.x, t.z, t.y);
    return true;
  }

  setBuildMode(on: boolean): void {
    this.buildMode = on;
    if (on) this.floorExpandMode = false;
    if (!on) {
      this.clearPendingBuildPlace();
      this.clearPlacementPreview();
      this.clearRepositionBillboardVisualState();
      this.repositionFrom = null;
      this.repositionGateHint = null;
      this.repositionGatePlacedVisualFreeze = null;
      this.setBillboardPlacementPreviewActive(false);
      this.clearSelectedBlock();
    }
    this.syncHighlightColor();
    this.refreshSelectionOutline();
    this.syncPlacementRangeHints();
    this.syncRoomEntrySpawnMarker(performance.now() * 0.001);
    this.requestRender();
  }

  getBuildMode(): boolean {
    return this.buildMode;
  }

  setFloorExpandMode(on: boolean): void {
    this.floorExpandMode = on;
    if (on) {
      this.buildMode = false;
      this.clearPendingBuildPlace();
      this.clearPlacementPreview();
      this.clearRepositionBillboardVisualState();
      this.repositionFrom = null;
      this.repositionGateHint = null;
      this.repositionGatePlacedVisualFreeze = null;
      this.setBillboardPlacementPreviewActive(false);
    } else {
      this.roomEntrySpawnPickHandler = null;
    }
    this.syncHighlightColor();
    this.syncPlacementRangeHints();
    this.syncRoomEntrySpawnMarker(performance.now() * 0.001);
    this.requestRender();
  }

  getFloorExpandMode(): boolean {
    return this.floorExpandMode;
  }

  /**
   * Dynamic-room sky: neutral solid, hue tint, or default water when neither applies.
   */
  setRoomSceneBackground(opts: {
    hueDeg?: number | null;
    neutral?: RoomBackgroundNeutral | null;
  }): void {
    const n = opts.neutral;
    if (n === "black") {
      this.scene.background = new THREE.Color(0x070a0f);
      return;
    }
    if (n === "white") {
      this.scene.background = new THREE.Color(0xd4dce8);
      return;
    }
    if (n === "gray") {
      this.scene.background = new THREE.Color(0x2a313c);
      return;
    }
    const hueDeg = opts.hueDeg;
    if (hueDeg == null || !Number.isFinite(Number(hueDeg))) {
      this.scene.background = new THREE.Color(TERRAIN_WATER_COLOR);
      return;
    }
    const h = (((Number(hueDeg) % 360) + 360) % 360) / 360;
    const c = new THREE.Color();
    c.setHSL(h, 0.42, 0.11);
    this.scene.background = c;
  }

  /**
   * Dynamic-room sky tint from hue (degrees), or default water tone when null/undefined.
   * Clears neutral tint (use {@link setRoomSceneBackground} to set neutrals).
   */
  setRoomSceneBackgroundHueDeg(hueDeg: number | null | undefined): void {
    this.setRoomSceneBackground({ hueDeg, neutral: null });
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

  /** Incremental extra-floor update (server-synced). */
  applyExtraFloorDelta(
    add: readonly { x: number; z: number }[],
    remove: readonly string[]
  ): void {
    for (const k of remove) {
      this.extraFloorKeys.delete(k);
    }
    for (const t of add) {
      this.extraFloorKeys.add(tileKey(t.x, t.z));
    }
    this.syncWalkableFloorMeshes();
    this.refreshPathLine();
    this.syncPlacementRangeHints();
  }

  setRemovedBaseFloorTiles(tiles: readonly { x: number; z: number }[]): void {
    this.removedBaseFloorKeys.clear();
    for (const t of tiles) {
      this.removedBaseFloorKeys.add(tileKey(t.x, t.z));
    }
    this.syncWalkableFloorMeshes();
    this.refreshPathLine();
    this.syncPlacementRangeHints();
  }

  applyRemovedBaseFloorDelta(add: readonly string[], remove: readonly string[]): void {
    for (const k of remove) {
      this.removedBaseFloorKeys.delete(k);
    }
    for (const k of add) {
      this.removedBaseFloorKeys.add(k);
    }
    this.syncWalkableFloorMeshes();
    this.refreshPathLine();
    this.syncPlacementRangeHints();
  }

  /** Initialize canvas claims from welcome message */
  async setCanvasClaims(claims: readonly { x: number; z: number; address: string }[]): Promise<void> {
    this.canvasClaims.clear();
    const bounds = this.roomBounds;
    
    let filtered = 0;
    for (const claim of claims) {
      // Only render claims within current room bounds
      if (claim.x < bounds.minX || claim.x > bounds.maxX || 
          claim.z < bounds.minZ || claim.z > bounds.maxZ) {
        filtered++;
        continue;
      }
      
      const k = tileKey(claim.x, claim.z);
      this.canvasClaims.set(k, claim.address);
    }
    
    if (filtered > 0) {
    }
    
    // Wait for all identicons to load
    await this.syncCanvasIdenticonMeshesAsync();
  }

  /** Handle a single canvas claim update */
  applyCanvasClaim(x: number, z: number, address: string): void {
    const k = tileKey(x, z);
    
    // Empty address means unclaim the tile
    if (address === "") {
      this.canvasClaims.delete(k);
      // Remove the identicon mesh and properly dispose of all resources
      const oldMesh = this.canvasIdenticonMeshes.get(k);
      if (oldMesh) {
        this.scene.remove(oldMesh);
        oldMesh.geometry.dispose();
        if (oldMesh.material instanceof THREE.Material) {
          // Dispose texture if it exists
          if (oldMesh.material.map) {
            oldMesh.material.map.dispose();
          }
          oldMesh.material.dispose();
        }
        this.canvasIdenticonMeshes.delete(k);
      }
      return;
    }
    
    this.canvasClaims.set(k, address);
    this.syncCanvasIdenticonForTile(x, z, address);
  }

  /** Clear all canvas claims (reset the canvas floor) */
  clearAllCanvasClaims(): void {
    this.canvasClaims.clear();
    this.clearCanvasIdenticons();
  }

  /** Set signboards for the current room */
  setSignboards(
    signboards: readonly {
      id: string;
      x: number;
      z: number;
      message: string;
      createdBy: string;
      createdAt: number;
    }[]
  ): void {
    this.signboards.clear();
    for (const s of signboards) {
      const k = tileKey(s.x, s.z);
      this.signboards.set(k, { ...s });
    }
  }

  setSignboardHoverHandler(
    handler:
      | ((signboard: {
          id: string;
          x: number;
          z: number;
          message: string;
          createdBy: string;
          createdAt: number;
        } | null) => void)
      | null
  ): void {
    this.signboardHoverHandler = handler;
  }

  private rebuildBillboardFootprintFloorKeys(): void {
    this.billboardFootprintFloorKeys.clear();
    for (const b of this.billboardSpecs.values()) {
      for (const t of billboardFootprintTilesXZ(
        b.anchorX,
        b.anchorZ,
        b.orientation,
        b.yawSteps
      )) {
        this.billboardFootprintFloorKeys.add(`${t.x},${t.z}`);
      }
    }
  }

  setBillboards(billboards: readonly BillboardState[]): void {
    this.billboardSyncGen++;
    const gen = this.billboardSyncGen;
    const prevSelectedBb = this.selectedBillboardId;
    for (const t of this.billboardTimers.values()) {
      clearInterval(t);
    }
    this.billboardTimers.clear();
    for (const root of this.billboardRoots.values()) {
      this.scene.remove(root);
      disposeBillboardRoot(root);
    }
    this.billboardRoots.clear();
    this.billboardSpecs.clear();
    for (const raw of billboards) {
      const rawIds = raw.advertIds;
      let advertIds: string[] | undefined;
      if (Array.isArray(rawIds) && rawIds.length > 0) {
        advertIds = rawIds
          .map((x) => String(x ?? "").trim())
          .filter(Boolean)
          .slice(0, 8);
      }
      if (!advertIds?.length && raw.advertId) {
        advertIds = [String(raw.advertId).trim()].filter(Boolean);
      }
      const se = Number(raw.slideshowEpochMs);
      const lcRaw = raw.liveChart as
        | {
            range?: string;
            fallbackAdvertId?: string;
            rangeCycle?: boolean;
            cycleIntervalSec?: number;
          }
        | undefined;
      let liveChart: BillboardState["liveChart"];
      if (
        lcRaw &&
        typeof lcRaw === "object" &&
        (lcRaw.range === "24h" ||
          lcRaw.range === "7d" ||
          lcRaw.range === "60m" ||
          lcRaw.range === "1h")
      ) {
        const fb = String(lcRaw.fallbackAdvertId ?? "").trim();
        const rng = lcRaw.range;
        const rangeCycle = lcRaw.rangeCycle === true;
        const cycleIntervalSec = rangeCycle
          ? Math.max(
              5,
              Math.min(
                300,
                Math.floor(Number(lcRaw.cycleIntervalSec)) || 20
              )
            )
          : undefined;
        liveChart = {
          range: rng === "7d" ? "7d" : "24h",
          fallbackAdvertId: getBillboardAdvertById(fb)
            ? fb
            : DEFAULT_BILLBOARD_CHART_FALLBACK_ADVERT_ID,
          ...(rangeCycle ? { rangeCycle: true, cycleIntervalSec } : {}),
        };
      }
      const b: BillboardState = {
        ...raw,
        advertId: String(raw.advertId ?? "").trim(),
        advertIds: advertIds?.length ? advertIds : undefined,
        slideshowEpochMs: Number.isFinite(se) ? se : undefined,
        visitName: String(raw.visitName ?? "").trim(),
        visitUrl: String(raw.visitUrl ?? "").trim(),
        liveChart,
      };
      this.billboardSpecs.set(b.id, b);
      void this.mountOneBillboard(b, gen);
    }
    this.rebuildBillboardFootprintFloorKeys();
    this.syncBlockMeshes();
    if (
      prevSelectedBb &&
      !billboards.some((b) => b.id === prevSelectedBb)
    ) {
      this.selectedBillboardId = null;
    }
    this.refreshSelectionOutline();
    if (this.repositionBillboardId) {
      const id = this.repositionBillboardId;
      requestAnimationFrame(() => this.applyBillboardRepositionVisualDim(true, id));
    }
  }

  private resolveBillboardTextureUrl(url: string): string {
    if (url.startsWith("/") && !url.startsWith("//")) {
      return `${window.location.origin}${url}`;
    }
    return url;
  }

  private loadBillboardTexture(url: string): Promise<THREE.Texture> {
    return new Promise((resolve, reject) => {
      const loader = new THREE.TextureLoader();
      loader.load(
        this.resolveBillboardTextureUrl(url),
        (tex: THREE.Texture) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.needsUpdate = true;
          resolve(tex);
        },
        undefined,
        () => reject(new Error("billboard_tex_load"))
      );
    });
  }

  private mountBillboardLiveChart(
    root: THREE.Group,
    b: BillboardState,
    gen: number
  ): void {
    const POLL_MS = 60_000;
    const CHART_CYCLE_ORDER: readonly NimBillboardChartRange[] = [
      "24h",
      "7d",
    ];
    let cyclePhase = 0;
    const lc = b.liveChart!;
    const rangeCycleOn = lc.rangeCycle === true;
    const cycleIntervalMs = rangeCycleOn
      ? Math.max(
          5_000,
          Math.min(300_000, Math.floor((lc.cycleIntervalSec ?? 20) * 1000))
        )
      : 0;
    const currentRange = (): NimBillboardChartRange =>
      rangeCycleOn
        ? CHART_CYCLE_ORDER[cyclePhase % CHART_CYCLE_ORDER.length]!
        : (lc.range as NimBillboardChartRange);
    const chartTitle = (): string => nimChartTitleForRange(currentRange());
    const fallbackAdvertId = lc.fallbackAdvertId;
    const canvas = document.createElement("canvas");
    canvas.width = NIM_BILLBOARD_CHART_W;
    canvas.height = NIM_BILLBOARD_CHART_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;

    const mat = root.userData["billboardMat"] as
      | THREE.MeshBasicMaterial
      | undefined;
    if (!mat || gen !== this.billboardSyncGen) {
      tex.dispose();
      return;
    }
    const oldMap = mat.map;
    mat.map = tex;
    mat.needsUpdate = true;
    if (oldMap && oldMap !== tex) oldMap.dispose();

    let lastCandles: NimOhlcCandle[] | null = null;
    let showUnavailableOnCanvas = false;
    let nextPollAt = Date.now() + POLL_MS;

    /** Timers must not run heavy chart work in the same turn as gameplay RAF — defer to idle. */
    const scheduleRedrawChartCanvas = (): void => {
      const run = (): void => {
        redrawChartCanvas();
      };
      if (typeof requestIdleCallback === "function") {
        requestIdleCallback(run, { timeout: 120 });
      } else {
        setTimeout(run, 0);
      }
    };

    const schedulePaint = (): void => {
      const run = (): void => {
        void paint();
      };
      if (typeof requestIdleCallback === "function") {
        requestIdleCallback(run, { timeout: 200 });
      } else {
        setTimeout(run, 0);
      }
    };

    const redrawChartCanvas = (): void => {
      if (gen !== this.billboardSyncGen) return;
      if (this.billboardRoots.get(b.id) !== root) return;
      const matNow = root.userData["billboardMat"] as
        | THREE.MeshBasicMaterial
        | undefined;
      if (!matNow || matNow.map !== tex) return;
      const remainingSec = Math.max(
        0,
        Math.ceil((nextPollAt - Date.now()) / 1000)
      );
      void ensureNimChartFontsLoaded().then(() => {
        if (gen !== this.billboardSyncGen) return;
        if (this.billboardRoots.get(b.id) !== root) return;
        const m2 = root.userData["billboardMat"] as
          | THREE.MeshBasicMaterial
          | undefined;
        if (!m2 || m2.map !== tex) return;
        if (lastCandles) {
          drawNimBillboardCandles(
            ctx,
            lastCandles,
            canvas.width,
            canvas.height,
            chartTitle()
          );
        } else if (showUnavailableOnCanvas) {
          ctx.fillStyle = "#0b0f14";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = "#787878";
          ctx.font = `500 20px ${NIM_BILLBOARD_CHART_FONT}`;
          ctx.textAlign = "center";
          ctx.fillText(
            "Chart unavailable",
            canvas.width / 2,
            canvas.height / 2
          );
        } else {
          ctx.fillStyle = "#0b0f14";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = "#64748b";
          ctx.font = `500 22px ${NIM_BILLBOARD_CHART_FONT}`;
          ctx.textAlign = "center";
          ctx.fillText(
            "Loading chart…",
            canvas.width / 2,
            canvas.height / 2
          );
        }
        drawNimChartRefreshCountdown(
          ctx,
          canvas.width,
          canvas.height,
          remainingSec
        );
        tex.needsUpdate = true;
        m2.needsUpdate = true;
      });
    };

    const paint = async (): Promise<void> => {
      if (gen !== this.billboardSyncGen) return;
      if (this.billboardRoots.get(b.id) !== root) return;
      const matNow = root.userData["billboardMat"] as
        | THREE.MeshBasicMaterial
        | undefined;
      if (!matNow) return;

      try {
        const data = await fetchNimBillboardOhlc(currentRange());
        if (gen !== this.billboardSyncGen) return;
        if (this.billboardRoots.get(b.id) !== root) return;
        await ensureNimChartFontsLoaded();
        if (gen !== this.billboardSyncGen) return;
        lastCandles = data.candles;
        showUnavailableOnCanvas = false;
        drawNimBillboardCandles(
          ctx,
          data.candles,
          canvas.width,
          canvas.height,
          chartTitle()
        );
        const remainingSec = Math.max(
          0,
          Math.ceil((nextPollAt - Date.now()) / 1000)
        );
        drawNimChartRefreshCountdown(
          ctx,
          canvas.width,
          canvas.height,
          remainingSec
        );
        tex.needsUpdate = true;
        if (matNow.map !== tex) {
          const prev = matNow.map;
          matNow.map = tex;
          matNow.needsUpdate = true;
          if (prev && prev !== tex) prev.dispose();
        } else {
          matNow.needsUpdate = true;
        }
      } catch {
        if (gen !== this.billboardSyncGen) return;
        if (this.billboardRoots.get(b.id) !== root) return;
        lastCandles = null;
        const url = getFirstSlideUrlForAdvertId(fallbackAdvertId);
        if (!url) {
          showUnavailableOnCanvas = true;
          redrawChartCanvas();
          tex.needsUpdate = true;
          if (matNow.map !== tex) {
            const prev = matNow.map;
            matNow.map = tex;
            matNow.needsUpdate = true;
            if (prev && prev !== tex) prev.dispose();
          }
          return;
        }
        try {
          const imgTex = await this.loadBillboardTexture(url);
          if (gen !== this.billboardSyncGen) {
            imgTex.dispose();
            return;
          }
          if (this.billboardRoots.get(b.id) !== root) {
            imgTex.dispose();
            return;
          }
          showUnavailableOnCanvas = false;
          const prev = matNow.map;
          matNow.map = imgTex;
          matNow.needsUpdate = true;
          if (prev && prev !== imgTex) prev.dispose();
        } catch {
          showUnavailableOnCanvas = true;
          ctx.fillStyle = "#0b0f14";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = "#787878";
          ctx.font = `500 20px ${NIM_BILLBOARD_CHART_FONT}`;
          ctx.textAlign = "center";
          ctx.fillText(
            "Chart unavailable",
            canvas.width / 2,
            canvas.height / 2
          );
          const remainingSec = Math.max(
            0,
            Math.ceil((nextPollAt - Date.now()) / 1000)
          );
          drawNimChartRefreshCountdown(
            ctx,
            canvas.width,
            canvas.height,
            remainingSec
          );
          tex.needsUpdate = true;
          const prev = matNow.map;
          matNow.map = tex;
          matNow.needsUpdate = true;
          if (prev && prev !== tex) prev.dispose();
        }
      }
    };

    void paint();
    redrawChartCanvas();
    const pollKey = `chartPoll:${b.id}`;
    const tickKey = `chartTick:${b.id}`;
    const pollTimer = window.setInterval(() => {
      nextPollAt = Date.now() + POLL_MS;
      schedulePaint();
    }, POLL_MS);
    this.billboardTimers.set(pollKey, pollTimer);
    const tickTimer = window.setInterval(() => scheduleRedrawChartCanvas(), 1000);
    this.billboardTimers.set(tickKey, tickTimer);
    if (rangeCycleOn) {
      const cycleKey = `chartCycle:${b.id}`;
      const cycleTimer = window.setInterval(() => {
        cyclePhase = (cyclePhase + 1) % CHART_CYCLE_ORDER.length;
        lastCandles = null;
        schedulePaint();
      }, cycleIntervalMs);
      this.billboardTimers.set(cycleKey, cycleTimer);
    }
  }

  private async mountOneBillboard(
    b: BillboardState,
    gen: number
  ): Promise<void> {
    const slides = b.slides?.length ? [...b.slides] : [];
    if (!slides.length) return;

    const placeholderTex = makeFallbackBillboardTexture();
    if (gen !== this.billboardSyncGen) {
      placeholderTex.dispose();
      return;
    }

    const root = createBillboardRoot(
      {
        anchorX: b.anchorX,
        anchorZ: b.anchorZ,
        orientation: b.orientation,
        yawSteps: b.yawSteps,
      },
      BLOCK_SIZE,
      placeholderTex
    );
    root.userData["billboardId"] = b.id;
    const planeMesh = root.userData["billboardMesh"] as THREE.Mesh | undefined;
    if (planeMesh) {
      planeMesh.userData["billboardId"] = b.id;
    }
    this.scene.add(root);
    root.updateMatrixWorld(true);
    this.billboardRoots.set(b.id, root);

    if (
      b.liveChart?.range === "24h" || b.liveChart?.range === "7d"
    ) {
      this.mountBillboardLiveChart(root, b, gen);
      return;
    }

    try {
      const ph0 = billboardSlideshowPhaseIndex(b, Date.now());
      const tex = await this.loadBillboardTexture(slides[ph0]!);
      if (gen !== this.billboardSyncGen) {
        tex.dispose();
        return;
      }
      const mat = root.userData["billboardMat"] as
        | THREE.MeshBasicMaterial
        | undefined;
      if (
        !mat ||
        root.userData["billboardId"] !== b.id ||
        this.billboardRoots.get(b.id) !== root
      ) {
        tex.dispose();
        return;
      }
      const old = mat.map;
      mat.map = tex;
      mat.needsUpdate = true;
      if (old && old !== tex) old.dispose();
    } catch {
      /* keep black placeholder */
    }

    if (gen !== this.billboardSyncGen || this.billboardRoots.get(b.id) !== root) {
      return;
    }

    if (slides.length >= 2 && b.intervalMs >= 1000) {
      let lastPhase = billboardSlideshowPhaseIndex(b, Date.now());
      const pollMs = Math.min(250, Math.max(80, Math.floor(b.intervalMs / 8)));
      const timer = window.setInterval(() => {
        void (async () => {
          if (gen !== this.billboardSyncGen) return;
          const ph = billboardSlideshowPhaseIndex(b, Date.now());
          if (ph === lastPhase) return;
          lastPhase = ph;
          const nextUrl = slides[ph]!;
          try {
            const nextTex = await this.loadBillboardTexture(nextUrl);
            if (gen !== this.billboardSyncGen) {
              nextTex.dispose();
              return;
            }
            const mat = root.userData["billboardMat"] as
              | THREE.MeshBasicMaterial
              | undefined;
            if (!mat || root.userData["billboardId"] !== b.id) {
              nextTex.dispose();
              return;
            }
            if (billboardSlideshowPhaseIndex(b, Date.now()) !== ph) {
              nextTex.dispose();
              return;
            }
            const old = mat.map;
            mat.map = nextTex;
            mat.needsUpdate = true;
            old?.dispose();
          } catch {
            /* keep current slide */
          }
        })();
      }, pollMs);
      this.billboardTimers.set(b.id, timer);
    }
  }

  private async syncCanvasIdenticonForTile(x: number, z: number, address: string): Promise<void> {
    const k = tileKey(x, z);
    
    
    // Remove old mesh if it exists and dispose all resources
    const oldMesh = this.canvasIdenticonMeshes.get(k);
    if (oldMesh) {
      this.scene.remove(oldMesh);
      oldMesh.geometry.dispose();
      if (oldMesh.material instanceof THREE.Material) {
        // Dispose texture if it exists
        if (oldMesh.material.map) {
          oldMesh.material.map.dispose();
        }
        oldMesh.material.dispose();
      }
      this.canvasIdenticonMeshes.delete(k);
    }

    // Load and create new identicon mesh
    try {
      const { loadIdenticonTexture } = await import("./identiconTexture.js");
      const texture = await loadIdenticonTexture(address);
      
      const size = 0.9;
      const geo = new THREE.PlaneGeometry(size, size);
      const mat = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, 0.02, z);
      this.scene.add(mesh);
      this.canvasIdenticonMeshes.set(k, mesh);
    } catch (err) {
      console.error(`[canvas] Failed to load identicon for ${address}:`, err);
    }
  }

  private syncCanvasIdenticonMeshes(): void {
    // Clear existing meshes
    this.clearCanvasIdenticons();

    // Create meshes for all claims
    for (const [k, address] of this.canvasClaims) {
      const [x, z] = k.split(",").map(Number);
      if (x !== undefined && z !== undefined) {
        void this.syncCanvasIdenticonForTile(x, z, address);
      }
    }
  }

  /** Async version that waits for all identicons to load */
  private async syncCanvasIdenticonMeshesAsync(): Promise<void> {
    // Clear existing meshes
    this.clearCanvasIdenticons();

    // Create meshes for all claims and wait for them
    const promises: Promise<void>[] = [];
    for (const [k, address] of this.canvasClaims) {
      const [x, z] = k.split(",").map(Number);
      if (x !== undefined && z !== undefined) {
        promises.push(this.syncCanvasIdenticonForTile(x, z, address));
      }
    }
    
    await Promise.all(promises);
  }

  private clearCanvasIdenticons(): void {
    for (const [, mesh] of this.canvasIdenticonMeshes) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      if (mesh.material instanceof THREE.Material) {
        // Dispose texture if it exists
        if (mesh.material.map) {
          mesh.material.map.dispose();
        }
        mesh.material.dispose();
      }
    }
    this.canvasIdenticonMeshes.clear();
  }

  /** Wire format matches server obstacle tiles. */
  setObstacles(
    tiles: readonly {
      x: number;
      z: number;
      y?: number;
      passable: boolean;
      half?: boolean;
      quarter?: boolean;
      hex?: boolean;
      pyramid?: boolean;
      pyramidBaseScale?: number;
      sphere?: boolean;
      ramp?: boolean;
      rampDir?: number;
      colorId?: number;
      locked?: boolean;
      claimable?: boolean;
      active?: boolean;
      cooldownMs?: number;
      lastClaimedAt?: number;
      claimedBy?: string;
      teleporter?:
        | { pending: true }
        | {
            targetRoomId: string;
            targetX: number;
            targetZ: number;
            targetRoomDisplayName?: string;
          };
      gate?: {
        adminAddress: string;
        authorizedAddresses: string[];
        exitX: number;
        exitZ: number;
      };
      gateOpen?: { openedBy: string; untilMs: number };
    }[]
  ): void {
    this.placedObjects.clear();
    this.blockingTileKeys.clear();
    for (const t of tiles) {
      const y = Math.max(0, Math.min(2, Math.floor(t.y ?? 0)));
      const k = blockKey(t.x, t.z, y);
      const quarter = Boolean(t.quarter);
      const half = quarter ? false : Boolean(t.half);
      const ramp = Boolean(t.ramp);
      const rampDir = Math.max(0, Math.min(3, Math.floor(t.rampDir ?? 0)));
      const prism = normalizeBlockPrismParts({
        hex: Boolean(t.hex),
        pyramid: Boolean(t.pyramid),
        sphere: Boolean(t.sphere),
        ramp,
      });
      const pyramidBaseScale = prism.pyramid
        ? clampPyramidBaseScale(Number(t.pyramidBaseScale ?? 1))
        : 1;
      const colorId = Math.max(
        0,
        Math.min(BLOCK_COLOR_COUNT - 1, Math.floor(t.colorId ?? 0))
      );
      const locked = Boolean(t.locked);
      this.placedObjects.set(k, {
        passable: t.passable,
        half,
        quarter,
        hex: prism.hex,
        pyramid: prism.pyramid,
        pyramidBaseScale,
        sphere: prism.sphere,
        ramp: prism.ramp,
        rampDir: prism.ramp ? rampDir : 0,
        colorId,
        locked,
        claimable: t.claimable,
        active: t.active,
        cooldownMs: t.cooldownMs,
        lastClaimedAt: t.lastClaimedAt,
        claimedBy: t.claimedBy,
        teleporter: t.teleporter,
        gate: t.gate,
        gateOpen: t.gateOpen,
      });
      if (y === 0 && !t.passable && !prism.ramp) {
        this.blockingTileKeys.add(tileKey(t.x, t.z));
      }
    }
    this.syncBlockMeshes();
    this.refreshPathLine();
    this.refreshSelectionOutline();
    this.syncPlacementRangeHints();
    this.markSceneMutation(`setObstacles:${tiles.length}`);
  }

  /**
   * Incremental obstacles update (server-synced).
   * Removes by key first, then applies `add` as replacements.
   */
  applyObstaclesDelta(
    add: readonly {
      x: number;
      z: number;
      y?: number;
      passable: boolean;
      half?: boolean;
      quarter?: boolean;
      hex?: boolean;
      pyramid?: boolean;
      pyramidBaseScale?: number;
      sphere?: boolean;
      ramp?: boolean;
      rampDir?: number;
      colorId?: number;
      locked?: boolean;
      claimable?: boolean;
      active?: boolean;
      cooldownMs?: number;
      lastClaimedAt?: number;
      claimedBy?: string;
      teleporter?:
        | { pending: true }
        | {
            targetRoomId: string;
            targetX: number;
            targetZ: number;
            targetRoomDisplayName?: string;
          };
      gate?: {
        adminAddress: string;
        authorizedAddresses: string[];
        exitX: number;
        exitZ: number;
      };
      gateOpen?: { openedBy: string; untilMs: number };
    }[],
    remove: readonly string[]
  ): void {
    // Remove tiles first so that replacements don't leave stale blocking keys.
    for (const k of remove) {
      const existing = this.placedObjects.get(k);
      if (!existing) continue;
      if (!existing.passable && !existing.ramp) {
        const [rx, rz, ryRaw] = k.split(",").map(Number);
        const ry = Number.isFinite(ryRaw) ? Math.floor(ryRaw ?? 0) : 0;
        if (ry === 0) this.blockingTileKeys.delete(tileKey(rx!, rz!));
      }
      this.placedObjects.delete(k);
    }

    for (const t of add) {
      const y = Math.max(0, Math.min(2, Math.floor(t.y ?? 0)));
      const k = blockKey(t.x, t.z, y);

      // Clear prior blocking key (if any) before writing the new meta.
      const prev = this.placedObjects.get(k);
      if (prev && !prev.passable && !prev.ramp) {
        const [px, pz, pyRaw] = k.split(",").map(Number);
        const py = Number.isFinite(pyRaw) ? Math.floor(pyRaw ?? 0) : 0;
        if (py === 0) this.blockingTileKeys.delete(tileKey(px!, pz!));
      }

      const quarter = Boolean(t.quarter);
      const half = quarter ? false : Boolean(t.half);
      const ramp = Boolean(t.ramp);
      const rampDir = Math.max(0, Math.min(3, Math.floor(t.rampDir ?? 0)));
      const prism = normalizeBlockPrismParts({
        hex: Boolean(t.hex),
        pyramid: Boolean(t.pyramid),
        sphere: Boolean(t.sphere),
        ramp,
      });
      const pyramidBaseScale = prism.pyramid
        ? clampPyramidBaseScale(Number(t.pyramidBaseScale ?? 1))
        : 1;
      const colorId = Math.max(
        0,
        Math.min(BLOCK_COLOR_COUNT - 1, Math.floor(t.colorId ?? 0))
      );
      const locked = Boolean(t.locked);

      this.placedObjects.set(k, {
        passable: t.passable,
        half,
        quarter,
        hex: prism.hex,
        pyramid: prism.pyramid,
        pyramidBaseScale,
        sphere: prism.sphere,
        ramp: prism.ramp,
        rampDir: prism.ramp ? rampDir : 0,
        colorId,
        locked,
        claimable: t.claimable,
        active: t.active,
        cooldownMs: t.cooldownMs,
        lastClaimedAt: t.lastClaimedAt,
        claimedBy: t.claimedBy,
        teleporter: t.teleporter,
        gate: t.gate,
        gateOpen: t.gateOpen,
      });

      if (y === 0 && !t.passable && !prism.ramp) {
        this.blockingTileKeys.add(tileKey(t.x, t.z));
      }
    }

    this.syncBlockMeshes();
    this.refreshPathLine();
    this.syncPlacementRangeHints();
    this.markSceneMutation(`applyObstaclesDelta:add${add.length}:remove${remove.length}`);
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
        const k = tileKey(tx, tz);
        if (this.doorTileKeys.has(k)) continue;
        if (
          !floorWalkableTerrain(
            tx,
            tz,
            this.placedObjects,
            this.extraFloorKeys,
            this.roomId,
            this.removedBaseFloorKeys.size > 0 ? this.removedBaseFloorKeys : undefined
          )
        ) {
          continue;
        }
        if (this.nextOpenLevelAt(tx, tz) === null) continue;
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
    return isWalkableTile(
      ft.x,
      ft.y,
      this.extraFloorKeys,
      this.roomId,
      this.removedBaseFloorKeys.size > 0 ? this.removedBaseFloorKeys : undefined
    );
  }

  /** Hub center safe zone: no new blocks or reposition targets. */
  private hubNoBuildTile(x: number, z: number): boolean {
    return (
      normalizeRoomId(this.roomId) === HUB_ROOM_ID && isHubSpawnSafeZone(x, z)
    );
  }

  private hasAnyBlockAtTile(x: number, z: number): boolean {
    const prefix = `${x},${z},`;
    for (const k of this.placedObjects.keys()) {
      if (k.startsWith(prefix)) return true;
    }
    return false;
  }

  private nextOpenLevelAt(x: number, z: number): number | null {
    const used = new Set<number>();
    const prefix = `${x},${z},`;
    for (const k of this.placedObjects.keys()) {
      if (!k.startsWith(prefix)) continue;
      const parts = k.split(",").map(Number);
      const y = Number.isFinite(parts[2]) ? Math.floor(parts[2]!) : 0;
      used.add(y);
    }
    for (let y = 0; y <= 2; y++) {
      if (!used.has(y)) return y;
    }
    return null;
  }

  getNextOpenStackLevelAt(x: number, z: number): number | null {
    return this.nextOpenLevelAt(x, z);
  }

  private placementPreviewMetaForNewBlock(): BlockStyleProps {
    return {
      passable: false,
      half: this.placementHalf,
      quarter: this.placementQuarter,
      hex: this.placementHex,
      pyramid: this.placementPyramid,
      pyramidBaseScale: this.placementPyramid
        ? this.placementPyramidBaseScale
        : 1,
      sphere: this.placementSphere,
      ramp: this.placementRamp,
      rampDir: this.placementRampDir,
      colorId: this.placementColorId,
      claimable: this.placementClaimable || undefined,
      active: this.placementClaimable ? true : undefined,
    };
  }

  private placementPreviewStyleSignature(meta: BlockStyleProps): string {
    return `${meta.half}|${meta.quarter}|${meta.hex}|${meta.pyramid}|${meta.pyramidBaseScale ?? 1}|${meta.sphere}|${meta.ramp}|${meta.rampDir}|${meta.colorId}|${Boolean(meta.claimable)}|${this.blockVisualScale}`;
  }

  /**
   * Empty floor tile where `placeBlockHandler` would accept a new block (same checks as
   * pointerdown), excluding clicks on existing block meshes.
   */
  private tryFloorBlockPlacementTile(
    clientX: number,
    clientY: number
  ): { x: number; z: number } | null {
    if (!this.selfMesh || !this.placeBlockHandler) return null;
    if (this.teleporterDestPickHandler) return null;
    if (this.repositionFrom) return null;
    if (this.billboardPlacementPreview) return null;
    if (this.pickBlockKey(clientX, clientY)) return null;
    const dest = this.pickFloor(clientX, clientY);
    if (!dest || !this.tileWalkable(dest)) return null;
    const here = snapFloorTile(this.selfMesh.position.x, this.selfMesh.position.z);
    const dx = here.x - dest.x;
    const dz = here.y - dest.y;
    if (Math.hypot(dx, dz) > this.placeRadiusBlocks + 1e-6) return null;
    if (this.nextOpenLevelAt(dest.x, dest.y) === null) return null;
    if (this.hubNoBuildTile(dest.x, dest.y)) return null;
    if (here.x === dest.x && here.y === dest.y) return null;
    return { x: dest.x, z: dest.y };
  }

  /**
   * Anchor tile for billboard placement (same radius / walk / hub checks as block place,
   * plus full footprint validity). Used when billboard tool preview is active.
   */
  private tryBillboardAnchorPlacementTile(
    clientX: number,
    clientY: number
  ): { x: number; z: number } | null {
    if (!this.selfMesh || !this.placeBlockHandler) return null;
    if (!this.billboardPlacementPreview) return null;
    if (this.teleporterDestPickHandler || this.repositionFrom) return null;
    if (this.pickBlockKey(clientX, clientY)) return null;
    const dest = this.pickFloor(clientX, clientY);
    if (!dest || !this.tileWalkable(dest)) return null;
    const here = snapFloorTile(this.selfMesh.position.x, this.selfMesh.position.z);
    const dx = here.x - dest.x;
    const dz = here.y - dest.y;
    if (Math.hypot(dx, dz) > this.placeRadiusBlocks + 1e-6) return null;
    if (this.hubNoBuildTile(dest.x, dest.y)) return null;
    if (here.x === dest.x && here.y === dest.y) return null;
    const orient = this.billboardPlacementDraft.orientation;
    const yaw = 0;
    if (!this.isBillboardFootprintFreeForPlace(dest.x, dest.y, orient, yaw)) {
      return null;
    }
    return { x: dest.x, z: dest.y };
  }

  private tryBuildPlacementFloorTile(
    clientX: number,
    clientY: number
  ): { x: number; z: number } | null {
    if (this.billboardPlacementPreview) {
      return this.tryBillboardAnchorPlacementTile(clientX, clientY);
    }
    return this.tryFloorBlockPlacementTile(clientX, clientY);
  }

  private clearPendingBuildPlace(): void {
    if (!this.pendingBuildPlace) return;
    const id = this.pendingBuildPlace.pointerId;
    this.pendingBuildPlace = null;
    try {
      const el = this.renderer.domElement;
      if (el.hasPointerCapture?.(id)) {
        el.releasePointerCapture(id);
      }
    } catch {
      /* ignore */
    }
    this.clearPlacementPreview();
  }

  private clearPlacementPreview(): void {
    this.placementPreviewAnchor = null;
    this.placementPreviewStyleSig = "";
    if (this.placementPreviewGroup) {
      this.scene.remove(this.placementPreviewGroup);
      this.placementPreviewGroup.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
      });
      this.placementPreviewGroup = null;
    }
    this.clearGateNeighborFloorHints();
    this.clearRepositionGateGhost();
    this.clearRepositionObstacleGhost();
  }

  /** Build bar gate tool: show exit/front neighbor tint while hovering a valid anchor tile. */
  setGateFloorHintsActive(on: boolean): void {
    this.gateFloorHintsActive = on;
    if (!on) {
      this.clearGateNeighborFloorHints();
    }
  }

  private clearGateNeighborFloorHints(): void {
    if (this.gateNeighborExitHint) {
      this.gateNeighborExitHint.visible = false;
    }
    if (this.gateNeighborFrontHint) {
      this.gateNeighborFrontHint.visible = false;
    }
  }

  private clearRepositionGateGhost(): void {
    if (!this.repositionGateGhostGroup) {
      this.repositionGateGhostSig = "";
      return;
    }
    this.scene.remove(this.repositionGateGhostGroup);
    this.repositionGateGhostGroup.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    });
    this.repositionGateGhostGroup = null;
    this.repositionGateGhostSig = "";
  }

  private clearRepositionObstacleGhost(): void {
    if (!this.repositionObstacleGhostGroup) {
      this.repositionObstacleGhostSig = "";
      return;
    }
    this.scene.remove(this.repositionObstacleGhostGroup);
    this.repositionObstacleGhostGroup.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    });
    this.repositionObstacleGhostGroup = null;
    this.repositionObstacleGhostSig = "";
  }

  /**
   * Gate move preview: exit/front at hover follow live panel edits (opening rotation) and anchor delta.
   */
  private resolveGateRepositionPreviewAtHover(hover: {
    x: number;
    z: number;
  }): { gx: number; gz: number; ex: number; ez: number } | null {
    const h = this.repositionGateHint;
    if (!h) return null;
    const g = this.inspectorSelectionObstacle?.gate;
    const baseEx = g?.exitX ?? h.exitX;
    const baseEz = g?.exitZ ?? h.exitZ;
    return {
      gx: hover.x,
      gz: hover.z,
      ex: baseEx + (hover.x - h.fromX),
      ez: baseEz + (hover.z - h.fromZ),
    };
  }

  private syncRepositionGateGhost(
    hoverGx: number,
    hoverGz: number,
    p: { gx: number; gz: number; ex: number; ez: number }
  ): void {
    const hint = this.repositionGateHint;
    if (!hint) {
      this.clearRepositionGateGhost();
      return;
    }
    const ins = this.inspectorSelectionObstacle;
    const colorId = ins?.colorId ?? hint.colorId;
    const quarter = ins?.quarter ?? hint.quarter;
    const half = ins?.half ?? hint.half;
    const rampDir = ins?.rampDir ?? hint.rampDir;
    const admin = ins?.gate?.adminAddress ?? hint.adminAddress;
    const auth = ins?.gate?.authorizedAddresses ?? hint.authorizedAddresses;
    const meta: BlockStyleProps = {
      passable: false,
      quarter,
      half,
      hex: false,
      pyramid: false,
      pyramidBaseScale: 1,
      sphere: false,
      ramp: false,
      rampDir: rampDir & 3,
      colorId,
      gate: {
        adminAddress: admin,
        authorizedAddresses: [...auth],
        exitX: p.ex,
        exitZ: p.ez,
      },
    };
    const sig = `${hoverGx}|${hoverGz}|${p.ex}|${p.ez}|${colorId}|${quarter}|${half}|${rampDir & 3}|${admin}|${auth.join(",")}`;
    const hVis = this.obstacleHeight(meta);
    const vis = this.blockVisualScale;
    const yWorld = hint.fromYLevel * BLOCK_SIZE + (hVis * vis) / 2;
    if (this.repositionGateGhostSig === sig && this.repositionGateGhostGroup) {
      this.repositionGateGhostGroup.position.set(hoverGx, yWorld, hoverGz);
      return;
    }
    this.clearRepositionGateGhost();
    this.repositionGateGhostSig = sig;
    this.repositionGateGhostGroup = this.makeBlockMesh(meta, {
      ghost: true,
      tileX: hoverGx,
      tileZ: hoverGz,
    });
    this.repositionGateGhostGroup.position.set(hoverGx, yWorld, hoverGz);
    this.scene.add(this.repositionGateGhostGroup);
  }

  private syncRepositionObstacleGhost(
    hoverGx: number,
    hoverGz: number,
    meta: BlockStyleProps
  ): void {
    const yLevel = this.nextOpenLevelAt(hoverGx, hoverGz);
    if (yLevel === null) {
      this.clearRepositionObstacleGhost();
      return;
    }
    const hVis = this.obstacleHeight(meta);
    const vis = this.blockVisualScale;
    const yWorld = yLevel * BLOCK_SIZE + (hVis * vis) / 2;
    const styleSig = this.placementPreviewStyleSignature(meta);
    const sig = `${hoverGx}|${hoverGz}|${yLevel}|${styleSig}`;
    if (
      this.repositionObstacleGhostSig === sig &&
      this.repositionObstacleGhostGroup
    ) {
      this.repositionObstacleGhostGroup.position.set(hoverGx, yWorld, hoverGz);
      return;
    }
    this.clearRepositionObstacleGhost();
    this.repositionObstacleGhostSig = sig;
    this.repositionObstacleGhostGroup = this.makeBlockMesh(meta, {
      ghost: true,
      tileX: hoverGx,
      tileZ: hoverGz,
    });
    this.repositionObstacleGhostGroup.position.set(hoverGx, yWorld, hoverGz);
    this.scene.add(this.repositionObstacleGhostGroup);
  }

  private ensureGateNeighborHintMeshes(): void {
    if (this.gateNeighborExitHint && this.gateNeighborFrontHint) {
      return;
    }
    const mk = (): THREE.Mesh => {
      const m = new THREE.Mesh(this.placementHintGeom, this.gateNeighborBadMat);
      m.rotation.x = -Math.PI / 2;
      m.renderOrder = 2;
      m.visible = false;
      this.scene.add(m);
      return m;
    };
    this.gateNeighborExitHint = mk();
    this.gateNeighborFrontHint = mk();
  }

  private playerOccupiesFloorTile(tx: number, tz: number): boolean {
    if (this.selfMesh) {
      const t = snapFloorTile(this.selfMesh.position.x, this.selfMesh.position.z);
      if (t.x === tx && t.y === tz) return true;
    }
    for (const g of this.others.values()) {
      const t = snapFloorTile(g.position.x, g.position.z);
      if (t.x === tx && t.y === tz) return true;
    }
    return false;
  }

  /**
   * Exit/front gate hint: local player may stand on that tile while aiming; only **other**
   * avatars count as blocking (matches server gate neighbor rules).
   */
  private gateNeighborExitFrontTileBlockedByOthers(tx: number, tz: number): boolean {
    for (const g of this.others.values()) {
      const t = snapFloorTile(g.position.x, g.position.z);
      if (t.x === tx && t.y === tz) return true;
    }
    return false;
  }

  private syncGateNeighborFloorHints(p: {
    gx: number;
    gz: number;
    ex: number;
    ez: number;
  }): void {
    this.ensureGateNeighborHintMeshes();
    const frontX = p.gx * 2 - p.ex;
    const frontZ = p.gz * 2 - p.ez;
    const { exitOk, frontOk } = gatePassageNeighborHintsOk({
      roomId: this.roomId,
      gx: p.gx,
      gz: p.gz,
      ex: p.ex,
      ez: p.ez,
      placed: this.placedObjects,
      extraWalkable: this.extraFloorKeys,
      baseRemoved:
        this.removedBaseFloorKeys.size > 0 ? this.removedBaseFloorKeys : undefined,
      signboardOnGateTile: this.signboards.has(tileKey(p.gx, p.gz)),
      playerOnTile: (x, z) => {
        if (x === p.ex && z === p.ez) {
          return this.gateNeighborExitFrontTileBlockedByOthers(x, z);
        }
        if (x === frontX && z === frontZ) {
          return this.gateNeighborExitFrontTileBlockedByOthers(x, z);
        }
        return this.playerOccupiesFloorTile(x, z);
      },
    });
    const exitM = this.gateNeighborExitHint!;
    const frontM = this.gateNeighborFrontHint!;
    exitM.position.set(p.ex, 0.024, p.ez);
    frontM.position.set(frontX, 0.024, frontZ);
    exitM.material = exitOk ? this.gateNeighborOkMat : this.gateNeighborBadMat;
    frontM.material = frontOk ? this.gateNeighborOkMat : this.gateNeighborBadMat;
    exitM.visible = true;
    frontM.visible = true;
  }

  /** Same validity as a generic obstacle move click (empty destination column, radius, hub). */
  private tryGenericObstacleMoveHoverTile(
    clientX: number,
    clientY: number
  ): { x: number; z: number } | null {
    if (
      !this.selfMesh ||
      !this.repositionFrom ||
      this.repositionBillboardId ||
      this.repositionGateHint
    ) {
      return null;
    }
    const dest = this.pickFloor(clientX, clientY);
    if (!dest || !this.tileWalkable(dest)) return null;
    if (this.hubNoBuildTile(dest.x, dest.y)) return null;
    const here = snapFloorTile(this.selfMesh.position.x, this.selfMesh.position.z);
    if (Math.hypot(here.x - dest.x, here.y - dest.y) > this.placeRadiusBlocks + 1e-6) {
      return null;
    }
    if (here.x === dest.x && here.y === dest.y) return null;
    if (this.hasAnyBlockAtTile(dest.x, dest.y)) return null;
    return { x: dest.x, z: dest.y };
  }

  private tryGateMoveHoverTile(
    clientX: number,
    clientY: number
  ): { x: number; z: number } | null {
    if (
      !this.selfMesh ||
      !this.repositionFrom ||
      this.repositionBillboardId ||
      !this.repositionGateHint
    ) {
      return null;
    }
    const dest = this.pickFloor(clientX, clientY);
    if (!dest || !this.tileWalkable(dest)) return null;
    const here = snapFloorTile(this.selfMesh.position.x, this.selfMesh.position.z);
    if (Math.hypot(here.x - dest.x, here.y - dest.y) > this.placeRadiusBlocks + 1e-6) {
      return null;
    }
    if (this.hubNoBuildTile(dest.x, dest.y)) return null;
    if (here.x === dest.x && here.y === dest.y) return null;
    if (this.hasAnyBlockAtTile(dest.x, dest.y)) return null;
    return { x: dest.x, z: dest.y };
  }

  private refreshGateNeighborTileHints(
    clientX: number,
    clientY: number,
    placeTile: { x: number; z: number } | null
  ): void {
    const dirs: readonly [number, number][] = [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ];
    if (
      this.gateFloorHintsActive &&
      placeTile &&
      !this.repositionFrom &&
      !this.billboardPlacementPreview
    ) {
      const [dx, dz] = dirs[this.placementRampDir & 3]!;
      this.syncGateNeighborFloorHints({
        gx: placeTile.x,
        gz: placeTile.z,
        ex: placeTile.x + dx,
        ez: placeTile.z + dz,
      });
      return;
    }
    if (this.repositionGateHint && this.repositionFrom && !this.repositionBillboardId) {
      this.clearRepositionObstacleGhost();
      const hover = this.tryGateMoveHoverTile(clientX, clientY);
      if (hover) {
        const preview = this.resolveGateRepositionPreviewAtHover(hover);
        if (preview) {
          this.syncGateNeighborFloorHints(preview);
          this.syncRepositionGateGhost(hover.x, hover.z, preview);
        }
      } else {
        this.clearGateNeighborFloorHints();
        this.clearRepositionGateGhost();
      }
      return;
    }
    if (
      this.repositionFrom &&
      !this.repositionBillboardId &&
      !this.repositionGateHint &&
      this.selfMesh
    ) {
      this.clearRepositionGateGhost();
      const hover = this.tryGenericObstacleMoveHoverTile(clientX, clientY);
      const from = this.repositionFrom;
      const meta = this.placedObjects.get(
        blockKey(from.x, from.y, this.repositionSourceYLevel)
      );
      if (hover && meta) {
        this.syncRepositionObstacleGhost(hover.x, hover.z, meta);
      } else {
        this.clearRepositionObstacleGhost();
      }
      return;
    }
    this.clearGateNeighborFloorHints();
    this.clearRepositionGateGhost();
    this.clearRepositionObstacleGhost();
  }

  private syncPlacementPreviewAt(wx: number, wz: number, wyLevel: number): void {
    const meta = this.placementPreviewMetaForNewBlock();
    const sig = this.placementPreviewStyleSignature(meta);
    const h = this.obstacleHeight(meta);
    const vis = this.blockVisualScale;
    const yWorld = wyLevel * BLOCK_SIZE + (h * vis) / 2;
    if (!this.placementPreviewGroup || this.placementPreviewStyleSig !== sig) {
      if (this.placementPreviewGroup) {
        this.scene.remove(this.placementPreviewGroup);
        this.placementPreviewGroup.traverse((child: THREE.Object3D) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            (child.material as THREE.Material).dispose();
          }
        });
        this.placementPreviewGroup = null;
      }
      this.placementPreviewStyleSig = sig;
      this.placementPreviewGroup = this.makeBlockMesh(meta, {
        ghost: true,
        tileX: wx,
        tileZ: wz,
      });
      this.scene.add(this.placementPreviewGroup);
    }
    this.placementPreviewAnchor = { x: wx, z: wz, y: wyLevel };
    this.placementPreviewGroup!.position.set(wx, yWorld, wz);
    this.placementPreviewGroup!.visible = true;
  }

  private topBlockAtTile(x: number, z: number): { y: number; meta: BlockStyleProps } | null {
    const prefix = `${x},${z},`;
    let bestY = -1;
    let bestMeta: BlockStyleProps | null = null;
    for (const [k, meta] of this.placedObjects) {
      if (!k.startsWith(prefix)) continue;
      const parts = k.split(",").map(Number);
      const y = Number.isFinite(parts[2]) ? Math.floor(parts[2]!) : 0;
      if (y > bestY) {
        bestY = y;
        bestMeta = meta;
      }
    }
    if (bestY < 0 || !bestMeta) return null;
    return { y: bestY, meta: bestMeta };
  }

  private pickWalkableTile(
    clientX: number,
    clientY: number
  ): FloorTile | null {
    const t = this.pickFloor(clientX, clientY);
    if (!t) return null;
    return this.tileWalkable(t) ? t : null;
  }

  /**
   * @param skipRefresh Pass true when the caller will immediately call `tryExecuteWalkNavigationAt`
   * (avoids one frame with no path line between preview clear and committed goal).
   */
  private clearPendingPrimaryWalk(skipRefresh = false): void {
    const p = this.pendingPrimaryWalk;
    if (!p) return;
    this.pendingPrimaryWalk = null;
    this.pathPreviewGoal = null;
    try {
      const el = this.renderer.domElement;
      if (el.hasPointerCapture?.(p.pointerId)) {
        el.releasePointerCapture(p.pointerId);
      }
    } catch {
      /* ignore */
    }
    if (!skipRefresh) {
      this.refreshPathLine();
    }
  }

  /**
   * Resolve a deferred-walk destination from a screen point (same rules as executing a walk).
   * Claimable blocks return null (mining is pointerdown-only).
   */
  private resolveWalkNavigationGoalAt(
    clientX: number,
    clientY: number
  ): { ft: FloorTile; layer: 0 | 1 } | null {
    if (!this.selfMesh) return null;
    if (this.floorExpandMode) return null;

    if (this.buildMode) {
      const dest = this.pickFloor(clientX, clientY);
      if (!dest || !this.tileWalkable(dest)) return null;
      const here = snapFloorTile(this.selfMesh.position.x, this.selfMesh.position.z);
      const dx = here.x - dest.x;
      const dz = here.y - dest.y;
      const distance = Math.hypot(dx, dz);
      if (distance <= this.placeRadiusBlocks + 1e-6) return null;
      const k = tileKey(dest.x, dest.y);
      if (
        this.blockingTileKeys.has(k) &&
        !this.selfGatePassFloorTile(dest.x, dest.y)
      ) {
        return null;
      }
      return { ft: dest, layer: 0 };
    }

    const blockForWalk = this.pickBlockKey(clientX, clientY);
    if (blockForWalk) {
      const bm = this.placedObjects.get(blockForWalk);
      if (bm) {
        if (bm.claimable && bm.active && !bm.passable) {
          return null;
        }
        if (!bm.passable && !bm.ramp) {
          const [bx, bz] = blockForWalk.split(",").map(Number);
          return { ft: { x: bx!, y: bz! }, layer: 1 };
        }
      }
    }
    const dest = this.pickWalkableTile(clientX, clientY);
    if (!dest) return null;
    const k = tileKey(dest.x, dest.y);
    if (
      this.blockingTileKeys.has(k) &&
      !this.selfGatePassFloorTile(dest.x, dest.y)
    ) {
      return null;
    }
    return { ft: dest, layer: 0 };
  }

  /** True when this tile is a gate the local player may walk while it is open for them. */
  private selfGatePassFloorTile(tx: number, tz: number): boolean {
    const meta =
      this.placedObjects.get(blockKey(tx, tz, 0)) ??
      this.placedObjects.get(tileKey(tx, tz));
    if (!meta || !this.selfAddress) return false;
    return isGatePassableForMover(
      meta,
      this.selfAddress.replace(/\s+/g, "").toUpperCase(),
      Date.now(),
      this.roomId
    );
  }

  /** Show the route the player would take if they release at the current pick (pointerdown). */
  private previewWalkNavigationAt(clientX: number, clientY: number): void {
    if (!this.selfMesh) return;
    this.pathPreviewGoal = this.resolveWalkNavigationGoalAt(clientX, clientY);
    this.refreshPathLine();
  }

  /**
   * Run walk / path request from a screen point (typically pointerup client coords).
   * Claimable-block mining is handled separately on pointerdown.
   */
  private tryExecuteWalkNavigationAt(clientX: number, clientY: number): void {
    if (!this.selfMesh || !this.tileClickHandler) return;
    this.pathPreviewGoal = null;
    const goal = this.resolveWalkNavigationGoalAt(clientX, clientY);
    if (!goal) {
      this.refreshPathLine();
      return;
    }
    this.pathGoal = goal;
    this.refreshPathLine();
    if (goal.layer === 1) {
      this.tileClickHandler(goal.ft.x, goal.ft.y, 1);
    } else {
      this.tileClickHandler(goal.ft.x, goal.ft.y, 0);
    }
  }

  /**
   * When the player double-clicks the same gate mesh (primary, low movement), and they are
   * adjacent and within place radius, invokes {@link gateDoubleOpenHandler} and returns
   * true so the deferred walk is skipped. Otherwise returns false.
   */
  private tryGateDoubleOpenAt(clientX: number, clientY: number): boolean {
    if (this.buildMode || !this.selfMesh || !this.gateDoubleOpenHandler) {
      return false;
    }
    const blockKey = this.pickBlockKey(clientX, clientY);
    if (!blockKey) return false;
    const meta = this.placedObjects.get(blockKey);
    if (!meta?.gate) return false;
    const now = performance.now();
    const prev = this.lastGatePrimaryTap;
    const isDouble =
      prev !== null &&
      prev.key === blockKey &&
      now - prev.at <= Game.GATE_DOUBLE_TAP_MS;
    if (!isDouble) {
      this.lastGatePrimaryTap = { key: blockKey, at: now };
      return false;
    }
    this.lastGatePrimaryTap = null;
    const parts = blockKey.split(",").map(Number);
    const bx = parts[0];
    const bz = parts[1];
    if (bx === undefined || bz === undefined) return false;
    const by =
      parts.length >= 3 && Number.isFinite(parts[2])
        ? Math.max(0, Math.min(2, Math.floor(parts[2]!)))
        : 0;
    const px = this.selfMesh.position.x;
    const pz = this.selfMesh.position.z;
    if (!isOrthogonallyAdjacentToFloorTile(px, pz, bx, bz)) return false;
    const dx = px - bx;
    const dz = pz - bz;
    if (Math.hypot(dx, dz) > this.placeRadiusBlocks + 1e-6) return false;
    this.gateDoubleOpenHandler(bx, bz, by);
    return true;
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

  /** Mouse-style desktop: right-drag camera orbit (not touch / pen-primary tablets). */
  private static canUseRightDragCameraOrbit(e: PointerEvent): boolean {
    if (e.pointerType === "touch") return false;
    if (typeof window === "undefined") return false;
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
  private resolveAvatarGroupFromHit(obj: THREE.Object3D): THREE.Group | null {
    let o: THREE.Object3D | null = obj;
    while (o) {
      if (o instanceof THREE.Group) {
        const addr = o.userData["address"] as string | undefined;
        if (typeof addr === "string" && addr.length > 0) {
          return o;
        }
      }
      o = o.parent;
    }
    return null;
  }

  /**
   * Closest avatar along the pick ray (self or remote), or null.
   * NPC avatars are skipped so a human (or self) behind an NPC on the same ray still wins
   * for context menu / long-press.
   */
  private pickClosestAvatarGroupAt(
    clientX: number,
    clientY: number
  ): THREE.Group | null {
    if (!this.updateNdc(clientX, clientY)) return null;
    this.camera.updateMatrixWorld();
    this.camera.updateProjectionMatrix();
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const roots: THREE.Object3D[] = [];
    if (this.selfMesh) roots.push(this.selfMesh);
    for (const g of this.others.values()) roots.push(g);
    if (roots.length === 0) return null;
    const hits = this.raycaster.intersectObjects(roots, true);
    for (const h of hits) {
      const g = this.resolveAvatarGroupFromHit(h.object);
      if (!g) continue;
      if (g === this.selfMesh) return g;
      const address = String(g.userData.address ?? "");
      const displayName = String(g.userData.displayName ?? "");
      if (remotePlayerIsNpc(address, displayName)) continue;
      return g;
    }
    return null;
  }

  /** True if the pick ray intersects the local avatar at any depth (e.g. self behind another player). */
  private rayPickHitsSelfAvatar(clientX: number, clientY: number): boolean {
    if (!this.selfMesh) return false;
    if (!this.updateNdc(clientX, clientY)) return false;
    this.camera.updateMatrixWorld();
    this.camera.updateProjectionMatrix();
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hits = this.raycaster.intersectObjects([this.selfMesh], true);
    for (const h of hits) {
      const grp = this.resolveAvatarGroupFromHit(h.object);
      if (grp === this.selfMesh) return true;
    }
    return false;
  }

  /**
   * All distinct other human avatars hit by the pick ray (closest first), for stacked players.
   */
  private pickAllOtherHumanAvatarsAt(
    clientX: number,
    clientY: number
  ): Array<{ address: string; displayName: string }> {
    if (!this.updateNdc(clientX, clientY)) return [];
    this.camera.updateMatrixWorld();
    this.camera.updateProjectionMatrix();
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const roots: THREE.Object3D[] = [];
    for (const g of this.others.values()) roots.push(g);
    if (roots.length === 0) return [];
    const hits = this.raycaster.intersectObjects(roots, true);
    const seen = new Set<string>();
    const out: Array<{ address: string; displayName: string }> = [];
    const norm = (a: string) => a.replace(/\s+/g, "").toUpperCase();
    for (const h of hits) {
      const group = this.resolveAvatarGroupFromHit(h.object);
      if (!group || group === this.selfMesh) continue;
      const address = String(group.userData.address ?? "");
      const displayName = String(group.userData.displayName ?? "");
      if (remotePlayerIsNpc(address, displayName)) continue;
      const key = norm(address);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({ address, displayName });
    }
    return out;
  }

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
    this.requestRender(120);
    if (
      this.rightOrbitDrag &&
      e.pointerId === this.rightOrbitDrag.pointerId &&
      (e.buttons & 2) !== 0
    ) {
      const d = this.rightOrbitDrag;
      const dx = e.clientX - d.lastX;
      d.lastX = e.clientX;
      d.lastY = e.clientY;
      this.cameraOrbitYawRad += dx * Game.CAMERA_ORBIT_RAD_PER_PX;
      this.applyCameraPose();
      e.preventDefault();
      return;
    }
    this.lastPointerClientPixels.x = e.clientX;
    this.lastPointerClientPixels.y = e.clientY;
    if (e.pointerType === "touch") {
      this.touchPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    if (this.pendingPrimaryWalk && e.pointerId === this.pendingPrimaryWalk.pointerId) {
      const p = this.pendingPrimaryWalk;
      if (
        Math.hypot(e.clientX - p.startX, e.clientY - p.startY) >
        Game.PENDING_WALK_CANCEL_DRAG_PX
      ) {
        this.clearPendingPrimaryWalk();
      }
    }
    if (
      this.selfEmojiTouchSession &&
      e.pointerId === this.selfEmojiTouchSession.pointerId
    ) {
      const s = this.selfEmojiTouchSession;
      if (
        Math.hypot(e.clientX - s.startX, e.clientY - s.startY) >
        Game.SELF_EMOJI_LONGPRESS_MOVE_PX
      ) {
        clearTimeout(s.timer);
        this.selfEmojiTouchSession = null;
      }
    }
    if (
      this.otherProfileTouchSession &&
      e.pointerId === this.otherProfileTouchSession.pointerId
    ) {
      const s = this.otherProfileTouchSession;
      if (
        Math.hypot(e.clientX - s.startX, e.clientY - s.startY) >
        Game.OTHER_PROFILE_LONGPRESS_MOVE_PX
      ) {
        clearTimeout(s.timer);
        this.otherProfileTouchSession = null;
      }
    }
    if (
      this.pendingBuildPlace &&
      e.pointerId === this.pendingBuildPlace.pointerId
    ) {
      const t = this.tryBuildPlacementFloorTile(e.clientX, e.clientY);
      let placeForHints: { x: number; z: number } | null = null;
      if (t && !this.billboardPlacementPreview) {
        const yLevel = this.nextOpenLevelAt(t.x, t.z);
        if (yLevel !== null) {
          this.syncPlacementPreviewAt(t.x, t.z, yLevel);
          placeForHints = t;
        } else {
          this.clearPlacementPreview();
        }
      } else if (!t) {
        this.clearPlacementPreview();
      }
      this.refreshGateNeighborTileHints(e.clientX, e.clientY, placeForHints);
    }
    if (this.touchPointers.size >= 2) {
      if (this.zoomLocked) {
        this.pinchLastDistancePx = 0;
        this.touchTwoFingerMode = null;
        this.touchTwistPrevAngleValid = false;
        e.preventDefault();
        return;
      }
      const geom = this.twoTouchScreenGeometry();
      if (!geom || geom.dist < Game.TOUCH_TWIST_MIN_SEP_PX) {
        this.pinchLastDistancePx = 0;
        this.touchTwoFingerMode = null;
        this.touchTwistPrevAngleValid = false;
        e.preventDefault();
        return;
      }
      const d = geom.dist;
      const angle = geom.angleRad;
      const dPrev = this.pinchLastDistancePx;
      const anglePrev = this.touchTwistPrevAngleRad;
      const angleValid = this.touchTwistPrevAngleValid;

      if (dPrev > 1e-3 && angleValid) {
        const angleDelta = Game.touchAngleDeltaRad(anglePrev, angle);
        const dRel = Math.abs(d - dPrev) / Math.max(d, dPrev, 48);
        const aAbs = Math.abs(angleDelta);

        if (this.touchTwoFingerMode === null) {
          if (
            aAbs > Game.TOUCH_TWIST_COMMIT_RAD &&
            aAbs > dRel * Game.TOUCH_TWIST_VS_PINCH_RATIO
          ) {
            this.touchTwoFingerMode = "rotate";
            this.cameraOrbitEase = null;
          } else if (
            dRel > Game.TOUCH_PINCH_COMMIT_REL &&
            dRel > aAbs / Game.TOUCH_TWIST_VS_PINCH_RATIO
          ) {
            this.touchTwoFingerMode = "pinch";
            this.cameraOrbitEase = null;
          }
        }

        if (this.touchTwoFingerMode === "rotate") {
          this.cameraOrbitYawRad +=
            angleDelta * Game.TOUCH_TWIST_YAW_SCALE;
          this.applyCameraPose();
        } else if (this.touchTwoFingerMode === "pinch") {
          const next = this.frustumSize * (dPrev / d);
          this.setZoomFrustumSize(next);
        }
      }

      this.pinchLastDistancePx = d;
      this.touchTwistPrevAngleRad = angle;
      this.touchTwistPrevAngleValid = true;

      e.preventDefault();
      return;
    }

    if (!Game.canShowPointerHoverTiles()) {
      this.tileHighlight.visible = false;
      this.blockTopHighlight.visible = false;
      // Touch devices do not use hover targeting; keep any tapped signboard tooltip
      // stable instead of clearing it on every post-tap pointermove jitter.
      if (e.pointerType !== "touch") {
        this.signboardHoverHandler?.(null);
      }
      return;
    }
    if (this.floorExpandMode) {
      const t = this.pickFloor(e.clientX, e.clientY);
      if (!t) {
        this.tileHighlight.visible = false;
        this.signboardHoverHandler?.(null);
        return;
      }
      this.tileHighlight.position.set(t.x, 0.03, t.y);
      this.tileHighlight.visible = true;
      this.signboardHoverHandler?.(null);
      return;
    }
    if (this.buildMode) {
      this.blockTopHighlight.visible = false;
      const blockHit = this.pickBlockKey(e.clientX, e.clientY);
      if (blockHit) {
        this.clearPlacementPreview();
        const meta = this.placedObjects.get(blockHit);
        if (meta && !meta.passable && !meta.ramp) {
          this.clearGateNeighborFloorHints();
          const [bx, bz, byRaw] = blockHit.split(",").map(Number);
          const by = Number.isFinite(byRaw) ? Math.floor(byRaw ?? 0) : 0;
          const h = this.obstacleHeight(meta);
          this.tileHighlight.position.set(bx!, 0.02, bz!);
          this.tileHighlight.visible = true;
          this.blockTopHighlight.position.set(
            bx!,
            by * BLOCK_SIZE + h * this.blockVisualScale + 0.03,
            bz!
          );
          this.blockTopHighlight.visible = true;

          const signboard = this.signboards.get(blockHit);
          if (signboard) {
            this.signboardHoverHandler?.(signboard);
          } else {
            this.signboardHoverHandler?.(null);
          }
          return;
        }
      }
      if (this.repositionFrom && this.repositionBillboardId) {
        this.clearGateNeighborFloorHints();
        this.lastBillboardPointerClientX = e.clientX;
        this.lastBillboardPointerClientY = e.clientY;
        this.syncBillboardRepositionPreviews(e.clientX, e.clientY);
        this.signboardHoverHandler?.(null);
        return;
      }
      if (this.billboardPlacementPreview) {
        this.clearGateNeighborFloorHints();
        this.lastBillboardPointerClientX = e.clientX;
        this.lastBillboardPointerClientY = e.clientY;
        this.syncBillboardPlacementPreviews(e.clientX, e.clientY);
        this.signboardHoverHandler?.(null);
        return;
      }
      const placeTile = this.tryFloorBlockPlacementTile(e.clientX, e.clientY);
      if (placeTile) {
        const yLevel = this.nextOpenLevelAt(placeTile.x, placeTile.z);
        if (yLevel !== null) {
          this.syncPlacementPreviewAt(placeTile.x, placeTile.z, yLevel);
          this.tileHighlight.position.set(placeTile.x, 0.02, placeTile.z);
          this.tileHighlight.visible = true;
        } else {
          this.clearPlacementPreview();
          this.tileHighlight.visible = false;
        }
      } else {
        this.clearPlacementPreview();
        this.tileHighlight.visible = false;
      }
      this.refreshGateNeighborTileHints(e.clientX, e.clientY, placeTile);
      this.signboardHoverHandler?.(null);
      return;
    }

    const blockHit = this.pickBlockKey(e.clientX, e.clientY);
    if (blockHit) {
      const meta = this.placedObjects.get(blockHit);
      if (meta && !meta.passable && !meta.ramp) {
        const [bx, bz, byRaw] = blockHit.split(",").map(Number);
        const by = Number.isFinite(byRaw) ? Math.floor(byRaw ?? 0) : 0;
        const h = this.obstacleHeight(meta);
        this.tileHighlight.position.set(bx!, 0.02, bz!);
        this.tileHighlight.visible = true;
        this.blockTopHighlight.position.set(
          bx!,
          by * BLOCK_SIZE + h * this.blockVisualScale + 0.03,
          bz!
        );
        this.blockTopHighlight.visible = true;

        const signboard = this.signboards.get(blockHit);
        if (signboard) {
          this.signboardHoverHandler?.(signboard);
        } else {
          this.signboardHoverHandler?.(null);
        }
        return;
      }
    }
    this.blockTopHighlight.visible = false;
    const p = this.pickWalkableTile(e.clientX, e.clientY);
    if (!p) {
      this.tileHighlight.visible = false;
      this.signboardHoverHandler?.(null);
      return;
    }
    
    // Check if hovering over a signboard floor tile
    const k = tileKey(p.x, p.y);
    const signboard = this.signboards.get(k);
    if (signboard) {
      this.signboardHoverHandler?.(signboard);
    } else {
      this.signboardHoverHandler?.(null);
    }
    
    this.tileHighlight.position.set(p.x, 0.02, p.y);
    this.tileHighlight.visible = true;
  };

  private onPointerDown = (e: PointerEvent): void => {
    this.requestRender(250);
    if (e.button === 2 && Game.canUseRightDragCameraOrbit(e)) {
      this.suppressAvatarContextMenuFromRightOrbit = false;
      this.cameraOrbitEase = null;
      this.rightOrbitDrag = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
      };
      try {
        this.renderer.domElement.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      this.renderer.domElement.style.cursor = "grabbing";
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (e.button !== 0) return;
    if (e.pointerType === "touch") {
      this.touchPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.touchPointers.size >= 2) {
        this.clearPendingPrimaryWalk();
        this.clearPendingBuildPlace();
        this.clearSelfEmojiTouchSession();
        this.clearOtherProfileTouchSession();
        this.pinchLastDistancePx = 0;
        this.touchTwoFingerMode = null;
        this.touchTwistPrevAngleValid = false;
        this.cameraOrbitEase = null;
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }
    if (!this.selfMesh) return;

    if (
      e.pointerType === "touch" &&
      !this.teleporterDestPickHandler &&
      !this.repositionFrom
    ) {
      const avatar = this.pickClosestAvatarGroupAt(e.clientX, e.clientY);
      if (avatar === this.selfMesh) {
        this.clearOtherProfileTouchSession();
        const others = this.pickAllOtherHumanAvatarsAt(e.clientX, e.clientY);
        if (others.length > 0 && this.otherPlayerContextOpener) {
          const pointerId = e.pointerId;
          const startX = e.clientX;
          const startY = e.clientY;
          const emoteRowFirst =
            !!this.selfQuickEmojiOpener &&
            this.rayPickHitsSelfAvatar(startX, startY);
          const timer = setTimeout(() => {
            if (
              !this.otherProfileTouchSession ||
              this.otherProfileTouchSession.pointerId !== pointerId
            ) {
              return;
            }
            clearTimeout(this.otherProfileTouchSession.timer);
            this.otherProfileTouchSession = null;
            this.otherPlayerContextOpener?.({
              targets: others,
              clientX: startX,
              clientY: startY,
              emoteRowFirst,
            });
          }, Game.OTHER_PROFILE_LONGPRESS_MS);
          this.otherProfileTouchSession = {
            pointerId,
            startX,
            startY,
            timer,
            targets: others,
            emoteRowFirst,
          };
          e.preventDefault();
          e.stopPropagation();
          this.tileHighlight.visible = false;
          this.blockTopHighlight.visible = false;
          return;
        }
        if (this.selfQuickEmojiOpener) {
          const pointerId = e.pointerId;
          const startX = e.clientX;
          const startY = e.clientY;
          const timer = setTimeout(() => {
            if (
              !this.selfEmojiTouchSession ||
              this.selfEmojiTouchSession.pointerId !== pointerId
            ) {
              return;
            }
            clearTimeout(this.selfEmojiTouchSession.timer);
            this.selfEmojiTouchSession = null;
            this.selfQuickEmojiOpener?.();
          }, Game.SELF_EMOJI_LONGPRESS_MS);
          this.selfEmojiTouchSession = { pointerId, startX, startY, timer };
          e.preventDefault();
          e.stopPropagation();
          this.tileHighlight.visible = false;
          this.blockTopHighlight.visible = false;
          return;
        }
      }
      if (
        avatar &&
        avatar !== this.selfMesh &&
        this.otherPlayerContextOpener
      ) {
        const address = String(avatar.userData.address ?? "");
        const displayName = String(avatar.userData.displayName ?? "");
        if (!remotePlayerIsNpc(address, displayName)) {
          const targets = this.pickAllOtherHumanAvatarsAt(
            e.clientX,
            e.clientY
          );
          if (targets.length > 0) {
            this.clearSelfEmojiTouchSession();
            const pointerId = e.pointerId;
            const startX = e.clientX;
            const startY = e.clientY;
            const emoteRowFirst =
              !!this.selfQuickEmojiOpener &&
              this.rayPickHitsSelfAvatar(startX, startY);
            const timer = setTimeout(() => {
              if (
                !this.otherProfileTouchSession ||
                this.otherProfileTouchSession.pointerId !== pointerId
              ) {
                return;
              }
              clearTimeout(this.otherProfileTouchSession.timer);
              this.otherProfileTouchSession = null;
              this.otherPlayerContextOpener?.({
                targets,
                clientX: startX,
                clientY: startY,
                emoteRowFirst,
              });
            }, Game.OTHER_PROFILE_LONGPRESS_MS);
            this.otherProfileTouchSession = {
              pointerId,
              startX,
              startY,
              timer,
              targets,
              emoteRowFirst,
            };
            e.preventDefault();
            e.stopPropagation();
            this.tileHighlight.visible = false;
            this.blockTopHighlight.visible = false;
            return;
          }
        }
      }
    }

    e.preventDefault();
    e.stopPropagation();
    if (e.pointerType === "touch") {
      this.tileHighlight.visible = false;
      this.blockTopHighlight.visible = false;
    }

    // Check for signboard interaction first (especially important for mobile)
    if (!this.buildMode && !this.floorExpandMode) {
      let signboardClicked = false;
      
      // Check if clicking on a signboard block
      const blockHit = this.pickBlockKey(e.clientX, e.clientY);
      if (blockHit) {
        const signboard = this.signboards.get(blockHit);
        if (signboard) {
          // Show signboard message
          this.signboardHoverHandler?.(signboard);
          signboardClicked = true;
        }
      }
      
      // Check if clicking on a signboard floor tile
      if (!signboardClicked) {
        const floorTile = this.pickFloor(e.clientX, e.clientY);
        if (floorTile) {
          const k = tileKey(floorTile.x, floorTile.y);
          const signboard = this.signboards.get(k);
          if (signboard) {
            // Show signboard message
            this.signboardHoverHandler?.(signboard);
            signboardClicked = true;
          }
        }
      }
      
      // If a signboard was clicked, don't proceed with movement
      if (signboardClicked) {
        return;
      }
      
      // If tapping elsewhere and not on a signboard, dismiss any open tooltip
      if (e.pointerType === "touch") {
        this.signboardHoverHandler?.(null);
      }
    }

    if (this.floorExpandMode) {
      const dest = this.pickFloor(e.clientX, e.clientY);
      if (!dest) return;
      if (this.roomEntrySpawnPickHandler) {
        if (!this.tileWalkable(dest)) return;
        const fn = this.roomEntrySpawnPickHandler;
        this.roomEntrySpawnPickHandler = null;
        fn(dest.x, dest.y);
        return;
      }
      const k = tileKey(dest.x, dest.y);
      if (this.extraFloorKeys.has(k) && !isBaseTile(dest.x, dest.y, this.roomId)) {
        if (this.hasAnyBlockAtTile(dest.x, dest.y)) return;
        this.removeExtraFloorHandler?.(dest.x, dest.y);
        return;
      }
      if (!isBuiltinRoomId(this.roomId)) {
        if (this.removedBaseFloorKeys.has(k)) {
          this.placeExtraFloorHandler?.(dest.x, dest.y);
          return;
        }
        if (isBaseTile(dest.x, dest.y, this.roomId)) {
          if (this.hasAnyBlockAtTile(dest.x, dest.y)) return;
          this.removeExtraFloorHandler?.(dest.x, dest.y);
          return;
        }
      }
      this.placeExtraFloorHandler?.(dest.x, dest.y);
      return;
    }

    if (this.buildMode) {
      if (this.teleporterDestPickHandler) {
        const dest = this.pickFloor(e.clientX, e.clientY);
        if (!dest) return;
        if (!this.tileWalkable(dest)) return;
        if (this.hasAnyBlockAtTile(dest.x, dest.y)) return;
        if (this.hubNoBuildTile(dest.x, dest.y)) return;
        const fn = this.teleporterDestPickHandler;
        this.teleporterDestPickHandler = null;
        fn(dest.x, dest.y);
        return;
      }
      if (this.repositionFrom) {
        if (!this.moveBlockHandler) {
          this.cancelReposition();
        } else {
          const billboardHit = this.pickBillboardId(e.clientX, e.clientY);
          if (billboardHit) {
            const spec = this.billboardSpecs.get(billboardHit);
            if (spec) {
              this.cancelReposition();
              this.selectBillboard(billboardHit);
              this.obstacleSelectHandler?.(spec.anchorX, spec.anchorZ, 0);
              return;
            }
          }
          const blockHit = this.pickBlockKey(e.clientX, e.clientY);
          if (blockHit) {
            const [bx, bz, byRaw] = blockHit.split(",").map(Number);
            const by = Number.isFinite(byRaw) ? Math.floor(byRaw ?? 0) : 0;
            const bbFloor = this.billboardIdForFloorTile(bx!, bz!, by);
            this.cancelReposition();
            if (bbFloor) {
              this.selectBillboard(bbFloor);
              this.obstacleSelectHandler?.(bx!, bz!, by);
            } else {
              this.setSelectedBlockKey(blockHit);
              this.obstacleSelectHandler?.(bx!, bz!, by);
            }
            return;
          }
          const dest = this.pickFloor(e.clientX, e.clientY);
          if (!dest) return;
          if (!this.tileWalkable(dest)) return;
          if (this.hubNoBuildTile(dest.x, dest.y)) return;
          const here = snapFloorTile(this.selfMesh.position.x, this.selfMesh.position.z);
          if (here.x === dest.x && here.y === dest.y) return;
          const from = this.repositionFrom;
          const bbId = this.repositionBillboardId;
          if (bbId) {
            const spec = this.billboardSpecs.get(bbId);
            if (!spec) return;
            const nAx = spec.anchorX + (dest.x - from.x);
            const nAz = spec.anchorZ + (dest.y - from.y);
            if (
              !this.isBillboardFootprintValidForMove(
                nAx,
                nAz,
                spec.orientation,
                this.repositionDraftYaw,
                bbId
              )
            ) {
              return;
            }
            const sameCell = dest.x === from.x && dest.y === from.y;
            if (!sameCell) {
              const destTiles = billboardFootprintTilesXZ(
                nAx,
                nAz,
                spec.orientation,
                this.repositionDraftYaw
              );
              for (const t of destTiles) {
                if (here.x === t.x && here.y === t.z) return;
              }
            }
          } else if (this.hasAnyBlockAtTile(dest.x, dest.y)) {
            return;
          }
          this.moveBlockHandler(from.x, from.y, dest.x, dest.y);
          this.cancelReposition();
          return;
        }
      }

      const billboardHit = this.pickBillboardId(e.clientX, e.clientY);
      if (billboardHit) {
        const spec = this.billboardSpecs.get(billboardHit);
        if (spec) {
          this.selectBillboard(billboardHit);
          this.obstacleSelectHandler?.(spec.anchorX, spec.anchorZ, 0);
          return;
        }
      }

      const blockHit = this.pickBlockKey(e.clientX, e.clientY);
      if (blockHit) {
        const [bx, bz, byRaw] = blockHit.split(",").map(Number);
        const by = Number.isFinite(byRaw) ? Math.floor(byRaw ?? 0) : 0;
        const bbFloor = this.billboardIdForFloorTile(bx!, bz!, by);
        if (bbFloor) {
          this.selectBillboard(bbFloor);
          this.obstacleSelectHandler?.(bx!, bz!, by);
          return;
        }
        const selected = this.getSelectedBlockTile();
        const canStackHere = this.nextOpenLevelAt(bx!, bz!) !== null;
        if (
          !this.selectedBillboardId &&
          this.placeBlockHandler &&
          selected &&
          selected.x === bx &&
          selected.z === bz &&
          selected.y === by &&
          e.ctrlKey &&
          canStackHere
        ) {
          this.clearPlacementPreview();
          this.placeBlockHandler(bx!, bz!);
          return;
        }
        this.setSelectedBlockKey(blockHit);
        this.obstacleSelectHandler?.(bx!, bz!, by);
        return;
      }

      const dest = this.pickFloor(e.clientX, e.clientY);
      if (!dest) return;
      if (!this.tileWalkable(dest)) return;
      
      // Check if click is within build radius - if not, trigger movement instead
      const here = snapFloorTile(this.selfMesh.position.x, this.selfMesh.position.z);
      const dx = here.x - dest.x;
      const dz = here.y - dest.y;
      const distance = Math.hypot(dx, dz);
      if (distance > this.placeRadiusBlocks + 1e-6) {
        // Outside build radius - trigger walking instead of placing (on pointerup)
        const k = tileKey(dest.x, dest.y);
        if (this.blockingTileKeys.has(k)) return;
        if (!this.tileClickHandler) return;
        this.pendingPrimaryWalk = {
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
        };
        try {
          this.renderer.domElement.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        this.previewWalkNavigationAt(e.clientX, e.clientY);
        return;
      }
      
      const placeT = this.tryBuildPlacementFloorTile(e.clientX, e.clientY);
      if (!placeT) return;
      const yOpen = this.nextOpenLevelAt(placeT.x, placeT.z);
      if (yOpen === null) return;
      if (e.pointerType === "touch") {
        this.clearPendingBuildPlace();
        this.pendingBuildPlace = {
          pointerId: e.pointerId,
          startTileX: placeT.x,
          startTileZ: placeT.z,
        };
        try {
          this.renderer.domElement.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        if (!this.billboardPlacementPreview) {
          this.syncPlacementPreviewAt(placeT.x, placeT.z, yOpen);
        }
        return;
      }
      this.clearPlacementPreview();
      const placeFn = this.placeBlockHandler;
      if (placeFn) placeFn(placeT.x, placeT.z);
      return;
    }

    const blockForWalk = this.pickBlockKey(e.clientX, e.clientY);
    if (blockForWalk) {
      const bm = this.placedObjects.get(blockForWalk);
      if (bm) {
        // Check if this is an active claimable block
        if (bm.claimable && bm.active && !bm.passable) {
          const parts = blockForWalk.split(",").map(Number);
          const bx = parts[0]!;
          const bz = parts[1]!;
          const by =
            parts.length >= 3 && Number.isFinite(parts[2])
              ? Math.max(0, Math.min(2, Math.floor(parts[2]!)))
              : 0;
          if (this.claimBlockHandler) {
            this.claimBlockHandler(bx, bz, by);
          }
          return;
        }
        // Normal block walking logic (on pointerup)
        if (!bm.passable && !bm.ramp) {
          if (!this.tileClickHandler) return;
          this.pendingPrimaryWalk = {
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
          };
          try {
            this.renderer.domElement.setPointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
          this.previewWalkNavigationAt(e.clientX, e.clientY);
          return;
        }
      }
    }
    const dest = this.pickWalkableTile(e.clientX, e.clientY);
    if (!dest) return;
    if (!this.tileClickHandler) return;
    const k = tileKey(dest.x, dest.y);
    if (this.blockingTileKeys.has(k)) return;
    this.pendingPrimaryWalk = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
    };
    try {
      this.renderer.domElement.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    this.previewWalkNavigationAt(e.clientX, e.clientY);
  };

  setSelf(address: string, displayName?: string): void {
    this.clearSelfEmojiTouchSession();
    this.clearOtherProfileTouchSession();
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
    this.clearPendingBuildPlace();
    this.clearPlacementPreview();
    this.clearPendingPrimaryWalk();
    if (this.rightOrbitDrag) {
      const id = this.rightOrbitDrag.pointerId;
      try {
        if (this.renderer.domElement.hasPointerCapture?.(id)) {
          this.renderer.domElement.releasePointerCapture(id);
        }
      } catch {
        /* ignore */
      }
      this.rightOrbitDrag = null;
      this.renderer.domElement.style.cursor = "pointer";
    }
    this.cameraOrbitEase = null;
    this.touchTwoFingerMode = null;
    this.touchTwistPrevAngleValid = false;
    this.suppressAvatarContextMenuFromRightOrbit = false;
    this.ro.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointermove", this.onPointerMove);
    canvas.removeEventListener("pointerdown", this.onPointerDown);
    canvas.removeEventListener("pointerup", this.onPointerUp);
    canvas.removeEventListener("pointercancel", this.onPointerUp);
    canvas.removeEventListener("wheel", this.onWheel);
    canvas.removeEventListener("contextmenu", this.onCanvasContextMenu, true);
    window.removeEventListener("pointerup", this.onWindowTouchPointerEnd, true);
    window.removeEventListener(
      "pointercancel",
      this.onWindowTouchPointerEnd,
      true
    );
    document.removeEventListener(
      "visibilitychange",
      this.onDocumentVisibilityChange
    );
    window.removeEventListener("pagehide", this.onWindowPageHide);
    this.touchPointers.clear();
    this.pinchLastDistancePx = 0;
    this.touchTwoFingerMode = null;
    this.touchTwistPrevAngleValid = false;
    this.clearSelfEmojiTouchSession();
    this.clearOtherProfileTouchSession();
    this.selfQuickEmojiOpener = null;
    this.otherPlayerContextOpener = null;
    this.gateDoubleOpenHandler = null;
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
    for (const [, mesh] of this.canvasIdenticonMeshes) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      if (mesh.material instanceof THREE.Material) {
        mesh.material.dispose();
      }
    }
    this.canvasIdenticonMeshes.clear();
    for (const [, mesh] of this.blockMeshes) {
      this.scene.remove(mesh);
      disposePlacedBlockGroupContents(mesh);
    }
    this.blockMeshes.clear();
    for (const [, mesh] of this.walkableFloorMeshes) {
      this.scene.remove(mesh);
      disposeWalkableFloorMeshMaterials(mesh);
    }
    this.walkableFloorMeshes.clear();
    this.disposeWalkableFloorVisualMeshes();
    for (const [, marker] of this.doorMarkerMeshes) {
      this.scene.remove(marker);
      marker.geometry.dispose();
      (marker.material as THREE.Material).dispose();
    }
    this.doorMarkerMeshes.clear();
    this.clearTeleporterMarkers();
    this.clearVoxelWordSign();
    this.walkableFloorTileGeom.dispose();
    this.pathGeom.dispose();
    (this.pathLine.material as THREE.Material).dispose();
    this.trailGeom.dispose();
    (this.trailLine.material as THREE.Material).dispose();
    this.selectionOutline.geometry.dispose();
    this.selectionOutlineMat.dispose();
    this.teleporterLinkHighlight.geometry.dispose();
    this.teleporterLinkHighlightMat.dispose();
    this.roomEntrySpawnRing.geometry.dispose();
    this.roomEntrySpawnRingMat.dispose();
    this.tileHighlightMat.dispose();
    this.blockTopHighlight.geometry.dispose();
    (this.blockTopHighlight.material as THREE.Material).dispose();
    for (const [, m] of this.placementHintMeshes) {
      this.scene.remove(m);
    }
    this.placementHintMeshes.clear();
    this.placementHintGeom.dispose();
    this.placementHintMat.dispose();
    for (const m of this.billboardFootprintPreviewMeshes) {
      this.scene.remove(m);
    }
    this.billboardFootprintPreviewMeshes.length = 0;
    this.billboardFootprintPreviewGeom.dispose();
    this.billboardFootprintPreviewValidMat.dispose();
    this.billboardFootprintPreviewInvalidMat.dispose();
    this.removeBillboardInteractGhost();
    this.billboardPreviewPlaceholderTex.dispose();
    this.fogOfWar.dispose();
    for (const addr of [...this.typingIndicatorByAddress.keys()]) {
      this.removeTypingIndicator(addr);
    }
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
    const goal = this.pathPreviewGoal ?? this.pathGoal;
    if (!goal || !this.selfMesh) {
      this.lastTerrainPath = null;
      this.hideTrailImmediate();
      this.beginPathFadeOut();
      return;
    }
    const here = snapFloorTile(this.selfMesh.position.x, this.selfMesh.position.z);
    const moverCtx: PathfindMoverContext | null = this.selfAddress
      ? {
          address: this.selfAddress.replace(/\s+/g, "").toUpperCase(),
          nowMs: Date.now(),
        }
      : null;
    if (here.x === goal.ft.x && here.y === goal.ft.y) {
      const curLayer = inferStartLayerClient(
        this.selfMesh.position.x,
        this.selfMesh.position.z,
        this.selfMesh.position.y,
        this.placedObjects,
        moverCtx,
        this.roomId
      );
      if (curLayer === goal.layer) {
        if (this.pathPreviewGoal) {
          this.pathPreviewGoal = null;
        } else {
          this.pathGoal = null;
        }
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
      this.placedObjects,
      moverCtx,
      this.roomId
    );
    const remaining = pathfindTerrain(
      here.x,
      here.y,
      startLayer,
      goal.ft.x,
      goal.ft.y,
      goal.layer,
      this.placedObjects,
      this.extraFloorKeys,
      this.roomId,
      this.removedBaseFloorKeys.size > 0 ? this.removedBaseFloorKeys : undefined,
      moverCtx ?? undefined
    );
    if (!remaining || remaining.length < 2) {
      if (this.pathPreviewGoal) {
        this.pathPreviewGoal = null;
      } else {
        this.pathGoal = null;
      }
      this.lastTerrainPath = null;
      this.hideTrailImmediate();
      this.beginPathFadeOut();
      return;
    }
    this.setPathPolylineTerrain(remaining);
  }

  /** Door tile currently under the local player, if any. */
  getStandingDoor(): {
    x: number;
    z: number;
    targetRoomId: string;
    spawnX: number;
    spawnZ: number;
  } | null {
    if (!this.selfMesh) return null;
    const here = snapFloorTile(this.selfMesh.position.x, this.selfMesh.position.z);
    for (const d of this.doors) {
      if (d.x === here.x && d.z === here.y) return d;
    }
    return null;
  }

  triggerStandingDoorTransition(): boolean {
    if (!this.roomChangeHandler) return false;
    if (this.pathGoal !== null) return false;
    const d = this.getStandingDoor();
    if (!d) return false;
    this.roomChangeHandler(d.targetRoomId, d.spawnX, d.spawnZ);
    return true;
  }

  /** Shared vertical pillar (white gradient) used for door portals and active teleporter tiles. */
  private createPortalPillarMesh(wx: number, wz: number): THREE.Mesh {
    const markerGeom = new THREE.BoxGeometry(
      TERRAIN_TILE_DOOR_MARKER_SIZE,
      TERRAIN_TILE_DOOR_MARKER_HEIGHT,
      TERRAIN_TILE_DOOR_MARKER_SIZE
    );
    const markerMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uColor: {
          value: new THREE.Color(TERRAIN_TILE_DOOR_MARKER_COLOR),
        },
        uHeight: { value: TERRAIN_TILE_DOOR_MARKER_HEIGHT },
        uAlphaBottom: { value: TERRAIN_TILE_DOOR_MARKER_ALPHA_BOTTOM },
        uAlphaTop: { value: TERRAIN_TILE_DOOR_MARKER_ALPHA_TOP },
      },
      vertexShader: `
        varying float vGradient;
        uniform float uHeight;
        void main() {
          vGradient = (position.y / uHeight) + 0.5;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uAlphaBottom;
        uniform float uAlphaTop;
        varying float vGradient;
        void main() {
          float t = clamp(vGradient, 0.0, 1.0);
          float alpha = mix(uAlphaBottom, uAlphaTop, t);
          if (alpha <= 0.01) discard;
          vec3 color = mix(uColor, vec3(1.0), (1.0 - t) * 0.2);
          gl_FragColor = vec4(color, alpha);
        }
      `,
    });
    const doorMarker = new THREE.Mesh(markerGeom, markerMat);
    doorMarker.position.set(
      wx,
      0.01 + TERRAIN_TILE_DOOR_MARKER_HEIGHT / 2,
      wz
    );
    return doorMarker;
  }

  private clearTeleporterMarkers(): void {
    for (const [, marker] of this.teleporterMarkerMeshes) {
      this.scene.remove(marker);
      marker.geometry.dispose();
      (marker.material as THREE.Material).dispose();
    }
    this.teleporterMarkerMeshes.clear();
    this.teleporterPortalFloorSig = null;
  }

  /** Configured one-way teleporter (not pending). */
  private isActiveTeleporterPortal(
    tp: BlockStyleProps["teleporter"] | undefined
  ): boolean {
    return Boolean(tp && "targetRoomId" in tp);
  }

  private syncTeleporterMarkers(): void {
    const want = new Set<string>();
    for (const [k, meta] of this.placedObjects) {
      if (!this.isActiveTeleporterPortal(meta.teleporter)) continue;
      want.add(k);
    }
    for (const k of want) {
      if (this.teleporterMarkerMeshes.has(k)) continue;
      const parts = k.split(",").map(Number);
      const wx = parts[0]!;
      const wz = parts[1]!;
      const m = this.createPortalPillarMesh(wx, wz);
      this.scene.add(m);
      this.teleporterMarkerMeshes.set(k, m);
    }
    for (const [k, marker] of [...this.teleporterMarkerMeshes]) {
      if (!want.has(k)) {
        this.scene.remove(marker);
        marker.geometry.dispose();
        (marker.material as THREE.Material).dispose();
        this.teleporterMarkerMeshes.delete(k);
      }
    }
    const sig = [...want].sort().join("|");
    if (sig !== this.teleporterPortalFloorSig) {
      this.teleporterPortalFloorSig = sig;
      this.syncWalkableFloorMeshes();
    }
  }

  /** Visual floor only where avatars can walk (core + extra); gaps show scene background only. */
  private syncWalkableFloorMeshes(): void {
    const b = this.roomBounds;
    const seen = new Set<string>();
    for (let x = b.minX; x <= b.maxX; x++) {
      for (let z = b.minZ; z <= b.maxZ; z++) {
        const bk = tileKey(x, z);
        if (this.removedBaseFloorKeys.has(bk)) continue;
        seen.add(bk);
      }
    }
    for (const k of this.extraFloorKeys) {
      seen.add(k);
    }

    const activeTeleporterKeys = new Set<string>();
    for (const [key, meta] of this.placedObjects) {
      if (this.isActiveTeleporterPortal(meta.teleporter)) {
        const parts = key.split(",").map(Number);
        activeTeleporterKeys.add(tileKey(parts[0]!, parts[1]!));
      }
    }

    for (const k of seen) {
      const [x, z] = k.split(",").map(Number);
      const wx = x!;
      const wz = z!;
      const isExtra = !isBaseTile(wx, wz, this.roomId);
      const isDoor = this.doorTileKeys.has(k);
      const isPortalGlow = isDoor || activeTeleporterKeys.has(k);
      let mesh = this.walkableFloorMeshes.get(k);
      if (!mesh) {
        mesh = new THREE.Mesh(
          this.walkableFloorTileGeom,
          createWalkableFloorTileMaterials(isPortalGlow, isExtra)
        );
        mesh.scale.set(this.floorTileQuadSize, 1, this.floorTileQuadSize);
        const topY = 0.01;
        mesh.position.set(
          wx,
          topY - WALKABLE_FLOOR_TILE_THICKNESS / 2,
          wz
        );
        mesh.visible = false;
        mesh.userData["isExtra"] = isExtra;
        mesh.userData["isDoor"] = isDoor;
        mesh.userData["isPortalGlow"] = isPortalGlow;
        this.walkableFloorMeshes.set(k, mesh);
      } else {
        const wantExtra = isExtra;
        const wantDoor = isDoor;
        const wantPortalGlow = isPortalGlow;
        if (
          mesh.userData["isExtra"] !== wantExtra ||
          mesh.userData["isDoor"] !== wantDoor ||
          mesh.userData["isPortalGlow"] !== wantPortalGlow
        ) {
          applyWalkableFloorTileMaterials(mesh, wantPortalGlow, wantExtra);
          mesh.userData["isExtra"] = wantExtra;
          mesh.userData["isDoor"] = wantDoor;
          mesh.userData["isPortalGlow"] = wantPortalGlow;
        }
      }

      const marker = this.doorMarkerMeshes.get(k);
      if (isDoor) {
        if (!marker) {
          const doorMarker = this.createPortalPillarMesh(wx, wz);
          this.scene.add(doorMarker);
          this.doorMarkerMeshes.set(k, doorMarker);
        }
      } else if (marker) {
        this.scene.remove(marker);
        marker.geometry.dispose();
        (marker.material as THREE.Material).dispose();
        this.doorMarkerMeshes.delete(k);
      }
    }
    for (const [k, mesh] of [...this.walkableFloorMeshes]) {
      if (!seen.has(k)) {
        this.scene.remove(mesh);
        disposeWalkableFloorMeshMaterials(mesh);
        this.walkableFloorMeshes.delete(k);
      }
    }
    for (const [k, marker] of [...this.doorMarkerMeshes]) {
      if (!seen.has(k)) {
        this.scene.remove(marker);
        marker.geometry.dispose();
        (marker.material as THREE.Material).dispose();
        this.doorMarkerMeshes.delete(k);
      }
    }
    this.applyFloorTileQuadScale();
    /** Obstacles often sync before extra-floor quads on welcome; re-append so depth ties favor blocks over coplanar floor tops. */
    this.bringPlacedBlockGroupsToSceneTail();
  }

  /** Re-add block groups after floor sync so they render after new/updated floor meshes (same renderOrder, equal-depth ties). */
  private bringPlacedBlockGroupsToSceneTail(): void {
    for (const g of this.blockMeshes.values()) {
      this.scene.remove(g);
      this.scene.add(g);
    }
  }

  private disposeWalkableFloorVisualMeshes(): void {
    for (const mesh of this.walkableFloorVisualMeshes) {
      this.scene.remove(mesh);
      if (mesh.material instanceof THREE.Material) mesh.material.dispose();
    }
    this.walkableFloorVisualMeshes.length = 0;
  }

  private rebuildWalkableFloorVisualMeshes(): void {
    this.disposeWalkableFloorVisualMeshes();
    const byKind: Record<"core" | "extra" | "portal", THREE.Vector3[]> = {
      core: [],
      extra: [],
      portal: [],
    };
    for (const [, mesh] of this.walkableFloorMeshes) {
      const kind = mesh.userData["isPortalGlow"]
        ? "portal"
        : mesh.userData["isExtra"]
          ? "extra"
          : "core";
      byKind[kind].push(mesh.position);
    }
    const dummy = new THREE.Object3D();
    const addBatch = (
      kind: "core" | "extra" | "portal",
      positions: THREE.Vector3[]
    ): void => {
      if (positions.length === 0) return;
      const batch = new THREE.InstancedMesh(
        this.walkableFloorTileGeom,
        createWalkableFloorTileMaterials(kind === "portal", kind === "extra"),
        positions.length
      );
      batch.frustumCulled = false;
      for (let i = 0; i < positions.length; i++) {
        const p = positions[i]!;
        dummy.position.copy(p);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(this.floorTileQuadSize, 1, this.floorTileQuadSize);
        dummy.updateMatrix();
        batch.setMatrixAt(i, dummy.matrix);
      }
      batch.instanceMatrix.needsUpdate = true;
      batch.userData["floorVisualKind"] = kind;
      this.scene.add(batch);
      this.walkableFloorVisualMeshes.push(batch);
    };
    addBatch("core", byKind.core);
    addBatch("extra", byKind.extra);
    addBatch("portal", byKind.portal);
  }

  private clearVoxelWordSign(): void {
    for (const [, mesh] of this.voxelTextMeshes) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.voxelTextMeshes.clear();
  }

  private glyphRows5x7(ch: string): readonly string[] {
    const c = ch.toUpperCase();
    const cached = this.voxelGlyphCache.get(c);
    if (cached) return cached;
    const rows = VOXEL_FONT_5X7[c] ?? VOXEL_GLYPH_UNKNOWN;
    this.voxelGlyphCache.set(c, rows);
    return rows;
  }

  private syncVoxelWordSign(): void {
    this.clearVoxelWordSign();
    const currentRoom = normalizeRoomId(this.roomId);
    for (const [id, spec] of this.voxelTextSpecs) {
      if (normalizeRoomId(spec.roomId) !== currentRoom) continue;
      const chars = spec.text.toUpperCase().split("");
      const glyphW = 5;
      const glyphH = 7;
      const unit = spec.unit;
      const spacing = spec.letterSpacing;
      const totalCols = chars.length * glyphW + Math.max(0, chars.length - 1) * spacing;
      const totalWorldW = totalCols * unit;
      const startX = spec.x - totalWorldW / 2 + unit / 2;
      const startZ = spec.z;

      let count = 0;
      for (const ch of chars) {
        const g = this.glyphRows5x7(ch);
        for (let r = 0; r < glyphH; r++) {
          const row = g[r] ?? "";
          for (let c = 0; c < glyphW; c++) {
            if (row[c] === "1") count += 1;
          }
        }
      }
      if (count === 0) continue;

      const geo = new THREE.BoxGeometry(unit, unit, unit);
      const mat = new THREE.MeshStandardMaterial({
        color: spec.color,
        roughness: 0.35,
        metalness: 0.05,
        emissive: spec.emissive,
        emissiveIntensity: spec.emissiveIntensity,
      });
      const mesh = new THREE.InstancedMesh(geo, mat, count);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        THREE.MathUtils.degToRad(spec.yawDeg)
      );
      const scale = new THREE.Vector3(1, 1, 1);
      const centerX = startX + totalWorldW / 2 - unit / 2;
      const center = new THREE.Vector3(centerX, 0, startZ);
      const pos = new THREE.Vector3();
      const rotated = new THREE.Vector3();
      let i = 0;
      for (let ci = 0; ci < chars.length; ci++) {
        const g = this.glyphRows5x7(chars[ci] ?? " ");
        const xColOffset = ci * (glyphW + spacing);
        for (let r = 0; r < glyphH; r++) {
          const row = g[r] ?? "";
          for (let c = 0; c < glyphW; c++) {
            if (row[c] !== "1") continue;
            const wx = startX + (xColOffset + c) * unit;
            const wy = spec.y + (glyphH - 1 - r) * unit;
            rotated.set(wx, 0, startZ).sub(center).applyQuaternion(q).add(center);
            pos.set(rotated.x, wy, rotated.z);
            m.compose(pos, q, scale);
            mesh.setMatrixAt(i, m);
            i += 1;
          }
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
      this.scene.add(mesh);
      this.voxelTextMeshes.set(id, mesh);
    }
  }

  private voxelTweenPhase(id: string): number {
    let h = 0;
    for (let i = 0; i < id.length; i += 1) {
      h = (h * 31 + id.charCodeAt(i)) | 0;
    }
    const p = (Math.abs(h) % 6283) / 1000;
    return p;
  }

  private updateVoxelTextTween(): void {
    const t = this.doorPulseTime;
    for (const [id, spec] of this.voxelTextSpecs) {
      const mesh = this.voxelTextMeshes.get(id);
      if (!mesh) continue;
      if (!spec.zTween) {
        mesh.position.z = 0;
        continue;
      }
      const amp = Math.max(0, spec.zTweenAmp);
      const speed = Math.max(0, spec.zTweenSpeed);
      const phase = this.voxelTweenPhase(id);
      mesh.position.z = Math.sin(t * speed + phase) * amp;
    }
  }

  getVoxelTextIds(roomId?: string): string[] {
    const rid = roomId ? normalizeRoomId(roomId) : null;
    const out: string[] = [];
    for (const [id, spec] of this.voxelTextSpecs) {
      if (!rid || normalizeRoomId(spec.roomId) === rid) out.push(id);
    }
    out.sort();
    return out;
  }

  getVoxelTextSpec(id: string): VoxelTextSpec | null {
    const s = this.voxelTextSpecs.get(id);
    return s ? { ...s } : null;
  }

  setVoxelTextsForRoom(roomId: string, specs: readonly VoxelTextSpec[]): void {
    const rid = normalizeRoomId(roomId);
    for (const [key, existing] of this.voxelTextSpecs) {
      if (normalizeRoomId(existing.roomId) === rid) this.voxelTextSpecs.delete(key);
    }
    for (const spec of specs) {
      const clean: VoxelTextSpec = {
        ...spec,
        id: spec.id.trim(),
        text: spec.text.trim().toUpperCase(),
        roomId: normalizeRoomId(spec.roomId),
        letterSpacing: Math.max(0, spec.letterSpacing),
        unit: Math.max(VOXEL_TEXT_MIN_UNIT, spec.unit),
        zTween: Boolean(spec.zTween),
        zTweenAmp: Math.max(0, spec.zTweenAmp ?? VOXEL_TEXT_DEFAULT_Z_TWEEN_AMP),
        zTweenSpeed: Math.max(0, spec.zTweenSpeed ?? VOXEL_TEXT_DEFAULT_Z_TWEEN_SPEED),
      };
      if (!clean.id || normalizeRoomId(clean.roomId) !== rid) continue;
      this.voxelTextSpecs.set(clean.id, clean);
    }
    if (this.activeVoxelTextId && !this.voxelTextSpecs.has(this.activeVoxelTextId)) {
      const ids = this.getVoxelTextIds();
      this.activeVoxelTextId = ids[0] ?? null;
    }
    if (!this.activeVoxelTextId) {
      const ids = this.getVoxelTextIds();
      this.activeVoxelTextId = ids[0] ?? null;
    }
    this.syncVoxelWordSign();
  }

  upsertVoxelText(spec: VoxelTextSpec): void {
    const clean: VoxelTextSpec = {
      ...spec,
      id: spec.id.trim(),
      text: spec.text.trim().toUpperCase(),
      roomId: normalizeRoomId(spec.roomId),
      letterSpacing: Math.max(0, spec.letterSpacing),
      unit: Math.max(VOXEL_TEXT_MIN_UNIT, spec.unit),
      zTween: Boolean(spec.zTween),
      zTweenAmp: Math.max(0, spec.zTweenAmp ?? VOXEL_TEXT_DEFAULT_Z_TWEEN_AMP),
      zTweenSpeed: Math.max(0, spec.zTweenSpeed ?? VOXEL_TEXT_DEFAULT_Z_TWEEN_SPEED),
    };
    if (!clean.id) return;
    this.voxelTextSpecs.set(clean.id, clean);
    if (!this.activeVoxelTextId) this.activeVoxelTextId = clean.id;
    this.syncVoxelWordSign();
  }

  updateVoxelText(id: string, patch: Partial<VoxelTextSpec>): void {
    const cur = this.voxelTextSpecs.get(id);
    if (!cur) return;
    const next: VoxelTextSpec = {
      ...cur,
      ...patch,
      id,
      text: (patch.text ?? cur.text).trim().toUpperCase(),
      roomId: normalizeRoomId(patch.roomId ?? cur.roomId),
      letterSpacing: Math.max(0, patch.letterSpacing ?? cur.letterSpacing),
      unit: Math.max(VOXEL_TEXT_MIN_UNIT, patch.unit ?? cur.unit),
      zTween: Boolean(patch.zTween ?? cur.zTween),
      zTweenAmp: Math.max(
        0,
        patch.zTweenAmp ?? cur.zTweenAmp ?? VOXEL_TEXT_DEFAULT_Z_TWEEN_AMP
      ),
      zTweenSpeed: Math.max(
        0,
        patch.zTweenSpeed ?? cur.zTweenSpeed ?? VOXEL_TEXT_DEFAULT_Z_TWEEN_SPEED
      ),
    };
    this.voxelTextSpecs.set(id, next);
    this.syncVoxelWordSign();
  }

  removeVoxelText(id: string): void {
    if (!this.voxelTextSpecs.delete(id)) return;
    if (this.activeVoxelTextId === id) {
      const ids = this.getVoxelTextIds();
      this.activeVoxelTextId = ids[0] ?? null;
    }
    this.syncVoxelWordSign();
  }

  setActiveVoxelText(id: string | null): void {
    if (!id) {
      this.activeVoxelTextId = null;
      return;
    }
    if (this.voxelTextSpecs.has(id)) this.activeVoxelTextId = id;
  }

  getActiveVoxelTextId(): string | null {
    return this.activeVoxelTextId;
  }

  moveVoxelWord(dx: number, dz: number): void {
    const id = this.activeVoxelTextId;
    if (!id) return;
    const cur = this.voxelTextSpecs.get(id);
    if (!cur) return;
    this.updateVoxelText(id, { x: cur.x + dx, z: cur.z + dz });
  }

  rotateVoxelWord(deltaYawRad: number): void {
    const id = this.activeVoxelTextId;
    if (!id) return;
    const cur = this.voxelTextSpecs.get(id);
    if (!cur) return;
    this.updateVoxelText(id, {
      yawDeg: cur.yawDeg + THREE.MathUtils.radToDeg(deltaYawRad),
    });
  }

  voxelWordMoveStep(): number {
    return VOXEL_TEXT_MOVE_STEP;
  }

  voxelWordRotateStepRad(): number {
    return VOXEL_TEXT_ROTATE_STEP_RAD;
  }

  /** Gate move: draw the source block with frozen opening while `repositionGatePlacedVisualFreeze` is set. */
  private gateRepositionPlacedRenderMeta(
    wx: number,
    wz: number,
    wyLevel: number,
    meta: BlockStyleProps
  ): BlockStyleProps {
    const rh = this.repositionGateHint;
    const rf = this.repositionGatePlacedVisualFreeze;
    if (
      !rh ||
      !rf ||
      !meta.gate ||
      wx !== rh.fromX ||
      wz !== rh.fromZ ||
      wyLevel !== rh.fromYLevel
    ) {
      return meta;
    }
    return {
      ...meta,
      gate: {
        ...meta.gate,
        exitX: rf.exitX,
        exitZ: rf.exitZ,
      },
    };
  }

  private syncBlockMeshes(): void {
    const seen = new Set(this.placedObjects.keys());
    for (const k of seen) {
      const metaRaw = this.placedObjects.get(k)!;
      const parts = k.split(",").map(Number);
      const wx = parts[0]!;
      const wz = parts[1]!;
      const wyLevel = Number.isFinite(parts[2]) ? Math.floor(parts[2]!) : 0;
      const meta = this.gateRepositionPlacedRenderMeta(wx, wz, wyLevel, metaRaw);
      let g = this.blockMeshes.get(k);
      if (
        wyLevel === 0 &&
        this.billboardFootprintFloorKeys.has(`${wx},${wz}`)
      ) {
        if (g) {
          this.scene.remove(g);
          disposePlacedBlockGroupContents(g);
          this.blockMeshes.delete(k);
        }
        continue;
      }
      const h = this.obstacleHeight(meta);
      const vis = this.blockVisualScale;
      const prev = g?.userData["blockMeta"] as BlockStyleProps | undefined;
      const prevVis = g?.userData["blockRenderScale"] as number | undefined;
      const unchanged =
        g &&
        prev &&
        prevVis === vis &&
        prev.passable === meta.passable &&
        prev.half === meta.half &&
        prev.quarter === meta.quarter &&
        prev.hex === meta.hex &&
        prev.pyramid === meta.pyramid &&
        (prev.pyramidBaseScale ?? 1) === (meta.pyramidBaseScale ?? 1) &&
        prev.sphere === meta.sphere &&
        prev.ramp === meta.ramp &&
        prev.rampDir === meta.rampDir &&
        prev.colorId === meta.colorId &&
        prev.claimable === meta.claimable &&
        prev.active === meta.active &&
        JSON.stringify(prev.teleporter) === JSON.stringify(meta.teleporter) &&
        JSON.stringify(prev.gate) === JSON.stringify(meta.gate) &&
        JSON.stringify(prev.gateOpen) === JSON.stringify(meta.gateOpen);
      if (unchanged) {
        continue;
      }
      if (g) {
        this.scene.remove(g);
        disposePlacedBlockGroupContents(g);
        this.blockMeshes.delete(k);
      }
      g = this.makeBlockMesh(meta, { tileX: wx, tileZ: wz });
      g.userData.tileKey = k;
      g.userData.blockMeta = { ...meta };
      g.userData.blockRenderScale = vis;
      g.position.set(wx, wyLevel * BLOCK_SIZE + (h * vis) / 2, wz);
      this.scene.add(g);
      this.blockMeshes.set(k, g);
    }
    for (const [k, mesh] of [...this.blockMeshes]) {
      if (!seen.has(k)) {
        this.scene.remove(mesh);
        disposePlacedBlockGroupContents(mesh);
        this.blockMeshes.delete(k);
      }
    }
    this.refreshSelectionOutline();
    this.syncTeleporterMarkers();
  }

  private obstacleHeight(meta: BlockStyleProps): number {
    if (meta.quarter) return BLOCK_SIZE * 0.25;
    if (meta.half) return BLOCK_SIZE * 0.5;
    return BLOCK_SIZE;
  }

  /**
   * One thin panel for {@link BlockStyleProps.gate}: hinge on the front (non-exit) edge,
   * ~90° about Y when `gateOpen` is active. Swing handedness follows exit side only.
   */
  private makeGateBlockGroup(
    meta: BlockStyleProps,
    ghost: boolean,
    tileX: number,
    tileZ: number
  ): THREE.Group {
    const gate = meta.gate;
    const h = this.obstacleHeight(meta);
    const vis = this.blockVisualScale;
    const hVis = h * vis;
    const B = BLOCK_SIZE * vis;
    const base = blockColorHex(meta.colorId);
    const mat = new THREE.MeshStandardMaterial({
      color: base,
      roughness: 0.55,
      metalness: 0.18,
      transparent: ghost,
      opacity: ghost ? 0.42 : 1,
      depthWrite: !ghost,
    });
    const root = new THREE.Group();
    if (!gate) {
      return root;
    }
    const dirs: readonly [number, number][] = [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ];
    const edx = gate.exitX - tileX;
    const edz = gate.exitZ - tileZ;
    let exitIdx = 0;
    for (let i = 0; i < 4; i++) {
      const d = dirs[i]!;
      if (d[0] === edx && d[1] === edz) {
        exitIdx = i;
        break;
      }
    }
    const open =
      Boolean(meta.gateOpen) && Date.now() < (meta.gateOpen?.untilMs ?? 0);
    /** Consistent hinge direction from exit side only (not persisted `rampDir`). */
    const swingSign = exitIdx === 0 || exitIdx === 3 ? 1 : -1;
    const openYaw = open ? swingSign * (Math.PI / 2) : 0;

    const align = new THREE.Group();
    align.rotation.y = (-exitIdx * Math.PI) / 2;

    const pivot = new THREE.Group();
    pivot.position.set(-B * 0.46, 0, 0);
    pivot.rotation.y = openYaw;

    const thick = B * 0.08;
    const span = B * 0.94;
    const doorGeom = new THREE.BoxGeometry(thick, hVis, span);
    const door = new THREE.Mesh(doorGeom, mat);
    door.position.set(B * 0.47, 0, 0);
    door.castShadow = false;
    door.receiveShadow = false;

    pivot.add(door);
    align.add(pivot);
    root.add(align);
    return root;
  }

  /** Wedge with low edge at −X and high edge at +X, then rotated by `rampDir` (0–3). */
  private makeRampGeometry(
    hLogical: number,
    rampDir: number,
    vis: number
  ): THREE.BufferGeometry {
    const h = hLogical * vis;
    const b = BLOCK_SIZE * 0.5 * vis;
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

  private makeBlockMesh(
    meta: BlockStyleProps,
    opts?: { ghost?: boolean; tileX?: number; tileZ?: number }
  ): THREE.Group {
    const ghost = Boolean(opts?.ghost);
    if (meta.gate) {
      const tx = opts?.tileX;
      const tz = opts?.tileZ;
      if (Number.isFinite(tx) && Number.isFinite(tz)) {
        return this.makeGateBlockGroup(meta, ghost, tx!, tz!);
      }
      return this.makeGateBlockGroup(meta, ghost, 0, 0);
    }
    const h = this.obstacleHeight(meta);
    const vis = this.blockVisualScale;
    const hVis = h * vis;
    const g = new THREE.Group();
    
    // Special handling for claimable blocks: override color based on active state
    let base: number;
    if (meta.claimable) {
      if (meta.active) {
        // Active claimable block: gold color
        base = 0xffc107; // Nimiq gold
      } else {
        // Inactive claimable block: dark color
        base = 0x1a1a1a; // Very dark gray
      }
    } else {
      base = blockColorHex(meta.colorId);
    }
    
    const mat = new THREE.MeshStandardMaterial({
      color: base,
      roughness: 0.65,
      metalness: 0.15,
      transparent: ghost || meta.passable,
      opacity: ghost ? 0.42 : meta.passable ? 0.45 : 1,
      depthWrite: ghost ? false : !meta.passable,
      emissive: meta.claimable && meta.active ? 0xffc107 : 0x000000,
      emissiveIntensity: meta.claimable && meta.active ? 0.28 : 0,
    });
    if (meta.ramp) {
      const geom = this.makeRampGeometry(h, meta.rampDir, vis);
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.y = -hVis / 2;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      g.add(mesh);
    } else if (meta.sphere) {
      const r = BLOCK_SIZE * 0.5 * 0.94 * vis;
      const geom = new THREE.SphereGeometry(r, 20, 16);
      const mesh = new THREE.Mesh(geom, mat);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      g.add(mesh);
    } else if (meta.pyramid) {
      const scale = meta.pyramidBaseScale ?? 1;
      const rBase = BLOCK_SIZE * 0.5 * 0.94 * vis * scale;
      const geom = new THREE.ConeGeometry(rBase, hVis, 4, 1);
      const mesh = new THREE.Mesh(geom, mat);
      mesh.rotation.y = Math.PI / 4;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      g.add(mesh);
    } else if (meta.hex) {
      const r = BLOCK_SIZE * 0.5 * 0.94 * vis;
      const geom = new THREE.CylinderGeometry(r, r, hVis, 6);
      const mesh = new THREE.Mesh(geom, mat);
      mesh.rotation.y = Math.PI / 6;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      g.add(mesh);
    } else {
      const geom = new THREE.BoxGeometry(
        BLOCK_SIZE * vis,
        hVis,
        BLOCK_SIZE * vis
      );
      const mesh = new THREE.Mesh(geom, mat);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      g.add(mesh);
    }
    if (meta.claimable && meta.active && !ghost) {
      const sparkles = makeMineableSparklePoints(hVis, vis);
      g.userData.mineableSparklePoints = sparkles;
      g.add(sparkles);
    } else {
      g.userData.mineableSparklePoints = undefined;
    }
    return g;
  }

  resize(): void {
    const w = this.canvasHost.clientWidth;
    const h = this.canvasHost.clientHeight;
    const renderScale = readWebglRenderScale();
    const dpr = Math.min(window.devicePixelRatio, 2) * renderScale;
    this.renderer.setSize(w, h, false);
    this.renderer.setPixelRatio(dpr);
    this.applyOrthographicFrustum();
    this.fogOfWar.setSize(w, h, dpr);
    this.refreshAllNameLabelScales();
    this.refreshChatBubbleVerticalPositions();
    this.refreshAllTypingIndicatorLayouts();
    this.requestRender();
  }

  syncState(players: PlayerState[]): void {
    let visualChanged = false;
    const seen = new Set<string>();
    for (const p of players) {
      seen.add(p.address);
      const py = Number.isFinite(p.y) ? p.y : 0;
      if (p.address === this.selfAddress) {
        if (this.selfMesh) {
          if (!this.selfTargetPos) {
            this.selfTargetPos = new THREE.Vector3(p.x, py, p.z);
            this.selfMesh.position.set(p.x, py, p.z);
            visualChanged = true;
          } else {
            visualChanged =
              visualChanged ||
              Math.hypot(this.selfTargetPos.x - p.x, this.selfTargetPos.z - p.z) > 0.001 ||
              Math.abs(this.selfTargetPos.y - py) > 0.001 ||
              Math.abs(this.selfServerVx - p.vx) > 0.001 ||
              Math.abs(this.selfServerVz - p.vz) > 0.001;
            this.selfTargetPos.set(p.x, py, p.z);
          }
          this.selfLastServerRecvMs = performance.now();
          this.selfServerVx = p.vx;
          this.selfServerVz = p.vz;
          const ox = this.selfMesh.position.x;
          const oy = this.selfMesh.position.y;
          const oz = this.selfMesh.position.z;
          const jumped =
            Math.hypot(p.x - ox, p.z - oz) > 6 || Math.abs(py - oy) > 1.5;
          if (jumped) {
            this.selfMesh.position.set(p.x, py, p.z);
            visualChanged = true;
          }
          if (!this.cameraFollowReady || jumped) {
            this.cameraLookAt.set(p.x, py, p.z);
            this.applyCameraPose();
            this.cameraFollowReady = true;
            visualChanged = true;
          }
          this.syncAvatarNameLabelFromState(this.selfMesh, p);
          this.syncTypingIndicatorForGroup(this.selfMesh, p);
        }
        continue;
      }
      let g = this.others.get(p.address);
      if (!g) {
        g = this.makeAvatar(p.address, p.displayName);
        this.others.set(p.address, g);
        this.scene.add(g);
        this.markSceneMutation("syncState:addRemoteAvatar");
        this.targetPos.set(p.address, new THREE.Vector3(p.x, py, p.z));
        g.position.set(p.x, py, p.z);
        visualChanged = true;
      }
      const t = this.targetPos.get(p.address);
      if (t) {
        visualChanged =
          visualChanged ||
          Math.hypot(t.x - p.x, t.z - p.z) > 0.001 ||
          Math.abs(t.y - py) > 0.001;
        t.set(p.x, py, p.z);
      }
      this.syncAvatarNameLabelFromState(g, p);
      this.syncTypingIndicatorForGroup(g, p);
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
        visualChanged = true;
      }
    }
    this.syncPlacementRangeHints();
    if (visualChanged) {
      this.requestRender(400);
    }
  }

  private updateMineableBlockSparkles(): void {
    const t = this.mineableSparkleAnimTime;
    const emissivePulse = 0.5 + 0.5 * Math.sin(t * 2.35);
    for (const g of this.blockMeshes.values()) {
      const pts = g.userData["mineableSparklePoints"] as THREE.Points | undefined;
      if (!pts) continue;
      for (const c of g.children) {
        if (c instanceof THREE.Mesh) {
          const mm = c.material;
          if (
            mm instanceof THREE.MeshStandardMaterial &&
            mm.emissive.r > 0.02
          ) {
            mm.emissiveIntensity = 0.16 + 0.44 * emissivePulse;
          }
        }
      }
      const basePos = pts.userData["sparkleBasePositions"] as
        | Float32Array
        | undefined;
      const phases = pts.userData["sparklePhases"] as Float32Array | undefined;
      if (!basePos || !phases) continue;
      const posAttr = pts.geometry.getAttribute(
        "position"
      ) as THREE.BufferAttribute | undefined;
      if (!posAttr) continue;
      const arr = posAttr.array as Float32Array;
      const n = phases.length;
      for (let i = 0; i < n; i++) {
        const breathe = 1 + 0.065 * Math.sin(t * 2.4 + phases[i]!);
        arr[i * 3] = basePos[i * 3]! * breathe;
        arr[i * 3 + 1] = basePos[i * 3 + 1]! * breathe;
        arr[i * 3 + 2] = basePos[i * 3 + 2]! * breathe;
      }
      posAttr.needsUpdate = true;
      pts.rotation.y = t * 0.38;
      const mat = pts.material as THREE.PointsMaterial;
      mat.opacity = 0.78 + 0.22 * Math.sin(t * 1.85);
    }
  }

  tick(dt: number): void {
    const renderNow = performance.now();
    let visualActive = false;

    this.doorPulseTime += dt;
    this.mineableSparkleAnimTime += dt;
    this.updateVoxelTextTween();

    if (this.selfMesh && this.selfTargetPos) {
      const t = this.selfTargetPos;
      const mx = this.selfMesh.position.x;
      const my = this.selfMesh.position.y;
      const mz = this.selfMesh.position.z;
      const jumped =
        Math.hypot(t.x - mx, t.z - mz) > 6 || Math.abs(t.y - my) > 1.5;
      if (jumped) {
        this.selfMesh.position.copy(t);
        visualActive = true;
      } else {
        const ageSec = Math.min(
          SELF_EXTRAP_MAX_AGE_SEC,
          (performance.now() - this.selfLastServerRecvMs) * 0.001
        );
        const h =
          this.selfServerVx * this.selfServerVx +
          this.selfServerVz * this.selfServerVz;
        // Server reports full stop: lock to snapshot (avoids rubber-band after extrap overshoot).
        if (h < 1e-10) {
          this.selfMesh.position.set(t.x, t.y, t.z);
        } else {
          let ex = this.selfServerVx * ageSec;
          let ez = this.selfServerVz * ageSec;

          const pg = this.pathGoal;
          if (pg) {
            const speedH = Math.hypot(this.selfServerVx, this.selfServerVz);
            if (speedH > 1e-6) {
              const gtx = pg.ft.x - t.x;
              const gtz = pg.ft.y - t.z;
              const along =
                (gtx * this.selfServerVx + gtz * this.selfServerVz) / speedH;
              const forward = speedH * ageSec;
              const buf = SELF_EXTRAP_GOAL_ALONG_BUFFER;
              if (along <= buf) {
                ex = ez = 0;
              } else if (forward > along - buf) {
                const denom = speedH * ageSec;
                const frac = denom > 1e-8 ? Math.max(0, along - buf) / denom : 0;
                ex *= frac;
                ez *= frac;
              }
            }
          }

          const hex = Math.hypot(ex, ez);
          const cap = SELF_EXTRAP_MAX_OFFSET_XZ;
          if (hex > cap && hex > 1e-8) {
            ex *= cap / hex;
            ez *= cap / hex;
          }

          // Never extrapolate Y from horizontal velocity "speed top-up"; server y is
          // authoritative. Old vyExt path lifted the mesh over gaps while xz ran ahead.
          this.selfExtrapGoal.set(t.x + ex, t.y, t.z + ez);
          const beforeX = this.selfMesh.position.x;
          const beforeY = this.selfMesh.position.y;
          const beforeZ = this.selfMesh.position.z;
          this.selfMesh.position.lerp(this.selfExtrapGoal, 1 - Math.exp(-LERP_SELF * dt));
          visualActive =
            visualActive ||
            Math.hypot(
              this.selfMesh.position.x - beforeX,
              this.selfMesh.position.z - beforeZ
            ) > 0.0005 ||
            Math.abs(this.selfMesh.position.y - beforeY) > 0.0005;
        }
      }
    }

    for (const [addr, g] of this.others) {
      const t = this.targetPos.get(addr);
      if (!t) continue;
      const beforeX = g.position.x;
      const beforeY = g.position.y;
      const beforeZ = g.position.z;
      g.position.lerp(t, 1 - Math.exp(-LERP * dt));
      visualActive =
        visualActive ||
        Math.hypot(g.position.x - beforeX, g.position.z - beforeZ) > 0.0005 ||
        Math.abs(g.position.y - beforeY) > 0.0005;
    }

    const orbitWasActive = this.cameraOrbitEase !== null;
    this.updateCameraOrbitEase();
    visualActive = visualActive || orbitWasActive || this.cameraOrbitEase !== null;
    this.updateCameraFollow(dt);
    this.refreshPathLine();
    visualActive =
      visualActive ||
      this.pathGoal !== null ||
      this.pathPreviewGoal !== null ||
      this.pathFadingOut ||
      this.trailFadingOut ||
      this.floatingTexts.size > 0;
    this.updatePathFade(dt);

    const px = this.selfMesh
      ? this.selfMesh.position.x
      : this.cameraLookAt.x;
    const pz = this.selfMesh
      ? this.selfMesh.position.z
      : this.cameraLookAt.z;
    this.fogOfWar.setPlayerPosition(px, pz);

    this.updateChatBubbles();
    this.updateTypingIndicatorAnimation();
    this.updateFloatingTexts();
    this.syncRoomEntrySpawnMarker(renderNow * 0.001);

    if (visualActive) {
      this.requestRender(250);
      this.updateMineableBlockSparkles();
      this.animateDoorTiles();
    }

    if (this.renderDirty || renderNow < this.continuousRenderUntilMono) {
      if (this.fogOfWar.getEnabled()) {
        this.fogOfWar.render(this.renderer, this.scene, this.camera);
      } else {
        this.renderer.setRenderTarget(null);
        this.renderer.render(this.scene, this.camera);
      }
      this.renderDirty = false;
    }
  }

  /** Canonical corner yaw in [0, 2π) nearest to `yawRad` (any real angle). */
  private static nearestCornerYawCanonical(yawRad: number): number {
    const twoPi = Math.PI * 2;
    const step = Game.CAMERA_ORBIT_SNAP_STEP_RAD;
    const yn = ((yawRad % twoPi) + twoPi) % twoPi;
    let k = Math.round(yn / step);
    k = ((k % 4) + 4) % 4;
    return k * step;
  }

  /** Same corner as canonical, unfolded by full turns so it is closest to `fromYaw`. */
  private static resolvedNearestCornerYaw(fromYaw: number): number {
    const twoPi = Math.PI * 2;
    const c = Game.nearestCornerYawCanonical(fromYaw);
    return c + Math.round((fromYaw - c) / twoPi) * twoPi;
  }

  /**
   * After right-drag orbit release: ease yaw along the shortest arc to the nearest 90°
   * corner (ease-out cubic).
   */
  private beginCameraOrbitEaseToNearestCorner(): void {
    const fromYaw = this.cameraOrbitYawRad;
    const toYaw = Game.resolvedNearestCornerYaw(fromYaw);
    const deltaYaw = toYaw - fromYaw;
    if (Math.abs(deltaYaw) < 1e-5) {
      this.cameraOrbitYawRad = toYaw;
      this.cameraOrbitEase = null;
      this.applyCameraPose();
      return;
    }
    this.cameraOrbitEase = {
      fromYaw,
      deltaYaw,
      startedAtMs: performance.now(),
      durationMs: Game.CAMERA_ORBIT_EASE_MS,
    };
  }

  private updateCameraOrbitEase(): void {
    const e = this.cameraOrbitEase;
    if (!e) return;
    const t = Math.min(
      1,
      (performance.now() - e.startedAtMs) / e.durationMs
    );
    const u = 1 - Math.pow(1 - t, 3);
    this.cameraOrbitYawRad = e.fromYaw + e.deltaYaw * u;
    if (t >= 1) {
      this.cameraOrbitYawRad = e.fromYaw + e.deltaYaw;
      this.cameraOrbitEase = null;
    }
  }

  private applyCameraPose(): void {
    const v = this.cameraOrbitOffsetScratch
      .copy(this.cameraOffsetBase)
      .applyAxisAngle(this.worldUp, this.cameraOrbitYawRad);
    this.camera.position.set(
      this.cameraLookAt.x + v.x + this.cameraLookAhead.x,
      this.cameraLookAt.y + v.y + this.cameraLookAhead.y,
      this.cameraLookAt.z + v.z + this.cameraLookAhead.z
    );
    this.camera.lookAt(
      this.cameraLookAt.x + this.cameraLookAhead.x,
      this.cameraLookAt.y + this.cameraLookAhead.y,
      this.cameraLookAt.z + this.cameraLookAhead.z
    );
  }

  /** Pans only when the local player nears the edge of the dead zone (soft follow). */
  private updateCameraFollow(dt: number): void {
    if (!this.selfMesh || !this.cameraFollowReady) return;
    const px = this.selfMesh.position.x;
    const py = this.selfMesh.position.y;
    const pz = this.selfMesh.position.z;
    
    // Calculate velocity for look-ahead
    const vx = px - this.selfPrevPos.x;
    const vz = pz - this.selfPrevPos.z;
    this.selfPrevPos.set(px, py, pz);
    
    // Calculate look-ahead offset based on velocity and zoom
    // More offset when zoomed in (smaller frustum), scaled by velocity
    const speed = Math.sqrt(vx * vx + vz * vz);
    const lookAheadStrength = Math.min(1.0, speed * 20); // Cap at full strength
    const zoomFactor = Math.max(0, 1 - this.frustumSize / VIEW_FRUSTUM_SIZE); // 0 when zoomed out, 1 when fully zoomed in
    const maxLookAhead = 2.5 * zoomFactor; // Max 2.5 world units when fully zoomed in
    
    const targetLookX = vx * lookAheadStrength * maxLookAhead * 50;
    const targetLookZ = vz * lookAheadStrength * maxLookAhead * 50;
    
    // Smooth look-ahead transitions
    const lookAlpha = 1 - Math.exp(-this.cameraLookAheadSmoothing * dt);
    this.cameraLookAhead.x += (targetLookX - this.cameraLookAhead.x) * lookAlpha;
    this.cameraLookAhead.z += (targetLookZ - this.cameraLookAhead.z) * lookAlpha;
    
    // Always center camera on player (no dead zone)
    const alpha = 1 - Math.exp(-this.cameraFollowSmoothing * dt);
    this.cameraLookAt.x += (px - this.cameraLookAt.x) * alpha;
    this.cameraLookAt.y += (py - this.cameraLookAt.y) * alpha;
    this.cameraLookAt.z += (pz - this.cameraLookAt.z) * alpha;
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
    const emojiOnly = isEmojiOnlyBubbleText(text);
    const { sprite, texture, width, height } = createChatBubbleSprite(text, {
      emojiOnly,
    });
    const mat = sprite.material as THREE.SpriteMaterial;
    
    const entry: ChatBubbleEntry = {
      sprite,
      material: mat,
      texture,
      startedAt: performance.now(),
      texWidth: width,
      texHeight: height,
      emojiOnly,
    };
    
    // Set initial scale and position
    this.syncChatBubbleScaleAndPosition(entry);
    
    g.add(sprite);
    this.chatBubbleByAddress.set(addr, entry);
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

  /**
   * Shows a floating text popup at a world position (e.g., "+1 NIM" or "+0.48" + NIM logo).
   * `nimLogo` uses `/branding/nimiq-nim-logo.svg` (same asset as the main menu).
   */
  showFloatingText(
    x: number,
    z: number,
    text: string,
    color = "#ffc107",
    opts?: {
      nimLogo?: boolean;
      /** Default: spring for plain text, classic when `nimLogo` is true. */
      verticalMotion?: "classic" | "spring";
    }
  ): void {
    const key = `${x},${z},${Date.now()}`;
    const nimLogo = Boolean(opts?.nimLogo);
    const verticalMotion =
      opts?.verticalMotion ?? (nimLogo ? "classic" : "spring");
    const label =
      nimLogo ? text.replace(/\s*NIM\s*$/i, "").trim() : text;

    const addSpriteFromCanvas = (
      canvas: HTMLCanvasElement,
      durationMs: number,
      motion: "classic" | "spring"
    ): void => {
      const w = canvas.width;
      const h = canvas.height;
      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;

      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: true,
        depthWrite: false,
      });

      const sprite = new THREE.Sprite(material);
      sprite.renderOrder = 100;

      const blockHeight = 1.0;
      const startY = blockHeight + 0.5;
      sprite.position.set(x, startY, z);

      const scale = 1.5;
      sprite.scale.set(scale, scale * (h / w), 1);

      this.scene.add(sprite);

      this.floatingTexts.set(key, {
        sprite,
        material,
        texture,
        startedAt: performance.now(),
        startY,
        durationMs,
        verticalMotion: motion,
      });
    };

    const drawPlain = (): void => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      ctx.font = "bold 32px 'Muli', sans-serif";
      const metrics = ctx.measureText(label);
      const padX =
        40 +
        FLOATING_REWARD_TEXT_OUTLINE_PX * 2 +
        FLOATING_REWARD_TEXT_SHADOW_PAD * 2;
      const w = Math.ceil(metrics.width + padX);
      const h = 72;
      canvas.width = w;
      canvas.height = h;
      ctx.font = "bold 32px 'Muli', sans-serif";
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      fillTextWithWhiteOutline(ctx, label, w / 2, h / 2, color);
      const dur =
        verticalMotion === "spring"
          ? FLOATING_SPRING_DURATION_MS
          : FLOATING_REWARD_DEFAULT_DURATION_MS;
      addSpriteFromCanvas(canvas, dur, verticalMotion);
    };

    if (!nimLogo) {
      drawPlain();
      return;
    }

    const logo = new Image();
    logo.crossOrigin = "anonymous";
    logo.decoding = "async";
    logo.src = "/branding/nimiq-nim-logo.svg";

    const drawWithLogo = (): void => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      const font = FLOATING_REWARD_MINING_FONT;
      ctx.font = font;
      const tw = ctx.measureText(label).width;
      const logoH = FLOATING_REWARD_MINING_LOGO_H;
      const gap = FLOATING_REWARD_MINING_GAP;
      let logoW = 0;
      if (logo.naturalWidth > 0 && logo.naturalHeight > 0) {
        logoW = (logo.naturalWidth / logo.naturalHeight) * logoH;
      }
      const padX =
        36 +
        FLOATING_REWARD_MINING_TEXT_OUTLINE_PX * 2 +
        FLOATING_REWARD_TEXT_SHADOW_PAD * 2;
      const innerW = tw + (logoW > 0 ? gap + logoW : 0);
      const w = Math.ceil(innerW + padX);
      const h = FLOATING_REWARD_MINING_CANVAS_H;
      canvas.width = w;
      canvas.height = h;

      ctx.font = font;
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      const cx = (w - innerW) / 2;
      const midY = h / 2;

      fillTextWithWhiteOutline(
        ctx,
        label,
        cx,
        midY,
        color,
        FLOATING_REWARD_MINING_TEXT_OUTLINE_PX
      );

      if (logoW > 0) {
        const lx = cx + tw + gap;
        const ly = midY - logoH / 2;
        try {
          drawImageWithWhiteOutline(
            ctx,
            logo,
            lx,
            ly,
            logoW,
            logoH,
            FLOATING_REWARD_MINING_LOGO_OUTLINE_PX
          );
        } catch {
          /* ignore draw errors */
        }
      }

      addSpriteFromCanvas(
        canvas,
        FLOATING_REWARD_MINING_DURATION_MS,
        verticalMotion
      );
    };

    if (logo.complete && logo.naturalWidth > 0) {
      drawWithLogo();
      return;
    }

    logo.addEventListener(
      "load",
      () => {
        drawWithLogo();
      },
      { once: true }
    );
    logo.addEventListener(
      "error",
      () => {
        drawPlain();
      },
      { once: true }
    );
  }

  private updateFloatingTexts(): void {
    const now = performance.now();
    const riseDistanceClassic = 2.0;

    for (const [key, entry] of this.floatingTexts) {
      const duration = entry.durationMs;
      const elapsed = now - entry.startedAt;
      if (elapsed >= duration) {
        entry.sprite.removeFromParent();
        entry.texture.dispose();
        entry.material.dispose();
        this.floatingTexts.delete(key);
        continue;
      }

      const progress = elapsed / duration;

      if (entry.verticalMotion === "spring") {
        // Short rise, then small damped wobble toward rest (low excursion, no tall bounce).
        const peak = 0.28;
        const riseFrac = 0.2;
        let yOff: number;
        if (progress < riseFrac) {
          const u = progress / riseFrac;
          const eased = 1 - (1 - u) ** 3;
          yOff = peak * eased;
        } else {
          const u = (progress - riseFrac) / (1 - riseFrac);
          const damp = Math.exp(-7.5 * u);
          const wobble = 0.62 + 0.38 * Math.cos(Math.PI * 2 * 1.55 * u);
          yOff = peak * damp * wobble;
        }
        entry.sprite.position.y = entry.startY + yOff;
        const fadeStart = 0.76;
        if (progress > fadeStart) {
          const fadeProgress = (progress - fadeStart) / (1 - fadeStart);
          entry.material.opacity = 1 - fadeProgress;
        } else {
          entry.material.opacity = 1;
        }
        continue;
      }

      const easeOut = 1 - (1 - progress) ** 3;
      entry.sprite.position.y =
        entry.startY + riseDistanceClassic * easeOut;
      if (progress > 0.7) {
        const fadeProgress = (progress - 0.7) / 0.3;
        entry.material.opacity = 1 - fadeProgress;
      } else {
        entry.material.opacity = 1;
      }
    }
  }

  private removeTypingIndicator(addr: string): void {
    const e = this.typingIndicatorByAddress.get(addr);
    if (!e) return;
    e.sprite.removeFromParent();
    e.texture.dispose();
    e.material.dispose();
    this.typingIndicatorByAddress.delete(addr);
  }

  private layoutTypingSprite(g: THREE.Group, entry: TypingIndicatorEntry): void {
    const addr = String(g.userData.address ?? "");
    const tw = entry.texWidth;
    const th = entry.texHeight;
    const worldH = this.pixelToWorldY(TYPING_DOTS_SCREEN_HEIGHT_PX);
    const worldW = worldH * (tw / th);
    entry.sprite.scale.set(worldW, worldH, 1);

    /**
     * Name tags sit *below* the group origin (under the identicon). Typing must use the
     * same vertical band as chat bubbles: above the avatar billboard (see `syncChatBubbleScaleAndPosition`).
     */
    const chatEntry = addr ? this.chatBubbleByAddress.get(addr) : undefined;
    if (chatEntry) {
      this.syncChatBubbleScaleAndPosition(chatEntry);
      const c = chatEntry.sprite;
      const topY = c.position.y + c.scale.y * 0.5;
      const gap = this.pixelToWorldY(2);
      entry.sprite.position.y = topY + gap + worldH * 0.5;
    } else {
      const avatarTop = AVATAR_SPHERE_RADIUS * 2 * this.identiconScale;
      const gapAbove = this.pixelToWorldY(4);
      entry.sprite.position.y = avatarTop + gapAbove + worldH * 0.5;
    }
    entry.sprite.position.x = 0;
  }

  private syncTypingIndicatorForGroup(g: THREE.Group, p: PlayerState): void {
    const addr = p.address;
    if (!p.chatTyping) {
      this.removeTypingIndicator(addr);
      return;
    }
    let entry = this.typingIndicatorByAddress.get(addr);
    if (!entry) {
      entry = makeTypingIndicatorEntry();
      drawTypingDotsToCanvas(entry, 0);
      g.add(entry.sprite);
      this.typingIndicatorByAddress.set(addr, entry);
    }
    this.layoutTypingSprite(g, entry);
  }

  private refreshAllTypingIndicatorLayouts(): void {
    for (const [addr, entry] of this.typingIndicatorByAddress) {
      const g =
        addr === this.selfAddress
          ? this.selfMesh
          : this.others.get(addr) ?? null;
      if (!g) continue;
      this.layoutTypingSprite(g, entry);
    }
  }

  private updateTypingIndicatorAnimation(): void {
    const step = Math.floor(performance.now() / 380) % 3;
    for (const [addr, entry] of this.typingIndicatorByAddress) {
      const g =
        addr === this.selfAddress
          ? this.selfMesh
          : this.others.get(addr) ?? null;
      if (!g) {
        this.removeTypingIndicator(addr);
        continue;
      }
      if (entry.lastAnimStep !== step) {
        entry.lastAnimStep = step;
        drawTypingDotsToCanvas(entry, step);
      }
      this.layoutTypingSprite(g, entry);
    }
  }

  private replaceAvatarNameLabel(
    g: THREE.Group,
    displayName: string,
    away: boolean
  ): void {
    const oldSprite = g.userData.nameSprite as THREE.Sprite | undefined;
    const oldTex = g.userData.nameTexture as THREE.CanvasTexture | undefined;
    if (oldSprite) {
      g.remove(oldSprite);
      const sm = oldSprite.material as THREE.SpriteMaterial;
      sm.map = null;
      sm.dispose();
    }
    if (oldTex) {
      oldTex.dispose();
    }
    const { sprite: nameSprite, texture: nameTex } = createNameLabelSprite(
      displayName,
      { away }
    );
    g.userData.nameSprite = nameSprite;
    g.userData.nameTexture = nameTex;
    g.add(nameSprite);
  }

  private syncAvatarNameLabelFromState(g: THREE.Group, p: PlayerState): void {
    const away = Boolean(p.nimSendAway);
    const name =
      (p.displayName && String(p.displayName).trim()) ||
      walletDisplayName(p.address);
    const state = `${away ? 1 : 0}\0${name}`;
    if (g.userData.nameLabelSyncState === state) {
      return;
    }
    g.userData.nameLabelSyncState = state;
    g.userData.displayName = name;
    this.replaceAvatarNameLabel(g, name, away);
    this.syncNameLabelScaleAndPosition(g);
  }

  private disposeAvatarGroup(g: THREE.Group): void {
    const addr = g.userData.address as string | undefined;
    if (addr) this.removeChatBubbleEntry(addr);
    if (addr) this.removeTypingIndicator(addr);
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
      /**
       * Keep depthWrite off: Sprite depth is not reliable vs tilted meshes and can erase
       * billboards near the avatar. Billboards use depthWrite + lower renderOrder so they
       * draw first; the identicon then depth-tests correctly against the plane.
       */
      depthWrite: false,
    });
    const body = new THREE.Sprite(mat);
    /** After billboards (see billboardVisual mesh renderOrder) so plane depth is in the buffer. */
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
    const { sprite: nameSprite, texture: nameTex } = createNameLabelSprite(
      label,
      { away: false }
    );
    g.userData.nameSprite = nameSprite;
    g.userData.nameTexture = nameTex;
    g.add(nameSprite);
    this.syncNameLabelScaleAndPosition(g);
    return g;
  }

  private disposeInspectorTilePreviewPort(port: InspectorTilePreviewPort): void {
    port.resizeObserver.disconnect();
    port.renderer.dispose();
    port.scene.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        const m = child.material;
        if (Array.isArray(m)) {
          for (const mm of m) mm.dispose();
        } else {
          (m as THREE.Material).dispose();
        }
      }
    });
    port.scene.clear();
  }

  private inspectorTilePreviewSignature(meta: BlockStyleProps): string {
    return `${meta.half}|${meta.quarter}|${meta.hex}|${meta.pyramid}|${meta.pyramidBaseScale ?? 1}|${meta.sphere}|${meta.ramp}|${meta.rampDir}|${meta.colorId}|${Boolean(meta.claimable)}|${JSON.stringify(meta.gate ?? null)}|${this.blockVisualScale}|${this.floorTileQuadSize}`;
  }

  private applyInspectorPreviewFrustum(
    camera: THREE.OrthographicCamera,
    rw: number,
    rh: number
  ): void {
    const asp = Math.max(0.2, rw / Math.max(1, rh));
    const halfV = INSPECTOR_PREVIEW_HALF_V;
    const halfH = halfV * asp;
    camera.left = -halfH;
    camera.right = halfH;
    camera.top = halfV;
    camera.bottom = -halfV;
    camera.updateProjectionMatrix();
  }

  private renderInspectorTilePreview(slot: "placement" | "selection"): void {
    const port =
      slot === "placement"
        ? this.inspectorPlacementPort
        : this.inspectorSelectionPort;
    if (!port) return;
    const meta =
      slot === "placement"
        ? this.placementPreviewMetaForNewBlock()
        : this.inspectorSelectionObstacle === null
          ? null
          : ({
              passable: this.inspectorSelectionObstacle.passable,
              half: this.inspectorSelectionObstacle.half,
              quarter: this.inspectorSelectionObstacle.quarter,
              hex: this.inspectorSelectionObstacle.hex,
              pyramid: this.inspectorSelectionObstacle.pyramid,
              pyramidBaseScale: this.inspectorSelectionObstacle.pyramidBaseScale,
              sphere: this.inspectorSelectionObstacle.sphere,
              ramp: this.inspectorSelectionObstacle.ramp,
              rampDir: this.inspectorSelectionObstacle.rampDir,
              colorId: this.inspectorSelectionObstacle.colorId,
              ...(this.inspectorSelectionObstacle.gate
                ? { gate: this.inspectorSelectionObstacle.gate }
                : {}),
            } as BlockStyleProps);
    if (!meta) {
      while (port.blockSlot.children.length > 0) {
        const c = port.blockSlot.children[0]!;
        port.blockSlot.remove(c);
        c.traverse((child: THREE.Object3D) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            const m = child.material;
            if (Array.isArray(m)) {
              for (const mm of m) mm.dispose();
            } else {
              (m as THREE.Material).dispose();
            }
          }
        });
      }
      port.lastSig = "";
      const w0 = port.canvas.clientWidth || 1;
      const h0 = port.canvas.clientHeight || 1;
      port.renderer.setSize(w0, h0, false);
      port.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.applyInspectorPreviewFrustum(port.camera, w0, h0);
      port.renderer.render(port.scene, port.camera);
      return;
    }
    const sig = this.inspectorTilePreviewSignature(meta);
    const h = this.obstacleHeight(meta);
    const vis = this.blockVisualScale;
    const yWorld = (h * vis) / 2;
    port.blockSlot.position.set(0, yWorld, 0);
    if (port.lastSig !== sig) {
      port.lastSig = sig;
      while (port.blockSlot.children.length > 0) {
        const c = port.blockSlot.children[0]!;
        port.blockSlot.remove(c);
        c.traverse((child: THREE.Object3D) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            const m = child.material;
            if (Array.isArray(m)) {
              for (const mm of m) mm.dispose();
            } else {
              (m as THREE.Material).dispose();
            }
          }
        });
      }
      const tRef = this.inspectorSelectionTileRef;
      port.blockSlot.add(
        this.makeBlockMesh(meta, {
          ghost: false,
          tileX: tRef?.x,
          tileZ: tRef?.z,
        })
      );
    }
    const r = port.canvas.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    const rw = Math.max(1, Math.floor(r.width));
    const rh = Math.max(1, Math.floor(r.height));
    port.renderer.setSize(rw, rh, false);
    port.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.applyInspectorPreviewFrustum(port.camera, rw, rh);
    port.renderer.render(port.scene, port.camera);
  }

  /**
   * Renders a 1×1 floor tile + block in an isolated WebGL canvas (build rail / object panel).
   * Pass `null` to release GPU resources for that slot.
   */
  bindInspectorTilePreviewCanvas(
    slot: "placement" | "selection",
    canvas: HTMLCanvasElement | null
  ): void {
    const prev =
      slot === "placement"
        ? this.inspectorPlacementPort
        : this.inspectorSelectionPort;
    if (prev) {
      this.disposeInspectorTilePreviewPort(prev);
      if (slot === "placement") this.inspectorPlacementPort = null;
      else this.inspectorSelectionPort = null;
    }
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c0e14);
    const cw = Math.max(1, canvas.clientWidth);
    const ch = Math.max(1, canvas.clientHeight);
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.05, 72);
    this.applyInspectorPreviewFrustum(camera, cw, ch);
    const camDir = new THREE.Vector3(18, 21, 18).normalize().multiplyScalar(6.4);
    camera.position.copy(camDir);
    camera.lookAt(0, 0.1, 0);
    camera.up.copy(this.worldUp);

    const amb = new THREE.AmbientLight(0xffffff, 0.58);
    scene.add(amb);
    const dir = new THREE.DirectionalLight(0xfff5ee, 0.82);
    dir.position.set(5, 11, 7);
    scene.add(dir);

    const content = new THREE.Group();
    content.scale.setScalar(INSPECTOR_PREVIEW_SCENE_SCALE);
    scene.add(content);

    const topY = 0.01;
    const floorGeom = new THREE.BoxGeometry(1, WALKABLE_FLOOR_TILE_THICKNESS, 1);
    const floor = new THREE.Mesh(
      floorGeom,
      createWalkableFloorTileMaterials(false, false)
    );
    floor.scale.set(this.floorTileQuadSize, 1, this.floorTileQuadSize);
    floor.position.set(0, topY - WALKABLE_FLOOR_TILE_THICKNESS / 2, 0);
    content.add(floor);

    const blockSlot = new THREE.Group();
    content.add(blockSlot);

    const port: InspectorTilePreviewPort = {
      canvas,
      renderer,
      scene,
      camera,
      content,
      blockSlot,
      floor,
      resizeObserver: new ResizeObserver(() => {
        this.renderInspectorTilePreview(slot);
      }),
      lastSig: "",
    };
    port.resizeObserver.observe(canvas);
    if (slot === "placement") this.inspectorPlacementPort = port;
    else this.inspectorSelectionPort = port;
    this.renderInspectorTilePreview(slot);
  }

  /** Updates the object-panel 3D preview; pass `null` when the panel closes. */
  syncInspectorSelectionTilePreview(props: ObstacleProps | null): void {
    this.inspectorSelectionObstacle = props;
    if (
      props &&
      props.editorTileX !== undefined &&
      props.editorTileZ !== undefined &&
      props.editorTileY !== undefined
    ) {
      this.inspectorSelectionTileRef = {
        x: props.editorTileX,
        z: props.editorTileZ,
        y: props.editorTileY,
      };
    } else {
      this.inspectorSelectionTileRef = null;
    }
    this.renderInspectorTilePreview("selection");
  }

  private animateDoorTiles(): void {
    const pulse = Math.sin(this.doorPulseTime * 2) * 0.5 + 0.5;
    const doorIntensity = TERRAIN_TILE_DOOR_EMISSIVE_INTENSITY * (0.6 + pulse * 0.4);
    for (const mesh of this.walkableFloorVisualMeshes) {
      if (mesh.userData["floorVisualKind"] !== "portal") continue;
      const mat = mesh.material;
      if (mat instanceof THREE.MeshStandardMaterial) {
        mat.emissive.setHex(TERRAIN_TILE_DOOR_EMISSIVE);
        mat.emissiveIntensity = doorIntensity;
      }
    }
  }
}
