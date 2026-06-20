---
id: "71-match-rules"
milestone: M7
depends_on: ["70-challenge-match-pitch", "50-goalies-field"]
triage: ready-for-agent
status: todo
acceptance:
  - server/src/worldcup/match.ts exposes a pure match reducer over goal|tick|playerLeft events
  - a Match runs a 3-min timer with live score; most goals wins; ties go to Golden Goal (90s cap -> Draw)
  - Match HUD shows score, remaining time, and the end result (Win/Loss/Draw/Opponent left)
  - Goalies defend both goals in the Match Pitch (reuses 50); players return after the result
verify:
  - "npm test -w server (new worldcup-match reducer test)"
  - "npm run build"
  - "manual: play a full 1v1 - clock counts down, goals score, a tie triggers golden goal, result shows, both return"
---

# 71 — Match rules: clock, score, golden goal, result

## What to build

Turn the bare Match Pitch from `70` into a real **Match**. A pure state machine owns the
rules so they're unit-testable away from sockets and timers:

- 3-minute regulation timer with a live score for both sides.
- Most goals at full time wins.
- A tie at full time enters **Golden Goal** — the next goal wins, capped at 90s, after which
  the Match is a **Draw**.
- `playerLeft` at any phase ends the Match as an Opponent-left win.

The client shows a Match HUD (score + clock + phase) and an end-of-match result, then both
players are returned to their snapshotted origins a few seconds later. **Goalies** defend
both goals in the Match Pitch, reusing the keeper from `50`. Matches earn no NIM and never
touch the daily leaderboard.

The reducer shape (from design): state transitions on `goal | tick | playerLeft`, with
phases `regulation → (golden | ended)` and terminal outcomes `home | away | draw |
opponent_left`.

## Acceptance criteria

- [ ] The match reducer is pure and unit-tested: regulation scoring, timer expiry with a
      lead (Win), expiry tied (enters Golden Goal), golden-goal score (ends), golden-goal
      cap with no goal (Draw), and `playerLeft` at each phase (Opponent-left win).
- [ ] The Match HUD displays live score, remaining time, and a clear final result.
- [ ] Goalies defend both goals in the Match Pitch.
- [ ] Match duration and golden-goal cap are env-configurable (defaults 180000ms / 90000ms).
- [ ] Players are returned to origin after the result; the pitch is torn down.
- [ ] Matches queue no payouts and add nothing to the leaderboard.
- [ ] `npm run build` and `npm test -w server` pass.

## Blocked by

- 70-challenge-match-pitch
- 50-goalies-field
