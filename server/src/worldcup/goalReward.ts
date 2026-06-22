/**
 * World Cup soccer — Free Play Field goal rewards (FEATURE-FLAGGED, DEPRECATABLE).
 *
 * Scoring in the Free Play Field queues a small NIM payout to the credited scorer, wrapped
 * in env-tunable guards (see worldcup/adr/0002). Matches never pay.
 *
 * The decision is a pure function (`evaluateGoalReward`) so it is trivially table-tested
 * with no sockets, rooms, timers, or disk. A thin per-UTC-day store (per-wallet Paid Goal
 * count + global budget spent) backs it; `rooms.ts` calls `decideAndCommitGoalReward` from
 * the field `onGoal` hook and, when `pay` is true, enqueues the payout.
 *
 * Persistence is a small, deletable JSON (`worldcup-goal-rewards.json`), reset on UTC-day
 * rollover. This is seasonal, transitional data — acceptable per THE-LARGER-SYSTEM.
 */
import { randomInt } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { utcDayKey } from "./scoreStore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "..", "data");

/** Resolved lazily so WORLDCUP_GOAL_REWARDS_FILE (tests / ops) can override the location. */
function rewardsFile(): string {
  const override = process.env.WORLDCUP_GOAL_REWARDS_FILE?.trim();
  return override && override.length > 0
    ? path.resolve(override)
    : path.join(DATA_DIR, "worldcup-goal-rewards.json");
}

/** Tunable thresholds (resolved from env in config; passed in so the logic stays pure). */
export interface GoalRewardConfig {
  /** Minimum payout per Paid Goal (luna). */
  minRewardLuna: bigint;
  /** Maximum payout per Paid Goal (luna). */
  maxRewardLuna: bigint;
  /** Per-wallet Paid Goals per UTC day; 0 = unlimited (emergency cap when set). */
  dailyCapPerWallet: number;
  /** Global goal-reward budget per UTC day (luna); 0 = unlimited (emergency cap when set). */
  dailyBudgetLuna: bigint;
  /** Distinct players needed for full-rate payout; fewer → Solo Goal (half rate). */
  minPlayers: number;
}

/** Everything the pure evaluator needs about one goal + the current day's counters. */
export interface GoalRewardInput {
  /** Credited last-kicker wallet, or null (uncredited / goalie deflection / own goal). */
  scorerWallet: string | null;
  /** Distinct players present in the field at the moment of the goal. */
  distinctPlayersInField: number;
  /** UTC day key the goal belongs to (from `utcDayKey`). */
  utcDay: string;
  /** Paid Goals this wallet has already been credited today (0-based ordinal of the next). */
  walletPaidCount: number;
  /** Global reward luna already committed today. */
  budgetSpentLuna: bigint;
  /** Rolled payout for this goal (luna); set by `decideAndCommitGoalReward`. */
  proposedRewardLuna: bigint;
}

export type GoalRewardReason =
  | "ok"
  | "no_scorer"
  | "guest"
  | "wallet_cap"
  | "budget_exhausted";

/** Guests (temporary invite identities, `guest:{id}`) are never eligible for NIM rewards. */
export function isGuestWallet(wallet: string | null | undefined): boolean {
  return typeof wallet === "string" && wallet.startsWith("guest:");
}

export interface GoalRewardDecision {
  pay: boolean;
  reason: GoalRewardReason;
  /** Set only when `pay` is true. */
  claimId?: string;
  amountLuna?: bigint;
  recipientWallet?: string;
}

function normalizeWallet(addr: string): string {
  return String(addr).replace(/\s+/g, "").toUpperCase();
}

/**
 * Deterministic, idempotent claim id for a Paid Goal: `wc-goal-{wallet}-{utcDay}-{index}`.
 * The wallet's Paid-Goal ordinal that UTC day doubles as the daily-cap counter, so a goal
 * is never paid twice (the payout queue dedupes by claimId) and the cap falls out of the
 * same counter.
 */
export function goalRewardClaimId(
  wallet: string,
  utcDay: string,
  dailyIndex: number
): string {
  return `wc-goal-${normalizeWallet(wallet)}-${utcDay}-${dailyIndex}`;
}

/**
 * Full-rate when Contested (≥ minPlayers); Solo Goal pays floor(amount / 2).
 */
export function effectiveGoalRewardLuna(
  proposedRewardLuna: bigint,
  distinctPlayersInField: number,
  minPlayers: number
): bigint {
  if (distinctPlayersInField >= minPlayers) return proposedRewardLuna;
  return proposedRewardLuna / 2n;
}

/**
 * Uniform random payout between min and max (inclusive), capped by the remaining daily
 * budget when one is configured. Returns null when a finite budget cannot cover at least
 * the minimum payout.
 */
export function pickGoalRewardLuna(
  cfg: GoalRewardConfig,
  budgetSpentLuna: bigint
): bigint | null {
  const min = Number(cfg.minRewardLuna);
  const max = Number(cfg.maxRewardLuna);
  if (cfg.dailyBudgetLuna <= 0n) {
    return BigInt(randomInt(min, max + 1));
  }
  const remaining = cfg.dailyBudgetLuna - budgetSpentLuna;
  if (remaining < cfg.minRewardLuna) return null;
  const cap = remaining < cfg.maxRewardLuna ? remaining : cfg.maxRewardLuna;
  return BigInt(randomInt(min, Number(cap) + 1));
}

/**
 * Pure reward decision. Order of guards: a goal must have a real credited scorer, be
 * under the per-wallet daily cap (when configured), and fit inside the remaining global
 * budget (when configured). Solo goals pay half the drawn amount. Goals that fail any
 * guard still count for the leaderboard upstream — only the payout stops.
 */
