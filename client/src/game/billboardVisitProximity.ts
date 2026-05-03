import { billboardFootprintTilesXZ } from "./billboardFootprintMath.js";
import type { BillboardState } from "../net/ws.js";
import { getBillboardAdvertById } from "./billboardAdvertsCatalog.js";
import { billboardSlideshowPhaseIndex } from "./billboardSlideshowPhase.js";

function billboardAdvertKeyRing(b: BillboardState): string[] {
  const raw = b.advertIds;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((x) => String(x ?? "").trim()).filter(Boolean);
  }
  const one = String(b.advertId ?? "").trim();
  return one ? [one] : [];
}

function resolveBillboardVisitForSlideIndex(
  b: BillboardState,
  slideIdx: number
): { visitName: string; visitUrl: string } | null {
  const n = Math.max(1, b.slides.length);
  const idx = ((slideIdx % n) + n) % n;
  const keys = billboardAdvertKeyRing(b);
  let key: string | undefined;
  if (keys.length === n) {
    key = keys[idx];
  } else if (keys.length === 1) {
    key = keys[0];
  } else if (keys.length > 1) {
    key = keys[idx % keys.length];
  }
  if (key) {
    const e = getBillboardAdvertById(key);
    const u = String(e?.visitUrl ?? "").trim();
    if (u) {
      return {
        visitUrl: u,
        visitName: String(e?.name ?? "").trim() || "link",
      };
    }
  }
  const fallbackUrl = String(b.visitUrl ?? "").trim();
  if (!fallbackUrl) return null;
  return {
    visitUrl: fallbackUrl,
    visitName: String(b.visitName ?? "").trim() || "link",
  };
}

/**
 * If the player’s feet tile is one of the billboard’s footprint tiles and the
 * active slide has a visit URL, returns that billboard (stable tie-break by id).
 */
export function pickBillboardVisitOnFootprintTile(
  tileX: number,
  tileZ: number,
  billboards: Iterable<BillboardState>,
  nowMs: number
): { id: string; visitName: string; visitUrl: string } | null {
  let best: { id: string; visitName: string; visitUrl: string } | null = null;
  for (const b of billboards) {
    const slideIdx = billboardSlideshowPhaseIndex(b, nowMs);
    const hit = resolveBillboardVisitForSlideIndex(b, slideIdx);
    if (!hit?.visitUrl) continue;
    const tiles = billboardFootprintTilesXZ(
      b.anchorX,
      b.anchorZ,
      b.orientation,
      b.yawSteps
    );
    const onTile = tiles.some((t) => t.x === tileX && t.z === tileZ);
    if (!onTile) continue;
    if (!best || b.id < best.id) {
      best = { id: b.id, visitName: hit.visitName, visitUrl: hit.visitUrl };
    }
  }
  return best;
}
