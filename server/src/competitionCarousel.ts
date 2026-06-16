import type { CampaignPublic } from "./campaignStore.js";

/**
 * Builds weighted slide sequence for Hub "Active Campaigns" carousel billboards.
 * Phase 1: call from admin approve + expiry tick once carousel billboards replace exclusive slots.
 * See docs/brainstorm/billboard-campaign-rotation-and-funding.md
 */
export type CarouselSlide = {
  campaignId: string;
  imageUrl: string;
  visitName: string;
  miniappTargetUrl: string;
  displayIntervalSec: number;
};

export function buildActiveCampaignCarouselSlides(
  campaigns: CampaignPublic[]
): CarouselSlide[] {
  const active = campaigns.filter(
    (c) => c.placementMode === "active_carousel" && c.status === "active"
  );
  if (!active.length) return [];

  return active.map((c) => {
    const sec = Math.max(10, Math.min(45, c.displayIntervalSec || 10));
    return {
      campaignId: c.id,
      imageUrl: c.imageUrl,
      visitName: c.projectName,
      miniappTargetUrl: c.miniappTargetUrl,
      displayIntervalSec: sec,
    };
  });
}
