---
Type: grilling
Status: resolved
Blocked by: 01, 02, 03, 04
---

# Recommend next slices and new baseline

## Question

Which slices should ship first, in what order, and what is the estimated new baseline (10 / 20 / 30) once they are in place — vs what was tried and rejected?

## Answer

Ship: (1) presence → one-player `stateDelta`, (2) omit pose for active grid walkers on those messages + analytic `moveOrder` stamp, (3) client no-rewind + server-domain clock, (4) strip aliases/null cosmetics from tick snapshots.

New social-hub baseline: **0.09 / 0.32 / 0.68 MiB/min** server at N=10/20/30 vs **0.51 / 2.0 / 4.5** today. Then TDD the uncommitted rewind tests.

Rejected: pose-every-frame, protobuf-now, spatial avatars-first.

Full order: [../ANALYSIS.md](../ANALYSIS.md).
