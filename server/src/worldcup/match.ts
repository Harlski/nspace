/**
 * World Cup soccer - pure 1v1 Match state machine (FEATURE-FLAGGED, DEPRECATABLE).
 *
 * A reducer `(state, event) -> state` over `goal | tick | playerLeft`, owning the
 * regulation timer, Golden Goal sudden-death (capped, then Draw), the score, and the
 * terminal outcome. It is pure - no rooms, sockets, timers, or disk - so it is fully
 * unit-tested. `rooms.ts` owns the I/O around it (ephemeral room create/teardown,
 * teleport, broadcast).
 *
 * Sides are `"a"` (challenger) and `"b"` (accepter). A Match always reaches an end:
 * a lead at full time wins; a tie enters Golden Goal; the first golden goal wins; the
 * golden cap with no goal is a Draw; a player leaving at any live phase ends it
 * immediately as an Opponent-left win for the other side.
 */

export type MatchSide = "a" | "b";
export type MatchPhase = "regulation" | "golden" | "ended";

export type MatchOutcome =
  | null
  | { result: "win"; winner: MatchSide; reason: "score" | "opponent_left" }
  | { result: "draw" };

export interface MatchState {
  phase: MatchPhase;
  scoreA: number;
  scoreB: number;
  /** Elapsed regulation time (ms), clamped to `durationMs`. */
  elapsedMs: number;
  /** Elapsed Golden Goal time (ms), clamped to the cap. Only advances in `golden`. */
  goldenElapsedMs: number;
  outcome: MatchOutcome;
}

export interface MatchConfig {
  durationMs: number;
  goldenGoalCapMs: number;
}

export type MatchEvent =
  | { type: "goal"; side: MatchSide }
  | { type: "tick"; dtMs: number }
  | { type: "playerLeft"; side: MatchSide };

export function initMatchState(): MatchState {
  return {
    phase: "regulation",
    scoreA: 0,
    scoreB: 0,
    elapsedMs: 0,
    goldenElapsedMs: 0,
    outcome: null,
  };
}

function other(side: MatchSide): MatchSide {
  return side === "a" ? "b" : "a";
}

function leader(state: MatchState): MatchSide | null {
  if (state.scoreA > state.scoreB) return "a";
  if (state.scoreB > state.scoreA) return "b";
  return null;
}

/**
 * Advance the Match by one event. Returns a NEW state (never mutates the input). Events
 * after the Match has `ended` are ignored.
 */
export function reduceMatch(
  state: MatchState,
  event: MatchEvent,
  cfg: MatchConfig
): MatchState {
  if (state.phase === "ended") return state;

  switch (event.type) {
    case "playerLeft": {
      return {
        ...state,
        phase: "ended",
        outcome: {
          result: "win",
          winner: other(event.side),
          reason: "opponent_left",
        },
      };
    }

    case "goal": {
      const next: MatchState = {
        ...state,
        scoreA: state.scoreA + (event.side === "a" ? 1 : 0),
        scoreB: state.scoreB + (event.side === "b" ? 1 : 0),
      };
      // A Golden Goal ends the Match immediately for the scorer.
      if (next.phase === "golden") {
        return {
          ...next,
          phase: "ended",
          outcome: { result: "win", winner: event.side, reason: "score" },
        };
      }
      return next;
    }

    case "tick": {
      const dt = Math.max(0, event.dtMs);
      if (state.phase === "regulation") {
        const elapsedMs = Math.min(cfg.durationMs, state.elapsedMs + dt);
        if (elapsedMs < cfg.durationMs) {
          return { ...state, elapsedMs };
        }
        // Regulation just ended.
        const lead = leader(state);
        if (lead) {
          return {
            ...state,
            elapsedMs,
            phase: "ended",
            outcome: { result: "win", winner: lead, reason: "score" },
          };
        }
        // Tied -> Golden Goal sudden death.
        return { ...state, elapsedMs, phase: "golden", goldenElapsedMs: 0 };
      }

      // phase === "golden"
      const goldenElapsedMs = Math.min(
        cfg.goldenGoalCapMs,
        state.goldenElapsedMs + dt
      );
      if (goldenElapsedMs < cfg.goldenGoalCapMs) {
        return { ...state, goldenElapsedMs };
      }
      // Golden cap reached with no goal -> Draw.
      return {
        ...state,
        goldenElapsedMs,
        phase: "ended",
        outcome: { result: "draw" },
      };
    }
  }
}

/** Remaining ms in a post-goal kickoff freeze (0 when movement is allowed). */
export function kickoffRemainingMs(kickoffUntilMs: number, nowMs: number): number {
  return kickoffUntilMs > nowMs ? Math.max(0, kickoffUntilMs - nowMs) : 0;
}

/** Remaining ms in the current phase (regulation, then golden). 0 once ended. */
export function matchTimeRemainingMs(
  state: MatchState,
  cfg: MatchConfig
): number {
  if (state.phase === "regulation") {
    return Math.max(0, cfg.durationMs - state.elapsedMs);
  }
  if (state.phase === "golden") {
    return Math.max(0, cfg.goldenGoalCapMs - state.goldenElapsedMs);
  }
  return 0;
}
