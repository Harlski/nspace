import {
  getDailyStatsAggregate,
  type DailyStatsAggregate,
} from "./eventLog.js";
import { isTelegramConfigured, sendTelegramPlainText } from "./telegramNotify.js";
import {
  getPendingQueueTotals,
  isPayoutSenderConfigured,
  triggerEndOfDayFlush,
} from "./payoutGateway.js";
// Seasonal World Cup goal recap (second Telegram message); returns null when the feature is
// off or the day had no goals. Grep "worldcup" to find the deletable hooks.
import { buildWorldcupGoalDayMessage } from "./worldcup/goalDayReport.js";

const DAY_MS = 86_400_000;
/** Delay after UTC midnight before sending so late `session_end` writes for the day land first. */
const SEND_OFFSET_MS = 2 * 60 * 1000;
const LOG_TAG = "daily-stats";

function envTrim(key: string): string {
  return String(process.env[key] ?? "").trim();
}

function parseBoolEnv(value: string): boolean | null {
  const v = value.toLowerCase();
  if (v === "") return null;
  if (["0", "false", "off", "no"].includes(v)) return false;
  if (["1", "true", "on", "yes"].includes(v)) return true;
  return null;
}

function lookbackDays(): number {
  const raw = Number(envTrim("DAILY_STATS_LOOKBACK_DAYS"));
  if (Number.isFinite(raw) && raw >= 1) return Math.floor(raw);
  return 400;
}

function statsChatIdOverride(): string {
  return envTrim("DAILY_STATS_TELEGRAM_CHAT_ID");
}

/** Whether the daily stats Telegram report should run. Defaults on when Telegram is configured. */
export function dailyStatsReportEnabled(): boolean {
  const explicit = parseBoolEnv(envTrim("DAILY_STATS_TELEGRAM_ENABLED"));
  if (explicit === false) return false;
  if (!isTelegramConfigured() && !statsChatIdOverride()) return false;
  if (explicit === true) return true;
  return isTelegramConfigured() || Boolean(statsChatIdOverride());
}

/**
 * Whether the pending NIM payout queue is auto-flushed at the end of each UTC day.
 * Defaults on when the Payout Service client is configured; force with `NIM_PAYOUT_DAILY_FLUSH_ENABLED`.
 */
export function dailyPayoutFlushEnabled(): boolean {
  const explicit = parseBoolEnv(envTrim("NIM_PAYOUT_DAILY_FLUSH_ENABLED"));
  if (explicit === false) return false;
  if (explicit === true) return true;
  return isPayoutSenderConfigured();
}

/** Pending-queue context appended to a stats report so pending NIM is folded into the day total. */
export type PendingPayoutSummaryForReport = {
  jobCount: number;
  recipientCount: number;
  /** Raw luna sum still owed on-chain (combined with the day's sent luna for the day total). */
  luna: string;
  /** True when this run auto-flushes the queue right after the report is sent. */
  willFlush: boolean;
};

/** Live pending-queue snapshot. `willFlush` marks whether this run pays it out after reporting. */
async function currentPendingSummary(
  willFlush: boolean
): Promise<PendingPayoutSummaryForReport> {
  const t = await getPendingQueueTotals();
  return {
    jobCount: t.jobCount,
    recipientCount: t.recipientCount,
    luna: t.totalLuna,
    willFlush,
  };
}

/** Format a raw luna string as NIM (5 decimals); mirrors the event-log aggregate formatting. */
function lunaToNim(luna: string): string {
  if (!/^\d+$/.test(luna)) return "0";
  const v = BigInt(luna);
  const whole = v / 100000n;
  const frac = (v % 100000n).toString().padStart(5, "0");
  return `${whole.toString()}.${frac}`;
}

/** Start-of-day (UTC) in ms for the UTC calendar day containing `ts`. */
export function utcDayStartMs(ts: number): number {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Start-of-day (UTC) for the day before the one containing `ts`. */
export function previousUtcDayStartMs(ts: number): number {
  return utcDayStartMs(ts) - DAY_MS;
}

/** Parse a `YYYY-MM-DD` string into its UTC start-of-day ms, or null when invalid. */
export function parseUtcDayStartMs(dayUtc: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayUtc.trim());
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (!Number.isFinite(ms)) return null;
  return ms;
}

