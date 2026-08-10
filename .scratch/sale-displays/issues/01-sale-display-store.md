# 01 — Sale Display store + Published bind rules

**What to build:** Operators can persist Sale Displays (create, move, delete, bind/clear) in
a dedicated store. Bind accepts only **Published**, shop-listable **Catalog Entries**. Wire
projection omits unbound (and non-Published binds) for players while admins still see those
handles. Verifiable via unit tests at the store and projection seams — no client placement
UI required yet.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] Create / move / delete / bind / clear persist and round-trip
- [x] Bind rejects Draft, Archived, and non-shop (e.g. achievement-only) Catalog Entries
- [x] Player wire omits unbound and non-Published binds; admin wire includes them
- [x] Slot-aware kind (mannequin vs floor) derives from the bound entry’s Preset Slot
- [x] Tests cover bind eligibility and wire projection at the agreed seams
