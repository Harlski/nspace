/**
 * World Cup soccer — country + player goal tally (single JSON store, deletable).
 *
 * Scoring is bucketed per **UTC day**: the live scoreboard/leaderboard shows *today's*
 * goals and resets at 00:00 UTC. Completed days are archived under `history` (kept for
 * later), and the most recent completed day that had a winner is remembered as
 * `prevWinner` so the stadium crowd can wave that champion's flag.
 *
 * Within a day, attribution is immutable per goal: a goal counts for the country the
 * scorer had at that moment. Changing country later only affects future goals. Goals
 * scored before a player picks a country are held in `today.pending[wallet]` and flushed
 * to the country chosen first (same day). A player's chosen country (their identity) is
 * persistent and survives the daily reset; only the goal counts reset.
 *
 * This is small, seasonal, transitional data — JSON-on-disk is acceptable per
 * THE-LARGER-SYSTEM (Player-adjacent persistence).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "..", "data");

/** Resolved lazily so WORLDCUP_SCORES_FILE (tests / ops) can override the location. */
function scoresFile(): string {
  const override = process.env.WORLDCUP_SCORES_FILE?.trim();
  return override && override.length > 0
    ? path.resolve(override)
    : path.join(DATA_DIR, "worldcup-scores.json");
}

/** UTC calendar day key, e.g. "2026-06-19". */
export function utcDayKey(ms: number = Date.now()): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Live goals for a single UTC day (resets at midnight UTC). */
interface DayTally {
  /** code -> goals attributed to that country today. */
  countries: Record<string, number>;
  /** compact wallet -> goals scored today. */
  players: Record<string, number>;
  /** compact wallet -> goals scored today before a country was chosen. */
  pending: Record<string, number>;
}

/** A completed day, frozen for history. */
interface DayArchive {
  countries: Record<string, number>;
  players: Record<string, number>;
  winner: string | null;
  winnerGoals: number;
}

/** Persistent per-player identity (survives the daily reset). */
interface Profile {
  country: string | null;
  name: string;
}

export interface PrevWinner {
  /** UTC day that was won. */
  day: string;
  country: string | null;
  goals: number;
}

interface ScoreData {
  season: string;
  /** UTC day key that `today` currently covers. */
  day: string;
  today: DayTally;
  /** day key -> archived results. */
  history: Record<string, DayArchive>;
  /** Most recent completed day that had a winner (for the crowd flag). */
  prevWinner: PrevWinner | null;
  /** compact wallet -> persistent identity (country choice + display name). */
  profiles: Record<string, Profile>;
}

function emptyDay(): DayTally {
  return { countries: {}, players: {}, pending: {} };
}

const data: ScoreData = {
  season: "2026",
  day: utcDayKey(),
  today: emptyDay(),
  history: {},
  prevWinner: null,
  profiles: {},
};

function normalizeWallet(addr: string): string {
  return String(addr).replace(/\s+/g, "").toUpperCase();
}

/** Accept ISO 3166-1 alpha-2 style codes only (defensive). */
export function isValidCountryCode(code: unknown): code is string {
  return typeof code === "string" && /^[A-Z]{2}$/.test(code);
}

function ensureDataDir(): void {
  fs.mkdirSync(path.dirname(scoresFile()), { recursive: true });
}

/** Top country (by goals desc, code asc) of a day tally. */
function dayWinner(tally: DayTally): { country: string | null; goals: number } {
  let best: { country: string | null; goals: number } = {
    country: null,
    goals: 0,
  };
  for (const [code, goals] of Object.entries(tally.countries)) {
    if (goals <= 0) continue;
    if (
      goals > best.goals ||
      (goals === best.goals && best.country !== null && code < best.country)
    ) {
      best = { country: code, goals };
    }
  }
  return best;
}

/**
 * Archive the current day and start a fresh one if the UTC day changed. Returns true if a
 * rollover happened (the live scoreboard just reset). Safe to call frequently.
 */
