import { randomInt } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { RoomBounds } from "./roomLayouts.js";
import { walletDisplayName } from "./walletDisplayName.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const ROOM_REGISTRY_FILE = path.join(DATA_DIR, "rooms.json");

export type RoomBackgroundNeutral = "black" | "white" | "gray";

export type PersistedRoomDef = {
  id: string;
  bounds: RoomBounds;
  /** Present in v2+; omitted in legacy v1 files. */
  ownerAddress?: string;
  displayName?: string;
  isPublic?: boolean;
  /** v4+: soft-delete timestamp (ms); absent or null = active. */
  deletedAt?: number | null;
  /** v5+: admin-created room listed with built-in “official” rooms; does not count toward player room cap. */
  isOfficial?: boolean;
  /** Optional custom sky hue (degrees 0–359) for dynamic rooms; omitted = default water tone. */
  backgroundHueDeg?: number | null;
  /** Solid neutral sky when set; takes precedence over hue. */
  backgroundNeutral?: RoomBackgroundNeutral | null;
};

type PersistedRoomsFileV1 = {
  version: 1;
  rooms: PersistedRoomDef[];
};

type PersistedRoomsFileV2 = {
  version: 2;
  rooms: PersistedRoomDef[];
};

type PersistedRoomsFileV3 = {
  version: 3;
  rooms: PersistedRoomDef[];
};

type PersistedRoomsFileV4 = {
  version: 4;
  rooms: PersistedRoomDef[];
};

type PersistedRoomsFileV5 = {
  version: 5;
  rooms: PersistedRoomDef[];
};

type PersistedRoomsFile =
  | PersistedRoomsFileV1
  | PersistedRoomsFileV2
  | PersistedRoomsFileV3
  | PersistedRoomsFileV4
  | PersistedRoomsFileV5;

type DynamicRoomEntry = {
  bounds: RoomBounds;
  /** Wallet that created the room; null for legacy entries without owner. */
  ownerAddress: string | null;
  displayName: string;
  /** When false, room is hidden from the public catalog but joinable by code. */
  isPublic: boolean;
  /** When set, room is soft-deleted (hidden from play; restorable by admin). */
  deletedAt: number | null;
  /** Admin-created; listed as official; omitted from per-player owned-room counts. */
  isOfficial: boolean;
  /** Custom scene background hue (0–359), or null when using neutral or default. */
  backgroundHueDeg: number | null;
  /** Solid neutral background; when non-null, overrides hue for rendering. */
  backgroundNeutral: RoomBackgroundNeutral | null;
};

const dynamicRooms = new Map<string, DynamicRoomEntry>();

const NEW_ROOM_CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function ensureDataDir(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function normalizeRoomIdRaw(roomId: string): string {
  return roomId.trim().toLowerCase();
}

function compactAddress(addr: string): string {
  return String(addr).replace(/\s+/g, "").toUpperCase();
}

function isValidBounds(bounds: RoomBounds): boolean {
  return (
    Number.isFinite(bounds.minX) &&
    Number.isFinite(bounds.maxX) &&
    Number.isFinite(bounds.minZ) &&
    Number.isFinite(bounds.maxZ) &&
    bounds.minX <= bounds.maxX &&
    bounds.minZ <= bounds.maxZ
  );
}

function validateDisplayName(raw: string): string | null {
  const t = raw.trim();
  if (t.length < 1 || t.length > 48) return null;
  if (/[\x00-\x1f]/.test(t)) return null;
  return t;
}

function normalizePersistedBackgroundHueDeg(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(((n % 360) + 360) % 360);
}

export function normalizeBackgroundHuePatch(
  v: unknown
): { ok: true; hue: number | null } | { ok: false; reason: string } {
  if (v === null) return { ok: true, hue: null };
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) {
    return { ok: false, reason: "Background hue must be a number or null." };
  }
  return { ok: true, hue: Math.round(((n % 360) + 360) % 360) };
}

function normalizePersistedBackgroundNeutral(
  v: unknown
): RoomBackgroundNeutral | null {
  if (v === null || v === undefined) return null;
  if (v === "black" || v === "white" || v === "gray") return v;
  return null;
}

