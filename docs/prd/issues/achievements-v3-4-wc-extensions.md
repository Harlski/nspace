---
id: "achievements-v3-4-wc-extensions"
milestone: achievements-v3
depends_on:
  - "achievements-v3-0-engine"
  - "achievements-v2-1-match-hooks"
  - "achievements-v2-2-field-social"
triage: ready-for-agent
status: done
verify:
  - "npm test -w server -- matchAchievementEvaluator achievementStore"
  - "npm run build"
  - "manual: clean sheet win, comeback, golden patience, handshake rival, rush hour goal, daily streak"
---

# Achievements v3 — slice 4: World Cup match + field extensions

PRD: [../achievements-v3-exploration-building-meta.md](../achievements-v3-exploration-building-meta.md)  
Parent: [../achievements-v3-exploration-building-meta.md](../achievements-v3-exploration-building-meta.md)

## What to build

Extend v2 World Cup achievements with v3 **Match** and **Free Play Field** badges. Reuse `WORLDCUP_ENABLED` gating from v2.

### Match (extend match achievement evaluator + Match end hook)

| Achievement | Rule (summary) |
|-------------|----------------|
| Clean Sheet | Win with 0 goals against |
| Comeback Kid | Win after trailing by ≥2 goals at any point (running score snapshot) |
| Golden Patience | Win via Golden Goal after regulation ended in draw (not first-minute golden) |
| Handshake Rival | Same UTC day: accept Challenge from wallet you also raised a Challenge to earlier |
| Full Time | Complete Match through regulation + golden window without opponent leaving |
| Own Goal Hero | Score own goal in a Match you still win (one-time) |

### Free Play Field

| Achievement | Rule (summary) |
|-------------|----------------|
| Rush Hour | Contested goal with ≥4 distinct players on pitch |
| Daily Streak | Score on 3 consecutive UTC days (any credited field goal) |
| Underdog Country | Score for country not in top 3 on today's leaderboard at goal time |

**User stories:** 36–44

## Acceptance criteria

- [x] Extended match evaluator unit tests for clean sheet, comeback, golden patience, full time, own goal win
- [x] Handshake Rival tracked in daily state; mutual same-day raise + accept required
- [x] Rush Hour uses contested tier with ≥4 distinct players
- [x] Daily Streak uses UTC day keys; pauses when `WORLDCUP_ENABLED` off
- [x] Underdog Country evaluates leaderboard at goal credit time
- [x] WC-gated progress skips when flag off; completions preserved in API
- [x] Build and server tests pass

## Blocked by

- [achievements-v3-0-engine](achievements-v3-0-engine.md)
- [achievements-v2-1-match-hooks](achievements-v2-1-match-hooks.md)
- [achievements-v2-2-field-social](achievements-v2-2-field-social.md)