export function rolloverIfNeeded(nowMs: number = Date.now()): boolean {
  const key = utcDayKey(nowMs);
  // Forward-only: equal day, or a key in the past (clock skew), never rolls.
  if (key <= data.day) return false;
  const w = dayWinner(data.today);
  data.history[data.day] = {
    countries: { ...data.today.countries },
    players: { ...data.today.players },
    winner: w.country,
    winnerGoals: w.goals,
  };
  // Only advance the crowd's champion when the completed day actually had a winner,
  // so a quiet day does not blank the flag.
  if (w.country) {
    data.prevWinner = { day: data.day, country: w.country, goals: w.goals };
  }
  data.day = key;
  data.today = emptyDay();
  saveScores();
  return true;
}

/** Test-only: clear in-memory state. */
export function __resetScoresForTests(): void {
  data.season = "2026";
  data.day = utcDayKey();
  data.today = emptyDay();
  data.history = {};
  data.prevWinner = null;
  data.profiles = {};
}

function sanitizeCountries(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [code, goals] of Object.entries(
    (raw as Record<string, unknown>) ?? {}
  )) {
    if (isValidCountryCode(code) && Number.isFinite(Number(goals))) {
      const n = Math.max(0, Math.floor(Number(goals)));
      if (n > 0) out[code] = n;
    }
  }
  return out;
}

function sanitizeWalletCounts(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [wallet, goals] of Object.entries(
    (raw as Record<string, unknown>) ?? {}
  )) {
    const n = Math.max(0, Math.floor(Number(goals) || 0));
    if (wallet && n > 0) out[normalizeWallet(wallet)] = n;
  }
  return out;
}

export function loadScores(): void {
  const file = scoresFile();
  if (!fs.existsSync(file)) return;
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Record<
      string,
      unknown
    >;
    data.season = typeof raw.season === "string" ? raw.season : data.season;

    if (raw.today && typeof raw.day === "string") {
      // New (daily) format.
      data.day = raw.day;
      const today = raw.today as Partial<DayTally>;
      data.today = {
        countries: sanitizeCountries(today.countries),
        players: sanitizeWalletCounts(today.players),
        pending: sanitizeWalletCounts(today.pending),
      };
      data.history = {};
      for (const [day, arch] of Object.entries(
        (raw.history as Record<string, Partial<DayArchive>>) ?? {}
      )) {
        data.history[day] = {
          countries: sanitizeCountries(arch.countries),
          players: sanitizeWalletCounts(arch.players),
          winner: isValidCountryCode(arch.winner) ? arch.winner : null,
          winnerGoals: Math.max(0, Math.floor(Number(arch.winnerGoals) || 0)),
        };
      }
      const pw = raw.prevWinner as Partial<PrevWinner> | undefined;
      data.prevWinner =
        pw && typeof pw.day === "string"
          ? {
              day: pw.day,
              country: isValidCountryCode(pw.country) ? pw.country : null,
              goals: Math.max(0, Math.floor(Number(pw.goals) || 0)),
            }
          : null;
      data.profiles = {};
      for (const [wallet, pf] of Object.entries(
        (raw.profiles as Record<string, Partial<Profile>>) ?? {}
      )) {
        if (!wallet) continue;
        data.profiles[normalizeWallet(wallet)] = {
          country: isValidCountryCode(pf.country) ? pf.country : null,
          name: typeof pf.name === "string" ? pf.name : "",
        };
      }
    } else {
      // Legacy (cumulative) format: preserve the old all-time totals as history and
      // carry player country choices forward; start today's bucket empty.
      const legacyCountries = sanitizeCountries(raw.countries);
      const profiles: Record<string, Profile> = {};
      const legacyPlayers: Record<string, number> = {};
      for (const [wallet, ps] of Object.entries(
        (raw.players as Record<string, unknown>) ?? {}
      )) {
        if (!wallet || !ps || typeof ps !== "object") continue;
        const p = ps as { country?: unknown; goals?: unknown; name?: unknown };
        const w = normalizeWallet(wallet);
        profiles[w] = {
          country: isValidCountryCode(p.country) ? p.country : null,
          name: typeof p.name === "string" ? p.name : "",
        };
        const g = Math.max(0, Math.floor(Number(p.goals) || 0));
        if (g > 0) legacyPlayers[w] = g;
      }
      data.profiles = profiles;
      let topCode: string | null = null;
      let topGoals = 0;
      for (const [code, g] of Object.entries(legacyCountries)) {
        if (g > topGoals || (g === topGoals && topCode && code < topCode)) {
          topCode = code;
          topGoals = g;
        }
      }
      if (Object.keys(legacyCountries).length > 0) {
        data.history["0000-legacy"] = {
          countries: legacyCountries,
          players: legacyPlayers,
          winner: topCode,
          winnerGoals: topGoals,
        };
        if (topCode) {
          data.prevWinner = {
            day: "0000-legacy",
            country: topCode,
            goals: topGoals,
          };
        }
      }
      data.day = utcDayKey();
      data.today = emptyDay();
      saveScores();
    }
    console.log(`[worldcup] Loaded scores from ${file} (day ${data.day})`);
    rolloverIfNeeded();
  } catch (err) {
    console.error("[worldcup] Failed to load scores:", err);
  }
}

