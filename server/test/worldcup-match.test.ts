import assert from "node:assert/strict";
import test from "node:test";

import {
  initMatchState,
  kickoffRemainingMs,
  matchTimeRemainingMs,
  reduceMatch,
  type MatchConfig,
  type MatchEvent,
  type MatchState,
} from "../src/worldcup/match.js";

const CFG: MatchConfig = { durationMs: 180_000, goldenGoalCapMs: 90_000 };

function drive(events: MatchEvent[], cfg: MatchConfig = CFG): MatchState {
  return events.reduce((s, e) => reduceMatch(s, e, cfg), initMatchState());
}

test("regulation goals update the score without ending the match", () => {
  const s = drive([
    { type: "goal", side: "a" },
    { type: "goal", side: "b" },
    { type: "goal", side: "a" },
  ]);
  assert.equal(s.scoreA, 2);
  assert.equal(s.scoreB, 1);
  assert.equal(s.phase, "regulation");
  assert.equal(s.outcome, null);
});

test("the regulation timer expiring with a lead ends as a Win", () => {
  const s = drive([
    { type: "goal", side: "a" },
    { type: "tick", dtMs: 180_000 },
  ]);
  assert.equal(s.phase, "ended");
  assert.deepEqual(s.outcome, {
    result: "win",
    winner: "a",
    reason: "score",
  });
});

test("the regulation timer expiring tied enters Golden Goal", () => {
  const s = drive([{ type: "tick", dtMs: 180_000 }]);
  assert.equal(s.phase, "golden");
  assert.equal(s.goldenElapsedMs, 0);
  assert.equal(s.outcome, null);
});

test("a goal in Golden Goal ends the match immediately for the scorer", () => {
  const s = drive([
    { type: "tick", dtMs: 180_000 }, // tied -> golden
    { type: "goal", side: "b" },
  ]);
  assert.equal(s.phase, "ended");
  assert.deepEqual(s.outcome, {
    result: "win",
    winner: "b",
    reason: "score",
  });
  assert.equal(s.scoreB, 1);
});

test("the Golden Goal cap with no goal ends as a Draw", () => {
  const s = drive([
    { type: "tick", dtMs: 180_000 }, // -> golden
    { type: "tick", dtMs: 90_000 }, // cap reached
  ]);
  assert.equal(s.phase, "ended");
  assert.deepEqual(s.outcome, { result: "draw" });
});

test("a player leaving in regulation ends as an Opponent-left win for the other side", () => {
  const s = drive([
    { type: "goal", side: "b" },
    { type: "playerLeft", side: "b" },
  ]);
  assert.equal(s.phase, "ended");
  assert.deepEqual(s.outcome, {
    result: "win",
    winner: "a",
    reason: "opponent_left",
  });
});

test("a player leaving during Golden Goal also ends as an Opponent-left win", () => {
  const s = drive([
    { type: "tick", dtMs: 180_000 }, // -> golden
    { type: "playerLeft", side: "a" },
  ]);
  assert.equal(s.phase, "ended");
  assert.deepEqual(s.outcome, {
    result: "win",
    winner: "b",
    reason: "opponent_left",
  });
});

test("events after the match has ended are ignored", () => {
  const ended = drive([
    { type: "goal", side: "a" },
    { type: "tick", dtMs: 180_000 }, // a wins
  ]);
  const after = reduceMatch(ended, { type: "goal", side: "b" }, CFG);
  assert.deepEqual(after, ended);
});

test("ticks accumulate across multiple calls before expiry", () => {
  let s = initMatchState();
  for (let i = 0; i < 3; i++) s = reduceMatch(s, { type: "tick", dtMs: 50_000 }, CFG);
  // 150s elapsed, still in regulation.
  assert.equal(s.phase, "regulation");
  assert.equal(s.elapsedMs, 150_000);
  assert.equal(matchTimeRemainingMs(s, CFG), 30_000);
  s = reduceMatch(s, { type: "tick", dtMs: 50_000 }, CFG); // crosses 180s, tied
  assert.equal(s.phase, "golden");
});

test("matchTimeRemainingMs reports regulation then golden, 0 once ended", () => {
  const reg = drive([{ type: "tick", dtMs: 60_000 }]);
  assert.equal(matchTimeRemainingMs(reg, CFG), 120_000);
  const golden = drive([
    { type: "tick", dtMs: 180_000 },
    { type: "tick", dtMs: 30_000 },
  ]);
  assert.equal(matchTimeRemainingMs(golden, CFG), 60_000);
  const ended = drive([
    { type: "goal", side: "a" },
    { type: "tick", dtMs: 180_000 },
  ]);
  assert.equal(matchTimeRemainingMs(ended, CFG), 0);
});

test("kickoffRemainingMs counts down during post-goal freeze and clears at zero", () => {
  const until = 10_000;
  assert.equal(kickoffRemainingMs(until, 7_000), 3_000);
  assert.equal(kickoffRemainingMs(until, 10_000), 0);
  assert.equal(kickoffRemainingMs(until, 12_000), 0);
  assert.equal(kickoffRemainingMs(0, 5_000), 0);
});
