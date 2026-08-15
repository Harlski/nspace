---
title: Daily Earn mine gate, remaining pulse, You Kaan Do It
status: ready-for-agent
glossary: CONTEXT.md
adrs:
  - docs/adr/0014-player-level-daily-earn-allowance.md
depends_on_grill: CONTEXT.md (Daily Earn Allowance, You Kaan Do It, Login Streak)
---

# Daily Earn mine gate, remaining pulse, You Kaan Do It

> Vocabulary follows [CONTEXT.md](../../CONTEXT.md): **Daily Earn Allowance**, **Player Level**,
> **Achievement Points**, **Achievements Window**, **Login Streak**, **Week Warrior**,
> **Monthly Devotee**, **Time of Kaan**, **You Kaan Do It**, **Pay-Intent**.

## Problem Statement

Players who have spent their **Daily Earn Allowance** can still complete claimable-block mines
for 0 NIM. That removes (or cools down) gold blocks other players with remaining allowance
could have earned from — a hostage problem. Players also get little feedback after a mine about
how much of today's allowance is left, and there is no Social login-streak achievement at 100
days above **Time of Kaan**.

## Solution

Refuse claimable-block mining when remaining Daily Earn Allowance is 0 (on begin, with a
complete-time safety net), show a tutorial-style cinematic that opens the **Achievements
Window**, show a short remaining/ceiling pulse after successful allowance-bound mines, keep
partial-fill when some allowance remains, and add **You Kaan Do It** (100-day login streak,
150 Achievement Points).

## Proposed test seams

Confirm these before implement (preferred existing / highest seams; fewest possible):

1. **Pure Daily Earn claim gate** — a small pure helper (alongside existing Daily Earn Allowance
   math): given remaining luna (`null` = uncapped), decide whether a claimable-block earn may
   begin. Tests assert allow when uncapped or remaining > 0, refuse when remaining is 0.
2. **Login-streak achievement catalog + evaluation** — existing achievement definition list and
   `evaluateLoginStreakAchievements` / `getAchievementsForWallet` seam: **You Kaan Do It** at
   threshold 100, 150 points, progress/unlock/silent self-heal like other login-streak tiers.

Client cinematic / HUD pulse are wired against those server contracts; prefer not adding a
third seam unless a pure display formatter is needed.

## User Stories

1. As a player with 0 Daily Earn Allowance remaining today, I want starting a claimable-block
   mine to be refused, so that I cannot consume gold blocks others could still earn from.
2. As a player with 0 remaining, I want the refusal to happen when I try to begin the claim (not
   after holding the mine bar), so that I am not made to wait for a no-op.
3. As a player who races another claim and hits 0 remaining by complete time, I want the claim
   to still refuse without consuming the block, so that the hostage bug cannot sneak through.
4. As a player with 0 remaining who tries to Mine, I want a full-letterbox cinematic titled
   "Daily NIM limit reached", so that the limit is unmistakable.
5. As that player, I want the line "Level up via Achievements to increase your cap", so that I
   know progression raises my allowance.
6. As that player, I want an **Open Achievements** control on that cinematic that opens the
   Achievements Window, so that I can act on the guidance immediately.
7. As a player with Mine still shown on gold blocks while at 0 remaining, I want the affordance
   to stay, so that gold blocks do not look broken or non-interactive.
8. As a player with remaining allowance less than a full block reward (e.g. 0.2 NIM left), I
   want to still complete the mine and receive at most that remaining amount, so that I can
   finish today's allowance without wasting the last fraction.
9. As a player who successfully mines under a Level-based ceiling, I want to keep seeing the
   world-space +NIM reward float, so that the earn feel stays familiar.
10. As that player, I want a short HUD pulse of `{remaining} / {ceiling} NIM remaining` after
    the mine, so that I learn how much runway I have left today.
11. As a Level 11+ (uncapped) player, I want no remaining/ceiling pulse after mining, so that
    uncapped wallets are not shown a fake daily fraction.
12. As a player who used to see "Daily earn allowance reached" on partial fills, I want that
    misleading toast gone in favor of the remaining pulse, so that feedback matches reality.
13. As a player viewing my own profile, I still want the existing Daily Earn Allowance readout,
    so that the pulse is additive feedback, not a replacement for the profile.
14. As a guest or mining-restricted wallet, I want existing claim denials unchanged, so that
    moderation and guest rules stay intact.