export function evaluateGoalReward(
  input: GoalRewardInput,
  cfg: GoalRewardConfig
): GoalRewardDecision {
  if (!input.scorerWallet) {
    return { pay: false, reason: "no_scorer" };
  }
  // Guests (temporary invite identities) never earn NIM, even on the Free Play Field.
  if (isGuestWallet(input.scorerWallet)) {
    return { pay: false, reason: "guest" };
  }
  const amountLuna = effectiveGoalRewardLuna(
    input.proposedRewardLuna,
    input.distinctPlayersInField,
    cfg.minPlayers
  );
  if (
    cfg.dailyCapPerWallet > 0 &&
    input.walletPaidCount >= cfg.dailyCapPerWallet
  ) {
    return { pay: false, reason: "wallet_cap" };
  }
  if (
    cfg.dailyBudgetLuna > 0n &&
    input.budgetSpentLuna + amountLuna > cfg.dailyBudgetLuna
  ) {
    return { pay: false, reason: "budget_exhausted" };
  }
  const wallet = normalizeWallet(input.scorerWallet);
  return {
    pay: true,
    reason: "ok",
    claimId: goalRewardClaimId(wallet, input.utcDay, input.walletPaidCount),
    amountLuna,
    recipientWallet: wallet,
  };
}

// --- Per-UTC-day store (state + persistence) ------------------------------

interface RewardDay {
  /** UTC day key this bucket covers. */
  day: string;
  /** compact wallet -> Paid Goals credited today. */
  walletPaid: Record<string, number>;
  /** Global reward luna committed today (string for JSON BigInt safety). */
  budgetSpentLuna: string;
}

const state: RewardDay = {
  day: utcDayKey(),
  walletPaid: {},
  budgetSpentLuna: "0",
};

function ensureDataDir(): void {
  fs.mkdirSync(path.dirname(rewardsFile()), { recursive: true });
}

/** Reset the live counters when the UTC day advances (forward-only, like the score store). */
function rolloverIfNeeded(nowMs: number): void {
  const key = utcDayKey(nowMs);
  if (key <= state.day) return;
  state.day = key;
  state.walletPaid = {};
  state.budgetSpentLuna = "0";
  saveGoalRewards();
}

export function loadGoalRewards(): void {
  const file = rewardsFile();
  if (!fs.existsSync(file)) return;
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<RewardDay>;
    if (typeof raw.day === "string") state.day = raw.day;
    state.walletPaid = {};
    for (const [wallet, n] of Object.entries(raw.walletPaid ?? {})) {
      const v = Math.max(0, Math.floor(Number(n) || 0));
      if (wallet && v > 0) state.walletPaid[normalizeWallet(wallet)] = v;
    }
    state.budgetSpentLuna =
      typeof raw.budgetSpentLuna === "string" && /^\d+$/.test(raw.budgetSpentLuna)
        ? raw.budgetSpentLuna
        : "0";
    rolloverIfNeeded(Date.now());
    console.log(`[worldcup] Loaded goal rewards from ${file} (day ${state.day})`);
  } catch (err) {
    console.error("[worldcup] Failed to load goal rewards:", err);
  }
}

export function saveGoalRewards(): void {
  try {
    ensureDataDir();
    const file = rewardsFile();
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state), "utf8");
    fs.renameSync(tmp, file);
  } catch (err) {
    console.error("[worldcup] Failed to save goal rewards:", err);
  }
}

/**
 * Stateful entry point for `rooms.ts`: roll the day if needed, read the live counters, run
 * the pure evaluator, and — when it decides to pay — commit the wallet count + budget spend
 * before returning. Idempotency past commit is the payout queue's job (claimId dedupe).
 */
export function decideAndCommitGoalReward(
  args: { scorerWallet: string | null; distinctPlayersInField: number },
  cfg: GoalRewardConfig,
  nowMs: number = Date.now()
): GoalRewardDecision {
  rolloverIfNeeded(nowMs);
  const utcDay = state.day;
  const wallet = args.scorerWallet ? normalizeWallet(args.scorerWallet) : null;
  const walletPaidCount = wallet ? (state.walletPaid[wallet] ?? 0) : 0;
  const budgetSpentLuna = BigInt(state.budgetSpentLuna);
  if (!wallet) {
    return { pay: false, reason: "no_scorer" };
  }
  if (cfg.dailyCapPerWallet > 0 && walletPaidCount >= cfg.dailyCapPerWallet) {
    return { pay: false, reason: "wallet_cap" };
  }
  const proposedRewardLuna = pickGoalRewardLuna(cfg, budgetSpentLuna);
  if (!proposedRewardLuna) {
    return { pay: false, reason: "budget_exhausted" };
  }
  const decision = evaluateGoalReward(
    {
      scorerWallet: wallet,
      distinctPlayersInField: args.distinctPlayersInField,
      utcDay,
      walletPaidCount,
      budgetSpentLuna,
      proposedRewardLuna,
    },
    cfg
  );
  if (decision.pay && wallet && decision.amountLuna !== undefined) {
    state.walletPaid[wallet] = walletPaidCount + 1;
    state.budgetSpentLuna = (
      BigInt(state.budgetSpentLuna) + decision.amountLuna
    ).toString();
    saveGoalRewards();
  }
  return decision;
}

/** Test-only: clear in-memory counters. Optional `dayKey` pins the UTC day bucket. */
export function __resetGoalRewardsForTests(dayKey?: string): void {
  state.day = dayKey ?? utcDayKey();
  state.walletPaid = {};
  state.budgetSpentLuna = "0";
}
