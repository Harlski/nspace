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

export type TutorialLastStep = "mine" | "pay" | "exit";

export type TutorialSession = {
  mineSlotTile?: string;
  mineCompletedAt?: number;
  doorPaidAt?: number;
  gateUnstuckAt?: number;
  lastStep?: TutorialLastStep;
};

export type TutorialProfileRow = {
  tutorialCompletedAt?: number;
  tutorialAbandonedAt?: number;
  tutorialSession?: TutorialSession;
};

type Row = {
  message: string;
  updatedAt: number;
  customUsername?: string | null;
  usernameChangedAt?: number;
  /** Older "Not now" count. Kept on disk. It no longer grants entry. */
  usernamePromptDeferCount?: number;
  recentAliases?: string[];
  tutorialCompletedAt?: number;
  tutorialAbandonedAt?: number;
  tutorialSession?: TutorialSession;
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
    tutorialCompletedAt:
      typeof base?.tutorialCompletedAt === "number" &&
      Number.isFinite(base.tutorialCompletedAt)
        ? base.tutorialCompletedAt
        : undefined,
    tutorialAbandonedAt:
      typeof base?.tutorialAbandonedAt === "number" &&
      Number.isFinite(base.tutorialAbandonedAt)
        ? base.tutorialAbandonedAt
        : undefined,
    tutorialSession: sanitizeTutorialSession(base?.tutorialSession),
  };
}