export function saveScores(): void {
  try {
    ensureDataDir();
    const file = scoresFile();
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data), "utf8");
    fs.renameSync(tmp, file);
  } catch (err) {
    console.error("[worldcup] Failed to save scores:", err);
  }
}

function profileEntry(wallet: string, name?: string): Profile {
  let p = data.profiles[wallet];
  if (!p) {
    p = { country: null, name: name ?? "" };
    data.profiles[wallet] = p;
  } else if (name && name !== p.name) {
    p.name = name;
  }
  return p;
}

export function getPlayerCountry(address: string): string | null {
  return data.profiles[normalizeWallet(address)]?.country ?? null;
}

/**
 * Set a player's country. Persists the choice and, if they had goals scored today before
 * choosing, flushes those pending goals to the newly chosen country.
 */
export function setCountry(
  address: string,
  code: string,
  name?: string
): { ok: boolean } {
  if (!isValidCountryCode(code)) return { ok: false };
  rolloverIfNeeded();
  const wallet = normalizeWallet(address);
  const p = profileEntry(wallet, name);
  p.country = code;
  const pend = data.today.pending[wallet] ?? 0;
  if (pend > 0) {
    data.today.countries[code] = (data.today.countries[code] ?? 0) + pend;
    delete data.today.pending[wallet];
  }
  saveScores();
  return { ok: true };
}

/**
 * Record a goal for a player. Increments their personal tally (today) and credits their
 * CURRENT country immutably; if they have no country yet, the goal is held as pending.
 * Returns the country credited (or null if pending).
 */
export function recordGoal(
  address: string,
  name?: string
): { country: string | null } {
  rolloverIfNeeded();
  const wallet = normalizeWallet(address);
  const p = profileEntry(wallet, name);
  data.today.players[wallet] = (data.today.players[wallet] ?? 0) + 1;
  if (p.country) {
    data.today.countries[p.country] =
      (data.today.countries[p.country] ?? 0) + 1;
    saveScores();
    return { country: p.country };
  }
  data.today.pending[wallet] = (data.today.pending[wallet] ?? 0) + 1;
  saveScores();
  return { country: null };
}

export interface CountryRow {
  code: string;
  goals: number;
}
export interface PlayerRow {
  wallet: string;
  name: string;
  country: string | null;
  goals: number;
}

export function getTopCountries(limit = 20): CountryRow[] {
  rolloverIfNeeded();
  return Object.entries(data.today.countries)
    .map(([code, goals]) => ({ code, goals }))
    .filter((r) => r.goals > 0)
    .sort((a, b) => b.goals - a.goals || a.code.localeCompare(b.code))
    .slice(0, Math.max(1, limit));
}

