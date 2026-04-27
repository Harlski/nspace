import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const VIEWS_FILE = process.env.ANALYTICS_PAGE_VIEWS_FILE
  ? path.resolve(process.env.ANALYTICS_PAGE_VIEWS_FILE)
  : path.join(__dirname, "..", "data", "analytics-page-views.jsonl");

function ensureDataDir(): void {
  const dir = path.dirname(VIEWS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/** Stored as `r` on anonymous lines when `w` is omitted (see `POST /api/analytics/page-view`). */
export type AnalyticsPageViewAnonReason =
  | "no_token"
  | "invalid_session"
  | "not_on_allowlist";

export type AnalyticsPageViewEvent = {
  t: number;
  /** Normalized compact wallet when the viewer had a valid analytics-authorized session. */
  wallet: string | null;
  /**
   * When `wallet` is null: why the beacon was stored without a wallet.
   * `legacy` = older JSONL lines with no `r` field.
   */
  anonReason: AnalyticsPageViewAnonReason | "legacy" | null;
};

const ANON_REASON_SET = new Set<string>([
  "no_token",
  "invalid_session",
  "not_on_allowlist",
]);

/**
 * One line per analytics SPA load: `POST /api/analytics/page-view` from the browser.
 * `wallet` is set only when Bearer JWT is valid and the wallet is analytics-authorized.
 */
export function recordAnalyticsPageViewEvent(
  wallet: string | null,
  anonymousReason: AnalyticsPageViewAnonReason | null
): void {
  try {
    ensureDataDir();
    const line =
      wallet === null || wallet === ""
        ? JSON.stringify({
            t: Date.now(),
            ...(anonymousReason ? { r: anonymousReason } : {}),
          })
        : JSON.stringify({ t: Date.now(), w: wallet });
    fs.appendFileSync(VIEWS_FILE, `${line}\n`, "utf8");
  } catch (err) {
    console.error("[analytics/page-views] append failed:", err);
  }
}

export type AnalyticsPageViewDay = { dayUtc: string; views: number };

/** UTC calendar days, oldest first, counts for each day in `[from, to)`. */
export function getAnalyticsPageViewsByDay(dayCount: number): AnalyticsPageViewDay[] {
  const capped = Math.min(90, Math.max(1, Math.floor(dayCount)));
  const now = Date.now();
  const u = new Date(now);
  const todayStartUtc = Date.UTC(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate());
  const days: AnalyticsPageViewDay[] = [];
  for (let i = capped - 1; i >= 0; i--) {
    const d = new Date(todayStartUtc - i * 86_400_000);
    days.push({ dayUtc: d.toISOString().slice(0, 10), views: 0 });
  }
  if (days.length === 0) return days;
  const fromMs = Date.UTC(
    Number(days[0].dayUtc.slice(0, 4)),
    Number(days[0].dayUtc.slice(5, 7)) - 1,
    Number(days[0].dayUtc.slice(8, 10))
  );
  const toMs = todayStartUtc + 86_400_000;
  const byDay = new Map(days.map((d) => [d.dayUtc, d]));
  if (!fs.existsSync(VIEWS_FILE)) return days;
  let raw: string;
  try {
    raw = fs.readFileSync(VIEWS_FILE, "utf8");
  } catch {
    return days;
  }
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let t: number;
    try {
      const o = JSON.parse(trimmed) as { t?: unknown };
      t = typeof o.t === "number" && Number.isFinite(o.t) ? o.t : 0;
    } catch {
      continue;
    }
    if (t < fromMs || t >= toMs) continue;
    const dayUtc = new Date(t).toISOString().slice(0, 10);
    const row = byDay.get(dayUtc);
    if (row) row.views += 1;
  }
  return days;
}

/** Newest first. `w` in file is normalized uppercase compact. */
export function getRecentAnalyticsPageViews(limit: number): AnalyticsPageViewEvent[] {
  const cap = Math.min(500, Math.max(1, Math.floor(limit)));
  if (!fs.existsSync(VIEWS_FILE)) return [];
  let raw: string;
  try {
    raw = fs.readFileSync(VIEWS_FILE, "utf8");
  } catch {
    return [];
  }
  const rows: AnalyticsPageViewEvent[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const o = JSON.parse(trimmed) as { t?: unknown; w?: unknown };
      const t = typeof o.t === "number" && Number.isFinite(o.t) ? o.t : 0;
      if (!t) continue;
      const wRaw = o.w;
      const wallet =
        typeof wRaw === "string" && wRaw.replace(/\s+/g, "").length > 0
          ? String(wRaw).replace(/\s+/g, "").toUpperCase()
          : null;
      const rRaw = o.r;
      const anonReason: AnalyticsPageViewEvent["anonReason"] = wallet
        ? null
        : typeof rRaw === "string" && ANON_REASON_SET.has(rRaw)
          ? (rRaw as AnalyticsPageViewAnonReason)
          : "legacy";
      rows.push({ t, wallet, anonReason });
    } catch {
      continue;
    }
  }
  rows.sort((a, b) => b.t - a.t);
  return rows.slice(0, cap);
}
