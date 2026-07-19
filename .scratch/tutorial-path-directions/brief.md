# Tutorial Path — five unique mockup directions

Concept art only. No bootstrap / Staging / ADR changes in this pass.

## Shared constraints

- **Lesson:** Mine → Pay (Unlock Pad) → Exit (same pad as Teleporter Aftermath to Hub).
- **Footprint:** ADR 0006 portrait corridor ~7 wide × 15 deep, south → north.
- **Shapes:** Cubes, gold pyramids (Mine slots), sparse hex/half side accents. No billboards, no plaza, no stadium.
- **Place a block:** Deferred — not in these mockups.

## Comparison

| File | Direction | Mood | Best if you want… |
|------|-----------|------|-------------------|
| `01-mint-path.png` | **Mint Path** | Calm teal ribbon, cool dusk | Brand-safe default; strong lane guide |
| `02-gold-vein.png` | **Gold Vein** | Warm amber ore floor | Mine beat to dominate memory |
| `03-night-circuit.png` | **Night Circuit** | Charcoal + luminous markings | Distinct dark training room |
| `04-alcove-garden.png` | **Alcove Garden** | Soft moss + daylight wells | Welcoming / social warmth |
| `05-ceremony-lane.png` | **Ceremony Lane** | Symmetric procession + north glow | Pay/Exit as rite of passage |

## Direction blurbs

**Mint Path.** Teal center ribbon from spawn through green Unlock Pad to a brighter north. Gold pyramids are the only warm note; cool dusk walls stay quiet. Legible, friendly, low drama.

**Gold Vein.** Warm sandstone corridor with a molten amber floor vein. Three gold pyramids are the hero under warm key light; mint pad is the cool gateway accent. First beat (Mine) owns the frame.

**Night Circuit.** Charcoal walls and floor, hairline luminous lane markings, cyan pad beacon as the brightest object. Instrument-panel / nocturnal training room.

**Alcove Garden.** Mossy side cheeks, pale limestone, diffuse light wells. Pad sits in a soft green clearing; most organic and welcoming of the set.

**Ceremony Lane.** Plum/slate paired cheeks, pale center line, pad as flush threshold disk, north terminus with strong warm-white pull. Formal procession read.

## In-game style set (preferred for Staging)

Second pass matches current Hub isometric look (flat solid colors, cube/pyramid/hex/ramp/sphere only, teal void). Prefer these over the earlier painterly concept set when choosing what to build.

| File | Direction |
|------|-----------|
| `ingame-01-mint-path.png` | Mint Path — teal floor ribbon, purple-grey walls |
| `ingame-02-gold-vein.png` | Gold Vein — warm brown walls, amber center tiles |
| `ingame-03-night-circuit.png` | Night Circuit — charcoal/purple, cyan lane tiles |
| `ingame-04-alcove-garden.png` | Alcove Garden — grass + stone path, side pines only |
| `ingame-05-ceremony-lane.png` | Ceremony Lane — purple cheeks, pale stripe, green pad |

Hub screenshot used as style reference: same camera / lighting / matte blocks. No new prop types.

## Pick guidance

Judge on: (a) south→north sequence in two seconds; (b) pad as the single interactive object; (c) north exit pull. Shortlist two opposite moods (e.g. Night Circuit vs Alcove Garden) before committing. Mash-ups are fine (e.g. Mint Path ribbon + Ceremony north glow). Prefer **`ingame-*`** for build fidelity.

## Chosen: Alcove Garden → bootstrap

**Selected:** Alcove Garden (`ingame-04-alcove-garden.png` / preference image).

**Implemented** in [`server/src/tutorialTemplate/bootstrapShell.ts`](../../server/src/tutorialTemplate/bootstrapShell.ts):

- Grass `baseFloorColors` across the portrait bounds
- Gray center path (`extraFloor`), light-green pad clearing, soft north glow tiles
- Single-high dark green hedge at x=±3 with purple/cyan accents
- Six side pines (brown trunk + two green pyramids) on x=±2 (not on mine row)
- Gold mine pyramids at z=-5; Unlock Pad at mid Z=0

**Deploy note:** Live Tutorial Room uses the published Tutorial Template, not the bootstrap file alone. After pull: reset/reseed staging from bootstrap (or rebuild template) and **sync** the default template / `POST /api/admin/tutorial/reload-runtime` so players see it.
