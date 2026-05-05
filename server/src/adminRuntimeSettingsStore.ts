import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const STORE_FILE = process.env.ADMIN_RUNTIME_SETTINGS_FILE
  ? path.resolve(process.env.ADMIN_RUNTIME_SETTINGS_FILE)
  : path.join(__dirname, "..", "data", "admin-runtime-settings.json");

export type AdminRuntimeSettings = {
  /** When true, signed-in players may set their own username. When false, only admins may assign names (moderation API or own wallet as admin). */
  playerUsernameSelfServiceEnabled: boolean;
};

const DEFAULTS: AdminRuntimeSettings = {
  playerUsernameSelfServiceEnabled: false,
};

type StoreFile = { settings: AdminRuntimeSettings };

function ensureDir(): void {
  const dir = path.dirname(STORE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readStore(): StoreFile {
  if (!fs.existsSync(STORE_FILE)) return { settings: { ...DEFAULTS } };
  try {
    const raw = fs.readFileSync(STORE_FILE, "utf8");
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object") return { settings: { ...DEFAULTS } };
    const o = j as Record<string, unknown>;
    const s = o.settings;
    if (!s || typeof s !== "object") return { settings: { ...DEFAULTS } };
    const merged: AdminRuntimeSettings = {
      ...DEFAULTS,
      ...(s as Partial<AdminRuntimeSettings>),
    };
    merged.playerUsernameSelfServiceEnabled =
      Boolean((s as AdminRuntimeSettings).playerUsernameSelfServiceEnabled);
    return { settings: merged };
  } catch {
    return { settings: { ...DEFAULTS } };
  }
}

function writeStore(data: StoreFile): void {
  ensureDir();
  const tmp = `${STORE_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 0), "utf8");
  fs.renameSync(tmp, STORE_FILE);
}

export function getAdminRuntimeSettings(): AdminRuntimeSettings {
  return { ...readStore().settings };
}

export function patchAdminRuntimeSettings(
  patch: Partial<AdminRuntimeSettings>
): AdminRuntimeSettings {
  const cur = readStore().settings;
  const next: AdminRuntimeSettings = {
    ...cur,
    ...patch,
  };
  if (patch.playerUsernameSelfServiceEnabled !== undefined) {
    next.playerUsernameSelfServiceEnabled = Boolean(patch.playerUsernameSelfServiceEnabled);
  }
  writeStore({ settings: next });
  return next;
}
