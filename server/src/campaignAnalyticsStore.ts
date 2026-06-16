import {
  debitCampaignVisibilityLuna,
  getCampaignById,
  getCampaignDatabase,
} from "./campaignStore.js";
import { refreshRotationSetsAfterCampaignChange } from "./campaignFulfill.js";

/** Max milliseconds accepted per impression batch line (client samples ~1s). */
const MAX_VISIBLE_MS_PER_ITEM = 5000;

/** Max campaigns per `campaignImpression` WebSocket message. */
export const CAMPAIGN_IMPRESSION_BATCH_MAX = 24;

export type CampaignAnalyticsSummary = {
  uniqueViewers: number;
  totalVisibleMs: number;
  avgVisibleMsPerViewer: number;
  linkClicks: number;
  uniqueLinkClickers: number;
  lastSeenAt: string | null;
};


function normalizeWallet(v: string): string {
  return String(v || "").replace(/\s+/g, "").toUpperCase();
}

function emptySummary(): CampaignAnalyticsSummary {
  return {
    uniqueViewers: 0,
    totalVisibleMs: 0,
    avgVisibleMsPerViewer: 0,
    linkClicks: 0,
    uniqueLinkClickers: 0,
    lastSeenAt: null,
  };
}

function rowToSummary(row: {
  unique_viewers: number;
  total_visible_ms: number;
  link_clicks: number;
  unique_link_clickers: number;
  last_seen_ms: number | null;
}): CampaignAnalyticsSummary {
  const uniqueViewers = Math.max(0, Math.floor(Number(row.unique_viewers) || 0));
  const totalVisibleMs = Math.max(0, Math.floor(Number(row.total_visible_ms) || 0));
  const linkClicks = Math.max(0, Math.floor(Number(row.link_clicks) || 0));
  const uniqueLinkClickers = Math.max(
    0,
    Math.floor(Number(row.unique_link_clickers) || 0)
  );
  const lastSeenMs = row.last_seen_ms;
  return {
    uniqueViewers,
    totalVisibleMs,
    avgVisibleMsPerViewer:
      uniqueViewers > 0 ? Math.round(totalVisibleMs / uniqueViewers) : 0,
    linkClicks,
    uniqueLinkClickers,
    lastSeenAt:
      lastSeenMs != null && lastSeenMs > 0
        ? new Date(lastSeenMs).toISOString()
        : null,
  };
}

export function initCampaignAnalyticsStore(): void {
  const db = getCampaignDatabase();
  db.exec(`
    CREATE TABLE IF NOT EXISTS campaign_viewer_stats (
      campaign_id TEXT NOT NULL,
      wallet TEXT NOT NULL,
      visible_ms INTEGER NOT NULL DEFAULT 0,
      link_clicks INTEGER NOT NULL DEFAULT 0,
      last_seen_ms INTEGER NOT NULL,
      PRIMARY KEY (campaign_id, wallet)
    );
    CREATE INDEX IF NOT EXISTS ix_campaign_viewer_stats_campaign
      ON campaign_viewer_stats(campaign_id, last_seen_ms DESC);
  `);
}

function campaignAcceptsAnalytics(campaignId: string): boolean {
  const c = getCampaignById(campaignId);
  if (!c) return false;
  return (
    c.status === "approved" ||
    c.status === "active" ||
    c.status === "expired"
  );
}

const upsertViewerStmt = () =>
  getCampaignDatabase().prepare(`
    INSERT INTO campaign_viewer_stats (
      campaign_id, wallet, visible_ms, link_clicks, last_seen_ms
    ) VALUES (?, ?, ?, 0, ?)
    ON CONFLICT(campaign_id, wallet) DO UPDATE SET
      visible_ms = campaign_viewer_stats.visible_ms + excluded.visible_ms,
      last_seen_ms = MAX(campaign_viewer_stats.last_seen_ms, excluded.last_seen_ms)
  `);

