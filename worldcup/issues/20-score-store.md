---
id: "20-score-store"
milestone: M2
depends_on: ["00-scaffold"]
status: todo
acceptance:
  - server/src/worldcup/scoreStore.ts persists server/data/worldcup-scores.json
  - Tracks per-country goals and per-player {country, goals, name}
  - setCountry(wallet, code, name) persists the player's chosen country
  - recordGoal(wallet, name) credits the player's CURRENT country immutably at goal time
  - Players with no country yet hold a pending goal that flushes on first setCountry
  - getLeaderboard() returns sorted countries + top players
  - Unit tests: tally increments, pending flush, country change does not move past goals
verify:
  - "npm test -w server (scoreStore tests pass)"
---

# 20 — Score store

Single small JSON store for the whole tally (deletable to deprecate). Attribution is
immutable per goal: a goal counts for the country the scorer had at that moment;
changing country later only affects future goals. Goals scored before a country is
chosen are held as `pending[wallet]` and flushed to the country picked first.
