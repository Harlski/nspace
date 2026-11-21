import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getAdminRuntimeSettings } from "./adminRuntimeSettingsStore.js";
import { isAdmin } from "./config.js";
import { isMiningBanned, setMiningBanned } from "./moderationStore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const MINING_CHALLENGE_WINDOW_MS = 15 * 60 * 1000;
export const MINING_CHALLENGE_IMMUNITY_MS = 30 * 60 * 1000;
export const MINING_CHALLENGE_ROLLING_MS = 24 * 60 * 60 * 1000;
export const MINING_CHALLENGE_PULL_IN_MS = 15 * 60 * 1000;
export const MINING_CHALLENGE_HOT_WALLETS = 3;

export const BLOCK_CLAIM_MSG_MINING_CHALLENGE =
  "Mining is disabled on this account.";

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type BeginRow = { ip: string; wallet: string; at: number };
type ChallengeRow = {
  openedAt: number;
  deadline: number;
  source: "ip" | "person" | "self";
  by?: string;
};
type ImmunityRow = { until: number };
type GrantRow = { at: number; by?: string };
type StoreFile = {
  begins: BeginRow[];
  challenges: Record<string, ChallengeRow>;
  immunity: Record<string, ImmunityRow>;
  grants: Record<string, GrantRow>;
};

export type CaptchaVerdict = "pass" | "fail" | "unreachable";

type TestHooks = {
  captchaReachable: boolean | null;
  verify: ((token: string, ip: string | null) => Promise<CaptchaVerdict>) | null;
};

const testHooks: TestHooks = { captchaReachable: null, verify: null };
let reachableAfterProbe = true;

function emptyStore(): StoreFile {
  return { begins: [], challenges: {}, immunity: {}, grants: {} };
}

function storeFile(): string {
  const override = process.env.MINING_CHALLENGE_STORE_FILE;
  return override
    ? path.resolve(override)
    : path.join(__dirname, "..", "data", "mining-challenges.json");
}

function normalizeWallet(address: string): string {
  return String(address ?? "")
    .replace(/\s+/g, "")
    .trim()
    .toUpperCase();
}

export function normalizeClientIp(raw: string | null | undefined): string | null {
  let s = String(raw ?? "").trim().toLowerCase();
  if (!s) return null;
  if (s.startsWith("::ffff:")) s = s.slice("::ffff:".length);
  const zone = s.indexOf("%");
  if (zone >= 0) s = s.slice(0, zone);
  if (!s.includes(".") && !s.includes(":")) return null;
  return s;
}

function isLoopback(ip: string | null): boolean {
  return ip === "127.0.0.1" || ip === "::1";
}

/** Address from the trusted reverse proxy. A client-supplied header is ignored unless the peer is loopback. */
export function clientIpFromProxyRequest(input: {
  peer: string | null | undefined;
  xRealIp?: string | null;
  xForwardedFor?: string | null;
}): string | null {
  const peer = normalizeClientIp(input.peer);
  if (!isLoopback(peer)) return peer;
  const real = normalizeClientIp(input.xRealIp);
  if (real && !isLoopback(real)) return real;
  const forwarded = String(input.xForwardedFor ?? "").split(",")[0];
  const first = normalizeClientIp(forwarded);
  if (first && !isLoopback(first)) return first;
  return peer;
}

export function turnstileSiteKeyForClient(): string | null {
  const key = process.env.TURNSTILE_SITE_KEY?.trim();
  return key || null;
}

function secretConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY?.trim());
}

export function isCaptchaReachable(): boolean {
  if (testHooks.captchaReachable !== null) return testHooks.captchaReachable;
  if (!secretConfigured()) return false;
  return reachableAfterProbe;
}

export function setMiningChallengeTestHooks(hooks: {
  captchaReachable?: boolean | null;
  verify?: TestHooks["verify"];
}): void {
  if ("captchaReachable" in hooks) {
    testHooks.captchaReachable = hooks.captchaReachable ?? null;
  }
  if ("verify" in hooks) testHooks.verify = hooks.verify ?? null;
}

