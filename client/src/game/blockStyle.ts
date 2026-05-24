/** Legacy preset table — migration only; new blocks use `colorRgb` from the hue ring. */
const LEGACY_BLOCK_COLOR_PALETTE: readonly number[] = [
  0x5b6b8c,
  0xc94c4c,
  0x4caf50,
  0x2196f3,
  0xffc107,
  0x9c27b0,
  0x795548,
  0x00bcd4,
  0xff9800,
  0xe9b213,
  0xe91e63,
  0x8bc34a,
  0x3f51b5,
  0x009688,
  0x37474f,
  0xfff8e1,
];

export const DEFAULT_BLOCK_COLOR_RGB = 0x5b6b8c;
export const DEFAULT_GATE_BLOCK_COLOR_RGB = 0x795548;
/** Canvas exit portal / teleporter slab (legacy `colorId` 4). */
export const BLOCK_COLOR_EXIT_PORTAL_RGB = 0xffc107;

export function clampColorRgb(v: number): number {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return DEFAULT_BLOCK_COLOR_RGB;
  return Math.max(0, Math.min(0xffffff, n));
}

/** Parse `#RRGGBB` or `RRGGBB`; returns `fallback` when invalid. */
export function parseColorRgbHex(
  raw: string,
  fallback: number = DEFAULT_BLOCK_COLOR_RGB
): number {
  const parsed = tryParseColorRgbHex(raw);
  return parsed ?? fallback;
}

/** Strict parse: `#RGB` or `#RRGGBB` (optional `#`). */
export function tryParseColorRgbHex(raw: string): number | null {
  const v = raw.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{6}$/.test(v)) {
    return clampColorRgb(Number.parseInt(v, 16));
  }
  if (/^[0-9a-fA-F]{3}$/.test(v)) {
    const r = v[0]! + v[0]!;
    const g = v[1]! + v[1]!;
    const b = v[2]! + v[2]!;
    return clampColorRgb(Number.parseInt(r + g + b, 16));
  }
  return null;
}

/**
 * Loose parse while typing (pads partial digits with `0` for live preview).
 * Returns `null` when the string is empty or not hex-like.
 */
