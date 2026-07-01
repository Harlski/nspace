import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const STORE_FILE = process.env.MODERATION_STORE_FILE
  ? path.resolve(process.env.MODERATION_STORE_FILE)
  : path.join(__dirname, "..", "data", "moderation.json");

const MINING_BAN_NOTE_MAX_LEN = 500;

type BanRow = { at: number; by?: string };
type MiningBanRow = BanRow & { note?: string };
type StoreFile = {
  usernameSetBanned: Record<string, BanRow>;
  channelMuted: Record<string, BanRow>;
  miningBanned: Record<string, MiningBanRow>;
};

function ensureDir(): void {
  const dir = path.dirname(STORE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readStore(): StoreFile {
  if (!fs.existsSync(STORE_FILE)) {
    return { usernameSetBanned: {}, channelMuted: {}, miningBanned: {} };
  }
  try {
    const raw = fs.readFileSync(STORE_FILE, "utf8");
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object") {
      return { usernameSetBanned: {}, channelMuted: {}, miningBanned: {} };
    }
    const o = j as Record<string, unknown>;
    const ub = o.usernameSetBanned;
    const cm = o.channelMuted;
    const mb = o.miningBanned;
    return {
      usernameSetBanned:
        ub && typeof ub === "object" ? (ub as Record<string, BanRow>) : {},
      channelMuted:
        cm && typeof cm === "object" ? (cm as Record<string, BanRow>) : {},
      miningBanned:
        mb && typeof mb === "object"
          ? (mb as Record<string, MiningBanRow>)
          : {},
    };
  } catch {
    return { usernameSetBanned: {}, channelMuted: {}, miningBanned: {} };
  }
}

function writeStore(data: StoreFile): void {
  ensureDir();
  const tmp = `${STORE_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 0), "utf8");
  fs.renameSync(tmp, STORE_FILE);
}

function normalizeKey(target: string): string {
  return target.replace(/\s+/g, "").trim().toUpperCase();
}

export function sanitizeMiningBanNote(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const t = raw.trim().replace(/\s+/g, " ");
  if (!t) return undefined;
  return t.slice(0, MINING_BAN_NOTE_MAX_LEN);
}

export function isUsernameSetBanned(normalizedAddress: string): boolean {
  const k = normalizedAddress.trim().toUpperCase();
  if (!k) return false;
  return Boolean(readStore().usernameSetBanned[k]);
}

export function isChannelMuted(normalizedAddress: string): boolean {
  const k = normalizedAddress.trim().toUpperCase();
  if (!k) return false;
  return Boolean(readStore().channelMuted[k]);
}

export function isMiningBanned(normalizedAddress: string): boolean {
  const k = normalizedAddress.trim().toUpperCase();
  if (!k) return false;
  return Boolean(readStore().miningBanned[k]);
}

export function setUsernameSetBanned(
  target: string,
  banned: boolean,
  actorCompact?: string
): void {
  const k = normalizeKey(target);
  if (!k) throw new Error("missing_address");
  const data = readStore();
  if (banned) {
    data.usernameSetBanned[k] = { at: Date.now(), by: actorCompact };
  } else {
    delete data.usernameSetBanned[k];
  }
  writeStore(data);
}

export function setChannelMuted(
  target: string,
  muted: boolean,
  actorCompact?: string
): void {
  const k = normalizeKey(target);
  if (!k) throw new Error("missing_address");
  const data = readStore();
  if (muted) {
    data.channelMuted[k] = { at: Date.now(), by: actorCompact };
  } else {
    delete data.channelMuted[k];
  }
  writeStore(data);
}

export function setMiningBanned(
  target: string,
  banned: boolean,
  actorCompact?: string,
  note?: string
): void {
  const k = normalizeKey(target);
  if (!k) throw new Error("missing_address");
  const data = readStore();
  if (banned) {
    const row: MiningBanRow = { at: Date.now(), by: actorCompact };
    const sanitized = sanitizeMiningBanNote(note);
    if (sanitized) row.note = sanitized;
    data.miningBanned[k] = row;
  } else {
    delete data.miningBanned[k];
  }
  writeStore(data);
}

export function listModerationSnapshot(): {
  usernameBans: Array<{ address: string; at: number; by?: string }>;
  channelMutes: Array<{ address: string; at: number; by?: string }>;
  miningRestrictions: Array<{
    address: string;
    at: number;
    by?: string;
    note?: string;
  }>;
} {
  const s = readStore();
  const usernameBans = Object.entries(s.usernameSetBanned).map(([address, row]) => ({
    address,
    at: row.at,
    ...(row.by ? { by: row.by } : {}),
  }));
  const channelMutes = Object.entries(s.channelMuted).map(([address, row]) => ({
    address,
    at: row.at,
    ...(row.by ? { by: row.by } : {}),
  }));
  const miningRestrictions = Object.entries(s.miningBanned).map(
    ([address, row]) => ({
      address,
      at: row.at,
      ...(row.by ? { by: row.by } : {}),
      ...(row.note ? { note: row.note } : {}),
    })
  );
  usernameBans.sort((a, b) => b.at - a.at);
  channelMutes.sort((a, b) => b.at - a.at);
  miningRestrictions.sort((a, b) => b.at - a.at);
  return { usernameBans, channelMutes, miningRestrictions };
}
