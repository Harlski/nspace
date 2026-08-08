---
id: "01-allowance-core-mining"
parent: .scratch/player-level/PRD.md
triage: done
status: done
depends_on: []
---

# 01 — Allowance core + mining gate

**What to build:** A wallet's **Player Level** (from lifetime **Achievement Points**) sets its **Daily Earn Allowance**. Mining claims share that UTC-day allowance: proposed NIM is partial-filled when it would exceed the remaining allowance, tutorial faucet and admin grants still bypass, and the miner gets a private at-cap / partial-fill signal. Mid-day Level-up raises the same day's ceiling without resetting spent NIM.

**Blocked by:** None — can start immediately.

**Status:** done

## Parent

[`.scratch/player-level/PRD.md`](../PRD.md)

## Acceptance criteria

- [x] Player Level = floor(Achievement Points / 100) + 1; L1 at 0 AP; keeps climbing past L11.
- [x] Default Daily Earn Allowance table: L1–L10 = 10, 15, 20, 30, 40, 50, 65, 80, 90, 100 NIM/day; L11+ uncapped.
- [x] Durable per-wallet UTC-day store records gameplay NIM committed toward the allowance (not analytics `nimEarned`, not soccer-only counters).
- [x] Mining claims (non-tutorial) go through one gameplay Pay-Intent gate that applies partial fill and records spent luna.
- [x] Tutorial Priority Pay-Intent and admin feedback rewards bypass the allowance and do not consume it.
- [x] Mid-day Level-up recomputes ceiling immediately; spent for the day is unchanged.
- [x] Miner receives a private signal when allowance partial-fills or zeros a claim.
- [x] Unit tests cover pure Level/ceiling/partial-fill math, day-store commit/rollover, mining gate + bypass paths.