export function previewColorRgbHex(raw: string): number | null {
  const v = raw.trim().replace(/^#/, "");
  if (v.length === 0 || !/^[0-9a-fA-F]*$/.test(v) || v.length > 6) {
    return null;
  }
  const padded = v.padEnd(6, "0").slice(0, 6);
  return clampColorRgb(Number.parseInt(padded, 16));
}

/** `#rrggbb` for display in hex inputs. */
export function formatColorRgbHex(n: number): string {
  const c = clampColorRgb(n);
  return `#${formatColorRgbHexDigits(c)}`;
}

/** Six hex digits only (no `#`), lowercase. */
export function formatColorRgbHexDigits(n: number): string {
  return clampColorRgb(n).toString(16).padStart(6, "0");
}

/** Strip to at most six `[0-9a-f]` digits for the popover field. */
export function sanitizeHexColorDigits(raw: string): string {
  return raw.replace(/[^0-9a-fA-F]/g, "").slice(0, 6).toLowerCase();
}

export function legacyPaletteRgb(colorId: number): number {
  const id = Math.max(
    0,
    Math.min(LEGACY_BLOCK_COLOR_PALETTE.length - 1, Math.floor(colorId))
  );
  return LEGACY_BLOCK_COLOR_PALETTE[id]!;
}

export function resolveBlockColorRgb(props: {
  colorRgb?: number;
  colorId?: number;
}): number {
  const raw = props.colorRgb;
  if (raw !== undefined && Number.isFinite(Number(raw))) {
    return clampColorRgb(Number(raw));
  }
  return legacyPaletteRgb(props.colorId ?? 0);
}

/** @deprecated Use {@link resolveBlockColorRgb}. */
export function blockColorHex(colorId: number): number {
  return legacyPaletteRgb(colorId);
}

/** HSL with `h`,`s`,`l` in 0–1; returns sRGB 0–255 per channel. */
export function hslToRgb(
  h: number,
  s: number,
  l: number
): { r: number; g: number; b: number } {
  if (s <= 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const hue2rgb = (p: number, q: number, t: number): number => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = hue2rgb(p, q, h + 1 / 3);
  const g = hue2rgb(p, q, h);
  const b = hue2rgb(p, q, h - 1 / 3);
  return {
    r: Math.round(Math.min(255, Math.max(0, r * 255))),
    g: Math.round(Math.min(255, Math.max(0, g * 255))),
    b: Math.round(Math.min(255, Math.max(0, b * 255))),
  };
}

/** Build ring color: full saturation, fixed lightness (matches build hue ring). */
export function hueDegToBlockColorRgb(hueDeg: number): number {
  const h = (((hueDeg % 360) + 360) % 360) / 360;
  const { r, g, b } = hslToRgb(h, 1, 0.52);
  return (r << 16) | (g << 8) | b;
}

export function blockColorRgbToHueDeg(rgb: number): number {
  const c = clampColorRgb(rgb);
  const r = ((c >> 16) & 0xff) / 255;
  const g = ((c >> 8) & 0xff) / 255;
  const b = (c & 0xff) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return Math.round((h / 6) * 360) % 360;
}

/** Room sky tint HSL — matches `Game.setRoomSceneBackground` (not block ring S/L). */
export const ROOM_SCENE_BG_HSL_S = 0.42;
export const ROOM_SCENE_BG_HSL_L = 0.11;

export const ROOM_BG_NEUTRAL_RGB = {
  black: 0x070a0f,
  white: 0xd4dce8,
  gray: 0x2a313c,
} as const;

/** RGB for the room-bg hue ring core at the given hue (fixed S/L). */
export function roomBgHueDegToRgb(hueDeg: number): number {
  const h = (((hueDeg % 360) + 360) % 360) / 360;
  const { r, g, b } = hslToRgb(h, ROOM_SCENE_BG_HSL_S, ROOM_SCENE_BG_HSL_L);
  return (r << 16) | (g << 8) | b;
}

export type RoomBgNeutralId = keyof typeof ROOM_BG_NEUTRAL_RGB;

export type RoomBgColorFromRgb =
  | { mode: "neutral"; neutral: RoomBgNeutralId }
  | { mode: "hue"; hueDeg: number };

/**
 * Map a hex RGB to room sky storage: neutrals for grayscale, else hue tint.
 * Avoids `blockColorRgbToHueDeg` returning 0° (red) for #000 / #fff.
 */
export function roomBgColorFromRgb(rgb: number): RoomBgColorFromRgb {
  const c = clampColorRgb(rgb);
  const r = ((c >> 16) & 0xff) / 255;
  const g = ((c >> 8) & 0xff) / 255;
  const b = (c & 0xff) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s =
    max === 0 || d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));

  if (s < 0.1 || max === min) {
    if (l <= 0.12) return { mode: "neutral", neutral: "black" };
    if (l >= 0.62) return { mode: "neutral", neutral: "white" };
    return { mode: "neutral", neutral: "gray" };
  }
  return { mode: "hue", hueDeg: blockColorRgbToHueDeg(c) };
}

export type BlockStyleProps = {
  passable: boolean;
  half: boolean;
  quarter: boolean;
  hex: boolean;
  pyramid: boolean;
  pyramidBaseScale?: number;
  hexRadiusScale?: number;
  sphere: boolean;
  /** When `sphere`: radius multiplier (1 = default). */
  sphereRadiusScale?: number;
  ramp: boolean;
  rampDir: number;
  /**
   * Plain cube only: 0–3 = 0°, 90°, 180°, 270° on each axis (visual only; walk height unchanged).
   */
  cubeRotX?: number;
  cubeRotY?: number;
  cubeRotZ?: number;
  /** @deprecated Migrated to `cubeRotX` on load (`1` → one 90° X step). */
  cubePitch?: number;
  /** Block tint 0xRRGGBB (hue ring). */
  colorRgb: number;
  /** Legacy persisted index; ignored when `colorRgb` is set on wire. */
  colorId?: number;
  locked?: boolean;
  signboardId?: string;
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
    adminAddress?: string;
    authorizedAddress?: string;
    authorizedAddresses?: string[];
    exitX: number;
    exitZ: number;
  };
  gateOpen?: {
    openedBy: string;
    untilMs: number;
  };
  claimable?: boolean;
  active?: boolean;
  cooldownMs?: number;
  lastClaimedAt?: number;
  claimedBy?: string;
};

export const PYRAMID_BASE_SCALE_MIN = 1;
export const PYRAMID_BASE_SCALE_MAX = 1.65;