export function normalizeBackgroundNeutralPatch(
  v: unknown
):
  | { ok: true; neutral: RoomBackgroundNeutral | null }
  | { ok: false; reason: string } {
  if (v === null) return { ok: true, neutral: null };
  if (v === "black" || v === "white" || v === "gray") {
    return { ok: true, neutral: v };
  }
  return {
    ok: false,
    reason: "Background neutral must be black, white, gray, or null.",
  };
}

function generateUniqueRoomId(defaultRoomIds: ReadonlySet<string>): string {
  for (let attempt = 0; attempt < 400; attempt++) {
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += NEW_ROOM_CODE_CHARS[randomInt(NEW_ROOM_CODE_CHARS.length)]!;
    }
    const id = code.toLowerCase();
    if (!defaultRoomIds.has(id) && !dynamicRooms.has(id)) return id;
  }
  return "";
}

function persistRoomsFile(): void {
  ensureDataDir();
  const payload: PersistedRoomsFileV5 = {
    version: 5,
    rooms: [...dynamicRooms.entries()].map(([id, entry]) => ({
      id,
      bounds: entry.bounds,
      displayName: entry.displayName,
      isPublic: entry.isPublic,
      isOfficial: entry.isOfficial,
      ...(entry.ownerAddress ? { ownerAddress: entry.ownerAddress } : {}),
      ...(entry.deletedAt != null ? { deletedAt: entry.deletedAt } : {}),
      ...(entry.backgroundHueDeg != null
        ? { backgroundHueDeg: entry.backgroundHueDeg }
        : {}),
      ...(entry.backgroundNeutral != null
        ? { backgroundNeutral: entry.backgroundNeutral }
        : {}),
    })),
  };
  const tmp = `${ROOM_REGISTRY_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(payload), "utf8");
  fs.renameSync(tmp, ROOM_REGISTRY_FILE);
}

export function loadRoomRegistry(defaultRoomIds: ReadonlySet<string>): void {
  dynamicRooms.clear();
  if (!fs.existsSync(ROOM_REGISTRY_FILE)) return;
  try {
    const raw = JSON.parse(
      fs.readFileSync(ROOM_REGISTRY_FILE, "utf8")
    ) as PersistedRoomsFile;
    if (
      raw.version !== 1 &&
      raw.version !== 2 &&
      raw.version !== 3 &&
      raw.version !== 4 &&
      raw.version !== 5
    ) {
      return;
    }
    if (!Array.isArray(raw.rooms)) return;
    for (const r of raw.rooms) {
      const id = normalizeRoomIdRaw(String(r.id ?? ""));
      if (!id || defaultRoomIds.has(id)) continue;
      if (!isValidBounds(r.bounds)) continue;
      let owner: string | null = null;
      if (
        raw.version >= 2 &&
        typeof r.ownerAddress === "string" &&
        r.ownerAddress.trim()
      ) {
        owner = compactAddress(r.ownerAddress);
      }
      let displayName: string;
      if (
        raw.version >= 3 &&
        typeof r.displayName === "string" &&
        r.displayName.trim()
      ) {
        displayName = r.displayName.trim();
      } else if (owner && typeof r.ownerAddress === "string") {
        displayName = `${walletDisplayName(r.ownerAddress)}'s room`;
      } else {
        displayName = `Room ${id.toUpperCase()}`;
      }
      const isPublic =
        raw.version === 3 || raw.version === 4 || raw.version === 5
          ? r.isPublic !== false
          : true;

      let deletedAt: number | null = null;
      if (
        (raw.version === 4 || raw.version === 5) &&
        typeof r.deletedAt === "number" &&
        Number.isFinite(r.deletedAt)
      ) {
        deletedAt = r.deletedAt;
      }

      const isOfficial = r.isOfficial === true;
      const backgroundHueDeg = normalizePersistedBackgroundHueDeg(
        r.backgroundHueDeg
      );
      const backgroundNeutral = normalizePersistedBackgroundNeutral(
        (r as { backgroundNeutral?: unknown }).backgroundNeutral
      );

      dynamicRooms.set(id, {
        bounds: {
          minX: Math.floor(r.bounds.minX),
          maxX: Math.floor(r.bounds.maxX),
          minZ: Math.floor(r.bounds.minZ),
          maxZ: Math.floor(r.bounds.maxZ),
        },
        ownerAddress: owner,
        displayName,
        isPublic,
        deletedAt,
        isOfficial,
        backgroundHueDeg,
        backgroundNeutral,
      });
    }
  } catch (err) {
    console.error("[rooms] failed to load room registry", err);
  }
}

