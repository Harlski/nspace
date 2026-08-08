---
id: "05-summary-and-profile-level"
parent: .scratch/player-level/PRD.md
triage: done
status: done
depends_on:
  - "01-allowance-core-mining"
---

# 05 — Achievements Summary + public profile Level

**What to build:** The Achievements Window **Summary** shows Player Level, total Achievement Points, and progress toward the next Level (including vanity climb after L11). Public profiles show Player Level; remaining Daily Earn Allowance stays private.

**Blocked by:** 01 — Allowance core + mining gate (Level-from-AP).

**Status:** done

## Parent

[`.scratch/player-level/PRD.md`](../PRD.md)

## Acceptance criteria

- [x] Summary shows Level, lifetime Achievement Points, and progress within the current 100-AP band toward the next Level.
- [x] After L11 uncapped graduation, Summary still shows progress to the next vanity Level.
- [x] Unlock that changes totals refreshes Summary Level/progress without a full reconnect.
- [x] Public player profile exposes Player Level; does not expose remaining Daily Earn Allowance.
- [x] Tests cover Summary view-model Level/progress derivation (including L1 and post-L11).
