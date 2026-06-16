import { getBillboardAdvertById } from "./billboardAdvertsCatalog.js";
import { isAllowedBillboardImageUrl } from "./billboards.js";
import type { CampaignPublic } from "./campaignStore.js";
import { getCampaignById } from "./campaignStore.js";
import {
  getRotationSetById,
  type RotationSetItemPublic,
  type RotationSetPublic,
} from "./rotationSetStore.js";

export type CompiledRotationSlide = {
  imageUrl: string;
  durationMs: number;
  visitName: string;
  visitUrl: string;
  miniappTargetUrl?: string;
  advertId?: string;
  campaignId?: string;
};

export type CompiledRotationSet = {
  setId: string;
  revision: number;
  slides: string[];
  slideDurationsMs: number[];
  slideVisitNames: string[];
  slideVisitUrls: string[];
  slideMiniappTargetUrls: string[];
  slideCampaignIds: string[];
  advertIds: string[];
  /** Legacy uniform interval (min slide duration). */
  intervalMs: number;
  visitName: string;
  visitUrl: string;
  miniappTargetUrl?: string;
};

function isApprovedCampaign(c: CampaignPublic | null): c is CampaignPublic {
  return Boolean(c && c.status === "approved");
}

function compileItem(
  item: RotationSetItemPublic,
  set: RotationSetPublic
): CompiledRotationSlide | null {
  if (item.kind === "placeholder") {
    const advertId = String(item.placeholderAdvertId ?? "").trim();
    const ad = getBillboardAdvertById(advertId);
    if (!ad) return null;
    const imageUrl = String(ad.slides[0] ?? "").trim();
    if (!isAllowedBillboardImageUrl(imageUrl)) return null;
    const dwellSec = Math.max(1, Math.min(300, set.placeholderDwellSec || 10));
    return {
      imageUrl,
      durationMs: dwellSec * 1000,
      visitName: ad.name,
      visitUrl: String(ad.visitUrl ?? "").trim(),
      miniappTargetUrl: String(ad.miniappTargetUrl ?? "").trim() || undefined,
      advertId,
    };
  }
  const campaign = getCampaignById(String(item.campaignId ?? "").trim());
  if (!isApprovedCampaign(campaign)) return null;
  const imageUrl = String(campaign.imageUrl ?? "").trim();
  if (!isAllowedBillboardImageUrl(imageUrl)) return null;
  const dwellSec = Math.max(
    10,
    Math.min(45, Math.floor(Number(campaign.displayIntervalSec) || 10))
  );
  return {
    imageUrl,
    durationMs: dwellSec * 1000,
    visitName: campaign.projectName,
    visitUrl: campaign.miniappTargetUrl,
    miniappTargetUrl: campaign.miniappTargetUrl,
    campaignId: campaign.id,
  };
}

export function compileRotationSet(setId: string): CompiledRotationSet | null {
  const set = getRotationSetById(setId);
  if (!set) return null;
  const compiledSlides: CompiledRotationSlide[] = [];
  for (const item of set.items) {
    const slide = compileItem(item, set);
    if (slide) compiledSlides.push(slide);
  }
  if (compiledSlides.length === 0) return null;

  const slides = compiledSlides.map((s) => s.imageUrl);
  const slideDurationsMs = compiledSlides.map((s) => s.durationMs);
  const slideVisitNames = compiledSlides.map((s) => s.visitName);
  const slideVisitUrls = compiledSlides.map((s) => s.visitUrl);
  const slideMiniappTargetUrls = compiledSlides.map(
    (s) => s.miniappTargetUrl ?? ""
  );
  const slideCampaignIds = compiledSlides.map((s) => s.campaignId ?? "");
  const advertIds = compiledSlides.map((s) => s.advertId ?? "");
  const first = compiledSlides[0]!;
  const intervalMs = Math.min(...slideDurationsMs);

  return {
    setId: set.id,
    revision: set.revision,
    slides,
    slideDurationsMs,
    slideVisitNames,
    slideVisitUrls,
    slideMiniappTargetUrls,
    slideCampaignIds,
    advertIds,
    intervalMs,
    visitName: first.visitName,
    visitUrl: first.visitUrl,
    miniappTargetUrl: first.miniappTargetUrl,
  };
}
