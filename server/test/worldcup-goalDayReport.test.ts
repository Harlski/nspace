import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// Point the score store at a throwaway file and keep the feature on before importing.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "worldcup-goalday-"));
process.env.WORLDCUP_SCORES_FILE = path.join(TMP, "scores.json");
process.env.WORLDCUP_ENABLED = "1";

const { __resetScoresForTests, recordGoal, setCountry, utcDayKey } = await import(
  "../src/worldcup/scoreStore.js"
);
const { buildWorldcupGoalDayMessage } = await import(
  "../src/worldcup/goalDayReport.js"
);

test("returns null when the day had no goals", () => {
  __resetScoresForTests();
  assert.equal(buildWorldcupGoalDayMessage(utcDayKey()), null);
  assert.equal(buildWorldcupGoalDayMessage("1999-01-01"), null);
});

test("builds a recap with total, top teams, MVP, and scorers", () => {
  __resetScoresForTests();
  setCountry("NQ A1", "BR", "Pelé");
  setCountry("NQ A2", "FR", "Zidane");
  recordGoal("NQ A1", "Pelé"); // BR, Pelé 1
  recordGoal("NQ A1", "Pelé"); // BR, Pelé 2
  recordGoal("NQ A2", "Zidane"); // FR, Zidane 1

  const msg = buildWorldcupGoalDayMessage(utcDayKey());
  assert.ok(msg, "expected a message");
  assert.match(msg!, /Goals scored: 3/);
  assert.match(msg!, /Top teams/);
  // Brazil leads the podium with the gold medal.
  assert.match(msg!, /🥇 🇧🇷 BR - 2 goals/);
  // MVP is the top scorer (Pelé, 2 goals).
  assert.match(msg!, /MVP: 🇧🇷 Pelé - 2 goals/);
  assert.match(msg!, /Top scorers/);
});

test("falls back to a short wallet when a scorer has no name or country", () => {
  __resetScoresForTests();
  recordGoal("NQXXXXXXXXXXXXXXXXXXXX", ""); // no name, no country -> pending goal
  const msg = buildWorldcupGoalDayMessage(utcDayKey());
  assert.ok(msg);
  assert.match(msg!, /Goals scored: 1/);
  assert.match(msg!, /MVP: NQXXXX…XXXX - 1 goal/);
});