function trimNim(nim: string | null): string {
  if (!nim) return "0";
  if (!nim.includes(".")) return nim;
  const trimmed = nim.replace(/0+$/, "").replace(/\.$/, "");
  return trimmed === "" ? "0" : trimmed;
}

function formatActiveDuration(ms: number): string {
  if (ms <= 0) return "0m";
  const totalMinutes = Math.round(ms / 60_000);
  if (totalMinutes < 1) return "<1m";
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
  return parts.join(" ");
}

function utcStamp(ts: number): string {
  return new Date(ts).toISOString().slice(0, 16).replace("T", " ");
}

function plural(n: number): string {
  return n === 1 ? "" : "s";
}

export function formatDailyStatsMessage(
  agg: DailyStatsAggregate,
  headerLabel?: string,
  pending?: PendingPayoutSummaryForReport
): string {
  const header = headerLabel ?? `Daily stats for ${agg.dayUtc} (UTC)`;
  const lines = [
    `Nimiq Space - ${header}`,
    "",
    "Players",
    `- Unique signed in: ${agg.uniqueSignedIn}`,
    `- New users: ${agg.newSignedIn}`,
    `- Nimiq Pay: ${agg.nimiqPaySignedIn} / Other: ${agg.nonNimiqPaySignedIn}`,
    `- Total sign-ins: ${agg.sessionStarts}`,
    "",
    "NIM payouts",
    `- Payouts sent: ${agg.payoutsSent} (to ${agg.payoutRecipients} wallet${plural(
      agg.payoutRecipients
    )})`,
    `- Total paid out: ${trimNim(agg.payoutNimTotal)} NIM`,
  ];
  if (pending && pending.jobCount > 0) {
    const note = pending.willFlush ? " - paying out now" : " - still queued";
    lines.push(
      `- Pending in queue: ${trimNim(lunaToNim(pending.luna))} NIM (${
        pending.jobCount
      } payout${plural(pending.jobCount)} to ${pending.recipientCount} wallet${plural(
        pending.recipientCount
      )})${note}`
    );
    const totalLuna = (
      BigInt(/^\d+$/.test(agg.payoutLunaTotal) ? agg.payoutLunaTotal : "0") +
      BigInt(/^\d+$/.test(pending.luna) ? pending.luna : "0")
    ).toString();
    lines.push(`- Total NIM (sent + pending): ${trimNim(lunaToNim(totalLuna))} NIM`);
  }
  lines.push(
    "",
    "Active in-game time (excludes AFK)",
    `- Total: ${formatActiveDuration(agg.activePlayMsTotal)} across ${
      agg.endedSessionsCounted
    } ended session${plural(agg.endedSessionsCounted)}`
  );
  return lines.join("\n");
}

/**
 * Build the aggregate + formatted message for an arbitrary window, with an explicit header label.
 * When `pending` is omitted, a live pending-queue snapshot (no flush) is included.
 */
export async function buildStatsReport(
  windowStartMs: number,
  windowEndMs: number,
  headerLabel: string,
  pending?: PendingPayoutSummaryForReport
): Promise<{ aggregate: DailyStatsAggregate; message: string }> {
  const aggregate = await getDailyStatsAggregate(
    windowStartMs,
    windowEndMs,
    lookbackDays()
  );
  const pendingInfo = pending ?? (await currentPendingSummary(false));
  return {
    aggregate,
    message: formatDailyStatsMessage(aggregate, headerLabel, pendingInfo),
  };
}

/**
 * Build the aggregate + formatted message for the UTC day starting at `dayStartMs`.
 * `worldcupMessage` is the optional seasonal goal recap (second Telegram message); it is null
 * when the World Cup feature is off or the day had no credited goals.
 */
export async function buildDailyStatsReport(
  dayStartMs: number,
  pending?: PendingPayoutSummaryForReport
): Promise<{
  aggregate: DailyStatsAggregate;
  message: string;
  worldcupMessage: string | null;
}> {
  const dayKey = new Date(dayStartMs).toISOString().slice(0, 10);
  const report = await buildStatsReport(
    dayStartMs,
    dayStartMs + DAY_MS,
    `Daily stats for ${dayKey} (UTC)`,
    pending
  );
  return {
    ...report,
    worldcupMessage: buildWorldcupGoalDayMessage(dayKey, `Match day for ${dayKey} (UTC)`),
  };
}

