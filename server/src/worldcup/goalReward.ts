/**
 * World Cup soccer — Free Play Field goal rewards (FEATURE-FLAGGED, DEPRECATABLE).
 *
 * Scoring in the Free Play Field queues a small NIM payout to the credited scorer, wrapped
 * in layered anti-farming guards (see worldcup/adr/0002). Matches never pay.
 *
 * The decision is a pure function (`evaluateGoalReward`) so it is trivially table-tested
 * with no sockets, rooms, timers, or disk. A thin per-UTC-day store (per-wallet Paid Goal
 * count + global budget spent) backs it; `rooms.ts` calls `decideAndCommitGoalReward` from
 * the field `onGoal` hook and, when `pay` is true, enqueues the payout.
 *
 * Persistence is a small, deletable JSON (`worldcup-goal-rewards.json`), reset on UTC-day
 * rollover. This is seasonal, transitional data — acceptable per THE-LARGER-SYSTEM.
 */
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
  /** Payout per Paid Goal (luna). */
  rewardLuna: bigint;
  /** Per-wallet Paid Goals per UTC day. */
  dailyCapPerWallet: number;
  /** Global goal-reward budget per UTC day (luna). */
  dailyBudgetLuna: bigint;
  /** Minimum distinct players in the field for a goal to be Contested. */
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
}

export type GoalRewardReason =
  | "ok"
  | "no_scorer"
  | "not_contested"
  | "wallet_cap"
  | "budget_exhausted";

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
 * Pure reward decision. Order of guards: a goal must have a real credited scorer, be
 * Contested, be under the per-wallet daily cap, and fit inside the remaining global budget.
 * Goals that fail any guard still count for the leaderboard upstream — only the payout
 * stops.
 */
export function evaluateGoalReward(
  input: GoalRewardInput,
  cfg: GoalRewardConfig
): GoalRewardDecision {
  if (!input.scorerWallet) {
    return { pay: false, reason: "no_scorer" };
  }
  if (input.distinctPlayersInField < cfg.minPlayers) {
    return { pay: false, reason: "not_contested" };
  }
  if (input.walletPaidCount >= cfg.dailyCapPerWallet) {
    return { pay: false, reason: "wallet_cap" };
  }
  if (input.budgetSpentLuna + cfg.rewardLuna > cfg.dailyBudgetLuna) {
    return { pay: false, reason: "budget_exhausted" };
  }
  const wallet = normalizeWallet(input.scorerWallet);
  return {
    pay: true,
    reason: "ok",
    claimId: goalRewardClaimId(wallet, input.utcDay, input.walletPaidCount),
    amountLuna: cfg.rewardLuna,
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
  const decision = evaluateGoalReward(
    {
      scorerWallet: wallet,
      distinctPlayersInField: args.distinctPlayersInField,
      utcDay,
      walletPaidCount,
      budgetSpentLuna: BigInt(state.budgetSpentLuna),
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

/** Test-only: clear in-memory counters. */
export function __resetGoalRewardsForTests(): void {
  state.day = utcDayKey();
  state.walletPaid = {};
  state.budgetSpentLuna = "0";
}
