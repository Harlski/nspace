import { HUB_ROOM_ID } from "./roomLayouts.js";
import { isCampaignSlideDwellSec } from "./campaignVisibilityEconomics.js";

export {
  CAMPAIGN_REFERENCE_DWELL_SEC,
  CAMPAIGN_SLIDE_DWELL_TIERS,
  CAMPAIGN_NIM_PER_24H_VISIBLE_DEFAULT,
  CAMPAIGN_VISIBILITY_NIM_PER_MINUTE_DEFAULT,
  campaignNimPer24hVisible,
  campaignSlideDwellTiersForApi,
  campaignVisibilityEconomicsForApi,
  campaignPrepaidDisplayForApi,
  campaignVisibilityLunaPerSecond,
  estimateCampaignDurationForApi,
  estimateVisibilityMinutesFromFund,
  estimateVisibilityMinutesFromLuna,
  estimateVisibilityMsFromLuna,
  formatVisibilityDuration,
  isCampaignSlideDwellSec,
  lunaDrainForSlideDisplay,
  lunaDrainForVisibleMs,
  nimFor24hVisibility,
  nimFor24hVisibilityAtReferenceDwell,
  type CampaignPrepaidDisplay,
} from "./campaignVisibilityEconomics.js";

/** Predefined Hub billboard anchors for paid mini-app campaigns (horizontal 4×1). */
export const HUB_COMPETITION_BILLBOARD_SLOTS: ReadonlyArray<{
  anchorX: number;
  anchorZ: number;
}> = [
  { anchorX: -9, anchorZ: 7 },
  { anchorX: -2, anchorZ: 7 },
  { anchorX: 5, anchorZ: 7 },
  { anchorX: -9, anchorZ: -8 },
  { anchorX: 5, anchorZ: -8 },
];

export const COMPETITION_BILLBOARD_ROOM_ID = HUB_ROOM_ID;

/** Shared Hub rotation - all approved campaigns in this mode loop together. */
export const CAMPAIGN_PLACEMENT_ACTIVE_CAROUSEL = "active_carousel" as const;

/** Future: lock one empty in-world billboard to a single campaign until funding ends. */
export const CAMPAIGN_PLACEMENT_DEDICATED = "dedicated_anchor" as const;

export type CampaignPlacementMode =
  | typeof CAMPAIGN_PLACEMENT_ACTIVE_CAROUSEL
  | typeof CAMPAIGN_PLACEMENT_DEDICATED;

/** @deprecated use isCampaignSlideDwellSec */
export function isCampaignDisplayIntervalSec(sec: number): boolean {
  return isCampaignSlideDwellSec(sec);
}

export function campaignPlacementModesForApi(): Array<{
  id: CampaignPlacementMode;
  label: string;
  description: string;
  available: boolean;
}> {
  return [
    {
      id: CAMPAIGN_PLACEMENT_ACTIVE_CAROUSEL,
      label: "Active Campaigns",
      description:
        "Your ad can appear on campaign billboards around Nimiq Space.",
      available: true,
    },
    {
      id: CAMPAIGN_PLACEMENT_DEDICATED,
      label: "Dedicated billboard",
      description:
        "Apply your campaign to an empty in-world billboard (coming later).",
      available: false,
    },
  ];
}

/** Billboard slot payments are sent here (matches payment-intent-service recipient in prod). */
export const ADVERTISE_FUND_RECIPIENT_ADDRESS =
  process.env.ADVERTISE_FUND_RECIPIENT_ADDRESS?.trim() ||
  "NQ32 FRGN PDKF RC4Y CKLV 4K3F PKL1 UBAU 7U71";

const LUNA_PER_NIM = 100_000n;

export function nimAmountToLuna(nim: string): bigint | null {
  let t = String(nim ?? "").trim().replace(/,/g, ".");
  t = t.replace(/[^\d.]/g, "");
  const dot = t.indexOf(".");
  if (dot >= 0) {
    t = t.slice(0, dot + 1) + t.slice(dot + 1).replace(/\./g, "");
  }
  if (t.endsWith(".")) t = t.slice(0, -1);
  if (!/^\d+(\.\d+)?$/.test(t)) {
    const n = Number.parseFloat(t);
    if (!Number.isFinite(n) || n <= 0) return null;
    t = Number.isInteger(n) ? String(n) : n.toFixed(5).replace(/\.?0+$/, "");
  }
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const parts = t.split(".");
  const whole = BigInt(parts[0] ?? "0");
  const frac = (parts[1] ?? "").padEnd(5, "0").slice(0, 5);
  const luna = whole * LUNA_PER_NIM + BigInt(frac);
  return luna < 1n ? null : luna;
}

/** Human-readable NIM label from luna (matches `/api/advertise/.../intent` responses). */
export function formatLunaAsNimLabel(luna: bigint | string): string {
  const raw = typeof luna === "bigint" ? luna.toString() : String(luna ?? "").trim();
  if (!/^\d+$/.test(raw)) return "";
  const n = BigInt(raw);
  if (n < 1n) return "";
  const nimWhole = n / LUNA_PER_NIM;
  const nimFrac = Number(n % LUNA_PER_NIM) / 100_000;
  return nimFrac > 0
    ? `${nimWhole}.${String(nimFrac).slice(2, 7)}`
    : String(nimWhole);
}

/** Smallest payable fund (1 luna). Campaigns scale time from any amount above this. */
export function campaignMinimumFundLuna(): bigint {
  const raw = process.env.CAMPAIGN_MIN_FUND_NIM_LUNA?.trim();
  if (raw && /^\d+$/.test(raw)) return BigInt(raw);
  const nim = process.env.CAMPAIGN_MIN_FUND_NIM?.trim();
  if (nim && /^\d+(\.\d+)?$/.test(nim)) {
    const parsed = nimAmountToLuna(nim);
    if (parsed) return parsed;
  }
  return 1n;
}

/** Legacy fixed slot price - prefer user-chosen fund + visibility economics. */
export function billboardSlotPriceLuna(): bigint {
  const raw = process.env.BILLBOARD_SLOT_NIM_LUNA?.trim();
  if (raw && /^\d+$/.test(raw)) return BigInt(raw);
  const nim = process.env.BILLBOARD_SLOT_NIM?.trim();
  if (nim && /^\d+(\.\d+)?$/.test(nim)) {
    const parsed = nimAmountToLuna(nim);
    if (parsed) return parsed;
  }
  return 10n * LUNA_PER_NIM;
}

export function billboardSlotDurationMs(): number {
  const days = Number(process.env.BILLBOARD_SLOT_DURATION_DAYS ?? "7");
  if (!Number.isFinite(days) || days < 1) return 7 * 24 * 60 * 60 * 1000;
  return Math.floor(days * 24 * 60 * 60 * 1000);
}

export function campaignSqlitePath(): string {
  return (
    process.env.CAMPAIGN_STORE_SQLITE_PATH?.trim() ||
    "./data/campaigns.sqlite"
  );
}