const upsertLinkClickStmt = () =>
  getCampaignDatabase().prepare(`
    INSERT INTO campaign_viewer_stats (
      campaign_id, wallet, visible_ms, link_clicks, last_seen_ms
    ) VALUES (?, ?, 0, 1, ?)
    ON CONFLICT(campaign_id, wallet) DO UPDATE SET
      link_clicks = campaign_viewer_stats.link_clicks + 1,
      last_seen_ms = MAX(campaign_viewer_stats.last_seen_ms, excluded.last_seen_ms)
  `);

export function recordCampaignImpressions(input: {
  wallet: string;
  items: Array<{ campaignId: string; visibleMs: number }>;
  nowMs?: number;
}): void {
  const wallet = normalizeWallet(input.wallet);
  if (!wallet) return;
  const now = input.nowMs ?? Date.now();
  const items = input.items;
  if (!Array.isArray(items) || items.length === 0) return;
  const stmt = upsertViewerStmt();
  const expiredCampaignIds = new Set<string>();
  const tx = getCampaignDatabase().transaction((rows: typeof items) => {
    for (const raw of rows.slice(0, CAMPAIGN_IMPRESSION_BATCH_MAX)) {
      const campaignId = String(raw.campaignId ?? "").trim();
      if (!campaignId || !campaignAcceptsAnalytics(campaignId)) continue;
      const visibleMs = Math.max(
        0,
        Math.min(
          MAX_VISIBLE_MS_PER_ITEM,
          Math.floor(Number(raw.visibleMs) || 0)
        )
      );
      if (visibleMs < 1) continue;
      stmt.run(campaignId, wallet, visibleMs, now);
      const debit = debitCampaignVisibilityLuna(campaignId, visibleMs);
      if (debit === "expired") expiredCampaignIds.add(campaignId);
    }
  });
  tx(items);
  for (const campaignId of expiredCampaignIds) {
    refreshRotationSetsAfterCampaignChange(campaignId);
  }
}

export function recordCampaignLinkClick(input: {
  wallet: string;
  campaignId: string;
  nowMs?: number;
}): boolean {
  const wallet = normalizeWallet(input.wallet);
  const campaignId = String(input.campaignId ?? "").trim();
  if (!wallet || !campaignId || !campaignAcceptsAnalytics(campaignId)) {
    return false;
  }
  const now = input.nowMs ?? Date.now();
  upsertLinkClickStmt().run(campaignId, wallet, now);
  return true;
}

export function getCampaignAnalyticsSummary(
  campaignId: string
): CampaignAnalyticsSummary {
  const id = String(campaignId ?? "").trim();
  if (!id) return emptySummary();
  const row = getCampaignDatabase()
    .prepare(
      `SELECT
        COUNT(*) AS unique_viewers,
        COALESCE(SUM(visible_ms), 0) AS total_visible_ms,
        COALESCE(SUM(link_clicks), 0) AS link_clicks,
        COALESCE(SUM(CASE WHEN link_clicks > 0 THEN 1 ELSE 0 END), 0) AS unique_link_clickers,
        MAX(last_seen_ms) AS last_seen_ms
      FROM campaign_viewer_stats
      WHERE campaign_id = ?`
    )
    .get(id) as
    | {
        unique_viewers: number;
        total_visible_ms: number;
        link_clicks: number;
        unique_link_clickers: number;
        last_seen_ms: number | null;
      }
    | undefined;
  if (!row) return emptySummary();
  return rowToSummary(row);
}

export function getCampaignAnalyticsSummaries(
  campaignIds: string[]
): Record<string, CampaignAnalyticsSummary> {
  const out: Record<string, CampaignAnalyticsSummary> = {};
  const ids = [
    ...new Set(
      campaignIds.map((x) => String(x ?? "").trim()).filter(Boolean)
    ),
  ];
  for (const id of ids) {
    out[id] = getCampaignAnalyticsSummary(id);
  }
  return out;
}

/** @internal test helper */
export function _resetCampaignAnalyticsForTests(): void {
  getCampaignDatabase().exec(`DELETE FROM campaign_viewer_stats`);
}
