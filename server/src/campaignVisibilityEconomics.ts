/**
 * Campaign funding: pay for **seconds your slide is on screen in front of players**.
 *
 * Dwell (10 / 30 / 45 s) is free to choose - same per-minute rate for all tiers.
 * Balance drains by display time when players can see the billboard:
 *   drainLuna = lunaPerSecond × secondsOnScreen × audienceFactor
 *
 * Prepaid estimate (full audience):
 *   visibleMinutes = fundNim ÷ baseNimPerMinute
 *
 * Default: 400 NIM ≈ 24h of on-screen time when players are present (~0.2778 NIM/min).
 *
 * Future: audienceFactor ≈ 1.0 with viewers nearby, ~0.02 idle trickle.
 */

const LUNA_PER_NIM = 100_000n;

/** Default dwell when creating a campaign (selection is free; not a price tier). */
export const CAMPAIGN_REFERENCE_DWELL_SEC = 10;

/** Default prepaid price for ~24h of full-audience on-screen time. */
export const CAMPAIGN_NIM_PER_24H_VISIBLE_DEFAULT = 400;

/** @deprecated derived from {@link campaignNimPer24hVisible} */
export const CAMPAIGN_VISIBILITY_NIM_PER_MINUTE_DEFAULT =
  CAMPAIGN_NIM_PER_24H_VISIBLE_DEFAULT / (24 * 60);

/** Seconds each slide stays on screen before the carousel advances. */
export const CAMPAIGN_SLIDE_DWELL_TIERS = [
  { dwellSec: 10, label: "10 seconds on screen" },
  { dwellSec: 30, label: "30 seconds on screen" },
  { dwellSec: 45, label: "45 seconds on screen" },
] as const;

export function campaignNimPer24hVisible(): number {
  const raw = process.env.CAMPAIGN_NIM_PER_24H_VISIBLE?.trim();
  if (raw && /^\d+(\.\d+)?$/.test(raw)) {
    return Math.max(0.000_001, Number(raw));
  }
  return CAMPAIGN_NIM_PER_24H_VISIBLE_DEFAULT;
}

export function campaignVisibilityNimPerMinute(): number {
  const direct = process.env.CAMPAIGN_VISIBILITY_NIM_PER_MINUTE?.trim();
  if (direct && /^\d+(\.\d+)?$/.test(direct)) {
    return Math.max(0.000_001, Number(direct));
  }
  return campaignNimPer24hVisible() / (24 * 60);
}

export function isCampaignSlideDwellSec(sec: number): boolean {
  return CAMPAIGN_SLIDE_DWELL_TIERS.some((t) => t.dwellSec === sec);
}

export function campaignVisibilityLunaPerMinute(): bigint {
  const nim = campaignVisibilityNimPerMinute();
  const whole = Math.floor(nim);
  const frac = nim - whole;
  const fracLuna = BigInt(Math.round(frac * 100_000));
  return BigInt(whole) * LUNA_PER_NIM + fracLuna;
}

export function campaignVisibilityLunaPerSecond(): bigint {
  const lunaPerMin = campaignVisibilityLunaPerMinute();
  return lunaPerMin / 60n;
}

/** Luna debited for `visibleMs` of on-screen time at full audience (impression batches). */
export function lunaDrainForVisibleMs(visibleMs: number): bigint {
  const ms = Math.max(0, Math.floor(Number(visibleMs) || 0));
  if (ms < 1) return 0n;
  const lunaPerSec = campaignVisibilityLunaPerSecond();
  if (lunaPerSec <= 0n) return 0n;
  return (lunaPerSec * BigInt(ms)) / 1000n;
}

/** Luna consumed when this slide is shown for `dwellSec` with players present (full rate). */
export function lunaDrainForSlideDisplay(dwellSec: number): bigint {
  const sec = Math.max(1, Math.floor(Number(dwellSec) || CAMPAIGN_REFERENCE_DWELL_SEC));
  return campaignVisibilityLunaPerSecond() * BigInt(sec);
}

/**
 * Estimated **on-screen** minutes from prepaid balance (full audience).
 * Independent of dwell - longer dwell burns more per rotation when players watch.
 */
