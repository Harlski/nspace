---
id: "02-free-play-under-allowance"
parent: .scratch/player-level/PRD.md
triage: done
status: done
depends_on:
  - "01-allowance-core-mining"
---

# 02 — Free Play goals under Allowance

**What to build:** Free Play Field goal rewards consume the same **Daily Earn Allowance** as mining. World Cup emergency env brakes still apply on top. When the allowance binds (partial or zero), the scorer gets a private signal in the same spirit as today's goal-reward cap note.

**Blocked by:** 01 — Allowance core + mining gate.

**Status:** done

## Parent

[`.scratch/player-level/PRD.md`](../PRD.md)

## Acceptance criteria

- [x] Contested/Solo Free Play goal NIM goes through the gameplay allowance gate before enqueue.
- [x] Paid luna counts toward the shared UTC-day spent total with mining.
- [x] World Cup per-wallet / global emergency knobs still evaluate; both gate and knobs must pass.
- [x] Scorer-only feedback when allowance partial-fills or blocks pay (room does not see remaining allowance).
- [x] 1v1 Matches still pay no NIM (unchanged).
- [x] Tests cover goal path under remaining allowance, at cap, and with emergency knobs enabled.
