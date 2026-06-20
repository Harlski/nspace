# Reasons — 0.4.1 (patch-notes version)

**Patch-notes version:** `0.4.1` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

World Cup polish: personal goal-reward feedback (`goalRewardOutcome`), scoreboard HUD positioning, CSS/`stateDelta` fixes for stale 1v1 challenge UI, and `joinRoom`/teleport behavior so leaving a Match or room clears challenges correctly. Plus a second end-of-day Telegram message (the day's goal recap — total goals, podium teams, MVP, top scorers) and an action-wheel label tidy-up (`1v1`).

---

## By area

### Repo / docs

- **Latency / payout-stall diagnostics documented.** [docs/nim-payout-tracing.md](../../../docs/nim-payout-tracing.md) gains an "Always-on contention logs" section for the new `[nim-mutex]` and `[event-loop]` lines; [docs/features-checklist.md](../../../docs/features-checklist.md) and [server/.env.example](../../../server/.env.example) document `NIM_MUTEX_LOG_MS` and `EVENT_LOOP_STALL_LOG_MS`.

### Client

- **Debug panel — server round-trip-time graph.** The debug stats panel (toggled by clicking your own identicon in your profile) now renders a 1 Hz latency sparkline beneath the text panel: a teal RTT line with `now/min/avg/max` and red dots on spikes, over a ~120-sample window so periodic in-game lag (e.g. the suspected ~30s payout stalls) is visible while watching server logs. Reuses the existing `clientPing`/`clientPong` probe — the ping loop now runs whenever the perf HUD **or** the debug panel is active (cadence tightened from 2s to 1s), and `clientPong` feeds both `setPerfHudLatencyMs` and the new `hud.pushLatencySample` ([client/src/ui/hud.ts](../../../client/src/ui/hud.ts), [client/src/main.ts](../../../client/src/main.ts), [client/src/style.css](../../../client/src/style.css)).

- **World Cup — personal goal-reward note + HUD declutter.** Scoring in the Free Play Field now shows the scorer (and only the scorer) a small note under the GOAL banner: `+{amount} NIM earned!` (green) or, when nothing was paid, a "daily NIM cap reached" / "today's pool is spent" note (amber) — `WorldcupScoreboard.flashReward()` driven by the new targeted `goalRewardOutcome` WS message ([client/src/main.ts](../../../client/src/main.ts), [client/src/worldcup/scoreboard.ts](../../../client/src/worldcup/scoreboard.ts), [client/src/net/ws.ts](../../../client/src/net/ws.ts)). The seasonal scoreboard panel's `top` is now anchored to the measured top chrome (`var(--hud-below-top-wrap)` + room for the top-right **Return Home** button) instead of a fixed `72px`, so it no longer covers the header/login-streak marquee or the Return Home control.
- **World Cup — action-wheel label shortened to `1v1`.** The "open a Challenge" slice label changed from `Open to 1v1` to `1v1` (the cancel state stays `Cancel 1v1`); the longer description still lives in the slice's `ariaLabel` ([client/src/ui/hud.ts](../../../client/src/ui/hud.ts)).
- **World Cup — fix "Accept 1v1" always showing in the right-click menu.** Root cause was CSS, not data: the menu item's class `.other-player-ctx__item` sets `display: block`, an author rule that beats the `hidden` attribute's UA `display: none`. So `otherPlayerCtxAcceptChallengeBtn.hidden = !challengeOpen` had **no visual effect** and the "⚽ Accept 1v1 challenge" item was always visible regardless of whether that player had a Challenge raised. Added `.other-player-ctx__item[hidden] { display: none !important; }` ([client/src/style.css](../../../client/src/style.css)) so the existing JS gating actually hides it — the same `[hidden]` guard the codebase already applies to other author-`display` elements. As defence-in-depth, the `stateDelta` (tick) merge in [client/src/main.ts](../../../client/src/main.ts) also now reads presence flags (`challengeOpen`/`chatTyping`/`nimSendAway`/`worldcupCountry`) from each delta snapshot (which the server omits when false) instead of inheriting them from the prior tick.

### Server

- **World Cup — goal-reward tx message + per-scorer outcome.** The Free Play Field goal payout's on-chain transaction message changed from "Nimiq Space — World Cup goal! Thanks for playing :)" to **"Scored a goal on Nimiq Space!"**. `maybeQueueGoalReward` now returns the `GoalRewardDecision`, and `handleWorldcupGoal` sends a **targeted** `goalRewardOutcome` message to the scorer's connection only — `ok` (with `amountNim`), `wallet_cap`, or `budget_exhausted` — so reward cap/budget feedback stays personal and is never broadcast ([server/src/rooms.ts](../../../server/src/rooms.ts)).
- **World Cup — leave a 1v1 to another room without it hanging.** The `joinRoom` handler in [server/src/rooms.ts](../../../server/src/rooms.ts) previously did `if (conn.matchId) return;`, so navigating to the Free Play Field mid-Match was silently dropped and the room never loaded. It now **forfeits the Match to the opponent** (`worldcupHandlePlayerDeparture`), clears `matchId`/`spectatingMatchId`, and proceeds with the join (Match Pitches remain non-joinable). Also, `teleportPlayer` now clears `challengeOpen`/`challengeRaisedAtMs` on a real room change, since a Challenge is room-scoped — preventing a stale "Accept 1v1" from following a player into another room.
- **End-of-day report — second message: the day's goal recap.** The daily Telegram report now sends a *second* message after the stats summary: total goals scored, the top-3 teams (countries) on a 🥇🥈🥉 podium, the day's **MVP** (top scorer), and the leading scorers. New `getDayReport(dayKey)` in [server/src/worldcup/scoreStore.ts](../../../server/src/worldcup/scoreStore.ts) returns one UTC day's goal breakdown (live `today` bucket or an archived `history` day, player rows joined with persistent profiles for names/flags). A new [server/src/worldcup/goalDayReport.ts](../../../server/src/worldcup/goalDayReport.ts) formats `buildWorldcupGoalDayMessage(dayKey)`, which returns `null` when `WORLDCUP_ENABLED` is off or the day had no credited goals (quiet days send only the stats message). `buildDailyStatsReport`/`sendDailyStatsReport` now carry an optional `worldcupMessage`; the scheduled run, the `POST /api/admin/daily-stats/send` preview, and the response JSON all include it ([server/src/dailyStatsReport.ts](../../../server/src/dailyStatsReport.ts), [server/src/index.ts](../../../server/src/index.ts)).

- **Always-on Nimiq mutex + event-loop stall logging.** `withNimiqMutex` now takes a `label` (`payout-send` / `balance` / `payout-poll`) and logs `[nim-mutex] <label> waitMs=… holdMs=… [behind=…] at=…` when wait or hold exceeds `NIM_MUTEX_LOG_MS` (default 200ms; `0` logs every acquisition), making payout→balance contention directly observable without enabling the full `NIM_PAYOUT_TX_TRACE` ([server/src/nimPayout/sender.ts](../../../server/src/nimPayout/sender.ts)). `adminSystemMonitor` adds a fine-grained event-loop stall probe (a 250ms self-rescheduling timer) that prints `[event-loop] stall <ms> ending at <ISO>` to the console **and** the `/admin/system` ring whenever the loop is blocked ≥ `EVENT_LOOP_STALL_LOG_MS` (default 50ms; `0` disables), so blocked-loop moments can be matched against `[nim-payout] Sent` lines in docker logs ([server/src/adminSystemMonitor.ts](../../../server/src/adminSystemMonitor.ts)).

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- _(none in this change set)_
