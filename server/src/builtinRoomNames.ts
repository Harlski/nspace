import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { RoomBackgroundNeutral } from "./roomRegistry.js";

/** Must match `roomLayouts` ids (avoid circular import). */
const HUB_ROOM_ID = "hub";
const CHAMBER_ROOM_ID = "chamber";
const CANVAS_ROOM_ID = "canvas";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const BUILTIN_NAMES_FILE = path.join(DATA_DIR, "builtin-room-names.json");

type FileShapeV3 = {
  version: 3;
  displayNames: Partial<Record<string, string>>;
  isPublic: Partial<Record<string, boolean>>;
  backgroundHueDeg: Partial<Record<string, number | null>>;
  backgroundNeutral: Partial<Record<string, RoomBackgroundNeutral | null>>;
};

const DEFAULTS: Record<string, string> = {
  [HUB_ROOM_ID]: "Hub",
  [CHAMBER_ROOM_ID]: "Chamber",
  [CANVAS_ROOM_ID]: "Canvas",
};

let cache: FileShapeV3 | null = null;

function ensureDataDir(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function validateDisplayName(raw: string): string | null {
  const t = raw.trim();
  if (t.length < 1 || t.length > 48) return null;
  if (/[\x00-\x1f]/.test(t)) return null;
  return t;
}

function emptyBackgroundMaps(): {
  backgroundHueDeg: Partial<Record<string, number | null>>;
  backgroundNeutral: Partial<Record<string, RoomBackgroundNeutral | null>>;
} {
  return { backgroundHueDeg: {}, backgroundNeutral: {} };
}

function migrateFromDisk(raw: unknown): FileShapeV3 {
  if (!raw || typeof raw !== "object") {
    return {
      version: 3,
      displayNames: {},
      isPublic: {},
      ...emptyBackgroundMaps(),
    };
  }
  const o = raw as Record<string, unknown>;
  if (o.version === 1 && o.displayNames && typeof o.displayNames === "object") {
    return {
      version: 3,
      displayNames: { ...(o.displayNames as Record<string, string>) },
      isPublic: {},
      ...emptyBackgroundMaps(),
    };
  }
  if (o.version === 2 && o.displayNames && typeof o.displayNames === "object") {
    const pub =
      o.isPublic && typeof o.isPublic === "object"
        ? { ...(o.isPublic as Record<string, boolean>) }
        : {};
    return {
      version: 3,
      displayNames: { ...(o.displayNames as Record<string, string>) },
      isPublic: pub,
      ...emptyBackgroundMaps(),
    };
  }
  if (o.version === 3 && o.displayNames && typeof o.displayNames === "object") {
    const pub =
      o.isPublic && typeof o.isPublic === "object"
        ? { ...(o.isPublic as Record<string, boolean>) }
        : {};
    const bh =
      o.backgroundHueDeg && typeof o.backgroundHueDeg === "object"
        ? { ...(o.backgroundHueDeg as Record<string, number | null>) }
        : {};
    const bn =
      o.backgroundNeutral && typeof o.backgroundNeutral === "object"
        ? { ...(o.backgroundNeutral as Record<string, RoomBackgroundNeutral | null>) }
        : {};
    return {
      version: 3,
      displayNames: { ...(o.displayNames as Record<string, string>) },
      isPublic: pub,
      backgroundHueDeg: bh,
      backgroundNeutral: bn,
    };
  }
  return {
    version: 3,
    displayNames: {},
    isPublic: {},
    ...emptyBackgroundMaps(),
  };
}

function loadFile(): FileShapeV3 {
  if (cache) return cache;
  cache = {
    version: 3,
    displayNames: {},
    isPublic: {},
    ...emptyBackgroundMaps(),
  };
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
        version: 3,
        displayNames: data.displayNames,
        isPublic: data.isPublic,
        backgroundHueDeg: data.backgroundHueDeg,
        backgroundNeutral: data.backgroundNeutral,
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

export function getBuiltinRoomBackgroundState(roomId: string): {
  hueDeg: number | null;
  neutral: RoomBackgroundNeutral | null;
} {
  const id = roomId.trim().toLowerCase();
  if (!DEFAULTS[id]) {
    return { hueDeg: null, neutral: null };
  }
  const data = loadFile();
  const hueRaw = data.backgroundHueDeg[id];
  const neutralRaw = data.backgroundNeutral[id];
  const neutral =
    neutralRaw === "black" || neutralRaw === "white" || neutralRaw === "gray"
      ? neutralRaw
      : null;
  const hueDeg =
    typeof hueRaw === "number" && Number.isFinite(hueRaw)
      ? Math.round(((hueRaw % 360) + 360) % 360)
      : null;
  return { hueDeg, neutral };
}

export function patchBuiltinRoomSettings(
  roomIdRaw: string,
  patch: {
    displayName?: string;
    isPublic?: boolean;
    backgroundHueDeg?: number | null;
    backgroundNeutral?: RoomBackgroundNeutral | null;
  }
): { ok: true } | { ok: false; reason: string } {
  const id = roomIdRaw.trim().toLowerCase();
  if (!DEFAULTS[id]) {
    return { ok: false, reason: "Not an official room id." };
  }
  if (
    patch.displayName === undefined &&
    patch.isPublic === undefined &&
    patch.backgroundHueDeg === undefined &&
    patch.backgroundNeutral === undefined
  ) {
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
  if (patch.backgroundHueDeg !== undefined) {
    data.backgroundHueDeg[id] = patch.backgroundHueDeg;
    data.backgroundNeutral[id] = null;
  }
  if (patch.backgroundNeutral !== undefined) {
    data.backgroundNeutral[id] = patch.backgroundNeutral;
    if (patch.backgroundNeutral != null) {
      data.backgroundHueDeg[id] = null;
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