export function getTopPlayers(limit = 20): PlayerRow[] {
  rolloverIfNeeded();
  return Object.entries(data.today.players)
    .map(([wallet, goals]) => ({
      wallet,
      name: data.profiles[wallet]?.name ?? "",
      country: data.profiles[wallet]?.country ?? null,
      goals,
    }))
    .filter((r) => r.goals > 0)
    .sort((a, b) => b.goals - a.goals)
    .slice(0, Math.max(1, limit));
}

/** Most recent completed day that had a winner — the country the crowd celebrates. */
export function getPreviousDayWinner(): PrevWinner | null {
  rolloverIfNeeded();
  return data.prevWinner ? { ...data.prevWinner } : null;
}

export interface DaySummary {
  day: string;
  winner: string | null;
  winnerGoals: number;
  totalGoals: number;
}

/** Archived day winners, most recent first (for history surfaces). */
export function getHistory(limit = 30): DaySummary[] {
  return Object.entries(data.history)
    .map(([day, arch]) => ({
      day,
      winner: arch.winner,
      winnerGoals: arch.winnerGoals,
      totalGoals: Object.values(arch.countries).reduce((s, n) => s + n, 0),
    }))
    .sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0))
    .slice(0, Math.max(1, limit));
}

/** One UTC day's full goal breakdown (live `today` or an archived day) for reporting. */
export interface DayGoalReport {
  day: string;
  /** Total goals credited to players that day (includes pending / no-country goals). */
  totalGoals: number;
  /** Winning country (most goals; ties broken by code), or null when no country scored. */
  winner: string | null;
  winnerGoals: number;
  /** Countries by goals desc (ties by code asc). */
  countries: CountryRow[];
  /** Players by goals desc (ties by wallet asc), joined with their persistent profile. */
  players: PlayerRow[];
}

/**
 * Goal breakdown for a specific UTC day (`YYYY-MM-DD`): the live `today` bucket when `dayKey`
 * is the current day, otherwise the archived `history` entry. Returns null for an unknown day.
 * Player rows are joined with persistent profiles so names/countries survive the daily reset.
 * Used by the end-of-day Telegram report; safe to call any time (rolls the day first).
 */
export function getDayReport(dayKey: string, limit = 50): DayGoalReport | null {
  rolloverIfNeeded();
  const isToday = dayKey === data.day;
  const arch = isToday ? null : data.history[dayKey];
  if (!isToday && !arch) return null;
  const countriesRaw = isToday ? data.today.countries : arch!.countries;
  const playersRaw = isToday ? data.today.players : arch!.players;
  const cap = Math.max(1, limit);
  const countries = Object.entries(countriesRaw)
    .map(([code, goals]) => ({ code, goals }))
    .filter((r) => r.goals > 0)
    .sort((a, b) => b.goals - a.goals || a.code.localeCompare(b.code))
    .slice(0, cap);
  const players = Object.entries(playersRaw)
    .map(([wallet, goals]) => ({
      wallet,
      name: data.profiles[wallet]?.name ?? "",
      country: data.profiles[wallet]?.country ?? null,
      goals,
    }))
    .filter((r) => r.goals > 0)
    .sort((a, b) => b.goals - a.goals || a.wallet.localeCompare(b.wallet))
    .slice(0, cap);
  const totalGoals = Object.values(playersRaw).reduce(
    (sum, n) => sum + (n > 0 ? n : 0),
    0
  );
  let winner: string | null;
  let winnerGoals: number;
  if (isToday) {
    const w = dayWinner(data.today);
    winner = w.country;
    winnerGoals = w.goals;
  } else {
    winner = arch!.winner;
    winnerGoals = arch!.winnerGoals;
  }
  return { day: dayKey, totalGoals, winner, winnerGoals, countries, players };
}

export function getLeaderboard(): {
  season: string;
  day: string;
  countries: CountryRow[];
  players: PlayerRow[];
  previousWinner: PrevWinner | null;
  history: DaySummary[];
} {
  rolloverIfNeeded();
  return {
    season: data.season,
    day: data.day,
    countries: getTopCountries(50),
    players: getTopPlayers(50),
    previousWinner: getPreviousDayWinner(),
    history: getHistory(30),
  };
}
