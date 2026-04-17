import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Must match `roomLayouts` ids (avoid circular import). */
const HUB_ROOM_ID = "hub";
const CHAMBER_ROOM_ID = "chamber";
const CANVAS_ROOM_ID = "canvas";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const BUILTIN_NAMES_FILE = path.join(DATA_DIR, "builtin-room-names.json");

type FileShapeV2 = {
  version: 2;
  displayNames: Partial<Record<string, string>>;
  /** Absent or true = listed for non-admins; explicit false = admin-only in catalog. */
  isPublic: Partial<Record<string, boolean>>;
};

const DEFAULTS: Record<string, string> = {
  [HUB_ROOM_ID]: "Hub",
  [CHAMBER_ROOM_ID]: "Chamber",
  [CANVAS_ROOM_ID]: "Canvas",
};

let cache: FileShapeV2 | null = null;

function ensureDataDir(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function validateDisplayName(raw: string): string | null {
  const t = raw.trim();
  if (t.length < 1 || t.length > 48) return null;
  if (/[\x00-\x1f]/.test(t)) return null;
  return t;
}

function migrateFromDisk(raw: unknown): FileShapeV2 {
  if (!raw || typeof raw !== "object") {
    return { version: 2, displayNames: {}, isPublic: {} };
  }
  const o = raw as Record<string, unknown>;
  if (o.version === 1 && o.displayNames && typeof o.displayNames === "object") {
    return {
      version: 2,
      displayNames: { ...(o.displayNames as Record<string, string>) },
      isPublic: {},
    };
  }
  if (o.version === 2 && o.displayNames && typeof o.displayNames === "object") {
    const pub =
      o.isPublic && typeof o.isPublic === "object"
        ? { ...(o.isPublic as Record<string, boolean>) }
        : {};
    return {
      version: 2,
      displayNames: { ...(o.displayNames as Record<string, string>) },
      isPublic: pub,
    };
  }
  return { version: 2, displayNames: {}, isPublic: {} };
}

function loadFile(): FileShapeV2 {
  if (cache) return cache;
  cache = { version: 2, displayNames: {}, isPublic: {} };
  if (!fs.existsSync(BUILTIN_NAMES_FILE)) return cache;
  try {
    const raw = JSON.parse(fs.readFileSync(BUILTIN_NAMES_FILE, "utf8"));
    cache = migrateFromDisk(raw);
  } catch (e) {
    console.error("[builtin-room-names] failed to load", e);
  }
  return cache!;
}

function persist(): void {
  ensureDataDir();
  const data = loadFile();
  const tmp = `${BUILTIN_NAMES_FILE}.tmp`;
  fs.writeFileSync(
    tmp,
    JSON.stringify(
      {
        version: 2,
        displayNames: data.displayNames,
        isPublic: data.isPublic,
      },
      null,
      0
    ),
    "utf8"
  );
  fs.renameSync(tmp, BUILTIN_NAMES_FILE);
}

export function getBuiltinRoomDisplayName(
  roomId: string,
  fallback: string
): string {
  const id = roomId.trim().toLowerCase();
  const names = loadFile().displayNames;
  const v = names[id];
  if (typeof v === "string" && v.trim()) return v.trim();
  return fallback;
}

export function getBuiltinRoomIsPublic(roomId: string): boolean {
  const id = roomId.trim().toLowerCase();
  return loadFile().isPublic[id] !== false;
}

export function patchBuiltinRoomSettings(
  roomIdRaw: string,
  patch: { displayName?: string; isPublic?: boolean }
): { ok: true } | { ok: false; reason: string } {
  const id = roomIdRaw.trim().toLowerCase();
  if (!DEFAULTS[id]) {
    return { ok: false, reason: "Not an official room id." };
  }
  if (patch.displayName === undefined && patch.isPublic === undefined) {
    return { ok: false, reason: "Nothing to update." };
  }
  const data = loadFile();
  if (patch.displayName !== undefined) {
    const displayName = validateDisplayName(patch.displayName);
    if (!displayName) {
      return { ok: false, reason: "Room name must be 1–48 characters." };
    }
    data.displayNames[id] = displayName;
  }
  if (patch.isPublic !== undefined) {
    if (patch.isPublic) {
      delete data.isPublic[id];
    } else {
      data.isPublic[id] = false;
    }
  }
  cache = data;
  persist();
  return { ok: true };
}

export function setBuiltinRoomDisplayName(
  roomId: string,
  displayNameRaw: string
): { ok: true } | { ok: false; reason: string } {
  return patchBuiltinRoomSettings(roomId, { displayName: displayNameRaw });
}
