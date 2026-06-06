import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { walletDisplayName } from "./walletDisplayName.js";
import { isUsernameSetBanned } from "./moderationStore.js";
import { usernameAssignmentError } from "./usernamePolicy.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const STORE_FILE = process.env.PLAYER_PROFILE_STORE_FILE
  ? path.resolve(process.env.PLAYER_PROFILE_STORE_FILE)
  : path.join(__dirname, "..", "data", "player-profiles.json");

export const USERNAME_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export const USERNAME_PROMPT_MAX_DEFERRALS = 5;
export { USERNAME_MAX_LEN, USERNAME_MIN_LEN } from "./usernamePolicy.js";

type Row = {
  message: string;
  updatedAt: number;
  customUsername?: string | null;
  usernameChangedAt?: number;
  /** Times the player chose "Not now" on the login username prompt (max {@link USERNAME_PROMPT_MAX_DEFERRALS}). */
  usernamePromptDeferCount?: number;
  recentAliases?: string[];
};

type StoreFile = { profiles: Record<string, Row> };

function ensureDir(): void {
  const dir = path.dirname(STORE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readStore(): StoreFile {
  if (!fs.existsSync(STORE_FILE)) return { profiles: {} };
  try {
    const raw = fs.readFileSync(STORE_FILE, "utf8");
    const j = JSON.parse(raw) as unknown;
    if (j && typeof j === "object" && "profiles" in (j as StoreFile)) {
      const profiles = (j as StoreFile).profiles;
      if (profiles && typeof profiles === "object") return { profiles };
    }
  } catch {
    /* fall through */
  }
  return { profiles: {} };
}

function writeStore(data: StoreFile): void {
  ensureDir();
  const tmp = `${STORE_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 0), "utf8");
  fs.renameSync(tmp, STORE_FILE);
}

function rowEnsure(base: Partial<Row> | undefined): Row {
  const message = typeof base?.message === "string" ? base.message : "";
  const updatedAt =
    typeof base?.updatedAt === "number" && Number.isFinite(base.updatedAt)
      ? base.updatedAt
      : Date.now();
  return {
    message,
    updatedAt,
    customUsername:
      base?.customUsername === null || base?.customUsername === undefined
        ? null
        : String(base.customUsername),
    usernameChangedAt:
      typeof base?.usernameChangedAt === "number" ? base.usernameChangedAt : undefined,
    usernamePromptDeferCount:
      typeof base?.usernamePromptDeferCount === "number" &&
      Number.isFinite(base.usernamePromptDeferCount)
        ? Math.max(0, Math.floor(base.usernamePromptDeferCount))
        : 0,
    recentAliases: Array.isArray(base?.recentAliases)
      ? base.recentAliases.map((x) => String(x)).filter(Boolean)
      : [],
  };
}

export function getPlayerProfileMessage(normalizedAddress: string): string {
  const key = normalizedAddress.trim().toUpperCase();
  if (!key) return "";
  const row = readStore().profiles[key];
  return row?.message ? String(row.message) : "";
}

function getRow(key: string): Row {
  const raw = readStore().profiles[key];
  return rowEnsure(raw);
}

/** Effective in-game display label (custom or wallet shorthand). */
export function getEffectivePlayerDisplayName(
  normalizedAddress: string
): string {
  const key = normalizedAddress.trim().toUpperCase();
  if (!key) return "";
  const r = getRow(key);
  const c = r.customUsername?.trim();
  if (c) return c;
  return walletDisplayName(key);
}

export function playerHasCustomUsername(normalizedAddress: string): boolean {
  const key = normalizedAddress.trim().toUpperCase();
  if (!key) return false;
  return Boolean(getRow(key).customUsername?.trim());
}

export type UsernamePromptStatus = {
  needsPrompt: boolean;
  deferCount: number;
  deferralsRemaining: number;
  mustSetUsername: boolean;
};

/** Login prompt: players without a custom username are nudged until they set one or exhaust deferrals. */
export function getUsernamePromptStatus(normalizedAddress: string): UsernamePromptStatus {
  const key = normalizedAddress.trim().toUpperCase();
  if (!key || playerHasCustomUsername(key) || isUsernameSetBanned(key)) {
    return {
      needsPrompt: false,
      deferCount: 0,
      deferralsRemaining: USERNAME_PROMPT_MAX_DEFERRALS,
      mustSetUsername: false,
    };
  }
  const deferCount = getRow(key).usernamePromptDeferCount ?? 0;
  const deferralsRemaining = Math.max(0, USERNAME_PROMPT_MAX_DEFERRALS - deferCount);
  return {
    needsPrompt: true,
    deferCount,
    deferralsRemaining,
    mustSetUsername: deferCount >= USERNAME_PROMPT_MAX_DEFERRALS,
  };
}

export function recordUsernamePromptDeferral(
  normalizedAddress: string
): { ok: true; deferralsRemaining: number } | { ok: false; error: string } {
  const key = normalizedAddress.trim().toUpperCase();
  if (!key) return { ok: false, error: "invalid_address" };
  if (playerHasCustomUsername(key)) return { ok: false, error: "username_already_set" };
  const data = readStore();
  const prev = rowEnsure(data.profiles[key]);
  const deferCount = prev.usernamePromptDeferCount ?? 0;
  if (deferCount >= USERNAME_PROMPT_MAX_DEFERRALS) {
    return { ok: false, error: "username_prompt_required" };
  }
  const nextCount = deferCount + 1;
  data.profiles[key] = { ...prev, usernamePromptDeferCount: nextCount };
  writeStore(data);
  return {
    ok: true,
    deferralsRemaining: Math.max(0, USERNAME_PROMPT_MAX_DEFERRALS - nextCount),
  };
}

export function getRecentAliases(normalizedAddress: string): string[] {
  const key = normalizedAddress.trim().toUpperCase();
  if (!key) return [];
  const raw = getRow(key).recentAliases ?? [];
  return raw.slice(0, 3);
}

export function getPlayerProfilePublicJson(normalizedAddress: string): {
  message: string;
  effectiveDisplayName: string;
  recentAliases: string[];
  customUsername: string | null;
  usernameLockedUntil: number | null;
} {
  const key = normalizedAddress.trim().toUpperCase();
  const r = getRow(key);
  const custom = r.customUsername?.trim() || null;
  const changedAt = r.usernameChangedAt ?? 0;
  const hasCustom = Boolean(custom);
  const usernameLockedUntil =
    hasCustom && changedAt > 0 ? changedAt + USERNAME_COOLDOWN_MS : null;
  return {
    message: r.message || "",
    effectiveDisplayName: getEffectivePlayerDisplayName(key),
    recentAliases: (r.recentAliases ?? []).slice(0, 3),
    customUsername: custom,
    usernameLockedUntil,
  };
}

function pushAlias(aliases: string[], name: string): string[] {
  const t = name.trim();
  if (!t) return aliases.slice(0, 3);
  const next = [t, ...aliases.filter((a) => a !== t)];
  return next.slice(0, 3);
}

function usernameTakenByOther(
  normalizedKey: string,
  lowerWanted: string,
  data: StoreFile
): boolean {
  for (const [addr, row] of Object.entries(data.profiles)) {
    if (addr === normalizedKey) continue;
    const c = row?.customUsername?.trim().toLowerCase();
    if (c && c === lowerWanted) return true;
  }
  return false;
}

export function setPlayerProfileMessage(
  normalizedAddress: string,
  message: string
): { message: string; updatedAt: number } {
  const key = normalizedAddress.trim().toUpperCase();
  if (!key) throw new Error("missing_address");
  const data = readStore();
  const prev = rowEnsure(data.profiles[key]);
  const updatedAt = Date.now();
  data.profiles[key] = { ...prev, message, updatedAt };
  writeStore(data);
  return { message, updatedAt };
}

export type SetUsernameResult =
  | {
      ok: true;
      customUsername: string;
      effectiveDisplayName: string;
      usernameLockedUntil: number;
    }
  | { ok: false; error: string };

function applyUsernameChange(
  normalizedKey: string,
  rawUsername: string,
  options: { skipCooldown: boolean }
): SetUsernameResult {
  const key = normalizedKey.trim().toUpperCase();
  if (!key) return { ok: false, error: "invalid_address" };
  if (isUsernameSetBanned(key)) return { ok: false, error: "username_set_banned" };
  const next = String(rawUsername ?? "").trim();
  const policyErr = usernameAssignmentError(next);
  if (policyErr) return { ok: false, error: policyErr };

  const data = readStore();
  if (usernameTakenByOther(key, next.toLowerCase(), data)) {
    return { ok: false, error: "username_taken" };
  }

  const prevRow = rowEnsure(data.profiles[key]);
  const prevCustom = prevRow.customUsername?.trim() || null;
  const changedAt = prevRow.usernameChangedAt ?? 0;
  const now = Date.now();

  if (prevCustom && prevCustom === next) {
    return {
      ok: true,
      customUsername: next,
      effectiveDisplayName: next,
      usernameLockedUntil: changedAt + USERNAME_COOLDOWN_MS,
    };
  }

  if (prevCustom && !options.skipCooldown) {
    if (now < changedAt + USERNAME_COOLDOWN_MS) {
      return { ok: false, error: "username_cooldown" };
    }
  }

  const prevEffective = getEffectivePlayerDisplayName(key);
  let aliases = [...(prevRow.recentAliases ?? [])];
  if (prevEffective !== next) {
    aliases = pushAlias(aliases, prevEffective);
  }

  data.profiles[key] = {
    ...prevRow,
    customUsername: next,
    usernameChangedAt: now,
    recentAliases: aliases,
  };
  writeStore(data);
  return {
    ok: true,
    customUsername: next,
    effectiveDisplayName: next,
    usernameLockedUntil: now + USERNAME_COOLDOWN_MS,
  };
}

export function trySetPlayerUsername(
  normalizedSigner: string,
  rawUsername: string,
  opts?: { skipCooldown?: boolean }
): SetUsernameResult {
  const key = normalizedSigner.trim().toUpperCase();
  if (!key) return { ok: false, error: "invalid_address" };
  return applyUsernameChange(key, rawUsername, {
    skipCooldown: Boolean(opts?.skipCooldown),
  });
}

/** Admin assigns a username to any wallet (cooldown skipped). */
export function adminSetUsernameOnTarget(
  normalizedTarget: string,
  rawUsername: string
): SetUsernameResult {
  const key = normalizedTarget.trim().toUpperCase();
  if (!key) return { ok: false, error: "invalid_address" };
  return applyUsernameChange(key, rawUsername, { skipCooldown: true });
}

/** Admin: clear custom username and reset cooldown metadata. */
export function adminClearPlayerUsername(normalizedTarget: string): {
  effectiveDisplayName: string;
  recentAliases: string[];
} {
  const key = normalizedTarget.trim().toUpperCase();
  if (!key) throw new Error("missing_address");
  const data = readStore();
  const prevRow = rowEnsure(data.profiles[key]);
  const prevEffective = getEffectivePlayerDisplayName(key);
  let aliases = [...(prevRow.recentAliases ?? [])];
  if (prevRow.customUsername?.trim()) {
    aliases = pushAlias(aliases, prevEffective);
  }
  data.profiles[key] = {
    ...prevRow,
    customUsername: null,
    usernameChangedAt: undefined,
    usernamePromptDeferCount: 0,
    recentAliases: aliases,
  };
  writeStore(data);
  return {
    effectiveDisplayName: getEffectivePlayerDisplayName(key),
    recentAliases: aliases.slice(0, 3),
  };
}
