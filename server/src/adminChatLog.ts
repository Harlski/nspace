import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ANALYTICS_EVENT_KINDS } from "./eventLog.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ADMIN_CHAT_DEFAULT_WINDOW_MS = 7 * 86_400_000;
export const ADMIN_CHAT_MAX_WINDOW_MS = 30 * 86_400_000;
export const ADMIN_CHAT_MAX_LIMIT = 200;

export type AdminChatMessageRow = {
  at: number;
  roomId: string;
  fromAddress: string;
  displayName: string | null;
  text: string;
  hasOriginal: boolean;
};

export type AdminChatMessageDetail = AdminChatMessageRow & {
  textOriginal: string | null;
  audienceLive: string[];
  audienceBacklog: string[];
};

export type AdminChatQueryResult = {
  messages: AdminChatMessageRow[];
  nextCursor: string | null;
};

type ChatPayload = {
  text?: string;
  textOriginal?: string;
  at?: number;
  displayName?: string;
  audienceLive?: string[];
};

type BacklogLineRef = { at: number; fromAddress: string };

function resolveLogDir(logDir?: string): string {
  if (logDir) return path.resolve(logDir);
  return process.env.EVENT_LOG_DIR
    ? path.resolve(process.env.EVENT_LOG_DIR)
    : path.join(__dirname, "..", "data", "events");
}

function normalizeWallet(raw: string): string {
  return String(raw ?? "")
    .replace(/\s+/g, "")
    .trim()
    .toUpperCase();
}

function messageKey(roomId: string, fromAddress: string, at: number): string {
  return `${roomId}\0${normalizeWallet(fromAddress)}\0${at}`;
}

function parseCursor(cursor: string | undefined): { at: number; fromAddress: string; roomId: string } | null {
  if (!cursor) return null;
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const parts = decoded.split("\0");
    if (parts.length !== 3) return null;
    const at = Number(parts[2]);
    if (!Number.isFinite(at)) return null;
    return { roomId: parts[0]!, fromAddress: parts[1]!, at };
  } catch {
    return null;
  }
}

function encodeCursor(roomId: string, fromAddress: string, at: number): string {
  return Buffer.from(`${roomId}\0${normalizeWallet(fromAddress)}\0${at}`, "utf8").toString(
    "base64url"
  );
}

function clampQueryWindow(fromTs?: number, toTs?: number): { from: number; to: number } {
  const now = Date.now();
  const to = toTs != null && Number.isFinite(toTs) ? Math.min(toTs, now) : now;
  let from =
    fromTs != null && Number.isFinite(fromTs)
      ? Math.min(fromTs, to)
      : to - ADMIN_CHAT_DEFAULT_WINDOW_MS;
  if (to - from > ADMIN_CHAT_MAX_WINDOW_MS) {
    from = to - ADMIN_CHAT_MAX_WINDOW_MS;
  }
  return { from, to };
}

function listEventFilesInRange(logDir: string, from: number, to: number): string[] {
  if (!fs.existsSync(logDir)) return [];
  const startDay = new Date(from);
  startDay.setUTCHours(0, 0, 0, 0);
  const endDay = new Date(to);
  endDay.setUTCHours(0, 0, 0, 0);
  const files: string[] = [];
  for (let t = startDay.getTime(); t <= endDay.getTime(); t += 86_400_000) {
    const d = new Date(t);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    const file = path.join(logDir, `events-${y}-${m}-${day}.jsonl`);
    if (fs.existsSync(file)) files.push(file);
  }
  return files;
}

type ScanRow = AdminChatMessageRow & { ts: number };

function syncScanChatEvents(opts: {
  logDir: string;
  from: number;
  to: number;
  roomId?: string;
  wallet?: string;
}): ScanRow[] {
  const files = listEventFilesInRange(opts.logDir, opts.from, opts.to);
  const roomFilter = opts.roomId ? opts.roomId.trim() : "";
  const walletFilter = opts.wallet ? normalizeWallet(opts.wallet) : "";
  const out: ScanRow[] = [];

  for (const filePath of files) {
    if (!fs.existsSync(filePath)) continue;
    const raw = fs.readFileSync(filePath, "utf8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t) continue;
      let rec: {
        ts: number;
        kind: string;
        address: string;
        roomId: string;
        payload?: ChatPayload;
      };
      try {
        rec = JSON.parse(t) as typeof rec;
      } catch {
        continue;
      }
      if (rec.kind !== ANALYTICS_EVENT_KINDS.chat) continue;
      const payload = rec.payload ?? {};
      const at = Number(payload.at ?? rec.ts);
      if (!Number.isFinite(at) || at < opts.from || at > opts.to) continue;
      const fromAddress = normalizeWallet(rec.address);
      if (roomFilter && rec.roomId !== roomFilter) continue;
      if (walletFilter && fromAddress !== walletFilter) continue;
      const text = String(payload.text ?? "").trim();
      if (!text) continue;
      out.push({
        ts: rec.ts,
        at,
        roomId: rec.roomId,
        fromAddress,
        displayName:
          typeof payload.displayName === "string" && payload.displayName.trim()
            ? payload.displayName.trim()
            : null,
        text,
        hasOriginal:
          typeof payload.textOriginal === "string" &&
          payload.textOriginal.trim().length > 0 &&
          payload.textOriginal !== text,
      });
    }
  }
  return out;
}