export function estimateVisibilityMinutesFromFund(fundNim: number): number {
  if (!Number.isFinite(fundNim) || fundNim <= 0) return 0;
  const rate = campaignVisibilityNimPerMinute();
  if (rate <= 0) return 0;
  return fundNim / rate;
}

export function estimateVisibilityMinutesFromLuna(fundLuna: bigint): number {
  if (fundLuna <= 0n) return 0;
  const lunaPerMin = campaignVisibilityLunaPerMinute();
  if (lunaPerMin <= 0n) return 0;
  return Number(fundLuna) / Number(lunaPerMin);
}

export function estimateVisibilityMsFromLuna(fundLuna: bigint): number {
  const minutes = estimateVisibilityMinutesFromLuna(fundLuna);
  return Math.floor(minutes * 60 * 1000);
}

/** NIM needed for ~24h of on-screen time at full audience (100 at default rate). */
export function nimFor24hVisibility(): number {
  return campaignNimPer24hVisible();
}

/** @deprecated use nimFor24hVisibility */
export function nimFor24hVisibilityAtReferenceDwell(): number {
  return nimFor24hVisibility();
}

export function formatVisibilityDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0 minutes";
  if (minutes < 90) return `${Math.round(minutes)} minutes`;
  if (minutes < 48 * 60) {
    const h = minutes / 60;
    return h >= 10 ? `${Math.round(h)} hours` : `${h.toFixed(1)} hours`;
  }
  const d = minutes / (24 * 60);
  return d >= 10 ? `${Math.round(d)} days` : `${d.toFixed(1)} days`;
}

export function campaignSlideDwellTiersForApi(): Array<{
  dwellSec: number;
  label: string;
}> {
  return CAMPAIGN_SLIDE_DWELL_TIERS.map((t) => ({
    dwellSec: t.dwellSec,
    label: t.label,
  }));
}

export function campaignVisibilityEconomicsForApi(): {
  baseNimPerMinuteVisible: number;
  nimPer24hVisible: number;
  formulaVisibleMinutes: string;
  formulaDrain: string;
  noteDwellFree: string;
  noteAudienceTrickle: string;
} {
  const base = campaignVisibilityNimPerMinute();
  return {
    baseNimPerMinuteVisible: base,
    nimPer24hVisible: nimFor24hVisibility(),
    formulaVisibleMinutes: "visibleMinutes = fundNim ÷ baseNimPerMinute",
    formulaDrain:
      "drainLuna = lunaPerSecond × secondsOnScreen × audienceFactor",
    noteDwellFree:
      "10 / 30 / 45 s on screen is free to choose. Longer dwell uses more balance per carousel showing when players are watching.",
    noteAudienceTrickle:
      "When no players are near the billboard, balance drains much more slowly (planned). Estimates assume full on-screen time.",
  };
}

export function estimateCampaignDurationForApi(
  fundNim: number,
  dwellSec?: number
): {
  fundNim: number;
  dwellSec: number | null;
  nimPerMinuteVisible: number;
  visibleMinutes: number;
  visibleHours: number;
  visibleDurationLabel: string;
  lunaPerSlideWhenVisible: string | null;
  noteDwell: string;
} {
  const minutes = estimateVisibilityMinutesFromFund(fundNim);
  const dwell =
    dwellSec !== undefined && isCampaignSlideDwellSec(dwellSec)
      ? Math.floor(dwellSec)
      : null;
  const lunaPerSlide = dwell !== null ? lunaDrainForSlideDisplay(dwell) : null;
  return {
    fundNim,
    dwellSec: dwell,
    nimPerMinuteVisible: campaignVisibilityNimPerMinute(),
    visibleMinutes: minutes,
    visibleHours: minutes / 60,
    visibleDurationLabel: formatVisibilityDuration(minutes),
    lunaPerSlideWhenVisible: lunaPerSlide?.toString() ?? null,
    noteDwell:
      "Dwell does not change the per-minute rate. Longer on-screen time consumes more balance each time your slide is shown to players.",
  };
}

