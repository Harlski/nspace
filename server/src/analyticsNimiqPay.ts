/**
 * Nimiq Pay slice of `/analytics` overview: window activity vs acquisition cohort.
 *
 * - **Activity (DAU-style):** wallet had ≥1 `session_start` with `nimiqPay: true` in the window.
 * - **First-time (acquisition):** wallet's first-ever `session_start` in log lookback falls in the
 *   window **and** that first session was Pay-tagged.
 */

export type NimiqPayDayRow = {
  dayUtc: string;
  /** Distinct wallets with a Pay-tagged session_start that UTC day. */
  uniquePay: number;
  /** First-ever sessions that day that were Pay-tagged. */
  firstTimePay: number;
};

export type NimiqPayAnalytics = {
  /** Unique visitors in the window with ≥1 Pay session (activity cohort). */
  uniqueVisitors: number;
  /** Unique visitors with no Pay session in the window. */
  otherUniqueVisitors: number;
  /** First-ever session in window was Pay-tagged (acquisition). */
  firstTime: number;
  /** Pay unique visitors who also had a session_start before the window. */
  returning: number;
  /** Count of Pay-tagged session_start events in the window. */
  sessionStarts: number;
  /** Capped-gap active play ms for ended sessions that started Pay-tagged. */
  activePlayMs: number;
  /** Sum of payout luna to wallets in the Pay activity cohort (window totals). */
  payoutLunaToPayVisitors: string;
  payoutNimToPayVisitors: string;
  /** Per UTC day in the window (newest first). */
  byDay: NimiqPayDayRow[];
};

export type NimiqPayAnalyticsInput = {
  windowUniqueVisitors: number;
  payVisitors: ReadonlySet<string>;
  payFirstTime: ReadonlySet<string>;
  seenBeforeWindow: ReadonlySet<string>;
  paySessionStarts: number;
  payActivePlayMs: number;
  /** wallet → payout luna accrued in the analytics window. */
  visitorPayoutLuna: ReadonlyMap<string, bigint>;
  payUniqueByDay: ReadonlyMap<string, ReadonlySet<string>>;
  payFirstByDay: ReadonlyMap<string, ReadonlySet<string>>;
  formatLunaToNim: (luna: string) => string | null;
};

/** Finalize Pay cohort counters after a single event-log pass. */
export function finalizeNimiqPayAnalytics(input: NimiqPayAnalyticsInput): NimiqPayAnalytics {
  let payoutLuna = 0n;
  for (const wallet of input.payVisitors) {
    payoutLuna += input.visitorPayoutLuna.get(wallet) ?? 0n;
  }

  let returning = 0;
  for (const wallet of input.payVisitors) {
    if (input.seenBeforeWindow.has(wallet)) returning += 1;
  }

  const dayKeys = new Set<string>([
    ...input.payUniqueByDay.keys(),
    ...input.payFirstByDay.keys(),
  ]);
  const byDay = [...dayKeys]
    .sort((a, b) => b.localeCompare(a))
    .map((dayUtc) => ({
      dayUtc,
      uniquePay: input.payUniqueByDay.get(dayUtc)?.size ?? 0,
      firstTimePay: input.payFirstByDay.get(dayUtc)?.size ?? 0,
    }));

  const lunaStr = payoutLuna.toString();
  return {
    uniqueVisitors: input.payVisitors.size,
    otherUniqueVisitors: Math.max(0, input.windowUniqueVisitors - input.payVisitors.size),
    firstTime: input.payFirstTime.size,
    returning,
    sessionStarts: Math.max(0, Math.floor(input.paySessionStarts)),
    activePlayMs: Math.max(0, Math.floor(input.payActivePlayMs)),
    payoutLunaToPayVisitors: lunaStr,
    payoutNimToPayVisitors: input.formatLunaToNim(lunaStr) ?? "0.00000",
    byDay,
  };
}
