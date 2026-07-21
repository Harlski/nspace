/**
 * Aggregate chosen Country (profile flag) among analytics unique-visitor wallets.
 *
 * Counts each wallet's **current** Country from the World Cup / profile store — not
 * historical selection at session time, and not Flag Emote usage.
 */

export type ChosenFlagRow = {
  /** ISO 3166-1 alpha-2. */
  code: string;
  count: number;
};

export type ChosenFlagsStats = {
  uniqueVisitors: number;
  withFlag: number;
  withoutFlag: number;
  /** Sorted by count desc, then code asc. */
  byCountry: ChosenFlagRow[];
};

/**
 * @param walletIds Distinct wallets active in the analytics window (e.g. unique visitors).
 * @param getCountry Current Country for a wallet, or null when unset.
 */
export function aggregateChosenFlags(
  walletIds: Iterable<string>,
  getCountry: (wallet: string) => string | null | undefined
): ChosenFlagsStats {
  const counts = new Map<string, number>();
  let uniqueVisitors = 0;
  let withFlag = 0;

  for (const raw of walletIds) {
    uniqueVisitors += 1;
    const code = String(getCountry(raw) ?? "")
      .trim()
      .toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) continue;
    withFlag += 1;
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }

  const byCountry = [...counts.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));

  return {
    uniqueVisitors,
    withFlag,
    withoutFlag: uniqueVisitors - withFlag,
    byCountry,
  };
}
