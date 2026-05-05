import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const STORE_FILE = process.env.MODERATION_STORE_FILE
  ? path.resolve(process.env.MODERATION_STORE_FILE)
  : path.join(__dirname, "..", "data", "moderation.json");

type BanRow = { at: number; by?: string };
type StoreFile = {
  usernameSetBanned: Record<string, BanRow>;
  channelMuted: Record<string, BanRow>;
};

function ensureDir(): void {
  const dir = path.dirname(STORE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readStore(): StoreFile {
  if (!fs.existsSync(STORE_FILE)) {
    return { usernameSetBanned: {}, channelMuted: {} };
  }
  try {
    const raw = fs.readFileSync(STORE_FILE, "utf8");
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object") return { usernameSetBanned: {}, channelMuted: {} };
    const o = j as Record<string, unknown>;
    const ub = o.usernameSetBanned;
    const cm = o.channelMuted;
    return {
      usernameSetBanned:
        ub && typeof ub === "object" ? (ub as Record<string, BanRow>) : {},
      channelMuted:
        cm && typeof cm === "object" ? (cm as Record<string, BanRow>) : {},
    };
  } catch {
    return { usernameSetBanned: {}, channelMuted: {} };
  }
}

function writeStore(data: StoreFile): void {
  ensureDir();
  const tmp = `${STORE_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 0), "utf8");
  fs.renameSync(tmp, STORE_FILE);
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

export function setUsernameSetBanned(
  target: string,
  banned: boolean,
  actorCompact?: string
): void {
  const k = target.replace(/\s+/g, "").trim().toUpperCase();
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
  const k = target.replace(/\s+/g, "").trim().toUpperCase();
  if (!k) throw new Error("missing_address");
  const data = readStore();
  if (muted) {
    data.channelMuted[k] = { at: Date.now(), by: actorCompact };
  } else {
    delete data.channelMuted[k];
  }
  writeStore(data);
}

export function listModerationSnapshot(): {
  usernameBans: Array<{ address: string; at: number; by?: string }>;
  channelMutes: Array<{ address: string; at: number; by?: string }>;
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
  usernameBans.sort((a, b) => b.at - a.at);
  channelMutes.sort((a, b) => b.at - a.at);
  return { usernameBans, channelMutes };
}
