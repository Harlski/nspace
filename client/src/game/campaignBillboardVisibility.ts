import type { BillboardState } from "../net/ws.js";
import { billboardPlaneCenterXZ } from "./billboardFootprintMath.js";
import { billboardSlideshowPhaseIndex } from "./billboardSlideshowPhase.js";

/** Player within this many floor tiles of a billboard center counts as viewing. */
export const CAMPAIGN_BILLBOARD_VISIBILITY_RADIUS_TILES = 14;

/** No pointer/keyboard activity for this long → not counted (tab-hidden is separate). */
export const CAMPAIGN_VIEWER_AFK_MS = 2 * 60 * 1000;

export function campaignIdForBillboardSlide(
  b: BillboardState,
  slideIdx: number
): string | null {
  const n = Math.max(1, b.slides.length);
  const idx = ((slideIdx % n) + n) % n;
  const wire = b.slideCampaignIds;
  if (Array.isArray(wire) && wire.length > 0) {
    const mapped =
      wire.length === n
        ? String(wire[idx] ?? "").trim()
        : wire.length === 1
          ? String(wire[0] ?? "").trim()
          : String(wire[idx % wire.length] ?? "").trim();
    if (mapped) return mapped;
  }
  const single = String(b.campaignId ?? "").trim();
  return single || null;
}

function distanceTiles(
  playerX: number,
  playerZ: number,
  centerX: number,
  centerZ: number
): number {
  return Math.hypot(playerX - centerX, playerZ - centerZ);
}

/**
 * Campaign ids currently on screen for this player (within radius, active slide).
 * Returns a set — multiple billboards showing the same campaign count once per tick.
 */
export function visibleCampaignIdsNearPlayer(
  billboards: Iterable<BillboardState>,
  playerX: number,
  playerZ: number,
  nowMs: number,
  radiusTiles: number = CAMPAIGN_BILLBOARD_VISIBILITY_RADIUS_TILES
): Set<string> {
  const out = new Set<string>();
  const r = Math.max(1, radiusTiles);
  for (const b of billboards) {
    const { cx, cz } = billboardPlaneCenterXZ(
      b.anchorX,
      b.anchorZ,
      b.orientation,
      b.yawSteps
    );
    if (distanceTiles(playerX, playerZ, cx, cz) > r) continue;
    const slideIdx = billboardSlideshowPhaseIndex(b, nowMs);
    const campaignId = campaignIdForBillboardSlide(b, slideIdx);
    if (campaignId) out.add(campaignId);
  }
  return out;
}
