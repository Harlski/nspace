/**
 * World Cup soccer - Free Play Field scoreboard presentation helpers.
 *
 * Pure ranking and layout policy for the in-room scoreboard. The HUD uses a compact
 * Scoreboard Chip on narrow / touch layouts and an expandable panel otherwise.
 */

export type CountryGoals = { code: string; goals: number };

export type RankedCountry = { rank: number; code: string; goals: number };

/** Same cap the server sends on `goalScored` / welcome (`worldcupGetTopCountries(8)`). */
export const SCOREBOARD_ROW_LIMIT = 8;

/** Matches HUD chrome: `@media (max-width: 720px), (pointer: coarse)`. */
export const SCOREBOARD_CHIP_MAX_WIDTH_PX = 720;

export const SCOREBOARD_CHIP_MEDIA =
  `(max-width: ${SCOREBOARD_CHIP_MAX_WIDTH_PX}px), (pointer: coarse)`;

export function usesScoreboardChip(opts: {
  viewportWidth: number;
  coarsePointer: boolean;
}): boolean {
  return opts.coarsePointer || opts.viewportWidth <= SCOREBOARD_CHIP_MAX_WIDTH_PX;
}

export function rankCountryGoals(
  countries: readonly CountryGoals[],
  limit = SCOREBOARD_ROW_LIMIT
): RankedCountry[] {
  return [...countries]
    .sort((a, b) => b.goals - a.goals)
    .slice(0, limit)
    .map((row, i) => ({ rank: i + 1, code: row.code, goals: row.goals }));
}

export function leadingCountryChip(
  countries: readonly CountryGoals[]
): RankedCountry | null {
  return rankCountryGoals(countries, 1)[0] ?? null;
}

export function scoreboardChipMediaMatches(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(SCOREBOARD_CHIP_MEDIA).matches;
}
