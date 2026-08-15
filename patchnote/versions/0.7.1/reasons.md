# Reasons — 0.7.1 (patch-notes version)

**Patch-notes version:** `0.7.1` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Daily Earn Allowance mine hostage fix (refuse at 0 remaining) + post-mine remaining pulse + at-cap cinematic; **You Kaan Do It** 100-day login streak achievement.

---

## By area

### Repo / docs

- `CONTEXT.md` — **You Kaan Do It**; Login Streak ladder now four tiers; Time of Kaan no longer described as top.
- `docs/adr/0014-player-level-daily-earn-allowance.md` — claimable-block refuse when remaining is 0.
- `docs/features-checklist.md` — Daily Earn mine gate / pulse / cinematic note.
- `.scratch/daily-earn-mine-gate/spec.md` — PRD (`ready-for-agent`).

### Client

- `client/src/net/ws.ts` — `blockClaimResult` fields: `dailyEarnAllowanceExhausted`, `dailyEarnRemainingNim`, `dailyEarnCeilingNim`.
- `client/src/ui/hud.ts` / `style.css` — `showDailyEarnLimitCinematic` (Achievements CTA); `showDailyEarnRemainingPulse`.
- `client/src/main.ts` — wire exhausted cinematic + remaining pulse; drop misleading “Daily earn allowance reached” toast on partial fills.

### Server

- `server/src/playerLevel.ts` — `canBeginClaimableBlockEarn`.
- `server/src/rooms.ts` — gate begin/complete for non-tutorial claimable mines; return remaining/ceiling on success.
- `server/src/achievementDefinitions.ts` — **You Kaan Do It** (`social-login-100`, 150 AP, threshold 100).
- Tests: `server/test/playerLevel.test.ts`, `server/test/achievementStore.test.ts`.

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- _(none in this change set)_
