import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  invalidateStreamObserverAllowlistCache,
} from "./streamObserverAllowlist.js";
import { normalizeStreamObserverAddressesField } from "./walletAddresses.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function storeFilePath(): string {
  return process.env.ADMIN_RUNTIME_SETTINGS_FILE
    ? path.resolve(process.env.ADMIN_RUNTIME_SETTINGS_FILE)
    : path.join(__dirname, "..", "data", "admin-runtime-settings.json");
}

export type AdminRuntimeSettings = {
  /** When true, signed-in players may set their own username. When false, only admins may assign names (moderation API or own wallet as admin). */
  playerUsernameSelfServiceEnabled: boolean;
  /** Comma-separated Nimiq wallets allowed for cinema `?stream=1` (merged with `STREAM_OBSERVER_ADDRESSES` env). */
  streamObserverAddresses: string;
  /**
   * Nimiq Pay first-contact tutorial. Off by default; also requires env
   * `TUTORIAL_ENABLED=1` (env unset/0 hard-disables regardless of this flag).
   */
  tutorialEnabled: boolean;
  /**
   * Player-facing Shop. On by default; still hard-closed when `SHOP_ENABLED=0`.
   */
  shopEnabled: boolean;
};

const DEFAULTS: AdminRuntimeSettings = {
  playerUsernameSelfServiceEnabled: true,
  streamObserverAddresses: "",
  tutorialEnabled: false,
  shopEnabled: true,
};

type StoreFile = { settings: AdminRuntimeSettings };

function ensureDir(): void {
  const dir = path.dirname(storeFilePath());
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readStore(): StoreFile {
  if (!fs.existsSync(storeFilePath())) return { settings: { ...DEFAULTS } };
  try {
    const raw = fs.readFileSync(storeFilePath(), "utf8");
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
    merged.streamObserverAddresses =
      typeof (s as AdminRuntimeSettings).streamObserverAddresses === "string"
        ? (s as AdminRuntimeSettings).streamObserverAddresses
        : DEFAULTS.streamObserverAddresses;
    merged.tutorialEnabled = Boolean(
      (s as AdminRuntimeSettings).tutorialEnabled ?? DEFAULTS.tutorialEnabled
    );
    merged.shopEnabled = Boolean(
      (s as AdminRuntimeSettings).shopEnabled ?? DEFAULTS.shopEnabled
    );
    return { settings: merged };
  } catch {
    return { settings: { ...DEFAULTS } };
  }
}

function writeStore(data: StoreFile): void {
  ensureDir();
  const file = storeFilePath();
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 0), "utf8");
  fs.renameSync(tmp, file);
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
  if (patch.streamObserverAddresses !== undefined) {
    next.streamObserverAddresses = patch.streamObserverAddresses;
  }
  if (patch.tutorialEnabled !== undefined) {
    next.tutorialEnabled = Boolean(patch.tutorialEnabled);
  }
  if (patch.shopEnabled !== undefined) {
    next.shopEnabled = Boolean(patch.shopEnabled);
  }
  writeStore({ settings: next });
  if (patch.streamObserverAddresses !== undefined) {
    invalidateStreamObserverAllowlistCache();
  }
  return next;
}

export function patchStreamObserverAddresses(raw: string): AdminRuntimeSettings {
  const normalized = normalizeStreamObserverAddressesField(raw);
  return patchAdminRuntimeSettings({ streamObserverAddresses: normalized });
}
