import { getEffectivePlayerDisplayName } from "./playerProfileStore.js";
import { walletDisplayName } from "./walletDisplayName.js";
import {
  getConnectNoticeStatsForAddress,
  type ConnectNoticePlayerStats,
} from "./eventLog.js";
import { getInviteBySlug } from "./directInvite/store.js";
import {
  isChannelMuted,
  isMiningBanned,
  isUsernameSetBanned,
} from "./moderationStore.js";
import {
  countOnlineRealPlayers,
  getCoPresencePlayerLabelsInRoom,
  getLiveRealPlayerCountInRoom,
} from "./rooms.js";
import { sendTelegramPlainText } from "./telegramNotify.js";

/** Wallet auth → first WS may include username prompt; keep pending long enough to survive it. */
export const CONNECT_NOTICE_WALLET_PENDING_TTL_MS = 5 * 60_000;
export const CONNECT_NOTICE_GUEST_PENDING_TTL_MS = 5 * 60_000;
/** Suppress duplicate pings when the same wallet reconnects within this window. */
export const CONNECT_NOTICE_DEDUPE_MS = 60_000;

function logConnectNotice(event: string, detail: Record<string, unknown>): void {
  console.log(`[connect] ${event}`, JSON.stringify(detail));
}

export type PendingWalletConnectNotice = {
  kind: "wallet";
  address: string;
  nimiqPay: boolean;
  markedAt: number;
};

export type PendingGuestConnectNotice = {
  kind: "guest";
  guestAddress: string;
  hostWallet: string;
  inviteSlug: string;
  markedAt: number;
};

export type PendingConnectNotice = PendingWalletConnectNotice | PendingGuestConnectNotice;

const pendingByKey = new Map<string, PendingConnectNotice>();
const lastSentAtByKey = new Map<string, number>();

function walletKey(address: string): string {
  return address.trim().toUpperCase();
}

function guestKey(guestAddress: string): string {
  return guestAddress.trim();
}

function pendingTtlMs(notice: PendingConnectNotice): number {
  return notice.kind === "guest"
    ? CONNECT_NOTICE_GUEST_PENDING_TTL_MS
    : CONNECT_NOTICE_WALLET_PENDING_TTL_MS;
}

function isPendingExpired(notice: PendingConnectNotice, nowMs: number): boolean {
  return nowMs - notice.markedAt > pendingTtlMs(notice);
}

export function markWalletConnectNoticePending(
  address: string,
  opts?: { nimiqPay?: boolean }
): void {
  const key = walletKey(address);
  if (!key) return;
  pendingByKey.set(key, {
    kind: "wallet",
    address: key,
    nimiqPay: opts?.nimiqPay === true,
    markedAt: Date.now(),
  });
}

export function markGuestConnectNoticePending(input: {
  guestAddress: string;
  hostWallet: string;
  inviteSlug: string;
}): void {
  const guestAddress = input.guestAddress.trim();
  const hostWallet = walletKey(input.hostWallet);
  const inviteSlug = input.inviteSlug.trim();
  if (!guestAddress || !hostWallet || !inviteSlug) return;
  pendingByKey.set(guestKey(guestAddress), {
    kind: "guest",
    guestAddress,
    hostWallet,
    inviteSlug,
    markedAt: Date.now(),
  });
}

/** Test hook: reset in-memory pending + dedupe state. */
export function resetConnectNoticeStateForTests(): void {
  pendingByKey.clear();
  lastSentAtByKey.clear();
}

export function peekPendingConnectNotice(
  subjectAddress: string,
  nowMs: number = Date.now()
): PendingConnectNotice | null {
  const isGuest = subjectAddress.startsWith("guest:");
  const key = isGuest ? guestKey(subjectAddress) : walletKey(subjectAddress);
  const pending = pendingByKey.get(key);
  if (!pending) return null;
  if (isPendingExpired(pending, nowMs)) {
    pendingByKey.delete(key);
    return null;
  }
  return pending;
}

export function consumePendingConnectNotice(
  subjectAddress: string,
  nowMs: number = Date.now()
): PendingConnectNotice | null {
  const pending = peekPendingConnectNotice(subjectAddress, nowMs);
  if (!pending) return null;
  const key =
    pending.kind === "guest"
      ? guestKey(pending.guestAddress)
      : walletKey(pending.address);
  pendingByKey.delete(key);
  return pending;
}