export type CampaignPrepaidDisplay = {
  remainingNimLabel: string;
  totalFundedNimLabel: string | null;
  usedNimLabel: string | null;
  remainingOnScreenLabel: string;
  remainingOnScreenMinutes: number;
  prepaidRemainingPercent: number | null;
  prepaidUsedPercent: number | null;
  expiresAtDisplay: string | null;
  expiresInLabel: string | null;
  isExpired: boolean;
  hasPrepaidBalance: boolean;
};

export function formatExpiresAtDisplay(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatExpiresInLabel(
  iso: string | null,
  nowMs: number = Date.now()
): string | null {
  if (!iso) return null;
  const end = new Date(iso).getTime();
  if (Number.isNaN(end)) return null;
  const delta = end - nowMs;
  if (delta <= 0) return "Expired";
  const min = Math.floor(delta / 60_000);
  if (min < 1) return "Less than 1 minute left";
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} left`;
  const hr = Math.floor(min / 60);
  const remMin = min % 60;
  if (hr < 24) {
    return remMin > 0 ? `${hr}h ${remMin}m left` : `${hr} hour${hr === 1 ? "" : "s"} left`;
  }
  const days = Math.floor(hr / 24);
  const remHr = hr % 24;
  return remHr > 0 ? `${days}d ${remHr}h left` : `${days} day${days === 1 ? "" : "s"} left`;
}

export function campaignPrepaidDisplayForApi(input: {
  balanceLuna: string | null;
  totalFundedLuna?: bigint | string | null;
  expiresAt?: string | null;
  status?: string;
  nowMs?: number;
  formatNim?: (luna: bigint) => string;
}): CampaignPrepaidDisplay {
  const formatNim =
    input.formatNim ??
    ((luna: bigint) => {
      const whole = luna / 100_000n;
      const frac = luna % 100_000n;
      if (frac === 0n) return whole.toString();
      const fracStr = frac.toString().padStart(5, "0").replace(/0+$/, "");
      return `${whole}.${fracStr}`;
    });

  let remainingLuna = 0n;
  try {
    if (input.balanceLuna) remainingLuna = BigInt(input.balanceLuna);
  } catch {
    /* ignore */
  }
  if (remainingLuna < 0n) remainingLuna = 0n;

  let totalFundedLuna: bigint | null = null;
  if (input.totalFundedLuna != null && input.totalFundedLuna !== "") {
    try {
      const v = BigInt(input.totalFundedLuna);
      if (v > 0n) totalFundedLuna = v;
    } catch {
      /* ignore */
    }
  }

  const remainingMinutes = estimateVisibilityMinutesFromLuna(remainingLuna);
  const usedLuna =
    totalFundedLuna != null && totalFundedLuna > remainingLuna
      ? totalFundedLuna - remainingLuna
      : 0n;

  let prepaidRemainingPercent: number | null = null;
  let prepaidUsedPercent: number | null = null;
  if (totalFundedLuna != null && totalFundedLuna > 0n) {
    prepaidRemainingPercent = Math.round(
      Number((remainingLuna * 100n) / totalFundedLuna)
    );
    prepaidUsedPercent = Math.round(Number((usedLuna * 100n) / totalFundedLuna));
    prepaidRemainingPercent = Math.max(0, Math.min(100, prepaidRemainingPercent));
    prepaidUsedPercent = Math.max(0, Math.min(100, prepaidUsedPercent));
  }

  const expiresInLabel = null;
  const isExpired =
    input.status === "expired" ||
    (remainingLuna <= 0n &&
      totalFundedLuna != null &&
      totalFundedLuna > 0n);

  return {
    remainingNimLabel: formatNim(remainingLuna),
    totalFundedNimLabel:
      totalFundedLuna != null ? formatNim(totalFundedLuna) : null,
    usedNimLabel: totalFundedLuna != null ? formatNim(usedLuna) : null,
    remainingOnScreenLabel: formatVisibilityDuration(remainingMinutes),
    remainingOnScreenMinutes: remainingMinutes,
    prepaidRemainingPercent,
    prepaidUsedPercent,
    expiresAtDisplay: null,
    expiresInLabel,
    isExpired,
    hasPrepaidBalance: remainingLuna > 0n,
  };
}
