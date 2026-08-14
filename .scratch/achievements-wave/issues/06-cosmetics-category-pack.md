---
id: "06-cosmetics-category-pack"
parent: .scratch/achievements-wave/PRD.md
triage: done
status: done
depends_on:
  - "01-shop-admin-runtime-gate"
  - "02-temporarily-unavailable"
  - "03-level-ladder-reward-catalog"
---

# 06 — Cosmetics Category pack

## Parent

[`.scratch/achievements-wave/PRD.md`](../PRD.md)

**What to build:** Cosmetics Category Navigator group with **Window Shopper** (open Shop),
**Enter The Shaper**, **Try Before You Buy** (Sale Display try/buy preview), **Paid in
Style** (first Cosmetic Unlock purchase), **Framed** (persist nameplate on Loadout),
**Caption** (persist chat bubble on Loadout). While Shop is closed, the first four show
Temporarily unavailable (issue 02). If only The Shaper is hidden, only Enter The Shaper
uses that state. Try does not Complete Framed/Caption; Suited Up unchanged. Silent
catch-up for Framed, Caption, and an existing shop purchase.

**Blocked by:** 01 Shop admin runtime gate; 02 Temporarily unavailable; 03 reward catalog

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Cosmetics Category lists the six rows; Getting started / Telescope set unchanged.
- [ ] Window Shopper, Enter The Shaper, Try Before You Buy, Paid in Style are Temporarily
      unavailable when Shop is closed; progress ignored until Shop reopens.
- [ ] When Shop is open and The Shaper is hidden, only Enter The Shaper is Temporarily
      unavailable.
- [ ] Try Completes Try Before You Buy only; Loadout save Completes Framed/Caption.
- [ ] Paid in Style Completes on entitlement source purchase only (not achievement/admin
      grants); silent catch-up if a purchase already exists.
- [ ] Framed/Caption silent catch-up from current Loadout; live unlocks Banner.
- [ ] Tests cover Shop/Shaper availability matrix, try vs Equip, purchase vs grant.

## Comments
- Implemented in achievements-wave /implement pass (2026-08-14).
