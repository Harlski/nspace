import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const STORE_FILE = process.env.FEEDBACK_STORE_FILE
  ? path.resolve(process.env.FEEDBACK_STORE_FILE)
  : path.join(__dirname, "..", "data", "feedback", "tickets.json");

export const FEEDBACK_MAX_CHARS = 700;
/** Player-written reason on chat reports (server composes the quoted message). */
export const FEEDBACK_REPORT_REASON_MAX = 400;
export const FEEDBACK_COOLDOWN_MS = 20_000;
export const FEEDBACK_MAX_NEW_TICKETS_PER_DAY = 3;
/** 0.10 NIM */
export const FEEDBACK_REWARD_MIN_LUNA = 10_000n;
/** 2.00 NIM */
export const FEEDBACK_REWARD_MAX_LUNA = 200_000n;

export type FeedbackKind = "bug" | "feature" | "suggestion";
export type FeedbackStatus = "open" | "answered" | "integrated" | "closed";
export type FeedbackSource = "player" | "report";

export type FeedbackReportChatLine = {
  from: string;
  fromAddress: string;
  text: string;
  at: number;
};

export type FeedbackReportContext = {
  reportedWallet: string;
  reportedDisplayName: string;
  reportedMessage: string;
  reportedAtMs?: number;
  roomId?: string;
  /** Snapshot from server chat backlog at ticket creation (reported user's recent lines). */
  reportedUserChatHistory?: FeedbackReportChatLine[];
};

export type FeedbackMessageRow = {
  id: string;
  authorWallet: string;
  body: string;
  createdAtMs: number;
  isAdmin: boolean;
};

export type FeedbackTicketRow = {
  id: string;
  wallet: string;
  kind: FeedbackKind;
  status: FeedbackStatus;
  source: FeedbackSource;
  createdAtMs: number;
  updatedAtMs: number;
  rewardLuna?: string;
  rewardClaimId?: string;
  /** Player last opened this ticket thread (ms); used for unread admin-reply badges. */
  lastReadAtMs?: number;
  /** Structured chat-report metadata (immutable after create). */
  reportContext?: FeedbackReportContext;
  messages: FeedbackMessageRow[];
};

type StoreFile = { tickets: FeedbackTicketRow[] };

function normalizeWalletKey(v: string): string {
  return String(v || "").replace(/\s+/g, "").toUpperCase();
}

