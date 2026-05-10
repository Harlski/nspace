# Reasons — 0.3.9 (patch-notes version)

**Patch-notes version:** `0.3.9` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

- **Client:** Idle render gating no longer stops **active claimable (mineable) block** sparkle particles and emissive pulse from updating; those VFX keep requesting short render windows while any such block exists (`client/src/game/Game.ts`).
- **Patch notes:** Optional **`/patchnotes`** tier **Hotfix** (`public/04-hotfix.md`), collector + UI label (`client/src/patchnotes/collectPatchnotes.ts`, tests), and docs/skills (`docs/THE-LARGER-SYSTEM.md`, `docs/patchnotes-release.md`, `patchnote/README.md`, `.cursor/skills/hotfix-release-notes/SKILL.md`, companion [reason_384729.md](../../../docs/reasons/reason_384729.md)).

---

## By area

### Repo / docs

- `docs/THE-LARGER-SYSTEM.md` — *Public patch notes*: optional **Hotfix** tier workflow; points to hotfix skill.
- `docs/reasons/reason_384729.md` — rationale for documenting Hotfix tier in the larger system.
- `docs/patchnotes-release.md`, `docs/README.md`, `patchnote/README.md`, `MEMORY.md`, `AGENTS.md`, `docs/features-checklist.md` — Hotfix tier documented; PPA/CFD skills reference `04-hotfix.md` where relevant.

### Client

- **`client/src/game/Game.ts` — Mineable sparkle bypass:** `updateMineableBlockSparkles()` runs every tick whenever at least one block has `mineableSparklePoints`; returns whether any were present. `requestRender(250)` when `visualActive || hasMineableSparkles`. `animateDoorTiles()` remains gated on `visualActive` only.
- **`client/src/patchnotes/collectPatchnotes.ts`** — `PATCHNOTE_TIER_ORDER` includes `04-hotfix` (label **Hotfix**); non-empty `04-hotfix.md` bundles into `/patchnotes`.
- **`client/src/patchnotes/mdToHtml.test.ts`** — tier order regression test.

### Server

- _(none in this change set)_

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- _(none in this change set)_