function dedupeKeyForNotice(notice: PendingConnectNotice): string {
  return notice.kind === "guest"
    ? guestKey(notice.guestAddress)
    : walletKey(notice.address);
}

function shouldSkipDedupe(notice: PendingConnectNotice, nowMs: number): boolean {
  const key = dedupeKeyForNotice(notice);
  const last = lastSentAtByKey.get(key);
  if (last == null) return false;
  return nowMs - last < CONNECT_NOTICE_DEDUPE_MS;
}

function markSent(notice: PendingConnectNotice, nowMs: number): void {
  lastSentAtByKey.set(dedupeKeyForNotice(notice), nowMs);
}

/** Whether a Connect Notice for this subject was sent within the dedupe window. */
export function isConnectNoticeDedupeActive(
  notice: PendingConnectNotice,
  nowMs: number = Date.now()
): boolean {
  return shouldSkipDedupe(notice, nowMs);
}

/** Records a sent notice for dedupe tracking (used after a successful Telegram send). */
export function recordConnectNoticeSent(
  notice: PendingConnectNotice,
  nowMs: number = Date.now()
): void {
  markSent(notice, nowMs);
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

function formatVisitStatsLine(label: string, stats: { nimEarnedLabel: string; activeMs: number }): string {
  return `${label}: ${stats.nimEarnedLabel}, ${formatActiveDuration(stats.activeMs)} active`;
}

function playerIdentityLine(
  address: string,
  nimiqPay: boolean,
  displayNameOverride?: string
): string {
  const shorthand = walletDisplayName(address);
  const display =
    displayNameOverride?.trim() ||
    getEffectivePlayerDisplayName(address) ||
    shorthand;
  const paySuffix = nimiqPay ? " · Nimiq Pay" : "";
  if (display !== shorthand) {
    return `Player: ${display} (${shorthand})${paySuffix}`;
  }
  return `Player: ${shorthand}${paySuffix}`;
}

function moderationFlagsLine(wallet: string): string | null {
  const flags: string[] = [];
  if (isMiningBanned(wallet)) flags.push("mining restricted");
  if (isChannelMuted(wallet)) flags.push("chat muted");
  if (isUsernameSetBanned(wallet)) flags.push("username ban");
  if (!flags.length) return null;
  return `Flags: ${flags.join(", ")}`;
}

function moderationUrl(publicBaseUrl: string, wallet: string): string {
  const base = publicBaseUrl.replace(/\/$/, "");
  return `${base}/admin/moderation?wallet=${encodeURIComponent(walletKey(wallet))}`;
}

function formatRoomLabel(roomId: string, inviteSlug?: string): string {
  if (inviteSlug) return `play/${inviteSlug}`;
  return roomId;
}

export function buildConnectNoticeMessage(input: {
  pending: PendingConnectNotice;
  roomId: string;
  guestDisplayName?: string;
  /** Live in-game label when available (custom username or guest nickname). */
  displayName?: string;
  publicBaseUrl: string;
  nowMs?: number;
  stats?: ConnectNoticePlayerStats;
  coPresenceNames?: string[];
}): string {
  const nowMs = input.nowMs ?? Date.now();
  const roomLabel = formatRoomLabel(
    input.roomId,
    input.pending.kind === "guest" ? input.pending.inviteSlug : undefined
  );
  const roomCount = getLiveRealPlayerCountInRoom(input.roomId);
  const onlineCount = countOnlineRealPlayers();
  const coPresence =
    input.coPresenceNames ??
    getCoPresencePlayerLabelsInRoom(
      input.roomId,
      input.pending.kind === "guest"
        ? input.pending.guestAddress
        : input.pending.address
    );

  const statsAddress =
    input.pending.kind === "guest"
      ? input.pending.guestAddress
      : input.pending.address;
  const stats =
    input.stats ?? getConnectNoticeStatsForAddress(statsAddress, nowMs);

  const lines: string[] = [];

  if (input.pending.kind === "guest") {
    const guestName =
      input.guestDisplayName?.trim() ||
      getEffectivePlayerDisplayName(input.pending.guestAddress);
    const hostDisplay = getEffectivePlayerDisplayName(input.pending.hostWallet);
    const hostShorthand = walletDisplayName(input.pending.hostWallet);
    lines.push("NSpace connect (guest)");
    lines.push(`Guest: ${guestName}`);
    lines.push(`Play Space host: ${hostDisplay} (${hostShorthand})`);
  } else {
    lines.push("NSpace connect");
    lines.push(
      playerIdentityLine(
        input.pending.address,
        input.pending.nimiqPay,
        input.displayName
      )
    );
  }

  lines.push(`Room: ${roomLabel} | Room: ${roomCount} | Online: ${onlineCount}`);

  if (stats.lastVisit) {
    lines.push(formatVisitStatsLine("Last visit", stats.lastVisit));
  } else {
    lines.push("Last visit: none");
  }
  lines.push(formatVisitStatsLine("Today", stats.today));

  if (coPresence.length > 0) {
    lines.push(`Also in room: ${coPresence.join(", ")}`);
  }

  const flagsWallet =
    input.pending.kind === "guest"
      ? input.pending.hostWallet
      : input.pending.address;
  const flags = moderationFlagsLine(flagsWallet);
  if (flags) lines.push(flags);

  lines.push(`Moderation: ${moderationUrl(input.publicBaseUrl, flagsWallet)}`);
  lines.push(`At: ${new Date(nowMs).toISOString()}`);

  return lines.join("\n");
}

export type ConnectNoticeWsContext = {
  address: string;
  roomId: string;
  guestDisplayName?: string;
  guestInviteSlug?: string;
  /** Live in-game label when available (custom username or guest nickname). */
  displayName?: string;
  nimiqPay?: boolean;
  /** Cinema / stream observer connections are omitted from Connect Notices. */
  streamObserver?: boolean;
};

function resolveConnectNoticePending(
  ctx: ConnectNoticeWsContext,
  nowMs: number
): PendingConnectNotice | null {
  if (ctx.streamObserver) return null;

  if (ctx.address.startsWith("guest:")) {
    const slug = (ctx.guestInviteSlug ?? "").trim();
    if (!slug) return null;
    const invite = getInviteBySlug(slug);
    if (!invite) return null;
    return {
      kind: "guest",
      guestAddress: ctx.address.trim(),
      hostWallet: walletKey(invite.hostWallet),
      inviteSlug: slug,
      markedAt: nowMs,
    };
  }

  const wallet = walletKey(ctx.address);
  if (!wallet) return null;
  const fromAuth = consumePendingConnectNotice(ctx.address, nowMs);
  return {
    kind: "wallet",
    address: wallet,
    nimiqPay: fromAuth?.kind === "wallet" && fromAuth.nimiqPay
      ? true
      : ctx.nimiqPay === true,
    markedAt: nowMs,
  };
}

export async function maybeSendConnectNotice(
  ctx: ConnectNoticeWsContext,
  publicBaseUrl: string
): Promise<void> {
  const nowMs = Date.now();
  const pending = resolveConnectNoticePending(ctx, nowMs);
  if (!pending) {
    logConnectNotice("skip", {
      reason: ctx.streamObserver ? "stream_observer" : "invalid_subject",
      address: ctx.address.slice(0, 16),
    });
    return;
  }
  if (shouldSkipDedupe(pending, nowMs)) {
    logConnectNotice("skip", {
      reason: "dedupe",
      address: ctx.address.slice(0, 16),
      kind: pending.kind,
    });
    return;
  }

  if (pending.kind === "guest") {
    const invite = getInviteBySlug(pending.inviteSlug);
    if (!invite || invite.hostWallet !== pending.hostWallet) {
      logConnectNotice("skip", {
        reason: "guest_invite_invalid",
        guest: pending.guestAddress.slice(0, 20),
        slug: pending.inviteSlug,
      });
      return;
    }
  }

  const text = buildConnectNoticeMessage({
    pending,
    roomId: ctx.roomId,
    guestDisplayName: ctx.guestDisplayName,
    displayName: ctx.displayName,
    publicBaseUrl,
    nowMs,
  });
  const sent = await sendTelegramPlainText(text, "connect");
  if (sent) {
    recordConnectNoticeSent(pending, nowMs);
    logConnectNotice("sent", {
      kind: pending.kind,
      address: ctx.address.slice(0, 16),
      roomId: ctx.roomId,
      bytes: text.length,
    });
  } else {
    logConnectNotice("skip", {
      reason: "telegram_failed",
      kind: pending.kind,
      address: ctx.address.slice(0, 16),
    });
  }
}