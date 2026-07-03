import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function compactWallet(addr: string): string {
  return addr.replace(/\s+/g, "").toUpperCase();
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const THUMBS_FILE = path.join(DATA_DIR, "room-thumbs-up.json");

type PersistedThumbsFile = {
  version: 1;
  /** roomId -> compact wallet addresses that thumbed up */
  rooms: Record<string, string[]>;
};

let roomThumbs = new Map<string, Set<string>>();
let dirty = false;

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function persistThumbs(): void {
  ensureDataDir();
  const rooms: Record<string, string[]> = {};
  for (const [roomId, wallets] of roomThumbs) {
    if (wallets.size === 0) continue;
    rooms[roomId] = [...wallets];
  }
  const payload: PersistedThumbsFile = { version: 1, rooms };
  fs.writeFileSync(THUMBS_FILE, JSON.stringify(payload, null, 2), "utf-8");
  dirty = false;
}

export function loadRoomThumbsUp(): void {
  ensureDataDir();
  roomThumbs = new Map();
  if (!fs.existsSync(THUMBS_FILE)) return;
  try {
    const raw = fs.readFileSync(THUMBS_FILE, "utf-8");
    const data = JSON.parse(raw) as PersistedThumbsFile;
    for (const [roomId, wallets] of Object.entries(data.rooms ?? {})) {
      const id = roomId.trim().toLowerCase();
      if (!id) continue;
      roomThumbs.set(id, new Set(wallets.map((w) => compactWallet(w)).filter(Boolean)));
    }
    console.log(`[room-thumbs] loaded ${roomThumbs.size} room(s) with votes`);
  } catch (err) {
    console.error("[room-thumbs] failed to load:", err);
  }
}

export function flushRoomThumbsUpSync(): void {
  if (dirty) persistThumbs();
}

export function getRoomThumbsUpCount(roomId: string): number {
  const id = roomId.trim().toLowerCase();
  return roomThumbs.get(id)?.size ?? 0;
}

export function viewerHasRoomThumbedUp(roomId: string, wallet: string): boolean {
  const id = roomId.trim().toLowerCase();
  const viewer = compactWallet(wallet);
  if (!viewer) return false;
  return roomThumbs.get(id)?.has(viewer) ?? false;
}

/**
 * Toggle thumbs up for a public room. Returns null when disallowed.
 * `ownerCompact` is the room owner's wallet (compact); null for unowned rooms.
 */
export function toggleRoomThumbsUp(
  roomId: string,
  wallet: string,
  ownerCompact: string | null
): { ok: true; thumbsUpCount: number; viewerThumbedUp: boolean } | { ok: false; reason: string } {
  const id = roomId.trim().toLowerCase();
  const viewer = compactWallet(wallet);
  if (!viewer) return { ok: false, reason: "Invalid wallet." };
  if (ownerCompact && ownerCompact === viewer) {
    return { ok: false, reason: "You cannot thumbs up your own room." };
  }
  let set = roomThumbs.get(id);
  if (!set) {
    set = new Set();
    roomThumbs.set(id, set);
  }
  if (set.has(viewer)) {
    set.delete(viewer);
    if (set.size === 0) roomThumbs.delete(id);
  } else {
    set.add(viewer);
  }
  dirty = true;
  persistThumbs();
  const thumbsUpCount = roomThumbs.get(id)?.size ?? 0;
  return {
    ok: true,
    thumbsUpCount,
    viewerThumbedUp: roomThumbs.get(id)?.has(viewer) ?? false,
  };
}