15. As a Tutorial Room learner, I want tutorial faucet mines unchanged (outside Daily Earn
    Allowance), so that first-contact NIM still works.
16. As a Free Play or maze earner at 0 remaining, I want this pass to leave my existing soft
    fail feedback alone, so that scope stays on the mining hostage problem.
17. As a Social achievement hunter, I want **You Kaan Do It** for 100 consecutive UTC login
    days, so that there is a tier above Time of Kaan.
18. As that hunter, I want **You Kaan Do It** to award 150 Achievement Points and no cosmetic
    SKU, so that the reward is progression toward Player Level / Daily Earn Allowance.
19. As a player with a live streak of N days, I want all four login-streak rows to show N capped
    at each threshold (including 100), so that progress is consistent.
20. As a player who already reached 100 days before this ships, I want silent self-heal on
    achievements fetch (and unlock on login evaluation) so I still get the achievement.
21. As a player who earned You Kaan Do It then broke streak, I want it to stay Complete, so that
    login-streak tiers remain permanent once earned.
22. As an operator, I want Time of Kaan's env-tuned threshold unchanged, so that You Kaan Do It
    does not disturb existing top-tier ops knobs.
23. As a developer, I want refuse reasons detectable by a stable client signal (not only prose),
    so that the cinematic does not depend on fragile string matching of user copy.
24. As a player mid-day who levels up and raises the same day's ceiling above spent, I want
    mining to work again without waiting for UTC midnight, so that ADR 0014 mid-day Level-up
    behavior still holds.

## Implementation Decisions

1. Amend Daily Earn Allowance mining behavior relative to ADR 0014: when remaining luna is 0,
   claimable-block claims must not mutate the block (no cooldown / claim finalization). Partial
   fill when remaining > 0 stays as today.
2. Add a pure helper at the Daily Earn / Player Level math module: allow claimable-block earn
   begin when remaining is `null` (uncapped) or `> 0`; refuse when remaining is `0`.
3. On `beginBlockClaim` (and complete safety net): peek remaining for the wallet; if refused,
   return `blockClaimResult` with `ok: false` and a stable machine-readable field/code for
   Daily Earn exhausted (plus human reason). Do not start a claim session.
4. On successful claim finalize: include remaining and ceiling after the earn (NIM strings
   consistent with existing profile formatting) on `blockClaimResult` when a ceiling applies;
   omit or null when uncapped.
5. Client: on exhausted signal, show cinematic (same visual family as tutorial step cinematics)
   with title, subtitle, and Open Achievements → existing Achievements Window open path; do not
   treat it as a generic denial hint on the claim progress UI.
6. Client: on successful mine with remaining/ceiling present, keep +NIM float; show animated
   remaining pulse; remove the old "Daily earn allowance reached" brief toast path for these
   cases.
7. Add achievement **You Kaan Do It**: id in the social-login family, category social,
   criteria `login_streak` threshold 100, points 150, sortOrder immediately after Time of Kaan,
   fixed threshold (not env-tuned). Reuse existing login-streak evaluation and progress display.
8. Update CONTEXT.md (already done for You Kaan Do It / streak ladder), features checklist,
   UNRELEASED patch notes, and any docs that list the three-tier streak ladder.
9. Free Play goals and maze earn paths are unchanged this pass.

## Testing Decisions

- Good tests assert external behavior at the agreed seams only (pure gate; achievement catalog /
  evaluation). Avoid asserting rooms.ts internals or CSS class names.
- Prior art: `server/test/dailyEarnAllowance.test.ts`, `server/test/playerLevel.test.ts`,
  `server/test/achievementStore.test.ts` (login streak tiers).
- Extend login-streak progress tests to include the 100-day row.
- Do not require browser e2e for the cinematic; wire types and reason code are enough for the
  client contract in this pass.

## Out of Scope

- Changing Free Play goal or maze at-cap UX
- New cosmetic reward for You Kaan Do It
- Env-tuning the 100-day threshold
- Hiding or greying the Mine affordance while at 0 remaining
- Redesigning the profile Daily Earn Allowance row
- Changing L1–L10 NIM/day table or uncapped Level threshold

## Further Notes

- Grill locked copy: title "Daily NIM limit reached"; line "Level up via Achievements to
  increase your cap"; control "Open Achievements".
- Hostage fix is authority-side: client UX teaches; server refusal is the source of truth.
- Mid-day Level-up can reopen mining the same UTC day when remaining becomes > 0 again.
