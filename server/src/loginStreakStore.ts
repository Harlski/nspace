import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const STORE_FILE = process.env.LOGIN_STREAK_STORE_FILE
  ? path.resolve(process.env.LOGIN_STREAK_STORE_FILE)
  : path.join(__dirname, "..", "data", "login-streaks.json");

type Row = {
  lastLoginDayUtc: string;
  streakDays: number;
  updatedAt: number;
};

type StoreFile = { streaks: Record<string, Row> };

function ensureDir(): void {
  const dir = path.dirname(STORE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readStore(): StoreFile {
  if (!fs.existsSync(STORE_FILE)) return { streaks: {} };
  try {
    const raw = fs.readFileSync(STORE_FILE, "utf8");
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object") return { streaks: {} };
    const o = j as Record<string, unknown>;
    const streaks = o.streaks;
    if (!streaks || typeof streaks !== "object") return { streaks: {} };
    return { streaks: streaks as Record<string, Row> };
  } catch {
    return { streaks: {} };
  }
}

function writeStore(data: StoreFile): void {
  ensureDir();
  const tmp = `${STORE_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 0), "utf8");
  fs.renameSync(tmp, STORE_FILE);
}

/** `YYYY-MM-DD` in UTC for the given instant. */
export function utcCalendarDay(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Previous UTC calendar day string for `day` (`YYYY-MM-DD`). */
export function prevUtcCalendarDay(day: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day.trim());
  if (!m) return day;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const t = Date.UTC(y, mo - 1, d - 1);
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * Call after successful wallet login (`/api/auth/verify`).
 * Streak counts distinct UTC calendar days; multiple logins the same day do not increment.
 */
export function recordLoginStreakForWallet(normalizedAddress: string): {
  streakDays: number;
} {
  const addr = String(normalizedAddress || "")
    .replace(/\s+/g, "")
    .trim()
    .toUpperCase();
  if (!addr || addr.length < 4) return { streakDays: 0 };

  const today = utcCalendarDay();
  const data = readStore();
  const cur = data.streaks[addr];
  let streakDays = 1;

  if (cur && typeof cur.lastLoginDayUtc === "string") {
    if (cur.lastLoginDayUtc === today) {
      streakDays =
        typeof cur.streakDays === "number" && cur.streakDays >= 1
          ? cur.streakDays
          : 1;
    } else if (cur.lastLoginDayUtc === prevUtcCalendarDay(today)) {
      const prev =
        typeof cur.streakDays === "number" && cur.streakDays >= 1
          ? cur.streakDays
          : 1;
      streakDays = prev + 1;
    } else {
      streakDays = 1;
    }
  }

  data.streaks[addr] = {
    lastLoginDayUtc: today,
    streakDays,
    updatedAt: Date.now(),
  };
  writeStore(data);
  return { streakDays };
}

export type LoginStreakRow = {
  wallet: string;
  streakDays: number;
  lastLoginDayUtc: string;
};

export function getTopLoginStreaks(limit: number): LoginStreakRow[] {
  const cap = Math.min(50, Math.max(1, Math.floor(limit)));
  const { streaks } = readStore();
  const rows: LoginStreakRow[] = [];
  for (const [wallet, r] of Object.entries(streaks)) {
    if (!r || typeof r.streakDays !== "number" || r.streakDays < 1) continue;
    if (typeof r.lastLoginDayUtc !== "string") continue;
    rows.push({
      wallet,
      streakDays: r.streakDays,
      lastLoginDayUtc: r.lastLoginDayUtc,
    });
  }
  rows.sort((a, b) => {
    if (b.streakDays !== a.streakDays) return b.streakDays - a.streakDays;
    return b.lastLoginDayUtc.localeCompare(a.lastLoginDayUtc);
  });
  const seen = new Set<string>();
  const deduped: LoginStreakRow[] = [];
  for (const r of rows) {
    const w = String(r.wallet || "")
      .replace(/\s+/g, "")
      .trim()
      .toUpperCase();
    if (!w || seen.has(w)) continue;
    seen.add(w);
    deduped.push({ ...r, wallet: w });
    if (deduped.length >= cap) break;
  }
  return deduped;
}
