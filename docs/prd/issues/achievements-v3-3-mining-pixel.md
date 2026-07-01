---
id: "achievements-v3-3-mining-pixel"
milestone: achievements-v3
depends_on: ["achievements-v3-0-engine"]
triage: ready-for-agent
status: done
verify:
  - "npm test -w server -- achievementStore"
  - "npm run build"
  - "manual: adjacent mine, cooldown fail, field payout, billboard dwell, pixel corners/collab/monochrome"
---

# Achievements v3 — slice 3: Mining + Pixel extensions

PRD: [../achievements-v3-exploration-building-meta.md](../achievements-v3-exploration-building-meta.md)  
Parent: [../achievements-v3-exploration-building-meta.md](../achievements-v3-exploration-building-meta.md)

## What to build

Extend **mining** and **pixel** categories with v3 achievements (existing categories, new definitions + hooks).

### Mining & economy

| Achievement | Rule (summary) |
|-------------|----------------|
| Impatient Miner | One-time: direct adjacent block claim (existing adjacent claimIntent path) |
| Dry Spell | One-time at 10: mine attempt on cooldown with "There's no NIM left here :(" message |
| Paid in Full | One-time: receive ≥1 NIM from Free Play Field goal payout (not Match; guests excluded) |
| Billboard Audience | 60s cumulative dwell within 7 blocks of live campaign billboard; ≥2 real players in room while accrual runs |

### Pixel room

| Achievement | Rule (summary) |
|-------------|----------------|
| Corner to Corner | Lifetime union: painted all four corners of 500×500 board (within place radius over time) |
| Collaborator | Paint tile adjacent to another player's paint while they are in Pixel room |
| Monochrome Discipline | 64 pixels one hue; streak counter resets if hue changes mid-run |

**User stories:** 29–35

## Acceptance criteria

- [ ] Impatient Miner and Dry Spell fire once at correct boundaries
- [ ] Paid in Full only on successful field goalRewardOutcome for eligible wallet
- [ ] Billboard Audience accrues dwell only with ≥2 players present; does not complete solo idle
- [ ] Corner to Corner tracks four corner regions over lifetime
- [ ] Collaborator requires co-presence + adjacency at paint time
- [ ] Monochrome Discipline streak resets on hue change; completes at 64
- [ ] Store tests cover counters/streak/composite rules; build passes

## Blocked by

- [achievements-v3-0-engine](achievements-v3-0-engine.md)
