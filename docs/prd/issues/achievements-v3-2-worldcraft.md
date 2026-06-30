---
id: "achievements-v3-2-worldcraft"
milestone: achievements-v3
depends_on: ["achievements-v3-0-engine"]
triage: ready-for-agent
status: done
verify:
  - "npm test -w server -- achievementStore"
  - "npm run build"
  - "manual: recolor floor, place shapes, publish prefab, signpost, gate, furnished room"
---

# Achievements v3 — slice 2: Worldcraft

PRD: [../achievements-v3-exploration-building-meta.md](../achievements-v3-exploration-building-meta.md)  
Parent: [../achievements-v3-exploration-building-meta.md](../achievements-v3-exploration-building-meta.md)

## What to build

Ship the **Worldcraft** category (`worldcraft`, optional **building** group in navigator) end-to-end.

| Achievement | Rule (summary) |
|-------------|----------------|
| Palette Painter I / II | 50 / 200 distinct floor recolors outside Pixel room; same tile twice does not count |
| Rainbow Floor | ≥12 distinct hues used on floor tiles in one editable room (fire on 12th unique hue) |
| Architect's Toolkit | Lifetime: placed at least one cube, hex, pyramid, sphere, ramp (five one-time shape events) |
| Prefab Author | First public prefab published |
| Prefab Curator | 5 public prefabs each with ≥1 placement by another wallet |
| Signpost Scribe | Place signpost message ≥40 chars |
| Signpost Reader | Open 10 distinct signposts by other authors (modal open server event) |
| Gatekeeper | Open a gate you do not own in Hub (one-time) |
| Trust Circle | On someone else's gate ACL, walk through while closed to others (one-time) |
| Room Maker Deluxe | Composite: create room + ≥25 blocks + join spawn set + ≥5 distinct floor recolors |

Wire existing gameplay boundaries: floor recolor, block place (shape), design publish/stamp, new signboard-open event, gate open/ACL walk, room create + furnish tracking.

**User stories:** 17–28

## Acceptance criteria

- [ ] `worldcraft` category in Achievements Window
- [ ] Palette Painter excludes Pixel room; distinct tile dedupe for recolors
- [ ] Rainbow Floor tracks per-room hue set; unlocks at 12th unique hue in one room
- [ ] Architect's Toolkit requires all five shapes lifetime (separate one-time completions)
- [ ] Prefab Author / Curator use publish + stamp with author ≠ stamper
- [ ] Signpost Reader fires on modal open only, deduped by signpost id
- [ ] Room Maker Deluxe composite fires once when all requirements met
- [ ] Store tests for composites and dedupe; build passes

## Blocked by

- [achievements-v3-0-engine](achievements-v3-0-engine.md)