function sanitizeTutorialSession(raw: unknown): TutorialSession | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as TutorialSession;
  const out: TutorialSession = {};
  if (typeof o.mineSlotTile === "string" && o.mineSlotTile.trim()) {
    out.mineSlotTile = o.mineSlotTile.trim();
  }
  if (typeof o.mineCompletedAt === "number" && Number.isFinite(o.mineCompletedAt)) {
    out.mineCompletedAt = o.mineCompletedAt;
  }
  if (typeof o.doorPaidAt === "number" && Number.isFinite(o.doorPaidAt)) {
    out.doorPaidAt = o.doorPaidAt;
  }
  if (typeof o.gateUnstuckAt === "number" && Number.isFinite(o.gateUnstuckAt)) {
    out.gateUnstuckAt = o.gateUnstuckAt;
  }
  if (o.lastStep === "mine" || o.lastStep === "pay" || o.lastStep === "exit") {
    out.lastStep = o.lastStep;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Profile rows are keyed by the compact wallet (no spaces), matching login `normalizeWalletId`. */
function profileWalletKey(normalizedAddress: string): string {
  return String(normalizedAddress ?? "")
    .replace(/\s+/g, "")
    .trim()
    .toUpperCase();
}

function tutorialWalletKey(normalizedAddress: string): string {
  return profileWalletKey(normalizedAddress);
}

export function getTutorialProfileRow(normalizedAddress: string): TutorialProfileRow {
  const key = tutorialWalletKey(normalizedAddress);
  if (!key) return {};
  const r = getRow(key);
  return {
    tutorialCompletedAt: r.tutorialCompletedAt,
    tutorialAbandonedAt: r.tutorialAbandonedAt,
    tutorialSession: r.tutorialSession,
  };
}

export function patchTutorialProfileRow(
  normalizedAddress: string,
  patch: Partial<TutorialProfileRow>
): void {
  const key = tutorialWalletKey(normalizedAddress);
  if (!key) return;
  const data = readStore();
  const prev = rowEnsure(data.profiles[key]);
  data.profiles[key] = {
    ...prev,
    ...(patch.tutorialCompletedAt !== undefined
      ? { tutorialCompletedAt: patch.tutorialCompletedAt }
      : {}),
    ...(patch.tutorialAbandonedAt !== undefined
      ? { tutorialAbandonedAt: patch.tutorialAbandonedAt }
      : {}),
    ...(patch.tutorialSession !== undefined
      ? { tutorialSession: patch.tutorialSession }
      : {}),
  };
  writeStore(data);
}

/** Wipe tutorial session / completion so the learner restarts at Mine (stage 1). */
export function clearTutorialProgress(normalizedAddress: string): void {
  const key = tutorialWalletKey(normalizedAddress);
  if (!key) return;
  const data = readStore();
  const prev = rowEnsure(data.profiles[key]);
  const next: Row = { ...prev };
  delete next.tutorialCompletedAt;
  delete next.tutorialAbandonedAt;
  delete next.tutorialSession;
  data.profiles[key] = next;
  writeStore(data);
}

/** Mine slots assigned to other wallets (for collision-free assignment). */
export function listTutorialMineSlotAssignments(excludeWallet: string): string[] {
  const exclude = tutorialWalletKey(excludeWallet);
  const out: string[] = [];
  const store = readStore();
  for (const [addr, row] of Object.entries(store.profiles)) {
    if (addr === exclude) continue;
    const slot = row?.tutorialSession?.mineSlotTile;
    if (slot) out.push(slot);
  }
  return out;
}

/** All wallets that have set a custom username, with that username. */
export function listKnownPlayerUsernames(): Array<{
  wallet: string;
  username: string;
}> {
  const out: Array<{ wallet: string; username: string }> = [];
  const store = readStore();
  for (const [addr, row] of Object.entries(store.profiles)) {
    const c = row?.customUsername?.trim();
    if (c) out.push({ wallet: profileWalletKey(addr), username: c });
  }
  return out;
}

/**
 * Resolve a custom username to its owning wallet (case-insensitive). Returns the
 * normalized wallet address, or null when no wallet has claimed that username.
 * Custom usernames are globally unique, so at most one match exists. Used by the
 * whisper `/w name` command, which only targets players with a custom username.
 */
export function findWalletByCustomUsername(name: string): string | null {
  const wanted = String(name ?? "").trim().toLowerCase();
  if (!wanted) return null;
  const store = readStore();
  for (const [addr, row] of Object.entries(store.profiles)) {
    const c = row?.customUsername?.trim();
    if (c && c.toLowerCase() === wanted) return profileWalletKey(addr);
  }
  return null;
}

export function getPlayerProfileMessage(normalizedAddress: string): string {
  const key = profileWalletKey(normalizedAddress);
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
  const key = profileWalletKey(normalizedAddress);
  if (!key) return "";
  const r = getRow(key);
  const c = r.customUsername?.trim();
  if (c) return c;
  return walletDisplayName(key);
}

export function playerHasCustomUsername(normalizedAddress: string): boolean {
  const key = profileWalletKey(normalizedAddress);
  if (!key) return false;
  return Boolean(getRow(key).customUsername?.trim());
}

export type UsernamePromptStatus = {
  needsPrompt: boolean;
  deferCount: number;
  deferralsRemaining: number;
  mustSetUsername: boolean;
};

/**
 * Login prompt: a wallet without a custom username must set one before play.
 * Stored defer counts no longer grant entry. A username-set ban cannot choose a name, so it skips the prompt.
 */
export function getUsernamePromptStatus(normalizedAddress: string): UsernamePromptStatus {
  const key = profileWalletKey(normalizedAddress);
  if (!key || playerHasCustomUsername(key) || isUsernameSetBanned(key)) {
    return {
      needsPrompt: false,
      deferCount: 0,
      deferralsRemaining: 0,
      mustSetUsername: false,
    };
  }
  const deferCount = getRow(key).usernamePromptDeferCount ?? 0;
  return {
    needsPrompt: true,
    deferCount,
    deferralsRemaining: 0,
    mustSetUsername: true,
  };
}

/** True when this wallet must not enter the world until it has a custom username. */
export function walletRequiresUsername(normalizedAddress: string): boolean {
  const key = profileWalletKey(normalizedAddress);
  if (!key || key.startsWith("GUEST:")) return false;
  if (isUsernameSetBanned(key)) return false;
  return !playerHasCustomUsername(key);
}

export function recordUsernamePromptDeferral(
  normalizedAddress: string
): { ok: true; deferralsRemaining: number } | { ok: false; error: string } {
  const key = profileWalletKey(normalizedAddress);
  if (!key) return { ok: false, error: "invalid_address" };
  if (playerHasCustomUsername(key)) return { ok: false, error: "username_already_set" };
  return { ok: false, error: "username_prompt_required" };
}

export function getRecentAliases(normalizedAddress: string): string[] {
  const key = profileWalletKey(normalizedAddress);
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
  const key = profileWalletKey(normalizedAddress);
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
  const key = profileWalletKey(normalizedAddress);
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
  const key = profileWalletKey(normalizedKey);
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
  const key = profileWalletKey(normalizedSigner);
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
  const key = profileWalletKey(normalizedTarget);
  if (!key) return { ok: false, error: "invalid_address" };
  return applyUsernameChange(key, rawUsername, { skipCooldown: true });
}

/** Admin: clear custom username and reset cooldown metadata. */
export function adminClearPlayerUsername(normalizedTarget: string): {
  effectiveDisplayName: string;
  recentAliases: string[];
} {
  const key = profileWalletKey(normalizedTarget);
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
