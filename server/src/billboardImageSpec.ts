/**
 * Billboard face proportions for advert uploads and `/advertise` preview.
 * Keep aligned with `client/src/game/billboardVisual.ts` (`billboardFaceSize`) and
 * `BLOCK_SIZE` (0.82) in `client/src/game/Game.ts`.
 */
import {
  BILLBOARD_FACE_HEIGHT_TILES,
  BILLBOARD_HORIZONTAL_WIDTH_TILES,
  BILLBOARD_VERTICAL_WIDTH_TILES,
} from "./billboards.js";

/** World-unit block edge length (matches client `BLOCK_SIZE`). */
export const BILLBOARD_BLOCK_SIZE_WORLD = 0.82;

export type BillboardOrientation = "horizontal" | "vertical";

/** Width ÷ height of the textured plane (not tile count). */
export function billboardFaceAspectRatio(
  orientation: BillboardOrientation
): number {
  const faceW =
    orientation === "horizontal"
      ? BILLBOARD_HORIZONTAL_WIDTH_TILES
      : BILLBOARD_VERTICAL_WIDTH_TILES;
  const faceH = BILLBOARD_FACE_HEIGHT_TILES * BILLBOARD_BLOCK_SIZE_WORLD;
  return faceW / faceH;
}

/** Paid Hub competition slots use horizontal billboards today. */
export const PAID_BILLBOARD_ORIENTATION: BillboardOrientation = "horizontal";

/**
 * Recommended upload size for horizontal billboards.
 * Matches existing art (`client/public/nimiq-bb.png` is 1598×984).
 */
export const BILLBOARD_RECOMMENDED_UPLOAD_PX = {
  width: 1600,
  height: 984,
} as const;

export function billboardImageSpecForApi(): {
  orientation: BillboardOrientation;
  footprintLabel: string;
  recommendedWidthPx: number;
  recommendedHeightPx: number;
  aspectRatio: number;
  aspectLabel: string;
  formatLabels: string;
} {
  const orientation = PAID_BILLBOARD_ORIENTATION;
  const ar = billboardFaceAspectRatio(orientation);
  const rec = BILLBOARD_RECOMMENDED_UPLOAD_PX;
  return {
    orientation,
    footprintLabel: `${BILLBOARD_HORIZONTAL_WIDTH_TILES} floor tiles wide × ${BILLBOARD_FACE_HEIGHT_TILES} blocks tall`,
    recommendedWidthPx: rec.width,
    recommendedHeightPx: rec.height,
    aspectRatio: Number(ar.toFixed(4)),
    aspectLabel: "≈ 1.62∶1",
    formatLabels: "PNG, JPEG, or WebP",
  };
}
