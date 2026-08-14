---
id: "03-level-ladder-reward-catalog"
parent: .scratch/achievements-wave/PRD.md
triage: done
status: done
depends_on: []
---

# 03 — Level 5 / 10 / 15 + achievement-only nameplate/chat bubble catalog

## Parent

[`.scratch/achievements-wave/PRD.md`](../PRD.md)

**What to build:** Meta rows **On the Board** (Player Level 5, 25 points), **Double Digits**
(Level 10, 50 points, achievement-only Neon Frame nameplate), and **Established** (Level 15,
75 points). Register four `ach-*` SKUs that reuse the existing Simple/Neon nameplate and
Pastel/Dark chat bubble looks; shop Catalog Entries stay distinct and buyable. Silent
login catch-up for wallets already at those Levels (Complete + grant SKU, no Banner /
Celebration). No Level 11 row.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] On the Board / Double Digits / Established Complete at Player Level 5 / 10 / 15.
- [ ] No Level 11 achievement; Point Hunter I/II unchanged.
- [ ] Four `ach-*` nameplate/chat bubble SKUs exist, `achievement_only`, not shop-purchasable.
- [ ] Double Digits grants the Neon Frame `ach-*` SKU.
- [ ] Silent catch-up on login for current Player Level; live later unlocks still Banner.
- [ ] Tests cover thresholds, `achievement_only` reject, and silent vs live unlock policy.

## Comments
- Implemented in achievements-wave /implement pass (2026-08-14).
