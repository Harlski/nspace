import {
  fetchActivityDigest,
  type ActivityDigest,
  type ActivityDigestPlayer,
} from "./analyticsServiceClient.js";
import { isChannelMuted, isMiningBanned, isUsernameSetBanned } from "./moderationStore.js";
import { getPendingQueueTotals } from "./payoutGateway.js";
import { getEffectivePlayerDisplayName } from "./playerProfileStore.js";
import { listOnlineRealPlayers, type OnlineRealPlayer } from "./rooms.js";
import { isTelegramConfigured, sendTelegramPreformatted } from "./telegramNotify.js";
import { walletDisplayName } from "./walletDisplayName.js";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** Send shortly after the UTC hour so the last session writes land first. */
const SEND_OFFSET_MS = 60 * 1000;
const RETRY_MS = 2 * 60 * 1000;
const LOG_TAG = "hourly-activity";
const DEFAULT_TOP_N = 12;
const MAX_TOP_N = 25;
const JOINED_NAME_LIMIT = 8;

function envTrim(key: string): string {
  let v = String(process.env[key] ?? "").trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

function parseBoolEnv(value: string): boolean | null {
  const v = value.toLowerCase();
  if (v === "") return null;
  if (["0", "false", "off", "no"].includes(v)) return false;
  if (["1", "true", "on", "yes"].includes(v)) return true;
  return null;
}

function chatIdOverride(): string {
  return envTrim("HOURLY_ACTIVITY_TELEGRAM_CHAT_ID");
}

function lookbackDays(): number {
  const own = Number(envTrim("HOURLY_ACTIVITY_LOOKBACK_DAYS"));
  if (Number.isFinite(own) && own >= 1) return Math.floor(own);
  const daily = Number(envTrim("DAILY_STATS_LOOKBACK_DAYS"));
  if (Number.isFinite(daily) && daily >= 1) return Math.floor(daily);
  return 400;
}

export function hourlyActivityTopN(): number {
  const raw = Number(envTrim("HOURLY_ACTIVITY_TOP_N"));
  if (Number.isFinite(raw) && raw >= 1) {
    return Math.min(MAX_TOP_N, Math.floor(raw));
  }
  return DEFAULT_TOP_N;
}

/** Whether the hourly activity digest should run. Defaults on when Telegram is configured. */
export function hourlyActivityReportEnabled(): boolean {
  const explicit = parseBoolEnv(envTrim("HOURLY_ACTIVITY_TELEGRAM_ENABLED"));
  if (explicit === false) return false;
  if (!isTelegramConfigured() && !chatIdOverride()) return false;
  if (explicit === true) return true;
  return isTelegramConfigured() || Boolean(chatIdOverride());
}

/** Delay until the next UTC hour plus the send offset. */
export function msUntilNextHourlyActivity(nowMs: number): number {
  const hourStart = Math.floor(nowMs / HOUR_MS) * HOUR_MS;
  let next = hourStart + SEND_OFFSET_MS;
  if (next <= nowMs) next += HOUR_MS;
  return Math.max(1000, next - nowMs);
}

/** UTC hour boundary the digest should close on when fired at `nowMs`. */
export function hourlyActivityWindowEndMs(nowMs: number): number {
  const hourStart = Math.floor(nowMs / HOUR_MS) * HOUR_MS;
  if (nowMs < hourStart + SEND_OFFSET_MS) return hourStart - HOUR_MS;
  return hourStart;
}

function lunaToBig(luna: string | null | undefined): bigint {
  if (!luna || !/^\d+$/.test(luna)) return 0n;
  return BigInt(luna);
}

/** Compact NIM for a table cell. Two decimals at or above 0.01 NIM, else up to four. */
export function formatNimCompact(luna: bigint): string {
  if (luna <= 0n) return "0";
  const whole = luna / 100000n;
  const frac = luna % 100000n;
  if (frac === 0n) return whole.toString();
  if (luna >= 1000n) {
    const cents = (frac + 500n) / 1000n;
    if (cents >= 100n) return (whole + 1n).toString();
    return `${whole.toString()}.${cents.toString().padStart(2, "0")}`.replace(/0+$/, "").replace(/\.$/, "");
  }
  const four = (luna / 10n).toString().padStart(4, "0");
  return `0.${four}`.replace(/0+$/, "").replace(/\.$/, "");
}

/** Header NIM with up to 4 decimal places. */
export function formatNimHeader(luna: bigint): string {
  if (luna <= 0n) return "0";
  const whole = luna / 100000n;
  const frac = (luna % 100000n).toString().padStart(5, "0").slice(0, 4);
  const text = `${whole.toString()}.${frac}`.replace(/0+$/, "").replace(/\.$/, "");
  return text === "" ? "0" : text;
}

export function formatPlayedDuration(ms: number): string {
  if (ms <= 0) return "0m";
  const totalMinutes = Math.round(ms / 60_000);
  if (totalMinutes < 1) return "<1m";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  if (hours >= 100) return `${hours}h`;
  return `${hours}h${String(minutes).padStart(2, "0")}m`;
}

function utcStamp(ts: number): string {
  return new Date(ts).toISOString().slice(0, 16).replace("T", " ");
}

function clipCell(value: string, width: number): string {
  const clean = Array.from(value.replace(/[\r\n\t]/g, " ").replace(/\s+/g, " ").trim());
  if (clean.length > width) return clean.slice(0, width).join("");
  return clean.join("").padEnd(width, " ");
}

function tableRow(cols: [string, string, string, string, string, string, string]): string {
  const widths = [2, 16, 7, 7, 8, 2, 4] as const;
  return cols.map((col, i) => clipCell(col, widths[i]!)).join(" ");
}

export type HourlyActivityView = {
  digest: ActivityDigest;
  online: OnlineRealPlayer[];
  pendingLuna: bigint | null;
  pendingRecipients: number | null;
  topN?: number;
};

function playerLabel(address: string, onlineName: string | undefined): string {
  const live = onlineName?.trim();
  if (live) return live;
  if (address.startsWith("guest:")) {
    const nick = getEffectivePlayerDisplayName(address);
    if (nick && nick !== address) return nick;
    return `Guest ${address.slice("guest:".length, "guest:".length + 4)}`;
  }
  return getEffectivePlayerDisplayName(address) || walletDisplayName(address) || address;
}

function sanctionLabels(address: string): string[] {
  if (address.startsWith("guest:")) return [];
  const flags: string[] = [];
  if (isMiningBanned(address)) flags.push("mining restricted");
  if (isChannelMuted(address)) flags.push("chat muted");
  if (isUsernameSetBanned(address)) flags.push("username ban");
  return flags;
}

type RenderRow = {
  player: ActivityDigestPlayer;
  name: string;
  roomNow: string | null;
  flags: string[];
  nim: bigint;
};

function renderRows(view: HourlyActivityView): RenderRow[] {
  const onlineByAddress = new Map<string, OnlineRealPlayer>();
  for (const player of view.online) {
    const key = player.address.startsWith("guest:")
      ? player.address
      : player.address.trim().toUpperCase();
    onlineByAddress.set(key, player);
  }
  return view.digest.players.map((player) => {
    const online = onlineByAddress.get(player.address);
    return {
      player,
      name: playerLabel(player.address, online?.displayName),
      roomNow: online ? online.roomId : null,
      flags: sanctionLabels(player.address),
      nim: lunaToBig(player.nimEarnedLuna),
    };
  });
}

function pickTableRows(rows: RenderRow[], topN: number): { shown: RenderRow[]; extraEarners: RenderRow[] } {
  const byActive = rows.slice(0, topN);
  const shownKeys = new Set(byActive.map((row) => row.player.address));
  const extraEarners = [...rows]
    .filter((row) => row.nim > 0n && !shownKeys.has(row.player.address))
    .sort((a, b) => (b.nim > a.nim ? 1 : b.nim < a.nim ? -1 : 0))
    .slice(0, 3);
  return { shown: byActive, extraEarners };
}

function nameWithMarks(row: RenderRow): string {
  const marks = `${row.player.isNew ? "*" : ""}${row.player.nimiqPay ? "+" : ""}`;
  return `${row.name}${marks}`;
}

/**
 * Plain-text hourly digest. The sender wraps it in a Telegram `<pre>` block so the
 * columns stay aligned.
 */
export function formatHourlyActivityMessage(view: HourlyActivityView): string {
  const digest = view.digest;
  const topN = view.topN ?? hourlyActivityTopN();
  const rows = renderRows(view);
  const { shown, extraEarners } = pickTableRows(rows, topN);
  const lines: string[] = [
    "Nimiq Space hourly activity",
    `${utcStamp(digest.windowStartMs)} -> ${utcStamp(digest.windowEndMs)} UTC (last 24h)`,
    "",
    `Online now: ${view.online.length}`,
    `Players: ${digest.uniquePlayers} (${digest.newPlayers} new, ${digest.guestPlayers} guests, ${digest.nimiqPayPlayers} Nimiq Pay)`,
    `Active play: ${formatPlayedDuration(digest.activePlayMsTotal)}`,
    `NIM earned: ${formatNimHeader(lunaToBig(digest.nimEarnedLuna))}`,
  ];
  if (view.pendingLuna == null) {
    lines.push("Pending payout: unavailable");
  } else {
    const people = view.pendingRecipients ?? 0;
    lines.push(
      `Pending payout: ${formatNimHeader(view.pendingLuna)} NIM across ${people} player${people === 1 ? "" : "s"}`
    );
  }
  lines.push(
    `Sessions: ${digest.sessionStarts} (${digest.sessionStartsLastHour} in the last hour)`
  );
  lines.push(
    `Chat: ${digest.chatLines} | Mines: ${digest.blocksClaimed} | Blocks placed: ${digest.blocksPlaced}`
  );
  if (digest.topRooms.length > 0) {
    lines.push(
      `Rooms: ${digest.topRooms
        .map((room) => `${room.roomId} ${formatPlayedDuration(room.activeMs)}`)
        .join(", ")}`
    );
  }
  lines.push("");
  if (shown.length === 0) {
    lines.push("No players in the last 24 hours.");
  } else {
    lines.push("* new   + Nimiq Pay   Now is the room if they are online");
    lines.push(tableRow(["#", "Player", "Played", "NIM", "Now", "S", "Chat"]));
    shown.forEach((row, index) => {
      lines.push(
        tableRow([
          String(index + 1),
          nameWithMarks(row),
          formatPlayedDuration(row.player.activeMs),
          formatNimCompact(row.nim),
          row.roomNow ?? "-",
          String(row.player.sessionStarts),
          String(row.player.chatCount),
        ])
      );
    });
    const omitted = Math.max(0, digest.playerCount - shown.length);
    if (omitted > 0) lines.push(`+ ${omitted} more player${omitted === 1 ? "" : "s"}`);
  }
  if (extraEarners.length > 0) {
    lines.push(
      `Also earned: ${extraEarners
        .map((row) => `${row.name} ${formatNimCompact(row.nim)}`)
        .join(", ")}`
    );
  }
  const joinedAddresses = digest.joinedLastHourAddresses ?? [];
  if (joinedAddresses.length > 0) {
    const onlineByAddress = new Map(
      view.online.map((player) => [
        player.address.startsWith("guest:")
          ? player.address
          : player.address.trim().toUpperCase(),
        player.displayName,
      ])
    );
    const names = joinedAddresses
      .slice(0, JOINED_NAME_LIMIT)
      .map((address) => playerLabel(address, onlineByAddress.get(address)));
    const more = joinedAddresses.length - names.length;
    lines.push(
      `Joined this hour: ${names.join(", ")}${more > 0 ? ` +${more}` : ""}`
    );
  }
  const flagged = shown.filter((row) => row.flags.length > 0);
  if (flagged.length > 0) {
    lines.push(
      `Sanctions: ${flagged
        .map((row) => `${row.name} (${row.flags.join(", ")})`)
        .join("; ")}`
    );
  }
  return lines.join("\n");
}

export type HourlyActivityReport = {
  digest: ActivityDigest;
  message: string;
};

export async function buildHourlyActivityReport(
  endMs: number = Date.now(),
  online: OnlineRealPlayer[] = listOnlineRealPlayers()
): Promise<HourlyActivityReport> {
  const windowEndMs = endMs;
  const windowStartMs = windowEndMs - DAY_MS;
  const fetched = await fetchActivityDigest(windowStartMs, windowEndMs, lookbackDays());
  if (!fetched.ok) {
    throw new Error(fetched.error || "activity_digest_unavailable");
  }
  let pendingLuna: bigint | null = null;
  let pendingRecipients: number | null = null;
  try {
    const pending = await getPendingQueueTotals();
    pendingLuna = lunaToBig(pending.totalLuna);
    pendingRecipients = pending.recipientCount;
  } catch (err) {
    console.error(`[${LOG_TAG}] pending queue snapshot failed:`, err);
  }
  const message = formatHourlyActivityMessage({
    digest: fetched.value,
    online,
    pendingLuna,
    pendingRecipients,
  });
  return { digest: fetched.value, message };
}

export async function sendHourlyActivityReport(
  endMs: number = Date.now(),
  online?: OnlineRealPlayer[]
): Promise<HourlyActivityReport & { sent: boolean }> {
  const report = await buildHourlyActivityReport(endMs, online);
  const sent = await sendTelegramPreformatted(report.message, LOG_TAG, chatIdOverride());
  return { ...report, sent };
}

let lastSentHourKey: number | null = null;
let retryUsedForHour: number | null = null;
let schedulerStarted = false;

/** Test hook. */
export function resetHourlyActivitySchedulerForTests(): void {
  lastSentHourKey = null;
  retryUsedForHour = null;
  schedulerStarted = false;
}

async function runScheduledHourlyActivity(nowMs: number = Date.now()): Promise<void> {
  const hourKey = hourlyActivityWindowEndMs(nowMs);
  if (hourKey <= 0 || lastSentHourKey === hourKey) return;
  try {
    const report = await sendHourlyActivityReport(hourKey);
    if (report.sent) {
      lastSentHourKey = hourKey;
      console.log(
        `[${LOG_TAG}] sent`,
        JSON.stringify({
          hourKey,
          players: report.digest.uniquePlayers,
          bytes: report.message.length,
        })
      );
      return;
    }
    console.error(`[${LOG_TAG}] telegram send failed`, JSON.stringify({ hourKey }));
  } catch (err) {
    console.error(`[${LOG_TAG}] scheduled report failed:`, err);
  }
  if (retryUsedForHour === hourKey) return;
  retryUsedForHour = hourKey;
  setTimeout(() => {
    void runScheduledHourlyActivity(hourKey + SEND_OFFSET_MS);
  }, RETRY_MS).unref?.();
}

function scheduleNext(): void {
  const delay = msUntilNextHourlyActivity(Date.now());
  setTimeout(() => {
    void runScheduledHourlyActivity();
    scheduleNext();
  }, delay).unref?.();
}

/** One Telegram digest per UTC hour. No-op when Telegram is not configured. */
export function startHourlyActivityScheduler(): void {
  if (schedulerStarted) return;
  if (!hourlyActivityReportEnabled()) {
    console.log(
      `[${LOG_TAG}] scheduler disabled`,
      JSON.stringify({
        telegramConfigured: isTelegramConfigured(),
        hasChatOverride: Boolean(chatIdOverride()),
      })
    );
    return;
  }
  schedulerStarted = true;
  console.log(
    `[${LOG_TAG}] scheduler enabled`,
    JSON.stringify({ lookbackDays: lookbackDays(), topN: hourlyActivityTopN() })
  );
  scheduleNext();
}