/** Build the report for the rolling last 24 hours ending at `endMs` (defaults to now). */
export async function buildRolling24hReport(
  endMs: number = Date.now()
): Promise<{ aggregate: DailyStatsAggregate; message: string }> {
  const startMs = endMs - DAY_MS;
  return buildStatsReport(
    startMs,
    endMs,
    `Last 24h (${utcStamp(startMs)} -> ${utcStamp(endMs)} UTC)`
  );
}

/**
 * Build and send the report for the UTC day starting at `dayStartMs`. Returns the report.
 * Sends the seasonal World Cup goal recap as a second message when present.
 */
export async function sendDailyStatsReport(
  dayStartMs: number,
  pending?: PendingPayoutSummaryForReport
): Promise<{
  aggregate: DailyStatsAggregate;
  message: string;
  worldcupMessage: string | null;
}> {
  const report = await buildDailyStatsReport(dayStartMs, pending);
  await sendTelegramPlainText(report.message, LOG_TAG, statsChatIdOverride());
  if (report.worldcupMessage) {
    await sendTelegramPlainText(report.worldcupMessage, LOG_TAG, statsChatIdOverride());
  }
  return report;
}

/** Build and send the rolling last-24-hours report. Returns the report. */
export async function sendRolling24hReport(
  endMs: number = Date.now()
): Promise<{ aggregate: DailyStatsAggregate; message: string }> {
  const report = await buildRolling24hReport(endMs);
  await sendTelegramPlainText(report.message, LOG_TAG, statsChatIdOverride());
  return report;
}

function scheduleNext(): void {
  const now = Date.now();
  const nextRun = utcDayStartMs(now) + DAY_MS + SEND_OFFSET_MS;
  const delay = Math.max(1000, nextRun - now);
  setTimeout(() => {
    void runScheduledReport();
    scheduleNext();
  }, delay).unref?.();
}

async function runScheduledReport(): Promise<void> {
  await runEndOfDaySnapshotReportFlushSequence();
}

/** Test hook: runs snapshot → report → flush and returns step order. */
export async function runEndOfDaySnapshotReportFlushSequence(opts?: {
  sendReport?: (
    dayStartMs: number,
    pending: PendingPayoutSummaryForReport
  ) => Promise<unknown>;
  flush?: () => Promise<unknown>;
  recordStep?: (step: string) => void;
}): Promise<PendingPayoutSummaryForReport> {
  const record = opts?.recordStep ?? (() => {});
  const willFlush = dailyPayoutFlushEnabled();
  const pending = await currentPendingSummary(willFlush);
  record("snapshot");

  try {
    if (dailyStatsReportEnabled()) {
      const dayStartMs = previousUtcDayStartMs(Date.now());
      const send = opts?.sendReport ?? sendDailyStatsReport;
      await send(dayStartMs, pending);
      record("report");
      console.log(
        `[${LOG_TAG}] sent report for ${new Date(dayStartMs).toISOString().slice(0, 10)}`,
        JSON.stringify({
          pendingLuna: pending.luna,
          willFlush,
        })
      );
    }
  } catch (err) {
    console.error(`[${LOG_TAG}] scheduled report failed:`, err);
  }

  if (willFlush) {
    try {
      const flushFn = opts?.flush ?? triggerEndOfDayFlush;
      const flush = await flushFn();
      record("flush");
      console.log(`[${LOG_TAG}] end-of-day payout flush`, JSON.stringify(flush));
    } catch (err) {
      console.error(`[${LOG_TAG}] end-of-day payout flush failed:`, err);
    }
  }

  return pending;
}

/**
 * Schedule the once-per-UTC-day end-of-day tasks: auto-flush the pending NIM payout queue
 * and send the Telegram stats report. No-op only when both are disabled.
 */
export function startDailyStatsScheduler(): void {
  const reportEnabled = dailyStatsReportEnabled();
  const flushEnabled = dailyPayoutFlushEnabled();
  if (!reportEnabled && !flushEnabled) {
    console.log(
      `[${LOG_TAG}] scheduler disabled`,
      JSON.stringify({
        telegramConfigured: isTelegramConfigured(),
        hasChatOverride: Boolean(statsChatIdOverride()),
        payoutSenderConfigured: isPayoutSenderConfigured(),
      })
    );
    return;
  }
  console.log(
    `[${LOG_TAG}] scheduler enabled`,
    JSON.stringify({
      lookbackDays: lookbackDays(),
      telegramReport: reportEnabled,
      endOfDayPayoutFlush: flushEnabled,
    })
  );
  scheduleNext();
}
