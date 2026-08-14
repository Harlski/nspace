---
id: "02-temporarily-unavailable"
parent: .scratch/achievements-wave/PRD.md
triage: done
status: done
depends_on: []
---

# 02 — Temporarily unavailable + Progress Overview

## Parent

[`.scratch/achievements-wave/PRD.md`](../PRD.md)

**What to build:** Achievement rows can be **Temporarily unavailable** when the live feature
they depend on is off. The Achievements Window still lists them with that label. Incomplete
unavailable rows are omitted from **Progress Overview** earned/total (overall and
per-Category); **Complete** still counts. Football seasonal pause is unchanged. Completing
or progressing unavailable incomplete rows is ignored.

This ticket is the availability seam. Wiring the four Cosmetics commerce rows to Shop /
The Shaper happens in issue 06; tests here may use a fixture dependency.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Achievements API/window expose availability: Complete, in progress, or Temporarily
      unavailable.
- [ ] Temporarily unavailable copy is player-facing on the row; the row is not hidden.
- [ ] Incomplete Temporarily unavailable rows are out of Progress Overview fractions;
      Complete stays in.
- [ ] Events/counters for an incomplete unavailable definition do not Complete it.
- [ ] Football pause behavior is unchanged (no new label).
- [ ] Tests cover fraction math and the ignore-progress-while-unavailable rule.

## Comments
- Implemented in achievements-wave /implement pass (2026-08-14).