export function clampPyramidBaseScale(v: number): number {
  const x = Number(v);
  if (!Number.isFinite(x)) return 1;
  return Math.max(
    PYRAMID_BASE_SCALE_MIN,
    Math.min(PYRAMID_BASE_SCALE_MAX, x)
  );
}

export const HEX_RADIUS_SCALE_MIN = 0.25;
export const HEX_RADIUS_SCALE_MAX = 1;
export const SPHERE_RADIUS_SCALE_MIN = 0.25;
export const SPHERE_RADIUS_SCALE_MAX = 1;

export function clampHexRadiusScale(v: number): number {
  const x = Number(v);
  if (!Number.isFinite(x)) return 1;
  return Math.max(
    HEX_RADIUS_SCALE_MIN,
    Math.min(HEX_RADIUS_SCALE_MAX, x)
  );
}

export function clampSphereRadiusScale(v: number): number {
  const x = Number(v);
  if (!Number.isFinite(x)) return 1;
  return Math.max(
    SPHERE_RADIUS_SCALE_MIN,
    Math.min(SPHERE_RADIUS_SCALE_MAX, x)
  );
}

/** True when terrain props are a plain cube (not hex / pyramid / sphere / ramp). */
export function isPlainCubeTerrain(parts: {
  hex: boolean;
  pyramid: boolean;
  sphere: boolean;
  ramp: boolean;
}): boolean {
  return !parts.hex && !parts.pyramid && !parts.sphere && !parts.ramp;
}

export function clampCubePitch(v: unknown): number {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n !== 1) return 0;
  return 1;
}

export type CubeRotation = {
  cubeRotX: number;
  cubeRotY: number;
  cubeRotZ: number;
};

/** Plain-cube orientation step: 0–3 (multiples of 90°). */
export function clampCubeRotStep(v: unknown): number {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return 0;
  return ((n % 4) + 4) % 4;
}

export function cubeRotStepLabel(step: number): string {
  const s = clampCubeRotStep(step);
  return s === 0 ? "0°" : `${s * 90}°`;
}

/** Read persisted cube orientation; migrates legacy `cubePitch`. */
export function normalizeCubeRotation(src: {
  cubeRotX?: unknown;
  cubeRotY?: unknown;
  cubeRotZ?: unknown;
  cubePitch?: unknown;
}): CubeRotation {
  const rotX =
    src.cubeRotX !== undefined
      ? clampCubeRotStep(src.cubeRotX)
      : clampCubePitch(src.cubePitch) === 1
        ? 1
        : 0;
  return {
    cubeRotX: rotX,
    cubeRotY: clampCubeRotStep(src.cubeRotY ?? 0),
    cubeRotZ: clampCubeRotStep(src.cubeRotZ ?? 0),
  };
}

export function applyPlainCubeMeshRotation(
  rotation: { order: string; x: number; y: number; z: number },
  rot: CubeRotation
): void {
  rotation.order = "XYZ";
  rotation.x = clampCubeRotStep(rot.cubeRotX) * (Math.PI / 2);
  rotation.y = clampCubeRotStep(rot.cubeRotY) * (Math.PI / 2);
  rotation.z = clampCubeRotStep(rot.cubeRotZ) * (Math.PI / 2);
}

export function cubeRotationForPlainCube(
  parts: { hex: boolean; pyramid: boolean; sphere: boolean; ramp: boolean },
  src: {
    cubeRotX?: unknown;
    cubeRotY?: unknown;
    cubeRotZ?: unknown;
    cubePitch?: unknown;
  }
): CubeRotation {
  if (!isPlainCubeTerrain(parts)) {
    return { cubeRotX: 0, cubeRotY: 0, cubeRotZ: 0 };
  }
  return normalizeCubeRotation(src);
}

export function normalizeBlockPrismParts(input: {
  hex?: boolean;
  pyramid?: boolean;
  sphere?: boolean;
  ramp?: boolean;
}): { hex: boolean; pyramid: boolean; sphere: boolean; ramp: boolean } {
  const ramp = Boolean(input.ramp);
  if (ramp) return { hex: false, pyramid: false, sphere: false, ramp: true };
  const sphere = Boolean(input.sphere);
  if (sphere) return { hex: false, pyramid: false, sphere: true, ramp: false };
  const pyramid = Boolean(input.pyramid);
  if (pyramid) return { hex: false, pyramid: true, sphere: false, ramp: false };
  return { hex: Boolean(input.hex), pyramid: false, sphere: false, ramp: false };
}