export function listDynamicRooms(): Array<{
  id: string;
  bounds: RoomBounds;
  ownerAddress: string | null;
  displayName: string;
  isPublic: boolean;
  isOfficial: boolean;
  backgroundHueDeg: number | null;
  backgroundNeutral: RoomBackgroundNeutral | null;
}> {
  return [...dynamicRooms.entries()]
    .filter(([, entry]) => !entry.deletedAt)
    .map(([id, entry]) => ({
      id,
      bounds: { ...entry.bounds },
      ownerAddress: entry.ownerAddress,
      displayName: entry.displayName,
      isPublic: entry.isPublic,
      isOfficial: entry.isOfficial,
      backgroundHueDeg: entry.backgroundHueDeg,
      backgroundNeutral: entry.backgroundNeutral,
    }));
}

/** Soft-deleted rooms (admin restore list). */
export function listDeletedDynamicRooms(): Array<{
  id: string;
  bounds: RoomBounds;
  ownerAddress: string | null;
  displayName: string;
  isPublic: boolean;
  isOfficial: boolean;
  deletedAt: number;
  backgroundHueDeg: number | null;
  backgroundNeutral: RoomBackgroundNeutral | null;
}> {
  const out: Array<{
    id: string;
    bounds: RoomBounds;
    ownerAddress: string | null;
    displayName: string;
    isPublic: boolean;
    isOfficial: boolean;
    deletedAt: number;
    backgroundHueDeg: number | null;
    backgroundNeutral: RoomBackgroundNeutral | null;
  }> = [];
  for (const [id, entry] of dynamicRooms.entries()) {
    if (!entry.deletedAt) continue;
    out.push({
      id,
      bounds: { ...entry.bounds },
      ownerAddress: entry.ownerAddress,
      displayName: entry.displayName,
      isPublic: entry.isPublic,
      isOfficial: entry.isOfficial,
      deletedAt: entry.deletedAt,
      backgroundHueDeg: entry.backgroundHueDeg,
      backgroundNeutral: entry.backgroundNeutral,
    });
  }
  return out;
}

export function countRoomsOwnedBy(ownerAddress: string): number {
  const want = compactAddress(ownerAddress);
  let n = 0;
  for (const entry of dynamicRooms.values()) {
    if (entry.deletedAt) continue;
    if (entry.isOfficial) continue;
    if (entry.ownerAddress && compactAddress(entry.ownerAddress) === want) {
      n += 1;
    }
  }
  return n;
}

export function getDynamicRoomBounds(roomId: string): RoomBounds | null {
  const id = normalizeRoomIdRaw(roomId);
  const entry = dynamicRooms.get(id);
  return entry ? { ...entry.bounds } : null;
}

export function hasDynamicRoom(roomId: string): boolean {
  const id = normalizeRoomIdRaw(roomId);
  const e = dynamicRooms.get(id);
  return !!e && !e.deletedAt;
}

/** Compact owner address for an active dynamic room, or null if none / not dynamic. */
export function getDynamicRoomOwnerAddress(roomId: string): string | null {
  const id = normalizeRoomIdRaw(roomId);
  const entry = dynamicRooms.get(id);
  if (!entry || entry.deletedAt) return null;
  return entry.ownerAddress;
}

/** True if room exists in registry including soft-deleted entries. */
export function hasDynamicRoomEntry(roomId: string): boolean {
  return dynamicRooms.has(normalizeRoomIdRaw(roomId));
}

/**
 * New player rooms: unique 6-character A–Z / 0–9 id (stored lowercase).
 * Legacy persisted ids may be longer; those remain loadable.
 */
