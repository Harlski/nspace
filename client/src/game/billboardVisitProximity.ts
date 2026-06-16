import { billboardFootprintTilesXZ } from "./billboardFootprintMath.js";
import type { BillboardState } from "../net/ws.js";
import { getBillboardAdvertById } from "./billboardAdvertsCatalog.js";
import { campaignIdForBillboardSlide } from "./campaignBillboardVisibility.js";
import { billboardSlideshowPhaseIndex } from "./billboardSlideshowPhase.js";
import { miniappTargetToHttpsUrl } from "../net/miniappDeepLink.js";

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
): { visitName: string; visitUrl: string; miniappTargetUrl?: string } | null {
  const n = Math.max(1, b.slides.length);
  const idx = ((slideIdx % n) + n) % n;
  const wireNames = b.slideVisitNames;
  const wireUrls = b.slideVisitUrls;
  const wireMinis = b.slideMiniappTargetUrls;
  if (Array.isArray(wireUrls) && wireUrls.length === n) {
    const visitUrl = String(wireUrls[idx] ?? "").trim();
    const miniRaw = Array.isArray(wireMinis)
      ? String(wireMinis[idx] ?? "").trim()
      : "";
    const visitName = Array.isArray(wireNames)
      ? String(wireNames[idx] ?? "").trim()
      : "";
    const miniappTargetUrl = miniRaw || undefined;
    const resolvedUrl =
      visitUrl ||
      (miniappTargetUrl ? miniappTargetToHttpsUrl(miniappTargetUrl) : "");
    if (resolvedUrl || miniappTargetUrl) {
      return {
        visitName: visitName || "link",
        visitUrl: resolvedUrl,
        miniappTargetUrl,
      };
    }
  }
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
    const mini = String(e?.miniappTargetUrl ?? "").trim();
    const u = String(e?.visitUrl ?? "").trim();
    const wireMini = String(b.miniappTargetUrl ?? "").trim();
    const wireVisit = String(b.visitUrl ?? "").trim();
    const miniappTargetUrl = mini || wireMini || undefined;
    const visitUrl =
      u ||
      wireVisit ||
      (miniappTargetUrl ? miniappTargetToHttpsUrl(miniappTargetUrl) : "");
    if (visitUrl || miniappTargetUrl) {
      return {
        visitUrl,
        miniappTargetUrl,
        visitName: String(e?.name ?? "").trim() || "link",
      };
    }
  }
  const wireMini = String(b.miniappTargetUrl ?? "").trim();
  const fallbackUrl = String(b.visitUrl ?? "").trim();
  const visitUrl =
    fallbackUrl || (wireMini ? miniappTargetToHttpsUrl(wireMini) : "");
  if (!visitUrl && !wireMini) return null;
  return {
    visitUrl,
    miniappTargetUrl: wireMini || undefined,
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
): {
  id: string;
  campaignId?: string;
  visitName: string;
  visitUrl: string;
  miniappTargetUrl?: string;
} | null {
  let best: {
    id: string;
    campaignId?: string;
    visitName: string;
    visitUrl: string;
    miniappTargetUrl?: string;
  } | null = null;
  for (const b of billboards) {
    const slideIdx = billboardSlideshowPhaseIndex(b, nowMs);
    const hit = resolveBillboardVisitForSlideIndex(b, slideIdx);
    if (!hit?.visitUrl && !hit?.miniappTargetUrl) continue;
    const tiles = billboardFootprintTilesXZ(
      b.anchorX,
      b.anchorZ,
      b.orientation,
      b.yawSteps
    );
    const onTile = tiles.some((t) => t.x === tileX && t.z === tileZ);
    if (!onTile) continue;
    if (!best || b.id < best.id) {
      const campaignId = campaignIdForBillboardSlide(b, slideIdx) ?? undefined;
      best = {
        id: b.id,
        campaignId,
        visitName: hit.visitName,
        visitUrl: hit.visitUrl,
        miniappTargetUrl: hit.miniappTargetUrl,
      };
    }
  }
  return best;
}