export function resetMiningChallengeForTests(): void {
  testHooks.captchaReachable = null;
  testHooks.verify = null;
  reachableAfterProbe = true;
  writeStore(emptyStore());
}

function readStore(): StoreFile {
  const file = storeFile();
  if (!fs.existsSync(file)) return emptyStore();
  try {
    const j = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<StoreFile>;
    return {
      begins: Array.isArray(j.begins) ? j.begins : [],
      challenges: j.challenges && typeof j.challenges === "object" ? j.challenges : {},
      immunity: j.immunity && typeof j.immunity === "object" ? j.immunity : {},
      grants: j.grants && typeof j.grants === "object" ? j.grants : {},
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(data: StoreFile): void {
  const file = storeFile();
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data), "utf8");
  fs.renameSync(tmp, file);
}

export function isMiningChallengeEnabled(): boolean {
  return getAdminRuntimeSettings().miningChallengeEnabled === true;
}

/** Admins may open a Mining Challenge on their own wallet from the in-game Admin menu. */
export function isMiningChallengeAdminSelfCheckEnabled(): boolean {
  return getAdminRuntimeSettings().miningChallengeAdminSelfCheck !== false;
}

function challengeEnforced(row: ChallengeRow): boolean {
  if (row.source === "self") return isMiningChallengeAdminSelfCheckEnabled();
  return isMiningChallengeEnabled();
}

function sweep(data: StoreFile, now: number): boolean {
  let dirty = false;
  const begins = data.begins.filter((row) => now - row.at < MINING_CHALLENGE_ROLLING_MS);
  if (begins.length !== data.begins.length) {
    data.begins = begins;
    dirty = true;
  }
  for (const [wallet, row] of Object.entries(data.immunity)) {
    if (row.until <= now) {
      delete data.immunity[wallet];
      dirty = true;
    }
  }
  for (const [wallet, row] of Object.entries(data.challenges)) {
    if (row.deadline > now) continue;
    delete data.challenges[wallet];
    dirty = true;
    if (
      row.source !== "self" &&
      isMiningChallengeEnabled() &&
      !isMiningBanned(wallet)
    ) {
      setMiningBanned(wallet, true, "mining-challenge", "Unanswered Mining Challenge");
    }
  }
  return dirty;
}

function load(now: number): StoreFile {
  const data = readStore();
  if (sweep(data, now)) writeStore(data);
  return data;
}

function distinctWallets(data: StoreFile, ip: string, now: number): Set<string> {
  const wallets = new Set<string>();
  for (const row of data.begins) {
    if (row.ip === ip && now - row.at < MINING_CHALLENGE_ROLLING_MS) wallets.add(row.wallet);
  }
  return wallets;
}

function immune(data: StoreFile, wallet: string, now: number): boolean {
  const row = data.immunity[wallet];
  return Boolean(row && row.until > now);
}

function eligible(data: StoreFile, wallet: string, now: number): boolean {
  if (!wallet) return false;
  if (isMiningBanned(wallet)) return false;
  if (data.challenges[wallet] && data.challenges[wallet].deadline > now) return false;
  if (immune(data, wallet, now)) return false;
  return true;
}

function openHold(
  data: StoreFile,
  wallet: string,
  now: number,
  source: "ip" | "person" | "self",
  by?: string
): void {
  data.challenges[wallet] = {
    openedAt: now,
    deadline: now + MINING_CHALLENGE_WINDOW_MS,
    source,
    ...(by ? { by } : {}),
  };
}

export function miningClaimDenialReason(address: string, now = Date.now()): string | null {
  const wallet = normalizeWallet(address);
  if (!wallet) return null;
  const data = load(now);
  const row = data.challenges[wallet];
  if (row && row.deadline > now && challengeEnforced(row)) {
    return BLOCK_CLAIM_MSG_MINING_CHALLENGE;
  }
  return null;
}

export function listOpenMiningChallengeWallets(now = Date.now()): string[] {
  const data = load(now);
  return Object.entries(data.challenges)
    .filter(([, row]) => row.deadline > now && challengeEnforced(row))
    .map(([wallet]) => wallet);
}

export type BeginDecision =
  | { accepted: true }
  | { accepted: false; denial: string };

/**
 * Record an accepted gameplay begin, or refuse it when the address is already hot.
 * A tutorial faucet mine is ignored. The begin that first makes an address hot is accepted,
 * and that wallet's in-flight claim is then blocked by the hold this function opens.
 */
export function considerGameplayBegin(input: {
  wallet: string;
  ip: string | null;
  now?: number;
  tutorial: boolean;
}): BeginDecision {
  const now = input.now ?? Date.now();
  if (!isMiningChallengeEnabled()) return { accepted: true };
  if (input.tutorial) return { accepted: true };
  const wallet = normalizeWallet(input.wallet);
  const ip = normalizeClientIp(input.ip);
  if (!wallet || !ip) return { accepted: true };

  const data = load(now);
  const hotBefore = distinctWallets(data, ip, now).size >= MINING_CHALLENGE_HOT_WALLETS;
  if (hotBefore && isCaptchaReachable() && eligible(data, wallet, now)) {
    openHold(data, wallet, now, "ip");
    writeStore(data);
    return { accepted: false, denial: BLOCK_CLAIM_MSG_MINING_CHALLENGE };
  }

  data.begins.push({ ip, wallet, at: now });
  if (isCaptchaReachable() && distinctWallets(data, ip, now).size >= MINING_CHALLENGE_HOT_WALLETS) {
    const recent = new Set<string>();
    for (const row of data.begins) {
      if (row.ip === ip && now - row.at <= MINING_CHALLENGE_PULL_IN_MS) recent.add(row.wallet);
    }
    for (const candidate of recent) {
      if (eligible(data, candidate, now)) openHold(data, candidate, now, "ip");
    }
  }
  writeStore(data);
  return { accepted: true };
}

export type OpenChallengeResult =
  | { ok: true; wallet: string }
  | { ok: false; error: string };

export function viewerMayOfferMiningChallenge(actor: string, target: string): boolean {
  const a = normalizeWallet(actor);
  const t = normalizeWallet(target);
  if (!isMiningChallengeEnabled()) return false;
  if (!a || !t || a === t) return false;
  if (isAdmin(a)) return true;
  const data = readStore();
  if (!data.grants[a]) return false;
  if (isAdmin(t)) return false;
  return true;
}

export function openMiningChallengeByPerson(input: {
  actor: string;
  target: string;
  now?: number;
}): OpenChallengeResult {
  const now = input.now ?? Date.now();
  const actor = normalizeWallet(input.actor);
  const target = normalizeWallet(input.target);
  if (!actor || !target) return { ok: false, error: "invalid_address" };
  if (actor === target) return { ok: false, error: "cannot_target_self" };
  const data = load(now);
  const admin = isAdmin(actor);
  if (!admin && !data.grants[actor]) return { ok: false, error: "forbidden" };
  if (!admin && isAdmin(target)) return { ok: false, error: "cannot_target_admin" };
  if (!isMiningChallengeEnabled()) return { ok: false, error: "challenge_disabled" };
  if (!isCaptchaReachable()) return { ok: false, error: "captcha_unavailable" };
  if (isMiningBanned(target)) return { ok: false, error: "mining_restricted" };
  if (data.challenges[target] && data.challenges[target].deadline > now) {
    return { ok: false, error: "already_challenged" };
  }
  if (immune(data, target, now)) return { ok: false, error: "challenge_immune" };
  openHold(data, target, now, "person", actor);
  writeStore(data);
  return { ok: true, wallet: target };
}

/**
 * Open a Mining Challenge on the acting admin's own wallet so they can try the captcha.
 * A self check does not become a Mining Restriction if it goes unanswered.
 */
export function openMiningChallengeForSelf(input: {
  actor: string;
  now?: number;
}): OpenChallengeResult {
  const now = input.now ?? Date.now();
  const actor = normalizeWallet(input.actor);
  if (!actor) return { ok: false, error: "invalid_address" };
  if (!isAdmin(actor)) return { ok: false, error: "forbidden" };
  if (!isMiningChallengeAdminSelfCheckEnabled()) {
    return { ok: false, error: "self_check_disabled" };
  }
  if (!isCaptchaReachable()) return { ok: false, error: "captcha_unavailable" };
  if (isMiningBanned(actor)) return { ok: false, error: "mining_restricted" };
  const data = load(now);
  const existing = data.challenges[actor];
  if (existing && existing.deadline > now && existing.source !== "self") {
    return { ok: false, error: "already_challenged" };
  }
  openHold(data, actor, now, "self", actor);
  writeStore(data);
  return { ok: true, wallet: actor };
}

/** Remove an admin's own self-check without turning it into a Mining Restriction. */
export function clearMiningChallengeForSelf(input: {
  actor: string;
  now?: number;
}): OpenChallengeResult {
  const now = input.now ?? Date.now();
  const actor = normalizeWallet(input.actor);
  if (!actor) return { ok: false, error: "invalid_address" };
  if (!isAdmin(actor)) return { ok: false, error: "forbidden" };
  const data = load(now);
  const existing = data.challenges[actor];
  if (!existing || existing.source !== "self" || existing.deadline <= now) {
    return { ok: false, error: "not_in_challenge" };
  }
  delete data.challenges[actor];
  writeStore(data);
  return { ok: true, wallet: actor };
}

export function setChallengeGrant(
  target: string,
  granted: boolean,
  actor?: string,
  now = Date.now()
): boolean {
  const wallet = normalizeWallet(target);
  if (!wallet) return false;
  const data = load(now);
  if (granted) {
    data.grants[wallet] = { at: now, ...(actor ? { by: normalizeWallet(actor) } : {}) };
  } else {
    delete data.grants[wallet];
  }
  writeStore(data);
  return true;
}

export function listChallengeGrants(now = Date.now()): Array<{
  address: string;
  at: number;
  by?: string;
}> {
  const data = load(now);
  return Object.entries(data.grants)
    .map(([address, row]) => ({
      address,
      at: row.at,
      ...(row.by ? { by: row.by } : {}),
    }))
    .sort((a, b) => b.at - a.at);
}

export async function passMiningChallenge(input: {
  wallet: string;
  token: string;
  ip?: string | null;
  now?: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const now = input.now ?? Date.now();
  const wallet = normalizeWallet(input.wallet);
  if (!wallet) return { ok: false, error: "invalid_address" };
  const data = load(now);
  const row = data.challenges[wallet];
  if (!row || row.deadline <= now) return { ok: false, error: "not_in_challenge" };
  const token = String(input.token ?? "").trim();
  if (!token) return { ok: false, error: "invalid_token" };
  const verdict = await verifyCaptcha(token, normalizeClientIp(input.ip ?? null));
  if (verdict === "unreachable") return { ok: false, error: "captcha_unavailable" };
  if (verdict !== "pass") return { ok: false, error: "invalid_token" };
  delete data.challenges[wallet];
  data.immunity[wallet] = { until: now + MINING_CHALLENGE_IMMUNITY_MS };
  writeStore(data);
  return { ok: true };
}

async function verifyCaptcha(token: string, ip: string | null): Promise<CaptchaVerdict> {
  if (testHooks.verify) {
    const verdict = await testHooks.verify(token, ip);
    if (verdict === "unreachable") reachableAfterProbe = false;
    else reachableAfterProbe = true;
    return verdict;
  }
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return "unreachable";
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);
    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      reachableAfterProbe = false;
      return "unreachable";
    }
    reachableAfterProbe = true;
    const j = (await res.json()) as { success?: boolean };
    return j.success === true ? "pass" : "fail";
  } catch {
    reachableAfterProbe = false;
    return "unreachable";
  }
}
