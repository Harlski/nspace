import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  sanitizeBuilderAddresses,
  type RoomBackgroundNeutral,
} from "./roomRegistry.js";

/** Must match `roomLayouts` ids (avoid circular import). */
const HUB_ROOM_ID = "hub";
const CHAMBER_ROOM_ID = "chamber";
const CANVAS_ROOM_ID = "canvas";
const PIXEL_ROOM_ID = "pixel";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const BUILTIN_NAMES_FILE = path.join(DATA_DIR, "builtin-room-names.json");

type FileShapeV4 = {
  version: 4;
  displayNames: Partial<Record<string, string>>;
  isPublic: Partial<Record<string, boolean>>;
  backgroundHueDeg: Partial<Record<string, number | null>>;
  backgroundNeutral: Partial<Record<string, RoomBackgroundNeutral | null>>;
  builderAddresses: Partial<Record<string, string[]>>;
};

const DEFAULTS: Record<string, string> = {
  [HUB_ROOM_ID]: "Hub",
  [CHAMBER_ROOM_ID]: "Chamber",
  [CANVAS_ROOM_ID]: "Canvas",
  [PIXEL_ROOM_ID]: "Pixel",
};

let cache: FileShapeV4 | null = null;

function ensureDataDir(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function validateDisplayName(raw: string): string | null {
  const t = raw.trim();
  if (t.length < 1 || t.length > 48) return null;
  if (/[\x00-\x1f]/.test(t)) return null;
  return t;
}

function emptyOptionalMaps(): {
  backgroundHueDeg: Partial<Record<string, number | null>>;
  backgroundNeutral: Partial<Record<string, RoomBackgroundNeutral | null>>;
  builderAddresses: Partial<Record<string, string[]>>;
} {
  return { backgroundHueDeg: {}, backgroundNeutral: {}, builderAddresses: {} };
}

function sanitizeBuilderMap(raw: unknown): Partial<Record<string, string[]>> {
  if (!raw || typeof raw !== "object") return {};
  const out: Partial<Record<string, string[]>> = {};
  for (const [id, list] of Object.entries(raw as Record<string, unknown>)) {
    const builders = sanitizeBuilderAddresses(list);
    if (builders.length > 0) out[id] = builders;
  }
  return out;
}

function migrateFromDisk(raw: unknown): FileShapeV4 {
  const fresh: FileShapeV4 = {
    version: 4,
    displayNames: {},
    isPublic: {},
    ...emptyOptionalMaps(),
  };
  if (!raw || typeof raw !== "object") return fresh;
  const o = raw as Record<string, unknown>;
  if (!o.displayNames || typeof o.displayNames !== "object") return fresh;
  const displayNames = { ...(o.displayNames as Record<string, string>) };
  const isPublic =
    o.isPublic && typeof o.isPublic === "object"
      ? { ...(o.isPublic as Record<string, boolean>) }
      : {};
  const backgroundHueDeg =
    o.backgroundHueDeg && typeof o.backgroundHueDeg === "object"
      ? { ...(o.backgroundHueDeg as Record<string, number | null>) }
      : {};
  const backgroundNeutral =
    o.backgroundNeutral && typeof o.backgroundNeutral === "object"
      ? { ...(o.backgroundNeutral as Record<string, RoomBackgroundNeutral | null>) }
      : {};
  const builderAddresses = sanitizeBuilderMap(o.builderAddresses);
  return {
    version: 4,
    displayNames,
    isPublic,
    backgroundHueDeg,
    backgroundNeutral,
    builderAddresses,
  };
}

function loadFile(): FileShapeV4 {
  if (cache) return cache;
  cache = {
    version: 4,
    displayNames: {},
    isPublic: {},
    ...emptyOptionalMaps(),
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
        version: 4,
        displayNames: data.displayNames,
        isPublic: data.isPublic,
        backgroundHueDeg: data.backgroundHueDeg,
        backgroundNeutral: data.backgroundNeutral,
        builderAddresses: data.builderAddresses,
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

/** Builder allowlist for a built-in room (compact `NQ…` wallet addresses). */
export function getBuiltinRoomBuilderAddresses(roomId: string): string[] {
  const id = roomId.trim().toLowerCase();
  if (!DEFAULTS[id]) return [];
  const list = loadFile().builderAddresses[id];
  return Array.isArray(list) ? [...list] : [];
}

/** True when `address` is on the built-in room's builder allowlist. */
export function isBuiltinRoomBuilder(
  roomId: string,
  address: string | null | undefined
): boolean {
  const wallet = String(address ?? "")
    .replace(/\s+/g, "")
    .toUpperCase();
  if (!/^NQ[0-9A-Z]{34}$/.test(wallet)) return false;
  return getBuiltinRoomBuilderAddresses(roomId).includes(wallet);
}

export function patchBuiltinRoomSettings(
  roomIdRaw: string,
  patch: {
    displayName?: string;
    isPublic?: boolean;
    backgroundHueDeg?: number | null;
    backgroundNeutral?: RoomBackgroundNeutral | null;
    builderAddresses?: string[];
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
    patch.backgroundNeutral === undefined &&
    patch.builderAddresses === undefined
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
  if (patch.builderAddresses !== undefined) {
    const builders = sanitizeBuilderAddresses(patch.builderAddresses);
    if (builders.length > 0) {
      data.builderAddresses[id] = builders;
    } else {
      delete data.builderAddresses[id];
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
