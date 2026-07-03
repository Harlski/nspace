import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  MIN_BUILDS_FOR_PUBLIC,
  canEnablePublicVisibility,
} from "./roomBuildScore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const MIGRATION_FLAG = path.join(DATA_DIR, ".room-public-build-gate-v1");
const NOTICES_FILE = path.join(DATA_DIR, "room-public-demotion-notices.json");

export type PublicDemotionNotice = {
  roomId: string;
  displayName: string;
  score: number;
};

type PersistedNotices = {
  version: 1;
  /** owner compact wallet -> pending notices */
  byOwner: Record<string, PublicDemotionNotice[]>;
};

let pendingByOwner = new Map<string, PublicDemotionNotice[]>();
let noticesDirty = false;

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function compactWallet(addr: string): string {
  return addr.replace(/\s+/g, "").toUpperCase();
}

function loadPendingNotices(): void {
  pendingByOwner = new Map();
  if (!fs.existsSync(NOTICES_FILE)) return;
  try {
    const raw = fs.readFileSync(NOTICES_FILE, "utf-8");
    const data = JSON.parse(raw) as PersistedNotices;
    for (const [owner, notices] of Object.entries(data.byOwner ?? {})) {
      const key = compactWallet(owner);
      if (!key || !Array.isArray(notices) || notices.length === 0) continue;
      pendingByOwner.set(key, notices);
    }
  } catch (err) {
    console.error("[room-public-gate] failed to load demotion notices:", err);
  }
}

function persistPendingNotices(): void {
  ensureDataDir();
  const byOwner: Record<string, PublicDemotionNotice[]> = {};
  for (const [owner, notices] of pendingByOwner) {
    if (notices.length === 0) continue;
    byOwner[owner] = notices;
  }
  const payload: PersistedNotices = { version: 1, byOwner };
  fs.writeFileSync(NOTICES_FILE, JSON.stringify(payload, null, 2), "utf-8");
  noticesDirty = false;
}

function queueDemotionNotice(
  ownerCompact: string,
  notice: PublicDemotionNotice
): void {
  const key = compactWallet(ownerCompact);
  if (!key) return;
  const list = pendingByOwner.get(key) ?? [];
  list.push(notice);
  pendingByOwner.set(key, list);
  noticesDirty = true;
}

export function consumePublicDemotionNotices(
  wallet: string
): PublicDemotionNotice[] {
  const key = compactWallet(wallet);
  const pending = pendingByOwner.get(key);
  if (!pending || pending.length === 0) return [];
  pendingByOwner.delete(key);
  noticesDirty = true;
  persistPendingNotices();
  return pending;
}

export function flushPublicDemotionNoticesSync(): void {
  if (noticesDirty) persistPendingNotices();
}

export type PublicGateMigrationRoom = {
  id: string;
  displayName: string;
  ownerAddress: string;
  isOfficial: boolean;
  isPublic: boolean;
};

/**
 * One-time migration: demote player-owned public rooms below the build threshold.
 * `demote` should set isPublic false and persist; returns true when changed.
 */
export function runRoomPublicBuildGateMigration(
  rooms: PublicGateMigrationRoom[],
  scoreForRoom: (roomId: string) => number,
  demote: (roomId: string) => boolean
): number {
  ensureDataDir();
  loadPendingNotices();
  if (fs.existsSync(MIGRATION_FLAG)) return 0;

  let demoted = 0;
  for (const room of rooms) {
    if (!room.isPublic || room.isOfficial) continue;
    const score = scoreForRoom(room.id);
    if (canEnablePublicVisibility(score, false)) continue;
    const changed = demote(room.id);
    if (!changed) continue;
    demoted += 1;
    queueDemotionNotice(compactWallet(room.ownerAddress), {
      roomId: room.id,
      displayName: room.displayName,
      score,
    });
  }

  fs.writeFileSync(MIGRATION_FLAG, `${Date.now()}\n`, "utf-8");
  if (noticesDirty) persistPendingNotices();
  if (demoted > 0) {
    console.log(
      `[room-public-gate] demoted ${demoted} public room(s) below ${MIN_BUILDS_FOR_PUBLIC} builds`
    );
  }
  return demoted;
}

export function loadPublicDemotionNoticesStore(): void {
  loadPendingNotices();
}
