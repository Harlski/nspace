/**
 * World Cup soccer - end-of-day goal recap for the Telegram report (FEATURE-FLAGGED).
 *
 * Builds the optional *second* message the daily stats reporter sends: how many goals were
 * scored that UTC day, the top teams (countries) on the podium, the day's MVP (top scorer),
 * and the leading scorers. Reads the per-day tally from the score store and returns null when
 * the seasonal feature is off or the day had no credited goals (so quiet days stay silent).
 *
 * Kept under `worldcup/` so deprecating the feature only requires deleting this folder plus
 * the single guarded import in `dailyStatsReport.ts` (grep "worldcup").
 */
import { WORLDCUP_ENABLED } from "./config.js";
import { getDayReport, type PlayerRow } from "./scoreStore.js";

/** Alpha-2 code (e.g. "BR") → flag emoji (🇧🇷); white flag for anything invalid. */
function flagEmoji(code: string | null): string {
  const cc = String(code ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return "\u{1F3F3}\uFE0F";
  const A = 0x1f1e6;
  return String.fromCodePoint(A + cc.charCodeAt(0) - 65, A + cc.charCodeAt(1) - 65);
}

/** Compact a Nimiq address for display when a player has no chosen name. */
function shortWallet(wallet: string): string {
  const w = String(wallet).replace(/\s+/g, "");
  return w.length <= 12 ? w : `${w.slice(0, 6)}…${w.slice(-4)}`;
}

/** Player label: flag (when known) + display name, falling back to a short wallet. */
function playerLabel(p: PlayerRow): string {
  const who = p.name.trim() || shortWallet(p.wallet);
  return p.country ? `${flagEmoji(p.country)} ${who}` : who;
}

function goalsWord(n: number): string {
  return `${n} goal${n === 1 ? "" : "s"}`;
}

const MEDALS = ["🥇", "🥈", "🥉"];

/** Rank prefix: medal for the podium, plain "N." after. */
function rankPrefix(index: number): string {
  return MEDALS[index] ?? `${index + 1}.`;
}

/**
 * The day's goal recap as a Telegram-ready plain-text message, or null when there is nothing
 * to celebrate (feature disabled, unknown day, or zero goals). `dayKey` is a UTC `YYYY-MM-DD`.
 */
export function buildWorldcupGoalDayMessage(
  dayKey: string,
  headerLabel?: string
): string | null {
  if (!WORLDCUP_ENABLED) return null;
  const report = getDayReport(dayKey);
  if (!report || report.totalGoals <= 0) return null;

  const header = headerLabel ?? `Match day for ${report.day} (UTC)`;
  const lines: string[] = [
    `Nimiq Space - ${header}`,
    "",
    `⚽ Goals scored: ${report.totalGoals}`,
  ];

  if (report.countries.length > 0) {
    lines.push("", "Top teams");
    for (const [i, c] of report.countries.slice(0, 3).entries()) {
      lines.push(`${rankPrefix(i)} ${flagEmoji(c.code)} ${c.code} - ${goalsWord(c.goals)}`);
    }
  }

  if (report.players.length > 0) {
    const mvp = report.players[0]!;
    lines.push("", `MVP: ${playerLabel(mvp)} - ${goalsWord(mvp.goals)}`);
    if (report.players.length > 1) {
      lines.push("", "Top scorers");
      for (const [i, p] of report.players.slice(0, 5).entries()) {
        lines.push(`${rankPrefix(i)} ${playerLabel(p)} - ${goalsWord(p.goals)}`);
      }
    }
  }

  return lines.join("\n");
}
