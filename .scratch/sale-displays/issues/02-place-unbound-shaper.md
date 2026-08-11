# 02 — Place unbound in The Shaper (admin tab + live sync)

**What to build:** A game admin in The Shaper can place an unbound Sale Display via an
admin-only placement affordance (Campaign-tab spirit). Other admins in the room see the
admin-only silhouette; players do not. Place updates broadcast live without rejoining.
Placement works in The Shaper without opening general Building.

**Blocked by:** 01 — Sale Display store + Published bind rules

**Status:** done

- [x] Admin can place an unbound Sale Display in The Shaper
- [x] Non-admins cannot place
- [x] Players never see unbound displays; admins do
- [x] Room occupants update without rejoin after place
- [x] General Building / blocks remain locked in The Shaper

**Note:** Placement UX is **Build → Buildings → Sale Display** (not Admin overlay), with a
Shaper carve-out so the Build dock can author Sale Displays without unlocking general Building.
