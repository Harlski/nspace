import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// Point the store at a throwaway file before importing it.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "worldcup-scores-"));
process.env.WORLDCUP_SCORES_FILE = path.join(TMP, "scores.json");

const {
  __resetScoresForTests,
  getDayReport,
  getLeaderboard,
  getPlayerCountry,
  getPreviousDayWinner,
  isValidCountryCode,
  recordGoal,
  rolloverIfNeeded,
  setCountry,
  utcDayKey,
} = await import("../src/worldcup/scoreStore.js");

function reset(): void {
  __resetScoresForTests();
}

test("isValidCountryCode accepts AA..ZZ only", () => {
  assert.equal(isValidCountryCode("BR"), true);
  assert.equal(isValidCountryCode("br"), false);
  assert.equal(isValidCountryCode("BRA"), false);
  assert.equal(isValidCountryCode(123), false);
});

test("recordGoal credits the player's current country", () => {
  reset();
  setCountry("NQ AAAA", "BR", "Ronaldo");
  const r = recordGoal("NQ AAAA", "Ronaldo");
  assert.equal(r.country, "BR");
  const lb = getLeaderboard();
  assert.deepEqual(lb.countries.find((c) => c.code === "BR"), {
    code: "BR",
    goals: 1,
  });
  assert.equal(lb.players[0]?.goals, 1);
});

test("goals before choosing a country are held pending and flush on setCountry", () => {
  reset();
  // No country yet -> two pending goals.
  assert.equal(recordGoal("NQ BBBB", "Mbappe").country, null);
  assert.equal(recordGoal("NQ BBBB", "Mbappe").country, null);
  // Country chosen later -> pending flushes.
  setCountry("NQ BBBB", "FR", "Mbappe");
  const lb = getLeaderboard();
  assert.equal(lb.countries.find((c) => c.code === "FR")?.goals, 2);
  assert.equal(getPlayerCountry("NQ BBBB"), "FR");
});

test("changing country does not move already-attributed goals", () => {
  reset();
  setCountry("NQ CCCC", "AR", "Messi");
  recordGoal("NQ CCCC", "Messi"); // -> AR
  recordGoal("NQ CCCC", "Messi"); // -> AR
  setCountry("NQ CCCC", "US", "Messi"); // switch
  recordGoal("NQ CCCC", "Messi"); // -> US
  const lb = getLeaderboard();
  assert.equal(lb.countries.find((c) => c.code === "AR")?.goals, 2);
  assert.equal(lb.countries.find((c) => c.code === "US")?.goals, 1);
  // Player total spans both countries.
  assert.equal(lb.players.find((p) => p.name === "Messi")?.goals, 3);
});

test("wallet normalization ignores spaces and case", () => {
  reset();
  setCountry("nq dddd", "DE", "Müller");
  recordGoal("NQ DDDD", "Müller");
  assert.equal(getPlayerCountry("NQDDDD"), "DE");
  assert.equal(getLeaderboard().countries.find((c) => c.code === "DE")?.goals, 1);
});

test("leaderboard sorts countries by goals desc", () => {
  reset();
  setCountry("NQ E1", "ES", "a");
  setCountry("NQ E2", "IT", "b");
  setCountry("NQ E3", "IT", "c");
  recordGoal("NQ E1", "a"); // ES 1
  recordGoal("NQ E2", "b"); // IT 1
  recordGoal("NQ E3", "c"); // IT 2
  const countries = getLeaderboard().countries;
  assert.equal(countries[0]?.code, "IT");
  assert.equal(countries[0]?.goals, 2);
});

test("utcDayKey returns a UTC YYYY-MM-DD string", () => {
  assert.match(utcDayKey(Date.UTC(2026, 5, 19, 23, 59)), /^2026-06-19$/);
  // 00:30 UTC the next day rolls the key forward.
  assert.equal(utcDayKey(Date.UTC(2026, 5, 20, 0, 30)), "2026-06-20");
});

test("daily rollover archives the day, resets today, and records the winner", () => {
  reset();
  // Day 1: Brazil wins.
  setCountry("NQ F1", "BR", "a");
  setCountry("NQ F2", "FR", "b");
  recordGoal("NQ F1", "a"); // BR 1
  recordGoal("NQ F1", "a"); // BR 2
  recordGoal("NQ F2", "b"); // FR 1
  assert.equal(getLeaderboard().countries[0]?.code, "BR");

  // Cross midnight UTC.
  const tomorrow = Date.now() + 24 * 60 * 60 * 1000;
  assert.equal(rolloverIfNeeded(tomorrow), true);

  // Today's tally is empty after the reset.
  const lb = getLeaderboard();
  assert.equal(lb.countries.length, 0);
  // Previous day's winner is remembered for the crowd flag.
  assert.equal(getPreviousDayWinner()?.country, "BR");
  assert.equal(getPreviousDayWinner()?.goals, 2);
  // Country choice (identity) persists across the reset.
  assert.equal(getPlayerCountry("NQ F1"), "BR");
  // History keeps the archived day.
  assert.ok(lb.history.some((d) => d.winner === "BR" && d.winnerGoals === 2));
});

test("a quiet day does not blank the previous champion flag", () => {
  reset();
  setCountry("NQ G1", "DE", "a");
  recordGoal("NQ G1", "a"); // DE 1
  rolloverIfNeeded(Date.now() + 24 * 60 * 60 * 1000); // archive DE day
  assert.equal(getPreviousDayWinner()?.country, "DE");
  // Another empty day rolls over with no goals - champion stays DE.
  rolloverIfNeeded(Date.now() + 48 * 60 * 60 * 1000);
  assert.equal(getPreviousDayWinner()?.country, "DE");
});

test("getDayReport summarizes the live day's goals, podium, and MVP", () => {
  reset();
  setCountry("NQ H1", "BR", "Pelé");
  setCountry("NQ H2", "FR", "Zidane");
  recordGoal("NQ H1", "Pelé"); // BR, Pelé 1
  recordGoal("NQ H1", "Pelé"); // BR, Pelé 2
  recordGoal("NQ H2", "Zidane"); // FR, Zidane 1
  const rep = getDayReport(utcDayKey());
  assert.equal(rep?.day, utcDayKey());
  assert.equal(rep?.totalGoals, 3);
  assert.equal(rep?.winner, "BR");
  assert.equal(rep?.winnerGoals, 2);
  assert.equal(rep?.countries[0]?.code, "BR");
  assert.equal(rep?.players[0]?.name, "Pelé"); // MVP = top scorer
  assert.equal(rep?.players[0]?.goals, 2);
});

test("getDayReport counts no-country (pending) goals in the total", () => {
  reset();
  recordGoal("NQ I1", "Anon"); // no country yet -> pending
  const rep = getDayReport(utcDayKey());
  assert.equal(rep?.totalGoals, 1);
  assert.equal(rep?.winner, null);
  assert.equal(rep?.countries.length, 0);
  assert.equal(rep?.players[0]?.country, null);
  assert.equal(rep?.players[0]?.goals, 1);
});

test("getDayReport reads an archived day and is null for an unknown day", () => {
  reset();
  setCountry("NQ J1", "AR", "Maradona");
  recordGoal("NQ J1", "Maradona");
  const dayKey = utcDayKey();
  rolloverIfNeeded(Date.now() + 24 * 60 * 60 * 1000); // archive the AR day
  const rep = getDayReport(dayKey);
  assert.equal(rep?.totalGoals, 1);
  assert.equal(rep?.winner, "AR");
  assert.equal(rep?.players[0]?.name, "Maradona");
  assert.equal(getDayReport("1999-01-01"), null);
});
