# Public patch notes — developers (`0.4.1`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

### World Cup soccer (seasonal)

- [NEW] **Targeted goal-reward outcome.** After a Free Play Field goal, `handleWorldcupGoal` sends a **scorer-only** `goalRewardOutcome` WS message (`ok` + `amountNim`, `wallet_cap`, or `budget_exhausted`) from `maybeQueueGoalReward`'s `GoalRewardDecision`. Client `WorldcupScoreboard.flashReward()` renders it under the GOAL banner. On-chain payout memo text is now **"Scored a goal on Nimiq Space!"**
- [CHANGE] **Scoreboard anchor.** `WorldcupScoreboard` top offset uses `var(--hud-below-top-wrap)` (measured top chrome) instead of a fixed `72px`.
- [FIX] **`[hidden]` on context-menu items.** `.other-player-ctx__item` set `display: block`, overriding the UA `display: none` from `hidden`; added `.other-player-ctx__item[hidden] { display: none !important; }` so `otherPlayerCtxAcceptChallengeBtn.hidden` gating works.
- [CHANGE] **`stateDelta` presence flags.** Client tick merge reads `challengeOpen` / `chatTyping` / `nimSendAway` / `worldcupCountry` from each delta snapshot (server omits when false) instead of inheriting stale values from the prior tick.
- [FIX] **`joinRoom` during an active Match.** Removed the silent `if (conn.matchId) return;` drop — navigating away now calls `worldcupHandlePlayerDeparture` (forfeit to opponent), clears `matchId`/`spectatingMatchId`, then proceeds with the join. Match Pitches remain non-joinable.
- [FIX] **Challenge cleared on real room change.** `teleportPlayer` clears `challengeOpen`/`challengeRaisedAtMs` when the player actually changes rooms.
- [CHANGE] **Action-wheel label.** The open-Challenge slice now reads `1v1` (was `Open to 1v1`); full phrasing remains in the slice `ariaLabel`.
- [NEW] **End-of-day goal recap (second Telegram message).** `scoreStore.getDayReport(dayKey)` returns one UTC day's goal breakdown; `worldcup/goalDayReport.buildWorldcupGoalDayMessage(dayKey)` formats total goals + podium + MVP + top scorers (`null` when feature off or zero goals). `buildDailyStatsReport`/`sendDailyStatsReport` expose `worldcupMessage`; `POST /api/admin/daily-stats/send` includes it in the JSON response.

### Client diagnostics

- [NEW] **Debug-panel RTT sparkline.** `clientPing`/`clientPong` probe runs at **1 Hz** whenever the perf HUD **or** the profile debug panel is open (was 2s, perf HUD only). `clientPong` feeds `hud.pushLatencySample` for a ~120-sample teal sparkline with `now/min/avg/max` and red spike dots (`hud.ts`, `main.ts`, `style.css`).

### Server diagnostics

- [NEW] **Always-on Nimiq mutex logging.** `withNimiqMutex` logs `[nim-mutex] <label> waitMs=… holdMs=…` when wait or hold exceeds `NIM_MUTEX_LOG_MS` (default 200ms).
- [NEW] **Event-loop stall probe.** `adminSystemMonitor` self-reschedules a 250ms timer; blocks ≥ `EVENT_LOOP_STALL_LOG_MS` (default 50ms) log `[event-loop] stall <ms>` to console and the `/admin/system` ring.
