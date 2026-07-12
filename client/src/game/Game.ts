import * as THREE from "three";
import type { PlayerState } from "../types.js";
import {
  syncCosmeticLoadoutVfx,
  spawnDeployableVfx,
  attachPersistentDeployableVfx,
  nameplateColorForPreset,
  tickCosmeticTrailForAvatar,
  tickCosmeticTrailSpawn,
  cosmeticTrailPresetForGroup,
  tickCosmeticPreviewMotion,
  buildStaticPreviewTrail,
  orientStaticPreviewTrail,
  updateCosmeticAuraForGroup,
  updateCosmeticTrailPuffsForGroup,
  disposeCosmeticTrailPuffs,
  type PersistentDeployableFx,
} from "../cosmetics/loadoutVfx.js";
import type {
  CosmeticGalleryShowcaseWire,
  CosmeticGalleryWire,
} from "../cosmetics/galleryTypes.js";
import type {
  BillboardState,
  ObstacleProps,
  RoomBackgroundNeutral,
} from "../net/ws.js";
import { remotePlayerIsNpc } from "../remotePlayerNpc.js";
import { walletDisplayName } from "../walletDisplayName.js";
import {
  ACHIEVEMENT_CELEBRATION_DURATION_MS,
  ACHIEVEMENT_CELEBRATION_ICON_SCREEN_HEIGHT_PX,
} from "../achievements/celebrationPolicy.js";
import {
  nextCelebrationDelayMs,
} from "../achievements/celebrationStagger.js";
import {
  disposeAchievementCelebrationSprite,
  ensureAchievementCelebrationTexture,
  getAchievementCelebrationTexture,
  spawnAchievementCelebrationSprite,
  updateAchievementCelebrationSprite,
  type AchievementCelebrationLayout,
  type AchievementCelebrationSprite,
} from "../achievements/achievementCelebrationVfx.js";
import {
  FOG_INNER_RADIUS,
  FOG_OUTER_RADIUS,
  ROOM_ID,
  VIEW_FRUSTUM_SIZE,
} from "./constants.js";
import { gateApproachTile } from "./gateAuth.js";
import {
  attentionMarkerBounceOffset,
  attentionMarkerHoverLift,
  makeAttentionMarkerGroup,
  tintAttentionMarkerGroup,
  type AttentionMarkerWire,
} from "./attentionMarkerVisual.js";
import { FogOfWarPass } from "./fogOfWar.js";
// worldcup: seasonal soccer rendering (feature-flagged, deletable)
import type { BallWire, WorldcupPortalWire } from "../net/ws.js";
import {
  getFlagImageIfReady,
  loadFlagImage,
  soleFlagCode,
} from "../ui/flags.js";
import {
  FIELD_BOUNDS as WORLDCUP_FIELD_BOUNDS,
  FIELD_GOALS as WORLDCUP_FIELD_GOALS,
  FIELD_OUTFIELD_MARGIN as WORLDCUP_FIELD_OUTFIELD_MARGIN,
  WORLDCUP_ENABLED as WORLDCUP_ENABLED_CLIENT,
  isFieldLikeRoomId as worldcupIsFieldLikeRoomId,
  isMatchPitchRoomId as worldcupIsMatchPitchRoomId,
} from "../worldcup/config.js";
import {
  buildGoalNet as worldcupBuildGoalNet,
  buildStadium as worldcupBuildStadium,
  buildStadiumGround as worldcupBuildStadiumGround,
  frontRowStandSeat as worldcupFrontRowStandSeat,
  makePitchSurface as worldcupMakePitchSurface,
  makeSoccerBallTexture as worldcupMakeSoccerBallTexture,
  WorldcupCrowd,
} from "../worldcup/fieldVisuals.js";
import { WorldcupGoalArrow } from "../worldcup/goalArrow.js";
import type { WorldcupJoystickView } from "../worldcup/joystick.js";

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
/** Rooms catalog preview: fixed Hub (25x25) framing regardless of room size. */
const LAYOUT_PREVIEW_HUB_TILES = 25;
/** Baked catalog preview pan/zoom (view-space Y, zoom scale Z). */
const LAYOUT_PREVIEW_DEFAULT_TUNE = { x: 0, y: 1.5, z: 0.3 };
/** Ortho stream camera sits above look-at; height only matters for near/far clipping. */
const STREAM_CAMERA_HEIGHT = 100;
/** Top-down stream overview: identicon footprint spans this many floor tiles (1 tile at spotlight zoom). */
const STREAM_TOPDOWN_AVATAR_TILE_SPAN = 3;
import {
  identiconDataUrl,
  isCachedIdenticonTexture,
  loadIdenticonTexture,
  peekIdenticonTexture,
} from "./identiconTexture.js";
import {
  createBillboardRoot,
  disposeBillboardRoot,
  makeFallbackBillboardTexture,
  updateBillboardRootPose,
} from "./billboardVisual.js";
import { billboardFootprintTilesXZ } from "./billboardFootprintMath.js";
import {
  captureDesignSnapshot,
  footprintFromBbox,
  footprintTiles,
  rotateDesignOffset,
  type DesignBbox,
  type DesignSnapshotV1,
} from "./designFootprint.js";
import { prefabPlaceSnapshotMatchesDesign, prefabPlaceMeshTemplateSignature, shouldApplyPrefabPlaceSnapshot } from "./prefabPlacePreview.js";
import {
  buildWardrobePreviewFloorPatch,
  collectWardrobePreviewBlocksInPatch,
  getRoomDefaultSpawnTile,
  resolveWardrobePreviewAnchorTile,
  shouldRenderWardrobePreviewBlock,
  snapWardrobePreviewCameraOrbitYaw,
  TERRAIN_WATER_COLOR,
  type WardrobePreviewFloorContext,
} from "./wardrobePreviewBackdrop.js";
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
  type FloorBrushSize,
  floorBrushTiles,
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
  walkBoundsForRoom,
  waypointWorldY,
  isOrthogonallyAdjacentToFloorTile,
} from "./grid.js";
import {
  moveOrderPlaybackActive,
  remotePoseFromMoveOrder,
  type MoveOrderWire,
} from "./moveOrderPlayback.js";
import {
  applyRemoteMoveAbort,
  type RemoteMoveAbortWire,
} from "./moveAbortPlayback.js";
import {
  type RoomBounds,
  CHAMBER_MAX_ZOOM_FRUSTUM,
  CHAMBER_ROOM_ID,
  HUB_MAX_ZOOM_FRUSTUM,
  HUB_ROOM_ID,
  CANVAS_ROOM_ID,
  PIXEL_ROOM_ID,
  getDoorsForRoom,
  getRoomBaseBounds,
  isBuiltinRoomId,
  isHubSpawnSafeZone,
  normalizeRoomId,
  registerClientRoomBounds,
} from "./roomLayouts.js";
import {
  effectiveZoomMax as computeEffectiveZoomMax,
  normalZoomMax as computeNormalZoomMax,
  roomSupportsTelescopeBoost,
  telescopeHoldTargetFrustum as computeTelescopeHoldTargetFrustum,
  type ZoomLimitContext,
} from "./zoomLimits.js";
import { isMobilePortraitDocument } from "../ui/pseudoFullscreen.js";
import { TELESCOPE_HOLD_ZOOM_MS } from "../telescope/constants.js";
import {
  DEFAULT_INTEREST_HALF_TILES,
  INTEREST_CHUNK_TILES,
  interestChunksForTileKeys,
  interestChunksFromRect,
  NON_ADMIN_MAX_INTEREST_HALF_TILES,
  NON_ADMIN_MAX_ZOOM_FRUSTUM,
  roomUsesSpatialInterest,
  tileChunkKey,
  VIEW_INTEREST_PADDING_TILES,
  type ViewInterestRect,
} from "./interestChunks.js";
import {
  type BlockStyleProps,
  blockColorRgbToHueDeg,
  clampColorRgb,
  applyPlainCubeMeshRotation,
  cubeRotationForPlainCube,
  clampHexRadiusScale,
  clampSphereRadiusScale,
  clampPyramidBaseScale,
  isPlainCubeTerrain,
  normalizeCubeRotation,
  type CubeRotation,
  DEFAULT_BLOCK_COLOR_RGB,
  hueDegToBlockColorRgb,
  normalizeBlockPrismParts,
  resolveBlockColorRgb,
  resolveTeleporterPillarColorRgb,
  TELEPORTER_DEFAULT_PILLAR_COLOR_RGB,
} from "./blockStyle.js";
import {
  drawNqHexagonWithWhiteOutline,
  nqHexagonLogoWidthForHeight,
} from "../ui/nimiqIcons.js";
import nimiqIconsData from "nimiq-icons/icons.json";

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
/**
 * worldcup: pitch free-move needs a larger cap - state broadcasts ~120ms apart at MOVE_SPEED 5
 * (~0.6u/step) and grid path-preview safeguards do not apply on the open field.
 */
const SELF_EXTRAP_MAX_OFFSET_XZ_FIELD = 0.72;
/** Default scale on unit floor plane; >1 hides subpixel seams (tunable in admin). */
const DEFAULT_FLOOR_TILE_QUAD = 1.01;
/** 1 = match server footprint; scale geometry only (grid Y unchanged) to debug floor seam flicker. */
const DEFAULT_BLOCK_VISUAL_SCALE = 1;
/** Walkable floor tile thickness in world Y; top stays near y≈0, volume extends downward. */
const WALKABLE_FLOOR_TILE_THICKNESS = 0.16;
/** Instanced floor batches are split by chunk so frustum culling skips off-screen regions. */
const WALKABLE_FLOOR_VISUAL_CHUNK_TILES = 32;
/** World Y of the visible floor surface (slightly above y=0 to sit above void tint). */
const WALKABLE_FLOOR_TOP_Y = 0.01;
/** Shared with placed blocks so hue-ring colors read the same on floor tiles and objects. */
const PLACED_COLOR_SURFACE_ROUGHNESS = 0.65;
const PLACED_COLOR_SURFACE_METALNESS = 0.15;

function readWebglRenderScale(): number {
  if (typeof location === "undefined") return 1;
  const query = new URLSearchParams(location.search);
  const raw = query.get("webglRenderScale");
  if (raw !== null) {
    const n = Number(raw);
    return Number.isFinite(n) ? Math.max(0.25, Math.min(1, n)) : 1;
  }
  if (query.has("stream")) return 1;
  return 1;
}

function walkableFloorTopColor(
  isPortalGlow: boolean,
  isExtra: boolean,
  extraColorRgb?: number,
  coreColorOverride?: number
): number {
  if (isPortalGlow) return TERRAIN_TILE_DOOR_COLOR;
  if (coreColorOverride !== undefined) return coreColorOverride;
  if (isExtra) return extraColorRgb ?? TERRAIN_TILE_EXTRA_COLOR;
  return TERRAIN_TILE_CORE_COLOR;
}

function createWalkableFloorTileMaterials(
  isPortalGlow: boolean,
  isExtra: boolean,
  extraColorRgb?: number,
  coreColorOverride?: number
): THREE.MeshStandardMaterial {
  const topHex = walkableFloorTopColor(
    isPortalGlow,
    isExtra,
    extraColorRgb,
    coreColorOverride
  );
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

/** Lit top quads; per-tile tint via InstancedMesh.instanceColor (matches block shading). */
function createWalkableFloorVisualMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: PLACED_COLOR_SURFACE_ROUGHNESS,
    metalness: PLACED_COLOR_SURFACE_METALNESS,
  });
}

/** Horizontal instanced floor quad at tile center (wx, wz). */
function setWalkableFloorVisualInstanceTransform(
  dummy: THREE.Object3D,
  wx: number,
  wz: number,
  quadSize: number
): void {
  dummy.position.set(wx, WALKABLE_FLOOR_TOP_Y, wz);
  dummy.rotation.set(-Math.PI / 2, 0, 0);
  dummy.scale.set(quadSize, quadSize, 1);
  dummy.updateMatrix();
}

function applyWalkableFloorTileMaterials(
  mesh: THREE.Mesh,
  isPortalGlow: boolean,
  isExtra: boolean,
  extraColorRgb?: number,
  coreColorOverride?: number
): void {
  const topHex = walkableFloorTopColor(
    isPortalGlow,
    isExtra,
    extraColorRgb,
    coreColorOverride
  );
  const roughTop = isPortalGlow ? 0.3 : isExtra ? 0.88 : 0.9;
  const metalTop = isPortalGlow ? 0.5 : isExtra ? 0.06 : 0.05;
  const material = mesh.material;
  if (Array.isArray(material)) {
    for (const mat of material) mat.dispose();
    mesh.material = createWalkableFloorTileMaterials(
      isPortalGlow,
      isExtra,
      extraColorRgb,
      coreColorOverride
    );
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

/** Void (non-walkable) - water/sky tint; walkable tiles use dark gray palette below. */
const TERRAIN_WATER_COLOR = 0xa8d8ea;
/** Core room / expanded floor / door - black–gray tones (not grass). */
const TERRAIN_TILE_CORE_COLOR = 0x2d3340;
/** Pixel room implicit base tint when a tile has no explicit `baseFloorColor` entry. */
import { pixelImplicitFloorColorRgb } from "./pixelFloorColors.js";
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

type WardrobePreviewFloorTile = {
  mesh: THREE.Mesh;
  geo: THREE.PlaneGeometry;
  mat: THREE.MeshBasicMaterial;
};

type WardrobeAvatarPreviewPort = {
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  rootGroup: THREE.Group;
  avatarGroup: THREE.Group;
  floorTiles: WardrobePreviewFloorTile[];
  blockGroups: THREE.Group[];
  resizeObserver: ResizeObserver;
  wallet: string;
  displayName: string;
  cameraOrbitYawRad: number;
  rafId: number | null;
  previewPhaseStart: number;
  deployableFx: PersistentDeployableFx | null;
  cosmetics: {
    aura: string | null;
    nameplate: string | null;
    chatBubble: string | null;
    trail: string | null;
    deployable: string | null;
  };
};

/** Ortho half-extent (vertical, world units); larger = smaller subject in frame. */
const INSPECTOR_PREVIEW_HALF_V = 1.02;
/** Light neutral backdrop; slightly cool so gold / yellow blocks stay visible. */
const INSPECTOR_TILE_PREVIEW_BG = 0xd6dbe5;
/** Slightly shrink the tile + block together vs full-size preview. */
const INSPECTOR_PREVIEW_SCENE_SCALE = 0.72;
/** Profile Wardrobe - isometric avatar on a floor tile (matches `/advertise` preview). */
const WARDROBE_PREVIEW_BG = 0x0f1419;
const WARDROBE_PREVIEW_FRUSTUM_HALF_V = 1.05;
const WARDROBE_PREVIEW_CAMERA_OFFSET = 18;
const WARDROBE_PREVIEW_LOOK_AT_Y = 0.55;
const WARDROBE_PREVIEW_CHAT_BUBBLE_KEY = "wardrobePreviewChatBubble";
const WARDROBE_PREVIEW_CHAT_BUBBLE_PRESET_KEY = "wardrobePreviewChatBubblePreset";
/** Billboard object-preview plane is 40% smaller than full-size dock bake. */
const INSPECTOR_BILLBOARD_PREVIEW_SCALE = 0.6;
/** Extra shrink for Buildings-tab billboard tool thumbnail (128px bake). */
const DOCK_STRIP_BILLBOARD_THUMB_SCALE = 0.48;
/** Fixed raster size for dock tool / terrain-shape PNG thumbnails (HUD `<img>`). */
const DOCK_STRIP_THUMB_PX = 128;
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
 * Identicon billboard (2D sprite); half-height in world units - bottom at y=0, center at this value.
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
/** Canvas supersampling for name pills so text stays crisp when scaled up (e.g. wardrobe preview). */
const NAME_LABEL_RASTER = 2;
/** On-screen height (px) for the name pill; scales with ortho zoom so text stays readable. */
const NAME_LABEL_SCREEN_HEIGHT_PX = 24;
/** Smaller name pills in stream cinema (top-down overview). */
const STREAM_NAME_LABEL_SCREEN_HEIGHT_PX = 14;
const STREAM_NAME_LABEL_MAX_PX = 168;
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
  opts?: { away?: boolean; borderColor?: string }
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
  const r = NAME_LABEL_RASTER;
  canvas.width = Math.ceil(w * r);
  canvas.height = Math.ceil(h * r);
  ctx.setTransform(r, 0, 0, r, 0, 0);
  ctx.font = labelFont;
  ctx.textBaseline = "middle";
  ctx.fillStyle = away ? NAME_LABEL_PILL_AWAY : NAME_LABEL_PILL_ACTIVE;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, radius);
  ctx.fill();
  if (opts?.borderColor) {
    ctx.strokeStyle = opts.borderColor;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.textAlign = "left";
  ctx.fillStyle = away ? NAME_LABEL_TEXT_AWAY : NAME_LABEL_TEXT_ACTIVE;
  ctx.fillText(text, padX, h / 2 + 0.5);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
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
  /*
   * Name labels are decorative chrome on top of an authoritative avatar group, not part of the
   * pickable body. Per the "Client-only visuals on authoritative world objects" principle in
   * `docs/THE-LARGER-SYSTEM.md`, decorative children must not steal raycasts from the geometry
   * they sit above. Without this, the sprite (drawn with `depthTest: false` and high `renderOrder`)
   * wins avatar / right-click picks whenever a player's name plate visually overlaps the target
   * underneath - most painfully on touch (`pickClosestAvatarGroupAt` in `onPointerDown`) where a
   * tap meant for a block under another player's nameplate opens the player profile instead.
   * Suppressing the sprite raycast lets the ray continue to the body mesh (avatar still pickable
   * when the body itself is on the ray) or to the next pick step (block / floor).
   */
  sprite.userData[SKIP_BLOCK_PICK_AND_BOUNDS] = true;
  sprite.raycast = (_raycaster: THREE.Raycaster, _intersects: THREE.Intersection[]) => {};
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
  opts?: {
    emojiOnly?: boolean;
    flagCode?: string | null;
    bubblePreset?: string | null;
  }
): {
  sprite: THREE.Sprite;
  texture: THREE.CanvasTexture;
  width: number;
  height: number;
} {
  const emojiOnly = opts?.emojiOnly ?? false;
  const bubblePreset = opts?.bubblePreset ?? null;
  const bubbleStyle =
    bubblePreset === "bubble-rounded-pastel"
      ? "pastel"
      : bubblePreset === "bubble-sharp-dark"
        ? "dark"
        : "default";
  // A sole flag (the Flag Emote) renders as a Twemoji image - Windows has no flag glyphs.
  const flagCode = opts?.flagCode ?? null;
  const raster = emojiOnly
    ? CHAT_BUBBLE_RASTER_EMOJI
    : CHAT_BUBBLE_RASTER_NORMAL;
  const padX = 5;
  const padY = 4;
  const radius = bubbleStyle === "dark" ? 4 : bubbleStyle === "pastel" ? 14 : 10;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { alpha: true })!;
  ctx.font = CHAT_BUBBLE_FONT;
  const lines = flagCode
    ? [" "]
    : wrapChatLines(ctx, text.trim() || " ", CHAT_MAX_PX);
  const lineWidths = lines.map((ln) => Math.ceil(ctx.measureText(ln).width));
  const maxLineW = flagCode
    ? CHAT_LINE_HEIGHT_PX
    : Math.max(1, ...lineWidths);
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
  if (bubbleStyle === "dark") {
    gradient.addColorStop(0, "rgba(30, 36, 50, 0.96)");
    gradient.addColorStop(1, "rgba(15, 18, 28, 0.98)");
  } else if (bubbleStyle === "pastel") {
    gradient.addColorStop(0, "rgba(255, 235, 245, 0.98)");
    gradient.addColorStop(1, "rgba(255, 210, 230, 0.98)");
  } else {
    gradient.addColorStop(0, "rgba(255, 255, 255, 0.98)");
    gradient.addColorStop(1, "rgba(248, 250, 252, 0.98)");
  }
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, radius);
  ctx.fill();

  ctx.strokeStyle =
    bubbleStyle === "dark"
      ? "rgba(71, 85, 105, 0.9)"
      : bubbleStyle === "pastel"
        ? "rgba(244, 114, 182, 0.55)"
        : "rgba(203, 213, 225, 0.8)";
  ctx.lineWidth = hair;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, radius);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0, 0, 0, 0.12)";
  ctx.shadowBlur = 2 / raster;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 1 / raster;
  ctx.fillStyle = bubbleStyle === "dark" ? "#e2e8f0" : "#1e293b";
  if (!flagCode) {
    lines.forEach((ln, i) => {
      const cy = padY + i * lineH + lineH / 2;
      ctx.fillText(ln, w / 2, cy);
    });
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;

  if (flagCode) {
    // Draw the flag image centered (loads async, so redraw the texture once it is ready).
    const fs = lineH;
    const fx = (w - fs) / 2;
    const fy = (h - fs) / 2;
    const drawFlag = (img: HTMLImageElement): void => {
      ctx.drawImage(img, fx, fy, fs, fs);
      tex.needsUpdate = true;
    };
    const ready = getFlagImageIfReady(flagCode);
    if (ready) drawFlag(ready);
    else void loadFlagImage(flagCode).then((img) => img && drawFlag(img));
  }

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

/** Placeholder isometric block (cube) - one tile footprint, sits on floor. */
const BLOCK_SIZE = 0.82;

const plainCubeInstanceGeometryCache = new Map<string, THREE.BoxGeometry>();
const plainCubeInstanceMaterialCache = new Map<string, THREE.MeshStandardMaterial>();

function plainCubeObstacleHeight(meta: BlockStyleProps): number {
  if (meta.quarter) return BLOCK_SIZE * 0.25;
  if (meta.half) return BLOCK_SIZE * 0.5;
  return BLOCK_SIZE;
}

/** Opaque plain cubes without overlays - safe to batch into InstancedMesh. */
function canUsePlainCubeInstancing(meta: BlockStyleProps): boolean {
  if (meta.gate) return false;
  if (meta.unlockPad) return false;
  if (!isPlainCubeTerrain(normalizeBlockPrismParts(meta))) return false;
  if (meta.passable) return false;
  if (meta.claimable) return false;
  if (meta.signboardId) return false;
  const rot = cubeRotationForPlainCube(normalizeBlockPrismParts(meta), meta);
  if (rot.cubeRotX !== 0 || rot.cubeRotY !== 0 || rot.cubeRotZ !== 0) {
    return false;
  }
  return true;
}

function plainCubeInstanceHeightKey(meta: BlockStyleProps): string {
  if (meta.quarter) return "q";
  if (meta.half) return "h";
  return "f";
}

function plainCubeInstanceMaterialKey(meta: BlockStyleProps): string {
  const color = resolveBlockColorRgb(meta);
  return `${color}|${PLACED_COLOR_SURFACE_ROUGHNESS}|${PLACED_COLOR_SURFACE_METALNESS}`;
}

/** Lower stack layers render later so they win depth ties over upper layers at overlap. */
function placedBlockStackRenderOrder(wyLevel: number): number {
  const y = Math.max(0, Math.min(2, Math.floor(wyLevel)));
  return 2 - y;
}

/** Bias upper-layer depth back so the block below keeps its color at contact overlap. */
function applyUpperStackLayerDepthBias(
  mat: THREE.MeshStandardMaterial,
  wyLevel: number
): void {
  if (wyLevel <= 0) return;
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = 2;
  mat.polygonOffsetUnits = 3 + wyLevel * 2;
}

function getPlainCubeInstanceGeometry(
  vis: number,
  meta: BlockStyleProps
): THREE.BoxGeometry {
  const hVis = plainCubeObstacleHeight(meta) * vis;
  const key = `${vis}|${hVis}`;
  let geo = plainCubeInstanceGeometryCache.get(key);
  if (!geo) {
    geo = new THREE.BoxGeometry(BLOCK_SIZE * vis, hVis, BLOCK_SIZE * vis);
    plainCubeInstanceGeometryCache.set(key, geo);
  }
  return geo;
}

function getPlainCubeInstanceMaterial(
  meta: BlockStyleProps,
  wyLevel: number
): THREE.MeshStandardMaterial {
  const key = `${plainCubeInstanceMaterialKey(meta)}|y${wyLevel}`;
  let mat = plainCubeInstanceMaterialCache.get(key);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({
      color: resolveBlockColorRgb(meta),
      roughness: PLACED_COLOR_SURFACE_ROUGHNESS,
      metalness: PLACED_COLOR_SURFACE_METALNESS,
    });
    if (wyLevel > 0) {
      applyUpperStackLayerDepthBias(mat, wyLevel);
    }
    plainCubeInstanceMaterialCache.set(key, mat);
  }
  return mat;
}

function plainCubeInstanceBatchKey(
  wx: number,
  wz: number,
  wyLevel: number,
  vis: number,
  meta: BlockStyleProps
): string {
  return `${tileChunkKey(wx, wz)}|${vis}|y${wyLevel}|${plainCubeInstanceHeightKey(meta)}|${plainCubeInstanceMaterialKey(meta)}`;
}

function plainCubeInstanceEntrySig(meta: BlockStyleProps, vis: number): string {
  const rot = cubeRotationForPlainCube(normalizeBlockPrismParts(meta), meta);
  return `${plainCubeInstanceHeightKey(meta)}|${plainCubeInstanceMaterialKey(meta)}|${JSON.stringify(rot)}|${vis}`;
}

function setPlainCubeInstanceMatrix(
  dummy: THREE.Object3D,
  wx: number,
  wz: number,
  wyLevel: number,
  meta: BlockStyleProps,
  vis: number
): void {
  const h = plainCubeObstacleHeight(meta);
  dummy.position.set(wx, wyLevel * BLOCK_SIZE + (h * vis) / 2, wz);
  dummy.rotation.set(0, 0, 0);
  applyPlainCubeMeshRotation(
    dummy.rotation,
    cubeRotationForPlainCube(normalizeBlockPrismParts(meta), meta)
  );
  dummy.scale.set(1, 1, 1);
  dummy.updateMatrix();
}

function tileKeyFromInstancedPick(
  obj: THREE.Object3D,
  instanceId: number | undefined
): string | null {
  if (!(obj instanceof THREE.InstancedMesh) || instanceId === undefined) {
    return null;
  }
  const keys = obj.userData["plainCubeTileKeys"] as string[] | undefined;
  return keys?.[instanceId] ?? null;
}

/** GPU particles around active (minable) claimable blocks. */
const MINEABLE_SPARKLE_COUNT = 48;

/**
 * Decorative children inside an authoritative `THREE.Group` (placed block, avatar) carrying this
 * flag are **purely visual**: omitted from build-mode selection `Box3`, and they should not
 * participate in any raycast (block picks, avatar picks, etc.). Originally introduced for placed-
 * block VFX (mineable sparkles, future auras); also applied to nameplate sprites so they do not
 * shadow taps / right-clicks aimed at geometry behind them. See "Client-only visuals on
 * authoritative world objects" in `docs/THE-LARGER-SYSTEM.md`.
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
    /** No `map` - small hardware squares (crisp, pixel-ish when zoomed in). */
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
    } else if (child instanceof THREE.Sprite) {
      const mat = child.material as THREE.SpriteMaterial;
      if (child.userData.isSignpostHintIcon) {
        mat.map = null;
      }
      mat.dispose();
    } else if (child instanceof THREE.LineSegments) {
      child.geometry.dispose();
      if (!child.userData.prefabSaveOutline) {
        (child.material as THREE.Material).dispose();
      }
    }
  });
}

/**
 * If `newPath` equals `oldPath.slice(k)` for some k, returns k (tiles dropped from the start).
 * Otherwise null (new click or path jumped).
 */
const FLOATING_REWARD_TEXT_OUTLINE_PX = 10;
const FLOATING_REWARD_LOGO_OUTLINE_PX = 3;
const FLOATING_REWARD_DEFAULT_DURATION_MS = 2000;
/** Plain floaters (spring motion): extra time for damped settle before fade-out. */
const FLOATING_SPRING_DURATION_MS = 2600;
/** `floatingTexts` map key for {@link Game.showSelfPlayerActionMessage} (single slot; replace removes previous). */
const SELF_PLAYER_ACTION_FLOAT_KEY = "__self_player_action__";
/** Mining reward floater stays 1s longer than generic floaters (TODO). */
const FLOATING_REWARD_MINING_DURATION_MS = 3000;
/** Mining payout label + `nq-hexagon` tint. */
const MINING_REWARD_FLOAT_COLOR = "#ffe30a";
const FLOATING_REWARD_MINING_FONT =
  'bold 40px "Muli", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif';
const FLOATING_REWARD_MINING_GAP = 8;
const FLOATING_REWARD_MINING_CANVAS_H = 88;
/** Screen-fixed floater heights (world scale via {@link Game.pixelToWorldY}). */
const FLOATING_REWARD_PLAIN_SCREEN_HEIGHT_PX = 28;
/** Slightly larger plain floaters (e.g. inactive mineable block feedback). */
const FLOATING_REWARD_PLAIN_EMPHASIS_SCREEN_HEIGHT_PX = 34;
const FLOATING_REWARD_PLAIN_FONT = "bold 32px 'Muli', sans-serif";
const FLOATING_REWARD_PLAIN_EMPHASIS_FONT = "bold 38px 'Muli', sans-serif";
const FLOATING_REWARD_MINING_SCREEN_HEIGHT_PX = 36;
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

/** Decimal amount from a mining floater string such as `+1.0000 NIM`. */
function parseMiningRewardAmount(text: string): string | null {
  const trimmed = text.trim().replace(/\s*NIM\s*$/i, "").trim();
  const m = trimmed.match(/^\+(\d+\.\d+)$/);
  return m ? m[1]! : null;
}

function rasterPlainFloatingCanvas(
  label: string,
  color: string,
  emphasis = false
): { canvas: HTMLCanvasElement; screenHeightPx: number } {
  const font = emphasis
    ? FLOATING_REWARD_PLAIN_EMPHASIS_FONT
    : FLOATING_REWARD_PLAIN_FONT;
  const screenHeightPx = emphasis
    ? FLOATING_REWARD_PLAIN_EMPHASIS_SCREEN_HEIGHT_PX
    : FLOATING_REWARD_PLAIN_SCREEN_HEIGHT_PX;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  ctx.font = font;
  const metrics = ctx.measureText(label);
  const padX =
    40 +
    FLOATING_REWARD_TEXT_OUTLINE_PX * 2 +
    FLOATING_REWARD_TEXT_SHADOW_PAD * 2;
  const w = Math.ceil(metrics.width + padX);
  const h = emphasis ? 84 : 72;
  canvas.width = w;
  canvas.height = h;
  ctx.font = font;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  fillTextWithWhiteOutline(ctx, label, w / 2, h / 2, color);
  return { canvas, screenHeightPx };
}

function formatMiningRewardLabel(amount: string): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return `${amount}NIM`;
  return `${n.toFixed(2)}NIM`;
}

function miningRewardTextHeightPx(ctx: CanvasRenderingContext2D, label: string): number {
  const m = ctx.measureText(label);
  const fromMetrics = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
  if (fromMetrics > 0) return fromMetrics;
  return 40;
}

function rasterMiningRewardFloatingCanvas(
  amount: string,
  color: string
): { canvas: HTMLCanvasElement; screenHeightPx: number } {
  const label = formatMiningRewardLabel(amount);
  const font = FLOATING_REWARD_MINING_FONT;
  const screenHeightPx = FLOATING_REWARD_MINING_SCREEN_HEIGHT_PX;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  ctx.font = font;
  const tw = ctx.measureText(label).width;
  const textH = miningRewardTextHeightPx(ctx, label);
  const gap = FLOATING_REWARD_MINING_GAP;
  const logoH = textH;
  const logoW = nqHexagonLogoWidthForHeight(logoH);
  const padX =
    36 +
    FLOATING_REWARD_TEXT_OUTLINE_PX * 2 +
    FLOATING_REWARD_TEXT_SHADOW_PAD * 2;
  const innerW = logoW + gap + tw;
  const w = Math.ceil(innerW + padX);
  const h = FLOATING_REWARD_MINING_CANVAS_H;
  canvas.width = w;
  canvas.height = h;

  ctx.font = font;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const cx = (w - innerW) / 2;
  const midY = h / 2;
  const lx = cx;
  const ly = midY - logoH / 2;

  drawNqHexagonWithWhiteOutline(
    ctx,
    lx,
    ly,
    logoW,
    logoH,
    color,
    FLOATING_REWARD_LOGO_OUTLINE_PX
  );

  fillTextWithWhiteOutline(ctx, label, cx + logoW + gap, midY, color);

  return { canvas, screenHeightPx };
}

type FloatingTextEntry = {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  texture: THREE.CanvasTexture;
  startedAt: number;
  startY: number;
  durationMs: number;
  verticalMotion: "classic" | "spring";
  texWidth: number;
  texHeight: number;
  screenHeightPx: number;
  /** When set, sprite is parented to the avatar group and rises above the identicon. */
  avatarGroup?: THREE.Group;
  /** Zoom-adaptive mining reward; re-rasterized when color changes. */
  miningReward?: {
    amount: string;
    color: string;
  };
};

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

export type StreamPanTune = {
  /** World-units per second (horizontal plane). */
  speed: number;
  /** Extra inset from room north edge (screen top); world +Z is south. */
  marginNorth: number;
  marginSouth: number;
  marginWest: number;
  marginEast: number;
};

export type StreamPanDebugInfo = {
  lookX: number;
  lookZ: number;
  halfW: number;
  halfH: number;
  west: number;
  east: number;
  north: number;
  south: number;
  roomMinZ: number;
  roomMaxZ: number;
  limitMinX: number;
  limitMaxX: number;
  limitMinZ: number;
  limitMaxZ: number;
  tune: StreamPanTune;
};

export class Game {
  readonly scene: THREE.Scene;
  readonly camera: THREE.OrthographicCamera;
  readonly renderer: THREE.WebGLRenderer;
  private readonly canvasHost: HTMLElement;
  private renderDirty = true;
  private continuousRenderUntilMono = 0;
  private lastSceneMutation: { reason: string; atMono: number } | null = null;
  private readonly raycaster = new THREE.Raycaster();
  /** Ray from camera → signpost hint; ignores hits on the hint’s own block group. */
  private readonly signpostHintOcclRay = new THREE.Raycaster();
  private readonly signpostHintOcclCamW = new THREE.Vector3();
  private readonly signpostHintOcclHintW = new THREE.Vector3();
  private readonly signpostHintOcclDirW = new THREE.Vector3();
  private readonly signpostHintOcclBlkRoots: THREE.Object3D[] = [];
  private readonly ndc = new THREE.Vector2();
  private readonly hit = new THREE.Vector3();
  private selfAddress = "";
  /** Unlock Pad instance ids the local player has unlocked (client prediction + pathfinding). */
  private unlockedPadInstanceIds = new Set<string>();
  private selfMesh: THREE.Group | null = null;
  /** Authoritative position from server; selfMesh lerps toward extrapolated goal each frame. */
  private selfTargetPos: THREE.Vector3 | null = null;
  /** Monotonic clock (ms) when the last self snapshot arrived from the server. */
  private selfLastServerRecvMs = 0;
  /** Last server horizontal velocity (world units/s) for local dead reckoning. */
  private selfServerVx = 0;
  private selfServerVz = 0;
  /** Client-only wardrobe shop try-on overrides (not persisted until equip/buy). */
  private selfCosmeticPreview: {
    aura?: string | null;
    nameplate?: string | null;
    chatBubble?: string | null;
    trail?: string | null;
  } = {};
  /**
   * Preset Gallery try-on. Separate from `selfCosmeticPreview` (the wardrobe's ephemeral
   * preview channel) so that world interactions which clear the wardrobe preview - e.g.
   * tapping/right-clicking the ground to move opens a context menu that dismisses any open
   * profile and fires `onRevertAllPreview` - can't wipe a gallery try-on. This channel only
   * clears when the player leaves the gallery room.
   */
  private galleryTryOnSlots: {
    aura?: string | null;
    nameplate?: string | null;
    chatBubble?: string | null;
    trail?: string | null;
  } = {};
  private readonly cosmeticGalleryEntries: Array<{
    showcase: CosmeticGalleryShowcaseWire;
    group: THREE.Group | null;
    plaque: THREE.Sprite;
    plaqueMat: THREE.SpriteMaterial;
    plaqueTex: THREE.CanvasTexture;
    chatBubble?: {
      sprite: THREE.Sprite;
      mat: THREE.SpriteMaterial;
      tex: THREE.CanvasTexture;
      width: number;
      height: number;
    };
    player: PlayerState;
    deployableFx: PersistentDeployableFx | null;
    /** +1 / −1 while pacing a trail lane along +Z. */
    galleryLaneDir?: 1 | -1;
  }> = [];
  /** Nearest gallery showcase for the local player (Preset Gallery try-on). */
  private galleryNearestShowcase: CosmeticGalleryShowcaseWire | null = null;
  private galleryTryOnUi: HTMLElement | null = null;
  private galleryTryOnDeployablePreset: string | null = null;
  private galleryTryOnDeployableFx: PersistentDeployableFx | null = null;
  private selfPlayerSnapshot: PlayerState | null = null;
  private readonly selfExtrapGoal = new THREE.Vector3();
  private readonly others = new Map<string, THREE.Group>();
  private readonly chatBubbleByAddress = new Map<string, ChatBubbleEntry>();
  private readonly typingIndicatorByAddress = new Map<string, TypingIndicatorEntry>();
  private readonly floatingTexts = new Map<string, FloatingTextEntry>();
  private readonly targetPos = new Map<string, THREE.Vector3>();
  /** Remote avatar path playback from server `moveOrder` (dual-send tracer). */
  private readonly remoteMoveOrders = new Map<
    string,
    MoveOrderWire & { startY: number }
  >();
  /** Local grid-path walk while tick stateDelta omits pose (move-order rollout). */
  private selfMoveOrder: (MoveOrderWire & { startY: number }) | null = null;
  // worldcup: seasonal soccer ball meshes + interpolation targets + goal frames
  private readonly worldcupBalls = new Map<string, THREE.Mesh>();
  private readonly worldcupBallTargets = new Map<
    string,
    { x: number; z: number; vx: number; vz: number; recvMs: number }
  >();
  private worldcupGoalsGroup: THREE.Group | null = null;
  // worldcup: server-controlled Goalie objects (identicon billboard + keeper ring) +
  // lateral interpolation targets.
  private readonly worldcupGoalies = new Map<string, THREE.Group>();
  private readonly worldcupGoalieTargets = new Map<
    string,
    { x: number; z: number; recvMs: number }
  >();
  /** Shared "house keeper" identicon texture (one fixed face for every Goalie). */
  private worldcupGoalieIdenticonTex: THREE.CanvasTexture | null = null;
  // worldcup: floating "open to 1v1" Challenge badge above players who raised one.
  private readonly worldcupChallengeBubbles = new Map<string, THREE.Sprite>();
  private worldcupChallengeBubbleTex: THREE.CanvasTexture | null = null;
  private worldcupChallengeBubbleAcceptTex: THREE.CanvasTexture | null = null;
  /** Left-click / tap the accept tick to start a 1v1 without opening the player menu. */
  private challengeAcceptHandler: ((targetAddress: string) => void) | null = null;
  /** Achievement Unlock Celebration: active trophy pops above avatars. */
  private readonly achievementCelebrationSprites: AchievementCelebrationSprite[] =
    [];
  private achievementCelebrationNextId = 0;
  private readonly achievementCelebrationPlayAt = new Map<string, number>();
  private readonly achievementCelebrationStaggerTimers = new Set<
    ReturnType<typeof setTimeout>
  >();
  private achievementCelebrationTexture: THREE.CanvasTexture | null = null;
  /** worldcup: live 1v1 spectate portals in the current room (matchId = pitch room id). */
  private readonly worldcupPortals = new Map<
    string,
    {
      group: THREE.Group;
      mat: THREE.SpriteMaterial;
      /** Footprint tile you stand on to raise the "Watch" intent pill (door-like). */
      tileX: number;
      tileZ: number;
      full: boolean;
    }
  >();
  /** worldcup: visual-only floating joystick the game drives; null off touch hosts. */
  private worldcupJoystickView: WorldcupJoystickView | null = null;
  /** worldcup: true only when the joystick may engage (touch host, on the pitch, not spectating). */
  private worldcupJoystickEnabled = false;
  /** worldcup: Tap (tap-to-walk) vs Joystick (drag stick only) on the pitch. */
  private worldcupPitchMovementMode: "tap" | "joystick" = "tap";
  /**
   * worldcup: while true (post-goal kickoff countdown) the local player is frozen - tap-to-move and
   * the joystick are suppressed. The server also rejects moves, this just keeps the UI honest.
   */
  private worldcupMoveLocked = false;
  /** worldcup: active floating-stick steering session (one finger owns it). */
  private worldcupStick: {
    pointerId: number;
    dx: number;
    dy: number;
    timer: number | null;
  } | null = null;
  /** Single-finger pitch drag past this (px) turns a deferred walk into the floating joystick. */
  private static readonly WORLDCUP_STICK_ENGAGE_PX = 14;
  /** Throttle of held-direction emits (ms). Matches the pitch moveTo rate limit (50ms). */
  private static readonly WORLDCUP_STICK_EMIT_MS = 50;
  private worldcupCrowd: WorldcupCrowd | null = null;
  /** Previous-day champion country (ISO alpha-2) the crowd waves; persists across rebuilds. */
  private worldcupCrowdFlag: string | null = null;
  /** 1v1 Match crowd split (side a / side b country codes); applied on a Match Pitch. */
  private worldcupCrowdSideFlags: { a: string | null; b: string | null } | null = null;
  /** Free Play crowd allegiance: distinct country codes of players currently on the field. */
  private worldcupCrowdRoster: string[] = [];
  /** worldcup: normalized addresses of the two Match participants; everyone else in a Match
   *  Pitch is a Spectator (seated on the stands, can't touch the ball). */
  private readonly worldcupMatchParticipants = new Set<string>();
  /** worldcup: true while the local player is a Spectator (camera frames + locks to the pitch). */
  private worldcupSpectatorView = false;
  /** worldcup: attacking-goal arrow above the local Match player's target net (null otherwise). */
  private worldcupGoalArrow: WorldcupGoalArrow | null = null;
  /** worldcup: which side the live attacking-goal arrow is for, so it isn't rebuilt every tick. */
  private worldcupGoalArrowSide: "a" | "b" | null = null;
  private ro: ResizeObserver;
  private tileHighlight: THREE.Mesh;
  private readonly tileHighlightMat: THREE.MeshBasicMaterial;
  private readonly defaultTileHoverOutline: THREE.Mesh;
  private readonly defaultTileHoverOutlineMat: THREE.MeshBasicMaterial;
  private tileClickHandler:
    | ((x: number, z: number, layer?: 0 | 1) => void)
    | null = null;
  /** worldcup: send an un-rate-limited stop (touch-joystick release) so the player halts at once. */
  private worldcupStopMoveHandler: (() => void) | null = null;
  private placeBlockHandler: ((x: number, z: number) => void) | null = null;
  /** When set, next empty floor click in build mode sets teleporter destination X/Z. */
  private teleporterDestPickHandler: ((x: number, z: number) => void) | null =
    null;
  /** Readonly room layout preview (catalog / teleporter picker) - centered symmetric frustum. */
  private roomLayoutPreviewActive = false;
  /** Rooms catalog modal only: Hub-scale crop, baked tune, no pointer interaction. */
  private catalogPreviewActive = false;
  /** Dev tune: view-space frustum pan (x/y) and zoom scale (z). */
  private layoutPreviewTune = { ...LAYOUT_PREVIEW_DEFAULT_TUNE };
  private claimBlockHandler: ((x: number, z: number, y: number) => void) | null =
    null;
  private mineCooldownAttemptHandler: (() => void) | null = null;
  /**
   * Optional analytics slug for the next `beginBlockClaim` (set by {@link performClaimBlockAtWorld},
   * consumed in the client claim tick when `sendBeginBlockClaim` runs).
   */
  private blockClaimBeginIntent: string | null = null;
  /**
   * Walk mode: when the player reaches a gate tile orthogonally (after walk or already there),
   * run open / denied feedback - used for double-click on a gate and **Open gate** from the
   * context menu (see {@link queueWalkToGateThenInteract}).
   */
  private gateDoubleOpenHandler:
    | ((x: number, z: number, y: number) => void)
    | null = null;
  /** After {@link queueWalkToGateThenInteract}, fire {@link gateDoubleOpenHandler} once adjacent. */
  private pendingGateAdjacentInteract: {
    bx: number;
    bz: number;
    by: number;
  } | null = null;
  /** True only while {@link commitResolvedWalkGoal} runs for a gate-queued walk (clears other pending). */
  private gateWalkQueuedFromGame = false;
  private lastGatePrimaryTap: { key: string; at: number } | null = null;
  private static readonly GATE_DOUBLE_TAP_MS = 420;
  private moveBlockHandler:
    | ((fromX: number, fromZ: number, toX: number, toZ: number) => void)
    | null = null;
  private obstacleSelectHandler: ((x: number, z: number, y: number) => void) | null =
    null;
  private placeExtraFloorHandler:
    | ((x: number, z: number, colorRgb: number, brushSize?: FloorBrushSize) => void)
    | null = null;
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
  private roomDeployablesAllowed = true;
  private roomJoinSpawnTile: {
    x: number;
    z: number;
    customized: boolean;
  } | null = null;
  private readonly roomEntrySpawnRing: THREE.Mesh;
  private readonly roomEntrySpawnRingMat: THREE.MeshBasicMaterial;
  private readonly tutorialMineHighlightRing: THREE.Mesh;
  private readonly tutorialMineHighlightRingMat: THREE.MeshBasicMaterial;
  private tutorialMineHighlightTile: { x: number; z: number } | null = null;
  /** Cinema `?stream=1` - no avatar, no movement or floor edits. */
  private streamObserverMode = false;
  private readonly extraFloorKeys = new Set<string>();
  /** Top color per extra floor tile (`tileKey` → 0xRRGGBB). */
  private readonly extraFloorColorByKey = new Map<string, number>();
  /** Custom tint on core/base walkable floor tiles (`tileKey` → 0xRRGGBB). */
  private readonly baseFloorColorByKey = new Map<string, number>();
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
  /** Tile key → instance index in the unified solid floor InstancedMesh (stream / large rooms). */
  private readonly walkableFloorSolidVisualIndex = new Map<string, number>();
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
  /** Top-only footprint for instanced visuals - avoids vertical box faces at tile seams. */
  private readonly walkableFloorTileTopGeom = new THREE.PlaneGeometry(1, 1);
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
  private placementCubeRotX = 0;
  private placementCubeRotY = 0;
  private placementCubeRotZ = 0;
  private placementColorRgb = DEFAULT_BLOCK_COLOR_RGB;
  /** Floor-expand hover / highlight tint (from build dock floor hue ring). */
  private floorPlacementColorRgb = TERRAIN_TILE_EXTRA_COLOR;
  /** N×N floor paintbrush size (1 = single tile). */
  private floorBrushSize: FloorBrushSize = 1;
  /** Alt-held or eyedropper button: sample floor color instead of painting. */
  private floorEyedropperActive = false;
  private floorEyedropperHoverHandler: ((rgb: number | null) => void) | null =
    null;
  private floorEyedropperSampleHandler: ((rgb: number) => void) | null = null;
  private placementPyramidBaseScale = 1;
  private placementHexRadiusScale = 1;
  private placementSphereRadiusScale = 1;
  private placementClaimable = false;
  /** Live props for the object-edit tile inspector 3D preview (null = panel closed). */
  private inspectorSelectionObstacle: ObstacleProps | null = null;
  /**
   * When set, the selection-slot canvas shows a teleporter pillar instead of block props
   * (placed teleporter editor has no `ObstacleProps` / `#tile-inspector-selection`).
   */
  private inspectorSelectionSpecialDockKind: "teleporter" | "billboard" | null =
    null;
  private inspectorSelectionBillboardId: string | null = null;
  /** `false` = configured / active (portal pillar); `true` = pending / dim pillar. */
  private inspectorSelectionTeleporterPending = false;
  private inspectorSelectionTeleporterTileRef: {
    x: number;
    z: number;
    y: number;
  } | null = null;
  /** Live pillar tint while the teleporter hue ring is dragged (before server echo). */
  private teleporterSelectionPreviewColorRgb: number | null = null;
  /** Tile coords for selection preview (gates need true tile for exit alignment). */
  private inspectorSelectionTileRef: { x: number; z: number; y: number } | null =
    null;
  /** Off-main-scene 1×1 tile + block mesh for build bar / object panel. */
  private inspectorPlacementPort: InspectorTilePreviewPort | null = null;
  private inspectorSelectionPort: InspectorTilePreviewPort | null = null;
  private wardrobeAvatarPreviewPort: WardrobeAvatarPreviewPort | null = null;
  private inspectorPlacementPreviewKind:
    | "block"
    | "teleporter"
    | "gate"
    | "unlock-pad"
    | "billboard"
    | "signpost" = "block";
  /** Off-DOM inspector-style port used only to bake dock `<img>` thumbnails. */
  private dockStripBakePort: InspectorTilePreviewPort | null = null;
  private readonly dockStripThumbByTool = new Map<
    "teleporter" | "gate" | "unlock-pad" | "billboard" | "signpost",
    { sig: string; dataUrl: string }
  >();
  private readonly dockStripThumbByTerrainShape = new Map<
    "cube" | "hex" | "pyramid" | "sphere" | "ramp",
    { sig: string; dataUrl: string }
  >();
  private readonly dockStripThumbByPrefabDesign = new Map<
    string,
    { sig: string; dataUrl: string }
  >();
  private dockStripThumbFloor: { sig: string; dataUrl: string } | null = null;
  /** Subset of tile keys that block pathfinding (not passable). */
  private readonly blockingTileKeys = new Set<string>();
  private readonly blockMeshes = new Map<string, THREE.Group>();
  /** Instanced plain opaque cubes (see `syncPlainCubeInstancedMeshes`). */
  private readonly plainCubeInstancedMeshes: THREE.InstancedMesh[] = [];
  private readonly plainCubeInstancedTileKeys = new Set<string>();
  private readonly blockPickRootsBuf: THREE.Object3D[] = [];
  private plainCubeInstanceRenderSig = "";
  private readonly plainCubeInstanceDummy = new THREE.Object3D();
  /** After "Move", next click on an empty tile relocates the object. */
  private repositionFrom: FloorTile | null = null;
  /** Destination tile + layer; remaining route is recomputed each frame from current position. */
  private pathGoal: {
    ft: FloorTile;
    layer: 0 | 1;
    /** Unreachable path stays silent (gate walk goals). */
    suppressCantMoveMessage?: boolean;
    /** worldcup: exact float destination for free (any-direction) pitch movement. */
    world?: { x: number; z: number };
  } | null = null;
  /**
   * Optional route shown while primary button is held before `pointerup` (deferred walk).
   * Does not send movement to the server; cleared when the real `pathGoal` is set.
   */
  private pathPreviewGoal: {
    ft: FloorTile;
    layer: 0 | 1;
    suppressCantMoveMessage?: boolean;
    /** worldcup: exact float destination for the straight pitch preview line. */
    world?: { x: number; z: number };
  } | null = null;
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
  /** Unsaved “this room” exit tile while editing teleporter destination in the build dock. */
  private readonly teleporterDraftDestHighlight: THREE.Mesh;
  private readonly teleporterDraftDestHighlightMat: THREE.MeshBasicMaterial;
  private teleporterEditDestDraft: { x: number; z: number } | null = null;
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
  /** Scratch for projecting room ground samples into camera view space (ortho frustum fit). */
  private readonly frustumFitScratch = new THREE.Vector3();
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
  /** Stream / cinema presentation: detached or follow-remote camera instead of self. */
  private streamCameraMode: "followSelf" | "detached" | "followAddress" =
    "followSelf";
  private streamFollowAddress: string | null = null;
  private streamPresentationActive = false;
  private streamBubblesHidden = false;
  private streamPanEnabled = false;
  private streamPanVelX = 0;
  private streamPanVelZ = 0;
  private streamPanTune: StreamPanTune = {
    speed: 11,
    marginNorth: 0,
    marginSouth: 0,
    marginWest: 1,
    marginEast: 0,
  };
  private viewInterestReporter: ((rect: ViewInterestRect) => void) | null = null;
  private lastViewInterestSig = "";
  private lastViewInterestSentAt = 0;
  /** Stream: never shrink reported interest below the max seen (keeps server chunks loaded). */
  private streamInterestHalfW = 0;
  private streamInterestHalfH = 0;
  private streamInterestCenterOverride: { x: number; z: number } | null = null;
  private continuousRenderForced = false;
  private fogEnabledBeforeStream: boolean | null = null;
  private zoomFrustumAnim: {
    from: number;
    to: number;
    startedAtMs: number;
    durationMs: number;
  } | null = null;
  private lookAtAnim: {
    fromX: number;
    fromY: number;
    fromZ: number;
    toX: number;
    toY: number;
    toZ: number;
    startedAtMs: number;
    durationMs: number;
  } | null = null;
  /** 0 = stream top-down; 1 = normal isometric (smooth blend for player spotlight). */
  private streamCameraPoseBlend = 0;
  private streamCameraPoseAnim: {
    from: number;
    to: number;
    startedAtMs: number;
    durationMs: number;
  } | null = null;
  private readonly streamTopDownUpScratch = new THREE.Vector3(0, 0, -1);
  /** Look-ahead offset based on movement direction (world units). */
  private readonly cameraLookAhead = new THREE.Vector3(0, 0, 0);
  private readonly cameraLookAheadSmoothing = 8;
  /** Previous position for velocity calculation. */
  private selfPrevPos = new THREE.Vector3(0, 0, 0);
  
  /** Orthographic vertical half-extent (world units); smaller = zoomed in. */
  private frustumSize: number;
  private zoomMin: number;
  private zoomMax: number;
  /** Raised for large rooms so max zoom-out can frame the full base grid (see `zoomMaxForRoomBounds`). */
  private roomZoomMax = DEFAULT_ZOOM_MAX;
  /** Admins (and stream cinema) may zoom out / subscribe to wide map regions. */
  private mapOverviewUnlocked = false;
  private zoomLocked = false;
  private zoomLockedFrustum: number | null = null;
  private telescopeCapabilityUnlocked = false;
  private telescopeHoldRestoreFrustum: number | null = null;
  private telescopeHoldSavedMapOverview = false;
  private telescopeHoldActive = false;
  private telescopeReturnAnimPending = false;
  private readonly fogOfWar: FogOfWarPass;
  /** Extra highlight on solid block tops when hovering in walk mode. */
  private readonly blockTopHighlight: THREE.Mesh;
  /** Server max place distance (world units); 0 = unlimited (no ring overlay). */
  private placeRadiusBlocks = 9;
  private readonly placementHintGeom: THREE.PlaneGeometry;
  private readonly placementHintMat: THREE.MeshBasicMaterial;
  private readonly placementHintMeshes = new Map<string, THREE.Mesh>();
  /** Floor paint mode: white perimeter of the build zone (no fill overlay). */
  private readonly floorBuildOutlineMat: THREE.LineBasicMaterial;
  private floorBuildOutlineLines: THREE.LineSegments | null = null;
  private readonly floorHoverOutlineValidMat: THREE.LineBasicMaterial;
  private readonly floorHoverOutlineInvalidMat: THREE.LineBasicMaterial;
  private floorHoverOutlineValidLines: THREE.LineSegments | null = null;
  private floorHoverOutlineInvalidLines: THREE.LineSegments | null = null;
  private readonly floorHoverPreviewGeom: THREE.PlaneGeometry;
  private readonly floorHoverPreviewMat: THREE.MeshBasicMaterial;
  private readonly floorHoverPreviewMeshes: THREE.Mesh[] = [];
  private floorHoverPreviewTiles: Array<{ x: number; z: number }> = [];
  /** Gate tool: soft green/red on exit vs front neighbor tiles (matches server gate layout rules). */
  private gateFloorHintsActive = false;
  private repositionGateHint: {
    fromX: number;
    fromZ: number;
    fromYLevel: number;
    exitX: number;
    exitZ: number;
    colorRgb: number;
    rampDir: number;
    quarter: boolean;
    half: boolean;
    adminAddress: string;
    authorizedAddresses: string[];
  } | null = null;
  /**
   * While repositioning a gate, the placed mesh at the source tile keeps this exit (world coords)
   * so panel/server preview updates do not rotate the solid block - only the transparent ghost does.
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

  /** Right-click / long-press walkable floor or mineable block (walk mode) - HUD world context menu. */
  private worldTileContextOpener:
    | ((p: {
        clientX: number;
        clientY: number;
        mine: { x: number; z: number; y: number } | null;
        walkAt: { clientX: number; clientY: number } | null;
        signboard: {
          id: string;
          x: number;
          z: number;
          message: string;
          createdBy: string;
          createdAt: number;
        } | null;
      }) => void)
    | null = null;

  /** Right-click / long-press other human (non-NPC) avatar - HUD context menu. */
  private otherPlayerContextOpener:
    | ((p: {
        targets: Array<{
          address: string;
          displayName: string;
          challengeOpen?: boolean;
        }>;
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
    targets: Array<{
      address: string;
      displayName: string;
      challengeOpen?: boolean;
    }>;
    emoteRowFirst: boolean;
  } | null = null;
  private static readonly OTHER_PROFILE_LONGPRESS_MS = 480;
  private static readonly OTHER_PROFILE_LONGPRESS_MOVE_PX = 14;
  /** On-screen height of the floating signpost hint icon (px at current zoom). */
  private static readonly SIGNPOST_HINT_SCREEN_PX = 28;
  /** World-space bounce amplitude for the signpost hint (subtle). */
  private static readonly SIGNPOST_HINT_BOUNCE_AMP = 0.042;

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
  /** Floor tile key → Attention Marker wire + mesh. */
  private readonly attentionMarkers = new Map<
    string,
    { data: AttentionMarkerWire; group: THREE.Group; baseY: number }
  >();
  /** When true, build picks prefer Attention Markers over co-occupants. */
  private attentionMarkerToolActive = false;
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
  /** Floor `tileKey` for the signboard under the cursor (HUD hover); drives hint opacity. */
  private signboardHoverFloorKey: string | null = null;
  /** Last signboard id sent to the hover handler - skips redundant HUD updates on pointermove. */
  private signboardHoverActiveId: string | null = null;

  private billboardSyncGen = 0;
  private readonly billboardRoots = new Map<string, THREE.Group>();
  private readonly billboardSpecs = new Map<string, BillboardState>();
  /**
   * Floor (y=0) tile keys `x,z` under a billboard footprint - server stores passable
   * half-height markers for walkability; we skip drawing them so only the plane shows.
   */
  private readonly billboardFootprintFloorKeys = new Set<string>();
  /** When set, selection outline follows the billboard plane (not floor block AABB). */
  private selectedBillboardId: string | null = null;
  /** Browser `setInterval` id (numeric). */
  private readonly billboardTimers = new Map<string, number>();
  /** Billboard tool: show footprint + ghost before modal. */
  private billboardPlacementPreview = false;
  /** Teleporter tool: dim portal pillar instead of block mesh. */
  private teleporterPlacementPreviewActive = false;
  private teleporterPreviewPillarMesh: THREE.Mesh | null = null;
  private teleporterPreviewPillarSig = "";
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
    /** Last Images vs Other vs Campaign tab (restored when reopening the modal). */
    billboardSourceTab: "images" | "other" | "campaign";
    rotationSetId: string;
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
    rotationSetId: "",
  };
  private repositionBillboardId: string | null = null;
  private repositionDraftYaw = 0;
  private readonly billboardFootprintPreviewGeom: THREE.PlaneGeometry;
  private readonly billboardFootprintPreviewValidMat: THREE.MeshBasicMaterial;
  private readonly billboardFootprintPreviewInvalidMat: THREE.MeshBasicMaterial;
  private readonly billboardFootprintPreviewMeshes: THREE.Mesh[] = [];
  private readonly floorBrushPreviewGeom: THREE.PlaneGeometry;
  private readonly floorBrushPreviewValidMat: THREE.MeshBasicMaterial;
  private readonly floorBrushPreviewInvalidMat: THREE.MeshBasicMaterial;
  private readonly floorBrushPreviewMeshes: THREE.Mesh[] = [];
  /** Object prefab capture: drag rectangle on floor (wallet room, build mode). */
  private objectPrefabSaveActive = false;
  private prefabBboxDrag: {
    pointerId: number;
    startX: number;
    startZ: number;
    curX: number;
    curZ: number;
  } | null = null;
  private prefabBboxCompleteHandler: ((bbox: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  }) => void) | null = null;
  private prefabBboxStatsHandler:
    | ((stats: {
        footprintW: number;
        footprintD: number;
        tileCount: number;
        previewDataUrl: string | null;
      } | null) => void)
    | null = null;
  private readonly prefabSaveFootprintValidMat: THREE.MeshBasicMaterial;
  private readonly prefabSaveFootprintInvalidMat: THREE.MeshBasicMaterial;
  private readonly prefabSaveOutlineMat: THREE.LineBasicMaterial;
  private readonly prefabSaveFootprintMeshes: THREE.Mesh[] = [];
  private prefabSaveMeshGroup: THREE.Group | null = null;
  private prefabSaveMeshBboxSig = "";
  private prefabSaveHoverTile: { x: number; z: number } | null = null;
  /** Object prefab stamp: footprint ghost + click to place. */
  private objectPrefabPlaceActive = false;
  private prefabPlaceDesign: {
    id: string;
    footprintW: number;
    footprintD: number;
  } | null = null;
  private prefabPlaceYawSteps = 0;
  private prefabPlaceHandler:
    | ((anchorX: number, anchorZ: number, yawSteps: number) => void)
    | null = null;
  private prefabPlaceGhostValid = false;
  private prefabPlaceHoverAnchor: { x: number; z: number } | null = null;
  private prefabPlaceSnapshot: DesignSnapshotV1 | null = null;
  /** Design id the current {@link prefabPlaceSnapshot} was loaded for. */
  private prefabPlaceSnapshotDesignId: string | null = null;
  private prefabPlaceMeshGroup: THREE.Group | null = null;
  private prefabPlaceMeshTemplateSig = "";
  /**
   * Touch / coarse pointer: first tap arms preview at anchor; second tap on the same
   * valid anchor commits. {@link cancelPrefabPlacePreview} clears without placing.
   */
  private prefabPlaceArmedAnchor: { x: number; z: number } | null = null;
  private prefabPlacePreviewChangeHandler: (() => void) | null = null;
  /**
   * Floor `x,z` keys under the active prefab-place footprint - hide existing placed
   * blocks there so the solid preview shows the stamped result.
   */
  private readonly prefabPlaceSuppressFloorKeys = new Set<string>();
  private prefabPlaceSuppressFootprintSig = "";
  private billboardInteractGhost: THREE.Group | null = null;
  private billboardInteractGhostSig = "";
  private readonly billboardPreviewPlaceholderTex: THREE.CanvasTexture;
  /** Transparent 2×2 map so `SpriteMaterial` stays valid before the SVG rasterizes. */
  private readonly signpostHintPlaceholderTexture: THREE.CanvasTexture;
  /** Shared `duotone-document` raster for all signpost hint sprites. */
  private signpostHintDocTexture: THREE.CanvasTexture | null = null;
  private signpostHintDocTextureLoadStarted = false;

  /** Identicon sphere Euler (degrees); applied to all player avatars. */
  private identiconRotDeg = { x: 0, y: 0, z: 0 };
  /** Uniform scale of the identicon sphere mesh (texture “zoom” via size). */
  private identiconScale = 1;
  private readonly identiconEulerScratch = new THREE.Euler();
  private readonly cosmeticLastPos = new Map<string, { x: number; z: number; t: number }>();

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

    this.defaultTileHoverOutlineMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    // White square "frame" outline for the default hover. Border thickness is a single
    // tunable knob: oversized for now so it's clearly visible; scale down later.
    const hoverOutlineOuterHalf = 0.5;
    const hoverOutlineThickness = 0.045;
    const hoverOutlineInnerHalf = hoverOutlineOuterHalf - hoverOutlineThickness;
    const hoverOutlineShape = new THREE.Shape();
    hoverOutlineShape.moveTo(-hoverOutlineOuterHalf, -hoverOutlineOuterHalf);
    hoverOutlineShape.lineTo(hoverOutlineOuterHalf, -hoverOutlineOuterHalf);
    hoverOutlineShape.lineTo(hoverOutlineOuterHalf, hoverOutlineOuterHalf);
    hoverOutlineShape.lineTo(-hoverOutlineOuterHalf, hoverOutlineOuterHalf);
    hoverOutlineShape.lineTo(-hoverOutlineOuterHalf, -hoverOutlineOuterHalf);
    const hoverOutlineHole = new THREE.Path();
    hoverOutlineHole.moveTo(-hoverOutlineInnerHalf, -hoverOutlineInnerHalf);
    hoverOutlineHole.lineTo(-hoverOutlineInnerHalf, hoverOutlineInnerHalf);
    hoverOutlineHole.lineTo(hoverOutlineInnerHalf, hoverOutlineInnerHalf);
    hoverOutlineHole.lineTo(hoverOutlineInnerHalf, -hoverOutlineInnerHalf);
    hoverOutlineHole.lineTo(-hoverOutlineInnerHalf, -hoverOutlineInnerHalf);
    hoverOutlineShape.holes.push(hoverOutlineHole);
    this.defaultTileHoverOutline = new THREE.Mesh(
      new THREE.ShapeGeometry(hoverOutlineShape),
      this.defaultTileHoverOutlineMat
    );
    this.defaultTileHoverOutline.rotation.x = -Math.PI / 2;
    this.defaultTileHoverOutline.visible = false;
    this.defaultTileHoverOutline.frustumCulled = false;
    this.defaultTileHoverOutline.renderOrder = 2;
    this.scene.add(this.defaultTileHoverOutline);

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
    this.floorBuildOutlineMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      depthWrite: false,
    });
    this.floorHoverOutlineValidMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      depthWrite: false,
    });
    this.floorHoverOutlineInvalidMat = new THREE.LineBasicMaterial({
      color: 0xef4444,
      depthWrite: false,
    });
    this.floorHoverPreviewGeom = new THREE.PlaneGeometry(1, 1);
    this.floorHoverPreviewMat = new THREE.MeshBasicMaterial({
      color: TERRAIN_TILE_EXTRA_COLOR,
      transparent: true,
      opacity: 0.62,
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
    this.floorBrushPreviewGeom = new THREE.PlaneGeometry(0.92, 0.92);
    this.floorBrushPreviewValidMat = new THREE.MeshBasicMaterial({
      color: TERRAIN_TILE_EXTRA_COLOR,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    this.floorBrushPreviewInvalidMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    });
    this.prefabSaveFootprintValidMat = new THREE.MeshBasicMaterial({
      color: 0x4ade80,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    this.prefabSaveFootprintInvalidMat = new THREE.MeshBasicMaterial({
      color: 0xf87171,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    this.prefabSaveOutlineMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      depthTest: true,
      depthWrite: false,
    });
    this.billboardPreviewPlaceholderTex = makeFallbackBillboardTexture();

    {
      const c = document.createElement("canvas");
      c.width = 2;
      c.height = 2;
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;
      this.signpostHintPlaceholderTexture = t;
    }
    void this.ensureSignpostHintDocTexture();

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

    this.teleporterDraftDestHighlightMat = new THREE.MeshBasicMaterial({
      color: 0x22c55e,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
    });
    this.teleporterDraftDestHighlight = new THREE.Mesh(
      new THREE.PlaneGeometry(0.92, 0.92),
      this.teleporterDraftDestHighlightMat
    );
    this.teleporterDraftDestHighlight.rotation.x = -Math.PI / 2;
    this.teleporterDraftDestHighlight.position.set(0, 0.026, 0);
    this.teleporterDraftDestHighlight.visible = false;
    this.scene.add(this.teleporterDraftDestHighlight);

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

    this.tutorialMineHighlightRingMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.tutorialMineHighlightRing = new THREE.Mesh(
      new THREE.RingGeometry(0.28, 0.48, 48),
      this.tutorialMineHighlightRingMat
    );
    this.tutorialMineHighlightRing.rotation.x = -Math.PI / 2;
    this.tutorialMineHighlightRing.visible = false;
    this.scene.add(this.tutorialMineHighlightRing);

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
    void ensureAchievementCelebrationTexture().then((tex) => {
      this.achievementCelebrationTexture = tex;
    });
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
    billboardId: string;
    campaignId?: string;
    visitName: string;
    visitUrl: string;
    miniappTargetUrl?: string;
  } | null {
    if (!this.selfMesh) return null;
    const t = snapFloorTile(this.selfMesh.position.x, this.selfMesh.position.z);
    const hit = pickBillboardVisitOnFootprintTile(
      t.x,
      t.y,
      this.billboardSpecs.values(),
      Date.now()
    );
    if (!hit?.visitUrl && !hit?.miniappTargetUrl) return null;
    return {
      billboardId: hit.id,
      campaignId: hit.campaignId,
      visitName: hit.visitName,
      visitUrl: hit.visitUrl,
      miniappTargetUrl: hit.miniappTargetUrl,
    };
  }

  /** Iterable billboard specs for campaign proximity analytics. */
  iterBillboardSpecs(): Iterable<BillboardState> {
    return this.billboardSpecs.values();
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
    return this.getWorldScreenPosition(
      this.selfMesh.position.x,
      this.selfMesh.position.y + yOffset,
      this.selfMesh.position.z
    );
  }

  /** Canvas-local screen position for a world point (e.g. teleporter Set pill anchor). */
  getWorldScreenPosition(
    wx: number,
    wy: number,
    wz: number
  ): { x: number; y: number } | null {
    const world = new THREE.Vector3(wx, wy, wz);
    const projected = world.project(this.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    const sx = ((projected.x + 1) * 0.5) * rect.width;
    const sy = ((1 - projected.y) * 0.5) * rect.height;
    if (!Number.isFinite(sx) || !Number.isFinite(sy)) return null;
    return { x: sx, y: sy };
  }

  getTileScreenPosition(
    tileX: number,
    tileZ: number,
    yOffset = 1.15
  ): { x: number; y: number } | null {
    let wy = yOffset;
    for (let y = 0; y <= 2; y++) {
      const meta = this.getPlacedAt(tileX, tileZ, y);
      if (meta) {
        wy = y * BLOCK_SIZE + this.obstacleHeight(meta) * this.blockVisualScale + yOffset;
        break;
      }
    }
    return this.getWorldScreenPosition(tileX, wy, tileZ);
  }

  /** Viewport coordinates for HUD pills anchored to a floor tile (e.g. teleporter Set). */
  getTileViewportPosition(
    tileX: number,
    tileZ: number,
    yOffset = 1.15
  ): { x: number; y: number } | null {
    const local = this.getTileScreenPosition(tileX, tileZ, yOffset);
    if (!local) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    return { x: rect.left + local.x, y: rect.top + local.y };
  }

  /** Canvas-local screen position of the primary World Cup ball (id `"field"` when present). */
  getPrimaryWorldcupBallScreenPosition(): {
    x: number;
    y: number;
    radius: number;
  } | null {
    const mesh =
      this.worldcupBalls.get("field") ??
      this.worldcupBalls.values().next().value;
    if (!mesh) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const project = (wx: number, wy: number, wz: number) => {
      const world = new THREE.Vector3(wx, wy, wz);
      world.project(this.camera);
      const sx = ((world.x + 1) * 0.5) * rect.width;
      const sy = ((1 - world.y) * 0.5) * rect.height;
      if (!Number.isFinite(sx) || !Number.isFinite(sy)) return null;
      return { x: sx, y: sy };
    };
    const center = project(
      mesh.position.x,
      mesh.position.y,
      mesh.position.z
    );
    if (!center) return null;
    const edge = project(
      mesh.position.x + Game.WORLDCUP_BALL_RADIUS,
      mesh.position.y,
      mesh.position.z
    );
    const radius = edge
      ? Math.max(4, Math.hypot(edge.x - center.x, edge.y - center.y))
      : 12;
    return { x: center.x, y: center.y, radius };
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
    this.syncRoomZoomMaxFromBounds(msg.roomBounds);
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
    this.extraFloorColorByKey.clear();
    this.baseFloorColorByKey.clear();
    this.removedBaseFloorKeys.clear();

    // Clear block meshes from scene
    for (const [, mesh] of this.blockMeshes) {
      this.scene.remove(mesh);
      disposePlacedBlockGroupContents(mesh);
    }
    this.blockMeshes.clear();
    this.disposePlainCubeInstancedMeshes();
    this.clearTeleporterMarkers();

    // worldcup: balls + goalies are room-scoped; clear and rebuild goal frames per room
    this.clearWorldcupBalls();
    this.clearWorldcupGoalies();
    this.syncWorldcupGoals(normalizeRoomId(msg.roomId));

    this.rebuildDoorKeys();
    this.pathGoal = null;
    this.pathPreviewGoal = null;
    this.pendingGateAdjacentInteract = null;
    this.lastTerrainPath = null;
    this.selectedBlockKey = null;
    this.selectionOutline.visible = false;
    this.teleporterLinkHighlight.visible = false;
    this.teleporterDraftDestHighlight.visible = false;
    this.teleporterEditDestDraft = null;
    this.roomJoinSpawnTile = null;
    this.roomEntrySpawnRing.visible = false;
    this.tutorialMineHighlightTile = null;
    this.tutorialMineHighlightRing.visible = false;
    this.roomEntrySpawnPickHandler = null;
    this.hideTrailImmediate();
    this.beginPathFadeOut();
    this.clearCosmeticGallery();
    if (!roomUsesSpatialInterest(msg.roomBounds)) {
      this.syncWalkableFloorMeshes();
    }
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

  setRoomDeployablesAllowed(allowed: boolean): void {
    this.roomDeployablesAllowed = allowed;
  }

  showCosmeticDeployed(
    presetId: string,
    x: number,
    z: number,
    expiresAt: number
  ): void {
    spawnDeployableVfx(this.scene, presetId, x, z, expiresAt);
    this.requestRender();
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

  private syncTutorialMineHighlight(phaseSec: number): void {
    const ring = this.tutorialMineHighlightRing;
    const tile = this.tutorialMineHighlightTile;
    if (!tile) {
      ring.visible = false;
      return;
    }
    ring.position.set(
      tile.x,
      0.05 + 0.014 * Math.sin(phaseSec * 3.4),
      tile.z
    );
    const pulse = 1 + 0.08 * Math.sin(phaseSec * 2.6);
    ring.scale.set(pulse, pulse, 1);
    this.tutorialMineHighlightRingMat.opacity =
      0.62 + 0.28 * Math.sin(phaseSec * 2.1);
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
    return Math.min(1.12, Math.max(1.0, n));
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

  /**
   * Ortho half-height for max zoom-out in a room.
   * Hub (25 tiles) ≈ DEFAULT_ZOOM_MAX; large rooms scale up with diagonal span so the
   * isometric diamond fits even when the camera follows a spawn near one edge.
   */
  private static zoomMaxForRoomBounds(bounds: RoomBounds, roomId?: string): number {
    const id = roomId ? normalizeRoomId(roomId) : "";
    if (id === CHAMBER_ROOM_ID) {
      return CHAMBER_MAX_ZOOM_FRUSTUM;
    }
    if (id === HUB_ROOM_ID) {
      return HUB_MAX_ZOOM_FRUSTUM;
    }
    const w = bounds.maxX - bounds.minX + 1;
    const h = bounds.maxZ - bounds.minZ + 1;
    const tiles = Math.max(w, h);
    const perTile = DEFAULT_ZOOM_MAX / 25;
    const halfDiag = Math.hypot(w, h) * 0.5;
    const hubHalfDiag = 12.5 * Math.SQRT2;
    const diagZoom = (halfDiag / hubHalfDiag) * DEFAULT_ZOOM_MAX;
    const axisZoom = tiles * perTile;
    return Math.max(DEFAULT_ZOOM_MAX, diagZoom, axisZoom * 1.85);
  }

  private zoomLimitContext(telescopeHoldActive = this.telescopeHoldActive): ZoomLimitContext {
    return {
      zoomMax: this.zoomMax,
      roomZoomMax: this.roomZoomMax,
      roomId: this.roomId,
      roomBounds: this.roomBounds,
      mapOverviewUnlocked: this.mapOverviewUnlocked,
      streamPresentationActive: this.streamPresentationActive,
      telescopeHoldActive,
      mobilePortrait: isMobilePortraitDocument(),
    };
  }

  /** Max zoom-out without Telescope (room caps beat persisted zoomMax). */
  private normalZoomMax(): number {
    return computeNormalZoomMax(this.zoomLimitContext(false));
  }

  /** Frustum to animate toward while Telescope is held (null = no extra zoom in this room). */
  private telescopeHoldTargetFrustum(): number | null {
    return computeTelescopeHoldTargetFrustum(this.zoomLimitContext(false));
  }

  private effectiveZoomMax(): number {
    return computeEffectiveZoomMax(this.zoomLimitContext());
  }

  /** When false, large-room zoom-out and tile subscriptions stay near the player. */
  setMapOverviewUnlocked(unlocked: boolean): void {
    if (unlocked === this.mapOverviewUnlocked) return;
    this.mapOverviewUnlocked = unlocked;
    if (!this.telescopeHoldActive) {
      this.frustumSize = Game.clampZoom(
        this.frustumSize,
        this.zoomMin,
        this.effectiveZoomMax(),
        VIEW_FRUSTUM_SIZE
      );
    }
    this.applyOrthographicFrustum();
    this.lastViewInterestSig = "";
    this.maybeReportViewInterest();
    this.requestRender();
  }

  /** Achievement-gated Telescope hold-to-zoom (see `setTelescopeUnlocked`). */
  setTelescopeUnlocked(unlocked: boolean): void {
    this.telescopeCapabilityUnlocked = unlocked;
  }

  /** Hold-to-zoom-out (Telescope): temporarily widen map overview while held. */
  beginTelescopeHold(): void {
    if (
      this.zoomLocked ||
      this.streamPresentationActive ||
      !this.telescopeCapabilityUnlocked ||
      this.telescopeHoldActive
    ) {
      return;
    }
    const target = this.telescopeHoldTargetFrustum();
    if (target == null || !roomSupportsTelescopeBoost(this.zoomLimitContext(false))) {
      return;
    }
    this.telescopeHoldActive = true;
    this.telescopeReturnAnimPending = false;
    if (this.telescopeHoldRestoreFrustum === null) {
      this.telescopeHoldRestoreFrustum = this.frustumSize;
      this.telescopeHoldSavedMapOverview = this.mapOverviewUnlocked;
    }
    if (
      !this.mapOverviewUnlocked &&
      roomUsesSpatialInterest(this.roomBounds)
    ) {
      this.setMapOverviewUnlocked(true);
    }
    this.animateZoomFrustumTo(target, TELESCOPE_HOLD_ZOOM_MS);
  }

  endTelescopeHold(): void {
    if (!this.telescopeHoldActive) return;
    this.telescopeHoldActive = false;
    const restore = this.telescopeHoldRestoreFrustum;
    const hadOverview = this.telescopeHoldSavedMapOverview;
    if (!hadOverview) {
      this.setMapOverviewUnlocked(false);
    }
    if (restore == null || this.zoomLocked || this.streamPresentationActive) {
      this.telescopeHoldRestoreFrustum = null;
      this.telescopeReturnAnimPending = false;
      this.zoomFrustumAnim = null;
      return;
    }
    this.telescopeReturnAnimPending = true;
    this.animateZoomFrustumTo(restore, TELESCOPE_HOLD_ZOOM_MS);
  }

  private finishTelescopeReturnZoomAnim(): void {
    if (!this.telescopeReturnAnimPending || this.telescopeHoldActive) return;
    this.telescopeReturnAnimPending = false;
    this.telescopeHoldRestoreFrustum = null;
    this.telescopeHoldSavedMapOverview = false;
    if (!this.zoomLocked && !this.streamPresentationActive) {
      localStorage.setItem(LS_ZOOM_FRUSTUM, String(this.frustumSize));
    }
  }

  private syncRoomZoomMaxFromBounds(bounds: RoomBounds): void {
    this.roomZoomMax = Game.zoomMaxForRoomBounds(bounds, this.roomId);
    if (!this.telescopeHoldActive) {
      this.frustumSize = Game.clampZoom(
        this.frustumSize,
        this.zoomMin,
        this.effectiveZoomMax(),
        VIEW_FRUSTUM_SIZE
      );
    }
    if (this.streamPresentationActive) {
      this.resize();
    } else {
      this.applyOrthographicFrustum();
    }
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
    return { min: this.zoomMin, max: this.effectiveZoomMax() };
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
      this.effectiveZoomMax(),
      VIEW_FRUSTUM_SIZE
    );
    this.setZoomFrustumSize(this.zoomLockedFrustum, false);
  }

  setStreamPresentationActive(active: boolean): void {
    if (active === this.streamPresentationActive) return;
    this.streamPresentationActive = active;
    if (active) {
      this.fogEnabledBeforeStream = this.fogOfWar.getEnabled();
      this.fogOfWar.setEnabled(false);
      this.cameraLookAhead.set(0, 0, 0);
      this.streamCameraPoseBlend = 0;
      this.streamCameraPoseAnim = null;
      this.streamInterestHalfW = 0;
      this.streamInterestHalfH = 0;
      this.streamInterestCenterOverride = null;
      this.setStreamCameraMode("detached");
    } else {
      if (this.fogEnabledBeforeStream !== null) {
        this.fogOfWar.setEnabled(this.fogEnabledBeforeStream);
        this.fogEnabledBeforeStream = null;
      }
      this.setStreamCameraMode("followSelf");
      this.streamPanEnabled = false;
      this.streamCameraPoseBlend = 0;
      this.streamCameraPoseAnim = null;
      this.streamInterestHalfW = 0;
      this.streamInterestHalfH = 0;
      this.streamInterestCenterOverride = null;
      this.zoomFrustumAnim = null;
      this.lookAtAnim = null;
    }
    this.applyCameraPose();
    this.resize();
    this.tileHighlight.visible = false;
    this.blockTopHighlight.visible = false;
    this.clearFloorHoverVisuals();
    this.applyIdenticonTransformToAllAvatars();
    this.refreshAllNameLabelScales();
    this.requestRender();
  }

  setStreamBubblesHidden(hidden: boolean): void {
    this.streamBubblesHidden = hidden;
    if (hidden) {
      for (const addr of [...this.chatBubbleByAddress.keys()]) {
        this.removeChatBubbleEntry(addr);
      }
      for (const addr of [...this.typingIndicatorByAddress.keys()]) {
        this.removeTypingIndicator(addr);
      }
      this.clearAchievementCelebrations();
    }
    this.requestRender();
  }

  isStreamPresentationActive(): boolean {
    return this.streamPresentationActive;
  }

  /** 1 at isometric spotlight zoom; {@link STREAM_TOPDOWN_AVATAR_TILE_SPAN} at top-down overview. */
  private streamAvatarDisplaySizeMul(): number {
    if (!this.streamPresentationActive) return 1;
    const topDown = 1 - this.streamCameraPoseBlend;
    return 1 + (STREAM_TOPDOWN_AVATAR_TILE_SPAN - 1) * topDown;
  }

  private avatarIdenticonWorldDiameter(): number {
    return (
      AVATAR_SPHERE_RADIUS * 2 * this.identiconScale * this.streamAvatarDisplaySizeMul()
    );
  }

  /** World XZ center of the current room base bounds (for stream overview framing). */
  getRoomLookAtCenter(): { x: number; y: number; z: number } {
    const b = this.roomBounds;
    return {
      x: (b.minX + b.maxX) / 2,
      y: 0,
      z: (b.minZ + b.maxZ) / 2,
    };
  }

  /** Stream overview zoom - slightly inset on large rooms so pan can sweep edge-to-edge. */
  getStreamOverviewFrustumSize(): number {
    const max = this.effectiveZoomMax();
    if (!this.streamPresentationActive) return max;
    if (!roomUsesSpatialInterest(this.roomBounds)) return max;
    return max * 0.52;
  }

  getStreamPanTune(): StreamPanTune {
    return { ...this.streamPanTune };
  }

  setViewInterestReporter(
    reporter: ((rect: ViewInterestRect) => void) | null
  ): void {
    this.viewInterestReporter = reporter;
    this.lastViewInterestSig = "";
  }

  getViewInterestRect(): ViewInterestRect | null {
    if (!roomUsesSpatialInterest(this.roomBounds)) return null;
    const cx = this.streamInterestCenterOverride?.x ?? this.cameraLookAt.x;
    const cz = this.streamInterestCenterOverride?.z ?? this.cameraLookAt.z;
    const pad = VIEW_INTEREST_PADDING_TILES;
    let halfW: number;
    let halfH: number;
    if (this.streamPresentationActive) {
      const w = this.canvasHost.clientWidth;
      const h = this.canvasHost.clientHeight;
      const fit = this.getStreamFrustumHalfExtentsFinal(w, h);
      halfW = fit.halfW + pad;
      halfH = fit.halfH + pad;
      this.streamInterestHalfW = Math.max(this.streamInterestHalfW, halfW);
      this.streamInterestHalfH = Math.max(this.streamInterestHalfH, halfH);
      halfW = this.streamInterestHalfW;
      halfH = this.streamInterestHalfH;
    } else {
      const w = this.canvasHost.clientWidth;
      const h = this.canvasHost.clientHeight;
      const aspect = w > 0 && h > 0 ? w / h : 1;
      halfH = this.frustumSize / 2 + pad;
      halfW = halfH * aspect + pad;
      if (!this.mapOverviewUnlocked) {
        halfH = Math.min(halfH, NON_ADMIN_MAX_INTEREST_HALF_TILES);
        halfW = Math.min(halfW, NON_ADMIN_MAX_INTEREST_HALF_TILES);
      }
    }
    return { centerX: cx, centerZ: cz, halfW, halfH };
  }

  /** Before zoom-out, widen interest to cover the full room so cached tiles stay subscribed. */
  expandStreamViewInterestForOverview(): void {
    if (!this.streamPresentationActive || !roomUsesSpatialInterest(this.roomBounds)) {
      return;
    }
    const b = this.roomBounds;
    const pad = VIEW_INTEREST_PADDING_TILES;
    const roomHalfW = (b.maxX - b.minX + 1) * 0.5 + pad;
    const roomHalfH = (b.maxZ - b.minZ + 1) * 0.5 + pad;
    this.streamInterestCenterOverride = {
      x: (b.minX + b.maxX + 1) * 0.5,
      z: (b.minZ + b.maxZ + 1) * 0.5,
    };
    this.streamInterestHalfW = Math.max(this.streamInterestHalfW, roomHalfW);
    this.streamInterestHalfH = Math.max(this.streamInterestHalfH, roomHalfH);
    this.lastViewInterestSig = "";
    this.maybeReportViewInterest();
  }

  refreshStreamViewInterest(): void {
    this.lastViewInterestSig = "";
    this.maybeReportViewInterest();
  }

  private spatialStreamRetainLoaded(): boolean {
    return (
      this.streamPresentationActive &&
      roomUsesSpatialInterest(this.roomBounds)
    );
  }

  private maybeReportViewInterest(): void {
    const reporter = this.viewInterestReporter;
    if (!reporter) return;
    const rect = this.getViewInterestRect();
    if (!rect) return;
    const sig = `${rect.centerX.toFixed(1)},${rect.centerZ.toFixed(1)},${rect.halfW.toFixed(1)},${rect.halfH.toFixed(1)}`;
    const now = performance.now();
    if (sig === this.lastViewInterestSig && now - this.lastViewInterestSentAt < 400) {
      return;
    }
    this.lastViewInterestSig = sig;
    this.lastViewInterestSentAt = now;
    reporter(rect);
  }

  setStreamPanTune(partial: Partial<StreamPanTune>): void {
    const prev = this.streamPanTune;
    const next: StreamPanTune = {
      speed:
        partial.speed !== undefined && Number.isFinite(partial.speed)
          ? Math.max(0.5, Math.min(40, partial.speed))
          : prev.speed,
      marginNorth:
        partial.marginNorth !== undefined && Number.isFinite(partial.marginNorth)
          ? Math.max(0, Math.min(200, partial.marginNorth))
          : prev.marginNorth,
      marginSouth:
        partial.marginSouth !== undefined && Number.isFinite(partial.marginSouth)
          ? Math.max(0, Math.min(200, partial.marginSouth))
          : prev.marginSouth,
      marginWest:
        partial.marginWest !== undefined && Number.isFinite(partial.marginWest)
          ? Math.max(0, Math.min(200, partial.marginWest))
          : prev.marginWest,
      marginEast:
        partial.marginEast !== undefined && Number.isFinite(partial.marginEast)
          ? Math.max(0, Math.min(200, partial.marginEast))
          : prev.marginEast,
    };
    this.streamPanTune = next;
    if (partial.speed !== undefined) {
      const mag = Math.hypot(this.streamPanVelX, this.streamPanVelZ);
      if (mag > 1e-6) {
        const scale = next.speed / mag;
        this.streamPanVelX *= scale;
        this.streamPanVelZ *= scale;
      }
    }
    this.requestRender();
  }

  getStreamPanDebugInfo(): StreamPanDebugInfo | null {
    if (!this.streamPresentationActive) return null;
    const w = this.canvasHost.clientWidth;
    const h = this.canvasHost.clientHeight;
    const { halfW, halfH } = this.getStreamFrustumHalfExtentsFinal(w, h);
    if (halfW <= 0 || halfH <= 0) return null;
    const lookX = this.cameraLookAt.x;
    const lookZ = this.cameraLookAt.z;
    const corners = this.streamViewCorners(lookX, lookZ, halfW, halfH);
    const limits = this.streamPanLookAtLimits();
    const room = this.streamRoomOuterBounds();
    return {
      lookX,
      lookZ,
      halfW,
      halfH,
      west: corners.west,
      east: corners.east,
      north: corners.north,
      south: corners.south,
      roomMinZ: room.minZ,
      roomMaxZ: room.maxZ,
      limitMinX: limits?.minX ?? lookX,
      limitMaxX: limits?.maxX ?? lookX,
      limitMinZ: limits?.minZ ?? lookZ,
      limitMaxZ: limits?.maxZ ?? lookZ,
      tune: this.getStreamPanTune(),
    };
  }

  setStreamPanEnabled(
    enabled: boolean,
    opts?: { resetLookAt?: boolean }
  ): void {
    this.streamPanEnabled = enabled;
    if (enabled) {
      const resetLookAt = opts?.resetLookAt !== false;
      if (resetLookAt) {
        const c = this.getRoomLookAtCenter();
        this.cameraLookAt.x = c.x;
        this.cameraLookAt.z = c.z;
      }
      const speed = this.streamPanTune.speed;
      const velMag = Math.hypot(this.streamPanVelX, this.streamPanVelZ);
      if (resetLookAt || velMag < 0.01) {
        const angle = Math.PI * 0.27;
        this.streamPanVelX = Math.cos(angle) * speed;
        this.streamPanVelZ = Math.sin(angle) * speed;
      }
      this.applyCameraPose();
      this.applyOrthographicFrustum();
    } else {
      this.streamPanVelX = 0;
      this.streamPanVelZ = 0;
    }
    this.requestRender();
  }

  setContinuousRender(enabled: boolean): void {
    this.continuousRenderForced = enabled;
    if (enabled) this.requestRender();
  }

  setStreamCameraMode(
    mode: "followSelf" | "detached" | "followAddress",
    followAddress?: string | null
  ): void {
    this.streamCameraMode = mode;
    this.streamFollowAddress =
      mode === "followAddress" ? (followAddress?.trim() || null) : null;
  }

  setCameraLookAtTarget(
    x: number,
    y: number,
    z: number,
    opts?: { instant?: boolean; durationMs?: number }
  ): void {
    const durationMs = opts?.durationMs ?? 0;
    if (opts?.instant || durationMs <= 0) {
      this.lookAtAnim = null;
      this.cameraLookAt.set(x, y, z);
      this.applyCameraPose();
      this.requestRender();
      return;
    }
    this.lookAtAnim = {
      fromX: this.cameraLookAt.x,
      fromY: this.cameraLookAt.y,
      fromZ: this.cameraLookAt.z,
      toX: x,
      toY: y,
      toZ: z,
      startedAtMs: performance.now(),
      durationMs,
    };
    this.requestRender();
  }

  /** Blend stream camera between top-down (0) and isometric (1). */
  animateStreamCameraPoseTo(target: number, durationMs: number): void {
    const to = Math.max(0, Math.min(1, target));
    if (durationMs <= 0) {
      this.streamCameraPoseAnim = null;
      this.streamCameraPoseBlend = to;
      this.applyCameraPose();
      this.applyOrthographicFrustum();
      this.applyIdenticonTransformToAllAvatars();
      this.refreshChatBubbleVerticalPositions();
      this.refreshWorldcupChallengeBubbleLayouts();
      this.refreshAllTypingIndicatorLayouts();
      this.requestRender();
      return;
    }
    this.streamCameraPoseAnim = {
      from: this.streamCameraPoseBlend,
      to,
      startedAtMs: performance.now(),
      durationMs,
    };
    this.requestRender();
  }

  animateZoomFrustumTo(target: number, durationMs: number): void {
    const max = this.telescopeHoldActive
      ? Math.max(this.effectiveZoomMax(), target)
      : this.effectiveZoomMax();
    const to = Game.clampZoom(target, this.zoomMin, max, VIEW_FRUSTUM_SIZE);
    if (durationMs <= 0) {
      this.zoomFrustumAnim = null;
      this.frustumSize = to;
      this.applyOrthographicFrustum();
      this.refreshAllNameLabelScales();
      this.refreshChatBubbleVerticalPositions();
      this.refreshWorldcupChallengeBubbleLayouts();
      this.refreshAllTypingIndicatorLayouts();
      this.finishTelescopeReturnZoomAnim();
      this.requestRender();
      return;
    }
    this.zoomFrustumAnim = {
      from: this.frustumSize,
      to,
      startedAtMs: performance.now(),
      durationMs,
    };
    this.requestRender(durationMs);
  }

  listFollowablePlayers(): Array<{
    address: string;
    displayName: string;
    x: number;
    y: number;
    z: number;
  }> {
    const out: Array<{
      address: string;
      displayName: string;
      x: number;
      y: number;
      z: number;
    }> = [];
    for (const [addr, g] of this.others) {
      const t = this.targetPos.get(addr);
      const x = t?.x ?? g.position.x;
      const y = t?.y ?? g.position.y;
      const z = t?.z ?? g.position.z;
      const displayName = String(g.userData.displayName ?? "").trim();
      out.push({ address: addr, displayName, x, y, z });
    }
    return out;
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
      this.effectiveZoomMax(),
      VIEW_FRUSTUM_SIZE
    );
    if (this.zoomLocked && this.zoomLockedFrustum !== null) {
      this.frustumSize = Game.clampZoom(
        this.zoomLockedFrustum,
        this.zoomMin,
        this.effectiveZoomMax(),
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
      this.effectiveZoomMax(),
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
    const d = this.avatarIdenticonWorldDiameter();
    const apply = (g: THREE.Group | null): void => {
      if (!g) return;
      const identicon = g.userData.identiconMesh as THREE.Sprite | undefined;
      if (identicon) {
        identicon.rotation.copy(e);
        identicon.scale.set(d, d, 1);
        identicon.position.y = d / 2;
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

  /** Rasterize Nimiq `duotone-document` once for all signpost hint sprites. */
  private ensureSignpostHintDocTexture(): void {
    if (this.signpostHintDocTextureLoadStarted) return;
    this.signpostHintDocTextureLoadStarted = true;
    const ic = nimiqIconsData.icons["duotone-document"];
    if (!ic?.body) {
      console.warn("[Game] nimiq-icons: missing duotone-document");
      return;
    }
    const vw = ic.width ?? 24;
    const vh = ic.height ?? 24;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${String(vw)} ${String(
      vh
    )}" fill="none">${ic.body}</svg>`;
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const out = 72;
      const canvas = document.createElement("canvas");
      canvas.width = out;
      canvas.height = out;
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, out, out);
      ctx.drawImage(img, 0, 0, out, out);
      URL.revokeObjectURL(url);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      tex.needsUpdate = true;
      this.signpostHintDocTexture = tex;
      this.bindSignpostHintDocTextureToSprites();
      this.refreshSignpostHintSpriteScales();
      this.requestRender();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      console.warn("[Game] Failed to rasterize duotone-document icon");
    };
    img.src = url;
  }

  private bindSignpostHintDocTextureToSprites(): void {
    const tex = this.signpostHintDocTexture;
    if (!tex) return;
    for (const g of this.blockMeshes.values()) {
      const sp = g.userData.signpostHintSprite as THREE.Sprite | undefined;
      if (!sp?.userData.needsSignpostDocMap) continue;
      const m = sp.material as THREE.SpriteMaterial;
      if (m.map === this.signpostHintPlaceholderTexture) {
        m.map = tex;
      }
      m.opacity = 1;
      m.needsUpdate = true;
      sp.userData.needsSignpostDocMap = false;
    }
  }

  private refreshSignpostHintSpriteScales(): void {
    const worldH = this.pixelToWorldY(Game.SIGNPOST_HINT_SCREEN_PX);
    const worldW = worldH;
    for (const g of this.blockMeshes.values()) {
      const sp = g.userData.signpostHintSprite as THREE.Sprite | undefined;
      if (!sp) continue;
      const meta = g.userData.blockMeta as BlockStyleProps | undefined;
      if (!meta?.signboardId) continue;
      sp.scale.set(worldW, worldH, 1);
      g.userData.signpostHintBaseY = this.computeSignpostHintBaseYLocal(meta, worldH);
    }
  }

  /** Local Y of the sprite center: world-unit offsets so every signpost uses the same on-screen icon size. */
  private computeSignpostHintBaseYLocal(
    _meta: BlockStyleProps,
    worldIconH: number
  ): number {
    const clearance = this.pixelToWorldY(28);
    const extraLift = this.pixelToWorldY(16);
    return clearance + extraLift + worldIconH * 0.52;
  }

  private floorTileKeyFromBlockMeshKey(blockMeshKey: string): string | null {
    const parts = blockMeshKey.split(",").map(Number);
    if (
      parts.length < 3 ||
      !Number.isFinite(parts[0]) ||
      !Number.isFinite(parts[1]) ||
      !Number.isFinite(parts[2])
    ) {
      return null;
    }
    if (Math.floor(parts[2]!) !== 0) return null;
    return tileKey(parts[0]!, parts[1]!);
  }

  /** Another obstacle stacked on this floor tile hides the floating signpost hint. */
  private isSignpostHintOccludedByStack(meshKey: string): boolean {
    const parts = meshKey.split(",").map(Number);
    if (
      parts.length < 3 ||
      !Number.isFinite(parts[0]) ||
      !Number.isFinite(parts[1]) ||
      !Number.isFinite(parts[2])
    ) {
      return false;
    }
    const xi = Math.floor(parts[0]!);
    const zi = Math.floor(parts[1]!);
    const yL = Math.floor(parts[2]!);
    if (yL !== 0) return false;
    return (
      this.hasRenderedBlockAtKey(blockKey(xi, zi, 1)) ||
      this.hasRenderedBlockAtKey(blockKey(xi, zi, 2))
    );
  }

  private static blockMeshRootFromPickObject(
    obj: THREE.Object3D
  ): THREE.Group | null {
    let o: THREE.Object3D | null = obj;
    while (o) {
      const tk = o.userData?.tileKey as string | undefined;
      if (tk) return o as THREE.Group;
      o = o.parent;
    }
    return null;
  }

  /**
   * True when some other placed block lies between the camera and `hintWorld`
   * (same logic as `pickBlockKey` root walk, but skips hits on `ownGroup`).
   */
  private isSignpostHintOccludedByForeground(
    ownGroup: THREE.Group,
    hintWorld: THREE.Vector3,
    roots: THREE.Object3D[]
  ): boolean {
    this.camera.updateMatrixWorld();
    this.camera.getWorldPosition(this.signpostHintOcclCamW);
    this.signpostHintOcclDirW.copy(hintWorld).sub(this.signpostHintOcclCamW);
    const dist = this.signpostHintOcclDirW.length();
    const nearClip = 0.12;
    const margin = 0.085;
    if (dist < nearClip + margin * 2) return false;
    this.signpostHintOcclDirW.multiplyScalar(1 / dist);
    this.signpostHintOcclRay.set(
      this.signpostHintOcclCamW,
      this.signpostHintOcclDirW
    );
    this.signpostHintOcclRay.near = nearClip;
    this.signpostHintOcclRay.far = Math.max(nearClip + 1e-4, dist - margin);
    const hits = this.signpostHintOcclRay.intersectObjects(roots, true);
    for (const h of hits) {
      const owner = Game.blockMeshRootFromPickObject(h.object);
      if (owner === ownGroup) continue;
      return true;
    }
    return false;
  }

  private attachSignpostHintToBlockGroup(
    g: THREE.Group,
    meta: BlockStyleProps
  ): void {
    void this.ensureSignpostHintDocTexture();
    const worldH = this.pixelToWorldY(Game.SIGNPOST_HINT_SCREEN_PX);
    const worldW = worldH;
    const docReady = this.signpostHintDocTexture !== null;
    const mat = new THREE.SpriteMaterial({
      map: docReady
        ? this.signpostHintDocTexture
        : this.signpostHintPlaceholderTexture,
      transparent: true,
      depthTest: false,
      opacity: docReady ? 1 : 0,
      toneMapped: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.renderOrder = 14;
    sprite.userData[SKIP_BLOCK_PICK_AND_BOUNDS] = true;
    sprite.userData.isSignpostHintIcon = true;
    sprite.raycast = (_r: THREE.Raycaster, _i: THREE.Intersection[]) => {};
    if (!docReady) {
      sprite.userData.needsSignpostDocMap = true;
    }
    sprite.scale.set(worldW, worldH, 1);
    const baseY = this.computeSignpostHintBaseYLocal(meta, worldH);
    sprite.position.set(0, baseY, 0);
    g.userData.signpostHintSprite = sprite;
    g.userData.signpostHintBaseY = baseY;
    g.add(sprite);
  }

  /** Keeps name tags near constant on-screen size at any orthographic zoom. */
  private syncNameLabelScaleAndPosition(g: THREE.Group): void {
    const nameSprite = g.userData.nameSprite as THREE.Sprite | undefined;
    if (!nameSprite) return;
    const tw = nameSprite.userData.nameLabelTexW as number | undefined;
    const th = nameSprite.userData.nameLabelTexH as number | undefined;
    if (!tw || !th) return;
    if (this.streamPresentationActive) {
      nameSprite.visible = false;
      return;
    }
    // worldcup: keep the soccer pitch uncluttered - NPCs wear no nametag here.
    if (this.isWorldcupFreeMoveRoom()) {
      const address = String(g.userData.address ?? "");
      const displayName = String(g.userData.displayName ?? "");
      if (remotePlayerIsNpc(address, displayName)) {
        nameSprite.visible = false;
        return;
      }
    }
    nameSprite.visible = true;
    const screenH = this.streamPresentationActive
      ? STREAM_NAME_LABEL_SCREEN_HEIGHT_PX
      : NAME_LABEL_SCREEN_HEIGHT_PX;
    const maxPx = this.streamPresentationActive
      ? STREAM_NAME_LABEL_MAX_PX
      : NAME_LABEL_MAX_PX;
    let worldH = this.pixelToWorldY(screenH);
    let worldW = worldH * (tw / th);
    const maxW = this.pixelToWorldX(maxPx);
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
    this.refreshFloatingTextScales();
  }

  private syncFloatingTextScale(entry: FloatingTextEntry): void {
    const worldH = this.pixelToWorldY(entry.screenHeightPx);
    const worldW = worldH * (entry.texWidth / entry.texHeight);
    entry.sprite.scale.set(worldW, worldH, 1);
  }

  /** Avatar-local Y for mining reward floaters (above identicon, screen-fixed height). */
  private syncAvatarAttachedFloatingTextPosition(entry: FloatingTextEntry): void {
    const worldH = entry.sprite.scale.y;
    const avatarTop = this.avatarIdenticonWorldDiameter();
    const gapAbove = this.pixelToWorldY(8);
    entry.sprite.position.set(0, avatarTop + gapAbove + worldH * 0.5, 0);
  }

  private refreshFloatingTextScales(): void {
    for (const [, entry] of this.floatingTexts) {
      this.syncFloatingTextScale(entry);
      if (entry.avatarGroup) {
        this.syncAvatarAttachedFloatingTextPosition(entry);
      }
    }
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
    this.refreshAchievementCelebrationLayouts();
    this.refreshWorldcupChallengeBubbleLayouts();
  }

  /** Keeps chat bubbles near constant on-screen size at any orthographic zoom (like name labels). */
  private syncChatBubbleScaleAndPosition(entry: ChatBubbleEntry): void {
    const tw = entry.texWidth;
    const th = entry.texHeight;
    
    // Render the bubble at its natural logical height so each text line keeps a constant,
    // readable on-screen size no matter how many lines wrap. (Using `th * 0.5` made multi-line
    // messages add only half a line of height each, shrinking the text until it was unreadable.)
    const basePlain = Math.max(CHAT_BUBBLE_MIN_HEIGHT_PX, th);
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
    const avatarTop = this.avatarIdenticonWorldDiameter();
    const ch = worldH;
    const gapAboveAvatar = 0.12;
    entry.sprite.position.y = avatarTop + gapAboveAvatar + ch / 2;
  }

  /** Keeps 1v1 Challenge badges near constant on-screen size at any orthographic zoom (like chat bubbles). */
  private refreshWorldcupChallengeBubbleLayouts(): void {
    for (const [addr, bubble] of this.worldcupChallengeBubbles) {
      const g =
        this.compactWalletKey(addr) === this.compactWalletKey(this.selfAddress)
          ? this.selfMesh
          : this.others.get(addr) ?? null;
      if (!g || bubble.parent !== g) continue;
      const withAccept =
        typeof bubble.userData["challengeAcceptAddress"] === "string";
      this.layoutWorldcupChallengeBubbleSprites(bubble, withAccept);
    }
  }

  /**
   * Catalog / teleporter layout previews: fit the room diamond in view with its projected
   * bounds centered (gameplay uses asymmetric expansion via {@link tryExpandFrustumForRoomGround}).
   */
  private layoutPreviewRoomSamples(
    b: RoomBounds
  ): {
    cx: number;
    cz: number;
    samples: Array<[number, number]>;
  } {
    const hx = 0.5;
    const hz = 0.5;
    const cx = (b.minX + b.maxX) * 0.5;
    const cz = (b.minZ + b.maxZ) * 0.5;
    return {
      cx,
      cz,
      samples: [
        [b.minX - hx, b.minZ - hz],
        [b.maxX + hx, b.minZ - hz],
        [b.minX - hx, b.maxZ + hz],
        [b.maxX + hx, b.maxZ + hz],
        [cx, b.minZ - hz],
        [cx, b.maxZ + hz],
        [b.minX - hx, cz],
        [b.maxX + hx, cz],
      ],
    };
  }

  /** Rooms catalog: always frame a Hub-sized (25x25) window centered on the room. */
  private layoutPreviewHubSamples(b: RoomBounds): Array<[number, number]> {
    const roomCx = (b.minX + b.maxX + 1) * 0.5;
    const roomCz = (b.minZ + b.maxZ + 1) * 0.5;
    const half = LAYOUT_PREVIEW_HUB_TILES * 0.5;
    const vMinX = roomCx - half;
    const vMaxX = roomCx + half - 1;
    const vMinZ = roomCz - half;
    const vMaxZ = roomCz + half - 1;
    const cx = (vMinX + vMaxX) * 0.5;
    const cz = (vMinZ + vMaxZ) * 0.5;
    const hx = 0.5;
    const hz = 0.5;
    return [
      [vMinX - hx, vMinZ - hz],
      [vMaxX + hx, vMinZ - hz],
      [vMinX - hx, vMaxZ + hz],
      [vMaxX + hx, vMaxZ + hz],
      [cx, vMinZ - hz],
      [cx, vMaxZ + hz],
      [vMinX - hx, cz],
      [vMaxX + hx, cz],
    ];
  }

  private applyLayoutPreviewFrustum(): void {
    const w = this.canvasHost.clientWidth;
    const h = this.canvasHost.clientHeight;
    if (w < 1 || h < 1) return;
    const aspect = w / h;

    this.applyCameraPose();
    this.camera.updateMatrixWorld(true);
    const inv = this.camera.matrixWorldInverse;
    const p = this.frustumFitScratch;
    const b = this.roomBounds;
    const margin = 3;
    const samples = this.catalogPreviewActive
      ? this.layoutPreviewHubSamples(b)
      : this.layoutPreviewRoomSamples(b).samples;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [wx, wz] of samples) {
      p.set(wx, 0, wz);
      p.applyMatrix4(inv);
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    minX -= margin;
    maxX += margin;
    minY -= margin;
    maxY += margin;

    const tune = this.layoutPreviewTune;
    const centerX = (minX + maxX) * 0.5 + tune.x;
    const centerY = (minY + maxY) * 0.5 + tune.y;
    let halfW = (maxX - minX) * 0.5;
    let halfH = (maxY - minY) * 0.5;
    if (halfW / halfH < aspect) {
      halfW = halfH * aspect;
    } else {
      halfH = halfW / aspect;
    }
    const zoom = Math.max(0.15, tune.z);
    halfW *= zoom;
    halfH *= zoom;

    this.camera.left = centerX - halfW;
    this.camera.right = centerX + halfW;
    this.camera.top = centerY + halfH;
    this.camera.bottom = centerY - halfH;
    this.camera.updateProjectionMatrix();
  }

  /** Large rooms need an asymmetric ortho frustum when zoomed out - symmetric half-extent clips the south diamond tip. */
  private roomNeedsFrustumFit(): boolean {
    const b = this.roomBounds;
    const w = b.maxX - b.minX + 1;
    const h = b.maxZ - b.minZ + 1;
    return Math.max(w, h) > 40;
  }

  /**
   * When zoomed out in a large room, expand left/right/top/bottom so every ground-boundary
   * sample fits in camera view space. Camera pose is unchanged; only the projection shifts.
   */
  private tryExpandFrustumForRoomGround(
    aspect: number,
    halfHeight: number
  ): { left: number; right: number; top: number; bottom: number } | null {
    if (!this.roomNeedsFrustumFit()) return null;
    // Non-admins in spatial rooms (e.g. Pixel): keep the capped zoom - do not widen projection to the full grid.
    if (
      !this.mapOverviewUnlocked &&
      roomUsesSpatialInterest(this.roomBounds)
    ) {
      return null;
    }
    if (halfHeight < this.effectiveZoomMax() * 0.65) return null;

    this.applyCameraPose();
    this.camera.updateMatrixWorld(true);
    const inv = this.camera.matrixWorldInverse;
    const p = this.frustumFitScratch;
    const b = this.roomBounds;
    const cx = (b.minX + b.maxX) * 0.5;
    const cz = (b.minZ + b.maxZ) * 0.5;
    const margin = 3;
    const hx = 0.5;
    const hz = 0.5;
    const samples: Array<[number, number]> = [
      [b.minX - hx, b.minZ - hz],
      [b.maxX + hx, b.minZ - hz],
      [b.minX - hx, b.maxZ + hz],
      [b.maxX + hx, b.maxZ + hz],
      [cx, b.minZ - hz],
      [cx, b.maxZ + hz],
      [b.minX - hx, cz],
      [b.maxX + hx, cz],
    ];

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [wx, wz] of samples) {
      p.set(wx, 0, wz);
      p.applyMatrix4(inv);
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    minX -= margin;
    maxX += margin;
    minY -= margin;
    maxY += margin;

    const halfW = halfHeight * aspect * 0.5;
    const symLeft = -halfW;
    const symRight = halfW;
    const symTop = halfHeight * 0.5;
    const symBottom = -halfHeight * 0.5;

    return {
      left: Math.min(symLeft, minX),
      right: Math.max(symRight, maxX),
      bottom: Math.min(symBottom, minY),
      top: Math.max(symTop, maxY),
    };
  }

  /**
   * Stream top-down ortho half-extents in world units (before tile-edge ±0.5).
   * Matches viewport aspect so pixels stay square.
   */
  private getStreamFrustumHalfExtentsWorld(): { halfW: number; halfH: number } {
    const b = this.roomBounds;
    const roomHalfW = (b.maxX - b.minX + 1) * 0.5;
    const roomHalfH = (b.maxZ - b.minZ + 1) * 0.5;
    const zoom = this.frustumSize / this.effectiveZoomMax();
    let halfW = roomHalfW * zoom;
    let halfH = roomHalfH * zoom;
    const w = this.canvasHost.clientWidth;
    const h = this.canvasHost.clientHeight;
    const aspect = w > 0 && h > 0 ? w / h : 16 / 9;
    const roomAspect = (roomHalfW * 2) / (roomHalfH * 2);
    if (aspect > roomAspect) {
      halfH = halfW / aspect;
    } else if (aspect < roomAspect) {
      halfW = halfH * aspect;
    }
    return { halfW, halfH };
  }

  private streamRoomOuterBounds(): {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  } {
    const b = this.roomBounds;
    return {
      minX: b.minX - 0.5,
      maxX: b.maxX + 0.5,
      minZ: b.minZ - 0.5,
      maxZ: b.maxZ + 0.5,
    };
  }

  private streamPanContentBounds(): {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  } {
    const t = this.streamPanTune;
    const r = this.streamRoomOuterBounds();
    return {
      minX: r.minX + t.marginWest,
      maxX: r.maxX - t.marginEast,
      minZ: r.minZ + t.marginNorth,
      maxZ: r.maxZ - t.marginSouth,
    };
  }

  private streamViewCorners(
    lookX: number,
    lookZ: number,
    halfW: number,
    halfH: number
  ): { west: number; east: number; north: number; south: number } {
    return {
      west: lookX - halfW + 0.5,
      east: lookX + halfW - 0.5,
      north: lookZ - halfH + 0.5,
      south: lookZ + halfH - 0.5,
    };
  }

  /** Look-at limits so a symmetric stream frustum never crosses the room outer edge. */
  private streamPanLookAtLimits(): {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  } | null {
    const { minX: x0, maxX: x1, minZ: z0, maxZ: z1 } =
      this.streamPanContentBounds();
    const w = this.canvasHost.clientWidth;
    const h = this.canvasHost.clientHeight;
    const { halfW, halfH } = this.getStreamFrustumHalfExtentsFinal(w, h);
    if (halfW <= 0 || halfH <= 0) return null;

    const minLookX = x0 + halfW - 0.5;
    const maxLookX = x1 - halfW + 0.5;
    const minLookZ = z0 + halfH - 0.5;
    const maxLookZ = z1 - halfH + 0.5;
    if (minLookX > maxLookX || minLookZ > maxLookZ) return null;

    return {
      minX: minLookX,
      maxX: maxLookX,
      minZ: minLookZ,
      maxZ: maxLookZ,
    };
  }

  /** Half-extents used for stream frustum + pan limits (includes crisp-tile shrink). */
  private getStreamFrustumHalfExtentsFinal(
    viewW: number,
    viewH: number
  ): { halfW: number; halfH: number } {
    let { halfW, halfH } = this.getStreamFrustumHalfExtentsWorld();
    if (viewW > 0 && viewH > 0) {
      const worldW = Math.max(1, 2 * halfW - 1);
      const worldH = Math.max(1, 2 * halfH - 1);
      const pxPerUnit = Math.max(
        1,
        Math.floor(Math.min(viewW / worldW, viewH / worldH))
      );
      const idealW = viewW / pxPerUnit;
      const idealH = viewH / pxPerUnit;
      if (idealW < worldW || idealH < worldH) {
        const scale = Math.min(idealW / worldW, idealH / worldH, 1);
        halfW *= scale;
        halfH *= scale;
      }
    }
    return { halfW, halfH };
  }

  private clampStreamLookAtToRoom(
    lookX: number,
    lookZ: number,
    halfW: number,
    halfH: number
  ): { x: number; z: number } {
    const { minX: x0, maxX: x1, minZ: z0, maxZ: z1 } =
      this.streamPanContentBounds();
    const minLookX = x0 + halfW - 0.5;
    const maxLookX = x1 - halfW + 0.5;
    const minLookZ = z0 + halfH - 0.5;
    const maxLookZ = z1 - halfH + 0.5;
    return {
      x: Math.max(minLookX, Math.min(maxLookX, lookX)),
      z: Math.max(minLookZ, Math.min(maxLookZ, lookZ)),
    };
  }

  /**
   * Build stream ortho in camera space (look-at is the frustum center).
   */
  private buildStreamOrthoFrustum(
    viewW: number,
    viewH: number
  ): { left: number; right: number; top: number; bottom: number } {
    const { halfW, halfH } = this.getStreamFrustumHalfExtentsFinal(viewW, viewH);
    return {
      left: -halfW + 0.5,
      right: halfW - 0.5,
      top: halfH - 0.5,
      bottom: -halfH + 0.5,
    };
  }

  /** Integer pixels per tile so stream capture stays sharp when the canvas is scaled to the window. */
  private applyStreamRenderSize(viewW: number, viewH: number): void {
    if (viewW < 1 || viewH < 1) return;
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(viewW, viewH, false);
    const el = this.renderer.domElement;
    el.style.width = `${viewW}px`;
    el.style.height = `${viewH}px`;
    el.style.objectFit = "";
    el.style.objectPosition = "";
  }

  private applyStreamOrthographicFrustum(viewW: number, viewH: number): void {
    this.applyCameraPose();
    const aspect = viewW > 0 && viewH > 0 ? viewW / viewH : 16 / 9;
    const blend = this.streamCameraPoseBlend;
    const streamFit = this.buildStreamOrthoFrustum(viewW, viewH);
    const f = this.frustumSize;
    const isoLeft = (f * aspect) / -2;
    const isoRight = (f * aspect) / 2;
    const isoTop = f / 2;
    const isoBottom = f / -2;
    if (blend <= 0) {
      this.camera.left = streamFit.left;
      this.camera.right = streamFit.right;
      this.camera.top = streamFit.top;
      this.camera.bottom = streamFit.bottom;
    } else if (blend >= 1) {
      this.camera.left = isoLeft;
      this.camera.right = isoRight;
      this.camera.top = isoTop;
      this.camera.bottom = isoBottom;
    } else {
      this.camera.left = streamFit.left + (isoLeft - streamFit.left) * blend;
      this.camera.right = streamFit.right + (isoRight - streamFit.right) * blend;
      this.camera.top = streamFit.top + (isoTop - streamFit.top) * blend;
      this.camera.bottom =
        streamFit.bottom + (isoBottom - streamFit.bottom) * blend;
    }
    this.camera.updateProjectionMatrix();
  }

  private updateStreamPan(dt: number): void {
    if (!this.streamPanEnabled || !this.streamPresentationActive) return;
    if (this.streamCameraMode !== "detached") return;
    if (this.lookAtAnim || this.zoomFrustumAnim) return;

    const limits = this.streamPanLookAtLimits();
    if (!limits) return;

    let lookX = this.cameraLookAt.x + this.streamPanVelX * dt;
    let lookZ = this.cameraLookAt.z + this.streamPanVelZ * dt;

    lookX = Math.max(limits.minX, Math.min(limits.maxX, lookX));
    lookZ = Math.max(limits.minZ, Math.min(limits.maxZ, lookZ));

    if (lookX <= limits.minX + 1e-5 && this.streamPanVelX < 0) {
      this.streamPanVelX *= -1;
    }
    if (lookX >= limits.maxX - 1e-5 && this.streamPanVelX > 0) {
      this.streamPanVelX *= -1;
    }
    if (lookZ <= limits.minZ + 1e-5 && this.streamPanVelZ < 0) {
      this.streamPanVelZ *= -1;
    }
    if (lookZ >= limits.maxZ - 1e-5 && this.streamPanVelZ > 0) {
      this.streamPanVelZ *= -1;
    }

    if (
      Math.abs(lookX - this.cameraLookAt.x) < 0.0005 &&
      Math.abs(lookZ - this.cameraLookAt.z) < 0.0005
    ) {
      return;
    }

    this.cameraLookAt.x = lookX;
    this.cameraLookAt.z = lookZ;
    this.applyCameraPose();
    this.applyOrthographicFrustum();
    this.requestRender();
  }

  private resetStreamRenderSize(viewW: number, viewH: number, dpr: number): void {
    const el = this.renderer.domElement;
    el.style.width = "";
    el.style.height = "";
    el.style.objectFit = "";
    el.style.objectPosition = "";
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(viewW, viewH, false);
  }

  private applyOrthographicFrustum(): void {
    if (this.roomLayoutPreviewActive) {
      this.applyLayoutPreviewFrustum();
      return;
    }
    const w = this.canvasHost.clientWidth;
    const h = this.canvasHost.clientHeight;
    const aspect = w > 0 && h > 0 ? w / h : 16 / 9;
    if (this.streamPresentationActive) {
      this.applyStreamOrthographicFrustum(w, h);
      return;
    }
    const f = this.frustumSize;
    const expanded = this.tryExpandFrustumForRoomGround(aspect, f);
    if (expanded) {
      this.camera.left = expanded.left;
      this.camera.right = expanded.right;
      this.camera.top = expanded.top;
      this.camera.bottom = expanded.bottom;
    } else {
      this.camera.left = (f * aspect) / -2;
      this.camera.right = (f * aspect) / 2;
      this.camera.top = f / 2;
      this.camera.bottom = f / -2;
    }
    this.camera.updateProjectionMatrix();
  }

  /**
   * Gate / walkable tile / mineable / avatar menus - opened on **right-button pointerup**
   * so the pick matches the release position (after right-drag orbit without movement,
   * `suppressAvatarContextMenuFromRightOrbit` skips opening here; `contextmenu` still clears it).
   */
  private openInGameContextMenuAt(clientX: number, clientY: number): void {
    if (!this.buildMode && this.gateContextOpener) {
      const bk = this.pickBlockKey(clientX, clientY);
      if (bk) {
        const m = this.placedObjects.get(bk);
        if (m?.gate) {
          this.gateContextOpener({
            blockKey: bk,
            clientX,
            clientY,
          });
          return;
        }
      }
    }
    const g = this.pickClosestAvatarGroupAt(clientX, clientY);
    if (!g) {
      if (
        !this.buildMode &&
        this.worldTileContextOpener &&
        this.selfMesh
      ) {
        const mine = this.pickActiveMineableClaimAtScreen(clientX, clientY);
        const walkGoal =
          mine !== null || !this.tileClickHandler
            ? null
            : this.resolveWalkNavigationGoalAt(clientX, clientY);
        const signboard = this.pickSignboardAtScreen(clientX, clientY);
        if (mine !== null || walkGoal !== null || signboard !== null) {
          this.worldTileContextOpener({
            clientX,
            clientY,
            mine,
            walkAt:
              walkGoal !== null ? { clientX, clientY } : null,
            signboard,
          });
        }
      }
      return;
    }
    const address = String(g.userData.address ?? "");
    const displayName = String(g.userData.displayName ?? "");
    if (g === this.selfMesh) {
      const others = this.pickAllOtherHumanAvatarsAt(clientX, clientY);
      if (others.length > 0 && this.otherPlayerContextOpener) {
        this.otherPlayerContextOpener({
          targets: others,
          clientX,
          clientY,
          emoteRowFirst:
            !!this.selfQuickEmojiOpener &&
            this.rayPickHitsSelfAvatar(clientX, clientY),
        });
        return;
      }
      if (!this.selfQuickEmojiOpener) return;
      this.selfQuickEmojiOpener();
      return;
    }
    if (remotePlayerIsNpc(address, displayName)) {
      return;
    }
    if (!this.otherPlayerContextOpener) return;
    const targets = this.pickAllOtherHumanAvatarsAt(clientX, clientY);
    if (targets.length === 0) return;
    this.otherPlayerContextOpener({
      targets,
      clientX,
      clientY,
      emoteRowFirst:
        !!this.selfQuickEmojiOpener &&
        this.rayPickHitsSelfAvatar(clientX, clientY),
    });
  }

  private readonly onCanvasContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    if (this.suppressAvatarContextMenuFromRightOrbit) {
      this.suppressAvatarContextMenuFromRightOrbit = false;
      return;
    }
    const pt = (e as PointerEvent & MouseEvent).pointerType;
    if (pt === "touch") {
      this.openInGameContextMenuAt(e.clientX, e.clientY);
    }
  };

  private readonly onWheel = (e: WheelEvent): void => {
    if (this.catalogPreviewActive) return;
    e.preventDefault();
    if (this.zoomLocked || this.streamPresentationActive) return;
    const scale = Math.exp(-e.deltaY * 0.0015);
    const next = this.frustumSize / scale;
    this.setZoomFrustumSize(next);
    this.requestRender(250);
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    this.requestRender(250);
    const isCancel = e.type === "pointercancel";
    // worldcup: releasing the floating-joystick finger stops the player (no tap-to-move).
    if (this.worldcupStick && this.worldcupStick.pointerId === e.pointerId) {
      this.endWorldcupStick();
      this.releaseTouchPointerId(e.pointerId);
      return;
    }
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
    if (!isCancel && e.button === 2) {
      if (this.suppressAvatarContextMenuFromRightOrbit) {
        this.suppressAvatarContextMenuFromRightOrbit = false;
      } else if (
        this.floorExpandMode &&
        Game.isDesktopFinePointer() &&
        this.tryFloorExpandRemoveAtScreen(e.clientX, e.clientY)
      ) {
        /* Floor edit: RMB removes tile (LMB places). */
      } else {
        this.openInGameContextMenuAt(e.clientX, e.clientY);
      }
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

    if (
      this.prefabBboxDrag &&
      this.prefabBboxDrag.pointerId === e.pointerId
    ) {
      const drag = this.prefabBboxDrag;
      this.prefabBboxDrag = null;
      try {
        if (this.renderer.domElement.hasPointerCapture?.(e.pointerId)) {
          this.renderer.domElement.releasePointerCapture(e.pointerId);
        }
      } catch {
        /* ignore */
      }
      if (!isCancel && e.button === 0) {
        const bbox = this.clampPrefabSaveBbox(
          drag.startX,
          drag.startZ,
          drag.curX,
          drag.curZ
        );
        this.syncPrefabSaveCapturePreview(bbox);
        this.prefabBboxCompleteHandler?.(bbox);
      } else {
        this.clearPrefabSaveCapturePreview();
      }
      return;
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

  /**
   * Nimiq Pay / mobile HUD: lifts off the canvas often miss `pointerup` on the canvas while
   * the window still sees the release. Drop stale capture/walk state so the next touch is not
   * retargeted to the canvas under an open HUD overlay (e.g. Action Wheel).
   */
  private releaseStaleTouchGestureAfterOffCanvasPointerUp(
    pointerId: number
  ): void {
    if (this.pendingPrimaryWalk?.pointerId === pointerId) {
      this.clearPendingPrimaryWalk();
    }
    if (this.pendingBuildPlace?.pointerId === pointerId) {
      this.clearPendingBuildPlace();
    }
    if (this.selfEmojiTouchSession?.pointerId === pointerId) {
      this.clearSelfEmojiTouchSession();
    }
    if (this.otherProfileTouchSession?.pointerId === pointerId) {
      this.clearOtherProfileTouchSession();
    }
    if (this.rightOrbitDrag?.pointerId === pointerId) {
      try {
        if (this.renderer.domElement.hasPointerCapture?.(pointerId)) {
          this.renderer.domElement.releasePointerCapture(pointerId);
        }
      } catch {
        /* ignore */
      }
      this.rightOrbitDrag = null;
      this.renderer.domElement.style.cursor = "pointer";
    }
    if (this.prefabBboxDrag?.pointerId === pointerId) {
      this.prefabBboxDrag = null;
      try {
        if (this.renderer.domElement.hasPointerCapture?.(pointerId)) {
          this.renderer.domElement.releasePointerCapture(pointerId);
        }
      } catch {
        /* ignore */
      }
      this.clearPrefabSaveCapturePreview();
    }
  }

  /** Opening a HUD overlay (Action Wheel, etc.) - cancel in-flight canvas gestures. */
  interruptHudOverlayGestures(): void {
    this.endWorldcupStick();
    this.clearPendingPrimaryWalk();
    this.clearPendingBuildPlace();
    this.clearSelfEmojiTouchSession();
    this.clearOtherProfileTouchSession();
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
    if (this.prefabBboxDrag) {
      const id = this.prefabBboxDrag.pointerId;
      this.prefabBboxDrag = null;
      try {
        if (this.renderer.domElement.hasPointerCapture?.(id)) {
          this.renderer.domElement.releasePointerCapture(id);
        }
      } catch {
        /* ignore */
      }
      this.clearPrefabSaveCapturePreview();
    }
  }

  /** Pay touch debug / recovery - drop pinch, twist, and stick tracking too. */
  forceReleaseAllTouchGestures(): void {
    this.interruptHudOverlayGestures();
    this.flushTouchPointerGestureState();
  }

  /** Snapshot for on-screen Pay touch debug (`?payDebug=1`). */
  getTouchDebugState(): {
    touchPointerCount: number;
    pendingWalk: boolean;
    pendingWalkPointerId: number | null;
    worldcupStick: boolean;
    canvasCapturePointerIds: number[];
  } {
    const canvas = this.renderer.domElement;
    const canvasCapturePointerIds: number[] = [];
    for (let id = 0; id < 32; id++) {
      try {
        if (canvas.hasPointerCapture?.(id)) canvasCapturePointerIds.push(id);
      } catch {
        /* ignore */
      }
    }
    return {
      touchPointerCount: this.touchPointers.size,
      pendingWalk: this.pendingPrimaryWalk !== null,
      pendingWalkPointerId: this.pendingPrimaryWalk?.pointerId ?? null,
      worldcupStick: this.worldcupStick !== null,
      canvasCapturePointerIds,
    };
  }

  private readonly onWindowTouchPointerEnd = (e: PointerEvent): void => {
    if (e.pointerType !== "touch") return;
    const canvas = this.renderer.domElement;
    if (!(e.target instanceof Node) || !canvas.contains(e.target)) {
      this.releaseStaleTouchGestureAfterOffCanvasPointerUp(e.pointerId);
    }
    // worldcup: Pay WebView / HUD lifts often miss canvas pointerup; stop the stick here too.
    if (this.worldcupStick?.pointerId === e.pointerId) {
      this.endWorldcupStick();
    }
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
    this.endWorldcupStick();
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

  /** worldcup: handler that sends an immediate, un-rate-limited stop (joystick release). */
  setWorldcupStopMoveHandler(handler: (() => void) | null): void {
    this.worldcupStopMoveHandler = handler;
  }

  setPlaceBlockHandler(handler: ((x: number, z: number) => void) | null): void {
    this.placeBlockHandler = handler;
  }

  setTeleporterDestPickHandler(
    handler: ((x: number, z: number) => void) | null
  ): void {
    this.teleporterDestPickHandler = handler;
    if (handler) {
      this.syncTeleporterDestPickHover(
        this.lastPointerClientPixels.x,
        this.lastPointerClientPixels.y
      );
    } else {
      this.syncHighlightColor();
      this.refreshTeleporterLinkHighlight();
    }
  }

  /**
   * Floor tint for an unsaved in-room teleporter exit tile (build dock). Pass `null` to clear.
   */
  setTeleporterDestinationDraftHighlight(
    dest: { x: number; z: number } | null
  ): void {
    this.teleporterEditDestDraft = dest
      ? {
          x: Math.floor(dest.x),
          z: Math.floor(dest.z),
        }
      : null;
    if (dest) {
      this.tileHighlight.visible = false;
    }
    this.refreshTeleporterLinkHighlight();
    this.requestRender(120);
  }

  /** Offscreen room preview: pick a walkable floor tile from screen coordinates. */
  pickWalkableFloorAtScreen(
    clientX: number,
    clientY: number
  ): { x: number; z: number } | null {
    const dest = this.pickFloor(clientX, clientY);
    if (!dest || !this.tileWalkable(dest)) return null;
    return { x: dest.x, z: dest.y };
  }

  /** Offscreen room preview: show selected Landing Hint without build mode. */
  setPreviewLandingHintHighlight(
    dest: { x: number; z: number } | null
  ): void {
    if (!dest) {
      this.teleporterDraftDestHighlight.visible = false;
    } else {
      this.teleporterDraftDestHighlight.position.set(
        Math.floor(dest.x),
        0.026,
        Math.floor(dest.z)
      );
      this.teleporterDraftDestHighlight.visible = true;
    }
    this.requestRender(120);
  }

  /** Offscreen room preview: mark the room Join Spawn fallback tile. */
  setPreviewJoinSpawnMarker(
    tile: { x: number; z: number; customized?: boolean } | null
  ): void {
    const ring = this.roomEntrySpawnRing;
    if (!tile) {
      ring.visible = false;
      this.requestRender(120);
      return;
    }
    ring.position.set(tile.x, 0.042, tile.z);
    ring.scale.set(1, 1, 1);
    this.roomEntrySpawnRingMat.color.setHex(
      tile.customized ? 0x2dd4bf : 0x6ee7b7
    );
    this.roomEntrySpawnRingMat.opacity = 0.85;
    ring.visible = true;
    this.requestRender(120);
  }

  /** Lesson-mode highlight on the wallet's assigned Tutorial Mine Slot. */
  setTutorialMineHighlight(tile: { x: number; z: number } | null): void {
    this.tutorialMineHighlightTile = tile
      ? { x: Math.floor(tile.x), z: Math.floor(tile.z) }
      : null;
    if (!tile) {
      this.tutorialMineHighlightRing.visible = false;
    }
    this.syncTutorialMineHighlight(performance.now() * 0.001);
    this.requestRender(120);
  }

  upsertDoor(d: {
    x: number;
    z: number;
    targetRoomId: string;
    spawnX: number;
    spawnZ: number;
  }): void {
    const xi = Math.floor(d.x);
    const zi = Math.floor(d.z);
    const idx = this.doors.findIndex((row) => row.x === xi && row.z === zi);
    const next = {
      x: xi,
      z: zi,
      targetRoomId: d.targetRoomId,
      spawnX: d.spawnX,
      spawnZ: d.spawnZ,
    };
    if (idx >= 0) this.doors[idx] = next;
    else this.doors.push(next);
    this.rebuildDoorKeys();
    this.requestRender(120);
  }

  applyRoomLayoutSnapshot(
    snapshot: {
    roomId: string;
    roomBounds: {
      minX: number;
      maxX: number;
      minZ: number;
      maxZ: number;
    };
    doors?: Array<{
      x: number;
      z: number;
      targetRoomId: string;
      spawnX: number;
      spawnZ: number;
    }>;
    placeRadiusBlocks?: number;
    roomBackgroundHueDeg?: number | null;
    roomBackgroundNeutral?: boolean | null;
    extraFloorTiles?: Array<{ x: number; z: number; colorRgb: number }>;
    baseFloorColorTiles?: Array<{ x: number; z: number; colorRgb: number }>;
    removedBaseFloorTiles?: Array<{ x: number; z: number; colorRgb: number }>;
    obstacles?: Parameters<Game["setObstacles"]>[0];
    signboards?: Parameters<Game["setSignboards"]>[0];
    attentionMarkers?: AttentionMarkerWire[];
    billboards?: Parameters<Game["setBillboards"]>[0];
    voxelTexts?: Parameters<Game["setVoxelTextsForRoom"]>[1];
    joinSpawn?: { x: number; z: number; customized: boolean };
  },
    opts?: { catalogPreview?: boolean }
  ): void {
    this.roomLayoutPreviewActive = true;
    this.catalogPreviewActive = opts?.catalogPreview === true;
    if (this.catalogPreviewActive) {
      this.renderer.domElement.style.cursor = "default";
      this.renderer.domElement.style.pointerEvents = "none";
      this.canvasHost.style.pointerEvents = "none";
    }
    this.setMapOverviewUnlocked(true);
    this.applyRoomFromWelcome({
      roomId: snapshot.roomId,
      roomBounds: snapshot.roomBounds,
      doors: snapshot.doors ?? [],
      placeRadiusBlocks: Number.isFinite(snapshot.placeRadiusBlocks)
        ? Number(snapshot.placeRadiusBlocks)
        : 5,
    });
    this.setRoomSceneBackground({
      hueDeg: snapshot.roomBackgroundHueDeg ?? null,
      neutral: snapshot.roomBackgroundNeutral ?? null,
    });
    const b = snapshot.roomBounds;
    const centerX = Math.round((b.minX + b.maxX) / 2);
    const centerZ = Math.round((b.minZ + b.maxZ) / 2);
    this.applyWelcomeFloorPayload({
      extraFloorTiles: snapshot.extraFloorTiles ?? [],
      baseFloorColorTiles: snapshot.baseFloorColorTiles ?? [],
      removedBaseFloorTiles: snapshot.removedBaseFloorTiles ?? [],
      spawnX: centerX,
      spawnZ: centerZ,
    });
    this.setObstacles(snapshot.obstacles ?? []);
    this.setSignboards(snapshot.signboards ?? []);
    this.setAttentionMarkers(snapshot.attentionMarkers ?? []);
    this.setBillboards(snapshot.billboards ?? []);
    this.setVoxelTextsForRoom(snapshot.roomId, snapshot.voxelTexts ?? []);
    if (snapshot.joinSpawn) {
      this.setPreviewJoinSpawnMarker(snapshot.joinSpawn);
    }
    this.fitPreviewCameraToRoom();
    this.resize();
  }

  /** Frame the full room in offscreen layout preview (teleporter destination picker). */
  fitPreviewCameraToRoom(): void {
    const b = this.roomBounds;
    const cx = (b.minX + b.maxX + 1) * 0.5;
    const cz = (b.minZ + b.maxZ + 1) * 0.5;
    this.setCameraLookAtTarget(cx, 0, cz, { instant: true });
    this.applyLayoutPreviewFrustum();
    this.requestRender(120);
  }

  isTeleporterDestPickActive(): boolean {
    return this.teleporterDestPickHandler !== null;
  }

  setClaimBlockHandler(
    handler: ((x: number, z: number, y: number) => void) | null
  ): void {
    this.claimBlockHandler = handler;
  }

  setMineCooldownAttemptHandler(handler: (() => void) | null): void {
    this.mineCooldownAttemptHandler = handler;
  }

  setGateDoubleOpenHandler(
    handler: ((x: number, z: number, y: number) => void) | null
  ): void {
    this.gateDoubleOpenHandler = handler;
    if (!handler) this.pendingGateAdjacentInteract = null;
  }

  /**
   * Walk to a cardinal neighbor of the gate (if needed), then run
   * {@link setGateDoubleOpenHandler} once the local player is in range - same checks as
   * double-click open (ACL, admin, `sendOpenGate`).
   * @returns false if nothing was started (caller may fall back to normal walk).
   */
  queueWalkToGateThenInteract(bx: number, bz: number, by: number): boolean {
    if (this.buildMode || !this.selfMesh || !this.tileClickHandler) return false;
    const meta = this.getPlacedAt(bx, bz, by);
    if (!meta?.gate || !this.gateDoubleOpenHandler) return false;
    if (this.selfWithinGateInteractRange(bx, bz)) {
      this.gateDoubleOpenHandler(bx, bz, by);
      return true;
    }
    const stand = this.findBestAdjacentStandForBlockClaim(bx, bz);
    if (!stand) return false;
    this.pendingGateAdjacentInteract = { bx, bz, by };
    this.gateWalkQueuedFromGame = true;
    const outcome = this.commitResolvedWalkGoal({
      ft: stand,
      layer: 0,
      suppressCantMoveMessage: true,
    });
    this.gateWalkQueuedFromGame = false;
    if (outcome === "failed") {
      this.pendingGateAdjacentInteract = null;
      return false;
    }
    return true;
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
          targets: Array<{
            address: string;
            displayName: string;
            challengeOpen?: boolean;
          }>;
          clientX: number;
          clientY: number;
          emoteRowFirst?: boolean;
        }) => void)
      | null
  ): void {
    this.otherPlayerContextOpener = handler;
    if (!handler) this.clearOtherProfileTouchSession();
  }

  /** Left-click the green tick on another player's open 1v1 Challenge badge. */
  setChallengeAcceptHandler(handler: ((targetAddress: string) => void) | null): void {
    this.challengeAcceptHandler = handler;
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

  setWorldTileContextOpener(
    handler:
      | ((p: {
          clientX: number;
          clientY: number;
          mine: { x: number; z: number; y: number } | null;
          walkAt: { clientX: number; clientY: number } | null;
          signboard: {
            id: string;
            x: number;
            z: number;
            message: string;
            createdBy: string;
            createdAt: number;
          } | null;
        }) => void)
      | null
  ): void {
    this.worldTileContextOpener = handler;
  }

  /** Signboard under a screen point (passable block or floor tile), if any. */
  private pickSignboardAtScreen(
    clientX: number,
    clientY: number
  ): {
    id: string;
    x: number;
    z: number;
    message: string;
    createdBy: string;
    createdAt: number;
  } | null {
    const blockHit = this.pickBlockKey(clientX, clientY);
    if (blockHit) {
      const onBlock = this.signboards.get(blockHit);
      if (onBlock) return onBlock;
    }
    const floor = this.pickFloor(clientX, clientY);
    if (floor) {
      const onFloor = this.signboards.get(tileKey(floor.x, floor.y));
      if (onFloor) return onFloor;
    }
    return null;
  }

  /** Same as choosing "Mine" on the world tile context menu (NIM claim UI + server flow). */
  performClaimBlockAtWorld(
    x: number,
    z: number,
    y: number,
    opts?: { claimIntent?: string | null }
  ): void {
    if (!this.claimBlockHandler) return;
    this.blockClaimBeginIntent = Game.normalizeBlockClaimIntentSlug(
      opts?.claimIntent ?? null
    );

    const pos = this.getSelfPosition();
    const adjacent = !!(
      pos && isOrthogonallyAdjacentToFloorTile(pos.x, pos.z, x, z)
    );

    if (!adjacent) {
      if (!this.selfMesh || !this.tileClickHandler) {
        this.clearBlockClaimBeginIntent();
        return;
      }
      const stand = this.findBestAdjacentStandForBlockClaim(x, z);
      if (!stand) {
        this.showSelfPlayerActionMessage("I can't move here");
        this.clearBlockClaimBeginIntent();
        return;
      }
      const walk = this.commitResolvedWalkGoal({ ft: stand, layer: 0 });
      if (walk === "failed") {
        this.clearBlockClaimBeginIntent();
        return;
      }
    }

    this.claimBlockHandler(x, z, y);
  }

  /**
   * Slug for `beginBlockClaim.claimIntent` (lowercase `a-z`, digits, underscore; max 48).
   * Invalid input becomes `null` (server omits the field).
   */
  private static normalizeBlockClaimIntentSlug(
    raw: string | null | undefined
  ): string | null {
    if (raw == null) return null;
    const t = String(raw)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 48);
    return t || null;
  }

  /** Clears a pending claim intent without sending (e.g. claim UI cancelled). */
  clearBlockClaimBeginIntent(): void {
    this.blockClaimBeginIntent = null;
  }

  /**
   * Returns and clears the slug to send on the next `beginBlockClaim`, if any.
   * Call once when issuing `sendBeginBlockClaim`.
   */
  takeBlockClaimBeginIntent(): string | undefined {
    const v = this.blockClaimBeginIntent;
    this.blockClaimBeginIntent = null;
    return v === null ? undefined : v;
  }

  /** Same as choosing "Walk here" on the world tile context menu. */
  performWalkNavigationAtScreen(clientX: number, clientY: number): void {
    this.tryExecuteWalkNavigationAt(clientX, clientY);
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
    handler:
      | ((x: number, z: number, colorRgb: number, brushSize?: FloorBrushSize) => void)
      | null
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

  /**
   * Gate the local player is standing in front of (approach tile opposite exit).
   * Used for the tutorial Unlock Gate intent pill.
   */
  getStandingTutorialGateApproach(): {
    x: number;
    z: number;
    y: number;
  } | null {
    if (!this.selfMesh) return null;
    const here = snapFloorTile(this.selfMesh.position.x, this.selfMesh.position.z);
    for (const [k, meta] of this.placedObjects) {
      const g = meta.gate;
      if (!g) continue;
      const parts = k.split(",").map(Number);
      if (parts.length < 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) {
        continue;
      }
      const gx = Math.floor(parts[0]!);
      const gz = Math.floor(parts[1]!);
      const gy = Number.isFinite(parts[2]) ? Math.floor(parts[2]!) : 0;
      const approach = gateApproachTile(gx, gz, g.exitX, g.exitZ);
      if (approach.x === here.x && approach.z === here.y) {
        return { x: gx, z: gz, y: gy };
      }
    }
    return null;
  }

  /**
   * Gate the local player is orthogonally adjacent to (any side).
   * Used so tutorial Pay still offers Unlock when standing beside a leftover Gate.
   */
  getAdjacentGate(): {
    x: number;
    z: number;
    y: number;
  } | null {
    if (!this.selfMesh) return null;
    const here = snapFloorTile(this.selfMesh.position.x, this.selfMesh.position.z);
    const neighbors: [number, number][] = [
      [here.x + 1, here.y],
      [here.x - 1, here.y],
      [here.x, here.y + 1],
      [here.x, here.y - 1],
    ];
    for (const [x, z] of neighbors) {
      for (const y of [0, 1, 2]) {
        const meta = this.placedObjects.get(blockKey(x, z, y));
        if (!meta?.gate) continue;
        return { x, z, y };
      }
    }
    return null;
  }

  getPlacementBlockStyle(): {
    half: boolean;
    quarter: boolean;
    hex: boolean;
    pyramid: boolean;
    pyramidBaseScale: number;
    hexRadiusScale: number;
    sphere: boolean;
    sphereRadiusScale: number;
    ramp: boolean;
    rampDir: number;
    cubeRotX: number;
    cubeRotY: number;
    cubeRotZ: number;
    colorRgb: number;
    claimable: boolean;
  } {
    const prism = {
      hex: this.placementHex,
      pyramid: this.placementPyramid,
      sphere: this.placementSphere,
      ramp: this.placementRamp,
    };
    return {
      half: this.placementHalf,
      quarter: this.placementQuarter,
      hex: prism.hex,
      pyramid: prism.pyramid,
      pyramidBaseScale: this.placementPyramid
        ? this.placementPyramidBaseScale
        : 1,
      hexRadiusScale: this.placementHex
        ? this.placementHexRadiusScale
        : 1,
      sphere: prism.sphere,
      sphereRadiusScale: this.placementSphere
        ? this.placementSphereRadiusScale
        : 1,
      ramp: prism.ramp,
      rampDir: this.placementRampDir,
      ...cubeRotationForPlainCube(prism, {
        cubeRotX: this.placementCubeRotX,
        cubeRotY: this.placementCubeRotY,
        cubeRotZ: this.placementCubeRotZ,
      }),
      colorRgb: this.placementColorRgb,
      claimable: this.placementClaimable,
    };
  }

  setPlacementBlockStyle(p: {
    half?: boolean;
    quarter?: boolean;
    hex?: boolean;
    pyramid?: boolean;
    pyramidBaseScale?: number;
    hexRadiusScale?: number;
    sphereRadiusScale?: number;
    sphere?: boolean;
    ramp?: boolean;
    rampDir?: number;
    cubeRotX?: number;
    cubeRotY?: number;
    cubeRotZ?: number;
    /** @deprecated */
    cubePitch?: number;
    colorRgb?: number;
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
    if (p.colorRgb !== undefined) {
      this.placementColorRgb = clampColorRgb(p.colorRgb);
    }
    if (p.claimable !== undefined) {
      this.placementClaimable = p.claimable;
    }
    if (p.pyramidBaseScale !== undefined) {
      this.placementPyramidBaseScale = clampPyramidBaseScale(p.pyramidBaseScale);
    }
    if (p.hexRadiusScale !== undefined) {
      this.placementHexRadiusScale = clampHexRadiusScale(p.hexRadiusScale);
    }
    if (p.sphereRadiusScale !== undefined) {
      this.placementSphereRadiusScale = clampSphereRadiusScale(
        p.sphereRadiusScale
      );
    }
    if (
      p.cubeRotX !== undefined ||
      p.cubeRotY !== undefined ||
      p.cubeRotZ !== undefined ||
      p.cubePitch !== undefined
    ) {
      const rot = normalizeCubeRotation({
        cubeRotX: p.cubeRotX ?? this.placementCubeRotX,
        cubeRotY: p.cubeRotY ?? this.placementCubeRotY,
        cubeRotZ: p.cubeRotZ ?? this.placementCubeRotZ,
        cubePitch: p.cubePitch,
      });
      this.placementCubeRotX = rot.cubeRotX;
      this.placementCubeRotY = rot.cubeRotY;
      this.placementCubeRotZ = rot.cubeRotZ;
      this.placementPreviewStyleSig = "";
      if (this.inspectorPlacementPort) {
        this.inspectorPlacementPort.lastSig = "";
      }
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
    if (!this.placementHex) {
      this.placementHexRadiusScale = 1;
    } else {
      this.placementHexRadiusScale = clampHexRadiusScale(
        this.placementHexRadiusScale
      );
    }
    if (!this.placementSphere) {
      this.placementSphereRadiusScale = 1;
    } else {
      this.placementSphereRadiusScale = clampSphereRadiusScale(
        this.placementSphereRadiusScale
      );
    }
    if (!isPlainCubeTerrain(prism)) {
      this.placementCubeRotX = 0;
      this.placementCubeRotY = 0;
      this.placementCubeRotZ = 0;
    } else {
      const rot = normalizeCubeRotation({
        cubeRotX: this.placementCubeRotX,
        cubeRotY: this.placementCubeRotY,
        cubeRotZ: this.placementCubeRotZ,
      });
      this.placementCubeRotX = rot.cubeRotX;
      this.placementCubeRotY = rot.cubeRotY;
      this.placementCubeRotZ = rot.cubeRotZ;
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
    this.teleporterEditDestDraft = null;
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


  setObjectPrefabSaveActive(active: boolean): void {
    this.objectPrefabSaveActive = active;
    if (!active) {
      this.prefabBboxDrag = null;
      this.prefabSaveHoverTile = null;
      this.clearPrefabSaveCapturePreview();
      this.prefabBboxStatsHandler?.(null);
    }
  }

  isObjectPrefabSaveActive(): boolean {
    return this.objectPrefabSaveActive;
  }

  setObjectPrefabPlaceActive(active: boolean): void {
    this.objectPrefabPlaceActive = active;
    if (!active) {
      this.cancelPrefabPlacePreview();
    }
  }

  setPrefabPlacePreviewChangeHandler(handler: (() => void) | null): void {
    this.prefabPlacePreviewChangeHandler = handler;
  }

  isPrefabPlacePreviewArmed(): boolean {
    return this.prefabPlaceArmedAnchor !== null;
  }

  canConfirmArmedPrefabPlace(): boolean {
    if (!this.prefabPlaceArmedAnchor) return false;
    const a = this.prefabPlaceArmedAnchor;
    return this.isPrefabPlaceValidAt(a.x, a.z);
  }

  cancelPrefabPlacePreview(): void {
    const had = this.prefabPlaceArmedAnchor !== null;
    this.prefabPlaceArmedAnchor = null;
    this.prefabPlaceHoverAnchor = null;
    this.prefabPlaceGhostValid = false;
    this.clearBillboardFootprintPreviewTiles();
    this.clearPrefabPlaceMeshGhost();
    this.clearPrefabPlaceSuppressFootprint();
    if (had) this.prefabPlacePreviewChangeHandler?.();
  }

  confirmArmedPrefabPlace(): boolean {
    if (!this.canConfirmArmedPrefabPlace() || !this.prefabPlaceArmedAnchor) {
      return false;
    }
    const a = this.prefabPlaceArmedAnchor;
    this.prefabPlaceHandler?.(a.x, a.z, this.prefabPlaceYawSteps);
    this.cancelPrefabPlacePreview();
    return true;
  }

  /** Drop save/place previews when leaving build (or floor-expand overrides build). */
  private clearObjectPrefabToolVisuals(): void {
    this.setObjectPrefabSaveActive(false);
    this.setObjectPrefabPlaceActive(false);
    this.prefabPlaceDesign = null;
    this.prefabPlaceSnapshot = null;
    this.prefabPlaceSnapshotDesignId = null;
  }

  isObjectPrefabPlaceActive(): boolean {
    return this.objectPrefabPlaceActive;
  }

  setObjectPrefabPlaceDesign(
    design: { id: string; footprintW: number; footprintD: number } | null
  ): void {
    const prevId = this.prefabPlaceDesign?.id ?? null;
    this.prefabPlaceDesign = design;
    this.prefabPlaceYawSteps = 0;
    if (!design) {
      this.prefabPlaceSnapshot = null;
      this.prefabPlaceSnapshotDesignId = null;
      this.clearBillboardFootprintPreviewTiles();
      this.clearPrefabPlaceMeshGhost();
      this.clearPrefabPlaceSuppressFootprint();
      return;
    }
    if (
      prevId !== design.id ||
      !prefabPlaceSnapshotMatchesDesign(
        design.id,
        this.prefabPlaceSnapshotDesignId
      )
    ) {
      this.prefabPlaceSnapshot = null;
      this.prefabPlaceSnapshotDesignId = null;
    }
    this.rebuildPrefabPlaceMeshTemplate();
    this.refreshPrefabPlaceGhostPreview();
  }

  setObjectPrefabPlaceSnapshot(
    snapshot: DesignSnapshotV1 | null,
    forDesignId: string | null = null
  ): void {
    if (
      !shouldApplyPrefabPlaceSnapshot(
        this.prefabPlaceDesign?.id ?? null,
        forDesignId
      )
    ) {
      return;
    }
    this.prefabPlaceSnapshot = snapshot;
    this.prefabPlaceSnapshotDesignId = snapshot ? forDesignId : null;
    this.rebuildPrefabPlaceMeshTemplate();
    this.refreshPrefabPlaceGhostPreview();
  }

  setObjectPrefabPlaceYaw(yawSteps: number): void {
    this.prefabPlaceYawSteps = ((Math.floor(yawSteps) % 4) + 4) % 4;
    this.rebuildPrefabPlaceMeshTemplate();
    this.refreshPrefabPlaceGhostPreview();
  }

  cycleObjectPrefabPlaceYaw(delta: -1 | 1): void {
    this.setObjectPrefabPlaceYaw(this.prefabPlaceYawSteps + delta);
  }

  getObjectPrefabPlaceYaw(): number {
    return this.prefabPlaceYawSteps;
  }

  setObjectPrefabPlaceHandler(
    handler:
      | ((anchorX: number, anchorZ: number, yawSteps: number) => void)
      | null
  ): void {
    this.prefabPlaceHandler = handler;
  }

  isPrefabPlaceValidAt(anchorX: number, anchorZ: number): boolean {
    if (
      !this.prefabPlaceDesign ||
      !this.prefabPlaceSnapshot ||
      !prefabPlaceSnapshotMatchesDesign(
        this.prefabPlaceDesign.id,
        this.prefabPlaceSnapshotDesignId
      )
    ) {
      return false;
    }
    const design = this.prefabPlaceDesign;
    const tiles = footprintTiles(
      anchorX,
      anchorZ,
      design.footprintW,
      design.footprintD,
      this.prefabPlaceYawSteps
    );
    const b = walkBoundsForRoom(this.roomBounds, this.extraFloorKeys);
    const self = this.getSelfPosition();
    const radius = this.getPlaceRadiusBlocks();
    for (const { x, z } of tiles) {
      if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) {
        return false;
      }
      if (!this.tileWalkable({ x, y: z })) return false;
      if (self) {
        const dx = self.x - x;
        const dz = self.z - z;
        if (Math.hypot(dx, dz) > radius + 1e-6) return false;
      }
    }
    return tiles.length > 0;
  }

  private static usesPrefabPlaceTapConfirm(): boolean {
    return !Game.canShowPointerHoverTiles();
  }

  /**
   * Floor anchor for prefab stamp preview. Uses the y=0 plane only - not block mesh
   * raycasts - so hiding blocks inside the preview footprint cannot shift the anchor
   * (which would flicker as picks alternate with suppression).
   */
  private resolvePrefabPlaceAnchorFromPick(
    clientX: number,
    clientY: number
  ): { x: number; z: number } | null {
    const dest = this.pickFloor(clientX, clientY);
    if (!dest || !this.tileWalkable(dest)) return null;
    return { x: dest.x, z: dest.y };
  }

  private armPrefabPlacePreview(anchorX: number, anchorZ: number): void {
    const ax = Math.floor(anchorX);
    const az = Math.floor(anchorZ);
    const prev = this.prefabPlaceArmedAnchor;
    const same = prev?.x === ax && prev?.z === az;
    this.prefabPlaceArmedAnchor = { x: ax, z: az };
    this.syncPrefabPlaceGhostAtAnchor(ax, az);
    if (!same) this.prefabPlacePreviewChangeHandler?.();
  }

  private refreshPrefabPlaceGhostPreview(): void {
    if (!this.objectPrefabPlaceActive || !this.prefabPlaceDesign) return;
    if (this.prefabPlaceArmedAnchor) {
      this.syncPrefabPlaceGhostAtAnchor(
        this.prefabPlaceArmedAnchor.x,
        this.prefabPlaceArmedAnchor.z
      );
      return;
    }
    if (Game.canShowPointerHoverTiles()) {
      this.syncPrefabPlaceGhostAt(
        this.lastPointerClientPixels.x,
        this.lastPointerClientPixels.y
      );
    }
  }

  /** Prefer last hover anchor so click matches the ghost (re-picking can snap to a neighbor tile). */
  private resolvePrefabPlaceAnchorAtClick(
    clientX: number,
    clientY: number
  ): { x: number; z: number } | null {
    const hover = this.prefabPlaceHoverAnchor;
    if (
      hover &&
      this.prefabPlaceGhostValid &&
      this.isPrefabPlaceValidAt(hover.x, hover.z)
    ) {
      return hover;
    }
    const picked = this.resolvePrefabPlaceAnchorFromPick(clientX, clientY);
    if (!picked || !this.isPrefabPlaceValidAt(picked.x, picked.z)) return null;
    return picked;
  }

  private handlePrefabPlacePointerDown(clientX: number, clientY: number): void {
    const picked = this.resolvePrefabPlaceAnchorFromPick(clientX, clientY);
    if (!picked) {
      this.cancelPrefabPlacePreview();
      return;
    }
    const armed = this.prefabPlaceArmedAnchor;
    if (
      armed &&
      armed.x === picked.x &&
      armed.z === picked.z &&
      this.canConfirmArmedPrefabPlace()
    ) {
      this.confirmArmedPrefabPlace();
      return;
    }
    this.armPrefabPlacePreview(picked.x, picked.z);
  }

  private clearPrefabPlaceMeshGhost(): void {
    if (this.prefabPlaceMeshGroup) {
      this.scene.remove(this.prefabPlaceMeshGroup);
      this.prefabPlaceMeshGroup.traverse((child: THREE.Object3D) => {
        disposePlacedBlockGroupContents(child);
      });
      this.prefabPlaceMeshGroup = null;
    }
    this.prefabPlaceMeshTemplateSig = "";
  }

  private clearPrefabPlaceSuppressFootprint(): void {
    this.syncPrefabPlaceSuppressFootprint(null);
  }

  /** Hide placed blocks in the stamp footprint while the place preview is visible. */
  private syncPrefabPlaceSuppressFootprint(
    tiles: readonly { x: number; z: number }[] | null
  ): void {
    const sig = tiles
      ? tiles
          .map((t) => `${t.x},${t.z}`)
          .sort()
          .join(";")
      : "";
    if (sig === this.prefabPlaceSuppressFootprintSig) return;
    this.prefabPlaceSuppressFootprintSig = sig;
    this.prefabPlaceSuppressFloorKeys.clear();
    if (tiles) {
      for (const t of tiles) {
        this.prefabPlaceSuppressFloorKeys.add(`${t.x},${t.z}`);
      }
    }
    this.syncBlockMeshes();
  }

  private rebuildPrefabPlaceMeshTemplate(): void {
    const design = this.prefabPlaceDesign;
    const snap = prefabPlaceSnapshotMatchesDesign(
      design?.id,
      this.prefabPlaceSnapshotDesignId
    )
      ? this.prefabPlaceSnapshot
      : null;
    const sig =
      design && snap
        ? prefabPlaceMeshTemplateSignature(
            design.id,
            design.footprintW,
            design.footprintD,
            this.prefabPlaceYawSteps,
            snap.obstacles
          )
        : "";
    if (sig === this.prefabPlaceMeshTemplateSig && this.prefabPlaceMeshGroup) {
      return;
    }
    this.clearPrefabPlaceMeshGhost();
    this.prefabPlaceMeshTemplateSig = sig;
    if (!design || !snap || snap.obstacles.length === 0) return;

    const group = new THREE.Group();
    const vis = this.blockVisualScale;
    for (const obs of snap.obstacles) {
      const { dx, dz } = rotateDesignOffset(
        obs.dx,
        obs.dz,
        design.footprintW,
        design.footprintD,
        this.prefabPlaceYawSteps
      );
      const yLevel = Math.max(0, Math.min(2, Math.floor(obs.y)));
      const meta = { ...obs.props } as BlockStyleProps;
      const h = this.obstacleHeight(meta);
      const mesh = this.makeBlockMesh(meta, {
        ghost: true,
        floorLayer: yLevel,
      });
      mesh.userData.prefabRelDx = dx;
      mesh.userData.prefabRelDz = dz;
      mesh.userData.prefabYWorld =
        yLevel * BLOCK_SIZE + (h * vis) / 2;
      mesh.position.set(0, mesh.userData.prefabYWorld as number, 0);
      group.add(mesh);
    }
    group.renderOrder = 6;
    group.visible = false;
    this.prefabPlaceMeshGroup = group;
    this.scene.add(group);
  }

  private syncPrefabPlaceMeshAt(anchorX: number, anchorZ: number): void {
    if (!this.prefabPlaceMeshGroup) return;
    const ax = Math.floor(anchorX);
    const az = Math.floor(anchorZ);
    this.prefabPlaceMeshGroup.position.set(0, 0, 0);
    for (const child of this.prefabPlaceMeshGroup.children) {
      const rdx = child.userData.prefabRelDx as number | undefined;
      const rdz = child.userData.prefabRelDz as number | undefined;
      const yWorld = child.userData.prefabYWorld as number | undefined;
      if (
        rdx === undefined ||
        rdz === undefined ||
        yWorld === undefined ||
        !Number.isFinite(rdx) ||
        !Number.isFinite(rdz)
      ) {
        continue;
      }
      child.position.set(ax + rdx, yWorld, az + rdz);
    }
    this.prefabPlaceMeshGroup.visible = true;
  }

  private syncPrefabPlaceGhostAtAnchor(anchorX: number, anchorZ: number): void {
    if (!this.objectPrefabPlaceActive || !this.prefabPlaceDesign) {
      this.clearBillboardFootprintPreviewTiles();
      this.clearPrefabPlaceMeshGhost();
      this.clearPrefabPlaceSuppressFootprint();
      return;
    }
    const ax = Math.floor(anchorX);
    const az = Math.floor(anchorZ);
    this.prefabPlaceHoverAnchor = { x: ax, z: az };
    const valid = this.isPrefabPlaceValidAt(ax, az);
    this.prefabPlaceGhostValid = valid;
    const tiles = footprintTiles(
      ax,
      az,
      this.prefabPlaceDesign.footprintW,
      this.prefabPlaceDesign.footprintD,
      this.prefabPlaceYawSteps
    );
    this.syncBillboardFootprintHighlightTiles(tiles, valid);
    this.syncPrefabPlaceSuppressFootprint(tiles);
    this.rebuildPrefabPlaceMeshTemplate();
    this.syncPrefabPlaceMeshAt(ax, az);
  }

  private syncPrefabPlaceGhostAt(clientX: number, clientY: number): void {
    if (!this.objectPrefabPlaceActive || !this.prefabPlaceDesign) {
      this.clearBillboardFootprintPreviewTiles();
      this.clearPrefabPlaceMeshGhost();
      this.clearPrefabPlaceSuppressFootprint();
      return;
    }
    const picked = this.resolvePrefabPlaceAnchorFromPick(clientX, clientY);
    if (!picked) {
      this.prefabPlaceHoverAnchor = null;
      this.prefabPlaceGhostValid = false;
      this.clearBillboardFootprintPreviewTiles();
      this.clearPrefabPlaceSuppressFootprint();
      if (this.prefabPlaceMeshGroup) this.prefabPlaceMeshGroup.visible = false;
      return;
    }
    this.syncPrefabPlaceGhostAtAnchor(picked.x, picked.z);
  }

  setObjectPrefabBboxCompleteHandler(
    handler: ((bbox: {
      minX: number;
      maxX: number;
      minZ: number;
      maxZ: number;
    }) => void) | null
  ): void {
    this.prefabBboxCompleteHandler = handler;
  }

  setObjectPrefabBboxStatsHandler(
    handler:
      | ((stats: {
          footprintW: number;
          footprintD: number;
          tileCount: number;
          previewDataUrl: string | null;
        } | null) => void)
      | null
  ): void {
    this.prefabBboxStatsHandler = handler;
  }

  /** Mobile preset: fixed square from anchor corner (tap once). */
  tryObjectPrefabPresetAt(clientX: number, clientY: number, size: number): boolean {
    if (!this.objectPrefabSaveActive || !this.buildMode) return false;
    const dest = this.pickFloor(clientX, clientY);
    if (!dest || !this.tileWalkable(dest)) return false;
    const ax = dest.x;
    const az = dest.y;
    const bbox = {
      minX: ax,
      maxX: ax + size - 1,
      minZ: az,
      maxZ: az + size - 1,
    };
    this.syncPrefabBboxOverlay(bbox);
    this.emitPrefabBboxStats(bbox);
    this.prefabBboxCompleteHandler?.(bbox);
    return true;
  }

  clearPrefabSaveCapturePreview(): void {
    for (const m of this.prefabSaveFootprintMeshes) {
      m.visible = false;
    }
    this.clearPrefabSaveMeshGhost();
    this.prefabSaveHoverTile = null;
    if (this.objectPrefabSaveActive) {
      this.tileHighlight.visible = false;
    }
  }

  capturePrefabSnapshotFromBbox(bbox: DesignBbox): DesignSnapshotV1 {
    return captureDesignSnapshot(this.placedObjects, bbox).snapshot;
  }

  getPrefabCaptureThumbnailDataUrl(bbox: DesignBbox): string | null {
    const { w, d } = footprintFromBbox(bbox);
    const { snapshot, obstacleCount } = captureDesignSnapshot(
      this.placedObjects,
      bbox
    );
    if (obstacleCount === 0) return null;
    return this.getPrefabDesignThumbnailDataUrls([
      {
        id: `capture|${bbox.minX}|${bbox.minZ}|${w}|${d}|${obstacleCount}`,
        snapshot,
        footprintW: w,
        footprintD: d,
      },
    ]).get(
      `capture|${bbox.minX}|${bbox.minZ}|${w}|${d}|${obstacleCount}`
    ) ?? null;
  }

  private emitPrefabBboxStats(bbox: DesignBbox): void {
    const { w, d } = footprintFromBbox(bbox);
    this.prefabBboxStatsHandler?.({
      footprintW: w,
      footprintD: d,
      tileCount: w * d,
      previewDataUrl: this.getPrefabCaptureThumbnailDataUrl(bbox),
    });
  }

  /** Matches server `DESIGN_OBJECT_MAX_FOOTPRINT` default. */
  private static readonly PREFAB_SAVE_MAX_FOOTPRINT = 6;

  private clampPrefabSaveBbox(
    startX: number,
    startZ: number,
    curX: number,
    curZ: number
  ): DesignBbox {
    const maxFoot = Game.PREFAB_SAVE_MAX_FOOTPRINT;
    let minX = Math.min(startX, curX);
    let maxX = Math.max(startX, curX);
    let minZ = Math.min(startZ, curZ);
    let maxZ = Math.max(startZ, curZ);
    const w = maxX - minX + 1;
    const d = maxZ - minZ + 1;
    if (w > maxFoot) {
      if (curX >= startX) {
        minX = startX;
        maxX = startX + maxFoot - 1;
      } else {
        maxX = startX;
        minX = startX - maxFoot + 1;
      }
    }
    if (d > maxFoot) {
      if (curZ >= startZ) {
        minZ = startZ;
        maxZ = startZ + maxFoot - 1;
      } else {
        maxZ = startZ;
        minZ = startZ - maxFoot + 1;
      }
    }
    return { minX, maxX, minZ, maxZ };
  }

  private clampPrefabSaveDragCorner(
    startX: number,
    startZ: number,
    curX: number,
    curZ: number
  ): { x: number; z: number } {
    const maxFoot = Game.PREFAB_SAVE_MAX_FOOTPRINT;
    let cx = curX;
    let cz = curZ;
    const dx = cx - startX;
    const dz = cz - startZ;
    if (Math.abs(dx) >= maxFoot) {
      cx = startX + Math.sign(dx) * (maxFoot - 1);
    }
    if (Math.abs(dz) >= maxFoot) {
      cz = startZ + Math.sign(dz) * (maxFoot - 1);
    }
    return { x: cx, z: cz };
  }

  private prefabSaveBboxValid(bbox: DesignBbox): boolean {
    const { w, d } = footprintFromBbox(bbox);
    const maxFoot = Game.PREFAB_SAVE_MAX_FOOTPRINT;
    return w >= 1 && d >= 1 && w <= maxFoot && d <= maxFoot;
  }

  private syncPrefabSaveFootprintTiles(
    tiles: readonly { x: number; z: number }[],
    valid: boolean
  ): void {
    const mat = valid
      ? this.prefabSaveFootprintValidMat
      : this.prefabSaveFootprintInvalidMat;
    while (this.prefabSaveFootprintMeshes.length < tiles.length) {
      const m = new THREE.Mesh(this.billboardFootprintPreviewGeom, mat);
      m.rotation.x = -Math.PI / 2;
      m.renderOrder = 6;
      this.scene.add(m);
      this.prefabSaveFootprintMeshes.push(m);
    }
    for (let i = 0; i < tiles.length; i++) {
      const m = this.prefabSaveFootprintMeshes[i]!;
      const t = tiles[i]!;
      m.material = mat;
      m.position.set(t.x, 0.048, t.z);
      m.visible = true;
    }
    for (let i = tiles.length; i < this.prefabSaveFootprintMeshes.length; i++) {
      this.prefabSaveFootprintMeshes[i]!.visible = false;
    }
  }

  private clearPrefabSaveMeshGhost(): void {
    if (this.prefabSaveMeshGroup) {
      this.scene.remove(this.prefabSaveMeshGroup);
      this.prefabSaveMeshGroup.traverse((child: THREE.Object3D) => {
        disposePlacedBlockGroupContents(child);
      });
      this.prefabSaveMeshGroup = null;
    }
    this.prefabSaveMeshBboxSig = "";
  }

  /** White emissive wash + edge outlines on blocks in the prefab capture selection. */
  private applyPrefabSaveSelectionHighlight(root: THREE.Object3D): void {
    const white = new THREE.Color(0xffffff);
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      const mats = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const raw of mats) {
        if (!(raw instanceof THREE.MeshStandardMaterial)) continue;
        raw.emissive.copy(white);
        raw.emissiveIntensity = 0.48;
        raw.color.lerp(white, 0.42);
        raw.transparent = true;
        raw.opacity = 0.9;
        raw.depthWrite = false;
      }
      mesh.renderOrder = 7;
      const edges = new THREE.EdgesGeometry(mesh.geometry, 12);
      const outline = new THREE.LineSegments(edges, this.prefabSaveOutlineMat);
      outline.userData.prefabSaveOutline = true;
      outline.position.copy(mesh.position);
      outline.rotation.copy(mesh.rotation);
      outline.scale.copy(mesh.scale);
      outline.renderOrder = 8;
      mesh.parent?.add(outline);
    });
  }

  private rebuildPrefabSaveMeshFromBbox(bbox: DesignBbox): void {
    const { snapshot, obstacleCount } = captureDesignSnapshot(
      this.placedObjects,
      bbox
    );
    const sig = `${bbox.minX}|${bbox.minZ}|${bbox.maxX}|${bbox.maxZ}|${obstacleCount}`;
    if (sig === this.prefabSaveMeshBboxSig && this.prefabSaveMeshGroup) {
      return;
    }
    this.clearPrefabSaveMeshGhost();
    this.prefabSaveMeshBboxSig = sig;
    if (obstacleCount === 0) return;

    const group = new THREE.Group();
    const vis = this.blockVisualScale;
    const ax = bbox.minX;
    const az = bbox.minZ;
    for (const obs of snapshot.obstacles) {
      const yLevel = Math.max(0, Math.min(2, Math.floor(obs.y)));
      const meta = { ...obs.props } as BlockStyleProps;
      const h = this.obstacleHeight(meta);
      const mesh = this.makeBlockMesh(meta, {
        ghost: true,
        floorLayer: yLevel,
      });
      mesh.position.set(
        ax + obs.dx,
        yLevel * BLOCK_SIZE + (h * vis) / 2,
        az + obs.dz
      );
      group.add(mesh);
    }
    this.applyPrefabSaveSelectionHighlight(group);
    group.renderOrder = 6;
    this.prefabSaveMeshGroup = group;
    this.scene.add(group);
  }

  private syncPrefabSaveCapturePreview(bbox: DesignBbox): void {
    const tiles: { x: number; z: number }[] = [];
    for (let x = bbox.minX; x <= bbox.maxX; x++) {
      for (let z = bbox.minZ; z <= bbox.maxZ; z++) {
        tiles.push({ x, z });
      }
    }
    const valid = tiles.length > 0 && this.prefabSaveBboxValid(bbox);
    this.syncPrefabSaveFootprintTiles(tiles, valid);
    this.rebuildPrefabSaveMeshFromBbox(bbox);
    this.tileHighlight.visible = false;
  }

  private syncPrefabSaveHoverAt(clientX: number, clientY: number): void {
    if (!this.objectPrefabSaveActive || this.prefabBboxDrag) return;
    const dest = this.pickFloor(clientX, clientY);
    if (!dest || !this.tileWalkable(dest)) {
      this.prefabSaveHoverTile = null;
      this.tileHighlight.visible = false;
      if (!this.prefabBboxDrag) {
        for (const m of this.prefabSaveFootprintMeshes) {
          m.visible = false;
        }
      }
      return;
    }
    this.prefabSaveHoverTile = { x: dest.x, z: dest.y };
    this.tileHighlightMat.color.setHex(0x4ade80);
    this.tileHighlight.position.set(dest.x, 0.048, dest.y);
    this.tileHighlight.visible = true;
    const hoverBbox: DesignBbox = {
      minX: dest.x,
      maxX: dest.x,
      minZ: dest.y,
      maxZ: dest.y,
    };
    this.syncPrefabSaveFootprintTiles([{ x: dest.x, z: dest.y }], true);
    this.rebuildPrefabSaveMeshFromBbox(hoverBbox);
  }

  private syncPrefabBboxOverlay(bbox: DesignBbox): void {
    this.syncPrefabSaveCapturePreview(bbox);
  }

  private prefabBboxFromDrag(): DesignBbox | null {
    if (!this.prefabBboxDrag) return null;
    const { startX, startZ, curX, curZ } = this.prefabBboxDrag;
    return this.clampPrefabSaveBbox(startX, startZ, curX, curZ);
  }

  private clearBillboardFootprintPreviewTiles(): void {
    for (const m of this.billboardFootprintPreviewMeshes) {
      m.visible = false;
    }
  }

  private clearFloorBrushPreviewTiles(): void {
    for (const m of this.floorBrushPreviewMeshes) {
      m.visible = false;
    }
  }

  private syncFloorBrushPreviewTiles(
    tiles: readonly { x: number; z: number }[]
  ): void {
    while (this.floorBrushPreviewMeshes.length < tiles.length) {
      const m = new THREE.Mesh(
        this.floorBrushPreviewGeom,
        this.floorBrushPreviewValidMat
      );
      m.rotation.x = -Math.PI / 2;
      m.renderOrder = 3;
      this.scene.add(m);
      this.floorBrushPreviewMeshes.push(m);
    }
    for (let i = 0; i < tiles.length; i++) {
      const m = this.floorBrushPreviewMeshes[i]!;
      const t = tiles[i]!;
      const valid = this.canPaintFloorTileAt(t.x, t.z);
      m.material = valid
        ? this.floorBrushPreviewValidMat
        : this.floorBrushPreviewInvalidMat;
      m.position.set(t.x, 0.03, t.z);
      m.visible = true;
    }
    for (let i = tiles.length; i < this.floorBrushPreviewMeshes.length; i++) {
      this.floorBrushPreviewMeshes[i]!.visible = false;
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
    const meta = this.placedObjects.get(this.selectedBlockKey);
    const vis = this.blockVisualScale;
    const padding = 0.04;
    let size: THREE.Vector3;
    const center = new THREE.Vector3();
    if (!g) {
      if (!meta) {
        this.selectionOutline.visible = false;
        this.refreshTeleporterLinkHighlight();
        return;
      }
      const parts = this.selectedBlockKey.split(",").map(Number);
      const wx = parts[0]!;
      const wz = parts[1]!;
      const wyLevel = Number.isFinite(parts[2]) ? Math.floor(parts[2]!) : 0;
      if (this.plainCubeInstancedTileKeys.has(this.selectedBlockKey)) {
        const h = this.obstacleHeight(meta);
        center.set(wx, wyLevel * BLOCK_SIZE + (h * vis) / 2, wz);
        const foot = BLOCK_SIZE * vis;
        const sy = h * vis + padding;
        size = new THREE.Vector3(foot + padding, sy, foot + padding);
      } else if (meta.teleporter) {
        const pillarH = TERRAIN_TILE_DOOR_MARKER_HEIGHT + 0.01;
        center.set(wx, wyLevel * BLOCK_SIZE + pillarH / 2, wz);
        const foot = BLOCK_SIZE * vis;
        size = new THREE.Vector3(foot + padding, pillarH + padding, foot + padding);
      } else {
        this.selectionOutline.visible = false;
        this.refreshTeleporterLinkHighlight();
        return;
      }
    } else if (meta?.pyramid) {
      const h = this.obstacleHeight(meta);
      center.copy(g.position);
      const foot = BLOCK_SIZE * vis;
      const sy = h * vis + padding;
      size = new THREE.Vector3(foot + padding, sy, foot + padding);
    } else if (g) {
      center.copy(g.position);
      /** Pyramid base can scale past the tile; keep the selection box one tile so it stays predictable. */
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
    } else {
      this.selectionOutline.visible = false;
      this.refreshTeleporterLinkHighlight();
      return;
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
    if (
      meta &&
      isPlainCubeTerrain(normalizeBlockPrismParts(meta)) &&
      !meta.pyramid
    ) {
      applyPlainCubeMeshRotation(
        this.selectionOutline.rotation,
        cubeRotationForPlainCube(normalizeBlockPrismParts(meta), meta)
      );
    } else {
      this.selectionOutline.rotation.set(0, 0, 0);
    }
    this.selectionOutline.visible = true;
    this.refreshTeleporterLinkHighlight();
  }

  /** When a teleporter is selected in build mode, tint its in-room exit (saved + unsaved draft). */
  private refreshTeleporterLinkHighlight(): void {
    const hideAll = (): void => {
      this.teleporterLinkHighlight.visible = false;
      this.teleporterDraftDestHighlight.visible = false;
    };
    if (!this.buildMode || !this.selectedBlockKey) {
      hideAll();
      return;
    }
    const draft = this.teleporterEditDestDraft;
    if (draft) {
      this.teleporterDraftDestHighlight.position.set(draft.x, 0.026, draft.z);
      this.teleporterDraftDestHighlight.visible = true;
      this.teleporterLinkHighlight.visible = false;
      return;
    }
    this.teleporterDraftDestHighlight.visible = false;
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
        colorRgb: resolveBlockColorRgb(gateMeta),
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

  setTeleporterPlacementPreviewActive(active: boolean): void {
    this.teleporterPlacementPreviewActive = active;
    if (!active) {
      this.clearTeleporterPlacementPreview();
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
    billboardSourceTab: "images" | "other" | "campaign";
    rotationSetId: string;
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
      rotationSetId: this.billboardPlacementDraft.rotationSetId,
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
    billboardSourceTab?: "images" | "other" | "campaign";
    rotationSetId?: string;
  }): void {
    let previewPoseChanged = false;
    if (patch.orientation !== undefined) {
      let o = patch.orientation;
      if (BILLBOARD_VERTICAL_PLACEMENT_TEMP_DISABLED && o === "vertical") {
        o = "horizontal";
      }
      this.billboardPlacementDraft.orientation = o;
      previewPoseChanged = true;
    }
    if (patch.yawSteps !== undefined) {
      this.billboardPlacementDraft.yawSteps = Math.max(
        0,
        Math.min(3, Math.floor(patch.yawSteps))
      );
      previewPoseChanged = true;
    }
    if (previewPoseChanged && this.inspectorPlacementPort) {
      this.inspectorPlacementPort.lastSig = "";
      this.renderInspectorTilePreview("placement");
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
    if (patch.rotationSetId !== undefined) {
      this.billboardPlacementDraft.rotationSetId = String(
        patch.rotationSetId ?? ""
      ).trim();
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
    if (on) {
      this.floorExpandMode = false;
      this.pendingGateAdjacentInteract = null;
    }
    if (!on) {
      this.clearPendingBuildPlace();
      this.clearPlacementPreview();
      this.clearRepositionBillboardVisualState();
      this.repositionFrom = null;
      this.repositionGateHint = null;
      this.repositionGatePlacedVisualFreeze = null;
      this.setBillboardPlacementPreviewActive(false);
      this.clearSelectedBlock();
      this.clearObjectPrefabToolVisuals();
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

  setStreamObserverMode(on: boolean): void {
    if (on === this.streamObserverMode) return;
    this.streamObserverMode = on;
    if (on) {
      this.setBuildMode(false);
      this.setFloorExpandMode(false);
      this.tileHighlight.visible = false;
      this.blockTopHighlight.visible = false;
      this.clearFloorHoverVisuals();
      if (this.selfMesh) {
        this.disposeAvatarGroup(this.selfMesh);
        this.scene.remove(this.selfMesh);
        this.selfMesh = null;
      }
      this.selfTargetPos = null;
    }
    this.syncPlacementRangeHints();
    this.requestRender();
  }

  isStreamObserverMode(): boolean {
    return this.streamObserverMode;
  }

  private tileWithinPlaceRadius(tx: number, tz: number): boolean {
    if (!this.selfMesh || this.placeRadiusBlocks <= 0) return false;
    const px = this.selfMesh.position.x;
    const pz = this.selfMesh.position.z;
    const stand = snapFloorTile(px, pz);
    return (
      Math.abs(tx - stand.x) <= this.placeRadiusBlocks &&
      Math.abs(tz - stand.y) <= this.placeRadiusBlocks
    );
  }

  setFloorExpandMode(on: boolean): void {
    this.floorExpandMode = on;
    if (on) {
      this.buildMode = false;
      this.pendingGateAdjacentInteract = null;
      this.clearPendingBuildPlace();
      this.clearPlacementPreview();
      this.clearRepositionBillboardVisualState();
      this.repositionFrom = null;
      this.repositionGateHint = null;
      this.repositionGatePlacedVisualFreeze = null;
      this.setBillboardPlacementPreviewActive(false);
      this.clearObjectPrefabToolVisuals();
    } else {
      this.roomEntrySpawnPickHandler = null;
      this.clearFloorBrushPreviewTiles();
      this.clearFloorHoverVisuals();
      this.setFloorEyedropperActive(false);
    }
    this.syncHighlightColor();
    this.syncPlacementRangeHints();
    this.syncRoomEntrySpawnMarker(performance.now() * 0.001);
    this.requestRender();
  }

  getFloorExpandMode(): boolean {
    return this.floorExpandMode;
  }

  setFloorPlacementColorRgb(rgb: number): void {
    this.floorPlacementColorRgb = clampColorRgb(rgb);
    this.floorBrushPreviewValidMat.color.setHex(this.floorPlacementColorRgb);
    this.floorHoverPreviewMat.color.setHex(this.floorPlacementColorRgb);
    if (this.floorHoverPreviewTiles.length > 0) {
      this.syncFloorHoverColorPreview(this.floorHoverPreviewTiles);
    }
    this.syncHighlightColor();
    this.requestRender(80);
  }

  setFloorBrushSize(size: FloorBrushSize): void {
    this.floorBrushSize = size;
    this.requestRender(80);
  }

  getFloorBrushSize(): FloorBrushSize {
    return this.floorBrushSize;
  }

  setFloorEyedropperActive(active: boolean): void {
    if (this.floorEyedropperActive === active) return;
    this.floorEyedropperActive = active;
    if (!active) {
      this.floorEyedropperHoverHandler?.(null);
      this.clearFloorBrushPreviewTiles();
      this.clearFloorHoverVisuals();
    }
    this.syncFloorEyedropperCanvasCursor(null);
    this.requestRender(80);
  }

  getFloorEyedropperActive(): boolean {
    return this.floorEyedropperActive;
  }

  setFloorEyedropperHoverHandler(
    fn: ((rgb: number | null) => void) | null
  ): void {
    this.floorEyedropperHoverHandler = fn;
  }

  setFloorEyedropperSampleHandler(fn: ((rgb: number) => void) | null): void {
    this.floorEyedropperSampleHandler = fn;
  }

  /** Stored paint color for a floor tile (ignores door/portal glow). */
  getLogicalFloorPaintColorAt(x: number, z: number): number | null {
    if (!this.isFloorEyedropperSampleTarget(x, z)) return null;
    const k = tileKey(x, z);
    const isExtra = !isBaseTile(x, z, this.roomId);
    if (isExtra) {
      return this.extraFloorColorByKey.get(k) ?? TERRAIN_TILE_EXTRA_COLOR;
    }
    return (
      this.baseFloorColorByKey.get(k) ??
      this.implicitBaseFloorColorRgb(x, z) ??
      TERRAIN_TILE_CORE_COLOR
    );
  }

  private isFloorEyedropperSampleTarget(x: number, z: number): boolean {
    if (this.isFloorRecolorTarget(x, z)) return true;
    const k = tileKey(x, z);
    if (this.extraFloorKeys.has(k)) return true;
    return this.tileWalkable({ x, y: z });
  }

  private syncFloorEyedropperCanvasCursor(
    sampleable: boolean | null
  ): void {
    if (!this.floorExpandMode || !this.floorEyedropperActive) {
      this.renderer.domElement.style.cursor = "pointer";
      return;
    }
    if (sampleable === null) {
      this.renderer.domElement.style.cursor = "crosshair";
      return;
    }
    this.renderer.domElement.style.cursor = sampleable
      ? "crosshair"
      : "not-allowed";
  }

  private syncFloorEyedropperHover(clientX: number, clientY: number): void {
    this.tileHighlight.visible = false;
    this.clearFloorBrushPreviewTiles();
    this.clearFloorHoverVisuals();
    const t = this.pickFloor(clientX, clientY);
    if (!t) {
      this.syncFloorEyedropperCanvasCursor(false);
      this.floorEyedropperHoverHandler?.(null);
      return;
    }
    const rgb = this.getLogicalFloorPaintColorAt(t.x, t.y);
    this.syncFloorEyedropperCanvasCursor(rgb !== null);
    this.floorEyedropperHoverHandler?.(rgb);
  }

  private tryFloorEyedropperSampleAt(clientX: number, clientY: number): boolean {
    if (!this.floorEyedropperActive || this.roomEntrySpawnPickHandler) {
      return false;
    }
    const dest = this.pickFloor(clientX, clientY);
    if (!dest) return true;
    const rgb = this.getLogicalFloorPaintColorAt(dest.x, dest.y);
    if (rgb === null) return true;
    this.setFloorPlacementColorRgb(rgb);
    this.floorEyedropperSampleHandler?.(rgb);
    return true;
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

  /** Welcome batch - one floor mesh pass for large spatial rooms (e.g. Pixel). */
  applyWelcomeFloorPayload(opts: {
    extraFloorTiles?: readonly { x: number; z: number; colorRgb?: number }[];
    baseFloorColorTiles?: readonly { x: number; z: number; colorRgb?: number }[];
    removedBaseFloorTiles?: readonly { x: number; z: number }[];
    spawnX: number;
    spawnZ: number;
  }): void {
    this.extraFloorKeys.clear();
    this.extraFloorColorByKey.clear();
    for (const t of opts.extraFloorTiles ?? []) {
      const k = tileKey(t.x, t.z);
      this.extraFloorKeys.add(k);
      this.extraFloorColorByKey.set(
        k,
        t.colorRgb !== undefined
          ? clampColorRgb(t.colorRgb)
          : TERRAIN_TILE_EXTRA_COLOR
      );
    }
    this.baseFloorColorByKey.clear();
    for (const t of opts.baseFloorColorTiles ?? []) {
      if (t.colorRgb === undefined) continue;
      this.baseFloorColorByKey.set(
        tileKey(t.x, t.z),
        clampColorRgb(t.colorRgb)
      );
    }
    this.removedBaseFloorKeys.clear();
    for (const t of opts.removedBaseFloorTiles ?? []) {
      this.removedBaseFloorKeys.add(tileKey(t.x, t.z));
    }
    if (roomUsesSpatialInterest(this.roomBounds)) {
      const chunkKeys = interestChunksFromRect({
        centerX: opts.spawnX,
        centerZ: opts.spawnZ,
        halfW: DEFAULT_INTEREST_HALF_TILES,
        halfH: DEFAULT_INTEREST_HALF_TILES,
      });
      this.syncWalkableFloorChunkKeys(chunkKeys);
    } else {
      this.syncWalkableFloorMeshes();
    }
    this.refreshPathLine();
    this.syncPlacementRangeHints();
  }

  setExtraFloorTiles(
    tiles: readonly { x: number; z: number; colorRgb?: number }[]
  ): void {
    this.extraFloorKeys.clear();
    this.extraFloorColorByKey.clear();
    for (const t of tiles) {
      const k = tileKey(t.x, t.z);
      this.extraFloorKeys.add(k);
      this.extraFloorColorByKey.set(
        k,
        t.colorRgb !== undefined
          ? clampColorRgb(t.colorRgb)
          : TERRAIN_TILE_EXTRA_COLOR
      );
    }
    if (roomUsesSpatialInterest(this.roomBounds)) {
      const chunkKeys = interestChunksForTileKeys([
        ...this.extraFloorKeys,
        ...this.baseFloorColorByKey.keys(),
        ...this.removedBaseFloorKeys,
      ]);
      if (chunkKeys.size > 0) {
        this.syncWalkableFloorChunkKeys(chunkKeys);
      }
    } else {
      this.syncWalkableFloorMeshes();
    }
    this.refreshPathLine();
    this.syncPlacementRangeHints();
  }

  /** Incremental extra-floor update (server-synced). */
  applyExtraFloorDelta(
    add: readonly { x: number; z: number; colorRgb?: number }[],
    remove: readonly string[]
  ): void {
    if (!this.spatialStreamRetainLoaded()) {
      for (const k of remove) {
        this.extraFloorKeys.delete(k);
        this.extraFloorColorByKey.delete(k);
      }
    }
    for (const t of add) {
      const k = tileKey(t.x, t.z);
      this.extraFloorKeys.add(k);
      this.extraFloorColorByKey.set(
        k,
        t.colorRgb !== undefined
          ? clampColorRgb(t.colorRgb)
          : TERRAIN_TILE_EXTRA_COLOR
      );
    }
    this.syncWalkableFloorTiles([
      ...remove,
      ...add.map((t) => tileKey(t.x, t.z)),
    ]);
    this.refreshPathLine();
    this.syncPlacementRangeHints();
  }

  /** Custom tint on core/base walkable floor (server-synced). */
  setBaseFloorColorTiles(
    tiles: readonly { x: number; z: number; colorRgb?: number }[]
  ): void {
    this.baseFloorColorByKey.clear();
    for (const t of tiles) {
      const k = tileKey(t.x, t.z);
      if (t.colorRgb === undefined) continue;
      this.baseFloorColorByKey.set(k, clampColorRgb(t.colorRgb));
    }
    if (roomUsesSpatialInterest(this.roomBounds)) {
      const chunkKeys = interestChunksForTileKeys([
        ...this.baseFloorColorByKey.keys(),
      ]);
      if (chunkKeys.size > 0) {
        this.syncWalkableFloorChunkKeys(chunkKeys);
      }
    } else {
      this.syncWalkableFloorMeshes();
    }
  }

  applyBaseFloorColorDelta(
    add: readonly { x: number; z: number; colorRgb?: number }[],
    remove: readonly string[],
    loadChunks?: readonly string[]
  ): void {
    const effectiveRemove = this.spatialStreamRetainLoaded() ? [] : remove;
    for (const k of effectiveRemove) {
      this.baseFloorColorByKey.delete(k);
    }
    for (const t of add) {
      if (t.colorRgb === undefined) continue;
      this.baseFloorColorByKey.set(tileKey(t.x, t.z), clampColorRgb(t.colorRgb));
    }
    if (
      loadChunks &&
      loadChunks.length > 0 &&
      roomUsesSpatialInterest(this.roomBounds)
    ) {
      this.syncWalkableFloorChunkKeys(new Set(loadChunks));
      return;
    }
    this.syncWalkableFloorTiles([
      ...effectiveRemove,
      ...add.map((t) => tileKey(t.x, t.z)),
    ]);
  }

  setRemovedBaseFloorTiles(tiles: readonly { x: number; z: number }[]): void {
    this.removedBaseFloorKeys.clear();
    for (const t of tiles) {
      this.removedBaseFloorKeys.add(tileKey(t.x, t.z));
    }
    if (roomUsesSpatialInterest(this.roomBounds)) {
      const chunkKeys = interestChunksForTileKeys([
        ...this.removedBaseFloorKeys,
      ]);
      if (chunkKeys.size > 0) {
        this.syncWalkableFloorChunkKeys(chunkKeys);
      }
    } else {
      this.syncWalkableFloorMeshes();
    }
    this.refreshPathLine();
    this.syncPlacementRangeHints();
  }

  applyRemovedBaseFloorDelta(add: readonly string[], remove: readonly string[]): void {
    const effectiveRemove = this.spatialStreamRetainLoaded() ? [] : remove;
    for (const k of effectiveRemove) {
      this.removedBaseFloorKeys.delete(k);
    }
    for (const k of add) {
      this.removedBaseFloorKeys.add(k);
      this.baseFloorColorByKey.delete(k);
    }
    this.syncWalkableFloorTiles([...effectiveRemove, ...add]);
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
    const prevHoverKey = this.signboardHoverFloorKey;
    this.signboards.clear();
    for (const s of signboards) {
      const k = tileKey(s.x, s.z);
      this.signboards.set(k, { ...s });
    }
    if (!prevHoverKey || !this.signboardHoverHandler) return;
    const hovered = this.signboards.get(prevHoverKey);
    if (hovered) {
      this.signboardHoverActiveId = null;
      this.signboardHoverHandler(hovered);
    } else {
      this.signboardHoverActiveId = null;
      this.signboardHoverFloorKey = null;
      this.signboardHoverHandler(null);
    }
  }

  setAttentionMarkerToolActive(active: boolean): void {
    this.attentionMarkerToolActive = active;
  }

  isAttentionMarkerToolActive(): boolean {
    return this.attentionMarkerToolActive;
  }

  getAttentionMarkerAt(x: number, z: number): AttentionMarkerWire | null {
    return this.attentionMarkers.get(tileKey(x, z))?.data ?? null;
  }

  listAttentionMarkers(): AttentionMarkerWire[] {
    return [...this.attentionMarkers.values()].map((e) => ({ ...e.data }));
  }

  setAttentionMarkers(markers: readonly AttentionMarkerWire[]): void {
    const nextKeys = new Set(
      markers.map((m) => tileKey(Math.floor(m.x), Math.floor(m.z)))
    );
    for (const [k, entry] of this.attentionMarkers) {
      if (nextKeys.has(k)) continue;
      this.scene.remove(entry.group);
      entry.group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const mat = obj.material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat.dispose();
        }
      });
      this.attentionMarkers.delete(k);
    }
    for (const raw of markers) {
      const x = Math.floor(raw.x);
      const z = Math.floor(raw.z);
      const k = tileKey(x, z);
      const data: AttentionMarkerWire = {
        x,
        z,
        hoverHeight: Math.max(0, Math.min(3, Math.floor(raw.hoverHeight ?? 1))),
        colorRgb: (raw.colorRgb >>> 0) & 0xffffff,
      };
      const existing = this.attentionMarkers.get(k);
      if (existing) {
        existing.data = data;
        tintAttentionMarkerGroup(existing.group, data.colorRgb);
        existing.baseY = this.attentionMarkerBaselineY(x, z);
        continue;
      }
      const group = makeAttentionMarkerGroup(data.colorRgb);
      const baseY = this.attentionMarkerBaselineY(x, z);
      group.position.set(x, baseY + attentionMarkerHoverLift(data.hoverHeight), z);
      this.scene.add(group);
      this.attentionMarkers.set(k, { data, group, baseY });
    }
  }

  private attentionMarkerBaselineY(x: number, z: number): number {
    let top = 0;
    for (let y = 0; y <= 2; y++) {
      const meta = this.getPlacedAt(x, z, y);
      if (!meta) continue;
      top = Math.max(
        top,
        y * BLOCK_SIZE + this.obstacleHeight(meta) * this.blockVisualScale
      );
    }
    return top;
  }

  private updateAttentionMarkerMotion(): void {
    const t = this.doorPulseTime;
    for (const entry of this.attentionMarkers.values()) {
      const baseY = this.attentionMarkerBaselineY(entry.data.x, entry.data.z);
      entry.baseY = baseY;
      const lift = attentionMarkerHoverLift(entry.data.hoverHeight);
      const bounce = attentionMarkerBounceOffset(t);
      entry.group.position.set(
        entry.data.x,
        baseY + lift + bounce,
        entry.data.z
      );
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
    if (!handler) {
      this.signboardHoverHandler = null;
      this.signboardHoverFloorKey = null;
      this.signboardHoverActiveId = null;
      return;
    }
    this.signboardHoverHandler = (signboard) => {
      const nextId = signboard?.id ?? null;
      if (nextId === this.signboardHoverActiveId) return;
      this.signboardHoverActiveId = nextId;
      this.signboardHoverFloorKey = signboard
        ? tileKey(signboard.x, signboard.z)
        : null;
      handler(signboard);
    };
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

  setBillboards(
    billboards: readonly BillboardState[],
    opts?: { refreshRotationContent?: boolean }
  ): void {
    const refreshRotation = opts?.refreshRotationContent !== false;
    this.billboardSyncGen++;
    const gen = this.billboardSyncGen;
    const prevSelectedBb = this.selectedBillboardId;
    const prevSpecs = refreshRotation
      ? null
      : new Map(this.billboardSpecs);
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
      let merged = raw;
      if (!refreshRotation && String(raw.rotationSetId ?? "").trim()) {
        const prev = prevSpecs?.get(raw.id);
        if (prev?.rotationSetId) {
          merged = {
            ...raw,
            slides: prev.slides,
            intervalMs: prev.intervalMs,
            slideDurationsMs: prev.slideDurationsMs,
            slideVisitNames: prev.slideVisitNames,
            slideVisitUrls: prev.slideVisitUrls,
            slideMiniappTargetUrls: prev.slideMiniappTargetUrls,
            slideCampaignIds: prev.slideCampaignIds,
            advertIds: prev.advertIds,
            advertId: prev.advertId,
            visitName: prev.visitName,
            visitUrl: prev.visitUrl,
            miniappTargetUrl: prev.miniappTargetUrl,
            slideshowEpochMs: prev.slideshowEpochMs,
            rotationRevision: prev.rotationRevision,
          };
        }
      }
      const rawIds = merged.advertIds;
      let advertIds: string[] | undefined;
      if (Array.isArray(rawIds) && rawIds.length > 0) {
        advertIds = rawIds
          .map((x) => String(x ?? "").trim())
          .filter(Boolean)
          .slice(0, 8);
      }
      if (!advertIds?.length && merged.advertId) {
        advertIds = [String(merged.advertId).trim()].filter(Boolean);
      }
      const se = Number(merged.slideshowEpochMs);
      const lcRaw = merged.liveChart as
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
        ...merged,
        advertId: String(merged.advertId ?? "").trim(),
        advertIds: advertIds?.length ? advertIds : undefined,
        slideshowEpochMs: Number.isFinite(se) ? se : undefined,
        visitName: String(merged.visitName ?? "").trim(),
        visitUrl: String(merged.visitUrl ?? "").trim(),
        miniappTargetUrl: String(merged.miniappTargetUrl ?? "").trim() || undefined,
        campaignId: String(merged.campaignId ?? "").trim() || undefined,
        rotationSetId: String(merged.rotationSetId ?? "").trim() || undefined,
        rotationRevision: Number(merged.rotationRevision) || undefined,
        slideDurationsMs: Array.isArray(merged.slideDurationsMs)
          ? merged.slideDurationsMs
          : undefined,
        slideVisitNames: Array.isArray(merged.slideVisitNames)
          ? merged.slideVisitNames
          : undefined,
        slideVisitUrls: Array.isArray(merged.slideVisitUrls)
          ? merged.slideVisitUrls
          : undefined,
        slideMiniappTargetUrls: Array.isArray(merged.slideMiniappTargetUrls)
          ? merged.slideMiniappTargetUrls
          : undefined,
        slideCampaignIds: Array.isArray(merged.slideCampaignIds)
          ? merged.slideCampaignIds
          : undefined,
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

    /** Timers must not run heavy chart work in the same turn as gameplay RAF - defer to idle. */
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
      this.refreshInspectorBillboardSelectionPreviewIfNeeded(b.id);
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
      hexRadiusScale?: number;
      sphere?: boolean;
      ramp?: boolean;
      rampDir?: number;
      colorRgb?: number;
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
            pairedPeerKey?: string;
          };
      gate?: {
        adminAddress: string;
        authorizedAddresses: string[];
        exitX: number;
        exitZ: number;
      };
      gateOpen?: { openedBy: string; untilMs: number };
      unlockPad?: {
        amountLuna: string;
        recipient: string;
        buttonLabel: string;
        proofMode: "optimistic" | "payment_intent";
        instanceId: string;
      };
      signboardId?: string;
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
      const hexRadiusScale = prism.hex
        ? clampHexRadiusScale(
            Number(
              t.hexRadiusScale ??
                (t as { hexHeightScale?: number }).hexHeightScale ??
                1
            )
          )
        : 1;
      const sphereRadiusScale = prism.sphere
        ? clampSphereRadiusScale(Number(t.sphereRadiusScale ?? 1))
        : 1;
      const cubeRot = cubeRotationForPlainCube(prism, t);
      const colorRgb = resolveBlockColorRgb(t);
      const locked = Boolean(t.locked);
      const signboardId =
        typeof t.signboardId === "string" && t.signboardId.trim().length > 0
          ? t.signboardId.trim()
          : undefined;
      this.placedObjects.set(k, {
        passable: t.passable,
        half,
        quarter,
        hex: prism.hex,
        pyramid: prism.pyramid,
        pyramidBaseScale,
        hexRadiusScale,
        sphere: prism.sphere,
        sphereRadiusScale,
        ramp: prism.ramp,
        rampDir: prism.ramp ? rampDir : 0,
        ...cubeRot,
        colorRgb,
        locked,
        signboardId,
        claimable: t.claimable,
        active: t.active,
        cooldownMs: t.cooldownMs,
        lastClaimedAt: t.lastClaimedAt,
        claimedBy: t.claimedBy,
        teleporter: t.teleporter,
        gate: t.gate,
        gateOpen: t.gateOpen,
        unlockPad: t.unlockPad,
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
      hexRadiusScale?: number;
      sphereRadiusScale?: number;
      sphere?: boolean;
      ramp?: boolean;
      rampDir?: number;
      cubeRotX?: number;
      cubeRotY?: number;
      cubeRotZ?: number;
      cubePitch?: number;
      colorRgb?: number;
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
            pairedPeerKey?: string;
          };
      gate?: {
        adminAddress: string;
        authorizedAddresses: string[];
        exitX: number;
        exitZ: number;
      };
      gateOpen?: { openedBy: string; untilMs: number };
      unlockPad?: {
        amountLuna: string;
        recipient: string;
        buttonLabel: string;
        proofMode: "optimistic" | "payment_intent";
        instanceId: string;
      };
      signboardId?: string;
    }[],
    remove: readonly string[]
  ): void {
    // Remove tiles first so that replacements don't leave stale blocking keys.
    if (!this.spatialStreamRetainLoaded()) {
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
      const hexRadiusScale = prism.hex
        ? clampHexRadiusScale(
            Number(
              t.hexRadiusScale ??
                (t as { hexHeightScale?: number }).hexHeightScale ??
                1
            )
          )
        : 1;
      const sphereRadiusScale = prism.sphere
        ? clampSphereRadiusScale(Number(t.sphereRadiusScale ?? 1))
        : 1;
      const cubeRot = cubeRotationForPlainCube(prism, t);
      const colorRgb = resolveBlockColorRgb(t);
      const locked = Boolean(t.locked);
      const signboardId =
        typeof t.signboardId === "string" && t.signboardId.trim().length > 0
          ? t.signboardId.trim()
          : undefined;

      this.placedObjects.set(k, {
        passable: t.passable,
        half,
        quarter,
        hex: prism.hex,
        pyramid: prism.pyramid,
        pyramidBaseScale,
        hexRadiusScale,
        sphere: prism.sphere,
        sphereRadiusScale,
        ramp: prism.ramp,
        rampDir: prism.ramp ? rampDir : 0,
        ...cubeRot,
        colorRgb,
        locked,
        signboardId,
        claimable: t.claimable,
        active: t.active,
        cooldownMs: t.cooldownMs,
        lastClaimedAt: t.lastClaimedAt,
        claimedBy: t.claimedBy,
        teleporter: t.teleporter,
        gate: t.gate,
        gateOpen: t.gateOpen,
        unlockPad: t.unlockPad,
      });

      if (y === 0 && !t.passable && !prism.ramp) {
        this.blockingTileKeys.add(tileKey(t.x, t.z));
      }
    }

    const changedKeys = new Set<string>(remove);
    for (const t of add) {
      const y = Math.max(0, Math.min(2, Math.floor(t.y ?? 0)));
      changedKeys.add(blockKey(t.x, t.z, y));
    }
    this.syncBlockMeshesForKeys(changedKeys);
    if (!this.streamPresentationActive) {
      this.refreshPathLine();
      this.syncPlacementRangeHints();
    }
    this.markSceneMutation(`applyObstaclesDelta:add${add.length}:remove${remove.length}`);
  }

  /** Floor tiles where a new block can be placed (within server place radius, empty, walkable). */
  private clearFloorHoverPreview(): void {
    for (const m of this.floorHoverPreviewMeshes) {
      m.visible = false;
    }
    this.floorHoverPreviewTiles = [];
  }

  private clearFloorHoverVisuals(): void {
    this.clearFloorHoverOutline();
    this.clearFloorHoverPreview();
  }

  private syncFloorHoverColorPreview(
    tiles: readonly { x: number; z: number }[]
  ): void {
    this.floorHoverPreviewMat.color.setHex(this.floorPlacementColorRgb);
    const validTiles = tiles.filter((t) => this.canPaintFloorTileAt(t.x, t.z));
    this.floorHoverPreviewTiles = validTiles.map((t) => ({ x: t.x, z: t.z }));
    while (this.floorHoverPreviewMeshes.length < validTiles.length) {
      const m = new THREE.Mesh(
        this.floorHoverPreviewGeom,
        this.floorHoverPreviewMat
      );
      m.rotation.x = -Math.PI / 2;
      m.renderOrder = 2;
      this.scene.add(m);
      this.floorHoverPreviewMeshes.push(m);
    }
    for (let i = 0; i < validTiles.length; i++) {
      const m = this.floorHoverPreviewMeshes[i]!;
      const t = validTiles[i]!;
      m.position.set(t.x, 0.026, t.z);
      m.visible = true;
    }
    for (let i = validTiles.length; i < this.floorHoverPreviewMeshes.length; i++) {
      this.floorHoverPreviewMeshes[i]!.visible = false;
    }
  }

  private syncFloorHoverVisuals(
    tiles: readonly { x: number; z: number }[]
  ): void {
    this.syncFloorHoverOutline(tiles);
    this.syncFloorHoverColorPreview(tiles);
  }

  private clearFloorHoverOutline(): void {
    if (this.floorHoverOutlineValidLines) {
      this.scene.remove(this.floorHoverOutlineValidLines);
      this.floorHoverOutlineValidLines.geometry.dispose();
      this.floorHoverOutlineValidLines = null;
    }
    if (this.floorHoverOutlineInvalidLines) {
      this.scene.remove(this.floorHoverOutlineInvalidLines);
      this.floorHoverOutlineInvalidLines.geometry.dispose();
      this.floorHoverOutlineInvalidLines = null;
    }
  }

  private pushTileSquareOutlineSegments(
    segments: number[],
    tx: number,
    tz: number,
    y: number
  ): void {
    segments.push(
      tx - 0.5,
      y,
      tz - 0.5,
      tx + 0.5,
      y,
      tz - 0.5,
      tx + 0.5,
      y,
      tz - 0.5,
      tx + 0.5,
      y,
      tz + 0.5,
      tx + 0.5,
      y,
      tz + 0.5,
      tx - 0.5,
      y,
      tz + 0.5,
      tx - 0.5,
      y,
      tz + 0.5,
      tx - 0.5,
      y,
      tz - 0.5
    );
  }

  private syncFloorHoverOutline(
    tiles: readonly { x: number; z: number }[]
  ): void {
    this.clearFloorHoverOutline();
    if (tiles.length === 0) return;
    const y = 0.028;
    const validSegs: number[] = [];
    const invalidSegs: number[] = [];
    for (const t of tiles) {
      const target = this.canPaintFloorTileAt(t.x, t.z) ? validSegs : invalidSegs;
      this.pushTileSquareOutlineSegments(target, t.x, t.z, y);
    }
    if (validSegs.length > 0) {
      const geom = new THREE.BufferGeometry();
      geom.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(validSegs, 3)
      );
      const lines = new THREE.LineSegments(geom, this.floorHoverOutlineValidMat);
      lines.renderOrder = 3;
      this.scene.add(lines);
      this.floorHoverOutlineValidLines = lines;
    }
    if (invalidSegs.length > 0) {
      const geom = new THREE.BufferGeometry();
      geom.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(invalidSegs, 3)
      );
      const lines = new THREE.LineSegments(geom, this.floorHoverOutlineInvalidMat);
      lines.renderOrder = 3;
      this.scene.add(lines);
      this.floorHoverOutlineInvalidLines = lines;
    }
  }

  private clearFloorBuildRangeOutlines(): void {
    if (this.floorBuildOutlineLines) {
      this.scene.remove(this.floorBuildOutlineLines);
      this.floorBuildOutlineLines.geometry.dispose();
      this.floorBuildOutlineLines = null;
    }
  }

  private floorBuildTileInRange(
    tx: number,
    tz: number,
    px: number,
    pz: number,
    radius: number
  ): boolean {
    const stand = snapFloorTile(px, pz);
    if (
      Math.abs(tx - stand.x) > radius ||
      Math.abs(tz - stand.y) > radius
    ) {
      return false;
    }
    return this.floorTilePaintable(tx, tz);
  }

  /** White square-tile edges on the outside of the paintable build region only. */
  private syncFloorBuildPerimeterOutline(
    px: number,
    pz: number,
    radius: number
  ): void {
    const stand = snapFloorTile(px, pz);
    const minX = stand.x - radius;
    const maxX = stand.x + radius;
    const minZ = stand.y - radius;
    const maxZ = stand.y + radius;
    const inRange = new Set<string>();
    for (let tx = minX; tx <= maxX; tx++) {
      for (let tz = minZ; tz <= maxZ; tz++) {
        if (!this.floorBuildTileInRange(tx, tz, px, pz, radius)) continue;
        inRange.add(tileKey(tx, tz));
      }
    }
    if (inRange.size === 0) return;

    const y = 0.022;
    const segments: number[] = [];
    const has = (tx: number, tz: number) => inRange.has(tileKey(tx, tz));

    for (const k of inRange) {
      const parts = k.split(",").map(Number);
      const tx = parts[0];
      const tz = parts[1];
      if (!Number.isFinite(tx) || !Number.isFinite(tz)) continue;
      if (!has(tx - 1, tz)) {
        segments.push(tx - 0.5, y, tz - 0.5, tx - 0.5, y, tz + 0.5);
      }
      if (!has(tx + 1, tz)) {
        segments.push(tx + 0.5, y, tz - 0.5, tx + 0.5, y, tz + 0.5);
      }
      if (!has(tx, tz - 1)) {
        segments.push(tx - 0.5, y, tz - 0.5, tx + 0.5, y, tz - 0.5);
      }
      if (!has(tx, tz + 1)) {
        segments.push(tx - 0.5, y, tz + 0.5, tx + 0.5, y, tz + 0.5);
      }
    }

    if (segments.length === 0) return;
    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(segments, 3)
    );
    const lines = new THREE.LineSegments(geom, this.floorBuildOutlineMat);
    lines.renderOrder = 2;
    this.scene.add(lines);
    this.floorBuildOutlineLines = lines;
  }

  private syncPlacementRangeHints(): void {
    for (const [, m] of this.placementHintMeshes) {
      this.scene.remove(m);
    }
    this.placementHintMeshes.clear();
    this.clearFloorBuildRangeOutlines();
    if (
      this.streamPresentationActive ||
      this.streamObserverMode ||
      !this.selfMesh ||
      this.placeRadiusBlocks <= 0
    ) {
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
    if (this.buildMode) {
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
      return;
    }
    if (!this.floorExpandMode) return;
    this.syncFloorBuildPerimeterOutline(px, pz, R);
  }

  private syncHighlightColor(): void {
    this.defaultTileHoverOutline.visible = false;
    if (this.repositionFrom) {
      this.tileHighlightMat.color.setHex(0xc084fc);
      return;
    }
    if (this.floorExpandMode) {
      this.tileHighlightMat.color.setHex(this.floorPlacementColorRgb);
      return;
    }
    if (this.buildMode) {
      this.tileHighlightMat.color.setHex(0xf59e0b);
      return;
    }
    this.tileHighlightMat.color.setHex(0x2dd4bf);
  }

  private teleporterDestPickTileValid(x: number, z: number): boolean {
    return (
      this.tileWalkable({ x, y: z }) &&
      !this.hasAnyBlockAtTile(x, z) &&
      !this.hubNoBuildTile(x, z)
    );
  }

  private showDefaultTileHoverOutline(x: number, z: number, y = 0.026): void {
    this.tileHighlight.visible = false;
    this.defaultTileHoverOutline.position.set(x, y, z);
    this.defaultTileHoverOutline.visible = true;
  }

  private hideDefaultTileHoverOutline(): void {
    this.defaultTileHoverOutline.visible = false;
  }

  /** Cursor tile while choosing a teleporter exit on the map (build dock coords pick). */
  private syncTeleporterDestPickHover(
    clientX: number,
    clientY: number
  ): void {
    this.blockTopHighlight.visible = false;
    this.clearPlacementPreview();
    this.clearGateNeighborFloorHints();
    const dest = this.pickFloor(clientX, clientY);
    if (!dest) {
      this.tileHighlight.visible = false;
      this.requestRender(80);
      return;
    }
    const valid = this.teleporterDestPickTileValid(dest.x, dest.y);
    this.tileHighlightMat.color.setHex(valid ? 0xf59e0b : 0xef4444);
    this.tileHighlight.position.set(dest.x, 0.027, dest.y);
    this.tileHighlight.visible = true;
    this.requestRender(80);
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

  /** Lowest stacked teleporter on a floor tile (pending portals have no block pick mesh). */
  private getTeleporterBlockKeyAtTile(x: number, z: number): string | null {
    for (let y = 0; y <= 2; y++) {
      const k = `${x},${z},${y}`;
      if (this.placedObjects.get(k)?.teleporter) return k;
    }
    return null;
  }

  private canPlaceTeleporterAtTile(x: number, z: number, yLevel: number): boolean {
    if (yLevel > 1) return false;
    if (this.getTeleporterBlockKeyAtTile(x, z)) return false;
    if (this.hubNoBuildTile(x, z)) return false;
    if (!this.tileWalkable({ x, y: z })) return false;
    if (yLevel === 0) {
      const prefix = `${x},${z},`;
      for (const k of this.placedObjects.keys()) {
        if (k.startsWith(prefix)) return false;
      }
      return true;
    }
    const below = this.placedObjects.get(`${x},${z},0`);
    if (!below || below.teleporter) return false;
    return true;
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
      hexRadiusScale: this.placementHex
        ? this.placementHexRadiusScale
        : 1,
      sphere: this.placementSphere,
      sphereRadiusScale: this.placementSphere
        ? this.placementSphereRadiusScale
        : 1,
      ramp: this.placementRamp,
      rampDir: this.placementRampDir,
      ...cubeRotationForPlainCube(
        {
          hex: this.placementHex,
          pyramid: this.placementPyramid,
          sphere: this.placementSphere,
          ramp: this.placementRamp,
        },
        {
          cubeRotX: this.placementCubeRotX,
          cubeRotY: this.placementCubeRotY,
          cubeRotZ: this.placementCubeRotZ,
        }
      ),
      colorRgb: this.placementColorRgb,
      claimable: this.placementClaimable || undefined,
      active: this.placementClaimable ? true : undefined,
    };
  }

  private placementPreviewStyleSignature(meta: BlockStyleProps): string {
    const rot = cubeRotationForPlainCube(
      {
        hex: meta.hex,
        pyramid: meta.pyramid,
        sphere: meta.sphere,
        ramp: meta.ramp,
      },
      meta
    );
    return `${meta.half}|${meta.quarter}|${meta.hex}|${meta.pyramid}|${meta.pyramidBaseScale ?? 1}|${meta.hexRadiusScale ?? 1}|${meta.sphere}|${meta.sphereRadiusScale ?? 1}|${meta.ramp}|${meta.rampDir}|${rot.cubeRotX}|${rot.cubeRotY}|${rot.cubeRotZ}|${meta.colorRgb}|${Boolean(meta.claimable)}|${this.blockVisualScale}`;
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
    const yOpen = this.nextOpenLevelAt(dest.x, dest.y);
    if (yOpen === null) return null;
    if (
      this.teleporterPlacementPreviewActive &&
      !this.canPlaceTeleporterAtTile(dest.x, dest.y, yOpen)
    ) {
      return null;
    }
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
    this.clearTeleporterPlacementPreview();
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
    const colorRgb = resolveBlockColorRgb(
      ins ?? { colorRgb: hint.colorRgb, colorId: hint.colorId }
    );
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
      hexRadiusScale: 1,
      sphere: false,
      ramp: false,
      rampDir: rampDir & 3,
      colorRgb,
      gate: {
        adminAddress: admin,
        authorizedAddresses: [...auth],
        exitX: p.ex,
        exitZ: p.ez,
      },
    };
    const sig = `${hoverGx}|${hoverGz}|${p.ex}|${p.ez}|${colorRgb}|${quarter}|${half}|${rampDir & 3}|${admin}|${auth.join(",")}`;
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

  private clearTeleporterPlacementPreview(): void {
    this.teleporterPreviewPillarSig = "";
    if (this.teleporterPreviewPillarMesh) {
      this.scene.remove(this.teleporterPreviewPillarMesh);
      this.teleporterPreviewPillarMesh.geometry.dispose();
      (this.teleporterPreviewPillarMesh.material as THREE.Material).dispose();
      this.teleporterPreviewPillarMesh = null;
    }
  }

  private syncTeleporterPlacementPreviewAt(
    wx: number,
    wz: number,
    wyLevel: number
  ): void {
    if (this.placementPreviewGroup) {
      this.scene.remove(this.placementPreviewGroup);
      this.placementPreviewGroup.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
      });
      this.placementPreviewGroup = null;
      this.placementPreviewStyleSig = "";
    }
    const valid = this.canPlaceTeleporterAtTile(wx, wz, wyLevel);
    if (!valid) {
      if (this.teleporterPreviewPillarMesh) {
        this.teleporterPreviewPillarMesh.visible = false;
      }
      this.placementPreviewAnchor = null;
      return;
    }
    const colorRgb = this.placementColorRgb;
    const sig = `tp|${colorRgb}|${this.blockVisualScale}`;
    if (!this.teleporterPreviewPillarMesh || this.teleporterPreviewPillarSig !== sig) {
      this.clearTeleporterPlacementPreview();
      this.teleporterPreviewPillarSig = sig;
      this.teleporterPreviewPillarMesh = this.createPortalPillarMesh(wx, wz, {
        dim: true,
        pillarColorRgb: colorRgb,
      });
      this.scene.add(this.teleporterPreviewPillarMesh);
    } else {
      this.teleporterPreviewPillarMesh.position.set(
        wx,
        0.01 + TERRAIN_TILE_DOOR_MARKER_HEIGHT / 2,
        wz
      );
      this.teleporterPreviewPillarMesh.visible = true;
    }
    this.placementPreviewAnchor = { x: wx, z: wz, y: wyLevel };
  }

  private syncPlacementPreviewAt(wx: number, wz: number, wyLevel: number): void {
    if (this.teleporterPlacementPreviewActive) {
      this.syncTeleporterPlacementPreviewAt(wx, wz, wyLevel);
      return;
    }
    this.clearTeleporterPlacementPreview();
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

  private pickActiveMineableClaimAtScreen(
    clientX: number,
    clientY: number
  ): { x: number; z: number; y: number } | null {
    if (!this.claimBlockHandler) return null;
    const bk = this.pickBlockKey(clientX, clientY);
    if (!bk) return null;
    const bm = this.placedObjects.get(bk);
    if (!bm?.claimable || !bm.active || bm.passable) return null;
    const parts = bk.split(",").map(Number);
    const bx = parts[0];
    const bz = parts[1];
    if (bx === undefined || bz === undefined) return null;
    const byRaw = parts[2];
    const by =
      parts.length >= 3 && Number.isFinite(byRaw)
        ? Math.max(0, Math.min(2, Math.floor(byRaw!)))
        : 0;
    return { x: bx, z: bz, y: by };
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
   * Active claimable (minable) blocks return null - mining starts via primary click on the
   * block or the world context menu, not via this walk goal.
   */
  private resolveWalkNavigationGoalAt(
    clientX: number,
    clientY: number
  ): {
    ft: FloorTile;
    layer: 0 | 1;
    suppressCantMoveMessage?: boolean;
  } | null {
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
          if (bx === undefined || bz === undefined) return null;
          /** Gates: movement only from double-click → {@link queueWalkToGateThenInteract}, not single-click walk. */
          if (bm.gate) {
            return null;
          }
          return { ft: { x: bx, y: bz }, layer: 1 };
        }
      }
    }
    let dest = this.pickWalkableTile(clientX, clientY);
    if (!dest) {
      // Click-toward-tap: an off-tile / non-walkable click still walks to the nearest walkable
      // tile under the cursor, so the player heads in the tapped direction.
      const raw = this.pickFloorRaw(clientX, clientY);
      if (raw) dest = this.nearestWalkableTileToWorld(raw.x, raw.z);
      if (!dest) return null;
    }
    const k = tileKey(dest.x, dest.y);
    if (
      this.blockingTileKeys.has(k) &&
      !this.selfGatePassFloorTile(dest.x, dest.y)
    ) {
      return null;
    }
    return { ft: dest, layer: 0 };
  }

  /** Nearest walkable (non-blocked) tile to a world ground point, searched in expanding rings. */
  private nearestWalkableTileToWorld(wx: number, wz: number): FloorTile | null {
    const c = snapFloorTile(wx, wz);
    const maxR = 16;
    for (let r = 0; r <= maxR; r++) {
      let best: FloorTile | null = null;
      let bestD = Infinity;
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue; // ring perimeter only
          const tx = c.x + dx;
          const tz = c.y + dz;
          const t: FloorTile = { x: tx, y: tz };
          if (!this.tileWalkable(t)) continue;
          const k = tileKey(tx, tz);
          if (this.blockingTileKeys.has(k) && !this.selfGatePassFloorTile(tx, tz)) {
            continue;
          }
          const d = Math.hypot(tx - wx, tz - wz);
          if (d < bestD) {
            bestD = d;
            best = t;
          }
        }
      }
      if (best) return best;
    }
    return null;
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

  /** Floor tile the local player can path onto (walkable base/extra + gate blocking rules). */
  private floorTileNavigableForWalk(ft: FloorTile): boolean {
    if (!this.tileWalkable(ft)) return false;
    const k = tileKey(ft.x, ft.y);
    if (
      this.blockingTileKeys.has(k) &&
      !this.selfGatePassFloorTile(ft.x, ft.y)
    ) {
      return false;
    }
    return true;
  }

  /**
   * Cardinal floor neighbor of a block with a valid path from the current pose; prefers shorter routes.
   */
  private findBestAdjacentStandForBlockClaim(
    blockX: number,
    blockZ: number
  ): FloorTile | null {
    if (!this.selfMesh) return null;
    const cands: FloorTile[] = [
      { x: blockX + 1, y: blockZ },
      { x: blockX - 1, y: blockZ },
      { x: blockX, y: blockZ + 1 },
      { x: blockX, y: blockZ - 1 },
    ];
    const here = snapFloorTile(this.selfMesh.position.x, this.selfMesh.position.z);
    const moverCtx: PathfindMoverContext | null = this.selfAddress
      ? {
          address: this.selfAddress.replace(/\s+/g, "").toUpperCase(),
          nowMs: Date.now(),
          unlockedPadInstanceIds: this.unlockedPadInstanceIds,
        }
      : null;
    const startLayer = inferStartLayerClient(
      this.selfMesh.position.x,
      this.selfMesh.position.z,
      this.selfMesh.position.y,
      this.placedObjects,
      moverCtx,
      this.roomId
    );
    let best: { ft: FloorTile; len: number } | null = null;
    for (const ft of cands) {
      if (!this.floorTileNavigableForWalk(ft)) continue;
      const remaining = pathfindTerrain(
        here.x,
        here.y,
        startLayer,
        ft.x,
        ft.y,
        0,
        this.placedObjects,
        this.extraFloorKeys,
        this.roomId,
        this.removedBaseFloorKeys.size > 0 ? this.removedBaseFloorKeys : undefined,
        moverCtx ?? undefined
      );
      if (!remaining || remaining.length < 2) continue;
      const len = remaining.length;
      if (!best || len < best.len) best = { ft, len };
    }
    return best?.ft ?? null;
  }

  /** Show the route the player would take if they release at the current pick (pointerdown). */
  private previewWalkNavigationAt(clientX: number, clientY: number): void {
    if (!this.selfMesh) return;
    // worldcup: pitch preview points straight at the raw float pick.
    if (this.isWorldcupFreeMoveRoom() && !this.buildMode && !this.floorExpandMode) {
      if (this.worldcupPitchMovementMode === "joystick") {
        this.pathPreviewGoal = null;
        this.refreshPathLine();
        return;
      }
      const hit = this.pickFloorRaw(clientX, clientY);
      if (hit) {
        // Preview clamps to the outfield wall (bounds + margin), matching tryFieldFreeWalkAt so the
        // dashed line lands where the avatar will actually stop when you tap toward the stands.
        const b = this.worldcupFieldMoveBounds();
        const fx = Math.max(b.minX, Math.min(b.maxX, hit.x));
        const fz = Math.max(b.minZ, Math.min(b.maxZ, hit.z));
        this.pathPreviewGoal = {
          ft: snapFloorTile(fx, fz),
          layer: 0,
          world: { x: fx, z: fz },
        };
        this.refreshPathLine();
        return;
      }
    }
    this.pathPreviewGoal = this.resolveWalkNavigationGoalAt(clientX, clientY);
    this.refreshPathLine();
  }

  /**
   * Commit a resolved walk goal: refresh path, optionally send `moveTo` via `tileClickHandler`.
   * @returns whether the player still needs to move (`sent`), is already there (`at_goal`), or cannot (`failed`).
   */
  private commitResolvedWalkGoal(goal: {
    ft: FloorTile;
    layer: 0 | 1;
    suppressCantMoveMessage?: boolean;
  }): "sent" | "at_goal" | "failed" {
    if (!this.selfMesh || !this.tileClickHandler) return "failed";
    if (this.pendingGateAdjacentInteract && !this.gateWalkQueuedFromGame) {
      this.pendingGateAdjacentInteract = null;
    }
    this.pathGoal = goal;
    const outcome = this.refreshPathLine();
    if (outcome === "no_path") {
      if (!goal.suppressCantMoveMessage) {
        this.showSelfPlayerActionMessage("I can't move here");
      }
      this.pathGoal = null;
      this.refreshPathLine();
      return "failed";
    }
    if (outcome === "no_goal") {
      this.pathGoal = null;
      this.refreshPathLine();
      return "failed";
    }
    if (outcome === "at_goal") {
      this.pathGoal = null;
      this.refreshPathLine();
      return "at_goal";
    }
    if (goal.layer === 1) {
      this.tileClickHandler(goal.ft.x, goal.ft.y, 1);
    } else {
      this.tileClickHandler(goal.ft.x, goal.ft.y, 0);
    }
    return "sent";
  }

  private tryRemoveFloorTileAt(x: number, z: number): boolean {
    if (!this.floorExpandMode || !this.removeExtraFloorHandler) return false;
    if (!this.tileWithinPlaceRadius(x, z)) return false;
    const k = tileKey(x, z);
    if (this.extraFloorKeys.has(k) && !isBaseTile(x, z, this.roomId)) {
      if (this.hasAnyBlockAtTile(x, z)) return false;
      this.removeExtraFloorHandler(x, z);
      return true;
    }
    if (!isBuiltinRoomId(this.roomId) && isBaseTile(x, z, this.roomId)) {
      if (this.hasAnyBlockAtTile(x, z)) return false;
      this.removeExtraFloorHandler(x, z);
      return true;
    }
    return false;
  }

  private isFloorRecolorTarget(x: number, z: number): boolean {
    const k = tileKey(x, z);
    if (this.extraFloorKeys.has(k) && !isBaseTile(x, z, this.roomId)) {
      return true;
    }
    return isBaseTile(x, z, this.roomId) && !this.removedBaseFloorKeys.has(k);
  }

  private canPaintFloorTileAt(x: number, z: number): boolean {
    if (!this.floorExpandMode || this.roomEntrySpawnPickHandler) return false;
    if (!this.floorTilePaintable(x, z)) return false;
    return this.tileWithinPlaceRadius(x, z);
  }

  private floorTilePaintable(x: number, z: number): boolean {
    const k = tileKey(x, z);

    if (this.isFloorRecolorTarget(x, z)) {
      return true;
    }

    if (this.hasAnyBlockAtTile(x, z)) return false;

    if (!isBuiltinRoomId(this.roomId)) {
      if (this.removedBaseFloorKeys.has(k)) return true;
      if (isBaseTile(x, z, this.roomId)) return false;
    }
    if (this.extraFloorKeys.has(k)) return false;
    return true;
  }

  private tryPlaceFloorTileAt(x: number, z: number): boolean {
    if (!this.floorExpandMode || !this.placeExtraFloorHandler) return false;
    if (this.streamObserverMode) return false;
    const tiles = floorBrushTiles(x, z, this.floorBrushSize);
    const hasValid = tiles.some((t) => this.canPaintFloorTileAt(t.x, t.z));
    if (!hasValid) return false;
    this.placeExtraFloorHandler(
      x,
      z,
      this.floorPlacementColorRgb,
      this.floorBrushSize
    );
    return true;
  }

  private syncFloorExpandTileHover(clientX: number, clientY: number): void {
    if (
      this.floorEyedropperActive &&
      !this.roomEntrySpawnPickHandler
    ) {
      this.syncFloorEyedropperHover(clientX, clientY);
      return;
    }
    const t = this.pickFloor(clientX, clientY);
    if (!t) {
      this.tileHighlight.visible = false;
      this.clearFloorBrushPreviewTiles();
      this.clearFloorHoverVisuals();
      return;
    }
    if (this.roomEntrySpawnPickHandler) {
      this.clearFloorHoverVisuals();
      this.clearFloorBrushPreviewTiles();
      this.tileHighlightMat.color.setHex(
        this.tileWalkable(t) ? 0x34d399 : 0xef4444
      );
      this.tileHighlight.position.set(t.x, 0.03, t.y);
      this.tileHighlight.visible = true;
      return;
    }
    this.tileHighlight.visible = false;
    this.clearFloorBrushPreviewTiles();
    const tiles =
      this.floorBrushSize === 1
        ? [{ x: t.x, z: t.y }]
        : floorBrushTiles(t.x, t.y, this.floorBrushSize);
    this.syncFloorHoverVisuals(tiles);
  }

  /** Touch / coarse pointer: same tile toggles place vs remove. */
  private tryFloorExpandToggleAt(x: number, z: number): void {
    if (this.tryRemoveFloorTileAt(x, z)) return;
    this.tryPlaceFloorTileAt(x, z);
  }

  private tryFloorExpandRemoveAtScreen(
    clientX: number,
    clientY: number
  ): boolean {
    if (!this.floorExpandMode || this.roomEntrySpawnPickHandler) return false;
    const dest = this.pickFloor(clientX, clientY);
    if (!dest) return false;
    return this.tryRemoveFloorTileAt(dest.x, dest.y);
  }

  /**
   * Run walk / path request from a screen point (typically pointerup client coords).
   * Active claimable-block mining is started on pointerdown (primary click on the block or
   * context menu Mine), not from this deferred walk path.
   */
  private tryExecuteWalkNavigationAt(clientX: number, clientY: number): void {
    if (this.streamObserverMode) return;
    if (!this.selfMesh || !this.tileClickHandler) return;
    this.pathPreviewGoal = null;
    // worldcup: free (any-direction) movement on the pitch - straight line to a float point.
    if (this.tryFieldFreeWalkAt(clientX, clientY)) return;
    const goal = this.resolveWalkNavigationGoalAt(clientX, clientY);
    if (!goal) {
      this.refreshPathLine();
      return;
    }
    void this.commitResolvedWalkGoal(goal);
  }

  /** worldcup: true when the current room is the pitch (field or Match Pitch) with free movement. */
  private isWorldcupFreeMoveRoom(): boolean {
    return WORLDCUP_ENABLED_CLIENT && worldcupIsFieldLikeRoomId(this.roomId);
  }

  /** Exact float XZ for a walk goal (pitch targets use `world`; grid rooms use tile centers). */
  private pathGoalWorldXZ(goal: {
    ft: FloorTile;
    world?: { x: number; z: number };
  }): { x: number; z: number } {
    return goal.world ?? { x: goal.ft.x, z: goal.ft.y };
  }

  /**
   * worldcup: predict local velocity immediately so movement feels continuous before the next
   * server snapshot (straight-line pitch moves are not grid-snapped).
   */
  private predictSelfFieldMoveVelocity(wx: number, wz: number): void {
    const len = Math.hypot(wx, wz);
    if (len < 1e-6) return;
    this.selfServerVx = (wx / len) * SERVER_PLAYER_MOVE_SPEED;
    this.selfServerVz = (wz / len) * SERVER_PLAYER_MOVE_SPEED;
    this.selfLastServerRecvMs = performance.now();
  }

  /** worldcup: register the floating-joystick visual (touch hosts only); null disables it. */
  setWorldcupJoystickView(view: WorldcupJoystickView | null): void {
    this.worldcupJoystickView = view;
    if (!view) this.endWorldcupStick();
  }

  /** worldcup: allow the stick to engage (pitch + touch host + not spectating). */
  setWorldcupJoystickEnabled(enabled: boolean): void {
    this.worldcupJoystickEnabled = enabled;
    if (!enabled) this.endWorldcupStick();
  }

  /** worldcup: Tap vs Joystick pitch movement; interrupts any in-progress walk or stick. */
  setWorldcupPitchMovementMode(mode: "tap" | "joystick"): void {
    if (this.worldcupPitchMovementMode === mode) return;
    this.worldcupPitchMovementMode = mode;
    this.interruptWorldcupPitchMovement();
  }

  getWorldcupPitchMovementMode(): "tap" | "joystick" {
    return this.worldcupPitchMovementMode;
  }

  /** worldcup: halt pitch movement (walk, stick, or extrapolation) and notify the server. */
  private interruptWorldcupPitchMovement(): void {
    this.endWorldcupStick();
    this.pendingPrimaryWalk = null;
    this.pathPreviewGoal = null;
    if (!this.isWorldcupFreeMoveRoom()) {
      this.pathGoal = null;
      this.refreshPathLine();
      return;
    }
    if (
      this.pathGoal !== null ||
      Math.hypot(this.selfServerVx, this.selfServerVz) > 1e-6
    ) {
      this.worldcupJoystickStop();
    } else {
      this.pathGoal = null;
      this.refreshPathLine();
    }
  }

  /**
   * worldcup: freeze / unfreeze local movement during the post-goal kickoff countdown. Engaging the
   * lock also stops any in-progress walk + joystick so the player snaps to the server-set spawn.
   */
  setWorldcupMoveLocked(locked: boolean): void {
    this.worldcupMoveLocked = locked;
    if (locked) {
      this.endWorldcupStick();
      this.pendingPrimaryWalk = null;
      this.pathGoal = null;
      this.pathPreviewGoal = null;
      this.refreshPathLine();
    }
  }

  /** worldcup: true during the post-goal kickoff countdown freeze. */
  isWorldcupMoveLocked(): boolean {
    return this.worldcupMoveLocked;
  }

  /** worldcup: true when a single-finger pitch drag may be promoted to the floating stick. */
  private worldcupStickCanEngage(): boolean {
    return (
      this.worldcupJoystickEnabled &&
      this.worldcupPitchMovementMode !== "tap" &&
      !this.worldcupMoveLocked &&
      this.worldcupJoystickView !== null &&
      this.worldcupStick === null &&
      this.isWorldcupFreeMoveRoom() &&
      !this.buildMode &&
      !this.floorExpandMode
    );
  }

  /**
   * worldcup: promote the in-progress deferred walk into a floating joystick. The base anchors at
   * the thumb-down point (`startX/startY`); steering continues until the finger lifts.
   */
  private beginWorldcupStick(
    pointerId: number,
    startX: number,
    startY: number,
    curX: number,
    curY: number
  ): void {
    // Keep the canvas pointer capture set by the deferred walk so moves keep flowing here.
    this.pendingPrimaryWalk = null;
    this.pathPreviewGoal = null;
    const view = this.worldcupJoystickView;
    if (!view) return;
    view.showAt(startX, startY);
    const v = view.moveThumbTo(curX, curY);
    this.worldcupStick = { pointerId, dx: v.dx, dy: v.dy, timer: null };
    this.worldcupJoystickMove(v.dx, v.dy);
    this.worldcupStick.timer = window.setInterval(() => {
      if (this.worldcupStick) {
        this.worldcupJoystickMove(this.worldcupStick.dx, this.worldcupStick.dy);
      }
    }, Game.WORLDCUP_STICK_EMIT_MS);
  }

  /** worldcup: update the floating-stick thumb + heading from the steering finger's position. */
  private updateWorldcupStick(clientX: number, clientY: number): void {
    if (!this.worldcupStick || !this.worldcupJoystickView) return;
    const v = this.worldcupJoystickView.moveThumbTo(clientX, clientY);
    this.worldcupStick.dx = v.dx;
    this.worldcupStick.dy = v.dy;
  }

  /** worldcup: tear down the floating-stick session and stop the player. */
  private endWorldcupStick(): void {
    const s = this.worldcupStick;
    if (!s) return;
    if (s.timer !== null) window.clearInterval(s.timer);
    this.worldcupStick = null;
    try {
      const el = this.renderer.domElement;
      if (el.hasPointerCapture?.(s.pointerId)) {
        el.releasePointerCapture(s.pointerId);
      }
    } catch {
      /* pointer may already be gone */
    }
    this.worldcupJoystickView?.hide();
    this.worldcupJoystickStop();
  }

  /**
   * worldcup: drive movement from the on-screen touch joystick. `screenDx`/`screenDy` are the
   * thumb offset in -1..1 (y is down). Converts the screen direction into a world-ground heading
   * via the camera basis and walks toward a far clamped point so the player glides continuously.
   */
  worldcupJoystickMove(screenDx: number, screenDy: number): void {
    if (!this.isWorldcupFreeMoveRoom()) return;
    if (this.worldcupMoveLocked) return;
    if (this.buildMode || this.floorExpandMode) return;
    if (!this.selfMesh || !this.tileClickHandler) return;
    if (Math.hypot(screenDx, screenDy) < 0.05) {
      this.worldcupJoystickStop();
      return;
    }
    this.camera.updateMatrixWorld();
    const e = this.camera.matrixWorld.elements;
    // Camera right (+x) and up (+y) local axes, projected onto the ground plane (XZ).
    let rx = e[0];
    let rz = e[2];
    let ux = e[4];
    let uz = e[6];
    const rl = Math.hypot(rx, rz) || 1;
    rx /= rl;
    rz /= rl;
    const ul = Math.hypot(ux, uz) || 1;
    ux /= ul;
    uz /= ul;
    // Pushing up the screen (dy < 0) heads into the scene.
    let wx = rx * screenDx + ux * -screenDy;
    let wz = rz * screenDx + uz * -screenDy;
    const wl = Math.hypot(wx, wz) || 1;
    wx /= wl;
    wz /= wl;
    const far = 48;
    const b = this.worldcupFieldMoveBounds();
    const tx = Math.max(b.minX, Math.min(b.maxX, this.selfMesh.position.x + wx * far));
    const tz = Math.max(b.minZ, Math.min(b.maxZ, this.selfMesh.position.z + wz * far));
    this.pathGoal = { ft: snapFloorTile(tx, tz), layer: 0, world: { x: tx, z: tz } };
    this.predictSelfFieldMoveVelocity(wx, wz);
    this.refreshPathLine();
    this.tileClickHandler(tx, tz, 0);
  }

  /**
   * worldcup: stop joystick movement. Sends a dedicated stop intent (not a `moveTo` to the current
   * spot) so it is never swallowed by the server's move rate limit - the player halts the instant
   * the finger lifts instead of gliding on toward the last far joystick target.
   */
  worldcupJoystickStop(): void {
    this.pathGoal = null;
    this.refreshPathLine();
    // Halt local extrapolation immediately; server stop may arrive a tick later.
    this.selfServerVx = 0;
    this.selfServerVz = 0;
    this.selfLastServerRecvMs = performance.now();
    if (this.worldcupStopMoveHandler) {
      this.worldcupStopMoveHandler();
    } else if (this.selfMesh && this.tileClickHandler) {
      this.tileClickHandler(this.selfMesh.position.x, this.selfMesh.position.z, 0);
    }
  }

  /** worldcup: walkable extent on the pitch - base field bounds widened by the outfield margin. */
  private worldcupFieldMoveBounds(): {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  } {
    const m = WORLDCUP_FIELD_OUTFIELD_MARGIN;
    const b = WORLDCUP_FIELD_BOUNDS;
    return {
      minX: b.minX - m,
      maxX: b.maxX + m,
      minZ: b.minZ - m,
      maxZ: b.maxZ + m,
    };
  }

  /**
   * worldcup: on the pitch, send a straight-line move to the exact clicked float point so the
   * ball can be kicked at any angle. Returns true when it handled the click.
   */
  private tryFieldFreeWalkAt(clientX: number, clientY: number): boolean {
    if (!this.isWorldcupFreeMoveRoom()) return false;
    if (this.buildMode || this.floorExpandMode) return false;
    if (!this.selfMesh || !this.tileClickHandler) return false;
    // worldcup: during the post-goal kickoff freeze, swallow the tap so the player stays put.
    if (this.worldcupMoveLocked) return true;
    // Joystick-only mode: taps do not walk (drag still promotes to the floating stick).
    if (this.worldcupPitchMovementMode === "joystick") return true;
    const hit = this.pickFloorRaw(clientX, clientY);
    if (!hit) return false;
    // Clicks outside the pitch clamp to the outfield wall (true bounds + outfield margin), not the
    // touchline - so a tap toward / onto the stands walks you all the way to the wall in line with
    // where you tapped, letting you get fully behind a ball pinned against a wall by mouse/tap (the
    // joystick already reached this margin). The ball's own collision walls stay at the true bounds.
    const b = this.worldcupFieldMoveBounds();
    const fx = Math.max(b.minX, Math.min(b.maxX, hit.x));
    const fz = Math.max(b.minZ, Math.min(b.maxZ, hit.z));
    this.pathGoal = {
      ft: snapFloorTile(fx, fz),
      layer: 0,
      world: { x: fx, z: fz },
    };
    this.predictSelfFieldMoveVelocity(
      fx - this.selfMesh.position.x,
      fz - this.selfMesh.position.z
    );
    this.refreshPathLine();
    this.tileClickHandler(fx, fz, 0);
    return true;
  }

  /**
   * When the player double-clicks the same gate mesh (primary, low movement), walks to the
   * gate if needed and invokes {@link gateDoubleOpenHandler} once in range - returns true so
   * the default deferred walk is skipped.
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
    return this.queueWalkToGateThenInteract(bx, bz, by);
  }

  /** Orthogonal to the gate column and within build / interact radius (matches prior double-open). */
  private selfWithinGateInteractRange(bx: number, bz: number): boolean {
    if (!this.selfMesh) return false;
    const px = this.selfMesh.position.x;
    const pz = this.selfMesh.position.z;
    if (!isOrthogonallyAdjacentToFloorTile(px, pz, bx, bz)) return false;
    const dx = px - bx;
    const dz = pz - bz;
    return Math.hypot(dx, dz) <= this.placeRadiusBlocks + 1e-6;
  }

  private maybeFirePendingGateAdjacentInteract(): void {
    const p = this.pendingGateAdjacentInteract;
    if (!p || !this.selfMesh || !this.gateDoubleOpenHandler) return;
    const meta = this.getPlacedAt(p.bx, p.bz, p.by);
    if (!meta?.gate) {
      this.pendingGateAdjacentInteract = null;
      return;
    }
    if (this.selfWithinGateInteractRange(p.bx, p.bz)) {
      this.pendingGateAdjacentInteract = null;
      this.gateDoubleOpenHandler(p.bx, p.bz, p.by);
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

  /** Tile hover uses pointer move; touch-first devices get bogus post-touch “mouse” moves - skip hover. */
  private static canShowPointerHoverTiles(): boolean {
    if (typeof window === "undefined") return true;
    return (
      window.matchMedia("(hover: hover)").matches &&
      window.matchMedia("(pointer: fine)").matches
    );
  }

  private shouldShowPointerTileHover(): boolean {
    if (this.streamPresentationActive || this.streamObserverMode) return false;
    return Game.canShowPointerHoverTiles();
  }

  /** Mouse-style desktop: right-drag camera orbit (not touch / pen-primary tablets). */
  private static canUseRightDragCameraOrbit(e: PointerEvent): boolean {
    if (e.pointerType === "touch") return false;
    return Game.isDesktopFinePointer();
  }

  /** Fine pointer + hover (desktop mouse); used for floor LMB place / RMB remove. */
  private static isDesktopFinePointer(): boolean {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia("(hover: hover)").matches &&
      window.matchMedia("(pointer: fine)").matches
    );
  }

  /**
   * Infinite line vs y=0 plane. `Ray.intersectPlane` rejects t&lt;0, which breaks orthographic
   * picking when the intersection lies behind the ray origin - use full line intersection.
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

  /**
   * worldcup: raw (unsnapped) floor intersection in world units, for free pitch movement.
   * Returns null when the ray misses the y=0 plane.
   */
  private pickFloorRaw(
    clientX: number,
    clientY: number
  ): { x: number; z: number } | null {
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
    return { x: this.hit.x, z: this.hit.z };
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
  ): Array<{ address: string; displayName: string; challengeOpen?: boolean }> {
    if (!this.updateNdc(clientX, clientY)) return [];
    this.camera.updateMatrixWorld();
    this.camera.updateProjectionMatrix();
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const roots: THREE.Object3D[] = [];
    for (const g of this.others.values()) roots.push(g);
    if (roots.length === 0) return [];
    const hits = this.raycaster.intersectObjects(roots, true);
    const seen = new Set<string>();
    const out: Array<{
      address: string;
      displayName: string;
      challengeOpen?: boolean;
    }> = [];
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
      out.push({
        address,
        displayName,
        challengeOpen: group.userData.challengeOpen === true,
      });
    }
    return out;
  }

  /** worldcup: address of the player whose Challenge accept tick was hit, if any. */
  private pickChallengeAcceptAt(clientX: number, clientY: number): string | null {
    if (this.worldcupChallengeBubbles.size === 0) return null;
    this.camera.updateMatrixWorld();
    this.camera.updateProjectionMatrix();
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return null;
    const { tickCx, tickCy, tickR, w, h } = Game.CHALLENGE_BUBBLE_ACCEPT_CANVAS;
    const hitSlopPx = 10;
    let best: { addr: string; dist: number } | null = null;
    const wp = new THREE.Vector3();
    for (const [addr, bubble] of this.worldcupChallengeBubbles) {
      const acceptAddr = bubble.userData["challengeAcceptAddress"];
      if (typeof acceptAddr !== "string" || !acceptAddr.trim()) continue;
      bubble.updateWorldMatrix(true, false);
      bubble.getWorldPosition(wp);
      const local = this.getWorldScreenPosition(wp.x, wp.y, wp.z);
      if (!local) continue;
      const cx = rect.left + local.x;
      const cy = rect.top + local.y;
      const screenH = (bubble.scale.y / this.frustumSize) * rect.height;
      const screenW = (bubble.scale.x / this.frustumSize) * rect.height;
      const tickScreenX = cx + (tickCx / w - 0.5) * screenW;
      const tickScreenY = cy + (tickCy / h - 0.5) * screenH;
      const tickScreenR = (tickR / h) * screenH + hitSlopPx;
      const dist = Math.hypot(clientX - tickScreenX, clientY - tickScreenY);
      if (dist <= tickScreenR && (!best || dist < best.dist)) {
        best = { addr: acceptAddr, dist };
      }
    }
    return best?.addr ?? null;
  }

  private pickBlockKey(clientX: number, clientY: number): string | null {
    if (!this.updateNdc(clientX, clientY)) return null;
    this.camera.updateMatrixWorld();
    this.camera.updateProjectionMatrix();
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const roots = this.collectPlacedBlockPickRoots();
    const hits = this.raycaster.intersectObjects(roots, true);
    for (const h of hits) {
      const instanced = tileKeyFromInstancedPick(h.object, h.instanceId);
      if (instanced) return instanced;
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
    if (this.catalogPreviewActive) return;
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
    // worldcup: floating joystick owns its finger - steer with it, ignore any other.
    if (this.worldcupStick) {
      if (e.pointerId === this.worldcupStick.pointerId) {
        this.updateWorldcupStick(e.clientX, e.clientY);
        e.preventDefault();
      } else if (e.pointerType === "touch") {
        e.preventDefault();
      }
      return;
    }
    if (
      this.prefabBboxDrag &&
      e.pointerId === this.prefabBboxDrag.pointerId
    ) {
      const dest = this.pickFloor(e.clientX, e.clientY);
      if (dest && this.tileWalkable(dest)) {
        const corner = this.clampPrefabSaveDragCorner(
          this.prefabBboxDrag.startX,
          this.prefabBboxDrag.startZ,
          dest.x,
          dest.y
        );
        this.prefabBboxDrag.curX = corner.x;
        this.prefabBboxDrag.curZ = corner.z;
        const bbox = this.prefabBboxFromDrag();
        if (bbox) {
          this.syncPrefabBboxOverlay(bbox);
          this.emitPrefabBboxStats(bbox);
        }
      }
      return;
    }
    if (e.pointerType === "touch") {
      this.touchPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    if (this.pendingPrimaryWalk && e.pointerId === this.pendingPrimaryWalk.pointerId) {
      const p = this.pendingPrimaryWalk;
      const dist = Math.hypot(e.clientX - p.startX, e.clientY - p.startY);
      // worldcup: on the pitch, a single-finger drag past the engage threshold becomes the
      // floating joystick (anchored where the thumb went down) instead of cancelling the walk.
      if (
        e.pointerType === "touch" &&
        dist > Game.WORLDCUP_STICK_ENGAGE_PX &&
        this.worldcupStickCanEngage()
      ) {
        this.beginWorldcupStick(
          p.pointerId,
          p.startX,
          p.startY,
          e.clientX,
          e.clientY
        );
      } else if (dist > Game.PENDING_WALK_CANCEL_DRAG_PX) {
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

    if (!this.shouldShowPointerTileHover()) {
      if (this.teleporterDestPickHandler) {
        this.hideDefaultTileHoverOutline();
        this.syncTeleporterDestPickHover(e.clientX, e.clientY);
        this.signboardHoverHandler?.(null);
        return;
      }
      this.tileHighlight.visible = false;
      this.hideDefaultTileHoverOutline();
      this.blockTopHighlight.visible = false;
      this.clearFloorHoverVisuals();
      // Touch devices do not use hover targeting; keep any tapped signboard tooltip
      // stable instead of clearing it on every post-tap pointermove jitter.
      if (e.pointerType !== "touch") {
        this.signboardHoverHandler?.(null);
      }
      return;
    }
    if (this.floorExpandMode) {
      this.hideDefaultTileHoverOutline();
      this.syncFloorExpandTileHover(e.clientX, e.clientY);
      this.signboardHoverHandler?.(null);
      return;
    }
    if (this.buildMode) {
      this.hideDefaultTileHoverOutline();
      if (this.teleporterDestPickHandler) {
        this.syncTeleporterDestPickHover(e.clientX, e.clientY);
        this.signboardHoverHandler?.(null);
        return;
      }
      this.blockTopHighlight.visible = false;
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
      if (this.objectPrefabPlaceActive && this.prefabPlaceDesign) {
        this.clearGateNeighborFloorHints();
        this.tileHighlight.visible = false;
        this.syncPrefabPlaceGhostAt(e.clientX, e.clientY);
        this.signboardHoverHandler?.(null);
        return;
      }
      if (this.objectPrefabSaveActive && !this.prefabBboxDrag) {
        this.clearGateNeighborFloorHints();
        this.syncPrefabSaveHoverAt(e.clientX, e.clientY);
        this.signboardHoverHandler?.(null);
        return;
      }
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
        this.showDefaultTileHoverOutline(bx!, bz!);
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
      this.hideDefaultTileHoverOutline();
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
    
    this.showDefaultTileHoverOutline(p.x, p.y);
  };

  private onPointerDown = (e: PointerEvent): void => {
    if (this.catalogPreviewActive) return;
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
      // worldcup: while the floating joystick owns a finger, ignore any other finger so a
      // second touch can't start a two-finger camera/zoom mid-run.
      if (this.worldcupStick && e.pointerId !== this.worldcupStick.pointerId) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      this.touchPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.touchPointers.size >= 2) {
        this.clearPendingPrimaryWalk();
        this.clearPendingBuildPlace();
        this.cancelPrefabPlacePreview();
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
      e.button === 0 &&
      this.challengeAcceptHandler &&
      WORLDCUP_ENABLED_CLIENT
    ) {
      const acceptAddr = this.pickChallengeAcceptAt(e.clientX, e.clientY);
      if (acceptAddr) {
        e.preventDefault();
        e.stopPropagation();
        this.challengeAcceptHandler(acceptAddr);
        return;
      }
    }

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
      if (this.tryFloorEyedropperSampleAt(e.clientX, e.clientY)) {
        return;
      }
      if (Game.isDesktopFinePointer()) {
        this.tryPlaceFloorTileAt(dest.x, dest.y);
      } else {
        this.tryFloorExpandToggleAt(dest.x, dest.y);
      }
      return;
    }

    if (this.buildMode) {
      if (this.objectPrefabPlaceActive && this.prefabPlaceDesign) {
        if (Game.usesPrefabPlaceTapConfirm()) {
          this.handlePrefabPlacePointerDown(e.clientX, e.clientY);
        } else {
          const anchor = this.resolvePrefabPlaceAnchorAtClick(
            e.clientX,
            e.clientY
          );
          if (anchor) {
            this.prefabPlaceHandler?.(
              anchor.x,
              anchor.z,
              this.prefabPlaceYawSteps
            );
          }
        }
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (this.objectPrefabSaveActive) {
        const dest = this.pickFloor(e.clientX, e.clientY);
        if (dest && this.tileWalkable(dest)) {
          this.prefabBboxDrag = {
            pointerId: e.pointerId,
            startX: dest.x,
            startZ: dest.y,
            curX: dest.x,
            curZ: dest.y,
          };
          try {
            this.renderer.domElement.setPointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
          const bbox = this.prefabBboxFromDrag();
          if (bbox) {
            this.syncPrefabBboxOverlay(bbox);
            this.emitPrefabBboxStats(bbox);
          }
        }
        e.preventDefault();
        e.stopPropagation();
        return;
      }
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
      const teleporterKey = this.getTeleporterBlockKeyAtTile(
        placeT.x,
        placeT.z
      );
      if (teleporterKey) {
        const [tx, tz, tyRaw] = teleporterKey.split(",").map(Number);
        const ty = Number.isFinite(tyRaw) ? Math.floor(tyRaw ?? 0) : 0;
        this.setSelectedBlockKey(teleporterKey);
        this.obstacleSelectHandler?.(tx!, tz!, ty);
        return;
      }
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

    // worldcup: on the pitch, defer to pointerup like elsewhere but accept ANY ground hit (not just
    // walkable grid tiles), so tap/click-to-move and the floating joystick all work from wherever the
    // pointer goes down - including over the stands / outfield margin behind the goals. This must run
    // for mouse as well as touch: the generic walk path below uses `pickWalkableTile`, which returns
    // nothing for an off-pitch click (the stands), so a mouse click there would otherwise be dropped.
    if (
      this.isWorldcupFreeMoveRoom() &&
      !this.worldcupMoveLocked &&
      !this.buildMode &&
      !this.floorExpandMode &&
      this.tileClickHandler &&
      this.pickFloorRaw(e.clientX, e.clientY)
    ) {
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

    const blockForWalk = this.pickBlockKey(e.clientX, e.clientY);
    if (blockForWalk) {
      const bm = this.placedObjects.get(blockForWalk);
      if (bm) {
        if (bm.claimable && !bm.passable) {
          if (!bm.active) {
            this.showSelfPlayerActionMessage("There's no NIM left here :(");
            this.mineCooldownAttemptHandler?.();
            return;
          }
          if (this.claimBlockHandler) {
            const [bx, bz, byRaw] = blockForWalk.split(",").map(Number);
            const by = Number.isFinite(byRaw)
              ? Math.max(0, Math.min(2, Math.floor(byRaw!)))
              : 0;
            const pos = this.getSelfPosition();
            const adjacent = !!(
              pos &&
              isOrthogonallyAdjacentToFloorTile(pos.x, pos.z, bx!, bz!)
            );
            const claimIntent = adjacent
              ? "direct_adjacent_click"
              : "world_ctx_auto_walk";
            this.performClaimBlockAtWorld(bx!, bz!, by, { claimIntent });
            return;
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
    if (!address.trim()) this.unlockedPadInstanceIds.clear();
    this.cameraFollowReady = false;
    this.selfTargetPos = null;
    if (this.selfMesh) {
      this.disposeAvatarGroup(this.selfMesh);
      this.scene.remove(this.selfMesh);
      this.selfMesh = null;
    }
    if (this.streamObserverMode) {
      return;
    }
    const label = displayName || walletDisplayName(address);
    const g = this.makeAvatar(address, label);
    this.selfMesh = g;
    this.scene.add(g);
  }

  markUnlockPadUnlocked(instanceId: string): void {
    const id = instanceId.trim();
    if (!id) return;
    const wasNew = !this.unlockedPadInstanceIds.has(id);
    this.unlockedPadInstanceIds.add(id);
    if (wasNew) this.syncUnlockPadMeshesForInstance(id);
  }

  setUnlockedPadInstanceIds(ids: readonly string[]): void {
    this.unlockedPadInstanceIds.clear();
    for (const raw of ids) {
      const id = String(raw ?? "").trim();
      if (id) this.unlockedPadInstanceIds.add(id);
    }
    this.syncBlockMeshes();
  }

  private syncUnlockPadMeshesForInstance(instanceId: string): void {
    const keys = new Set<string>();
    for (const [k, meta] of this.placedObjects) {
      if (meta.unlockPad?.instanceId === instanceId) keys.add(k);
    }
    if (keys.size) this.syncBlockMeshesForKeys(keys);
  }

  hasUnlockPadUnlocked(instanceId: string): boolean {
    return this.unlockedPadInstanceIds.has(instanceId.trim());
  }

  getUnlockedPadInstanceIds(): ReadonlySet<string> {
    return this.unlockedPadInstanceIds;
  }

  /**
   * Unlock Pad the local player is orthogonally adjacent to and has not unlocked.
   */
  getAdjacentLockedUnlockPad(): {
    x: number;
    z: number;
    y: number;
    buttonLabel: string;
    instanceId: string;
    proofMode: "optimistic" | "payment_intent";
  } | null {
    if (!this.selfMesh) return null;
    const here = snapFloorTile(this.selfMesh.position.x, this.selfMesh.position.z);
    const neighbors: [number, number][] = [
      [here.x + 1, here.y],
      [here.x - 1, here.y],
      [here.x, here.y + 1],
      [here.x, here.y - 1],
    ];
    for (const [x, z] of neighbors) {
      for (const y of [0, 1, 2]) {
        const meta = this.placedObjects.get(blockKey(x, z, y));
        const pad = meta?.unlockPad;
        if (!pad?.instanceId) continue;
        if (this.unlockedPadInstanceIds.has(pad.instanceId)) continue;
        return {
          x,
          z,
          y,
          buttonLabel: pad.buttonLabel || "Unlock",
          instanceId: pad.instanceId,
          proofMode:
            pad.proofMode === "optimistic" ? "optimistic" : "payment_intent",
        };
      }
    }
    return null;
  }

  dispose(): void {
    this.endWorldcupStick();
    this.clearPendingBuildPlace();
    this.clearPlacementPreview();
    this.clearPendingPrimaryWalk();
    this.pendingGateAdjacentInteract = null;
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
    this.challengeAcceptHandler = null;
    this.worldTileContextOpener = null;
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
    this.remoteMoveOrders.clear();
    this.selfMoveOrder = null;
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
    this.disposePlainCubeInstancedMeshes();
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
    this.walkableFloorTileTopGeom.dispose();
    this.pathGeom.dispose();
    (this.pathLine.material as THREE.Material).dispose();
    this.trailGeom.dispose();
    (this.trailLine.material as THREE.Material).dispose();
    this.selectionOutline.geometry.dispose();
    this.selectionOutlineMat.dispose();
    this.teleporterLinkHighlight.geometry.dispose();
    this.teleporterLinkHighlightMat.dispose();
    this.teleporterDraftDestHighlight.geometry.dispose();
    this.teleporterDraftDestHighlightMat.dispose();
    this.roomEntrySpawnRing.geometry.dispose();
    this.roomEntrySpawnRingMat.dispose();
    this.tutorialMineHighlightRing.geometry.dispose();
    this.tutorialMineHighlightRingMat.dispose();
    this.defaultTileHoverOutline.geometry.dispose();
    this.defaultTileHoverOutlineMat.dispose();
    this.tileHighlightMat.dispose();
    this.blockTopHighlight.geometry.dispose();
    (this.blockTopHighlight.material as THREE.Material).dispose();
    for (const [, m] of this.placementHintMeshes) {
      this.scene.remove(m);
    }
    this.placementHintMeshes.clear();
    this.placementHintGeom.dispose();
    this.placementHintMat.dispose();
    this.clearFloorBuildRangeOutlines();
    this.floorBuildOutlineMat.dispose();
    this.clearFloorHoverVisuals();
    this.floorHoverOutlineValidMat.dispose();
    this.floorHoverOutlineInvalidMat.dispose();
    for (const m of this.floorHoverPreviewMeshes) {
      this.scene.remove(m);
    }
    this.floorHoverPreviewMeshes.length = 0;
    this.floorHoverPreviewGeom.dispose();
    this.floorHoverPreviewMat.dispose();
    for (const m of this.billboardFootprintPreviewMeshes) {
      this.scene.remove(m);
    }
    this.billboardFootprintPreviewMeshes.length = 0;
    this.billboardFootprintPreviewGeom.dispose();
    this.billboardFootprintPreviewValidMat.dispose();
    this.billboardFootprintPreviewInvalidMat.dispose();
    for (const m of this.floorBrushPreviewMeshes) {
      this.scene.remove(m);
    }
    this.floorBrushPreviewMeshes.length = 0;
    this.floorBrushPreviewGeom.dispose();
    this.floorBrushPreviewValidMat.dispose();
    this.floorBrushPreviewInvalidMat.dispose();
    for (const m of this.prefabSaveFootprintMeshes) {
      this.scene.remove(m);
    }
    this.prefabSaveFootprintMeshes.length = 0;
    this.prefabSaveFootprintValidMat.dispose();
    this.prefabSaveFootprintInvalidMat.dispose();
    this.prefabSaveOutlineMat.dispose();
    this.clearPrefabSaveMeshGhost();
    this.removeBillboardInteractGhost();
    this.billboardPreviewPlaceholderTex.dispose();
    this.signpostHintPlaceholderTexture.dispose();
    this.signpostHintDocTexture?.dispose();
    this.fogOfWar.dispose();
    for (const addr of [...this.typingIndicatorByAddress.keys()]) {
      this.removeTypingIndicator(addr);
    }
    for (const k of [...this.floatingTexts.keys()]) {
      this.removeFloatingTextEntry(k);
    }
    // Release the underlying WebGL context, not just the renderer's GPU
    // resources. renderer.dispose() alone leaves the context alive until GC,
    // so short-lived Game instances (e.g. one per room-catalog preview) pile
    // up contexts and the browser evicts the oldest live one - which is the
    // real game canvas, turning it permanently black. forceContextLoss()
    // frees the context immediately. Also detach the canvas so it can be GC'd.
    this.renderer.dispose();
    if (typeof this.renderer.forceContextLoss === "function") {
      this.renderer.forceContextLoss();
    }
    this.renderer.domElement.remove();
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
  private refreshPathLine():
    | "no_goal"
    | "at_goal"
    | "no_path"
    | "ok" {
    const goal = this.pathPreviewGoal ?? this.pathGoal;
    if (!goal || !this.selfMesh) {
      this.lastTerrainPath = null;
      this.hideTrailImmediate();
      this.beginPathFadeOut();
      return "no_goal";
    }
    // worldcup: on the pitch, draw a straight line to the float target (no grid pathfinding).
    if (this.isWorldcupFreeMoveRoom()) {
      return this.refreshFieldStraightPathLine(goal);
    }
    const here = snapFloorTile(this.selfMesh.position.x, this.selfMesh.position.z);
    const moverCtx: PathfindMoverContext | null = this.selfAddress
      ? {
          address: this.selfAddress.replace(/\s+/g, "").toUpperCase(),
          nowMs: Date.now(),
          unlockedPadInstanceIds: this.unlockedPadInstanceIds,
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
        return "at_goal";
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
      return "no_path";
    }
    this.setPathPolylineTerrain(remaining);
    return "ok";
  }

  /**
   * worldcup: straight 2-point preview from the player to the float pitch target. Clears the
   * goal on arrival so the door "Enter" affordance can appear once the player has stopped.
   */
  private refreshFieldStraightPathLine(goal: {
    ft: FloorTile;
    layer: 0 | 1;
    world?: { x: number; z: number };
  }): "at_goal" | "ok" {
    const self = this.selfMesh!;
    const target = goal.world ?? { x: goal.ft.x, z: goal.ft.y };
    const dist = Math.hypot(
      target.x - self.position.x,
      target.z - self.position.z
    );
    if (dist < 0.25) {
      if (this.pathPreviewGoal) {
        this.pathPreviewGoal = null;
      } else {
        this.pathGoal = null;
      }
      this.lastTerrainPath = null;
      this.hideTrailImmediate();
      this.beginPathFadeOut();
      return "at_goal";
    }
    this.setPathPolylineTerrain([
      { x: self.position.x, z: self.position.z, layer: 0 },
      { x: target.x, z: target.z, layer: 0 },
    ]);
    return "ok";
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

  /** Shared vertical pillar (white gradient) used for door portals and teleporter tiles. */
  private createPortalPillarMesh(
    wx: number,
    wz: number,
    opts?: { dim?: boolean; pillarColorRgb?: number }
  ): THREE.Mesh {
    const dim = opts?.dim ?? false;
    const pillarRgb =
      opts?.pillarColorRgb !== undefined
        ? resolveBlockColorRgb({ colorRgb: opts.pillarColorRgb })
        : TERRAIN_TILE_DOOR_MARKER_COLOR;
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
          value: new THREE.Color(pillarRgb),
        },
        uHeight: { value: TERRAIN_TILE_DOOR_MARKER_HEIGHT },
        uAlphaBottom: {
          value: dim
            ? TERRAIN_TILE_DOOR_MARKER_ALPHA_BOTTOM * 0.35
            : TERRAIN_TILE_DOOR_MARKER_ALPHA_BOTTOM,
        },
        uAlphaTop: {
          value: dim
            ? TERRAIN_TILE_DOOR_MARKER_ALPHA_TOP * 0.45
            : TERRAIN_TILE_DOOR_MARKER_ALPHA_TOP,
        },
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

  private isPendingTeleporterPortal(
    tp: BlockStyleProps["teleporter"] | undefined
  ): boolean {
    return Boolean(tp && "pending" in tp && tp.pending);
  }

  private syncTeleporterMarkers(): void {
    const want = new Map<string, { dim: boolean; colorRgb: number }>();
    for (const [k, meta] of this.placedObjects) {
      const tp = meta.teleporter;
      const colorRgb = resolveTeleporterPillarColorRgb(meta);
      if (this.isActiveTeleporterPortal(tp)) {
        want.set(k, { dim: false, colorRgb });
      } else if (this.isPendingTeleporterPortal(tp)) {
        want.set(k, { dim: true, colorRgb });
      }
    }
    for (const [k, spec] of want) {
      const parts = k.split(",").map(Number);
      const wx = parts[0]!;
      const wz = parts[1]!;
      const existing = this.teleporterMarkerMeshes.get(k);
      const existingDim = existing?.userData["tpDim"] === true;
      const existingColor = existing?.userData["tpColorRgb"] as number | undefined;
      if (
        existing &&
        existingDim === spec.dim &&
        existingColor === spec.colorRgb
      ) {
        continue;
      }
      if (existing) {
        this.scene.remove(existing);
        existing.geometry.dispose();
        (existing.material as THREE.Material).dispose();
        this.teleporterMarkerMeshes.delete(k);
      }
      const m = this.createPortalPillarMesh(wx, wz, {
        dim: spec.dim,
        pillarColorRgb: spec.colorRgb,
      });
      m.userData.tpDim = spec.dim;
      m.userData.tpColorRgb = spec.colorRgb;
      m.userData["tileKey"] = k;
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
    const sig = [...want.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, spec]) => `${k}:${spec.dim ? "p" : "a"}:${spec.colorRgb}`)
      .join("|");
    if (sig !== this.teleporterPortalFloorSig) {
      this.teleporterPortalFloorSig = sig;
      this.syncWalkableFloorMeshes();
    }
  }

  /** Visual floor only where avatars can walk (core + extra); gaps show scene background only. */
  private shouldShowWalkableFloorAtKey(k: string): boolean {
    const [x, z] = k.split(",").map(Number);
    if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
    if (this.removedBaseFloorKeys.has(k)) return false;
    if (isBaseTile(x, z, this.roomId)) return true;
    // Extra floor may sit outside the core room bounds (e.g. hub walkways).
    return this.extraFloorKeys.has(k);
  }

  private removeWalkableFloorMeshAtKey(k: string): void {
    const mesh = this.walkableFloorMeshes.get(k);
    if (mesh) {
      this.scene.remove(mesh);
      disposeWalkableFloorMeshMaterials(mesh);
      this.walkableFloorMeshes.delete(k);
    }
    const marker = this.doorMarkerMeshes.get(k);
    if (marker) {
      this.scene.remove(marker);
      marker.geometry.dispose();
      (marker.material as THREE.Material).dispose();
      this.doorMarkerMeshes.delete(k);
    }
  }

  private upsertWalkableFloorMeshAtKey(k: string): void {
    if (!this.shouldShowWalkableFloorAtKey(k)) {
      this.removeWalkableFloorMeshAtKey(k);
      return;
    }
    const [x, z] = k.split(",").map(Number);
    const wx = x!;
    const wz = z!;
    const isExtra = !isBaseTile(wx, wz, this.roomId);
    const isDoor = this.doorTileKeys.has(k);
    let isPortalGlow = isDoor;
    if (!isPortalGlow) {
      for (const [key, meta] of this.placedObjects) {
        if (this.isActiveTeleporterPortal(meta.teleporter)) {
          const parts = key.split(",").map(Number);
          if (tileKey(parts[0]!, parts[1]!) === k) {
            isPortalGlow = true;
            break;
          }
        }
      }
    }
    const wantExtraColor = isExtra
      ? (this.extraFloorColorByKey.get(k) ?? TERRAIN_TILE_EXTRA_COLOR)
      : undefined;
    const wantCoreColor = !isExtra
      ? (this.baseFloorColorByKey.get(k) ??
        this.implicitBaseFloorColorRgb(wx, wz))
      : undefined;
    let mesh = this.walkableFloorMeshes.get(k);
    if (!mesh) {
      mesh = new THREE.Mesh(
        this.walkableFloorTileGeom,
        createWalkableFloorTileMaterials(
          isPortalGlow,
          isExtra,
          wantExtraColor,
          wantCoreColor
        )
      );
      mesh.scale.set(this.floorTileQuadSize, 1, this.floorTileQuadSize);
      mesh.position.set(
        wx,
        WALKABLE_FLOOR_TOP_Y - WALKABLE_FLOOR_TILE_THICKNESS / 2,
        wz
      );
      mesh.visible = false;
      mesh.userData["isExtra"] = isExtra;
      mesh.userData["isDoor"] = isDoor;
      mesh.userData["isPortalGlow"] = isPortalGlow;
      mesh.userData["extraColorRgb"] = wantExtraColor;
      mesh.userData["coreColorRgb"] = wantCoreColor;
      this.walkableFloorMeshes.set(k, mesh);
    } else {
      const prevExtraColor = mesh.userData["extraColorRgb"] as
        | number
        | undefined;
      const prevCoreColor = mesh.userData["coreColorRgb"] as
        | number
        | undefined;
      if (
        mesh.userData["isExtra"] !== isExtra ||
        mesh.userData["isDoor"] !== isDoor ||
        mesh.userData["isPortalGlow"] !== isPortalGlow ||
        prevExtraColor !== wantExtraColor ||
        prevCoreColor !== wantCoreColor
      ) {
        applyWalkableFloorTileMaterials(
          mesh,
          isPortalGlow,
          isExtra,
          wantExtraColor,
          wantCoreColor
        );
        mesh.userData["isExtra"] = isExtra;
        mesh.userData["isDoor"] = isDoor;
        mesh.userData["isPortalGlow"] = isPortalGlow;
        mesh.userData["extraColorRgb"] = wantExtraColor;
        mesh.userData["coreColorRgb"] = wantCoreColor;
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

  private implicitBaseFloorColorRgb(x: number, z: number): number | undefined {
    if (normalizeRoomId(this.roomId) !== PIXEL_ROOM_ID) return undefined;
    if (!isBaseTile(x, z, this.roomId)) return undefined;
    return pixelImplicitFloorColorRgb(x, z);
  }

  private tilesInFloorChunk(
    chunkKey: string,
    bounds: RoomBounds
  ): Array<{ x: number; z: number }> {
    const [cx, cz] = chunkKey.split(",").map(Number);
    if (!Number.isFinite(cx) || !Number.isFinite(cz)) return [];
    const c = INTEREST_CHUNK_TILES;
    const minX = cx! * c;
    const maxX = minX + c - 1;
    const minZ = cz! * c;
    const maxZ = minZ + c - 1;
    const out: Array<{ x: number; z: number }> = [];
    for (let x = Math.max(bounds.minX, minX); x <= Math.min(bounds.maxX, maxX); x++) {
      for (let z = Math.max(bounds.minZ, minZ); z <= Math.min(bounds.maxZ, maxZ); z++) {
        out.push({ x, z });
      }
    }
    return out;
  }

  /** Spatial rooms: build walkable floor for 32×32 chunks only (not the full 500×500 grid). */
  private syncWalkableFloorChunkKeys(chunkKeys: Set<string>): void {
    for (const ck of chunkKeys) {
      for (const { x, z } of this.tilesInFloorChunk(ck, this.roomBounds)) {
        this.upsertWalkableFloorMeshAtKey(tileKey(x, z));
      }
    }
    if (this.floorVisualUseSingleBatch()) {
      this.rebuildWalkableFloorVisualMeshes();
    } else {
      this.rebuildWalkableFloorVisualMeshes(chunkKeys);
    }
    this.applyFloorTileQuadScale();
    this.bringPlacedBlockGroupsToSceneTail();
    this.markSceneMutation("syncWalkableFloorChunkKeys");
    this.requestRender();
  }

  private syncWalkableFloorTiles(keys: Iterable<string>): void {
    const keyList = [...keys];
    for (const k of keyList) {
      this.upsertWalkableFloorMeshAtKey(k);
    }
    if (keyList.length > 0 && this.updateWalkableFloorSolidVisualTiles(keyList)) {
      this.requestRender();
      return;
    }
    const chunkKeys = interestChunksForTileKeys(keyList);
    if (chunkKeys.size > 0) {
      this.rebuildWalkableFloorVisualChunks(chunkKeys);
      this.bringPlacedBlockGroupsToSceneTail();
    }
  }

  private rebuildWalkableFloorVisualChunks(chunkKeys: Set<string>): void {
    this.rebuildWalkableFloorVisualMeshes(chunkKeys);
  }

  /** One InstancedMesh avoids z-fighting seams between 32×32 chunk batches (stream / large rooms). */
  private floorVisualUseSingleBatch(): boolean {
    return (
      this.streamPresentationActive ||
      roomUsesSpatialInterest(this.roomBounds)
    );
  }

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

    for (const k of seen) {
      this.upsertWalkableFloorMeshAtKey(k);
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
    for (const batch of this.plainCubeInstancedMeshes) {
      this.scene.remove(batch);
      this.scene.add(batch);
    }
  }

  private hasRenderedBlockAtKey(k: string): boolean {
    return this.blockMeshes.has(k) || this.plainCubeInstancedTileKeys.has(k);
  }

  private collectPlacedBlockPickRoots(): THREE.Object3D[] {
    this.blockPickRootsBuf.length = 0;
    for (const g of this.blockMeshes.values()) {
      this.blockPickRootsBuf.push(g);
    }
    for (const m of this.plainCubeInstancedMeshes) {
      this.blockPickRootsBuf.push(m);
    }
    for (const m of this.teleporterMarkerMeshes.values()) {
      this.blockPickRootsBuf.push(m);
    }
    return this.blockPickRootsBuf;
  }

  private disposePlainCubeInstancedMeshes(clearSig = true): void {
    for (const mesh of this.plainCubeInstancedMeshes) {
      this.scene.remove(mesh);
    }
    this.plainCubeInstancedMeshes.length = 0;
    this.plainCubeInstancedTileKeys.clear();
    if (clearSig) this.plainCubeInstanceRenderSig = "";
  }

  private collectPlainCubeInstancedEntries(vis: number): {
    tileKey: string;
    wx: number;
    wz: number;
    wyLevel: number;
    meta: BlockStyleProps;
  }[] {
    type PlainCubeEntry = {
      tileKey: string;
      wx: number;
      wz: number;
      wyLevel: number;
      meta: BlockStyleProps;
    };
    const entries: PlainCubeEntry[] = [];
    for (const [k, metaRaw] of this.placedObjects) {
      const parts = k.split(",").map(Number);
      const wx = parts[0]!;
      const wz = parts[1]!;
      const wyLevel = Number.isFinite(parts[2]) ? Math.floor(parts[2]!) : 0;
      const meta = this.gateRepositionPlacedRenderMeta(wx, wz, wyLevel, metaRaw);
      if (!canUsePlainCubeInstancing(meta)) continue;
      if (
        wyLevel === 0 &&
        this.billboardFootprintFloorKeys.has(`${wx},${wz}`)
      ) {
        continue;
      }
      if (this.prefabPlaceSuppressFloorKeys.has(`${wx},${wz}`)) {
        continue;
      }
      entries.push({ tileKey: k, wx, wz, wyLevel, meta });
    }
    return entries;
  }

  private recomputePlainCubeInstanceRenderSig(vis: number): void {
    const sigParts: string[] = [];
    for (const entry of this.collectPlainCubeInstancedEntries(vis)) {
      sigParts.push(
        `${entry.tileKey}|${plainCubeInstanceEntrySig(entry.meta, vis)}`
      );
    }
    sigParts.sort();
    this.plainCubeInstanceRenderSig = sigParts.join(";");
  }

  private appendPlainCubeInstancedBatches(
    entries: {
      tileKey: string;
      wx: number;
      wz: number;
      wyLevel: number;
      meta: BlockStyleProps;
    }[],
    vis: number
  ): void {
    const byBatch = new Map<
      string,
      {
        tileKey: string;
        wx: number;
        wz: number;
        wyLevel: number;
        meta: BlockStyleProps;
      }[]
    >();
    for (const entry of entries) {
      const batchKey = plainCubeInstanceBatchKey(
        entry.wx,
        entry.wz,
        entry.wyLevel,
        vis,
        entry.meta
      );
      let list = byBatch.get(batchKey);
      if (!list) {
        list = [];
        byBatch.set(batchKey, list);
      }
      list.push(entry);
    }

    const dummy = this.plainCubeInstanceDummy;
    for (const [batchKey, batchEntries] of byBatch) {
      if (batchEntries.length === 0) continue;
      const sample = batchEntries[0]!;
      const batch = new THREE.InstancedMesh(
        getPlainCubeInstanceGeometry(vis, sample.meta),
        getPlainCubeInstanceMaterial(sample.meta, sample.wyLevel),
        batchEntries.length
      );
      batch.castShadow = false;
      batch.receiveShadow = false;
      batch.renderOrder = placedBlockStackRenderOrder(sample.wyLevel);
      const tileKeys: string[] = new Array(batchEntries.length);
      for (let i = 0; i < batchEntries.length; i++) {
        const e = batchEntries[i]!;
        setPlainCubeInstanceMatrix(dummy, e.wx, e.wz, e.wyLevel, e.meta, vis);
        batch.setMatrixAt(i, dummy.matrix);
        tileKeys[i] = e.tileKey;
        this.plainCubeInstancedTileKeys.add(e.tileKey);
      }
      batch.instanceMatrix.needsUpdate = true;
      batch.userData["plainCubeTileKeys"] = tileKeys;
      batch.userData["plainCubeBatchKey"] = batchKey;
      batch.computeBoundingSphere();
      this.scene.add(batch);
      this.plainCubeInstancedMeshes.push(batch);
    }
  }

  /** Rebuild instanced-cube batches only in the given floor chunks. */
  private rebuildPlainCubeInstancedForChunks(
    chunks: ReadonlySet<string>,
    vis: number
  ): boolean {
    const kept: THREE.InstancedMesh[] = [];
    for (const mesh of this.plainCubeInstancedMeshes) {
      const batchKey = mesh.userData["plainCubeBatchKey"] as string | undefined;
      const chunk = batchKey?.split("|")[0];
      if (chunk && chunks.has(chunk)) {
        this.scene.remove(mesh);
        const tileKeys = mesh.userData["plainCubeTileKeys"] as
          | string[]
          | undefined;
        if (tileKeys) {
          for (const tk of tileKeys) this.plainCubeInstancedTileKeys.delete(tk);
        }
      } else {
        kept.push(mesh);
      }
    }
    this.plainCubeInstancedMeshes.length = 0;
    this.plainCubeInstancedMeshes.push(...kept);

    const entries = this.collectPlainCubeInstancedEntries(vis).filter((e) =>
      chunks.has(tileChunkKey(e.wx, e.wz))
    );
    this.appendPlainCubeInstancedBatches(entries, vis);
    return true;
  }

  private syncPlainCubeInstancedMeshes(changedKeys?: ReadonlySet<string>): void {
    const vis = this.blockVisualScale;
    if (changedKeys && changedKeys.size > 0 && changedKeys.size <= 512) {
      const chunks = new Set<string>();
      for (const k of changedKeys) {
        const parts = k.split(",").map(Number);
        if (Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
          chunks.add(tileChunkKey(parts[0]!, parts[1]!));
        }
      }
      if (
        chunks.size > 0 &&
        chunks.size <= 16 &&
        this.rebuildPlainCubeInstancedForChunks(chunks, vis)
      ) {
        this.recomputePlainCubeInstanceRenderSig(vis);
        return;
      }
    }

    const sigParts: string[] = [];
    const entries = this.collectPlainCubeInstancedEntries(vis);
    for (const entry of entries) {
      sigParts.push(
        `${entry.tileKey}|${plainCubeInstanceEntrySig(entry.meta, vis)}`
      );
    }
    sigParts.sort();
    const sig = sigParts.join(";");
    if (sig === this.plainCubeInstanceRenderSig) return;
    this.plainCubeInstanceRenderSig = sig;

    this.disposePlainCubeInstancedMeshes(false);
    this.appendPlainCubeInstancedBatches(entries, vis);
  }

  private disposeWalkableFloorVisualMeshes(): void {
    for (const mesh of this.walkableFloorVisualMeshes) {
      this.scene.remove(mesh);
      if (mesh.material instanceof THREE.Material) mesh.material.dispose();
    }
    this.walkableFloorVisualMeshes.length = 0;
    this.walkableFloorSolidVisualIndex.clear();
  }

  /**
   * Patch colors/matrices for existing tiles in the unified solid floor batch (O(changed) not O(all)).
   */
  private updateWalkableFloorSolidVisualTiles(keys: readonly string[]): boolean {
    if (!this.floorVisualUseSingleBatch()) return false;
    if (this.walkableFloorSolidVisualIndex.size === 0) return false;
    const batch = this.walkableFloorVisualMeshes.find(
      (m) =>
        m.userData["floorVisualKind"] === "solid" &&
        m.userData["walkableFloorChunkKey"] === "__all__"
    );
    if (!batch) return false;

    const dummy = new THREE.Object3D();
    const tileColor = new THREE.Color();
    for (const k of keys) {
      const src = this.walkableFloorMeshes.get(k);
      if (!src) return false;
      if (src.userData["isPortalGlow"]) continue;
      const idx = this.walkableFloorSolidVisualIndex.get(k);
      if (idx === undefined) return false;

      let color: number;
      if (src.userData["isExtra"]) {
        color =
          (src.userData["extraColorRgb"] as number | undefined) ??
          TERRAIN_TILE_EXTRA_COLOR;
      } else {
        color =
          (src.userData["coreColorRgb"] as number | undefined) ??
          TERRAIN_TILE_CORE_COLOR;
      }
      setWalkableFloorVisualInstanceTransform(
        dummy,
        src.position.x,
        src.position.z,
        this.floorTileQuadSize
      );
      batch.setMatrixAt(idx, dummy.matrix);
      tileColor.setHex(color);
      batch.setColorAt(idx, tileColor);
    }
    batch.instanceMatrix.needsUpdate = true;
    if (batch.instanceColor) batch.instanceColor.needsUpdate = true;
    return true;
  }

  private rebuildWalkableFloorVisualMeshes(onlyChunks?: Set<string>): void {
    const singleBatch = this.floorVisualUseSingleBatch();
    if (singleBatch) {
      onlyChunks = undefined;
    }
    if (!onlyChunks) {
      this.disposeWalkableFloorVisualMeshes();
    } else {
      this.walkableFloorVisualMeshes = this.walkableFloorVisualMeshes.filter(
        (mesh) => {
          const ck = mesh.userData["walkableFloorChunkKey"] as
            | string
            | undefined;
          if (!ck || !onlyChunks.has(ck)) return true;
          this.scene.remove(mesh);
          if (mesh.material instanceof THREE.Material) mesh.material.dispose();
          return false;
        }
      );
    }
    const floorByChunk = new Map<
      string,
      { wx: number; wz: number; color: number }[]
    >();
    const portalByChunk = new Map<string, { wx: number; wz: number }[]>();
    const solidBatchKey = singleBatch ? "__all__" : null;
    for (const [, mesh] of this.walkableFloorMeshes) {
      const wx = mesh.position.x;
      const wz = mesh.position.z;
      const chunkKey = solidBatchKey ?? tileChunkKey(wx, wz);
      if (onlyChunks && !onlyChunks.has(chunkKey)) continue;
      if (mesh.userData["isPortalGlow"]) {
        let list = portalByChunk.get(chunkKey);
        if (!list) {
          list = [];
          portalByChunk.set(chunkKey, list);
        }
        list.push({ wx, wz });
        continue;
      }
      let color: number;
      if (mesh.userData["isExtra"]) {
        color =
          (mesh.userData["extraColorRgb"] as number | undefined) ??
          TERRAIN_TILE_EXTRA_COLOR;
      } else {
        color =
          (mesh.userData["coreColorRgb"] as number | undefined) ??
          TERRAIN_TILE_CORE_COLOR;
      }
      let list = floorByChunk.get(chunkKey);
      if (!list) {
        list = [];
        floorByChunk.set(chunkKey, list);
      }
      list.push({ wx, wz, color });
    }
    const dummy = new THREE.Object3D();
    const tileColor = new THREE.Color();
    for (const [chunkKey, floorTiles] of floorByChunk) {
      if (floorTiles.length === 0) continue;
      const batch = new THREE.InstancedMesh(
        this.walkableFloorTileTopGeom,
        createWalkableFloorVisualMaterial(),
        floorTiles.length
      );
      batch.renderOrder = 0;
      for (let i = 0; i < floorTiles.length; i++) {
        const t = floorTiles[i]!;
        setWalkableFloorVisualInstanceTransform(
          dummy,
          t.wx,
          t.wz,
          this.floorTileQuadSize
        );
        batch.setMatrixAt(i, dummy.matrix);
        tileColor.setHex(t.color);
        batch.setColorAt(i, tileColor);
      }
      batch.instanceMatrix.needsUpdate = true;
      if (batch.instanceColor) batch.instanceColor.needsUpdate = true;
      batch.computeBoundingSphere();
      batch.frustumCulled = false;
      batch.userData["floorVisualKind"] = "solid";
      batch.userData["walkableFloorChunkKey"] = chunkKey;
      if (chunkKey === "__all__") {
        this.walkableFloorSolidVisualIndex.clear();
        for (let i = 0; i < floorTiles.length; i++) {
          const t = floorTiles[i]!;
          this.walkableFloorSolidVisualIndex.set(tileKey(t.wx, t.wz), i);
        }
      }
      this.scene.add(batch);
      this.walkableFloorVisualMeshes.push(batch);
    }
    for (const [chunkKey, portalTiles] of portalByChunk) {
      if (portalTiles.length === 0) continue;
      const batch = new THREE.InstancedMesh(
        this.walkableFloorTileTopGeom,
        createWalkableFloorTileMaterials(true, false),
        portalTiles.length
      );
      batch.renderOrder = 0;
      for (let i = 0; i < portalTiles.length; i++) {
        const t = portalTiles[i]!;
        setWalkableFloorVisualInstanceTransform(
          dummy,
          t.wx,
          t.wz,
          this.floorTileQuadSize
        );
        batch.setMatrixAt(i, dummy.matrix);
      }
      batch.instanceMatrix.needsUpdate = true;
      batch.computeBoundingSphere();
      batch.frustumCulled = false;
      batch.userData["floorVisualKind"] = "portal";
      batch.userData["walkableFloorChunkKey"] = chunkKey;
      this.scene.add(batch);
      this.walkableFloorVisualMeshes.push(batch);
    }
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

  private syncBlockMeshesForKeys(keys: ReadonlySet<string>): void {
    for (const k of keys) {
      const metaRaw = this.placedObjects.get(k);
      if (!metaRaw) {
        const mesh = this.blockMeshes.get(k);
        if (mesh) {
          this.scene.remove(mesh);
          disposePlacedBlockGroupContents(mesh);
          this.blockMeshes.delete(k);
        }
        continue;
      }
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
      if (this.prefabPlaceSuppressFloorKeys.has(`${wx},${wz}`)) {
        if (g) {
          this.scene.remove(g);
          disposePlacedBlockGroupContents(g);
          this.blockMeshes.delete(k);
        }
        continue;
      }
      if (metaRaw.teleporter) {
        if (g) {
          this.scene.remove(g);
          disposePlacedBlockGroupContents(g);
          this.blockMeshes.delete(k);
        }
        continue;
      }
      if (canUsePlainCubeInstancing(meta)) {
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
        (prev.hexRadiusScale ?? 1) === (meta.hexRadiusScale ?? 1) &&
        prev.sphere === meta.sphere &&
        (prev.sphereRadiusScale ?? 1) === (meta.sphereRadiusScale ?? 1) &&
        prev.ramp === meta.ramp &&
        prev.rampDir === meta.rampDir &&
        JSON.stringify(
          cubeRotationForPlainCube(
            {
              hex: prev.hex,
              pyramid: prev.pyramid,
              sphere: prev.sphere,
              ramp: prev.ramp,
            },
            prev
          )
        ) ===
          JSON.stringify(
            cubeRotationForPlainCube(
              {
                hex: meta.hex,
                pyramid: meta.pyramid,
                sphere: meta.sphere,
                ramp: meta.ramp,
              },
              meta
            )
          ) &&
        prev.colorRgb === meta.colorRgb &&
        prev.claimable === meta.claimable &&
        prev.active === meta.active &&
        JSON.stringify(prev.teleporter) === JSON.stringify(meta.teleporter) &&
        JSON.stringify(prev.gate) === JSON.stringify(meta.gate) &&
        JSON.stringify(prev.gateOpen) === JSON.stringify(meta.gateOpen) &&
        JSON.stringify(prev.unlockPad) === JSON.stringify(meta.unlockPad) &&
        (prev.unlockPad?.instanceId
          ? this.unlockedPadInstanceIds.has(prev.unlockPad.instanceId) ===
            Boolean(g?.userData["unlockPadUnlocked"])
          : true) &&
        (prev.signboardId ?? "") === (meta.signboardId ?? "");
      if (unchanged) {
        continue;
      }
      if (g) {
        this.scene.remove(g);
        disposePlacedBlockGroupContents(g);
        this.blockMeshes.delete(k);
      }
      g = this.makeBlockMesh(meta, {
        tileX: wx,
        tileZ: wz,
        floorLayer: wyLevel,
      });
      g.userData.tileKey = k;
      g.userData.blockMeta = { ...meta };
      g.userData.blockRenderScale = vis;
      g.userData.unlockPadUnlocked = Boolean(
        meta.unlockPad?.instanceId &&
          this.unlockedPadInstanceIds.has(meta.unlockPad.instanceId)
      );
      g.position.set(wx, wyLevel * BLOCK_SIZE + (h * vis) / 2, wz);
      this.scene.add(g);
      this.blockMeshes.set(k, g);
    }
    this.syncPlainCubeInstancedMeshes(keys);
    if (!this.streamPresentationActive) {
      this.refreshSelectionOutline();
    }
    this.syncTeleporterMarkers();
  }

  private syncBlockMeshes(): void {
    const keys = new Set(this.placedObjects.keys());
    for (const k of this.blockMeshes.keys()) keys.add(k);
    this.syncBlockMeshesForKeys(keys);
  }

  private obstacleHeight(meta: BlockStyleProps): number {
    if (
      meta.unlockPad?.instanceId &&
      this.unlockedPadInstanceIds.has(meta.unlockPad.instanceId)
    ) {
      return BLOCK_SIZE * 0.12;
    }
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
    const base = resolveBlockColorRgb(meta);
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
    opts?: {
      ghost?: boolean;
      tileX?: number;
      tileZ?: number;
      floorLayer?: number;
      /** Isolated dock / inspector GL canvas - no mineable sparkle shell. */
      inspectorPreview?: boolean;
    }
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
    const unlockedPad =
      Boolean(meta.unlockPad?.instanceId) &&
      this.unlockedPadInstanceIds.has(meta.unlockPad!.instanceId);
    const h = this.obstacleHeight(meta);
    const vis = this.blockVisualScale;
    const hVis = h * vis;
    const floorLayer = Math.max(
      0,
      Math.min(2, Math.floor(opts?.floorLayer ?? 0))
    );
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
    } else if (unlockedPad) {
      // Distinct passable plate for unlockers (others still see the solid pad).
      base = 0xc4a574;
    } else {
      base = resolveBlockColorRgb(meta);
    }
    
    const mat = new THREE.MeshStandardMaterial({
      color: base,
      roughness: unlockedPad ? 0.72 : PLACED_COLOR_SURFACE_ROUGHNESS,
      metalness: unlockedPad ? 0.08 : PLACED_COLOR_SURFACE_METALNESS,
      transparent: ghost || meta.passable || unlockedPad,
      opacity: ghost ? 0.42 : unlockedPad ? 0.92 : meta.passable ? 0.45 : 1,
      depthWrite: ghost ? false : unlockedPad ? true : !meta.passable,
      emissive: meta.claimable && meta.active ? 0xffc107 : unlockedPad ? 0x3d2e1a : 0x000000,
      emissiveIntensity: meta.claimable && meta.active ? 0.28 : unlockedPad ? 0.12 : 0,
    });
    if (!ghost && floorLayer > 0 && !meta.passable && !unlockedPad) {
      applyUpperStackLayerDepthBias(mat, floorLayer);
    }
    if (meta.ramp && !unlockedPad) {
      const geom = this.makeRampGeometry(h, meta.rampDir, vis);
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.y = -hVis / 2;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      g.add(mesh);
    } else if (meta.sphere && !unlockedPad) {
      const radiusScale = clampSphereRadiusScale(meta.sphereRadiusScale ?? 1);
      const r = BLOCK_SIZE * 0.5 * 0.94 * vis * radiusScale;
      const geom = new THREE.SphereGeometry(r, 20, 16);
      const mesh = new THREE.Mesh(geom, mat);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      g.add(mesh);
    } else if (meta.pyramid && !unlockedPad) {
      const scale = meta.pyramidBaseScale ?? 1;
      const rBase = BLOCK_SIZE * 0.5 * 0.94 * vis * scale;
      const geom = new THREE.ConeGeometry(rBase, hVis, 4, 1);
      const mesh = new THREE.Mesh(geom, mat);
      mesh.rotation.y = Math.PI / 4;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      g.add(mesh);
    } else if (meta.hex && !unlockedPad) {
      const radiusScale = clampHexRadiusScale(meta.hexRadiusScale ?? 1);
      const r = BLOCK_SIZE * 0.5 * 0.94 * vis * radiusScale;
      const geom = new THREE.CylinderGeometry(r, r, hVis, 6);
      const mesh = new THREE.Mesh(geom, mat);
      mesh.rotation.y = Math.PI / 6;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      g.add(mesh);
    } else {
      const footprint = unlockedPad ? BLOCK_SIZE * vis * 0.96 : BLOCK_SIZE * vis;
      const geom = new THREE.BoxGeometry(footprint, hVis, footprint);
      const mesh = new THREE.Mesh(geom, mat);
      if (!unlockedPad) {
        applyPlainCubeMeshRotation(
          mesh.rotation,
          cubeRotationForPlainCube(
            {
              hex: meta.hex,
              pyramid: meta.pyramid,
              sphere: meta.sphere,
              ramp: meta.ramp,
            },
            meta
          )
        );
      }
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      g.add(mesh);
      if (unlockedPad && !ghost) {
        const rimMat = new THREE.MeshStandardMaterial({
          color: 0x8a6a3e,
          roughness: 0.55,
          metalness: 0.2,
          transparent: true,
          opacity: 0.85,
        });
        const rim = new THREE.Mesh(
          new THREE.BoxGeometry(BLOCK_SIZE * vis * 1.02, hVis * 0.35, BLOCK_SIZE * vis * 1.02),
          rimMat
        );
        rim.position.y = -hVis * 0.2;
        rim.castShadow = false;
        rim.receiveShadow = false;
        g.add(rim);
      }
    }
    if (meta.claimable && meta.active && !ghost && !opts?.inspectorPreview) {
      const sparkles = makeMineableSparklePoints(hVis, vis);
      g.userData.mineableSparklePoints = sparkles;
      g.add(sparkles);
    } else {
      g.userData.mineableSparklePoints = undefined;
    }
    g.renderOrder = placedBlockStackRenderOrder(floorLayer);
    if (
      !ghost &&
      meta.signboardId &&
      floorLayer === 0 &&
      !meta.claimable
    ) {
      this.attachSignpostHintToBlockGroup(g, meta);
    }
    return g;
  }

  resize(): void {
    const w = this.canvasHost.clientWidth;
    const h = this.canvasHost.clientHeight;
    const renderScale = readWebglRenderScale();
    const dpr = Math.min(window.devicePixelRatio, 2) * renderScale;
    if (this.streamPresentationActive) {
      this.applyStreamRenderSize(w, h);
      this.fogOfWar.setSize(w, h, 1);
    } else {
      this.resetStreamRenderSize(w, h, dpr);
      this.fogOfWar.setSize(w, h, dpr);
    }
    this.applyOrthographicFrustum();
    this.refreshAllNameLabelScales();
    this.refreshSignpostHintSpriteScales();
    this.refreshChatBubbleVerticalPositions();
    this.refreshAllTypingIndicatorLayouts();
    this.requestRender();
  }

  private playerMovedRecently(address: string, x: number, z: number): boolean {
    const now = performance.now();
    const prev = this.cosmeticLastPos.get(address);
    this.cosmeticLastPos.set(address, { x, z, t: now });
    if (!prev) return false;
    const dist = Math.hypot(x - prev.x, z - prev.z);
    return dist > 0.05 && now - prev.t < 500;
  }

  /** Server-authoritative path intent for a remote avatar (`moveOrder` dual-send tracer). */
  applyMoveOrder(msg: MoveOrderWire): void {
    if (msg.address === this.selfAddress) {
      // Pitch free-move still receives movement stateDelta; grid walks rely on moveOrder.
      if (this.isWorldcupFreeMoveRoom()) return;
      const startY =
        this.selfTargetPos?.y ?? this.selfMesh?.position.y ?? 0;
      this.selfMoveOrder = {
        ...msg,
        startY,
        path: msg.path.map((w) => ({ ...w })),
      };
      this.refreshSelfMoveOrderTarget();
      this.requestRender(400);
      return;
    }
    const t = this.targetPos.get(msg.address);
    const g = this.others.get(msg.address);
    const startY = t?.y ?? g?.position.y ?? 0;
    this.remoteMoveOrders.set(msg.address, {
      ...msg,
      startY,
      path: msg.path.map((w) => ({ ...w })),
    });
    this.refreshRemoteMoveOrderTarget(msg.address);
    this.requestRender(400);
  }

  /** Drop remote path playback and snap to authoritative pose (`moveAbort`). */
  applyMoveAbort(msg: RemoteMoveAbortWire): void {
    if (msg.address === this.selfAddress) {
      if (!this.isWorldcupFreeMoveRoom()) {
        this.selfMoveOrder = null;
        const py = Number.isFinite(msg.y) ? msg.y : 0;
        if (this.selfTargetPos) {
          this.selfTargetPos.set(msg.x, py, msg.z);
        }
        this.selfMesh?.position.set(msg.x, py, msg.z);
        this.selfServerVx = msg.vx;
        this.selfServerVz = msg.vz;
        this.selfLastServerRecvMs = performance.now();
      }
      this.requestRender(400);
      return;
    }
    applyRemoteMoveAbort({
      msg,
      selfAddress: this.selfAddress,
      remoteMoveOrders: this.remoteMoveOrders,
      targetPos: this.targetPos.get(msg.address),
      avatarGroup: this.others.get(msg.address),
    });
    this.requestRender(400);
  }

  /** Walk clamp bounds for remote moveOrder playback (matches server path stepping). */
  private pathMoveBoundsForPlayback(): {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  } {
    if (this.isWorldcupFreeMoveRoom()) {
      const m = WORLDCUP_FIELD_OUTFIELD_MARGIN;
      const b = this.roomBounds;
      return {
        minX: b.minX - m,
        maxX: b.maxX + m,
        minZ: b.minZ - m,
        maxZ: b.maxZ + m,
      };
    }
    return walkBoundsForRoom(this.roomBounds, this.extraFloorKeys);
  }

  private refreshRemoteMoveOrderTarget(
    address: string,
    nowMs = Date.now()
  ): void {
    const order = this.remoteMoveOrders.get(address);
    if (!order) return;
    const bounds = this.pathMoveBoundsForPlayback();
    const { pose, pathRemaining } = remotePoseFromMoveOrder({
      order,
      startY: order.startY,
      nowMs,
      bounds,
      placed: this.placedObjects,
    });
    if (!moveOrderPlaybackActive(pathRemaining)) {
      this.remoteMoveOrders.delete(address);
    }
    const t = this.targetPos.get(address);
    if (t) {
      t.set(pose.x, pose.y, pose.z);
    }
  }

  private refreshSelfMoveOrderTarget(nowMs = Date.now()): void {
    const order = this.selfMoveOrder;
    if (!order) return;
    const bounds = this.pathMoveBoundsForPlayback();
    const { pose, pathRemaining } = remotePoseFromMoveOrder({
      order,
      startY: order.startY,
      nowMs,
      bounds,
      placed: this.placedObjects,
    });
    if (!moveOrderPlaybackActive(pathRemaining)) {
      this.selfMoveOrder = null;
    }
    if (!this.selfTargetPos) {
      this.selfTargetPos = new THREE.Vector3(pose.x, pose.y, pose.z);
    } else {
      this.selfTargetPos.set(pose.x, pose.y, pose.z);
    }
    this.selfServerVx = pose.vx;
    this.selfServerVz = pose.vz;
    this.selfLastServerRecvMs = performance.now();
  }

  syncState(players: PlayerState[]): void {
    let visualChanged = false;
    const seen = new Set<string>();
    for (const p of players) {
      seen.add(p.address);
      const py = Number.isFinite(p.y) ? p.y : 0;
      if (p.address === this.selfAddress) {
        this.selfPlayerSnapshot = p;
        if (this.selfMesh) {
          if (!this.selfTargetPos) {
            this.selfTargetPos = new THREE.Vector3(p.x, py, p.z);
            this.selfMesh.position.set(p.x, py, p.z);
            visualChanged = true;
          } else if (!this.selfMoveOrder) {
            visualChanged =
              visualChanged ||
              Math.hypot(this.selfTargetPos.x - p.x, this.selfTargetPos.z - p.z) > 0.001 ||
              Math.abs(this.selfTargetPos.y - py) > 0.001 ||
              Math.abs(this.selfServerVx - p.vx) > 0.001 ||
              Math.abs(this.selfServerVz - p.vz) > 0.001;
            this.selfTargetPos.set(p.x, py, p.z);
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
          }
          this.syncAvatarNameLabelFromState(this.selfMesh, this.withSelfCosmeticPreview(p));
          this.syncTypingIndicatorForGroup(this.selfMesh, p);
          this.syncWorldcupChallengeBubble(this.selfMesh, p);
          syncCosmeticLoadoutVfx(
            this.selfMesh,
            this.withSelfCosmeticPreview(p),
            this.playerMovedRecently(
              p.address,
              this.selfMoveOrder ? this.selfTargetPos!.x : p.x,
              this.selfMoveOrder ? this.selfTargetPos!.z : p.z
            )
          );
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
        if (!this.remoteMoveOrders.has(p.address)) {
          visualChanged =
            visualChanged ||
            Math.hypot(t.x - p.x, t.z - p.z) > 0.001 ||
            Math.abs(t.y - py) > 0.001;
          t.set(p.x, py, p.z);
        }
      }
      this.syncAvatarNameLabelFromState(g, p);
      this.syncTypingIndicatorForGroup(g, p);
      this.syncWorldcupChallengeBubble(g, p);
      syncCosmeticLoadoutVfx(g, p, this.playerMovedRecently(p.address, p.x, p.z));
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
        this.remoteMoveOrders.delete(addr);
        visualChanged = true;
      }
    }
    this.syncPlacementRangeHints();
    if (visualChanged) {
      this.requestRender(400);
    }
  }

  // ---- worldcup: seasonal soccer ball + goals (feature-flagged, deletable) ----

  private static readonly WORLDCUP_BALL_RADIUS = 0.45;

  private makeWorldcupBallMesh(): THREE.Mesh {
    const r = Game.WORLDCUP_BALL_RADIUS;
    const geo = new THREE.SphereGeometry(r, 24, 18);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: worldcupMakeSoccerBallTexture(),
      roughness: 0.5,
      metalness: 0.0,
      emissive: 0x222222,
      emissiveIntensity: 0.12,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = false;
    mesh.userData["skipBlockPickAndBounds"] = true;
    return mesh;
  }

  /** Apply a server ball snapshot: upsert meshes/targets, remove stale balls. */
  applyWorldcupBalls(balls: BallWire[]): void {
    const seen = new Set<string>();
    const now = performance.now();
    for (const b of balls) {
      seen.add(b.id);
      let mesh = this.worldcupBalls.get(b.id);
      if (!mesh) {
        mesh = this.makeWorldcupBallMesh();
        mesh.position.set(b.x, Game.WORLDCUP_BALL_RADIUS, b.z);
        this.worldcupBalls.set(b.id, mesh);
        this.scene.add(mesh);
        this.markSceneMutation("worldcup:addBall");
      }
      this.worldcupBallTargets.set(b.id, {
        x: b.x,
        z: b.z,
        vx: b.vx,
        vz: b.vz,
        recvMs: now,
      });
    }
    for (const id of [...this.worldcupBalls.keys()]) {
      if (seen.has(id)) continue;
      const mesh = this.worldcupBalls.get(id);
      if (mesh) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
      this.worldcupBalls.delete(id);
      this.worldcupBallTargets.delete(id);
    }
    this.requestRender(400);
  }

  clearWorldcupBalls(): void {
    for (const mesh of this.worldcupBalls.values()) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.worldcupBalls.clear();
    this.worldcupBallTargets.clear();
  }

  // ---- worldcup: Goalies (server-controlled keepers, one per goal) ----

  private static readonly WORLDCUP_GOALIE_HEIGHT = 1.6;
  /**
   * Fixed seed for the single "house keeper" identicon every Goalie wears. Stable constant
   * (mirrors the server's GOALIE_SENTINEL_ADDRESS intent) so both keepers share one face and
   * can never be mistaken for a real player.
   */
  private static readonly WORLDCUP_GOALIE_SEED = "NQGOALIEHOUSEKEEPER0000000000000000";

  /** Lazily build + cache the shared keeper identicon, applying it to any live keeper sprites. */
  private ensureWorldcupGoalieIdenticon(): void {
    if (this.worldcupGoalieIdenticonTex) return;
    void loadIdenticonTexture(Game.WORLDCUP_GOALIE_SEED)
      .then((tex) => {
        this.worldcupGoalieIdenticonTex = tex;
        for (const group of this.worldcupGoalies.values()) {
          const sprite = group.userData["keeperSprite"] as
            | THREE.Sprite
            | undefined;
          if (sprite) {
            const mat = sprite.material as THREE.SpriteMaterial;
            mat.map = tex;
            mat.color.setHex(0xffffff);
            mat.needsUpdate = true;
          }
        }
        this.requestRender(400);
      })
      .catch(() => {
        /* keep the neutral placeholder color on failure */
      });
  }

  /**
   * A Goalie object: a billboarded "house keeper" identicon (one fixed face for every keeper)
   * with a persistent bright keeper ring at its feet, so it reads as a defender - never a player.
   */
  private makeWorldcupGoalieObject(): THREE.Group {
    const group = new THREE.Group();

    const spriteMat = new THREE.SpriteMaterial({
      color: 0xbfc7d4,
      transparent: true,
      depthWrite: false,
    });
    if (this.worldcupGoalieIdenticonTex) {
      spriteMat.map = this.worldcupGoalieIdenticonTex;
      spriteMat.color.setHex(0xffffff);
    }
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(1.15, 1.15, 1);
    sprite.position.set(0, Game.WORLDCUP_GOALIE_HEIGHT * 0.62, 0);
    sprite.raycast = () => {};
    sprite.userData["skipBlockPickAndBounds"] = true;
    group.add(sprite);

    // Keeper "tell": a bright glowing ring at the feet so the keeper is unmistakable.
    const ringGeo = new THREE.TorusGeometry(0.5, 0.08, 8, 28);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x18e0ff,
      emissive: 0x0b6f88,
      emissiveIntensity: 0.7,
      roughness: 0.5,
      metalness: 0,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 0.06, 0);
    ring.raycast = () => {};
    ring.userData["skipBlockPickAndBounds"] = true;
    group.add(ring);

    group.userData["keeperSprite"] = sprite;
    group.userData["skipBlockPickAndBounds"] = true;
    return group;
  }

  private static disposeWorldcupGoalieObject(group: THREE.Group): void {
    group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = (o as THREE.Mesh | THREE.Sprite).material as
        | THREE.Material
        | THREE.Material[]
        | undefined;
      // Shared identicon texture is reused across keepers + rebuilds; only free materials.
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else if (mat) mat.dispose();
    });
  }

  /** Apply a server Goalie snapshot: upsert keeper objects/targets, remove stale ones. */
  applyWorldcupGoalies(goalies: Array<{ id: string; x: number; z: number }>): void {
    const seen = new Set<string>();
    const now = performance.now();
    if (goalies.length > 0) this.ensureWorldcupGoalieIdenticon();
    for (const g of goalies) {
      seen.add(g.id);
      let group = this.worldcupGoalies.get(g.id);
      if (!group) {
        group = this.makeWorldcupGoalieObject();
        group.position.set(g.x, 0, g.z);
        this.worldcupGoalies.set(g.id, group);
        this.scene.add(group);
        this.markSceneMutation("worldcup:addGoalie");
      }
      this.worldcupGoalieTargets.set(g.id, { x: g.x, z: g.z, recvMs: now });
    }
    for (const id of [...this.worldcupGoalies.keys()]) {
      if (seen.has(id)) continue;
      const group = this.worldcupGoalies.get(id);
      if (group) {
        this.scene.remove(group);
        Game.disposeWorldcupGoalieObject(group);
      }
      this.worldcupGoalies.delete(id);
      this.worldcupGoalieTargets.delete(id);
    }
    this.requestRender(400);
  }

  clearWorldcupGoalies(): void {
    for (const group of this.worldcupGoalies.values()) {
      this.scene.remove(group);
      Game.disposeWorldcupGoalieObject(group);
    }
    this.worldcupGoalies.clear();
    this.worldcupGoalieTargets.clear();
  }

  /** Per-frame Goalie interpolation (smooth lateral glide). Returns active. */
  private updateWorldcupGoalies(dt: number): boolean {
    if (this.worldcupGoalies.size === 0) return false;
    let active = false;
    const k = 1 - Math.exp(-16 * dt);
    for (const [id, mesh] of this.worldcupGoalies) {
      const t = this.worldcupGoalieTargets.get(id);
      if (!t) continue;
      const beforeX = mesh.position.x;
      const beforeZ = mesh.position.z;
      mesh.position.x += (t.x - mesh.position.x) * k;
      mesh.position.z += (t.z - mesh.position.z) * k;
      if (
        Math.hypot(mesh.position.x - beforeX, mesh.position.z - beforeZ) > 0.00025
      ) {
        active = true;
      }
    }
    return active;
  }

  /** Build/clear the goal frames for the soccer field room. */
  syncWorldcupGoals(roomId: string): void {
    if (this.worldcupGoalsGroup) {
      this.scene.remove(this.worldcupGoalsGroup);
      this.worldcupGoalsGroup.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      this.worldcupGoalsGroup = null;
    }
    if (this.worldcupCrowd) {
      this.scene.remove(this.worldcupCrowd.group);
      this.worldcupCrowd.dispose();
      this.worldcupCrowd = null;
    }
    // worldcup: the attacking-goal arrow is room-scoped; drop it when the decoration rebuilds.
    this.setWorldcupAttackGoal(null);
    if (!WORLDCUP_ENABLED_CLIENT || !worldcupIsFieldLikeRoomId(roomId)) return;

    const group = new THREE.Group();
    // Ground apron filling the gap between pitch and stands + the surrounding area.
    group.add(worldcupBuildStadiumGround(WORLDCUP_FIELD_BOUNDS));
    // Grass + line-markings pitch surface laid over the gray floor tiles.
    group.add(worldcupMakePitchSurface(WORLDCUP_FIELD_BOUNDS));
    // Stadium stands ringing the pitch (cosmetic; outside the walkable bounds).
    group.add(worldcupBuildStadium(WORLDCUP_FIELD_BOUNDS));
    const postMat = new THREE.MeshStandardMaterial({
      color: 0xf5f5f5,
      roughness: 0.6,
      emissive: 0x222222,
      emissiveIntensity: 0.2,
    });
    const postThickness = 0.18;
    const postHeight = 2.0;
    for (const g of WORLDCUP_FIELD_GOALS) {
      // End line (world): outer edge of the goal band facing the pitch interior.
      const isWest = g.id === "west";
      const lineX = isWest ? g.minX - 0.5 : g.maxX + 0.5;
      const zNear = g.minZ - 0.5;
      const zFar = g.maxZ + 0.5;
      const width = zFar - zNear;
      const mkPost = (zc: number) => {
        const m = new THREE.Mesh(
          new THREE.BoxGeometry(postThickness, postHeight, postThickness),
          postMat
        );
        m.position.set(lineX, postHeight / 2, zc);
        m.userData["skipBlockPickAndBounds"] = true;
        return m;
      };
      group.add(mkPost(zNear));
      group.add(mkPost(zFar));
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(postThickness, postThickness, width),
        postMat
      );
      bar.position.set(lineX, postHeight - postThickness / 2, (zNear + zFar) / 2);
      bar.userData["skipBlockPickAndBounds"] = true;
      group.add(bar);
      // Netting behind the mouth.
      group.add(
        worldcupBuildGoalNet({ lineX, zNear, zFar, postHeight, isWest })
      );
    }
    this.scene.add(group);
    this.worldcupGoalsGroup = group;
    // Cheering spectator crowd sitting on the stands.
    const crowd = new WorldcupCrowd(WORLDCUP_FIELD_BOUNDS);
    this.scene.add(crowd.group);
    this.worldcupCrowd = crowd;
    this.applyWorldcupCrowdFlags();
    this.markSceneMutation("worldcup:goals");
    this.requestRender(400);
  }

  /** Trigger a synchronized crowd celebration (called when a goal is scored). */
  worldcupCrowdCheer(intensity = 1): void {
    this.worldcupCrowd?.cheer(intensity);
    if (this.worldcupCrowd) this.requestRender(1500);
  }

  /** Set the champion flag the stadium crowd waves (previous UTC day's winner). */
  setWorldcupCrowdFlag(country: string | null): void {
    this.worldcupCrowdFlag = country;
    this.applyWorldcupCrowdFlags();
    if (this.worldcupCrowd) this.requestRender(800);
  }

  /** 1v1 Match: split the crowd's flags by pitch side (a = west half, b = east half). */
  setWorldcupCrowdSideFlags(aCountry: string | null, bCountry: string | null): void {
    this.worldcupCrowdSideFlags = { a: aCountry, b: bCountry };
    this.applyWorldcupCrowdFlags();
    if (this.worldcupCrowd) this.requestRender(800);
  }

  /** Free Play: the distinct country codes of players currently on the field. */
  setWorldcupCrowdRoster(codes: string[]): void {
    this.worldcupCrowdRoster = codes;
    this.applyWorldcupCrowdFlags();
    if (this.worldcupCrowd) this.requestRender(800);
  }

  /** Pick the right crowd allegiance for the current room: side-split on a Match Pitch,
   *  live field roster (champion fallback) on the Free Play Field. */
  private applyWorldcupCrowdFlags(): void {
    const crowd = this.worldcupCrowd;
    if (!crowd) return;
    if (worldcupIsMatchPitchRoomId(this.roomId)) {
      crowd.setSideFlags(
        this.worldcupCrowdSideFlags?.a ?? null,
        this.worldcupCrowdSideFlags?.b ?? null
      );
    } else {
      crowd.setRosterFlags(this.worldcupCrowdRoster, this.worldcupCrowdFlag);
    }
  }

  // --- worldcup: Match Pitch view (spectator framing, goal arrow, orientation) ---

  private static normAddr(a: string): string {
    return a.replace(/\s+/g, "").toUpperCase();
  }

  /** worldcup: record the two Match participants so any other avatar in the pitch reads as a
   *  Spectator (and gets seated on the stands). Cheap; safe to call every `matchState`. */
  setWorldcupMatchParticipants(a: string | null, b: string | null): void {
    this.worldcupMatchParticipants.clear();
    if (a) this.worldcupMatchParticipants.add(Game.normAddr(a));
    if (b) this.worldcupMatchParticipants.add(Game.normAddr(b));
  }

  /** worldcup: true for an avatar that is in a Match Pitch but is not one of the two players. */
  private worldcupIsSpectatorAddr(addr: string): boolean {
    if (!WORLDCUP_ENABLED_CLIENT) return false;
    if (!worldcupIsMatchPitchRoomId(this.roomId)) return false;
    return !this.worldcupMatchParticipants.has(Game.normAddr(addr));
  }

  /** worldcup: seat a Spectator avatar on the front row of the nearest stand (visual only - the
   *  server keeps them at the touchline and excluded from the ball). */
  private worldcupSeatSpectator(g: THREE.Group, addr: string): void {
    if (!this.worldcupIsSpectatorAddr(addr)) return;
    const seat = worldcupFrontRowStandSeat(WORLDCUP_FIELD_BOUNDS, g.position.z);
    g.position.y = seat.y;
    g.position.z = seat.z;
  }

  /** worldcup: while spectating, frame the whole pitch at a locked zoom (set false to restore). */
  setWorldcupSpectatorView(active: boolean): void {
    if (active === this.worldcupSpectatorView) return;
    this.worldcupSpectatorView = active;
    if (active) {
      this.cameraLookAhead.set(0, 0, 0);
      // effectiveZoomMax frames the pitch's isometric diamond; lock there so watching is steady.
      this.setZoomLocked(true, this.effectiveZoomMax());
    } else {
      this.setZoomLocked(false);
    }
    this.applyCameraPose();
    this.requestRender();
  }

  /** worldcup: show a bobbing arrow above the goal the local Match player attacks (a = east net,
   *  b = west net); pass null to remove it (Spectators / off-match). */
  setWorldcupAttackGoal(side: "a" | "b" | null): void {
    if (side === this.worldcupGoalArrowSide) return;
    this.worldcupGoalArrowSide = side;
    if (this.worldcupGoalArrow) {
      this.scene.remove(this.worldcupGoalArrow.group);
      this.worldcupGoalArrow.dispose();
      this.worldcupGoalArrow = null;
    }
    if (!side || !WORLDCUP_ENABLED_CLIENT) return;
    const b = WORLDCUP_FIELD_BOUNDS;
    const x = side === "a" ? b.maxX + 0.5 : b.minX - 0.5;
    // Cyan matches the HUD "your score" highlight so the arrow reads as "yours".
    const arrow = new WorldcupGoalArrow(x, 0, 3.2, 0x18e0ff);
    this.scene.add(arrow.group);
    this.worldcupGoalArrow = arrow;
    this.requestRender(400);
  }

  /** worldcup: default the camera orientation on Match entry. Side a spawns on the west (the
   *  upper-left/NW corner of the default iso view) and attacks east; rotating their view 180°
   *  makes both players shoot toward the same screen direction. Still re-orbitable by the user. */
  setWorldcupMatchOrientation(side: "a" | "b" | null): void {
    const yaw = side === "a" ? Math.PI : 0;
    if (this.cameraOrbitYawRad === yaw) return;
    this.cameraOrbitYawRad = yaw;
    this.cameraOrbitEase = null;
    this.applyCameraPose();
    this.requestRender();
  }

  // --- worldcup: 1v1 spectate portals -------------------------------------

  /**
   * worldcup: when the local player stands on a spectate portal's footprint tile, return its
   * match id (and capacity flag) so the host can raise the "Watch" intent pill - mirroring
   * how `getStandingDoor` drives the door Enter pill. No teleport-on-click anymore.
   */
  getStandingSpectatePortal(): { matchId: string; full: boolean } | null {
    if (!WORLDCUP_ENABLED_CLIENT || !this.selfMesh) return null;
    if (this.worldcupPortals.size === 0) return null;
    const here = snapFloorTile(this.selfMesh.position.x, this.selfMesh.position.z);
    for (const [matchId, e] of this.worldcupPortals) {
      if (e.tileX === here.x && e.tileZ === here.y) return { matchId, full: e.full };
    }
    return null;
  }

  /** Replace all spectate portals (called from each room's welcome payload). */
  setWorldcupPortals(list: WorldcupPortalWire[]): void {
    this.clearWorldcupPortals();
    for (const p of list) this.addWorldcupPortal(p);
  }

  /** Spawn or refresh a single spectate portal. */
  addWorldcupPortal(p: WorldcupPortalWire): void {
    if (!WORLDCUP_ENABLED_CLIENT) return;
    const tile = snapFloorTile(p.x, p.z);
    const existing = this.worldcupPortals.get(p.matchId);
    if (existing) {
      existing.group.position.set(p.x, 0, p.z);
      existing.tileX = tile.x;
      existing.tileZ = tile.y;
      existing.full = !!p.full;
      this.refreshPortalLabel(existing.mat, p);
      return;
    }
    const group = new THREE.Group();
    group.position.set(p.x, 0, p.z);
    group.userData["worldcupPortalMatchId"] = p.matchId;
    group.add(this.createPortalPillarMesh(0, 0));
    const mat = new THREE.SpriteMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.renderOrder = 7;
    sprite.scale.set(2.4, 1.2, 1);
    sprite.position.set(0, 2.4, 0);
    group.add(sprite);
    this.scene.add(group);
    this.worldcupPortals.set(p.matchId, {
      group,
      mat,
      tileX: tile.x,
      tileZ: tile.y,
      full: !!p.full,
    });
    this.refreshPortalLabel(mat, p);
    this.markSceneMutation("worldcup:portal");
    this.requestRender(400);
  }

  /** Remove a single spectate portal (match ended or no longer present). */
  removeWorldcupPortal(matchId: string): void {
    const e = this.worldcupPortals.get(matchId);
    if (!e) return;
    this.scene.remove(e.group);
    this.disposeWorldcupPortal(e);
    this.worldcupPortals.delete(matchId);
    this.requestRender(200);
  }

  private clearWorldcupPortals(): void {
    if (this.worldcupPortals.size === 0) return;
    for (const e of this.worldcupPortals.values()) {
      this.scene.remove(e.group);
      this.disposeWorldcupPortal(e);
    }
    this.worldcupPortals.clear();
    this.requestRender(200);
  }

  private disposeWorldcupPortal(e: {
    group: THREE.Group;
    mat: THREE.SpriteMaterial;
  }): void {
    e.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose?.();
      const m = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
      else m?.dispose?.();
    });
    e.mat.map?.dispose();
    e.mat.dispose();
  }

  private refreshPortalLabel(mat: THREE.SpriteMaterial, p: WorldcupPortalWire): void {
    void this.buildPortalLabelTexture(p).then((tex) => {
      if (mat.map) mat.map.dispose();
      mat.map = tex;
      mat.needsUpdate = true;
      this.requestRender(200);
    });
  }

  /** "{flag}{identicon} vs {identicon}{flag}" label (with a FULL badge when at capacity). */
  private async buildPortalLabelTexture(
    p: WorldcupPortalWire
  ): Promise<THREE.CanvasTexture> {
    const w = 320;
    const h = 160;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    const r = 26;
    ctx.fillStyle = "rgba(18,20,28,0.93)";
    ctx.strokeStyle = "#18e0ff";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(r, 4);
    ctx.arcTo(w - 4, 4, w - 4, h - 4, r);
    ctx.arcTo(w - 4, h - 4, 4, h - 4, r);
    ctx.arcTo(4, h - 4, 4, 4, r);
    ctx.arcTo(4, 4, w - 4, 4, r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#eaf6ff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "600 22px system-ui, sans-serif";
    ctx.fillText("Watch 1v1", w / 2, 26);

    const loadImg = (url: string): Promise<HTMLImageElement> =>
      new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = rej;
        im.src = url;
      });
    const idSize = 64;
    const cy = 86;
    const draw = async (address: string, cx: number): Promise<void> => {
      try {
        const url = await identiconDataUrl(address);
        const img = await loadImg(url);
        ctx.drawImage(img, cx - idSize / 2, cy - idSize / 2, idSize, idSize);
      } catch {
        ctx.fillStyle = "#33384a";
        ctx.fillRect(cx - idSize / 2, cy - idSize / 2, idSize, idSize);
      }
    };
    await Promise.all([draw(p.aAddress, 86), draw(p.bAddress, w - 86)]);

    ctx.fillStyle = "#cfe9ff";
    ctx.font = "700 26px system-ui, sans-serif";
    ctx.fillText("vs", w / 2, cy);

    // Flags under each identicon (Twemoji images - Windows has no flag glyphs).
    const drawBillboardFlag = async (
      code: string | null,
      x: number
    ): Promise<void> => {
      const img = code ? await loadFlagImage(code) : null;
      if (img) {
        ctx.drawImage(img, x - 18, cy + 56 - 18, 36, 36);
      } else {
        ctx.font = "30px system-ui, 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("\u{1F3F3}", x, cy + 56);
      }
    };
    await Promise.all([
      drawBillboardFlag(p.aCountry, 86),
      drawBillboardFlag(p.bCountry, w - 86),
    ]);

    if (p.full) {
      ctx.fillStyle = "#ff8a8a";
      ctx.font = "700 20px system-ui, sans-serif";
      ctx.fillText("FULL", w / 2, h - 18);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  /** Per-frame ball interpolation (extrapolate by velocity, lerp, roll). Returns active. */
  private updateWorldcupBalls(dt: number): boolean {
    if (this.worldcupBalls.size === 0) return false;
    let active = false;
    const now = performance.now();
    const r = Game.WORLDCUP_BALL_RADIUS;
    for (const [id, mesh] of this.worldcupBalls) {
      const t = this.worldcupBallTargets.get(id);
      if (!t) continue;
      const ageSec = Math.min(0.25, (now - t.recvMs) * 0.001);
      const gx = t.x + t.vx * ageSec;
      const gz = t.z + t.vz * ageSec;
      const beforeX = mesh.position.x;
      const beforeZ = mesh.position.z;
      const k = 1 - Math.exp(-18 * dt);
      mesh.position.x += (gx - mesh.position.x) * k;
      mesh.position.z += (gz - mesh.position.z) * k;
      mesh.position.y = r;
      const moved = Math.hypot(
        mesh.position.x - beforeX,
        mesh.position.z - beforeZ
      );
      if (moved > 0.00025) {
        // Roll: rotate around the axis perpendicular to travel.
        const axisLen = Math.hypot(t.vx, t.vz);
        if (axisLen > 1e-4) {
          mesh.rotateOnWorldAxis(
            new THREE.Vector3(t.vz / axisLen, 0, -t.vx / axisLen),
            moved / r
          );
        }
        active = true;
      }
    }
    return active;
  }

  private updateMineableBlockSparkles(): boolean {
    const t = this.mineableSparkleAnimTime;
    const emissivePulse = 0.5 + 0.5 * Math.sin(t * 2.35);
    let any = false;
    for (const g of this.blockMeshes.values()) {
      const pts = g.userData["mineableSparklePoints"] as THREE.Points | undefined;
      if (!pts) continue;
      any = true;
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
    return any;
  }

  private updateSignpostHintSprites(): boolean {
    const t = this.mineableSparkleAnimTime;
    let any = false;
    const px = this.selfMesh?.position.x ?? this.cameraLookAt.x;
    const pz = this.selfMesh?.position.z ?? this.cameraLookAt.z;
    const build = this.buildMode;
    const docLoaded = this.signpostHintDocTexture !== null;
    const hoverFloor = this.signboardHoverFloorKey;
    const occlRootsBuf = this.signpostHintOcclBlkRoots;
    let occlRoots: THREE.Object3D[] | null = null;
    if (docLoaded && !build) {
      occlRootsBuf.length = 0;
      for (const rg of this.blockMeshes.values()) occlRootsBuf.push(rg);
      for (const im of this.plainCubeInstancedMeshes) occlRootsBuf.push(im);
      occlRoots = occlRootsBuf;
    }
    for (const g of this.blockMeshes.values()) {
      const sp = g.userData.signpostHintSprite as THREE.Sprite | undefined;
      if (!sp) continue;
      any = true;
      const mat = sp.material as THREE.SpriteMaterial;
      const baseY = g.userData.signpostHintBaseY as number;
      sp.position.y =
        baseY + Math.sin(t * 3.0) * Game.SIGNPOST_HINT_BOUNCE_AMP;
      if (!docLoaded) {
        mat.opacity = 0;
        continue;
      }
      const dx = g.position.x - px;
      const dz = g.position.z - pz;
      const dist = Math.hypot(dx, dz);
      const distFade = Math.max(0, Math.min(1, (10.5 - dist) / 8.5));
      const distMul = this.selfMesh ? distFade : 0.45 + 0.45 * distFade;
      if (build) {
        mat.opacity = 0;
      } else {
        const meshKey = g.userData.tileKey as string | undefined;
        let geoHidden = false;
        if (meshKey && this.isSignpostHintOccludedByStack(meshKey)) {
          geoHidden = true;
        } else if (occlRoots) {
          g.updateMatrixWorld(true);
          sp.getWorldPosition(this.signpostHintOcclHintW);
          geoHidden = this.isSignpostHintOccludedByForeground(
            g,
            this.signpostHintOcclHintW,
            occlRoots
          );
        }
        if (geoHidden) {
          mat.opacity = 0;
        } else {
          const pulse = 0.94 + 0.06 * Math.sin(t * 2.0);
          const floorK = meshKey
            ? this.floorTileKeyFromBlockMeshKey(meshKey)
            : null;
          const hovered =
            hoverFloor !== null && floorK !== null && floorK === hoverFloor;
          const idleOpacity = pulse * Math.max(0.22, distMul * 0.38);
          const hoverOpacity = pulse * Math.max(0.78, distMul);
          mat.opacity = hovered ? hoverOpacity : idleOpacity;
        }
      }
    }
    return any;
  }

  tick(dt: number): void {
    const renderNow = performance.now();
    let visualActive = false;

    this.doorPulseTime += dt;
    this.mineableSparkleAnimTime += dt;
    this.updateVoxelTextTween();
    this.updateAttentionMarkerMotion();

    if (this.selfMesh && this.selfTargetPos) {
      if (this.selfMoveOrder) {
        this.refreshSelfMoveOrderTarget();
      }
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
              const gw = this.pathGoalWorldXZ(pg);
              const gtx = gw.x - t.x;
              const gtz = gw.z - t.z;
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
          const cap = this.isWorldcupFreeMoveRoom()
            ? SELF_EXTRAP_MAX_OFFSET_XZ_FIELD
            : SELF_EXTRAP_MAX_OFFSET_XZ;
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

    this.maybeFirePendingGateAdjacentInteract();

    for (const addr of this.remoteMoveOrders.keys()) {
      this.refreshRemoteMoveOrderTarget(addr);
    }

    for (const [addr, g] of this.others) {
      const t = this.targetPos.get(addr);
      if (!t) continue;
      const beforeX = g.position.x;
      const beforeY = g.position.y;
      const beforeZ = g.position.z;
      g.position.lerp(t, 1 - Math.exp(-LERP * dt));
      // worldcup: lift Spectators out of the seating geometry onto the stand's front row.
      this.worldcupSeatSpectator(g, addr);
      visualActive =
        visualActive ||
        Math.hypot(g.position.x - beforeX, g.position.z - beforeZ) > 0.0005 ||
        Math.abs(g.position.y - beforeY) > 0.0005;
    }
    // worldcup: the local player, when spectating, is also seated on the stands.
    if (this.selfMesh && this.worldcupSpectatorView) {
      this.worldcupSeatSpectator(this.selfMesh, this.selfAddress);
    }

    // worldcup: interpolate soccer balls
    if (this.updateWorldcupBalls(dt)) visualActive = true;
    if (this.updateWorldcupGoalies(dt)) visualActive = true;

    // worldcup: animate the cheering stadium crowd
    if (this.worldcupCrowd && this.worldcupCrowd.update(dt)) visualActive = true;
    // worldcup: bob/spin the attacking-goal arrow for the local Match player.
    if (this.worldcupGoalArrow && this.worldcupGoalArrow.update(dt)) {
      visualActive = true;
    }
    if (this.updateCosmeticGallery(dt)) visualActive = true;
    if (this.updateAvatarCosmeticTrails(renderNow)) visualActive = true;

    const orbitWasActive = this.cameraOrbitEase !== null;
    this.updateCameraOrbitEase();
    visualActive = visualActive || orbitWasActive || this.cameraOrbitEase !== null;
    this.updateStreamCameraAnims();
    this.updateStreamCameraFollow(dt);
    this.updateStreamPan(dt);
    this.maybeReportViewInterest();
    this.refreshPathLine();
    visualActive =
      visualActive ||
      this.pathGoal !== null ||
      this.pathPreviewGoal !== null ||
      this.pathFadingOut ||
      this.trailFadingOut ||
      this.floatingTexts.size > 0 ||
      this.achievementCelebrationSprites.length > 0;
    this.updatePathFade(dt);

    const px = this.selfMesh
      ? this.selfMesh.position.x
      : this.cameraLookAt.x;
    const pz = this.selfMesh
      ? this.selfMesh.position.z
      : this.cameraLookAt.z;
    this.fogOfWar.setPlayerPosition(px, pz);

    if (!this.streamBubblesHidden) {
      this.updateChatBubbles();
      this.updateAchievementCelebrations(renderNow);
    }
    this.updateTypingIndicatorAnimation();
    this.updateFloatingTexts();
    this.syncRoomEntrySpawnMarker(renderNow * 0.001);
    this.syncTutorialMineHighlight(renderNow * 0.001);

    const hasMineableSparkles = this.updateMineableBlockSparkles();
    const hasSignpostHintMotion = this.updateSignpostHintSprites();
    const hasTutorialMineHighlight = this.tutorialMineHighlightTile !== null;
    if (visualActive || hasMineableSparkles || hasSignpostHintMotion || hasTutorialMineHighlight) {
      this.requestRender(250);
    }
    if (visualActive) {
      this.animateDoorTiles();
    }

    if (this.renderDirty || renderNow < this.continuousRenderUntilMono || this.continuousRenderForced) {
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
    const targetX = this.cameraLookAt.x + this.cameraLookAhead.x;
    const targetY = this.cameraLookAt.y + this.cameraLookAhead.y;
    const targetZ = this.cameraLookAt.z + this.cameraLookAhead.z;

    if (this.streamPresentationActive) {
      const blend = this.streamCameraPoseBlend;

      if (blend <= 0) {
        this.camera.position.set(
          targetX,
          targetY + STREAM_CAMERA_HEIGHT,
          targetZ
        );
        this.camera.up.set(0, 0, -1);
        this.camera.lookAt(targetX, targetY, targetZ);
        return;
      }

      const topX = targetX;
      const topY = targetY + STREAM_CAMERA_HEIGHT;
      const topZ = targetZ;

      const v = this.cameraOrbitOffsetScratch
        .copy(this.cameraOffsetBase)
        .applyAxisAngle(this.worldUp, this.cameraOrbitYawRad);
      const isoX = this.cameraLookAt.x + v.x + this.cameraLookAhead.x;
      const isoY = this.cameraLookAt.y + v.y + this.cameraLookAhead.y;
      const isoZ = this.cameraLookAt.z + v.z + this.cameraLookAhead.z;

      if (blend >= 1) {
        this.camera.up.copy(this.worldUp);
        this.camera.position.set(isoX, isoY, isoZ);
        this.camera.lookAt(targetX, targetY, targetZ);
        return;
      }

      this.camera.position.set(
        topX + (isoX - topX) * blend,
        topY + (isoY - topY) * blend,
        topZ + (isoZ - topZ) * blend
      );
      this.streamTopDownUpScratch.set(0, 0, -1);
      this.camera.up
        .copy(this.streamTopDownUpScratch)
        .lerp(this.worldUp, blend)
        .normalize();
      this.camera.lookAt(targetX, targetY, targetZ);
      return;
    }

    this.camera.up.copy(this.worldUp);
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

  private updateStreamCameraAnims(): void {
    const now = performance.now();
    if (this.zoomFrustumAnim) {
      const a = this.zoomFrustumAnim;
      const t = Math.min(1, (now - a.startedAtMs) / a.durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      this.frustumSize = a.from + (a.to - a.from) * eased;
      this.applyOrthographicFrustum();
      this.refreshAllNameLabelScales();
      this.refreshChatBubbleVerticalPositions();
      this.refreshWorldcupChallengeBubbleLayouts();
      this.refreshAllTypingIndicatorLayouts();
      if (t >= 1) {
        this.zoomFrustumAnim = null;
        this.finishTelescopeReturnZoomAnim();
      }
      this.requestRender();
    }
    if (this.lookAtAnim) {
      const a = this.lookAtAnim;
      const t = Math.min(1, (now - a.startedAtMs) / a.durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      this.cameraLookAt.set(
        a.fromX + (a.toX - a.fromX) * eased,
        a.fromY + (a.toY - a.fromY) * eased,
        a.fromZ + (a.toZ - a.fromZ) * eased
      );
      this.applyCameraPose();
      if (this.streamPresentationActive || this.roomNeedsFrustumFit()) {
        this.applyOrthographicFrustum();
      }
      if (t >= 1) this.lookAtAnim = null;
      this.requestRender();
    }
    if (this.streamCameraPoseAnim) {
      const a = this.streamCameraPoseAnim;
      const t = Math.min(1, (now - a.startedAtMs) / a.durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      this.streamCameraPoseBlend = a.from + (a.to - a.from) * eased;
      this.applyCameraPose();
      this.applyOrthographicFrustum();
      this.applyIdenticonTransformToAllAvatars();
      this.refreshChatBubbleVerticalPositions();
      this.refreshWorldcupChallengeBubbleLayouts();
      this.refreshAllTypingIndicatorLayouts();
      if (t >= 1) this.streamCameraPoseAnim = null;
      this.requestRender();
    }
  }

  private updateStreamCameraFollow(dt: number): void {
    if (this.streamCameraMode === "followSelf") {
      this.updateCameraFollow(dt);
      return;
    }
    if (this.streamCameraMode === "detached") {
      return;
    }
    const addr = this.streamFollowAddress;
    if (!addr) return;
    const g = this.others.get(addr);
    const t = this.targetPos.get(addr);
    if (!g && !t) return;
    const px = t?.x ?? g!.position.x;
    const py = t?.y ?? g!.position.y;
    const pz = t?.z ?? g!.position.z;
    const alpha = 1 - Math.exp(-this.cameraFollowSmoothing * dt);
    this.cameraLookAt.x += (px - this.cameraLookAt.x) * alpha;
    this.cameraLookAt.y += (py - this.cameraLookAt.y) * alpha;
    this.cameraLookAt.z += (pz - this.cameraLookAt.z) * alpha;
    this.applyCameraPose();
    if (this.streamPresentationActive || this.roomNeedsFrustumFit()) {
      this.applyOrthographicFrustum();
    }
  }

  /** Pans only when the local player nears the edge of the dead zone (soft follow). */
  private updateCameraFollow(dt: number): void {
    if (!this.selfMesh || !this.cameraFollowReady) return;
    // worldcup: a Spectator's camera centers on the pitch (not their stand seat) so the locked
    // frame shows the whole field.
    if (this.worldcupSpectatorView) {
      const b = WORLDCUP_FIELD_BOUNDS;
      const cx = (b.minX + b.maxX) / 2;
      const cz = (b.minZ + b.maxZ) / 2;
      this.cameraLookAhead.set(0, 0, 0);
      const a = 1 - Math.exp(-this.cameraFollowSmoothing * dt);
      this.cameraLookAt.x += (cx - this.cameraLookAt.x) * a;
      this.cameraLookAt.y += (0 - this.cameraLookAt.y) * a;
      this.cameraLookAt.z += (cz - this.cameraLookAt.z) * a;
      this.applyCameraPose();
      return;
    }
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
    if (this.streamPresentationActive || this.roomNeedsFrustumFit()) {
      this.applyOrthographicFrustum();
    }
  }

  /** Shows a short-lived speech bubble above the player (used for chat). */
  setSelfCosmeticPreviewSlot(
    slot: "aura" | "nameplate" | "chatBubble" | "trail",
    presetId: string | null
  ): void {
    if (slot === "aura") this.selfCosmeticPreview.aura = presetId;
    else if (slot === "nameplate") this.selfCosmeticPreview.nameplate = presetId;
    else if (slot === "chatBubble") this.selfCosmeticPreview.chatBubble = presetId;
    else this.selfCosmeticPreview.trail = presetId;
  }

  revertSelfCosmeticPreviewSlot(
    slot: "aura" | "nameplate" | "chatBubble" | "trail"
  ): void {
    if (slot === "aura") delete this.selfCosmeticPreview.aura;
    else if (slot === "nameplate") delete this.selfCosmeticPreview.nameplate;
    else if (slot === "chatBubble") delete this.selfCosmeticPreview.chatBubble;
    else delete this.selfCosmeticPreview.trail;
  }

  clearSelfCosmeticPreview(): void {
    this.selfCosmeticPreview = {};
  }

  refreshSelfCosmeticsFromState(p: PlayerState): void {
    if (!this.selfMesh) return;
    const effective = this.withSelfCosmeticPreview(p);
    this.syncAvatarNameLabelFromState(this.selfMesh, effective);
    syncCosmeticLoadoutVfx(
      this.selfMesh,
      effective,
      this.playerMovedRecently(p.address, p.x, p.z)
    );
    this.markSceneMutation("cosmeticPreview");
  }

  private withSelfCosmeticPreview(p: PlayerState): PlayerState {
    const out = { ...p };
    // Wardrobe preview first, then the persistent gallery try-on wins (it survives world
    // interactions that clear the wardrobe preview).
    if (this.selfCosmeticPreview.aura !== undefined) {
      out.cosmeticAura = this.selfCosmeticPreview.aura;
    }
    if (this.selfCosmeticPreview.nameplate !== undefined) {
      out.cosmeticNameplate = this.selfCosmeticPreview.nameplate;
    }
    if (this.selfCosmeticPreview.chatBubble !== undefined) {
      out.cosmeticChatBubble = this.selfCosmeticPreview.chatBubble;
    }
    if (this.selfCosmeticPreview.trail !== undefined) {
      out.cosmeticTrail = this.selfCosmeticPreview.trail;
    }
    if (this.galleryTryOnSlots.aura !== undefined) {
      out.cosmeticAura = this.galleryTryOnSlots.aura;
    }
    if (this.galleryTryOnSlots.nameplate !== undefined) {
      out.cosmeticNameplate = this.galleryTryOnSlots.nameplate;
    }
    if (this.galleryTryOnSlots.chatBubble !== undefined) {
      out.cosmeticChatBubble = this.galleryTryOnSlots.chatBubble;
    }
    if (this.galleryTryOnSlots.trail !== undefined) {
      out.cosmeticTrail = this.galleryTryOnSlots.trail;
    }
    return out;
  }

  /** Room-scoped Achievement Unlock Celebration (trophy pop above an avatar). */
  showAchievementCelebration(address: string): void {
    if (this.streamBubblesHidden) return;
    const key = this.compactWalletKey(address);
    if (!key) return;
    const now = performance.now();
    const delay = nextCelebrationDelayMs(this.achievementCelebrationPlayAt, key, now);
    const timer = setTimeout(() => {
      this.achievementCelebrationStaggerTimers.delete(timer);
      this.spawnAchievementCelebration(key);
    }, delay);
    this.achievementCelebrationStaggerTimers.add(timer);
  }

  showChatBubble(
    fromAddress: string,
    text: string,
    displayNameFallback?: string
  ): void {
    if (this.streamBubblesHidden) return;
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
    // A sole country flag (the Flag Emote) gets the larger emoji-bubble treatment and renders
    // as a Twemoji image; otherwise fall back to the usual emoji-only heuristic.
    const flagCode = soleFlagCode(text);
    const emojiOnly = flagCode ? true : isEmojiOnlyBubbleText(text);
    const bubblePreset =
      (g.userData.cosmeticChatBubble as string | null | undefined) ?? null;
    const { sprite, texture, width, height } = createChatBubbleSprite(text, {
      emojiOnly,
      flagCode,
      bubblePreset,
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

  /**
   * Shared sprite spawn for {@link showFloatingText} plain text and self-player action messages.
   */
  private addFloatingTextFromCanvas(
    mapKey: string,
    x: number,
    z: number,
    canvas: HTMLCanvasElement,
    durationMs: number,
    motion: "classic" | "spring",
    screenHeightPx: number,
    miningReward?: FloatingTextEntry["miningReward"],
    avatarGroup?: THREE.Group | null
  ): void {
    const w = canvas.width;
    const h = canvas.height;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
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
    if (avatarGroup) {
      avatarGroup.add(sprite);
    } else {
      sprite.position.set(x, startY, z);
    }

    const entry: FloatingTextEntry = {
      sprite,
      material,
      texture,
      startedAt: performance.now(),
      startY,
      durationMs,
      verticalMotion: motion,
      texWidth: w,
      texHeight: h,
      screenHeightPx,
      avatarGroup: avatarGroup ?? undefined,
      miningReward,
    };
    this.syncFloatingTextScale(entry);
    if (avatarGroup) {
      this.syncAvatarAttachedFloatingTextPosition(entry);
      entry.startY = entry.sprite.position.y;
    }

    if (!avatarGroup) {
      this.scene.add(sprite);
    }

    this.floatingTexts.set(mapKey, entry);
  }

  /** Plain floating label (no NIM logo); `mapKey` must be unique unless intentionally replacing a slot. */
  private spawnPlainFloatingTextAt(
    mapKey: string,
    x: number,
    z: number,
    label: string,
    color: string,
    verticalMotion: "classic" | "spring",
    emphasis = false
  ): void {
    const { canvas, screenHeightPx } = rasterPlainFloatingCanvas(
      label,
      color,
      emphasis
    );
    const dur =
      verticalMotion === "spring"
        ? FLOATING_SPRING_DURATION_MS
        : FLOATING_REWARD_DEFAULT_DURATION_MS;
    this.addFloatingTextFromCanvas(
      mapKey,
      x,
      z,
      canvas,
      dur,
      verticalMotion,
      screenHeightPx
    );
  }

  private removeFloatingTextEntry(key: string): void {
    const entry = this.floatingTexts.get(key);
    if (!entry) return;
    entry.sprite.removeFromParent();
    entry.texture.dispose();
    entry.material.dispose();
    this.floatingTexts.delete(key);
  }

  /**
   * Local-player action feedback using the same world **floating text** as mining rewards and
   * gate denial (`showFloatingText`). Only one such message at a time: a new call removes the
   * current one immediately and shows the new text (no overlap; rapid calls always show the latest).
   */
  showSelfPlayerActionMessage(text: string): void {
    if (!this.selfMesh) return;
    const trimmed = text.trim().slice(0, 200);
    if (!trimmed) return;
    if (this.floatingTexts.has(SELF_PLAYER_ACTION_FLOAT_KEY)) {
      this.removeFloatingTextEntry(SELF_PLAYER_ACTION_FLOAT_KEY);
    }
    const { x, z } = this.selfMesh.position;
    this.spawnPlainFloatingTextAt(
      SELF_PLAYER_ACTION_FLOAT_KEY,
      x,
      z,
      trimmed,
      "#ffc107",
      "spring"
    );
    this.requestRender(250);
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
   * Shows a floating text popup at a world position (e.g., NIM logo + `1.23NIM` on mine).
   * Mining rewards (`nimLogo`) use Fira Mono, screen-fixed scale, and zoom-adaptive layout.
   */
  showFloatingText(
    x: number,
    z: number,
    text: string,
    color = MINING_REWARD_FLOAT_COLOR,
    opts?: {
      nimLogo?: boolean;
      /** Default: spring for plain text, classic when `nimLogo` is true. */
      verticalMotion?: "classic" | "spring";
      /** Slightly larger plain label (screen-fixed). */
      plainEmphasis?: boolean;
    }
  ): void {
    const key = `${x},${z},${Date.now()}`;
    const nimLogo = Boolean(opts?.nimLogo);
    const plainEmphasis = Boolean(opts?.plainEmphasis);
    const verticalMotion =
      opts?.verticalMotion ?? (nimLogo ? "classic" : "spring");

    const drawPlain = (): void => {
      const label = nimLogo
        ? text.replace(/\s*NIM\s*$/i, "").trim()
        : text;
      const { canvas, screenHeightPx } = rasterPlainFloatingCanvas(
        label,
        color,
        plainEmphasis
      );
      const dur =
        verticalMotion === "spring"
          ? FLOATING_SPRING_DURATION_MS
          : FLOATING_REWARD_DEFAULT_DURATION_MS;
      this.addFloatingTextFromCanvas(
        key,
        x,
        z,
        canvas,
        dur,
        verticalMotion,
        screenHeightPx
      );
    };

    if (!nimLogo) {
      drawPlain();
      return;
    }

    const amount = parseMiningRewardAmount(text);
    if (!amount) {
      drawPlain();
      return;
    }

    const spawnMining = (): void => {
      const { canvas, screenHeightPx } = rasterMiningRewardFloatingCanvas(
        amount,
        color
      );
      this.addFloatingTextFromCanvas(
        key,
        x,
        z,
        canvas,
        FLOATING_REWARD_MINING_DURATION_MS,
        verticalMotion,
        screenHeightPx,
        { amount, color }
      );
      this.requestRender(250);
    };

    spawnMining();
  }

  /**
   * Mining payout floater above the local player's avatar (NIM logo + two-decimal amount).
   */
  showSelfPlayerMiningReward(
    amount: string,
    color = MINING_REWARD_FLOAT_COLOR
  ): void {
    if (!this.selfMesh) return;
    const trimmed = amount.trim();
    if (!/^\d+\.\d+$/.test(trimmed)) return;
    const key = `__self_mining_reward__${Date.now()}`;
    const { canvas, screenHeightPx } = rasterMiningRewardFloatingCanvas(
      trimmed,
      color
    );
    this.addFloatingTextFromCanvas(
      key,
      0,
      0,
      canvas,
      FLOATING_REWARD_MINING_DURATION_MS,
      "classic",
      screenHeightPx,
      { amount: trimmed, color },
      this.selfMesh
    );
    this.requestRender(250);
  }

  private updateFloatingTexts(): void {
    const now = performance.now();
    const riseDistanceClassic = 2.0;

    for (const [key, entry] of this.floatingTexts) {
      const duration = entry.durationMs;
      const elapsed = now - entry.startedAt;

      if (elapsed >= duration) {
        this.removeFloatingTextEntry(key);
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
      const avatarTop = this.avatarIdenticonWorldDiameter();
      const gapAbove = this.pixelToWorldY(4);
      entry.sprite.position.y = avatarTop + gapAbove + worldH * 0.5;
    }
    entry.sprite.position.x = 0;
  }

  private syncTypingIndicatorForGroup(g: THREE.Group, p: PlayerState): void {
    const addr = p.address;
    if (this.streamBubblesHidden) {
      this.removeTypingIndicator(addr);
      return;
    }
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

  // ---- worldcup: floating 1v1 Challenge badge (shared texture, one sprite per player) ----

  private clearAchievementCelebrations(): void {
    for (const timer of this.achievementCelebrationStaggerTimers) {
      clearTimeout(timer);
    }
    this.achievementCelebrationStaggerTimers.clear();
    this.achievementCelebrationPlayAt.clear();
    for (const entry of this.achievementCelebrationSprites) {
      disposeAchievementCelebrationSprite(entry, this.achievementCelebrationTexture);
    }
    this.achievementCelebrationSprites.length = 0;
  }

  private compactWalletKey(address: string): string {
    return address.replace(/\s+/g, "").trim().toUpperCase();
  }

  private avatarGroupForAddress(address: string): THREE.Group | null {
    const key = this.compactWalletKey(address);
    if (!key) return null;
    if (this.selfMesh && this.compactWalletKey(this.selfAddress) === key) {
      return this.selfMesh;
    }
    for (const [addr, g] of this.others) {
      if (this.compactWalletKey(addr) === key) return g;
    }
    return null;
  }

  private achievementCelebrationLayout(): AchievementCelebrationLayout {
    const worldSize = this.pixelToWorldY(
      ACHIEVEMENT_CELEBRATION_ICON_SCREEN_HEIGHT_PX
    );
    const avatarTop = this.avatarIdenticonWorldDiameter();
    const gapAbove = this.pixelToWorldY(4);
    const baseY = avatarTop + gapAbove + worldSize * 0.5;
    return { worldSize, baseY };
  }

  private refreshAchievementCelebrationLayouts(now = performance.now()): void {
    if (this.achievementCelebrationSprites.length === 0) return;
    const layout = this.achievementCelebrationLayout();
    for (const entry of this.achievementCelebrationSprites) {
      updateAchievementCelebrationSprite(entry, now, layout);
    }
  }

  private spawnAchievementCelebration(addressKey: string): void {
    if (this.streamBubblesHidden) return;
    const g = this.avatarGroupForAddress(addressKey);
    if (!g) return;
    const tex =
      this.achievementCelebrationTexture ?? getAchievementCelebrationTexture();
    if (!tex) {
      void ensureAchievementCelebrationTexture().then((loaded) => {
        this.achievementCelebrationTexture = loaded;
        this.spawnAchievementCelebration(addressKey);
      });
      return;
    }
    this.achievementCelebrationTexture = tex;
    const layout = this.achievementCelebrationLayout();
    const now = performance.now();
    const entry = spawnAchievementCelebrationSprite(
      tex,
      layout,
      addressKey,
      ++this.achievementCelebrationNextId,
      now
    );
    g.add(entry.sprite);
    this.achievementCelebrationSprites.push(entry);
    updateAchievementCelebrationSprite(entry, now, layout);
    this.requestRender(ACHIEVEMENT_CELEBRATION_DURATION_MS + 100);
  }

  private updateAchievementCelebrations(now: number): void {
    if (this.achievementCelebrationSprites.length === 0) return;
    let active = false;
    for (let i = this.achievementCelebrationSprites.length - 1; i >= 0; i--) {
      const entry = this.achievementCelebrationSprites[i]!;
      const g = this.avatarGroupForAddress(entry.address);
      if (!g || entry.sprite.parent !== g) {
        disposeAchievementCelebrationSprite(
          entry,
          this.achievementCelebrationTexture
        );
        this.achievementCelebrationSprites.splice(i, 1);
        continue;
      }
      if (updateAchievementCelebrationSprite(
        entry,
        now,
        this.achievementCelebrationLayout()
      )) {
        active = true;
      } else {
        disposeAchievementCelebrationSprite(
          entry,
          this.achievementCelebrationTexture
        );
        this.achievementCelebrationSprites.splice(i, 1);
      }
    }
    if (active) this.requestRender(50);
  }

  private static readonly CHALLENGE_BUBBLE_CANVAS = { w: 256, h: 96 } as const;
  /** On-screen height for Challenge badges (matches chat-bubble zoom compensation). */
  private static readonly CHALLENGE_BUBBLE_SCREEN_HEIGHT_PX = 34;
  /** Wider badge with the accept tick drawn inside, to the right of the label. */
  private static readonly CHALLENGE_BUBBLE_ACCEPT_CANVAS = {
    w: 340,
    h: 96,
    tickCx: 286,
    tickCy: 41,
    tickR: 26,
  } as const;

  private drawWorldcupChallengeAcceptTick(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number
  ): void {
    ctx.fillStyle = "#22c55e";
    ctx.strokeStyle = "#14532d";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(6, Math.round(r * 0.32));
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.62, cy + r * 0.06);
    ctx.lineTo(cx - r * 0.12, cy + r * 0.58);
    ctx.lineTo(cx + r * 0.78, cy - r * 0.52);
    ctx.stroke();
  }

  private worldcupChallengeBubbleTexture(): THREE.CanvasTexture {
    if (this.worldcupChallengeBubbleTex) return this.worldcupChallengeBubbleTex;
    const w = Game.CHALLENGE_BUBBLE_CANVAS.w;
    const h = Game.CHALLENGE_BUBBLE_CANVAS.h;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    const r = 22;
    ctx.fillStyle = "rgba(20,22,30,0.92)";
    ctx.strokeStyle = "#18e0ff";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(r + 3, 6);
    ctx.arcTo(w - 3, 6, w - 3, h - 16, r);
    ctx.arcTo(w - 3, h - 16, 3, h - 16, r);
    ctx.arcTo(3, h - 16, 3, 6, r);
    ctx.arcTo(3, 6, w - 3, 6, r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Little pointer toward the player below.
    ctx.fillStyle = "rgba(20,22,30,0.92)";
    ctx.beginPath();
    ctx.moveTo(w / 2 - 12, h - 17);
    ctx.lineTo(w / 2 + 12, h - 17);
    ctx.lineTo(w / 2, h - 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#eaf6ff";
    ctx.font = "bold 44px system-ui, 'Segoe UI Emoji', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("\u26BD 1v1?", w / 2, (h - 14) / 2 + 4);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    this.worldcupChallengeBubbleTex = tex;
    return tex;
  }

  private worldcupChallengeBubbleAcceptTexture(): THREE.CanvasTexture {
    if (this.worldcupChallengeBubbleAcceptTex) return this.worldcupChallengeBubbleAcceptTex;
    const { w, h, tickCx, tickCy, tickR } = Game.CHALLENGE_BUBBLE_ACCEPT_CANVAS;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    const r = 22;
    ctx.fillStyle = "rgba(20,22,30,0.92)";
    ctx.strokeStyle = "#18e0ff";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(r + 3, 6);
    ctx.arcTo(w - 3, 6, w - 3, h - 16, r);
    ctx.arcTo(w - 3, h - 16, 3, h - 16, r);
    ctx.arcTo(3, h - 16, 3, 6, r);
    ctx.arcTo(3, 6, w - 3, 6, r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(20,22,30,0.92)";
    ctx.beginPath();
    ctx.moveTo(w / 2 - 12, h - 17);
    ctx.lineTo(w / 2 + 12, h - 17);
    ctx.lineTo(w / 2, h - 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#eaf6ff";
    ctx.font = "bold 44px system-ui, 'Segoe UI Emoji', sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("\u26BD 1v1?", 22, (h - 14) / 2 + 4);
    this.drawWorldcupChallengeAcceptTick(ctx, tickCx, tickCy, tickR);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    this.worldcupChallengeBubbleAcceptTex = tex;
    return tex;
  }

  private removeWorldcupChallengeBubble(addr: string): void {
    const sprite = this.worldcupChallengeBubbles.get(addr);
    if (!sprite) return;
    sprite.removeFromParent();
    const sm = sprite.material as THREE.SpriteMaterial;
    // The badge texture is shared across players + reused - never dispose it here.
    sm.map = null;
    sm.dispose();
    delete sprite.userData["challengeAcceptAddress"];
    this.worldcupChallengeBubbles.delete(addr);
  }

  private layoutWorldcupChallengeBubbleSprites(
    bubble: THREE.Sprite,
    withAccept: boolean
  ): void {
    const canvas = withAccept
      ? Game.CHALLENGE_BUBBLE_ACCEPT_CANVAS
      : Game.CHALLENGE_BUBBLE_CANVAS;
    const worldH = this.pixelToWorldY(Game.CHALLENGE_BUBBLE_SCREEN_HEIGHT_PX);
    const mainW = worldH * (canvas.w / canvas.h);
    bubble.scale.set(mainW, worldH, 1);
    const avatarTop = this.avatarIdenticonWorldDiameter();
    const centerY = avatarTop + this.pixelToWorldY(30) + worldH * 0.5;
    bubble.position.set(0, centerY, 0);
  }

  private syncWorldcupChallengeBubble(g: THREE.Group, p: PlayerState): void {
    const addr = p.address;
    // Stamp the flag on the avatar so the right-click picker can offer "Accept 1v1".
    g.userData["challengeOpen"] = !!p.challengeOpen;
    if (!WORLDCUP_ENABLED_CLIENT || !p.challengeOpen || this.streamBubblesHidden) {
      this.removeWorldcupChallengeBubble(addr);
      return;
    }
    let sprite = this.worldcupChallengeBubbles.get(addr);
    const isSelf =
      this.compactWalletKey(addr) === this.compactWalletKey(this.selfAddress);
    const withAccept = !isSelf;
    if (!sprite) {
      const mat = new THREE.SpriteMaterial({
        map: withAccept
          ? this.worldcupChallengeBubbleAcceptTexture()
          : this.worldcupChallengeBubbleTexture(),
        transparent: true,
        depthWrite: false,
        depthTest: false,
      });
      sprite = new THREE.Sprite(mat);
      sprite.renderOrder = 6;
      sprite.raycast = () => {};
      sprite.userData["skipBlockPickAndBounds"] = true;
      g.add(sprite);
      this.worldcupChallengeBubbles.set(addr, sprite);
    }
    if (withAccept) {
      sprite.userData["challengeAcceptAddress"] = addr;
    } else {
      delete sprite.userData["challengeAcceptAddress"];
    }
    this.layoutWorldcupChallengeBubbleSprites(sprite, withAccept);
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
    away: boolean,
    nameplatePreset?: string | null
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
      { away, borderColor: nameplateColorForPreset(nameplatePreset) ?? undefined }
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
    const state = `${away ? 1 : 0}\0${name}\0${p.cosmeticNameplate ?? ""}`;
    if (g.userData.nameLabelSyncState === state) {
      return;
    }
    g.userData.nameLabelSyncState = state;
    g.userData.displayName = name;
    this.replaceAvatarNameLabel(g, name, away, p.cosmeticNameplate);
    this.syncNameLabelScaleAndPosition(g);
  }

  private disposeAvatarGroup(g: THREE.Group): void {
    const addr = g.userData.address as string | undefined;
    if (addr) this.removeChatBubbleEntry(addr);
    if (addr) this.removeTypingIndicator(addr);
    if (addr) this.removeWorldcupChallengeBubble(addr);
    disposeCosmeticTrailPuffs(g);
    g.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh) {
        const mat = child.material as THREE.MeshStandardMaterial;
        if (mat.map && !isCachedIdenticonTexture(mat.map)) mat.map.dispose();
        child.geometry.dispose();
        mat.dispose();
      }
      if (child instanceof THREE.Sprite) {
        const sm = child.material as THREE.SpriteMaterial;
        if (sm.map && !isCachedIdenticonTexture(sm.map)) sm.map.dispose();
        sm.dispose();
      }
    });
  }

  private makeAvatar(address: string, displayName?: string): THREE.Group {
    const g = new THREE.Group();
    g.userData.address = address;
    g.userData.displayName = displayName ?? "";
    const d = this.avatarIdenticonWorldDiameter();
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
    body.position.y = d / 2;
    body.rotation.copy(this.getIdenticonEuler());
    g.userData.identiconMesh = body;
    g.add(body);

    const applyIdenticonTexture = (tex: THREE.CanvasTexture): void => {
      if (g.userData["address"] !== address) return;
      mat.map = tex;
      mat.color.setHex(0xffffff);
      mat.needsUpdate = true;
      if (this.wardrobeAvatarPreviewPort?.avatarGroup === g) {
        this.renderWardrobeAvatarPreview();
      }
    };

    const cached = peekIdenticonTexture(address);
    if (cached) {
      applyIdenticonTexture(cached);
    } else {
      void loadIdenticonTexture(address)
        .then((tex) => {
          if (g.userData["address"] !== address) return;
          applyIdenticonTexture(tex);
        })
        .catch(() => {
          /* Invalid / non-wallet ids (e.g. server NPCs) keep the placeholder material. */
        });
    }

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

  private disposeInspectorPreviewSubtree(root: THREE.Object3D): void {
    root.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Points) {
        child.geometry.dispose();
        const m = child.material;
        if (Array.isArray(m)) {
          for (const mm of m) m.dispose();
        } else {
          (m as THREE.Material).dispose();
        }
      }
    });
  }

  private disposeInspectorPreviewBlockChildren(
    port: InspectorTilePreviewPort
  ): void {
    while (port.blockSlot.children.length > 0) {
      const c = port.blockSlot.children[0]!;
      port.blockSlot.remove(c);
      this.disposeInspectorPreviewSubtree(c);
    }
  }

  private resetInspectorPreviewBlockSlot(port: InspectorTilePreviewPort): void {
    this.disposeInspectorPreviewBlockChildren(port);
    port.lastSig = "";
  }

  /** Swap a preview canvas for a fresh element so a new WebGL context can bind. */
  private recycleInspectorPreviewCanvas(
    canvas: HTMLCanvasElement
  ): HTMLCanvasElement {
    const fresh = document.createElement("canvas");
    if (canvas.id) fresh.id = canvas.id;
    fresh.className = canvas.className;
    fresh.width = canvas.width;
    fresh.height = canvas.height;
    const ariaHidden = canvas.getAttribute("aria-hidden");
    if (ariaHidden != null) fresh.setAttribute("aria-hidden", ariaHidden);
    canvas.replaceWith(fresh);
    return fresh;
  }

  private disposeInspectorTilePreviewPort(port: InspectorTilePreviewPort): void {
    port.resizeObserver.disconnect();
    this.resetInspectorPreviewBlockSlot(port);
    port.renderer.dispose();
    // Release the WebGL context (not just GPU resources) so rebinding preview
    // canvases does not leak contexts toward the browser's per-page limit.
    if (typeof port.renderer.forceContextLoss === "function") {
      port.renderer.forceContextLoss();
    }
    port.scene.clear();
    // forceContextLoss leaves the canvas unusable until it is replaced; the slot
    // stays in the dock so the next bind must get a fresh surface.
    this.recycleInspectorPreviewCanvas(port.canvas);
  }

  private inspectorTilePreviewSignature(meta: BlockStyleProps): string {
    const rot = cubeRotationForPlainCube(
      {
        hex: meta.hex,
        pyramid: meta.pyramid,
        sphere: meta.sphere,
        ramp: meta.ramp,
      },
      meta
    );
    return `${meta.half}|${meta.quarter}|${meta.hex}|${meta.pyramid}|${meta.pyramidBaseScale ?? 1}|${meta.hexRadiusScale ?? 1}|${meta.sphere}|${meta.sphereRadiusScale ?? 1}|${meta.ramp}|${meta.rampDir}|${rot.cubeRotX}|${rot.cubeRotY}|${rot.cubeRotZ}|${meta.colorRgb}|${Boolean(meta.claimable)}|${meta.active ? 1 : 0}|${JSON.stringify(meta.gate ?? null)}|${this.blockVisualScale}|${this.floorTileQuadSize}`;
  }

  private applyInspectorPreviewFloorPortalGlow(
    port: InspectorTilePreviewPort,
    portalGlow: boolean
  ): void {
    const mat = port.floor.material;
    if (!(mat instanceof THREE.MeshStandardMaterial)) return;
    if (portalGlow) {
      mat.color.setHex(TERRAIN_TILE_DOOR_COLOR);
      mat.roughness = 0.3;
      mat.metalness = 0.5;
      mat.emissive.setHex(TERRAIN_TILE_DOOR_EMISSIVE);
      mat.emissiveIntensity = TERRAIN_TILE_DOOR_EMISSIVE_INTENSITY;
    } else {
      mat.color.setHex(TERRAIN_TILE_CORE_COLOR);
      mat.roughness = 0.9;
      mat.metalness = 0.05;
      mat.emissive.setHex(0x000000);
      mat.emissiveIntensity = 0;
    }
  }

  /** Centers a billboard mesh on the inspector ortho look-at (default y = 0.1). */
  private centerBillboardRootInPreviewFrame(
    root: THREE.Group,
    scale: number,
    lookY = 0.1
  ): void {
    if (Math.abs(scale - 1) > 1e-6) {
      root.scale.setScalar(scale);
    }
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const center = new THREE.Vector3();
    box.getCenter(center);
    root.position.x -= center.x;
    root.position.y -= center.y - lookY;
    root.position.z -= center.z;
  }

  /**
   * Scale and center a design/prefab preview group so the full footprint and stack
   * height fit inside the orthographic inspector / dock thumbnail frame.
   */
  private fitDesignPreviewRootInInspectorFrame(root: THREE.Group): void {
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    if (box.isEmpty()) return;
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z, 1e-6);
    const margin = 0.84;
    const viewDiameter =
      (INSPECTOR_PREVIEW_HALF_V * 2 * margin) / INSPECTOR_PREVIEW_SCENE_SCALE;
    const fitScale = Math.min(1, viewDiameter / maxDim);
    if (fitScale < 1 - 1e-6) {
      root.scale.multiplyScalar(fitScale);
    }
    root.updateMatrixWorld(true);
    box.setFromObject(root);
    box.getCenter(center);
    root.position.x -= center.x;
    root.position.y -= center.y;
    root.position.z -= center.z;
  }

  private prepareInspectorBillboardPreviewRoot(
    root: THREE.Group,
    port: InspectorTilePreviewPort,
    scale = INSPECTOR_BILLBOARD_PREVIEW_SCALE
  ): void {
    this.centerBillboardRootInPreviewFrame(root, scale);
    port.floor.visible = false;
  }

  private inspectorBillboardPreviewSignature(
    orientation: "horizontal" | "vertical",
    yawSteps: number,
    texture: THREE.Texture,
    slot: "placement" | "selection",
    billboardId?: string
  ): string {
    const idPart = billboardId ? `|${billboardId}` : "";
    return `bb_${slot}|${orientation}|${yawSteps}|${texture.uuid}${idPart}|${this.blockVisualScale}|${this.floorTileQuadSize}`;
  }

  private mountInspectorBillboardPreview(
    port: InspectorTilePreviewPort,
    spec: {
      orientation: "horizontal" | "vertical";
      yawSteps: number;
    },
    texture: THREE.Texture,
    scale = INSPECTOR_BILLBOARD_PREVIEW_SCALE
  ): void {
    port.blockSlot.position.set(0, 0, 0);
    const root = createBillboardRoot(
      {
        anchorX: 0,
        anchorZ: 0,
        orientation: spec.orientation,
        yawSteps: spec.yawSteps,
      },
      BLOCK_SIZE,
      texture
    );
    this.prepareInspectorBillboardPreviewRoot(root, port, scale);
    port.blockSlot.add(root);
  }

  private billboardTextureForInspectorPreview(id: string): THREE.Texture {
    const root = this.billboardRoots.get(id);
    const mesh = root?.userData["billboardMesh"] as THREE.Mesh | undefined;
    const map = (mesh?.material as THREE.MeshBasicMaterial | undefined)?.map;
    if (map) return map;
    return this.billboardPreviewPlaceholderTex;
  }

  private refreshInspectorBillboardSelectionPreviewIfNeeded(
    billboardId: string
  ): void {
    if (
      this.inspectorSelectionBillboardId !== billboardId ||
      !this.inspectorSelectionPort
    ) {
      return;
    }
    this.inspectorSelectionPort.lastSig = "";
    this.renderInspectorTilePreview("selection");
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
    port.floor.visible = true;
    if (
      slot === "selection" &&
      this.inspectorSelectionSpecialDockKind === "teleporter"
    ) {
      const pending = this.inspectorSelectionTeleporterPending;
      const tRef = this.inspectorSelectionTeleporterTileRef;
      const placed =
        tRef !== null
          ? this.getPlacedAt(tRef.x, tRef.z, tRef.y)
          : null;
      const blockSig = placed
        ? `${this.inspectorTilePreviewSignature(placed)}|${resolveTeleporterPillarColorRgb(placed)}|${this.teleporterSelectionPreviewColorRgb ?? ""}`
        : "none";
      const sig = `tp_sel|${pending ? "off" : "on"}|${
        tRef !== null ? `${tRef.x},${tRef.z},${tRef.y}|` : ""
      }${blockSig}|${this.blockVisualScale}|${this.floorTileQuadSize}`;
      if (port.lastSig !== sig) {
        port.lastSig = sig;
        this.resetInspectorPreviewBlockSlot(port);
        this.applyInspectorPreviewFloorPortalGlow(port, !pending);
        port.blockSlot.position.set(0, 0, 0);
        const pillarColor =
          this.teleporterSelectionPreviewColorRgb ??
          (placed
            ? resolveTeleporterPillarColorRgb(placed)
            : TELEPORTER_DEFAULT_PILLAR_COLOR_RGB);
        port.blockSlot.add(
          this.createPortalPillarMesh(0, 0, {
            dim: pending,
            pillarColorRgb: pillarColor,
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
      return;
    }
    if (
      slot === "selection" &&
      this.inspectorSelectionSpecialDockKind === "billboard"
    ) {
      const id = this.inspectorSelectionBillboardId;
      const spec = id ? this.billboardSpecs.get(id) : undefined;
      if (!id || !spec) {
        this.resetInspectorPreviewBlockSlot(port);
      } else {
        const tex = this.billboardTextureForInspectorPreview(id);
        const sig = this.inspectorBillboardPreviewSignature(
          spec.orientation,
          spec.yawSteps,
          tex,
          "selection",
          id
        );
        if (port.lastSig !== sig) {
          port.lastSig = sig;
          this.resetInspectorPreviewBlockSlot(port);
          this.applyInspectorPreviewFloorPortalGlow(port, false);
          this.mountInspectorBillboardPreview(
            port,
            {
              orientation: spec.orientation,
              yawSteps: spec.yawSteps,
            },
            tex
          );
        }
      }
      const rBb = port.canvas.getBoundingClientRect();
      if (rBb.width < 2 || rBb.height < 2) return;
      const rwBb = Math.max(1, Math.floor(rBb.width));
      const rhBb = Math.max(1, Math.floor(rBb.height));
      port.renderer.setSize(rwBb, rhBb, false);
      port.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.applyInspectorPreviewFrustum(port.camera, rwBb, rhBb);
      port.renderer.render(port.scene, port.camera);
      return;
    }
    if (
      slot === "placement" &&
      this.inspectorPlacementPreviewKind === "billboard"
    ) {
      const d = this.billboardPlacementDraft;
      const tex = this.billboardPreviewPlaceholderTex;
      const sig = this.inspectorBillboardPreviewSignature(
        d.orientation,
        d.yawSteps,
        tex,
        "placement"
      );
      if (port.lastSig !== sig) {
        port.lastSig = sig;
        this.resetInspectorPreviewBlockSlot(port);
        this.applyInspectorPreviewFloorPortalGlow(port, false);
        this.mountInspectorBillboardPreview(
          port,
          { orientation: d.orientation, yawSteps: d.yawSteps },
          tex
        );
      }
      const rPlBb = port.canvas.getBoundingClientRect();
      if (rPlBb.width < 2 || rPlBb.height < 2) return;
      const rwPlBb = Math.max(1, Math.floor(rPlBb.width));
      const rhPlBb = Math.max(1, Math.floor(rPlBb.height));
      port.renderer.setSize(rwPlBb, rhPlBb, false);
      port.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.applyInspectorPreviewFrustum(port.camera, rwPlBb, rhPlBb);
      port.renderer.render(port.scene, port.camera);
      return;
    }
    if (
      slot === "placement" &&
      this.inspectorPlacementPreviewKind !== "block"
    ) {
      const tool = this.inspectorPlacementPreviewKind;
      const sig = this.dockStripToolThumbnailSignature(tool);
      if (port.lastSig !== sig) {
        port.lastSig = sig;
        this.resetInspectorPreviewBlockSlot(port);
        this.applyInspectorPreviewFloorPortalGlow(port, tool === "teleporter");
        this.renderDockStripToolIntoBakePort(port, tool);
      }
      const rPl = port.canvas.getBoundingClientRect();
      if (rPl.width < 2 || rPl.height < 2) return;
      const rwPl = Math.max(1, Math.floor(rPl.width));
      const rhPl = Math.max(1, Math.floor(rPl.height));
      port.renderer.setSize(rwPl, rhPl, false);
      port.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.applyInspectorPreviewFrustum(port.camera, rwPl, rhPl);
      port.renderer.render(port.scene, port.camera);
      return;
    }
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
              hexRadiusScale: this.inspectorSelectionObstacle.hexRadiusScale,
              sphere: this.inspectorSelectionObstacle.sphere,
              sphereRadiusScale:
                this.inspectorSelectionObstacle.sphereRadiusScale,
              ramp: this.inspectorSelectionObstacle.ramp,
              rampDir: this.inspectorSelectionObstacle.rampDir,
              ...cubeRotationForPlainCube(
                {
                  hex: this.inspectorSelectionObstacle.hex,
                  pyramid: this.inspectorSelectionObstacle.pyramid,
                  sphere: this.inspectorSelectionObstacle.sphere,
                  ramp: this.inspectorSelectionObstacle.ramp,
                },
                this.inspectorSelectionObstacle
              ),
              colorRgb: this.inspectorSelectionObstacle.colorRgb,
              ...(this.inspectorSelectionObstacle.claimable
                ? {
                    claimable: true,
                    active: this.inspectorSelectionObstacle.active,
                  }
                : {}),
              ...(this.inspectorSelectionObstacle.gate
                ? { gate: this.inspectorSelectionObstacle.gate }
                : {}),
              ...(this.inspectorSelectionObstacle.unlockPad
                ? { unlockPad: this.inspectorSelectionObstacle.unlockPad }
                : {}),
            } as BlockStyleProps);
    if (!meta) {
      this.resetInspectorPreviewBlockSlot(port);
      const w0 = port.canvas.clientWidth || 1;
      const h0 = port.canvas.clientHeight || 1;
      port.renderer.setSize(w0, h0, false);
      port.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.applyInspectorPreviewFrustum(port.camera, w0, h0);
      port.renderer.render(port.scene, port.camera);
      return;
    }
    const tRef = slot === "selection" ? this.inspectorSelectionTileRef : null;
    const sig = `${
      tRef !== null ? `${tRef.x},${tRef.z},${tRef.y}|` : ""
    }${this.inspectorTilePreviewSignature(meta)}`;
    const h = this.obstacleHeight(meta);
    const vis = this.blockVisualScale;
    const yWorld = (h * vis) / 2;
    port.blockSlot.position.set(0, yWorld, 0);
    if (port.lastSig !== sig) {
      port.lastSig = sig;
      this.disposeInspectorPreviewBlockChildren(port);
      port.blockSlot.add(
        this.makeBlockMesh(meta, {
          ghost: false,
          tileX: tRef?.x,
          tileZ: tRef?.z,
          inspectorPreview: true,
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

  private dockStripToolThumbnailSignature(
    tool: "teleporter" | "gate" | "unlock-pad" | "billboard" | "signpost"
  ): string {
    const lay = `${this.blockVisualScale}|${this.floorTileQuadSize}`;
    if (tool === "teleporter") return `tp|${lay}`;
    if (tool === "gate") {
      return `gate|${this.placementRampDir & 3}|${this.placementColorRgb}|${lay}`;
    }
    if (tool === "unlock-pad") {
      return `unlock-pad|${this.placementColorRgb}|${lay}`;
    }
    if (tool === "billboard") {
      const b = this.billboardPlacementDraft;
      return `bb|${b.orientation}|${b.yawSteps}|${DOCK_STRIP_BILLBOARD_THUMB_SCALE}|${lay}`;
    }
    return `sp|${this.placementPreviewStyleSignature(this.placementPreviewMetaForNewBlock())}|${lay}`;
  }

  private terrainDockThumbMetaForShape(
    shape: "cube" | "hex" | "pyramid" | "sphere" | "ramp"
  ): BlockStyleProps {
    const b = this.placementPreviewMetaForNewBlock();
    return {
      ...b,
      hex: shape === "hex",
      pyramid: shape === "pyramid",
      pyramidBaseScale: shape === "pyramid" ? b.pyramidBaseScale : 1,
      hexRadiusScale: shape === "hex" ? (b.hexRadiusScale ?? 1) : 1,
      sphere: shape === "sphere",
      sphereRadiusScale:
        shape === "sphere" ? (b.sphereRadiusScale ?? 1) : 1,
      ramp: shape === "ramp",
      rampDir: shape === "ramp" ? b.rampDir : 0,
    };
  }

  private disposeDockStripBakePort(): void {
    if (!this.dockStripBakePort) return;
    this.disposeInspectorTilePreviewPort(this.dockStripBakePort);
    this.dockStripBakePort = null;
  }

  private getOrCreateDockStripBakePort(): InspectorTilePreviewPort {
    if (this.dockStripBakePort) return this.dockStripBakePort;
    const canvas = document.createElement("canvas");
    canvas.width = DOCK_STRIP_THUMB_PX;
    canvas.height = DOCK_STRIP_THUMB_PX;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(INSPECTOR_TILE_PREVIEW_BG);
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.05, 72);
    this.applyInspectorPreviewFrustum(
      camera,
      DOCK_STRIP_THUMB_PX,
      DOCK_STRIP_THUMB_PX
    );
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

    const resizeObserver = new ResizeObserver(() => {});
    resizeObserver.observe(canvas);

    this.dockStripBakePort = {
      canvas,
      renderer,
      scene,
      camera,
      content,
      blockSlot,
      floor,
      resizeObserver,
      lastSig: "",
    };
    return this.dockStripBakePort;
  }

  /**
   * Clears `blockSlot` for a dock bake. Skips disposing shared textures used by billboards
   * and signpost hint sprites so global materials stay valid.
   */
  private clearDockStripBakeBlockSlot(port: InspectorTilePreviewPort): void {
    const neverDisposeMap = new Set<THREE.Texture>([
      this.billboardPreviewPlaceholderTex,
      this.signpostHintPlaceholderTexture,
    ]);
    if (this.signpostHintDocTexture) {
      neverDisposeMap.add(this.signpostHintDocTexture);
    }
    while (port.blockSlot.children.length > 0) {
      const c = port.blockSlot.children[0]!;
      port.blockSlot.remove(c);
      c.traverse((child: THREE.Object3D) => {
        if (
          child instanceof THREE.Mesh ||
          child instanceof THREE.Sprite ||
          child instanceof THREE.Line ||
          child instanceof THREE.LineSegments
        ) {
          const drawable = child as THREE.Mesh;
          drawable.geometry.dispose();
          const m = drawable.material;
          const mats = Array.isArray(m) ? m : [m];
          for (const mm of mats) {
            const mat = mm as THREE.Material & { map?: THREE.Texture | null };
            if (mat.map && !neverDisposeMap.has(mat.map)) {
              mat.map.dispose();
            }
            mat.dispose();
          }
        }
      });
    }
    port.lastSig = "";
  }

  private finishDockStripBakeRender(port: InspectorTilePreviewPort): void {
    const rw = DOCK_STRIP_THUMB_PX;
    const rh = DOCK_STRIP_THUMB_PX;
    port.renderer.setSize(rw, rh, false);
    port.renderer.setPixelRatio(1);
    this.applyInspectorPreviewFrustum(port.camera, rw, rh);
    port.renderer.render(port.scene, port.camera);
  }

  private renderDockStripToolIntoBakePort(
    port: InspectorTilePreviewPort,
    tool: "teleporter" | "gate" | "unlock-pad" | "billboard" | "signpost"
  ): void {
    port.floor.visible = tool !== "billboard";
    if (tool === "teleporter") {
      port.blockSlot.position.set(0, 0, 0);
      port.blockSlot.add(this.createPortalPillarMesh(0, 0, { dim: true }));
      return;
    }
    if (tool === "gate") {
      const dirs: readonly [number, number][] = [
        [1, 0],
        [0, 1],
        [-1, 0],
        [0, -1],
      ];
      const [dx, dz] = dirs[this.placementRampDir & 3]!;
      const meta: BlockStyleProps = {
        passable: false,
        half: false,
        quarter: false,
        hex: false,
        pyramid: false,
        pyramidBaseScale: 1,
        hexRadiusScale: 1,
        sphere: false,
        ramp: false,
        rampDir: 0,
        colorRgb: this.placementColorRgb,
        gate: {
          adminAddress: "NQ1000000000000000000000000000000000000",
          authorizedAddresses: [],
          exitX: dx,
          exitZ: dz,
        },
      };
      const h = this.obstacleHeight(meta);
      const vis = this.blockVisualScale;
      port.blockSlot.position.set(0, (h * vis) / 2, 0);
      port.blockSlot.add(
        this.makeBlockMesh(meta, {
          ghost: false,
          tileX: 0,
          tileZ: 0,
          inspectorPreview: true,
        })
      );
      return;
    }
    if (tool === "unlock-pad") {
      const meta: BlockStyleProps = {
        passable: false,
        half: false,
        quarter: false,
        hex: false,
        pyramid: false,
        pyramidBaseScale: 1,
        hexRadiusScale: 1,
        sphere: false,
        ramp: false,
        rampDir: 0,
        colorRgb: this.placementColorRgb,
        unlockPad: {
          amountLuna: "100000",
          recipient: "",
          buttonLabel: "Unlock",
          proofMode: "payment_intent",
          instanceId: "__preview__",
        },
      };
      const h = this.obstacleHeight(meta);
      const vis = this.blockVisualScale;
      port.blockSlot.position.set(0, (h * vis) / 2, 0);
      port.blockSlot.add(
        this.makeBlockMesh(meta, {
          ghost: false,
          tileX: 0,
          tileZ: 0,
          inspectorPreview: true,
        })
      );
      return;
    }
    if (tool === "billboard") {
      const d = this.billboardPlacementDraft;
      this.mountInspectorBillboardPreview(
        port,
        { orientation: d.orientation, yawSteps: d.yawSteps },
        this.billboardPreviewPlaceholderTex,
        DOCK_STRIP_BILLBOARD_THUMB_SCALE
      );
      return;
    }
    void this.ensureSignpostHintDocTexture();
    const base = this.placementPreviewMetaForNewBlock();
    const meta: BlockStyleProps = {
      ...base,
      signboardId: "__hud_thumb__",
    };
    const h = this.obstacleHeight(meta);
    const vis = this.blockVisualScale;
    port.blockSlot.position.set(0, (h * vis) / 2, 0);
    const g = this.makeBlockMesh(meta, {
      ghost: false,
      tileX: 0,
      tileZ: 0,
      inspectorPreview: true,
    });
    this.attachSignpostHintToBlockGroup(g, meta);
    port.blockSlot.add(g);
  }

  /**
   * Build HUD calls this when switching placement tools. This Game build keeps the
   * placement inspector block-only; the call must exist so HUD never throws.
   */
  setPlacementInspectorPreviewKind(
    kind: "block" | "teleporter" | "gate" | "unlock-pad" | "billboard" | "signpost"
  ): void {
    if (this.inspectorPlacementPreviewKind === kind) return;
    this.inspectorPlacementPreviewKind = kind;
    if (this.inspectorPlacementPort) {
      this.inspectorPlacementPort.lastSig = "";
      this.renderInspectorTilePreview("placement");
    }
  }

  private prefabDesignThumbnailSignature(
    designId: string,
    footprintW: number,
    footprintD: number,
    snapshot: DesignSnapshotV1,
    version?: number
  ): string {
    return `prefab|${designId}|v${version ?? 0}|${footprintW}|${footprintD}|${snapshot.obstacles.length}|${this.blockVisualScale}|fitBounds`;
  }

  private renderPrefabDesignIntoBakePort(
    port: InspectorTilePreviewPort,
    snapshot: DesignSnapshotV1,
    footprintW: number,
    footprintD: number
  ): void {
    port.floor.visible = false;
    port.blockSlot.position.set(0, 0, 0);
    const cx = (footprintW - 1) / 2;
    const cz = (footprintD - 1) / 2;
    const vis = this.blockVisualScale;
    const prefabRoot = new THREE.Group();
    for (const obs of snapshot.obstacles) {
      const yLevel = Math.max(0, Math.min(2, Math.floor(obs.y)));
      const meta = { ...obs.props } as BlockStyleProps;
      const h = this.obstacleHeight(meta);
      const mesh = this.makeBlockMesh(meta, {
        ghost: false,
        inspectorPreview: true,
      });
      mesh.position.set(
        obs.dx - cx,
        yLevel * BLOCK_SIZE + (h * vis) / 2,
        obs.dz - cz
      );
      prefabRoot.add(mesh);
    }
    this.fitDesignPreviewRootInInspectorFrame(prefabRoot);
    port.blockSlot.add(prefabRoot);
  }

  getPrefabDesignThumbnailDataUrls(
    entries: readonly {
      id: string;
      snapshot: DesignSnapshotV1;
      footprintW: number;
      footprintD: number;
      version?: number;
    }[]
  ): Map<string, string> {
    const out = new Map<string, string>();
    if (entries.length === 0) return out;
    const port = this.getOrCreateDockStripBakePort();
    for (const e of entries) {
      const sig = this.prefabDesignThumbnailSignature(
        e.id,
        e.footprintW,
        e.footprintD,
        e.snapshot,
        e.version
      );
      const cached = this.dockStripThumbByPrefabDesign.get(e.id);
      if (cached?.sig === sig) {
        out.set(e.id, cached.dataUrl);
        continue;
      }
      this.clearDockStripBakeBlockSlot(port);
      this.renderPrefabDesignIntoBakePort(
        port,
        e.snapshot,
        e.footprintW,
        e.footprintD
      );
      this.finishDockStripBakeRender(port);
      const dataUrl = port.canvas.toDataURL("image/png");
      this.dockStripThumbByPrefabDesign.set(e.id, { sig, dataUrl });
      out.set(e.id, dataUrl);
    }
    return out;
  }

  getDockStripThumbnailDataUrls(
    tools: readonly ("teleporter" | "gate" | "unlock-pad" | "billboard" | "signpost")[]
  ): Map<string, string> {
    const out = new Map<string, string>();
    const port = this.getOrCreateDockStripBakePort();
    for (const t of tools) {
      const sig = this.dockStripToolThumbnailSignature(t);
      const cached = this.dockStripThumbByTool.get(t);
      if (cached?.sig === sig) {
        out.set(t, cached.dataUrl);
        continue;
      }
      this.clearDockStripBakeBlockSlot(port);
      this.renderDockStripToolIntoBakePort(port, t);
      this.finishDockStripBakeRender(port);
      const dataUrl = port.canvas.toDataURL("image/png");
      this.dockStripThumbByTool.set(t, { sig, dataUrl });
      out.set(t, dataUrl);
    }
    return out;
  }

  getTerrainDockShapeThumbnailDataUrls(
    shapes: readonly ("cube" | "hex" | "pyramid" | "sphere" | "ramp")[]
  ): Map<string, string> {
    const out = new Map<string, string>();
    const port = this.getOrCreateDockStripBakePort();
    for (const s of shapes) {
      const meta = this.terrainDockThumbMetaForShape(s);
      const sig = `shape|${s}|${this.inspectorTilePreviewSignature(meta)}`;
      const cached = this.dockStripThumbByTerrainShape.get(s);
      if (cached?.sig === sig) {
        out.set(s, cached.dataUrl);
        continue;
      }
      this.clearDockStripBakeBlockSlot(port);
      const h = this.obstacleHeight(meta);
      const vis = this.blockVisualScale;
      port.blockSlot.position.set(0, (h * vis) / 2, 0);
      port.blockSlot.add(
        this.makeBlockMesh(meta, {
          ghost: false,
          tileX: 0,
          tileZ: 0,
          inspectorPreview: true,
        })
      );
      this.finishDockStripBakeRender(port);
      const dataUrl = port.canvas.toDataURL("image/png");
      this.dockStripThumbByTerrainShape.set(s, { sig, dataUrl });
      out.set(s, dataUrl);
    }
    return out;
  }

  getFloorDockThumbnailDataUrl(): string {
    const sig = `floor|${this.floorTileQuadSize}`;
    if (this.dockStripThumbFloor?.sig === sig) {
      return this.dockStripThumbFloor.dataUrl;
    }
    const port = this.getOrCreateDockStripBakePort();
    this.clearDockStripBakeBlockSlot(port);
    port.floor.visible = true;
    applyWalkableFloorTileMaterials(port.floor, false, true);
    this.finishDockStripBakeRender(port);
    const dataUrl = port.canvas.toDataURL("image/png");
    this.dockStripThumbFloor = { sig, dataUrl };
    return dataUrl;
  }

  clearDockStripThumbnailCache(): void {
    this.dockStripThumbByTool.clear();
    this.dockStripThumbByTerrainShape.clear();
    this.dockStripThumbByPrefabDesign.clear();
    this.dockStripThumbFloor = null;
    this.disposeDockStripBakePort();
  }

  prewarmDockStripThumbnails(): void {
    this.getDockStripThumbnailDataUrls([
      "teleporter",
      "gate",
      "unlock-pad",
      "billboard",
      "signpost",
    ]);
    this.getTerrainDockShapeThumbnailDataUrls([
      "cube",
      "hex",
      "pyramid",
      "sphere",
      "ramp",
    ]);
    this.getFloorDockThumbnailDataUrl();
  }

  /** First-person toggle (not wired in this build). */
  toggleFirstPersonView(): boolean {
    return false;
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
    renderer.toneMapping = THREE.NoToneMapping;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(INSPECTOR_TILE_PREVIEW_BG);
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
    if (canvas.getBoundingClientRect().width < 2) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => this.renderInspectorTilePreview(slot));
      });
    }
  }

  /** Re-measure and redraw after the dock preview slot becomes visible. */
  relayoutInspectorTilePreview(slot: "placement" | "selection"): void {
    const port =
      slot === "placement"
        ? this.inspectorPlacementPort
        : this.inspectorSelectionPort;
    if (port) port.lastSig = "";
    this.renderInspectorTilePreview(slot);
  }

  /** Updates the object-panel 3D preview; pass `null` when the panel closes. */
  syncInspectorSelectionTilePreview(props: ObstacleProps | null): void {
    this.inspectorSelectionSpecialDockKind = null;
    this.inspectorSelectionBillboardId = null;
    this.inspectorSelectionTeleporterPending = false;
    this.inspectorSelectionTeleporterTileRef = null;
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
    if (this.inspectorSelectionPort) {
      this.inspectorSelectionPort.lastSig = "";
    }
    this.renderInspectorTilePreview("selection");
    if (props === null && this.inspectorPlacementPort) {
      this.inspectorPlacementPort.lastSig = "";
      this.renderInspectorTilePreview("placement");
    }
  }

  /**
   * Selection-slot preview while the teleporter destination panel is open (no block props).
   * Pending teleporters show a dim portal pillar; configured ones show the full pillar.
   */
  syncInspectorSelectionTeleporterPreview(
    opts: {
      pending: boolean;
      tileX: number;
      tileZ: number;
      tileY: number;
    } | null
  ): void {
    if (opts === null) {
      this.inspectorSelectionSpecialDockKind = null;
      this.inspectorSelectionBillboardId = null;
      this.inspectorSelectionTeleporterPending = false;
      this.inspectorSelectionTeleporterTileRef = null;
      this.teleporterSelectionPreviewColorRgb = null;
      this.inspectorSelectionObstacle = null;
      this.inspectorSelectionTileRef = null;
    } else {
      this.inspectorSelectionSpecialDockKind = "teleporter";
      this.inspectorSelectionBillboardId = null;
      this.inspectorSelectionTeleporterPending = opts.pending;
      this.inspectorSelectionTeleporterTileRef = {
        x: opts.tileX,
        z: opts.tileZ,
        y: opts.tileY,
      };
      this.inspectorSelectionObstacle = null;
      this.inspectorSelectionTileRef = {
        x: opts.tileX,
        z: opts.tileZ,
        y: opts.tileY,
      };
    }
    if (this.inspectorSelectionPort) {
      this.inspectorSelectionPort.lastSig = "";
    }
    this.renderInspectorTilePreview("selection");
  }

  /** Live pillar recolor while the teleporter hue ring is adjusted. */
  previewTeleporterPillarColorAt(
    tileX: number,
    tileZ: number,
    tileY: number,
    colorRgb: number
  ): void {
    const rgb = resolveTeleporterPillarColorRgb({
      teleporter: {},
      colorRgb,
    });
    this.teleporterSelectionPreviewColorRgb = rgb;
    const k = `${tileX},${tileZ},${tileY}`;
    const marker = this.teleporterMarkerMeshes.get(k);
    if (marker) {
      const mat = marker.material as THREE.ShaderMaterial;
      if (mat.uniforms?.uColor?.value instanceof THREE.Color) {
        mat.uniforms.uColor.value.setHex(rgb);
      }
      marker.userData.tpColorRgb = rgb;
      this.requestRender(120);
    }
    if (this.inspectorSelectionPort) {
      this.inspectorSelectionPort.lastSig = "";
    }
    this.renderInspectorTilePreview("selection");
  }

  /** Selection-slot preview for a placed billboard (no floor block props). */
  syncInspectorSelectionBillboardPreview(billboardId: string | null): void {
    if (billboardId === null) {
      this.inspectorSelectionSpecialDockKind = null;
      this.inspectorSelectionBillboardId = null;
      this.inspectorSelectionObstacle = null;
      this.inspectorSelectionTileRef = null;
    } else {
      const spec = this.billboardSpecs.get(billboardId);
      this.inspectorSelectionSpecialDockKind = "billboard";
      this.inspectorSelectionBillboardId = billboardId;
      this.inspectorSelectionTeleporterPending = false;
      this.inspectorSelectionTeleporterTileRef = null;
      this.inspectorSelectionObstacle = null;
      this.inspectorSelectionTileRef = spec
        ? { x: spec.anchorX, z: spec.anchorZ, y: 0 }
        : null;
    }
    if (this.inspectorSelectionPort) {
      this.inspectorSelectionPort.lastSig = "";
    }
    this.renderInspectorTilePreview("selection");
    if (billboardId === null && this.inspectorPlacementPort) {
      this.inspectorPlacementPort.lastSig = "";
      this.renderInspectorTilePreview("placement");
    }
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

  private applyWardrobePreviewFrustum(
    camera: THREE.OrthographicCamera,
    rw: number,
    rh: number
  ): void {
    const asp = Math.max(0.2, rw / Math.max(1, rh));
    const halfV = WARDROBE_PREVIEW_FRUSTUM_HALF_V;
    const halfH = halfV * asp;
    camera.left = -halfH;
    camera.right = halfH;
    camera.top = halfV;
    camera.bottom = -halfV;
    camera.updateProjectionMatrix();
  }

  private syncWardrobePreviewNameLabelScale(g: THREE.Group): void {
    const port = this.wardrobeAvatarPreviewPort;
    const nameSprite = g.userData.nameSprite as THREE.Sprite | undefined;
    if (!port || !nameSprite) return;
    const tw = nameSprite.userData.nameLabelTexW as number | undefined;
    const th = nameSprite.userData.nameLabelTexH as number | undefined;
    if (!tw || !th) return;
    nameSprite.visible = true;
    const rh = Math.max(1, port.canvas.clientHeight);
    const worldPerPx = (WARDROBE_PREVIEW_FRUSTUM_HALF_V * 2) / rh;
    let worldH = worldPerPx * NAME_LABEL_SCREEN_HEIGHT_PX;
    let worldW = worldH * (tw / th);
    const maxW = worldPerPx * NAME_LABEL_MAX_PX;
    if (worldW > maxW) {
      const s = maxW / worldW;
      worldW *= s;
      worldH *= s;
    }
    nameSprite.scale.set(worldW, worldH, 1);
    this.updateAvatarNameLabelHeight(g);
    this.layoutWardrobePreviewChatBubble(g);
  }

  private disposeWardrobePreviewChatBubble(g: THREE.Group): void {
    const entry = g.userData[WARDROBE_PREVIEW_CHAT_BUBBLE_KEY] as
      | {
          sprite: THREE.Sprite;
          tex: THREE.CanvasTexture;
        }
      | undefined;
    if (!entry) return;
    g.remove(entry.sprite);
    entry.sprite.material.dispose();
    entry.tex.dispose();
    delete g.userData[WARDROBE_PREVIEW_CHAT_BUBBLE_KEY];
    delete g.userData[WARDROBE_PREVIEW_CHAT_BUBBLE_PRESET_KEY];
  }

  private syncWardrobePreviewChatBubble(
    g: THREE.Group,
    presetId: string | null | undefined
  ): void {
    const next = presetId ?? null;
    const prev = g.userData[WARDROBE_PREVIEW_CHAT_BUBBLE_PRESET_KEY] as
      | string
      | null
      | undefined;
    if (prev === next && g.userData[WARDROBE_PREVIEW_CHAT_BUBBLE_KEY]) return;
    g.userData[WARDROBE_PREVIEW_CHAT_BUBBLE_PRESET_KEY] = next;
    this.disposeWardrobePreviewChatBubble(g);
    if (!next) return;
    const { sprite, texture, width, height } = createChatBubbleSprite("Hello!", {
      bubblePreset: next,
    });
    sprite.userData[SKIP_BLOCK_PICK_AND_BOUNDS] = true;
    sprite.raycast = (_raycaster: THREE.Raycaster, _intersects: THREE.Intersection[]) => {};
    g.add(sprite);
    g.userData[WARDROBE_PREVIEW_CHAT_BUBBLE_KEY] = {
      sprite,
      tex: texture,
      width,
      height,
    };
    this.layoutWardrobePreviewChatBubble(g);
  }

  private layoutWardrobePreviewChatBubble(g: THREE.Group): void {
    const port = this.wardrobeAvatarPreviewPort;
    const entry = g.userData[WARDROBE_PREVIEW_CHAT_BUBBLE_KEY] as
      | {
          sprite: THREE.Sprite;
          width: number;
          height: number;
        }
      | undefined;
    if (!port || !entry) return;
    const rh = Math.max(1, port.canvas.clientHeight);
    const worldPerPx = (WARDROBE_PREVIEW_FRUSTUM_HALF_V * 2) / rh;
    const targetScreenHeight = Math.max(CHAT_BUBBLE_MIN_HEIGHT_PX, entry.height);
    let worldH = worldPerPx * targetScreenHeight;
    let worldW = worldH * (entry.width / entry.height);
    const maxW = worldPerPx * CHAT_MAX_WIDTH_SCREEN_PX;
    if (worldW > maxW) worldW = maxW;
    entry.sprite.scale.set(worldW, worldH, 1);
    const avatarTop = this.avatarIdenticonWorldDiameter();
    entry.sprite.position.set(0, avatarTop + worldPerPx * 2 + worldH / 2, 0);
    entry.sprite.renderOrder = 1000;
  }

  private disposeWardrobeAvatarPreviewPort(): void {
    const port = this.wardrobeAvatarPreviewPort;
    if (!port) return;
    if (port.rafId != null) {
      cancelAnimationFrame(port.rafId);
      port.rafId = null;
    }
    port.deployableFx?.dispose();
    port.deployableFx = null;
    port.resizeObserver.disconnect();
    this.disposeWardrobePreviewChatBubble(port.avatarGroup);
    disposeCosmeticTrailPuffs(port.avatarGroup);
    this.disposeAvatarGroup(port.avatarGroup);
    for (const tile of port.floorTiles) {
      port.rootGroup.remove(tile.mesh);
      tile.geo.dispose();
      tile.mat.dispose();
    }
    for (const g of port.blockGroups) {
      port.rootGroup.remove(g);
      disposePlacedBlockGroupContents(g);
    }
    port.renderer.dispose();
    if (typeof port.renderer.forceContextLoss === "function") {
      port.renderer.forceContextLoss();
    }
    this.wardrobeAvatarPreviewPort = null;
  }

  private wardrobePreviewFloorContext(): WardrobePreviewFloorContext {
    return {
      roomId: this.roomId,
      extraFloorKeys: this.extraFloorKeys,
      extraFloorColorByKey: this.extraFloorColorByKey,
      baseFloorColorByKey: this.baseFloorColorByKey,
      removedBaseFloorKeys: this.removedBaseFloorKeys,
      doorTileKeys: this.doorTileKeys,
    };
  }

  private snapshotWardrobePreviewSkyRgb(): number {
    const bg = this.scene.background;
    if (bg instanceof THREE.Color) return bg.getHex();
    return TERRAIN_WATER_COLOR;
  }

  private resolveWardrobePreviewAnchor(): { x: number; z: number } {
    const selfPos = this.getSelfPosition();
    return resolveWardrobePreviewAnchorTile(
      selfPos ? { x: selfPos.x, z: selfPos.z } : null,
      getRoomDefaultSpawnTile(this.roomId)
    );
  }

  private buildWardrobePreviewFloorTiles(
    rootGroup: THREE.Group,
    anchor: { x: number; z: number },
    cameraOrbitYawRad: number
  ): WardrobePreviewFloorTile[] {
    const patch = buildWardrobePreviewFloorPatch(
      anchor.x,
      anchor.z,
      this.wardrobePreviewFloorContext(),
      cameraOrbitYawRad
    );
    const q = this.floorTileQuadSize;
    const tiles: WardrobePreviewFloorTile[] = [];
    for (const cell of patch) {
      const geo = new THREE.PlaneGeometry(q, q);
      const mat = new THREE.MeshBasicMaterial({ color: cell.colorRgb });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(
        (cell.worldX - anchor.x) * q,
        WALKABLE_FLOOR_TOP_Y,
        (cell.worldZ - anchor.z) * q
      );
      rootGroup.add(mesh);
      tiles.push({ mesh, geo, mat });
    }
    return tiles;
  }

  private disposeWardrobePreviewBackdropMeshes(port: WardrobeAvatarPreviewPort): void {
    for (const tile of port.floorTiles) {
      port.rootGroup.remove(tile.mesh);
      tile.geo.dispose();
      tile.mat.dispose();
    }
    for (const g of port.blockGroups) {
      port.rootGroup.remove(g);
      disposePlacedBlockGroupContents(g);
    }
  }

  private rebuildWardrobePreviewBackdrop(port: WardrobeAvatarPreviewPort): void {
    this.disposeWardrobePreviewBackdropMeshes(port);
    const previewAnchor = this.resolveWardrobePreviewAnchor();
    port.floorTiles = this.buildWardrobePreviewFloorTiles(
      port.rootGroup,
      previewAnchor,
      port.cameraOrbitYawRad
    );
    port.blockGroups = this.buildWardrobePreviewBlockGroups(
      port.rootGroup,
      previewAnchor,
      port.cameraOrbitYawRad
    );
  }

  private buildWardrobePreviewBlockGroups(
    rootGroup: THREE.Group,
    anchor: { x: number; z: number },
    cameraOrbitYawRad: number
  ): THREE.Group[] {
    const candidates = collectWardrobePreviewBlocksInPatch(
      anchor.x,
      anchor.z,
      this.placedObjects.keys(),
      cameraOrbitYawRad
    );
    const q = this.floorTileQuadSize;
    const vis = this.blockVisualScale;
    const groups: THREE.Group[] = [];
    for (const c of candidates) {
      if (
        !shouldRenderWardrobePreviewBlock({
          worldDx: c.worldX - anchor.x,
          worldDz: c.worldZ - anchor.z,
          cameraOrbitYawRad,
        })
      ) {
        continue;
      }
      if (this.billboardFootprintFloorKeys.has(tileKey(c.worldX, c.worldZ))) {
        continue;
      }
      const metaRaw = this.placedObjects.get(c.blockKey);
      if (!metaRaw) continue;
      const meta = this.gateRepositionPlacedRenderMeta(
        c.worldX,
        c.worldZ,
        c.yLevel,
        metaRaw
      );
      const h = this.obstacleHeight(meta);
      const g = this.makeBlockMesh(meta, {
        tileX: c.worldX,
        tileZ: c.worldZ,
        floorLayer: c.yLevel,
        inspectorPreview: true,
      });
      g.position.set(
        (c.worldX - anchor.x) * q,
        c.yLevel * BLOCK_SIZE + (h * vis) / 2,
        (c.worldZ - anchor.z) * q
      );
      rootGroup.add(g);
      groups.push(g);
    }
    return groups;
  }

  private applyWardrobePreviewCameraPose(port: WardrobeAvatarPreviewPort): void {
    const lookAt = new THREE.Vector3(0, WARDROBE_PREVIEW_LOOK_AT_Y, 0);
    const offset = new THREE.Vector3(
      WARDROBE_PREVIEW_CAMERA_OFFSET,
      WARDROBE_PREVIEW_CAMERA_OFFSET,
      WARDROBE_PREVIEW_CAMERA_OFFSET
    );
    offset.applyAxisAngle(this.worldUp, port.cameraOrbitYawRad);
    port.camera.up.copy(this.worldUp);
    port.camera.position.set(lookAt.x + offset.x, lookAt.y + offset.y, lookAt.z + offset.z);
    port.camera.lookAt(lookAt);
    // Keep the persistent trail stub trailing away from the viewer at every camera corner.
    orientStaticPreviewTrail(port.avatarGroup, port.cameraOrbitYawRad);
  }

  private stopWardrobePreviewAnimationLoop(): void {
    const port = this.wardrobeAvatarPreviewPort;
    if (!port || port.rafId == null) return;
    cancelAnimationFrame(port.rafId);
    port.rafId = null;
  }

  private startWardrobePreviewAnimationLoop(): void {
    const port = this.wardrobeAvatarPreviewPort;
    if (!port || port.rafId != null) return;
    const tick = (): void => {
      if (this.wardrobeAvatarPreviewPort !== port) return;
      port.rafId = requestAnimationFrame(tick);
      const now = performance.now();
      const phase = (now - port.previewPhaseStart) * 0.0012;
      let dirty = tickCosmeticPreviewMotion(port.scene, port.avatarGroup, now, phase);
      if (dirty) this.renderWardrobeAvatarPreview();
    };
    port.rafId = requestAnimationFrame(tick);
  }

  private renderWardrobeAvatarPreview(): void {
    const port = this.wardrobeAvatarPreviewPort;
    if (!port) return;
    const rw = Math.max(1, port.canvas.clientWidth);
    const rh = Math.max(1, port.canvas.clientHeight);
    if (rw < 2 || rh < 2) return;
    this.applyWardrobePreviewFrustum(port.camera, rw, rh);
    this.applyWardrobePreviewCameraPose(port);
    port.renderer.setSize(rw, rh, false);
    this.syncWardrobePreviewNameLabelScale(port.avatarGroup);
    port.renderer.render(port.scene, port.camera);
  }

  private applyWardrobePreviewCosmeticsToAvatar(): void {
    const port = this.wardrobeAvatarPreviewPort;
    if (!port) return;
    const p: PlayerState = {
      address: port.wallet,
      displayName: port.displayName,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vz: 0,
      cosmeticAura: port.cosmetics.aura,
      cosmeticNameplate: port.cosmetics.nameplate,
      cosmeticChatBubble: port.cosmetics.chatBubble,
      cosmeticTrail: port.cosmetics.trail,
    };
    this.syncAvatarNameLabelFromState(port.avatarGroup, p);
    syncCosmeticLoadoutVfx(port.avatarGroup, p, Boolean(port.cosmetics.trail));
    this.syncWardrobePreviewChatBubble(
      port.avatarGroup,
      port.cosmetics.chatBubble
    );
    // Static preview: lay a fixed, persistent trail stub behind the avatar instead of
    // emitting moving marks (the avatar no longer drifts).
    buildStaticPreviewTrail(port.avatarGroup, port.cosmetics.trail);
    this.renderWardrobeAvatarPreview();
    this.startWardrobePreviewAnimationLoop();
  }

  /**
   * Isolated WebGL view for profile Wardrobe - avatar on a snapshot of the viewer's current
   * room (sky tint + 4×4 floor patch). Pass `null` to release GPU resources.
   */
  bindWardrobeAvatarPreviewCanvas(
    canvas: HTMLCanvasElement | null,
    wallet?: string,
    displayName?: string
  ): void {
    this.disposeWardrobeAvatarPreviewPort();
    if (!canvas) return;

    const w = String(wallet ?? "").trim();
    const label = String(displayName ?? "").trim() || (w ? walletDisplayName(w) : "Player");

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "low-power",
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    // Match device pixel ratio so the identicon and name label stay crisp on high-DPR / mobile
    // screens (e.g. the Nimiq Pay webview); without this the backing store is 1x and upscaled.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(this.snapshotWardrobePreviewSkyRgb());

    const amb = new THREE.AmbientLight(0xffffff, 0.62);
    scene.add(amb);
    const dir = new THREE.DirectionalLight(0xfff8f0, 0.72);
    dir.position.set(8, 20, 10);
    scene.add(dir);

    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    const previewAnchor = this.resolveWardrobePreviewAnchor();
    const cameraOrbitYawRad = snapWardrobePreviewCameraOrbitYaw(
      this.cameraOrbitYawRad
    );
    const floorTiles = this.buildWardrobePreviewFloorTiles(
      rootGroup,
      previewAnchor,
      cameraOrbitYawRad
    );
    const blockGroups = this.buildWardrobePreviewBlockGroups(
      rootGroup,
      previewAnchor,
      cameraOrbitYawRad
    );

    const avatarGroup = w ? this.makeAvatar(w, label) : new THREE.Group();
    rootGroup.add(avatarGroup);

    const lookAt = new THREE.Vector3(0, WARDROBE_PREVIEW_LOOK_AT_Y, 0);
    const cw = Math.max(1, canvas.clientWidth);
    const ch = Math.max(1, canvas.clientHeight);
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 2000);
    this.applyWardrobePreviewFrustum(camera, cw, ch);
    camera.up.set(0, 1, 0);
    camera.position.set(
      lookAt.x + WARDROBE_PREVIEW_CAMERA_OFFSET,
      lookAt.y + WARDROBE_PREVIEW_CAMERA_OFFSET,
      lookAt.z + WARDROBE_PREVIEW_CAMERA_OFFSET
    );
    camera.lookAt(lookAt);

    const port: WardrobeAvatarPreviewPort = {
      canvas,
      renderer,
      scene,
      camera,
      rootGroup,
      avatarGroup,
      floorTiles,
      blockGroups,
      resizeObserver: new ResizeObserver(() => this.renderWardrobeAvatarPreview()),
      wallet: w,
      displayName: label,
      cameraOrbitYawRad,
      rafId: null,
      previewPhaseStart: performance.now(),
      deployableFx: null,
      cosmetics: {
        aura: null,
        nameplate: null,
        chatBubble: null,
        trail: null,
        deployable: null,
      },
    };
    this.wardrobeAvatarPreviewPort = port;
    this.applyWardrobePreviewCameraPose(port);
    port.resizeObserver.observe(canvas);
    this.renderWardrobeAvatarPreview();
    let repoll = 0;
    const repollRender = (): void => {
      if (this.wardrobeAvatarPreviewPort?.canvas !== canvas) return;
      this.renderWardrobeAvatarPreview();
      if (++repoll < 15) requestAnimationFrame(repollRender);
    };
    requestAnimationFrame(repollRender);
    if (canvas.getBoundingClientRect().width < 2) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => this.renderWardrobeAvatarPreview());
      });
    }
  }

  /** Updates passive cosmetic presets on the profile Wardrobe preview canvas. */
  updateWardrobeAvatarPreviewCosmetics(presets: {
    aura?: string | null;
    nameplate?: string | null;
    chatBubble?: string | null;
    trail?: string | null;
    deployable?: string | null;
  }): void {
    const port = this.wardrobeAvatarPreviewPort;
    if (!port) return;
    if (presets.aura !== undefined) port.cosmetics.aura = presets.aura;
    if (presets.nameplate !== undefined) port.cosmetics.nameplate = presets.nameplate;
    if (presets.chatBubble !== undefined) port.cosmetics.chatBubble = presets.chatBubble;
    if (presets.trail !== undefined) port.cosmetics.trail = presets.trail;
    if (presets.deployable !== undefined) {
      port.cosmetics.deployable = presets.deployable;
      port.deployableFx?.dispose();
      port.deployableFx = null;
      if (presets.deployable) {
        port.deployableFx = attachPersistentDeployableVfx(
          port.scene,
          presets.deployable,
          port.avatarGroup.position.x,
          port.avatarGroup.position.z + 0.45
        );
      }
    }
    this.applyWardrobePreviewCosmeticsToAvatar();
  }

  /** Admin / wardrobe - snap isometric preview to one of four corner yaws (0–3). */
  setWardrobeAvatarPreviewCameraCorner(cornerIndex: number): void {
    const port = this.wardrobeAvatarPreviewPort;
    if (!port) return;
    const k = ((Math.floor(cornerIndex) % 4) + 4) % 4;
    port.cameraOrbitYawRad = k * (Math.PI / 2);
    this.rebuildWardrobePreviewBackdrop(port);
    this.renderWardrobeAvatarPreview();
  }

  /** Replay deployable burst VFX at the preview avatar's feet. */
  pulseWardrobeAvatarPreviewDeployable(): void {
    const port = this.wardrobeAvatarPreviewPort;
    if (!port?.cosmetics.deployable) return;
    port.deployableFx?.dispose();
    port.deployableFx = attachPersistentDeployableVfx(
      port.scene,
      port.cosmetics.deployable,
      port.avatarGroup.position.x,
      port.avatarGroup.position.z + 0.45
    );
    this.renderWardrobeAvatarPreview();
  }

  /** Dev-only Preset Gallery (`cosmetic-gallery` / join code SPACER). */
  setCosmeticGallery(payload: CosmeticGalleryWire | null | undefined): void {
    this.clearCosmeticGallery();
    const showcases = payload?.showcases;
    if (!showcases?.length) return;
    for (const showcase of showcases) {
      const plaque = this.makeGalleryFloorPlaque(showcase.label);
      const plaqueX = showcase.tryOnX ?? showcase.x;
      const plaqueZ = showcase.tryOnZ ?? showcase.z + 0.85;
      plaque.position.set(plaqueX, 0.12, plaqueZ);
      this.scene.add(plaque);

      if (showcase.kind === "floor") {
        this.cosmeticGalleryEntries.push({
          showcase,
          group: null,
          plaque,
          plaqueMat: plaque.material as THREE.SpriteMaterial,
          plaqueTex: (plaque.material as THREE.SpriteMaterial).map as THREE.CanvasTexture,
          player: {
            address: showcase.fakeAddress,
            displayName: "",
            x: showcase.x,
            y: 0,
            z: showcase.z,
            vx: 0,
            vz: 0,
          },
          deployableFx: attachPersistentDeployableVfx(
            this.scene,
            showcase.presetId,
            showcase.x,
            showcase.z
          ),
        });
        continue;
      }

      const g = this.makeAvatar(showcase.fakeAddress, "");
      g.userData.galleryShowcase = true;
      g.position.set(showcase.x, 0, showcase.z);
      this.scene.add(g);
      this.markSceneMutation("cosmeticGallery:add");

      const player: PlayerState = {
        address: showcase.fakeAddress,
        displayName: "",
        x: showcase.x,
        y: 0,
        z: showcase.z,
        vx: 0,
        vz: 0,
        cosmeticAura: showcase.slot === "aura" ? showcase.presetId : null,
        cosmeticNameplate:
          showcase.slot === "nameplate" ? showcase.presetId : null,
        cosmeticChatBubble:
          showcase.slot === "chatBubble" ? showcase.presetId : null,
        cosmeticTrail: showcase.slot === "trail" ? showcase.presetId : null,
      };

      if (showcase.slot === "chatBubble") {
        const nameSprite = g.userData.nameSprite as THREE.Sprite | undefined;
        const nameTex = g.userData.nameTexture as THREE.CanvasTexture | undefined;
        if (nameSprite) {
          g.remove(nameSprite);
          const sm = nameSprite.material as THREE.SpriteMaterial;
          sm.map = null;
          sm.dispose();
        }
        if (nameTex) nameTex.dispose();
        delete g.userData.nameSprite;
        delete g.userData.nameTexture;
        delete g.userData.nameLabelSyncState;
        const { sprite, texture, width, height } = createChatBubbleSprite("Hello!", {
          bubblePreset: showcase.presetId,
        });
        g.add(sprite);
        const chatBubble = {
          sprite,
          mat: sprite.material as THREE.SpriteMaterial,
          tex: texture,
          width,
          height,
        };
        this.layoutGalleryChatBubble(g, chatBubble);
        this.cosmeticGalleryEntries.push({
          showcase,
          group: g,
          plaque,
          plaqueMat: plaque.material as THREE.SpriteMaterial,
          plaqueTex: (plaque.material as THREE.SpriteMaterial)
            .map as THREE.CanvasTexture,
          chatBubble,
          player,
          deployableFx: null,
        });
      } else if (showcase.slot === "nameplate") {
        this.replaceAvatarNameLabel(g, showcase.label, false, showcase.presetId);
        this.layoutGalleryHeadLabel(g);
        this.cosmeticGalleryEntries.push({
          showcase,
          group: g,
          plaque,
          plaqueMat: plaque.material as THREE.SpriteMaterial,
          plaqueTex: (plaque.material as THREE.SpriteMaterial)
            .map as THREE.CanvasTexture,
          player,
          deployableFx: null,
        });
      } else {
        this.replaceAvatarNameLabel(g, showcase.label, false, null);
        this.layoutGalleryHeadLabel(g);
        this.cosmeticGalleryEntries.push({
          showcase,
          group: g,
          plaque,
          plaqueMat: plaque.material as THREE.SpriteMaterial,
          plaqueTex: (plaque.material as THREE.SpriteMaterial)
            .map as THREE.CanvasTexture,
          player,
          deployableFx: null,
        });
      }

      const entry = this.cosmeticGalleryEntries[this.cosmeticGalleryEntries.length - 1]!;
      if (entry.group) {
        syncCosmeticLoadoutVfx(
          entry.group,
          entry.player,
          showcase.slot === "trail"
        );
      }
    }
    this.ensureGalleryTryOnUi();
    this.requestRender(400);
  }

  private static readonly GALLERY_TRY_ON_RADIUS = 2.35;

  private ensureGalleryTryOnUi(): void {
    if (this.galleryTryOnUi) return;
    const host = this.canvasHost.parentElement ?? this.canvasHost;
    const wrap = document.createElement("div");
    wrap.className = "cosmetic-gallery-tryon";
    wrap.hidden = true;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cosmetic-gallery-tryon__btn";
    btn.addEventListener("click", () => {
      if (this.galleryNearestShowcase) {
        this.tryOnGalleryShowcase(this.galleryNearestShowcase);
      }
    });
    wrap.append(btn);
    host.appendChild(wrap);
    this.galleryTryOnUi = wrap;
  }

  private removeGalleryTryOnUi(): void {
    this.galleryTryOnUi?.remove();
    this.galleryTryOnUi = null;
  }

  private isGalleryShowcaseWorn(showcase: CosmeticGalleryShowcaseWire): boolean {
    if (showcase.slot === "deployable") {
      return this.galleryTryOnDeployablePreset === showcase.presetId;
    }
    if (showcase.slot === "aura") {
      return this.galleryTryOnSlots.aura === showcase.presetId;
    }
    if (showcase.slot === "nameplate") {
      return this.galleryTryOnSlots.nameplate === showcase.presetId;
    }
    if (showcase.slot === "chatBubble") {
      return this.galleryTryOnSlots.chatBubble === showcase.presetId;
    }
    return this.galleryTryOnSlots.trail === showcase.presetId;
  }

  tryOnGalleryShowcase(showcase: CosmeticGalleryShowcaseWire): void {
    if (showcase.slot === "deployable") {
      this.galleryTryOnDeployablePreset = showcase.presetId;
      this.refreshGalleryTryOnDeployableFx();
    } else {
      this.galleryTryOnSlots[showcase.slot] = showcase.presetId;
      if (showcase.slot === "chatBubble" && this.selfAddress) {
        this.showChatBubble(this.selfAddress, "Hello!");
      }
    }
    if (this.selfPlayerSnapshot) {
      this.refreshSelfCosmeticsFromState(this.selfPlayerSnapshot);
    }
    this.showSelfPlayerActionMessage(`Trying on ${showcase.label}`);
    this.updateGalleryTryOnUi();
    this.requestRender();
  }

  private refreshGalleryTryOnDeployableFx(): void {
    this.galleryTryOnDeployableFx?.dispose();
    this.galleryTryOnDeployableFx = null;
    if (!this.galleryTryOnDeployablePreset || !this.selfMesh) return;
    this.galleryTryOnDeployableFx = attachPersistentDeployableVfx(
      this.scene,
      this.galleryTryOnDeployablePreset,
      this.selfMesh.position.x,
      this.selfMesh.position.z
    );
  }

  private updateGalleryTryOnProximity(): void {
    if (!this.cosmeticGalleryEntries.length || !this.selfMesh) {
      this.galleryNearestShowcase = null;
      this.updateGalleryTryOnUi();
      return;
    }
    const sx = this.selfMesh.position.x;
    const sz = this.selfMesh.position.z;
    let best: CosmeticGalleryShowcaseWire | null = null;
    let bestDist = Game.GALLERY_TRY_ON_RADIUS;
    for (const entry of this.cosmeticGalleryEntries) {
      const tx = entry.showcase.tryOnX ?? entry.showcase.x;
      const tz = entry.showcase.tryOnZ ?? entry.showcase.z;
      const d = Math.hypot(sx - tx, sz - tz);
      if (d < bestDist) {
        bestDist = d;
        best = entry.showcase;
      }
    }
    this.galleryNearestShowcase = best;
    this.updateGalleryTryOnUi();
  }

  private updateGalleryTryOnUi(): void {
    if (!this.galleryTryOnUi) return;
    const showcase = this.galleryNearestShowcase;
    if (!showcase) {
      this.galleryTryOnUi.hidden = true;
      return;
    }
    const btn = this.galleryTryOnUi.querySelector(
      ".cosmetic-gallery-tryon__btn"
    ) as HTMLButtonElement | null;
    if (!btn) return;
    const worn = this.isGalleryShowcaseWorn(showcase);
    btn.textContent = worn ? `Wearing: ${showcase.label}` : `Try it on: ${showcase.label}`;
    btn.classList.toggle("cosmetic-gallery-tryon__btn--active", worn);
    this.galleryTryOnUi.hidden = false;
  }

  private clearGalleryTryOnState(): void {
    this.galleryNearestShowcase = null;
    this.galleryTryOnDeployablePreset = null;
    this.galleryTryOnDeployableFx?.dispose();
    this.galleryTryOnDeployableFx = null;
    this.galleryTryOnSlots = {};
    this.removeGalleryTryOnUi();
    if (this.selfPlayerSnapshot) {
      this.refreshSelfCosmeticsFromState(this.selfPlayerSnapshot);
    }
  }

  private clearCosmeticGallery(): void {
    this.clearGalleryTryOnState();
    if (this.cosmeticGalleryEntries.length === 0) return;
    for (const entry of this.cosmeticGalleryEntries) {
      entry.plaque.removeFromParent();
      entry.plaqueMat.map = null;
      entry.plaqueMat.dispose();
      entry.plaqueTex.dispose();
      entry.deployableFx?.dispose();
      if (entry.chatBubble) {
        entry.chatBubble.sprite.removeFromParent();
        entry.chatBubble.mat.map = null;
        entry.chatBubble.mat.dispose();
        entry.chatBubble.tex.dispose();
      }
      if (entry.group) {
        disposeCosmeticTrailPuffs(entry.group);
        this.disposeAvatarGroup(entry.group);
        this.scene.remove(entry.group);
      }
    }
    this.cosmeticGalleryEntries.length = 0;
    this.markSceneMutation("cosmeticGallery:clear");
  }

  private updateAvatarCosmeticTrails(now: number): boolean {
    let active = false;
    if (this.selfMesh) {
      const g = this.selfMesh;
      // Movement-gated for the local player everywhere (gallery included): standing still
      // emits nothing, so trails only appear on tiles you actually walk over.
      tickCosmeticTrailForAvatar(
        this.scene,
        g,
        g.position.x,
        g.position.y,
        g.position.z,
        now
      );
      if (updateCosmeticTrailPuffsForGroup(g, now)) active = true;
      if (updateCosmeticAuraForGroup(g, now)) active = true;
    }
    for (const g of this.others.values()) {
      tickCosmeticTrailForAvatar(
        this.scene,
        g,
        g.position.x,
        g.position.y,
        g.position.z,
        now
      );
      if (updateCosmeticTrailPuffsForGroup(g, now)) active = true;
      if (updateCosmeticAuraForGroup(g, now)) active = true;
    }
    return active;
  }

  private makeGalleryFloorPlaque(label: string): THREE.Sprite {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const font = "600 22px 'Muli', sans-serif";
    ctx.font = font;
    const text =
      label.length > 28 ? `${label.slice(0, 26)}…` : label;
    const padX = 10;
    const w = Math.ceil(ctx.measureText(text).width + padX * 2);
    const h = 30;
    canvas.width = w;
    canvas.height = h;
    ctx.font = font;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(12, 16, 24, 0.82)";
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 6);
    ctx.fill();
    ctx.strokeStyle = "rgba(148, 163, 184, 0.45)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText(text, w / 2, h / 2 + 0.5);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.renderOrder = 998;
    // Fixed world HEIGHT (not width) so the plaque text stays the same size regardless of how
    // long the preset name is; width follows the texture aspect ratio.
    const worldH = 0.34;
    sprite.scale.set(worldH * (w / h), worldH, 1);
    return sprite;
  }

  /**
   * Size a gallery mannequin's head label to a constant on-screen height regardless of text
   * length (unlike {@link syncNameLabelScaleAndPosition}, which shrinks height to fit width and
   * makes long preset names hard to read). Position sits just below the identicon like a real
   * nameplate.
   */
  private layoutGalleryHeadLabel(g: THREE.Group): void {
    const nameSprite = g.userData.nameSprite as THREE.Sprite | undefined;
    if (!nameSprite) return;
    const tw = nameSprite.userData.nameLabelTexW as number | undefined;
    const th = nameSprite.userData.nameLabelTexH as number | undefined;
    if (!tw || !th) return;
    nameSprite.visible = true;
    const worldH = this.pixelToWorldY(NAME_LABEL_SCREEN_HEIGHT_PX);
    const worldW = worldH * (tw / th);
    nameSprite.scale.set(worldW, worldH, 1);
    const gapWorld = this.pixelToWorldY(NAME_GAP_BELOW_IDENTICON_PX);
    nameSprite.position.y = -gapWorld - worldH / 2;
  }

  /**
   * Size the gallery chat-bubble demo with the same screen-relative scaling real chat bubbles
   * use ({@link syncChatBubbleScaleAndPosition}), so it matches in-game bubbles and the nameplate
   * demo rather than a fixed world size that looks oversized when zoomed in.
   */
  private layoutGalleryChatBubble(
    g: THREE.Group,
    chatBubble: {
      sprite: THREE.Sprite;
      width: number;
      height: number;
    }
  ): void {
    const tw = chatBubble.width;
    const th = chatBubble.height;
    const targetScreenHeight = Math.max(CHAT_BUBBLE_MIN_HEIGHT_PX, th);
    const worldH = this.pixelToWorldY(targetScreenHeight);
    let worldW = worldH * (tw / th);
    const maxW = this.pixelToWorldX(CHAT_MAX_WIDTH_SCREEN_PX);
    if (worldW > maxW) worldW = maxW;
    chatBubble.sprite.scale.set(worldW, worldH, 1);
    const avatarTop = this.avatarIdenticonWorldDiameter();
    chatBubble.sprite.position.set(0, avatarTop + 0.12 + worldH / 2, 0);
    chatBubble.sprite.renderOrder = 1000;
  }

  private updateCosmeticGallery(dt: number): boolean {
    if (this.cosmeticGalleryEntries.length === 0) return false;
    const now = performance.now();
    let active = false;
    this.updateGalleryTryOnProximity();
    if (this.galleryTryOnDeployableFx?.root && this.selfMesh) {
      this.galleryTryOnDeployableFx.root.position.set(
        this.selfMesh.position.x,
        0,
        this.selfMesh.position.z
      );
      this.galleryTryOnDeployableFx.root.rotation.y = now * 0.00035;
      active = true;
    }
    for (const entry of this.cosmeticGalleryEntries) {
      if (entry.showcase.kind === "floor") {
        if (entry.deployableFx?.root) {
          entry.deployableFx.root.rotation.y = now * 0.00035;
          active = true;
        }
        continue;
      }
      const g = entry.group;
      if (!g) continue;
      if (updateCosmeticAuraForGroup(g, now)) active = true;
      const pace = entry.showcase.trailPaceTiles;
      if (pace && pace > 0) {
        if (entry.galleryLaneDir === undefined) entry.galleryLaneDir = 1;
        const zMin = entry.showcase.z;
        const zMax = entry.showcase.z + pace;
        let nz = g.position.z + entry.galleryLaneDir * SERVER_PLAYER_MOVE_SPEED * dt;
        if (nz >= zMax) {
          nz = zMax;
          entry.galleryLaneDir = -1;
        } else if (nz <= zMin) {
          nz = zMin;
          entry.galleryLaneDir = 1;
        }
        g.position.x = entry.showcase.x;
        g.position.z = nz;
        entry.player.x = g.position.x;
        entry.player.z = g.position.z;
        active = true;
        syncCosmeticLoadoutVfx(g, entry.player, true);
        const trailPreset = cosmeticTrailPresetForGroup(g);
        if (trailPreset) {
          tickCosmeticTrailForAvatar(
            this.scene,
            g,
            g.position.x,
            g.position.y,
            g.position.z,
            now
          );
          if (updateCosmeticTrailPuffsForGroup(g, now)) active = true;
        }
      }
      // Keep labels at a constant on-screen size at any zoom (gallery groups are not in
      // `this.others`, so they miss the normal name-label refresh and would otherwise freeze
      // at whatever scale the zoom happened to be when the room loaded).
      if (g.userData.nameSprite) this.layoutGalleryHeadLabel(g);
      if (entry.chatBubble) {
        this.layoutGalleryChatBubble(g, entry.chatBubble);
      }
    }
    return active;
  }
}
