/**
 * Dev-only Preset Gallery room — one showcase per Preset, join code SPACER.
 * See CONTEXT.md (Preset Gallery).
 */
import {
  listCosmeticPresets,
  type CosmeticPreset,
  type CosmeticSlot,
} from "./cosmeticPresets.js";
import { normalizeJoinCode } from "./joinCode.js";

export const COSMETIC_GALLERY_ROOM_ID = "cosmetic-gallery";
export const COSMETIC_GALLERY_JOIN_CODE = "SPACER";

export const COSMETIC_GALLERY_BOUNDS = {
  minX: -13,
  maxX: 17,
  minZ: -17,
  maxZ: 29,
} as const;

/** Visitor spawn west of the trail lanes, facing along the map length. */
export const COSMETIC_GALLERY_DEFAULT_SPAWN = { x: -10, z: -14 } as const;

/** Parallel lanes along map length (+Z); tighter spacing between lanes (+X). */
const TRAIL_LANE_SPACING = 1.8;
const TRAIL_LANE_Z_MIN = -14;
const TRAIL_LANE_Z_MAX = 26;
/** How far each trail mannequin paces along +Z from its lane start (quarter of map length). */
const TRAIL_PACE_SPAN = (TRAIL_LANE_Z_MAX - TRAIL_LANE_Z_MIN) / 4;
/** Tiles south of lane start where the try-on prompt appears. */
const TRY_ON_SOUTH_OFFSET = 2.2;

const OTHER_COLUMNS = 3;
const OTHER_COLUMN_SPACING = 5;
const OTHER_ROW_SPACING = 5;
const OTHER_ORIGIN_X = -8;
const OTHER_ORIGIN_Z = 0;

export type CosmeticGalleryShowcaseWire = {
  id: string;
  presetId: string;
  label: string;
  slot: CosmeticSlot;
  fakeAddress: string;
  x: number;
  z: number;
  kind: "mannequin" | "floor";
  trailPaceTiles?: number;
  tryOnX?: number;
  tryOnZ?: number;
};

export type CosmeticGalleryWire = {
  showcases: CosmeticGalleryShowcaseWire[];
};

/**
 * The Shaper (room id `cosmetic-gallery`, join code `SPACER`) is the player-facing in-world
 * cosmetic showroom and is reachable in every environment by default. It is still not listed
 * in the public room browser. Operators can hide it while it is unfinished by setting
 * `SHAPER_ENABLED=0`.
 */
export function isCosmeticGalleryEnabled(): boolean {
  return process.env.SHAPER_ENABLED !== "0";
}

export function isCosmeticGalleryRoom(roomId: string): boolean {
  if (!isCosmeticGalleryEnabled()) return false;
  return roomId.trim().toLowerCase() === COSMETIC_GALLERY_ROOM_ID;
}

export function resolveCosmeticGalleryJoinCode(raw: string): string | null {
  if (!isCosmeticGalleryEnabled()) return null;
  if (normalizeJoinCode(raw) !== COSMETIC_GALLERY_JOIN_CODE) return null;
  return COSMETIC_GALLERY_ROOM_ID;
}

export function galleryFakeAddress(presetId: string, index: number): string {
  const slug = presetId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
  const padded = (slug + "xxxxxxxx").slice(0, 8);
  const idx = String(index).padStart(2, "0");
  return `NQ07GALL${padded}${idx}PRESET00000000`.slice(0, 36);
}

function pushShowcase(
  showcases: CosmeticGalleryShowcaseWire[],
  preset: CosmeticPreset,
  index: number,
  x: number,
  z: number,
  opts?: {
    trailPaceTiles?: number;
    tryOnX?: number;
    tryOnZ?: number;
  }
): void {
  const deployable = preset.slot === "deployable";
  showcases.push({
    id: `gallery-${preset.presetId}`,
    presetId: preset.presetId,
    label: preset.label,
    slot: preset.slot,
    fakeAddress: galleryFakeAddress(preset.presetId, index),
    x,
    z,
    kind: deployable ? "floor" : "mannequin",
    ...(opts?.trailPaceTiles ? { trailPaceTiles: opts.trailPaceTiles } : {}),
    ...(opts?.tryOnX !== undefined ? { tryOnX: opts.tryOnX } : {}),
    ...(opts?.tryOnZ !== undefined ? { tryOnZ: opts.tryOnZ } : {}),
  });
}

export function buildCosmeticGalleryPayload(): CosmeticGalleryWire {
  const presets = listCosmeticPresets();
  const trails = presets.filter((p) => p.slot === "trail");
  const others = presets.filter((p) => p.slot !== "trail");
  const showcases: CosmeticGalleryShowcaseWire[] = [];
  let index = 0;

  const trailCount = trails.length;
  const trailSpan = Math.max(0, (trailCount - 1) * TRAIL_LANE_SPACING);
  const trailOriginX = -trailSpan / 2;
  for (let i = 0; i < trails.length; i++) {
    const laneX = trailOriginX + i * TRAIL_LANE_SPACING;
    pushShowcase(showcases, trails[i]!, index++, laneX, TRAIL_LANE_Z_MIN, {
      trailPaceTiles: TRAIL_PACE_SPAN,
      tryOnX: laneX,
      tryOnZ: TRAIL_LANE_Z_MIN - TRY_ON_SOUTH_OFFSET,
    });
  }

  for (let i = 0; i < others.length; i++) {
    const preset = others[i]!;
    const col = i % OTHER_COLUMNS;
    const row = Math.floor(i / OTHER_COLUMNS);
    const ox = OTHER_ORIGIN_X + col * OTHER_COLUMN_SPACING;
    const oz = OTHER_ORIGIN_Z + row * OTHER_ROW_SPACING;
    pushShowcase(showcases, preset, index++, ox, oz, {
      tryOnX: ox,
      tryOnZ: oz + TRY_ON_SOUTH_OFFSET,
    });
  }

  return { showcases };
}

export function cosmeticGalleryWelcomeExtras(
  roomId: string
): { cosmeticGallery?: CosmeticGalleryWire } {
  if (!isCosmeticGalleryRoom(roomId)) return {};
  return { cosmeticGallery: buildCosmeticGalleryPayload() };
}
