# Reasons — UNRELEASED (patch-notes version)

**Patch-notes version:** `UNRELEASED` (working bucket). Before merging to `main`, run `npm run prepare-merge` so this folder is frozen under a semver that matches [package.json](../../../package.json) (see [patchnote/README.md](../../README.md)).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

World Cup polish: personal goal-reward feedback (`goalRewardOutcome`), scoreboard HUD positioning, CSS/`stateDelta` fixes for stale 1v1 challenge UI, and `joinRoom`/teleport behavior so leaving a Match or room clears challenges correctly.

---

## By area

### Repo / docs

- _(none yet)_

### Client

- **World Cup — personal goal-reward note + HUD declutter.** Scoring in the Free Play Field now shows the scorer (and only the scorer) a small note under the GOAL banner: `+{amount} NIM earned!` (green) or, when nothing was paid, a "daily NIM cap reached" / "today's pool is spent" note (amber) — `WorldcupScoreboard.flashReward()` driven by the new targeted `goalRewardOutcome` WS message ([client/src/main.ts](../../../client/src/main.ts), [client/src/worldcup/scoreboard.ts](../../../client/src/worldcup/scoreboard.ts), [client/src/net/ws.ts](../../../client/src/net/ws.ts)). The seasonal scoreboard panel's `top` is now anchored to the measured top chrome (`var(--hud-below-top-wrap)` + room for the top-right **Return Home** button) instead of a fixed `72px`, so it no longer covers the header/login-streak marquee or the Return Home control.
- **World Cup — fix "Accept 1v1" always showing in the right-click menu.** Root cause was CSS, not data: the menu item's class `.other-player-ctx__item` sets `display: block`, an author rule that beats the `hidden` attribute's UA `display: none`. So `otherPlayerCtxAcceptChallengeBtn.hidden = !challengeOpen` had **no visual effect** and the "⚽ Accept 1v1 challenge" item was always visible regardless of whether that player had a Challenge raised. Added `.other-player-ctx__item[hidden] { display: none !important; }` ([client/src/style.css](../../../client/src/style.css)) so the existing JS gating actually hides it — the same `[hidden]` guard the codebase already applies to other author-`display` elements. As defence-in-depth, the `stateDelta` (tick) merge in [client/src/main.ts](../../../client/src/main.ts) also now reads presence flags (`challengeOpen`/`chatTyping`/`nimSendAway`/`worldcupCountry`) from each delta snapshot (which the server omits when false) instead of inheriting them from the prior tick.

### Server

- **World Cup — goal-reward tx message + per-scorer outcome.** The Free Play Field goal payout's on-chain transaction message changed from "Nimiq Space — World Cup goal! Thanks for playing :)" to **"Scored a goal on Nimiq Space!"**. `maybeQueueGoalReward` now returns the `GoalRewardDecision`, and `handleWorldcupGoal` sends a **targeted** `goalRewardOutcome` message to the scorer's connection only — `ok` (with `amountNim`), `wallet_cap`, or `budget_exhausted` — so reward cap/budget feedback stays personal and is never broadcast ([server/src/rooms.ts](../../../server/src/rooms.ts)).
- **World Cup — leave a 1v1 to another room without it hanging.** The `joinRoom` handler in [server/src/rooms.ts](../../../server/src/rooms.ts) previously did `if (conn.matchId) return;`, so navigating to the Free Play Field mid-Match was silently dropped and the room never loaded. It now **forfeits the Match to the opponent** (`worldcupHandlePlayerDeparture`), clears `matchId`/`spectatingMatchId`, and proceeds with the join (Match Pitches remain non-joinable). Also, `teleportPlayer` now clears `challengeOpen`/`challengeRaisedAtMs` on a real room change, since a Challenge is room-scoped — preventing a stale "Accept 1v1" from following a player into another room.

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- _(none in this change set)_
