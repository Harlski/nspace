import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function normalizeWalletKey(addr: string): string {
  return String(addr ?? "")
    .replace(/\s+/g, "")
    .trim()
    .toUpperCase();
}

function storeFile(): string {
  return process.env.UNLOCK_PAD_GRANT_STORE_FILE
    ? path.resolve(process.env.UNLOCK_PAD_GRANT_STORE_FILE)
    : path.join(__dirname, "..", "..", "data", "unlock-pad-grants.json");
}

type GrantRow = { at: number };
/** Key: `${wallet}|${roomId}|${instanceId}` */
type StoreFile = { grants: Record<string, GrantRow> };

function grantKey(wallet: string, roomId: string, instanceId: string): string {
  return `${normalizeWalletKey(wallet)}|${roomId.trim().toLowerCase()}|${instanceId.trim()}`;
}

function ensureDir(file: string): void {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readStore(): StoreFile {
  const file = storeFile();
  if (!fs.existsSync(file)) return { grants: {} };
  try {
    const j = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
    if (!j || typeof j !== "object") return { grants: {} };
    const grants = (j as StoreFile).grants;
    return {
      grants: grants && typeof grants === "object" ? grants : {},
    };
  } catch {
    return { grants: {} };
  }
}

function writeStore(data: StoreFile): void {
  const file = storeFile();
  ensureDir(file);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 0), "utf8");
  fs.renameSync(tmp, file);
}

export function hasUnlockPadGrant(
  wallet: string,
  roomId: string,
  instanceId: string
): boolean {
  const k = grantKey(wallet, roomId, instanceId);
  if (!normalizeWalletKey(wallet) || !instanceId.trim()) return false;
  return Boolean(readStore().grants[k]);
}

export function recordUnlockPadGrant(opts: {
  wallet: string;
  roomId: string;
  instanceId: string;
  nowMs?: number;
}): { ok: true; idempotent: boolean } | { ok: false; error: string } {
  const wallet = normalizeWalletKey(opts.wallet);
  const roomId = opts.roomId.trim().toLowerCase();
  const instanceId = opts.instanceId.trim();
  if (!wallet) return { ok: false, error: "invalid_wallet" };
  if (!roomId) return { ok: false, error: "invalid_room" };
  if (!instanceId) return { ok: false, error: "invalid_instance" };
  const k = grantKey(wallet, roomId, instanceId);
  const data = readStore();
  if (data.grants[k]) {
    return { ok: true, idempotent: true };
  }
  data.grants[k] = { at: opts.nowMs ?? Date.now() };
  writeStore(data);
  return { ok: true, idempotent: false };
}

export function clearUnlockPadGrantsForInstance(
  roomId: string,
  instanceId: string
): void {
  const rid = roomId.trim().toLowerCase();
  const iid = instanceId.trim();
  if (!rid || !iid) return;
  const suffix = `|${rid}|${iid}`;
  const data = readStore();
  let changed = false;
  for (const k of Object.keys(data.grants)) {
    if (k.endsWith(suffix)) {
      delete data.grants[k];
      changed = true;
    }
  }
  if (changed) writeStore(data);
}

/** Drop every Unlock Pad grant for this wallet in a room (tutorial reset). */
export function clearUnlockPadGrantsForWalletInRoom(
  wallet: string,
  roomId: string
): void {
  const w = normalizeWalletKey(wallet);
  const rid = roomId.trim().toLowerCase();
  if (!w || !rid) return;
  const prefix = `${w}|${rid}|`;
  const data = readStore();
  let changed = false;
  for (const k of Object.keys(data.grants)) {
    if (k.startsWith(prefix)) {
      delete data.grants[k];
      changed = true;
    }
  }
  if (changed) writeStore(data);
}

/** Instance ids this wallet has unlocked in a room (for welcome / reconnect). */
export function listUnlockPadInstanceIdsForWallet(
  wallet: string,
  roomId: string
): string[] {
  const w = normalizeWalletKey(wallet);
  const rid = roomId.trim().toLowerCase();
  if (!w || !rid) return [];
  const prefix = `${w}|${rid}|`;
  const out: string[] = [];
  for (const k of Object.keys(readStore().grants)) {
    if (k.startsWith(prefix)) {
      const instanceId = k.slice(prefix.length);
      if (instanceId) out.push(instanceId);
    }
  }
  return out;
}
