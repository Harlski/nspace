import * as THREE from "three";
import type { PlayerState } from "../types.js";
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
const DEFAULT_ZOOM_MIN = 6.5;
const DEFAULT_ZOOM_MAX = 13.44;
import { loadIdenticonTexture } from "./identiconTexture.js";
import {
  blockKey,
  type FloorTile,
  floorWalkableTerrain,
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
  CANVAS_ROOM_ID,
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
/** Walkable floor tile thickness in world Y; top stays near y≈0, volume extends downward. */
const WALKABLE_FLOOR_TILE_THICKNESS = 0.16;
/** Blend factor toward white for vertical tile faces (0–1). */
const WALKABLE_FLOOR_SIDE_LIGHTEN = 0.48;
/** Blend factor toward black for underside (-Y) face. */
const WALKABLE_FLOOR_BOTTOM_DARKEN = 0.22;

function lightenTerrainHex(hex: number, blend: number): number {
  const t = Math.max(0, Math.min(1, blend));
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  const lr = Math.min(255, Math.round(r + (255 - r) * t));
  const lg = Math.min(255, Math.round(g + (255 - g) * t));
  const lb = Math.min(255, Math.round(b + (255 - b) * t));
  return (lr << 16) | (lg << 8) | lb;
}

function darkenTerrainHex(hex: number, blend: number): number {
  const t = Math.max(0, Math.min(1, blend));
  const f = 1 - t * 0.55;
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  return (
    (Math.round(r * f) << 16) |
    (Math.round(g * f) << 8) |
    Math.round(b * f)
  );
}

function createWalkableFloorTileMaterials(
  isPortalGlow: boolean,
  isExtra: boolean
): THREE.MeshStandardMaterial[] {
  const topHex = isPortalGlow
    ? TERRAIN_TILE_DOOR_COLOR
    : isExtra
      ? TERRAIN_TILE_EXTRA_COLOR
      : TERRAIN_TILE_CORE_COLOR;
  const sideHex = lightenTerrainHex(topHex, WALKABLE_FLOOR_SIDE_LIGHTEN);
  const bottomHex = darkenTerrainHex(topHex, WALKABLE_FLOOR_BOTTOM_DARKEN);
  const roughTop = isPortalGlow ? 0.3 : isExtra ? 0.88 : 0.9;
  const metalTop = isPortalGlow ? 0.5 : isExtra ? 0.06 : 0.05;
  const roughSide = isPortalGlow ? 0.38 : 0.9;
  const metalSide = isPortalGlow ? 0.42 : 0.06;
  const mk = (
    color: number,
    opts: {
      roughness: number;
      metalness: number;
      emissiveScale: number;
    }
  ) =>
    new THREE.MeshStandardMaterial({
      color,
      roughness: opts.roughness,
      metalness: opts.metalness,
      emissive: isPortalGlow ? TERRAIN_TILE_DOOR_EMISSIVE : 0x000000,
      emissiveIntensity: isPortalGlow
        ? TERRAIN_TILE_DOOR_EMISSIVE_INTENSITY * opts.emissiveScale
        : 0,
    });
  // BoxGeometry groups: +x, -x, +y (top), -y (bottom), +z, -z
  return [
    mk(sideHex, { roughness: roughSide, metalness: metalSide, emissiveScale: 0.42 }),
    mk(sideHex, { roughness: roughSide, metalness: metalSide, emissiveScale: 0.42 }),
    mk(topHex, { roughness: roughTop, metalness: metalTop, emissiveScale: 1 }),
    mk(bottomHex, { roughness: 0.95, metalness: 0.04, emissiveScale: 0 }),
    mk(sideHex, { roughness: roughSide, metalness: metalSide, emissiveScale: 0.42 }),
    mk(sideHex, { roughness: roughSide, metalness: metalSide, emissiveScale: 0.42 }),
  ];
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
  const sideHex = lightenTerrainHex(topHex, WALKABLE_FLOOR_SIDE_LIGHTEN);
  const bottomHex = darkenTerrainHex(topHex, WALKABLE_FLOOR_BOTTOM_DARKEN);
  const roughTop = isPortalGlow ? 0.3 : isExtra ? 0.88 : 0.9;
  const metalTop = isPortalGlow ? 0.5 : isExtra ? 0.06 : 0.05;
  const roughSide = isPortalGlow ? 0.38 : 0.9;
  const metalSide = isPortalGlow ? 0.42 : 0.06;
  const mats = mesh.material as THREE.MeshStandardMaterial[];
  const set = (
    i: number,
    hex: number,
    rough: number,
    metal: number,
    emissiveScale: number
  ): void => {
    const m = mats[i]!;
    m.color.setHex(hex);
    m.roughness = rough;
    m.metalness = metal;
    if (isPortalGlow) {
      m.emissive.setHex(TERRAIN_TILE_DOOR_EMISSIVE);
      m.emissiveIntensity =
        TERRAIN_TILE_DOOR_EMISSIVE_INTENSITY * emissiveScale;
    } else {
      m.emissive.setHex(0x000000);
      m.emissiveIntensity = 0;
    }
  };
  set(0, sideHex, roughSide, metalSide, 0.42);
  set(1, sideHex, roughSide, metalSide, 0.42);
  set(2, topHex, roughTop, metalTop, 1);
  set(3, bottomHex, 0.95, 0.04, 0);
  set(4, sideHex, roughSide, metalSide, 0.42);
  set(5, sideHex, roughSide, metalSide, 0.42);
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

/** Same rule as HUD: only emoji / VS16 / ZWJ / spaces, no letters or digits. */
function isEmojiOnlyBubbleText(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 32) return false;
  if (/[\p{L}\p{N}]/u.test(t)) return false;
  return /^[\s\p{Extended_Pictographic}\uFE0F\u200D]+$/u.test(t);
}

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
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private readonly hit = new THREE.Vector3();
  private selfAddress = "";
  private selfMesh: THREE.Group | null = null;
  /** Authoritative position from server; selfMesh lerps toward this each frame. */
  private selfTargetPos: THREE.Vector3 | null = null;
  private readonly others = new Map<string, THREE.Group>();
  private readonly chatBubbleByAddress = new Map<string, ChatBubbleEntry>();
  private readonly floatingTexts = new Map<string, {
    sprite: THREE.Sprite;
    material: THREE.SpriteMaterial;
    texture: THREE.CanvasTexture;
    startedAt: number;
    startY: number;
    /** Total visible lifetime in ms (mining rewards use longer). */
    durationMs: number;
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
  private moveBlockHandler:
    | ((fromX: number, fromZ: number, toX: number, toZ: number) => void)
    | null = null;
  private obstacleSelectHandler: ((x: number, z: number, y: number) => void) | null =
    null;
  private placeExtraFloorHandler: ((x: number, z: number) => void) | null = null;
  private removeExtraFloorHandler: ((x: number, z: number) => void) | null = null;
  private buildMode = false;
  /** Place walkable tiles outside the core room (toggle with F). */
  private floorExpandMode = false;
  private readonly extraFloorKeys = new Set<string>();
  /** Mining/claiming state for experimental claimable blocks */
  private miningState: {
    blockX: number;
    blockZ: number;
    startTime: number;
    duration: number; // milliseconds
  } | null = null;
  /** One slab mesh per walkable tile (core grid + extra); void shows scene background only. */
  private readonly walkableFloorMeshes = new Map<string, THREE.Mesh>();
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
  /** All placed objects (solid and walk-through), keyed by blockKey(x,z,y). */
  private readonly placedObjects = new Map<string, BlockStyleProps>();
  /** Styles applied when placing new blocks in build mode. */
  private placementHalf = false;
  private placementQuarter = false;
  private placementHex = false;
  private placementRamp = false;
  private placementRampDir = 0;
  private placementColorId = 0;
  private placementClaimable = false;
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
    const prevRoomId = this.roomId;
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
    
    // Clear all obstacles and floor tiles from previous room
    this.placedObjects.clear();
    this.blockingTileKeys.clear();
    this.extraFloorKeys.clear();
    
    // Clear block meshes from scene
    for (const [, mesh] of this.blockMeshes) {
      this.scene.remove(mesh);
      mesh.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (obj.material instanceof THREE.Material) {
            obj.material.dispose();
          }
        }
      });
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
    this.hideTrailImmediate();
    this.beginPathFadeOut();
    this.syncWalkableFloorMeshes();
    this.syncVoxelWordSign();
    this.refreshPathLine();
    this.syncPlacementRangeHints();
    
    // Clear canvas identicons when leaving canvas room
    if (normalizeRoomId(prevRoomId) === CANVAS_ROOM_ID && normalizeRoomId(this.roomId) !== CANVAS_ROOM_ID) {
      this.clearCanvasIdenticons();
    }
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

  private applyFloorTileQuadScale(): void {
    const s = this.floorTileQuadSize;
    for (const [, mesh] of this.walkableFloorMeshes) {
      mesh.scale.set(s, 1, s);
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
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
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
          this.tryExecuteWalkNavigationAt(e.clientX, e.clientY);
        } else {
          this.refreshPathLine();
        }
      }
    }

    if (e.pointerType !== "touch") return;
    const hadTwoTouches = this.touchPointers.size >= 2;
    const endingRotateOrbit =
      hadTwoTouches && this.touchTwoFingerMode === "rotate";
    this.touchPointers.delete(e.pointerId);
    if (this.touchPointers.size < 2) {
      this.pinchLastDistancePx = 0;
      this.touchTwoFingerMode = null;
      this.touchTwistPrevAngleValid = false;
      if (endingRotateOrbit) {
        this.beginCameraOrbitEaseToNearestCorner();
      }
    }
  };

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
  } | null {
    if (!this.selfMesh) return null;
    const here = snapFloorTile(this.selfMesh.position.x, this.selfMesh.position.z);
    const m = this.topBlockAtTile(here.x, here.y)?.meta ?? null;
    const tp = m?.teleporter;
    if (!tp || ("pending" in tp && tp.pending) || !("targetRoomId" in tp)) {
      return null;
    }
    return {
      targetRoomId: tp.targetRoomId,
      targetX: tp.targetX,
      targetZ: tp.targetZ,
    };
  }

  getPlacementBlockStyle(): {
    half: boolean;
    quarter: boolean;
    hex: boolean;
    ramp: boolean;
    rampDir: number;
    colorId: number;
    claimable: boolean;
  } {
    return {
      half: this.placementHalf,
      quarter: this.placementQuarter,
      hex: this.placementHex,
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
    if (p.claimable !== undefined) {
      this.placementClaimable = p.claimable;
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

  getSelectedBlockTile(): { x: number; z: number; y: number } | null {
    if (!this.selectedBlockKey) return null;
    const [x, z, yRaw] = this.selectedBlockKey.split(",").map(Number);
    const y = Number.isFinite(yRaw) ? Math.max(0, Math.min(2, Math.floor(yRaw ?? 0))) : 0;
    if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
    return { x: x!, z: z!, y };
  }

  private refreshSelectionOutline(): void {
    if (!this.selectedBlockKey || !this.buildMode) {
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
    const box = new THREE.Box3().setFromObject(g);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    if (size.x < 1e-6 || size.y < 1e-6 || size.z < 1e-6) {
      this.selectionOutline.visible = false;
      this.refreshTeleporterLinkHighlight();
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
        | { targetRoomId: string; targetX: number; targetZ: number };
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
      const hex = ramp ? false : Boolean(t.hex);
      const colorId = Math.max(
        0,
        Math.min(BLOCK_COLOR_COUNT - 1, Math.floor(t.colorId ?? 0))
      );
      const locked = Boolean(t.locked);
      this.placedObjects.set(k, {
        passable: t.passable,
        half,
        quarter,
        hex,
        ramp,
        rampDir,
        colorId,
        locked,
        claimable: t.claimable,
        active: t.active,
        cooldownMs: t.cooldownMs,
        lastClaimedAt: t.lastClaimedAt,
        claimedBy: t.claimedBy,
        teleporter: t.teleporter,
      });
      if (y === 0 && !t.passable && !ramp) this.blockingTileKeys.add(tileKey(t.x, t.z));
    }
    this.syncBlockMeshes();
    this.refreshPathLine();
    this.refreshSelectionOutline();
    this.syncPlacementRangeHints();
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
        | { targetRoomId: string; targetX: number; targetZ: number };
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
      const hex = ramp ? false : Boolean(t.hex);
      const colorId = Math.max(
        0,
        Math.min(BLOCK_COLOR_COUNT - 1, Math.floor(t.colorId ?? 0))
      );
      const locked = Boolean(t.locked);

      this.placedObjects.set(k, {
        passable: t.passable,
        half,
        quarter,
        hex,
        ramp,
        rampDir,
        colorId,
        locked,
        claimable: t.claimable,
        active: t.active,
        cooldownMs: t.cooldownMs,
        lastClaimedAt: t.lastClaimedAt,
        claimedBy: t.claimedBy,
        teleporter: t.teleporter,
      });

      if (y === 0 && !t.passable && !ramp) this.blockingTileKeys.add(tileKey(t.x, t.z));
    }

    this.syncBlockMeshes();
    this.refreshPathLine();
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
        const k = tileKey(tx, tz);
        if (this.doorTileKeys.has(k)) continue;
        if (
          !floorWalkableTerrain(
            tx,
            tz,
            this.placedObjects,
            this.extraFloorKeys,
            this.roomId
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
    return isWalkableTile(ft.x, ft.y, this.extraFloorKeys, this.roomId);
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
      if (this.blockingTileKeys.has(k)) return null;
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
    if (this.blockingTileKeys.has(k)) return null;
    return { ft: dest, layer: 0 };
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
    } else {
      const blockHit = this.pickBlockKey(e.clientX, e.clientY);
      if (blockHit) {
        const meta = this.placedObjects.get(blockHit);
        if (meta && !meta.passable && !meta.ramp) {
          const [bx, bz, byRaw] = blockHit.split(",").map(Number);
          const by = Number.isFinite(byRaw) ? Math.floor(byRaw ?? 0) : 0;
          const h = this.obstacleHeight(meta);
          this.tileHighlight.position.set(bx!, 0.02, bz!);
          this.tileHighlight.visible = true;
          this.blockTopHighlight.position.set(bx!, by * BLOCK_SIZE + h + 0.03, bz!);
          this.blockTopHighlight.visible = true;
          
          // Check if this block is a signboard
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
    }
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
          const blockHit = this.pickBlockKey(e.clientX, e.clientY);
          if (blockHit) {
            const [bx, bz, byRaw] = blockHit.split(",").map(Number);
            const by = Number.isFinite(byRaw) ? Math.floor(byRaw ?? 0) : 0;
            this.cancelReposition();
            this.setSelectedBlockKey(blockHit);
            this.obstacleSelectHandler?.(bx!, bz!, by);
            return;
          }
          const dest = this.pickFloor(e.clientX, e.clientY);
          if (!dest) return;
          if (!this.tileWalkable(dest)) return;
          if (this.hasAnyBlockAtTile(dest.x, dest.y)) return;
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
        const [bx, bz, byRaw] = blockHit.split(",").map(Number);
        const by = Number.isFinite(byRaw) ? Math.floor(byRaw ?? 0) : 0;
        const selected = this.getSelectedBlockTile();
        const canStackHere = this.nextOpenLevelAt(bx!, bz!) !== null;
        if (
          this.placeBlockHandler &&
          selected &&
          selected.x === bx &&
          selected.z === bz &&
          selected.y === by &&
          e.ctrlKey &&
          canStackHere
        ) {
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
      
      if (!this.placeBlockHandler) return;
      if (this.nextOpenLevelAt(dest.x, dest.y) === null) return;
      if (this.hubNoBuildTile(dest.x, dest.y)) return;
      if (here.x === dest.x && here.y === dest.y) return;
      this.placeBlockHandler(dest.x, dest.y);
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
    this.clearSelfEmojiTouchSession();
    this.clearOtherProfileTouchSession();
    this.selfQuickEmojiOpener = null;
    this.otherPlayerContextOpener = null;
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
      disposeWalkableFloorMeshMaterials(mesh);
    }
    this.walkableFloorMeshes.clear();
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
    const goal = this.pathPreviewGoal ?? this.pathGoal;
    if (!goal || !this.selfMesh) {
      this.lastTerrainPath = null;
      this.hideTrailImmediate();
      this.beginPathFadeOut();
      return;
    }
    const here = snapFloorTile(this.selfMesh.position.x, this.selfMesh.position.z);
    if (here.x === goal.ft.x && here.y === goal.ft.y) {
      const curLayer = inferStartLayerClient(
        this.selfMesh.position.x,
        this.selfMesh.position.z,
        this.selfMesh.position.y,
        this.placedObjects
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
      this.placedObjects
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
      this.roomId
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
        seen.add(tileKey(x, z));
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
        mesh.userData["isExtra"] = isExtra;
        mesh.userData["isDoor"] = isDoor;
        mesh.userData["isPortalGlow"] = isPortalGlow;
        this.scene.add(mesh);
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

  private syncBlockMeshes(): void {
    const seen = new Set(this.placedObjects.keys());
    for (const k of seen) {
      const meta = this.placedObjects.get(k)!;
      const parts = k.split(",").map(Number);
      const wx = parts[0]!;
      const wz = parts[1]!;
      const wyLevel = Number.isFinite(parts[2]) ? Math.floor(parts[2]!) : 0;
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
        prev.colorId === meta.colorId &&
        prev.claimable === meta.claimable &&
        prev.active === meta.active &&
        JSON.stringify(prev.teleporter) === JSON.stringify(meta.teleporter);
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
      g.position.set(wx, wyLevel * BLOCK_SIZE + h / 2, wz);
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
    this.syncTeleporterMarkers();
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
      transparent: meta.passable,
      opacity: meta.passable ? 0.45 : 1,
      depthWrite: !meta.passable,
      emissive: meta.claimable && meta.active ? 0xffc107 : 0x000000,
      emissiveIntensity: meta.claimable && meta.active ? 0.3 : 0,
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
    this.doorPulseTime += dt;
    this.animateDoorTiles();
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
      } else {
        this.selfMesh.position.lerp(t, 1 - Math.exp(-LERP * dt));
      }
    }
    for (const [addr, g] of this.others) {
      const t = this.targetPos.get(addr);
      if (!t) continue;
      g.position.lerp(t, 1 - Math.exp(-LERP * dt));
    }
    this.updateCameraOrbitEase();
    this.updateCameraFollow(dt);
    this.refreshPathLine();
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
    this.updateFloatingTexts();
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
    opts?: { nimLogo?: boolean }
  ): void {
    const key = `${x},${z},${Date.now()}`;
    const nimLogo = Boolean(opts?.nimLogo);
    const label =
      nimLogo ? text.replace(/\s*NIM\s*$/i, "").trim() : text;

    const addSpriteFromCanvas = (
      canvas: HTMLCanvasElement,
      durationMs: number
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
      addSpriteFromCanvas(canvas, FLOATING_REWARD_DEFAULT_DURATION_MS);
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

      addSpriteFromCanvas(canvas, FLOATING_REWARD_MINING_DURATION_MS);
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
    const riseDistance = 2.0; // Rise 2 units upward
    
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
      // Ease out cubic
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      // Move upward
      entry.sprite.position.y = entry.startY + riseDistance * easeOut;
      
      // Fade out in the last 30% of duration
      if (progress > 0.7) {
        const fadeProgress = (progress - 0.7) / 0.3;
        entry.material.opacity = 1 - fadeProgress;
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
    body.renderOrder = 0;
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

  private animateDoorTiles(): void {
    const pulse = Math.sin(this.doorPulseTime * 2) * 0.5 + 0.5;
    const doorIntensity = TERRAIN_TILE_DOOR_EMISSIVE_INTENSITY * (0.6 + pulse * 0.4);

    for (const [, mesh] of this.walkableFloorMeshes) {
      const mats = mesh.material as
        | THREE.MeshStandardMaterial
        | THREE.MeshStandardMaterial[];
      const list = Array.isArray(mats) ? mats : [mats];
      const isPortalGlow = mesh.userData["isPortalGlow"];
      for (let i = 0; i < list.length; i++) {
        const mat = list[i]!;
        if (isPortalGlow) {
          const scale = i === 2 ? 1 : i === 3 ? 0 : 0.45;
          mat.emissive.setHex(TERRAIN_TILE_DOOR_EMISSIVE);
          mat.emissiveIntensity = doorIntensity * scale;
        } else {
          mat.emissive.setHex(0x000000);
          mat.emissiveIntensity = 0;
        }
      }
    }
  }
}