function syncScanBacklogAudienceMap(opts: {
  logDir: string;
  from: number;
  to: number;
}): Map<string, Set<string>> {
  const files = listEventFilesInRange(opts.logDir, opts.from, opts.to);
  const map = new Map<string, Set<string>>();

  for (const filePath of files) {
    if (!fs.existsSync(filePath)) continue;
    const raw = fs.readFileSync(filePath, "utf8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t) continue;
      let rec: {
        ts: number;
        kind: string;
        address: string;
        roomId: string;
        payload?: { lines?: BacklogLineRef[] };
      };
      try {
        rec = JSON.parse(t) as typeof rec;
      } catch {
        continue;
      }
      if (rec.kind !== ANALYTICS_EVENT_KINDS.chatBacklogDelivered) continue;
      if (rec.ts < opts.from || rec.ts > opts.to) continue;
      const recipient = normalizeWallet(rec.address);
      const lines = rec.payload?.lines;
      if (!Array.isArray(lines)) continue;
      for (const ref of lines) {
        const at = Number(ref?.at);
        const fromAddress = normalizeWallet(String(ref?.fromAddress ?? ""));
        if (!Number.isFinite(at) || !fromAddress) continue;
        const key = messageKey(rec.roomId, fromAddress, at);
        let set = map.get(key);
        if (!set) {
          set = new Set();
          map.set(key, set);
        }
        set.add(recipient);
      }
    }
  }
  return map;
}

export function queryAdminChatMessages(opts: {
  logDir?: string;
  fromTs?: number;
  toTs?: number;
  roomId?: string;
  wallet?: string;
  cursor?: string;
  limit?: number;
}): AdminChatQueryResult {
  const logDir = resolveLogDir(opts.logDir);
  const { from, to } = clampQueryWindow(opts.fromTs, opts.toTs);
  const limit = Math.min(
    ADMIN_CHAT_MAX_LIMIT,
    Math.max(1, opts.limit ?? 50)
  );
  const cursor = parseCursor(opts.cursor);

  const rows = syncScanChatEvents({ logDir, from, to, roomId: opts.roomId, wallet: opts.wallet });

  rows.sort((a, b) => {
    if (b.at !== a.at) return b.at - a.at;
    if (b.fromAddress !== a.fromAddress) return b.fromAddress.localeCompare(a.fromAddress);
    return b.roomId.localeCompare(a.roomId);
  });

  let startIdx = 0;
  if (cursor) {
    startIdx = rows.findIndex(
      (r) =>
        r.at < cursor.at ||
        (r.at === cursor.at &&
          (r.fromAddress < cursor.fromAddress ||
            (r.fromAddress === cursor.fromAddress && r.roomId < cursor.roomId)))
    );
    if (startIdx < 0) startIdx = rows.length;
  }

  const page = rows.slice(startIdx, startIdx + limit).map(({ ts: _ts, ...row }) => row);
  const last = page[page.length - 1];
  const nextCursor =
    startIdx + limit < rows.length && last
      ? encodeCursor(last.roomId, last.fromAddress, last.at)
      : null;
  return { messages: page, nextCursor };
}

export function getAdminChatMessageDetail(opts: {
  logDir?: string;
  roomId: string;
  fromAddress: string;
  at: number;
  fromTs?: number;
  toTs?: number;
}): AdminChatMessageDetail | null {
  const logDir = resolveLogDir(opts.logDir);
  const at = Number(opts.at);
  if (!Number.isFinite(at)) return null;
  const fromAddress = normalizeWallet(opts.fromAddress);
  const roomId = String(opts.roomId ?? "").trim();
  if (!roomId || !fromAddress) return null;

  const { from, to } = clampQueryWindow(
    opts.fromTs ?? at - ADMIN_CHAT_DEFAULT_WINDOW_MS,
    opts.toTs ?? at + ADMIN_CHAT_DEFAULT_WINDOW_MS
  );

  const rows = syncScanChatEvents({
    logDir,
    from,
    to,
    roomId,
    wallet: fromAddress,
  });
  const row = rows.find((r) => r.at === at);
  if (!row) return null;

  let textOriginal: string | null = null;
  let audienceLive: string[] = [];
  const files = listEventFilesInRange(logDir, from, to);
  for (const filePath of files) {
    if (!fs.existsSync(filePath)) continue;
    for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
      const t = line.trim();
      if (!t) continue;
      let rec: {
        kind: string;
        address: string;
        roomId: string;
        payload?: ChatPayload;
      };
      try {
        rec = JSON.parse(t) as typeof rec;
      } catch {
        continue;
      }
      if (rec.kind !== ANALYTICS_EVENT_KINDS.chat) continue;
      const payload = rec.payload ?? {};
      const msgAt = Number(payload.at);
      if (msgAt !== at) continue;
      if (normalizeWallet(rec.address) !== fromAddress) continue;
      if (rec.roomId !== roomId) continue;
      if (typeof payload.textOriginal === "string" && payload.textOriginal.trim()) {
        textOriginal = payload.textOriginal;
      }
      if (Array.isArray(payload.audienceLive)) {
        audienceLive = payload.audienceLive.map(normalizeWallet).filter(Boolean);
      }
      break;
    }
  }

  const backlogMap = syncScanBacklogAudienceMap({ logDir, from, to });
  const key = messageKey(roomId, fromAddress, at);
  const audienceBacklog = [...(backlogMap.get(key) ?? [])].sort();

  return {
    ...row,
    textOriginal,
    audienceLive: [...new Set(audienceLive)].sort(),
    audienceBacklog,
  };
}
