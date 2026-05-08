import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const STORE_FILE = process.env.HEADER_MARQUEE_SETTINGS_FILE
  ? path.resolve(process.env.HEADER_MARQUEE_SETTINGS_FILE)
  : path.join(__dirname, "..", "data", "header-marquee-settings.json");

/** Legacy single field; lines in `newsMessages` are capped to this length each. */
export const HEADER_MARQUEE_NEWS_MAX_LEN = 500;

export const HEADER_MARQUEE_MAX_MESSAGES = 12;

export type HeaderMarqueeSettings = {
  /** Master switch: when false, the in-game header strip is hidden. */
  bannerEnabled: boolean;
  /** Ticker: top login streaks (requires at least one player on the board). */
  loginStreakLeaderboardEnabled: boolean;
  /** Rotate through `newsMessages` when enabled and the array is non-empty. */
  newsMessageEnabled: boolean;
  /**
   * Announcement lines (in order). Shown one at a time between streak slices when streak is on;
   * cycled when streak is off. Migrated from legacy `newsMessage` if present.
   */
  newsMessages: string[];
  /**
   * Safety cap (seconds) if the client cannot detect a CSS scroll loop for the streak ticker
   * (still advances to announcements). Ignored for streak-only mode. Min enforced client-side.
   */
  marqueeStreakSeconds: number;
  /** Seconds to show each announcement line (1–120). */
  marqueeMessageSeconds: number;
};

const DEFAULTS: HeaderMarqueeSettings = {
  bannerEnabled: true,
  loginStreakLeaderboardEnabled: true,
  newsMessageEnabled: false,
  newsMessages: [],
  marqueeStreakSeconds: 60,
  marqueeMessageSeconds: 10,
};

type StoreFile = { settings: HeaderMarqueeSettings };

function ensureDir(): void {
  const dir = path.dirname(STORE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function clampSeconds(n: unknown, fallback: number): number {
  const fb = Math.min(120, Math.max(1, Math.floor(fallback)));
  const v = typeof n === "number" && Number.isFinite(n) ? Math.floor(n) : NaN;
  if (!Number.isFinite(v)) return fb;
  return Math.min(120, Math.max(1, v));
}

/** Streak ticker safety timeout when announcements rotate (longer max than per-message dwell). */
function clampStreakFallbackSeconds(n: unknown, fallback: number): number {
  const fb = Math.min(180, Math.max(30, Math.floor(fallback)));
  const v = typeof n === "number" && Number.isFinite(n) ? Math.floor(n) : NaN;
  if (!Number.isFinite(v)) return fb;
  return Math.min(180, Math.max(30, v));
}

/** Strip control chars; single line. */
export function sanitizeHeaderMarqueeNews(raw: string): string {
  let t = String(raw || "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\r\n|\r|\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (t.length > HEADER_MARQUEE_NEWS_MAX_LEN) {
    t = t.slice(0, HEADER_MARQUEE_NEWS_MAX_LEN);
  }
  return t;
}

export function sanitizeNewsMessagesList(raw: unknown): string[] {
  let lines: string[] = [];
  if (Array.isArray(raw)) {
    lines = raw.map((x) => sanitizeHeaderMarqueeNews(String(x ?? ""))).filter(Boolean);
  } else if (typeof raw === "string") {
    for (const part of raw.split(/\r\n|\r|\n/)) {
      const s = sanitizeHeaderMarqueeNews(part);
      if (s) lines.push(s);
    }
  }
  if (lines.length > HEADER_MARQUEE_MAX_MESSAGES) {
    lines = lines.slice(0, HEADER_MARQUEE_MAX_MESSAGES);
  }
  return lines;
}

function mergeSettings(s: Partial<HeaderMarqueeSettings>): HeaderMarqueeSettings {
  let newsMessages: string[] = [];
  if (Array.isArray(s.newsMessages)) {
    newsMessages = sanitizeNewsMessagesList(s.newsMessages);
  }
  if (newsMessages.length === 0 && typeof (s as { newsMessage?: string }).newsMessage === "string") {
    const legacy = sanitizeHeaderMarqueeNews((s as { newsMessage?: string }).newsMessage ?? "");
    if (legacy) newsMessages = [legacy];
  }

  return {
    bannerEnabled:
      s.bannerEnabled === undefined ? DEFAULTS.bannerEnabled : Boolean(s.bannerEnabled),
    loginStreakLeaderboardEnabled:
      s.loginStreakLeaderboardEnabled === undefined
        ? DEFAULTS.loginStreakLeaderboardEnabled
        : Boolean(s.loginStreakLeaderboardEnabled),
    newsMessageEnabled:
      s.newsMessageEnabled === undefined
        ? DEFAULTS.newsMessageEnabled
        : Boolean(s.newsMessageEnabled),
    newsMessages,
    marqueeStreakSeconds:
      s.marqueeStreakSeconds === undefined
        ? DEFAULTS.marqueeStreakSeconds
        : clampStreakFallbackSeconds(s.marqueeStreakSeconds, DEFAULTS.marqueeStreakSeconds),
    marqueeMessageSeconds:
      s.marqueeMessageSeconds === undefined
        ? DEFAULTS.marqueeMessageSeconds
        : clampSeconds(s.marqueeMessageSeconds, DEFAULTS.marqueeMessageSeconds),
  };
}

function readStore(): StoreFile {
  if (!fs.existsSync(STORE_FILE)) return { settings: { ...DEFAULTS } };
  try {
    const raw = fs.readFileSync(STORE_FILE, "utf8");
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object") return { settings: { ...DEFAULTS } };
    const o = j as Record<string, unknown>;
    const s = o.settings;
    if (!s || typeof s !== "object") return { settings: { ...DEFAULTS } };
    return { settings: mergeSettings(s as Partial<HeaderMarqueeSettings> & { newsMessage?: string }) };
  } catch {
    return { settings: { ...DEFAULTS } };
  }
}

function writeStore(data: StoreFile): void {
  ensureDir();
  const tmp = `${STORE_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 0), "utf8");
  fs.renameSync(tmp, STORE_FILE);
}

export function getHeaderMarqueeSettings(): HeaderMarqueeSettings {
  return { ...readStore().settings };
}

export function patchHeaderMarqueeSettings(
  patch: Partial<HeaderMarqueeSettings> & { newsMessage?: string }
): HeaderMarqueeSettings {
  const cur = readStore().settings;
  const next = mergeSettings({ ...cur, ...patch });
  writeStore({ settings: next });
  return next;
}

export function headerMarqueePublicVisible(
  settings: HeaderMarqueeSettings,
  leaderboardNonEmpty: boolean,
  newsMessages: string[]
): boolean {
  if (!settings.bannerEnabled) return false;
  const streakOn =
    settings.loginStreakLeaderboardEnabled && leaderboardNonEmpty;
  const newsOn =
    settings.newsMessageEnabled && newsMessages.length > 0;
  return streakOn || newsOn;
}
