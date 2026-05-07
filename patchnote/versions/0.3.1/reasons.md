# Reasons — 0.3.1 (patch-notes version)

**Patch-notes version:** `0.3.1` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

**Status:** No curated public Nimiq Space patch post ships from this bucket until the [public/](public/) tiers are filled and published.

---

## Summary

_Add a one-line roll-up here when the buffer gets long._

- Patch notes are **version-scoped**: each `patchnote/versions/<version>/` holds `reasons.md` plus tiered [public/](public/) summaries.
- Prior top-level `reasons_UNRELEASED.md` redirects to this file.

---

## By area

### Repo / docs

- `patchnote/README.md` — version layout, freezing, public tiers.
- `patchnote/versions/0.3.1/` — this tree; `public/*.md` for audience-specific summaries.
- `patchnote/reasons_UNRELEASED.md` — stub → `versions/0.3.1/reasons.md`.
- `MEMORY.md`, `AGENTS.md`, `docs/README.md` — links updated to versioned layout.

### Client

- [client/src/game/Game.ts](../../../client/src/game/Game.ts) — **Active claimable (mineable) blocks:** additive `THREE.Points` sparkles (`makeMineableSparklePoints`), animation (`updateMineableBlockSparkles`), emissive pulse on gold mesh; `PointsMaterial` uses `depthTest: false` + fixed pixel `size` so glints read under orthographic camera; decorative children use `userData.skipBlockPickAndBounds`, no-op `raycast`, and `blockGroupWorldBoundsForSelectionOutline` so build-mode selection wireframe matches solid mesh only.
- [docs/build.md](../../../docs/build.md) — rendering bullet mentions mineable client visuals.
- [docs/THE-LARGER-SYSTEM.md](../../../docs/THE-LARGER-SYSTEM.md) — principle: client-only overlays on authoritative geometry; [docs/reasons/reason_834162.md](../../../docs/reasons/reason_834162.md).

### Server

- _(none in this change set)_

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- _(none in this change set)_
