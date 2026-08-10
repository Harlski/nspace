---
title: Sale Displays
status: ready-for-agent
glossary: CONTEXT.md
adrs:
  - docs/adr/0015-sale-displays.md
depends_on_grill: CONTEXT.md (Sale Display, The Shaper, Catalog Entry, Cosmetic Unlock)
---

# Sale Displays

> Vocabulary follows [CONTEXT.md](../../CONTEXT.md): **Sale Display**, **The Shaper**,
> **Catalog Entry**, **Preset**, **Cosmetic Unlock**, **Wardrobe**, **Slot**.
> Decision record: [docs/adr/0015-sale-displays.md](../../docs/adr/0015-sale-displays.md).

## Problem Statement

The Shaper auto-stages every cosmetic **Preset** on a fixed layout. Operators cannot place,
move, or curate what is on the shop floor, and there is no reusable in-world fixture that
points at a **Catalog Entry** for sale. Merchandising cannot live in Hub/Commons either.
Admins need empty-then-configure placeable sale fixtures, not another auto gallery.

## Solution

Ship **Sale Displays**: admin-placed in-world fixtures that start unbound and bind to one
**Published Catalog Entry**. Players click a bound display for try + buy (existing Cosmetic
Unlock / Wardrobe Shop patterns). Unbound displays are admin-only. Slot-aware visuals
(mannequin vs floor deployable) show the entry’s Preset. Authoring uses a Campaign-billboard-
style admin tab (place / move / remove / edit bind) in any room admins may author, including
The Shaper without opening general Building. The Shaper’s auto Preset gallery is retired;
The Shaper becomes a curated floor of Sale Displays. Kiosks outside The Shaper are allowed.
Wardrobe Shop stays.

## User Stories

### Admin — place, move, remove

1. As a game admin, I want an admin-only Sale Display placement affordance (Campaign-tab
   spirit), so that I can put fixtures without general Building.
2. As a game admin, I want to place an unbound Sale Display in The Shaper, so that I can
   layout the showroom even though Building is otherwise locked there.
3. As a game admin, I want to place Sale Displays in other rooms I may author (e.g. Hub,
   Commons), so that kiosks can live outside The Shaper.
4. As a game admin, I want placing a Sale Display to finish without choosing a Catalog Entry
   yet, so that I can layout first and bind later.
5. As a game admin, I want to move a Sale Display after place, so that I can adjust layout.
6. As a game admin, I want to remove a Sale Display, so that retired merchandising leaves the
   world.
7. As a non-admin, I want no way to place, move, remove, or rebind Sale Displays, so that the
   shop floor stays operator-owned.

### Admin — bind and edit

8. As a game admin, I want clicking an unbound Sale Display to open an edit modal, so that I
   can bind a Catalog Entry.
9. As a game admin, I want the modal to list **Published** Catalog Entries only, so that I
   cannot offer Draft or Archived goods in-world.
10. As a game admin, I want to pick entries such as nameplate or trail SKUs by their shop
    identity, so that merchandising matches the catalog players buy.
11. As a game admin, I want to rebind a Sale Display to a different Published Catalog Entry,
    so that seasonal swaps do not require delete + place.
12. As a game admin, I want to clear a bind (return to unbound), so that a fixture can leave
    player view without being deleted.
13. As a game admin, I want unbound Sale Displays visible only to admins (silhouette / handle),
    so that players never see empty pedestals.

### Player — see and buy

14. As a full player with the shop open, I want to see bound Sale Displays with slot-aware
    presentation (mannequin for passives, floor for deployables), so that the world reads as
    a showroom.
15. As a player, I want click/tap on a bound Sale Display to open a try + buy panel, so that
    I can preview and purchase without hunting the Wardrobe.
16. As a player, I want Buy on that panel to use Cosmetic Unlock (same intent / verify path as
    Wardrobe Shop), so that payment and entitlements stay one system.
17. As a player who already owns the SKU, I want Owned / Equip affordances on the panel, so
    that the display is still useful after purchase.
18. As a guest, I want bound displays visible when the shop is open, but no purchase path
    that assumes a full wallet session beyond existing guest rules, so that guests are not a
    second shop system.
19. As a player when the shop is closed (`SHOP_ENABLED` off), I want Sale Display buy to fail
    the same way Wardrobe Shop does, so that gates stay consistent.
20. As a player, I never want to see unbound Sale Displays, so that empty fixtures stay ops-
    only.

### Catalog lifecycle

21. As a player, when a bound Catalog Entry is later Archived, I want that Sale Display to
    drop out of my view (as if unbound) until an admin rebinds or removes it, so that retired
    SKUs cannot be bought from the floor.
