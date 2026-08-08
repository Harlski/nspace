---
id: "03-maze-under-allowance"
parent: .scratch/player-level/PRD.md
triage: done
status: done
depends_on:
  - "01-allowance-core-mining"
---

# 03 — Maze first-place under Allowance

**What to build:** Maze first-place NIM is treated as gameplay earn — it partial-fills against and consumes **Daily Earn Allowance** like mining, so maze wins cannot bypass the daily throttle.

**Blocked by:** 01 — Allowance core + mining gate.

**Status:** done

## Parent

[`.scratch/player-level/PRD.md`](../PRD.md)

## Acceptance criteria

- [x] Maze first-place Pay-Intent goes through the gameplay allowance gate.
- [x] Paid luna shares the same UTC-day spent counter as mining (and Free Play once 02 lands).
- [x] Partial fill / zero pay when allowance is exhausted; winner still gets clear private feedback if the surrounding maze UX already surfaces payout results (or a minimal private reason if not).
- [x] Tests cover maze reward under remaining allowance and at cap.
