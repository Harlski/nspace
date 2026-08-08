/**
 * Daily Earn Allowance — durable UTC-day spent counter + commit helper.
 * See docs/adr/0014-player-level-daily-earn-allowance.md.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  applyDailyEarnAllowance,
  dailyEarnAllowanceLuna,
  playerLevelFromPoints,
} from "./playerLevel.js";
import { enqueuePayIntent, type PayIntent } from "./payoutGateway.js";
import { utcDayKey } from "./worldcup/scoreStore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");

function allowanceFile(): string {
  const override = process.env.DAILY_EARN_ALLOWANCE_FILE?.trim();
  return override && override.length > 0
    ? path.resolve(override)
    : path.join(DATA_DIR, "daily-earn-allowance.json");
}

type EarnDay = {
  day: string;
  /** Wallet → gameplay luna committed today toward Daily Earn Allowance. */
  spentLunaByWallet: Record<string, string>;
};

let state: EarnDay = {
  day: utcDayKey(),
  spentLunaByWallet: {},
};

function normalizeWallet(addr: string): string {
  return String(addr).replace(/\s+/g, "").toUpperCase();
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function rolloverIfNeeded(nowMs: number): void {
  const key = utcDayKey(nowMs);
  if (key <= state.day) return;
  state.day = key;
  state.spentLunaByWallet = {};
  saveDailyEarnAllowance();
}

export function loadDailyEarnAllowance(): void {
  const file = allowanceFile();
  if (!fs.existsSync(file)) return;
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<EarnDay>;
    if (typeof raw.day === "string") state.day = raw.day;
    state.spentLunaByWallet = {};
    for (const [wallet, n] of Object.entries(raw.spentLunaByWallet ?? {})) {
      if (wallet && typeof n === "string" && /^\d+$/.test(n) && n !== "0") {
        state.spentLunaByWallet[normalizeWallet(wallet)] = n;
      }
    }
    rolloverIfNeeded(Date.now());
    console.log(
      `[daily-earn] Loaded allowance from ${file} (day ${state.day})`
    );
  } catch (err) {
    console.error("[daily-earn] Failed to load allowance:", err);
  }
}

export function saveDailyEarnAllowance(): void {
  try {
    ensureDataDir();
    const file = allowanceFile();
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state), "utf8");
    fs.renameSync(tmp, file);
  } catch (err) {
    console.error("[daily-earn] Failed to save allowance:", err);
  }
}

export type GameplayEarnDecision = {
  payLuna: bigint;
  allowanceBound: boolean;
  level: number;
  remainingAfterLuna: bigint | null;
};

/** Remaining Daily Earn Allowance in luna (`null` = uncapped). Does not commit. */
export function peekDailyEarnRemaining(args: {
  wallet: string;
  achievementPoints: number;
  nowMs?: number;
}): { level: number; remainingLuna: bigint | null } {
  const nowMs = args.nowMs ?? Date.now();
  rolloverIfNeeded(nowMs);
  const wallet = normalizeWallet(args.wallet);
  const level = playerLevelFromPoints(args.achievementPoints);
  const ceilingLuna = dailyEarnAllowanceLuna(level);
  if (ceilingLuna === null) {
    return { level, remainingLuna: null };
  }
  const spentLuna = BigInt(state.spentLunaByWallet[wallet] ?? "0");
  const remaining = ceilingLuna > spentLuna ? ceilingLuna - spentLuna : 0n;
  return { level, remainingLuna: remaining };
}

/**
 * Resolve Level from Achievement Points, apply Daily Earn Allowance partial-fill,
 * and commit spent luna when anything is paid.
 */
export function decideAndCommitGameplayEarn(args: {
  wallet: string;
  proposedLuna: bigint;
  achievementPoints: number;
  nowMs?: number;
}): GameplayEarnDecision {
  const nowMs = args.nowMs ?? Date.now();
  rolloverIfNeeded(nowMs);
  const wallet = normalizeWallet(args.wallet);
  const level = playerLevelFromPoints(args.achievementPoints);
  const ceilingLuna = dailyEarnAllowanceLuna(level);
  const spentLuna = BigInt(state.spentLunaByWallet[wallet] ?? "0");
  const decision = applyDailyEarnAllowance({
    proposedLuna: args.proposedLuna,
    spentLuna,
    ceilingLuna,
  });
  if (decision.payLuna > 0n) {
    state.spentLunaByWallet[wallet] = (spentLuna + decision.payLuna).toString();
    saveDailyEarnAllowance();
  }
  return {
    payLuna: decision.payLuna,
    allowanceBound: decision.allowanceBound,
    level,
    remainingAfterLuna: decision.remainingAfterLuna,
  };
}

/**
 * Apply Daily Earn Allowance then enqueue a gameplay Pay-Intent (if any luna remains).
 * Tutorial faucet and admin grants must call {@link enqueuePayIntent} directly instead.
 */
export function enqueueGameplayPayIntent(
  opts: PayIntent,
  achievementPoints: number,
  nowMs: number = Date.now()
): GameplayEarnDecision {
  const proposed =
    opts.amountLuna !== undefined && opts.amountLuna > 0n
      ? opts.amountLuna
      : 0n;
  const decision = decideAndCommitGameplayEarn({
    wallet: opts.recipientAddress,
    proposedLuna: proposed,
    achievementPoints,
    nowMs,
  });
  if (decision.payLuna > 0n) {
    enqueuePayIntent({
      ...opts,
      amountLuna: decision.payLuna,
    });
  }
  return decision;
}

/** Test-only: clear in-memory counters. Optional `dayKey` pins the UTC day bucket. */
export function __resetDailyEarnAllowanceForTests(dayKey?: string): void {
  state.day = dayKey ?? utcDayKey();
  state.spentLunaByWallet = {};
}