22. As a game admin, when a bound entry is Archived, I still want to see the fixture and edit
    it, so that I can rebind or remove it.
23. As a game admin, I want the same Catalog Entry on multiple Sale Displays, so that I can
    duplicate merchandising across rooms or aisles.
24. As an operator, I want achievement-only / non-shop SKUs excluded from the bind picker the
    same way they are excluded from the player shop, so that unlock-only rewards are not
    sold from the floor.

### The Shaper and Wardrobe

25. As a player visiting The Shaper, I want to see only placed Sale Displays (no auto grid of
    every Preset), so that the room is curated.
26. As a player, I want Wardrobe Shop (featured shelf, Buy / Owned / Equip) unchanged, so that
    catalog UI still works without walking the floor.
27. As a player, I want Leave the Shaper / return behavior unchanged, so that navigation is
    not disturbed.
28. As an operator with `SHAPER_ENABLED=0`, I want The Shaper unreachable as today, without
    orphaning Sale Displays that already exist in other rooms.

### Sync and presence

29. As a player already in a room, when an admin places, moves, removes, or rebinds a Sale
    Display, I want my view to update without rejoining, so that live curation works.
30. As an admin joining a room, I want to see both bound (player-visible) and unbound
    (admin-only) Sale Displays for that room, so that I can continue editing.

## Implementation Decisions

- Follow ADR 0015: Sale Displays bind **Published Catalog Entries**; retire auto Preset
  gallery; admin placement tab; unbound admin-only; kiosks outside The Shaper allowed.
- Persist Sale Displays in a dedicated store modeled on campaign billboards (create / bind /
  move / delete / toWire / dirty persist), not inside Build Shell blocks.
- Authoring ACL: game admin only. Placement must work in The Shaper via an explicit carve-out;
  do **not** flip `canPlaceBlocksInRoom` open for general Building there.
- Room sync: broadcast room Sale Display snapshots after mutate (billboards pattern), not
  welcome-only. Welcome still seeds the room on join.
- Wire for player viewers: omit unbound; omit displays whose Catalog Entry is no longer
  Published (treat as unbound for players). Admins receive unbound + archived-bound handles.
- Render: reuse mannequin / floor / trail presentation keyed by the Catalog Entry’s Preset
  and Slot; retire proximity try-on pad grid as the primary buy path in favor of click →
  try + buy panel.
- Buy / equip: reuse existing cosmetics shop HTTP + Cosmetic Unlock; no new payment feature
  kind.
- Bind picker source: same Published shop listing as players (exclude achievements /
  non-shop). No Draft bind in v1.
- Wardrobe Shop, Player Menu Shop entry, shop/shaper env gates unchanged unless a tiny hook
  is required for in-world panel open.

## Testing Decisions

Good tests assert external behavior at module edges (inputs → wire / eligibility), not
private mesh or HUD wiring.

Seams (agreed):

1. **Cosmetic Store bind eligibility** — Published-only (and shop-listable) Catalog Entry
   resolution for bind and for player-visible wire fields. Prior art:
   `cosmeticStore` unit tests.
2. **Welcome / room payload builder** — evolve the pure gallery payload into Sale Display
   projection: from placed fixtures; players omit unbound / non-Published; admins see
   unbound; Slot → mannequin|floor. Prior art: `cosmeticGallery` unit tests (auto Preset
   layout assertions replaced).
3. **Thin Sale Display store** — create / bind / move / delete / toWire / persist dirty flag,
   billboards-shaped. Prefer not unit-testing full room WS handlers for v1.

Optional later: shop gate tests already cover unlock closed; client view-model only if a
pure projector appears.

## Out of Scope

- Binding Presets directly, or a second product catalog beside Catalog Entries.
- Draft-bound Sale Displays (admin preview of unpublished SKUs in-world).
- Opening The Shaper to general Building / floor paint / blocks.
- Creator / UGC Catalog Entries.
- Replacing Wardrobe Shop or daily featured shelf.
- Player-placed shop stalls.
- Rotating multi-SKU carousels on one fixture (one Catalog Entry per Sale Display).
- Revoking Entitlements or changing Cosmetic Unlock economics.
- Auto-migrating the old Preset grid into Sale Displays (operators place fresh).

## Further Notes

- Unbound silhouette should be obviously ops-facing (not confused with a for-sale product).
- Prefer one Sale Display footprint convention that does not block walkability worse than
  current gallery mannequins.
- After ship, docs/features-checklist and process notes must drop “one showcase per Preset”
  language and describe Sale Displays + admin tab.