export function createDynamicRoom(
  bounds: RoomBounds,
  defaultRoomIds: ReadonlySet<string>,
  ownerAddress: string,
  maxOwnedRoomsPerPlayer: number,
  displayNameRaw: string,
  isPublic: boolean
): { ok: true; id: string } | { ok: false; reason: string } {
  const displayName = validateDisplayName(displayNameRaw);
  if (!displayName) {
    return { ok: false, reason: "Room name must be 1–48 characters." };
  }
  if (!isValidBounds(bounds)) {
    return { ok: false, reason: "Invalid room bounds." };
  }
  const owner = compactAddress(ownerAddress);
  if (!owner) {
    return { ok: false, reason: "Missing owner for room creation." };
  }
  const owned = countRoomsOwnedBy(owner);
  if (owned >= maxOwnedRoomsPerPlayer) {
    return {
      ok: false,
      reason: `You can own at most ${maxOwnedRoomsPerPlayer} custom room(s). (Server limit: MAX_OWNED_ROOMS_PER_PLAYER)`,
    };
  }
  const id = generateUniqueRoomId(defaultRoomIds);
  if (!id) {
    return { ok: false, reason: "Could not allocate a room code; try again." };
  }
  dynamicRooms.set(id, {
    bounds: {
      minX: Math.floor(bounds.minX),
      maxX: Math.floor(bounds.maxX),
      minZ: Math.floor(bounds.minZ),
      maxZ: Math.floor(bounds.maxZ),
    },
    ownerAddress: owner,
    displayName,
    isPublic,
    deletedAt: null,
    isOfficial: false,
    backgroundHueDeg: null,
    backgroundNeutral: null,
  });
  persistRoomsFile();
  return { ok: true, id };
}

/**
 * Admin-only: new room with no player owner, listed as official, not counted toward anyone’s cap.
 */
export function createOfficialDynamicRoom(
  bounds: RoomBounds,
  defaultRoomIds: ReadonlySet<string>,
  displayNameRaw: string,
  isPublic: boolean
): { ok: true; id: string } | { ok: false; reason: string } {
  const displayName = validateDisplayName(displayNameRaw);
  if (!displayName) {
    return { ok: false, reason: "Room name must be 1–48 characters." };
  }
  if (!isValidBounds(bounds)) {
    return { ok: false, reason: "Invalid room bounds." };
  }
  const id = generateUniqueRoomId(defaultRoomIds);
  if (!id) {
    return { ok: false, reason: "Could not allocate a room code; try again." };
  }
  dynamicRooms.set(id, {
    bounds: {
      minX: Math.floor(bounds.minX),
      maxX: Math.floor(bounds.maxX),
      minZ: Math.floor(bounds.minZ),
      maxZ: Math.floor(bounds.maxZ),
    },
    ownerAddress: null,
    displayName,
    isPublic,
    deletedAt: null,
    isOfficial: true,
    backgroundHueDeg: null,
    backgroundNeutral: null,
  });
  persistRoomsFile();
  return { ok: true, id };
}

export function getDynamicRoomBackgroundHueDeg(roomId: string): number | null {
  const id = normalizeRoomIdRaw(roomId);
  const entry = dynamicRooms.get(id);
  if (!entry || entry.deletedAt) return null;
  return entry.backgroundHueDeg;
}

export function getDynamicRoomBackgroundState(roomId: string): {
  hueDeg: number | null;
  neutral: RoomBackgroundNeutral | null;
} {
  const id = normalizeRoomIdRaw(roomId);
  const entry = dynamicRooms.get(id);
  if (!entry || entry.deletedAt) {
    return { hueDeg: null, neutral: null };
  }
  return {
    hueDeg: entry.backgroundHueDeg,
    neutral: entry.backgroundNeutral,
  };
}

/** Who may PATCH `backgroundHueDeg` (official rooms: admins only; else owner or admin). */
export function allowActorRoomBackgroundHueEdit(
  roomId: string,
  actorCompact: string,
  isAdminUser: boolean
): boolean {
  const id = normalizeRoomIdRaw(roomId);
  const entry = dynamicRooms.get(id);
  if (!entry || entry.deletedAt) return false;
  if (isAdminUser) return true;
  if (entry.isOfficial) return false;
  if (!entry.ownerAddress) return false;
  return compactAddress(entry.ownerAddress) === actorCompact;
}

