import type { AchievementEventKey } from "./achievementDefinitions.js";

export type MatchParticipantResult = "win" | "loss" | "draw";

export type MatchWinReason = "score" | "opponent_left";

/** Minimum golden-phase elapsed time before Golden Patience (not a first-minute golden). */
export const GOLDEN_PATIENCE_MIN_ELAPSED_MS = 60_000;

export type MatchAchievementParticipantInput = {
  result: MatchParticipantResult;
  /** Present when `result` is `win` or `loss`. */
  winReason?: MatchWinReason;
  goalsScored: number;
  goalsConceded: number;
  /** Largest goal deficit faced at any point (0 when never trailing). */
  maxTrailingDeficit: number;
  priorWinStreak: number;
  /** True when the winning goal ended the Match during Golden Goal. */
  goldenGoalWin?: boolean;
  /** Elapsed golden-phase ms when the winning golden goal landed. */
  goldenElapsedMsAtWin?: number;
  /** True when regulation ended tied and the Match entered golden phase. */
  enteredGoldenPhase?: boolean;
  /** True when this side scored at least one own goal during the Match. */
  scoredOwnGoal?: boolean;
};

export type MatchEndParticipantInput = MatchAchievementParticipantInput & {
  wallet: string;
};

export type MatchAchievementEffect = {
  /** Always 1 for eligible Match participants. */
  matchesPlayedDelta: number;
  matchesWonDelta: number;
  newWinStreak: number;
  events: AchievementEventKey[];
};

const GOAL_PEAK_THRESHOLDS: ReadonlyArray<{
  minGoals: number;
  event: AchievementEventKey;
}> = [
  { minGoals: 1, event: "match_goals_peak_1" },
  { minGoals: 2, event: "match_goals_peak_2" },
  { minGoals: 3, event: "match_goals_peak_3" },
  { minGoals: 5, event: "match_goals_peak_5" },
  { minGoals: 10, event: "match_goals_peak_10" },
];

function peakGoalEvents(goalsScored: number): AchievementEventKey[] {
  const events: AchievementEventKey[] = [];
  for (const peak of GOAL_PEAK_THRESHOLDS) {
    if (goalsScored >= peak.minGoals) events.push(peak.event);
  }
  return events;
}

function appendMatchExtensionEvents(
  input: MatchAchievementParticipantInput,
  events: AchievementEventKey[]
): void {
  const goalsConceded = Math.max(0, Math.floor(input.goalsConceded));
  const maxTrailingDeficit = Math.max(0, Math.floor(input.maxTrailingDeficit));
  const enteredGolden = Boolean(input.enteredGoldenPhase);
  const walkover = input.winReason === "opponent_left";

  if (enteredGolden && !walkover) {
    events.push("match_full_time");
  }

  if (input.result !== "win") return;

  if (goalsConceded === 0 && input.winReason === "score") {
    events.push("match_clean_sheet");
  }
  if (maxTrailingDeficit >= 2) {
    events.push("match_comeback_win");
  }
  if (
    input.goldenGoalWin &&
    enteredGolden &&
    (input.goldenElapsedMsAtWin ?? 0) >= GOLDEN_PATIENCE_MIN_ELAPSED_MS
  ) {
    events.push("golden_patience_win");
  }
  if (input.scoredOwnGoal) {
    events.push("match_own_goal_win");
  }
}

/** Pure Match-end achievement effects for one participant. */
export function evaluateMatchAchievementsForParticipant(
  input: MatchAchievementParticipantInput
): MatchAchievementEffect {
  const goalsScored = Math.max(0, Math.floor(input.goalsScored));
  const priorWinStreak = Math.max(0, Math.floor(input.priorWinStreak));
  const events: AchievementEventKey[] = peakGoalEvents(goalsScored);

  if (input.result === "draw") {
    events.push("match_draw");
    appendMatchExtensionEvents(input, events);
    return {
      matchesPlayedDelta: 1,
      matchesWonDelta: 0,
      newWinStreak: 0,
      events,
    };
  }

  if (input.result === "win") {
    events.push("match_won");
    if (input.goldenGoalWin) events.push("golden_goal_win");
    if (input.winReason === "opponent_left") events.push("opponent_left_win");
    appendMatchExtensionEvents(input, events);
    return {
      matchesPlayedDelta: 1,
      matchesWonDelta: 1,
      newWinStreak: priorWinStreak + 1,
      events,
    };
  }

  events.push("match_lost");
  appendMatchExtensionEvents(input, events);
  return {
    matchesPlayedDelta: 1,
    matchesWonDelta: 0,
    newWinStreak: 0,
    events,
  };
}
