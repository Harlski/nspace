# Public patch notes — developers (`UNRELEASED`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

### World Cup soccer (seasonal)

- [NEW] **Targeted goal-reward outcome.** After a Free Play Field goal, `handleWorldcupGoal` sends a **scorer-only** `goalRewardOutcome` WS message (`ok` + `amountNim`, `wallet_cap`, or `budget_exhausted`) from `maybeQueueGoalReward`'s `GoalRewardDecision`. Client `WorldcupScoreboard.flashReward()` renders it under the GOAL banner. On-chain payout memo text is now **"Scored a goal on Nimiq Space!"**
- [CHANGE] **Scoreboard anchor.** `WorldcupScoreboard` top offset uses `var(--hud-below-top-wrap)` (measured top chrome) instead of a fixed `72px`.
- [FIX] **`[hidden]` on context-menu items.** `.other-player-ctx__item` set `display: block`, overriding the UA `display: none` from `hidden`; added `.other-player-ctx__item[hidden] { display: none !important; }` so `otherPlayerCtxAcceptChallengeBtn.hidden` gating works.
- [CHANGE] **`stateDelta` presence flags.** Client tick merge reads `challengeOpen` / `chatTyping` / `nimSendAway` / `worldcupCountry` from each delta snapshot (server omits when false) instead of inheriting stale values from the prior tick.
- [FIX] **`joinRoom` during an active Match.** Removed the silent `if (conn.matchId) return;` drop — navigating away now calls `worldcupHandlePlayerDeparture` (forfeit to opponent), clears `matchId`/`spectatingMatchId`, then proceeds with the join. Match Pitches remain non-joinable.
- [FIX] **Challenge cleared on real room change.** `teleportPlayer` clears `challengeOpen`/`challengeRaisedAtMs` when the player actually changes rooms, so a stale challenge badge cannot follow into another room.
