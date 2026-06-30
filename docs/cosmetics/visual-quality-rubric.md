# Cosmetic preset visual quality rubric

Every shipped **Preset** (achievement exclusive or shop SKU) must pass this review before its
`presetId` is registered in `server/src/cosmeticPresets.ts` and wired to player-facing
content.

## Capture locations (required)

1. **Wardrobe Preview** — identicon on the **Wardrobe Preview Backdrop** (3×3 floor patch + room
   sky). For trails, the static preview stub must read clearly behind the avatar.
2. **The Shaper** — gallery mannequin at default isometric camera (`cosmetic-gallery` / join code
   `SPACER`). Trail mannequins should be captured mid-pace along a lane.

Optional third angle: in-room on Hub or Commons floor tiles.

## Categories (score each 1–10)

| Category | What to judge |
|----------|----------------|
| **Readability** | Effect is legible at default gameplay zoom without squinting or zooming in. |
| **Terrain distinction** | Decals / motes read against painted floor tiles and default terrain — not camouflaged. |
| **Avatar legibility** | Identicon remains the primary focal point; VFX supports, never obscures. |
| **Motion clarity** | Trail smear or aura loop reads in a 2–3 second observation (Shaper pace / preview stub). |
| **Mobile performance** | Bounded spawn rate, no excessive overdraw; acceptable on portrait mobile browser play. |

## Overall rating rule

- **Overall score** = rounded **mean** of the five category scores.
- **Minimum category score** must be **≥ 6**.
- **Overall score** must be **≥ 7** to ship.

If either rule fails, do **not** register the preset — iterate art and re-review.

## Review artifacts

Store under [`reviews/`](./reviews/) per preset:

```
reviews/<presetId>/
  REVIEW.md          # scores, date, reviewer, notes
  wardrobe.png       # Wardrobe Preview capture
  shaper.png         # The Shaper mannequin capture
```

Reference presets included with cosmetics v2 slice 1:

- [`trail-ref-spark-path`](./reviews/trail-ref-spark-path/REVIEW.md)
- [`aura-ref-magic-ring`](./reviews/aura-ref-magic-ring/REVIEW.md)

## Engineering constraints (also checked at review)

- Declarative prefab definition in `client/src/cosmetics/cosmeticPrefabRegistry.ts` — no
  per-SKU code paths in the renderer.
- Trails are **movement-gated** in-room; preview uses the static stub only.
- All spawned meshes set `userData.skipBlockPickAndBounds = true`.
- Trail render order stays **below identicon sprites** (`renderOrder` 1 vs 2).

## Kenney attribution

Particle sprites live under [`client/public/assets/particles/kenney/`](../../client/public/assets/particles/kenney/)
(CC0 — see `LICENSE.txt`).