export function updateDynamicRoomMetadata(
  roomId: string,
  patch: {
    displayName?: string;
    isPublic?: boolean;
    backgroundHueDeg?: number | null;
    backgroundNeutral?: RoomBackgroundNeutral | null;
  },
  actorCompact: string,
  isAdminUser: boolean
): { ok: true } | { ok: false; reason: string } {
  if (
    patch.displayName === undefined &&
    patch.isPublic === undefined &&
    patch.backgroundHueDeg === undefined &&
    patch.backgroundNeutral === undefined
  ) {
    return { ok: false, reason: "Nothing to update." };
  }
  const id = normalizeRoomIdRaw(roomId);
  const entry = dynamicRooms.get(id);
  if (!entry) {
    return { ok: false, reason: "Room not found." };
  }
  if (entry.deletedAt) {
    return { ok: false, reason: "Room is deleted." };
  }
  if (
    (patch.backgroundHueDeg !== undefined ||
      patch.backgroundNeutral !== undefined) &&
    entry.isOfficial &&
    !isAdminUser
  ) {
    return {
      ok: false,
      reason: "Only admins can change the background of official rooms.",
    };
  }
  if (!entry.ownerAddress) {
    if (!isAdminUser || !entry.isOfficial) {
      return { ok: false, reason: "Cannot edit this room." };
    }
  } else {
    const ownerC = compactAddress(entry.ownerAddress);
    if (!isAdminUser && ownerC !== actorCompact) {
      return { ok: false, reason: "Not authorized to edit this room." };
    }
  }
  if (patch.displayName !== undefined) {
    const v = validateDisplayName(patch.displayName);
    if (!v) {
      return { ok: false, reason: "Room name must be 1–48 characters." };
    }
    entry.displayName = v;
  }
  if (patch.isPublic !== undefined) {
    entry.isPublic = patch.isPublic;
  }
  if (patch.backgroundHueDeg !== undefined) {
    entry.backgroundHueDeg = patch.backgroundHueDeg;
    if (patch.backgroundHueDeg !== null) {
      entry.backgroundNeutral = null;
    } else {
      entry.backgroundNeutral = null;
    }
  }
  if (patch.backgroundNeutral !== undefined) {
    entry.backgroundNeutral = patch.backgroundNeutral;
    if (patch.backgroundNeutral != null) {
      entry.backgroundHueDeg = null;
    }
  }
  dynamicRooms.set(id, entry);
  persistRoomsFile();
  return { ok: true };
}

export function softDeleteDynamicRoom(
  roomId: string,
  actorCompact: string,
  isAdminUser: boolean
): { ok: true } | { ok: false; reason: string } {
  const id = normalizeRoomIdRaw(roomId);
  const entry = dynamicRooms.get(id);
  if (!entry) {
    return { ok: false, reason: "Room not found." };
  }
  if (entry.deletedAt) {
    return { ok: false, reason: "Room already deleted." };
  }
  if (!entry.ownerAddress) {
    if (!isAdminUser) {
      return { ok: false, reason: "Cannot delete this room." };
    }
  } else {
    const ownerC = compactAddress(entry.ownerAddress);
    if (!isAdminUser && ownerC !== actorCompact) {
      return { ok: false, reason: "Not authorized to delete this room." };
    }
  }
  entry.deletedAt = Date.now();
  dynamicRooms.set(id, entry);
  persistRoomsFile();
  return { ok: true };
}

export function restoreDynamicRoom(
  roomId: string,
  actorIsAdmin: boolean
): { ok: true } | { ok: false; reason: string } {
  if (!actorIsAdmin) {
    return { ok: false, reason: "Only admins can restore rooms." };
  }
  const id = normalizeRoomIdRaw(roomId);
  const entry = dynamicRooms.get(id);
  if (!entry) {
    return { ok: false, reason: "Room not found." };
  }
  if (!entry.deletedAt) {
    return { ok: false, reason: "Room is not deleted." };
  }
  entry.deletedAt = null;
  dynamicRooms.set(id, entry);
  persistRoomsFile();
  return { ok: true };
}