function ensureDir(): void {
  const dir = path.dirname(STORE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readStore(): StoreFile {
  if (!fs.existsSync(STORE_FILE)) return { tickets: [] };
  try {
    const raw = fs.readFileSync(STORE_FILE, "utf8");
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object") return { tickets: [] };
    const tickets = (j as StoreFile).tickets;
    if (!Array.isArray(tickets)) return { tickets: [] };
    return { tickets: tickets.filter((t) => t && typeof t === "object") as FeedbackTicketRow[] };
  } catch {
    return { tickets: [] };
  }
}

function writeStore(data: StoreFile): void {
  ensureDir();
  const tmp = `${STORE_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 0), "utf8");
  fs.renameSync(tmp, STORE_FILE);
}

function isFeedbackKind(v: unknown): v is FeedbackKind {
  return v === "bug" || v === "feature" || v === "suggestion";
}

function isFeedbackStatus(v: unknown): v is FeedbackStatus {
  return v === "open" || v === "answered" || v === "integrated" || v === "closed";
}

function utcDayStartMs(now = Date.now()): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function countFeedbackTicketsCreatedToday(wallet: string, now = Date.now()): number {
  const k = normalizeWalletKey(wallet);
  if (!k) return 0;
  const dayStart = utcDayStartMs(now);
  return readStore().tickets.filter(
    (t) => normalizeWalletKey(t.wallet) === k && t.createdAtMs >= dayStart
  ).length;
}

export function composeReportTicketMessage(
  ctx: FeedbackReportContext,
  reason: string
): string {
  const lines = [
    "[Chat report]",
    `Player: ${ctx.reportedDisplayName}`,
    `Wallet: ${ctx.reportedWallet}`,
  ];
  const quoted = ctx.reportedMessage.trim();
  if (quoted) lines.push(`Message: ${quoted}`);
  const body = reason.trim();
  if (body) {
    lines.push("", body);
  }
  return lines.join("\n");
}

export function parseFeedbackReportInput(
  raw: unknown
): { ok: true; ctx: FeedbackReportContext } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "invalid_report" };
  const o = raw as Record<string, unknown>;
  const reportedWallet = normalizeWalletKey(String(o.reportedWallet ?? ""));
  const reportedDisplayName = String(o.reportedDisplayName ?? "").trim().slice(0, 48);
  const reportedMessage = String(o.reportedMessage ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, 256);
  if (!reportedWallet) return { ok: false, error: "invalid_report_wallet" };
  if (!reportedDisplayName) return { ok: false, error: "invalid_report_player" };
  const roomIdRaw = String(o.roomId ?? "").trim();
  const roomId = roomIdRaw ? roomIdRaw.slice(0, 64) : undefined;
  const atRaw = o.reportedAtMs;
  const reportedAtMs =
    typeof atRaw === "number" && Number.isFinite(atRaw) && atRaw > 0
      ? Math.floor(atRaw)
      : undefined;
  return {
    ok: true,
    ctx: {
      reportedWallet,
      reportedDisplayName,
      reportedMessage,
      ...(reportedAtMs !== undefined ? { reportedAtMs } : {}),
      ...(roomId ? { roomId } : {}),
    },
  };
}

export function createFeedbackTicket(opts: {
  wallet: string;
  kind: FeedbackKind;
  message: string;
  source?: FeedbackSource;
  reportContext?: FeedbackReportContext;
  now?: number;
}): { ok: true; ticket: FeedbackTicketRow } | { ok: false; error: string } {
  const wallet = normalizeWalletKey(opts.wallet);
  const message = opts.message.trim();
  if (!wallet) return { ok: false, error: "missing_wallet" };
  if (!message) return { ok: false, error: "missing_message" };
  if (message.length > FEEDBACK_MAX_CHARS) return { ok: false, error: "message_too_long" };
  if (opts.source === "report") {
    if (!opts.reportContext) return { ok: false, error: "invalid_report" };
    if (message.length > FEEDBACK_REPORT_REASON_MAX) {
      return { ok: false, error: "message_too_long" };
    }
  }

  const now = opts.now ?? Date.now();
  if (countFeedbackTicketsCreatedToday(wallet, now) >= FEEDBACK_MAX_NEW_TICKETS_PER_DAY) {
    return { ok: false, error: "daily_ticket_limit" };
  }

  const ticket: FeedbackTicketRow = {
    id: randomUUID(),
    wallet,
    kind: opts.kind,
    status: "open",
    source: opts.source ?? "player",
    createdAtMs: now,
    updatedAtMs: now,
    ...(opts.reportContext ? { reportContext: opts.reportContext } : {}),
    messages: [
      {
        id: randomUUID(),
        authorWallet: wallet,
        body: message,
        createdAtMs: now,
        isAdmin: false,
      },
    ],
  };

  const store = readStore();
  store.tickets.push(ticket);
  writeStore(store);
  return { ok: true, ticket };
}

export function listFeedbackTicketsForWallet(wallet: string): FeedbackTicketRow[] {
  const k = normalizeWalletKey(wallet);
  if (!k) return [];
  return readStore()
    .tickets.filter((t) => normalizeWalletKey(t.wallet) === k)
    .sort((a, b) => b.updatedAtMs - a.updatedAtMs);
}

export function feedbackTicketHasUnread(t: FeedbackTicketRow): boolean {
  const lastRead = t.lastReadAtMs ?? 0;
  for (const m of t.messages) {
    if (m.isAdmin && m.createdAtMs > lastRead) return true;
  }
  return false;
}

export function feedbackTicketHasAdminReply(t: FeedbackTicketRow): boolean {
  return t.messages.some((m) => m.isAdmin);
}

export function countUnreadFeedbackForWallet(wallet: string): number {
  return listFeedbackTicketsForWallet(wallet).filter(feedbackTicketHasUnread).length;
}

export function markFeedbackTicketRead(
  wallet: string,
  ticketId: string,
  now = Date.now()
): FeedbackTicketRow | null {
  const k = normalizeWalletKey(wallet);
  const id = String(ticketId || "").trim();
  if (!k || !id) return null;
  const store = readStore();
  const idx = store.tickets.findIndex((row) => row.id === id);
  if (idx < 0) return null;
  const ticket = store.tickets[idx]!;
  if (normalizeWalletKey(ticket.wallet) !== k) return null;
  ticket.lastReadAtMs = now;
  store.tickets[idx] = ticket;
  writeStore(store);
  return ticket;
}

export function getFeedbackTicketForWallet(
  wallet: string,
  ticketId: string,
  opts?: { markRead?: boolean }
): FeedbackTicketRow | null {
  const k = normalizeWalletKey(wallet);
  const id = String(ticketId || "").trim();
  if (!k || !id) return null;
  const t = readStore().tickets.find((row) => row.id === id);
  if (!t || normalizeWalletKey(t.wallet) !== k) return null;
  if (opts?.markRead) {
    return markFeedbackTicketRead(wallet, ticketId) ?? t;
  }
  return t;
}

export function addPlayerFeedbackMessage(opts: {
  wallet: string;
  ticketId: string;
  body: string;
  now?: number;
}): { ok: true; ticket: FeedbackTicketRow } | { ok: false; error: string } {
  const wallet = normalizeWalletKey(opts.wallet);
  const ticketId = String(opts.ticketId || "").trim();
  const body = opts.body.trim();
  if (!wallet || !ticketId) return { ok: false, error: "not_found" };
  if (!body) return { ok: false, error: "missing_message" };
  if (body.length > FEEDBACK_MAX_CHARS) return { ok: false, error: "message_too_long" };

  const store = readStore();
  const idx = store.tickets.findIndex((t) => t.id === ticketId);
  if (idx < 0) return { ok: false, error: "not_found" };
  const ticket = store.tickets[idx]!;
  if (normalizeWalletKey(ticket.wallet) !== wallet) return { ok: false, error: "forbidden" };
  if (ticket.status === "closed") return { ok: false, error: "ticket_closed" };

  const now = opts.now ?? Date.now();
  ticket.messages.push({
    id: randomUUID(),
    authorWallet: wallet,
    body,
    createdAtMs: now,
    isAdmin: false,
  });
  ticket.updatedAtMs = now;
  if (ticket.status === "answered" || ticket.status === "integrated") {
    ticket.status = "open";
  }
  store.tickets[idx] = ticket;
  writeStore(store);
  return { ok: true, ticket };
}

export type FeedbackAdminListFilters = {
  status?: FeedbackStatus;
  kind?: FeedbackKind;
  wallet?: string;
  limit?: number;
  offset?: number;
};

export function listFeedbackTicketsAdmin(
  filters: FeedbackAdminListFilters = {}
): { total: number; tickets: FeedbackTicketRow[] } {
  let rows = readStore().tickets.slice();
  if (filters.status && isFeedbackStatus(filters.status)) {
    rows = rows.filter((t) => t.status === filters.status);
  }
  if (filters.kind && isFeedbackKind(filters.kind)) {
    rows = rows.filter((t) => t.kind === filters.kind);
  }
  if (filters.wallet) {
    const k = normalizeWalletKey(filters.wallet);
    if (k) rows = rows.filter((t) => normalizeWalletKey(t.wallet) === k);
  }
  rows.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  const total = rows.length;
  const offset = Math.max(0, Math.floor(Number(filters.offset) || 0));
  const limit = Math.min(200, Math.max(1, Math.floor(Number(filters.limit) || 50)));
  return { total, tickets: rows.slice(offset, offset + limit) };
}

export function getFeedbackTicketAdmin(ticketId: string): FeedbackTicketRow | null {
  const id = String(ticketId || "").trim();
  if (!id) return null;
  return readStore().tickets.find((t) => t.id === id) ?? null;
}

export function addAdminFeedbackMessage(opts: {
  adminWallet: string;
  ticketId: string;
  body: string;
  now?: number;
}): { ok: true; ticket: FeedbackTicketRow } | { ok: false; error: string } {
  const adminWallet = normalizeWalletKey(opts.adminWallet);
  const ticketId = String(opts.ticketId || "").trim();
  const body = opts.body.trim();
  if (!adminWallet || !ticketId) return { ok: false, error: "not_found" };
  if (!body) return { ok: false, error: "missing_message" };
  if (body.length > FEEDBACK_MAX_CHARS) return { ok: false, error: "message_too_long" };

  const store = readStore();
  const idx = store.tickets.findIndex((t) => t.id === ticketId);
  if (idx < 0) return { ok: false, error: "not_found" };
  const ticket = store.tickets[idx]!;
  const now = opts.now ?? Date.now();
  ticket.messages.push({
    id: randomUUID(),
    authorWallet: adminWallet,
    body,
    createdAtMs: now,
    isAdmin: true,
  });
  ticket.updatedAtMs = now;
  if (ticket.status === "open") ticket.status = "answered";
  store.tickets[idx] = ticket;
  writeStore(store);
  return { ok: true, ticket };
}

export function patchFeedbackTicketStatus(opts: {
  ticketId: string;
  status: FeedbackStatus;
}): { ok: true; ticket: FeedbackTicketRow } | { ok: false; error: string } {
  const ticketId = String(opts.ticketId || "").trim();
  if (!ticketId || !isFeedbackStatus(opts.status)) return { ok: false, error: "invalid_status" };

  const store = readStore();
  const idx = store.tickets.findIndex((t) => t.id === ticketId);
  if (idx < 0) return { ok: false, error: "not_found" };
  const ticket = store.tickets[idx]!;
  ticket.status = opts.status;
  ticket.updatedAtMs = Date.now();
  store.tickets[idx] = ticket;
  writeStore(store);
  return { ok: true, ticket };
}

export function markFeedbackTicketRewarded(opts: {
  ticketId: string;
  amountLuna: bigint;
  claimId: string;
}): { ok: true; ticket: FeedbackTicketRow } | { ok: false; error: string } {
  const ticketId = String(opts.ticketId || "").trim();
  if (!ticketId) return { ok: false, error: "not_found" };
  if (opts.amountLuna < FEEDBACK_REWARD_MIN_LUNA || opts.amountLuna > FEEDBACK_REWARD_MAX_LUNA) {
    return { ok: false, error: "invalid_reward_amount" };
  }

  const store = readStore();
  const idx = store.tickets.findIndex((t) => t.id === ticketId);
  if (idx < 0) return { ok: false, error: "not_found" };
  const ticket = store.tickets[idx]!;
  if (ticket.status !== "integrated") return { ok: false, error: "not_integrated" };
  if (ticket.rewardClaimId) return { ok: false, error: "already_rewarded" };

  ticket.rewardLuna = opts.amountLuna.toString();
  ticket.rewardClaimId = opts.claimId;
  ticket.updatedAtMs = Date.now();
  store.tickets[idx] = ticket;
  writeStore(store);
  return { ok: true, ticket };
}

export function ticketToPlayerSummary(t: FeedbackTicketRow): {
  id: string;
  wallet: string;
  kind: FeedbackKind;
  status: FeedbackStatus;
  source: FeedbackSource;
  createdAtMs: number;
  updatedAtMs: number;
  preview: string;
  unread: boolean;
  rewardLuna?: string;
} {
  const first = t.messages[0]?.body ?? "";
  const preview = first.length > 120 ? `${first.slice(0, 117)}…` : first;
  const unread = feedbackTicketHasUnread(t);
  return {
    id: t.id,
    wallet: t.wallet,
    kind: t.kind,
    status: t.status,
    source: t.source,
    createdAtMs: t.createdAtMs,
    updatedAtMs: t.updatedAtMs,
    preview,
    unread,
    ...(t.rewardLuna ? { rewardLuna: t.rewardLuna } : {}),
  };
}

export function ticketToPlayerDetail(t: FeedbackTicketRow): {
  id: string;
  wallet: string;
  kind: FeedbackKind;
  status: FeedbackStatus;
  source: FeedbackSource;
  createdAtMs: number;
  updatedAtMs: number;
  rewardLuna?: string;
  messages: FeedbackMessageRow[];
} {
  return {
    id: t.id,
    wallet: t.wallet,
    kind: t.kind,
    status: t.status,
    source: t.source,
    createdAtMs: t.createdAtMs,
    updatedAtMs: t.updatedAtMs,
    ...(t.rewardLuna ? { rewardLuna: t.rewardLuna } : {}),
    messages: t.messages.map((m) => ({ ...m })),
  };
}

export function ticketToAdminDetail(t: FeedbackTicketRow): ReturnType<typeof ticketToPlayerDetail> & {
  reportContext?: FeedbackReportContext;
} {
  return {
    ...ticketToPlayerDetail(t),
    ...(t.reportContext
      ? {
          reportContext: {
            ...t.reportContext,
            ...(t.reportContext.reportedUserChatHistory
              ? {
                  reportedUserChatHistory: t.reportContext.reportedUserChatHistory.map(
                    (l) => ({ ...l })
                  ),
                }
              : {}),
          },
        }
      : {}),
  };
}

export function parseFeedbackKindInput(raw: unknown, fallback: FeedbackKind = "suggestion"): FeedbackKind {
  return isFeedbackKind(raw) ? raw : fallback;
}
