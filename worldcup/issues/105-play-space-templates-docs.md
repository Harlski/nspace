---
id: "105-play-space-templates-docs"
milestone: M8
depends_on:
  - "102-play-space-template-resync-archive"
  - "103-play-space-template-admin-picker"
  - "104-play-space-ephemeral-edits"
triage: ready-for-agent
status: done
acceptance:
  - adr documents template store and ephemeral session edits vs guest confinement
  - features checklist and operator docs mention template persistence and admin routes
  - unreleased patch notes capture player-visible ephemeral editing and admin template management
verify:
  - "docs links resolve"
  - "npm run build"
---

# 105 — ADR, docs & patch notes

## Parent

[worldcup/PRD-play-space-templates.md](../PRD-play-space-templates.md)

## What to build

Document the shipped **Play Space Template** and **Ephemeral Session Edits** behavior:

- New **ADR** (next number in `worldcup/adr/`) covering template store, build shell snapshots,
  future-only resync, and ephemeral edits vs guest confinement (teleporters/gates forbidden).
- Update `docs/features-checklist.md` for admin template tab, default template, ephemeral
  editing, and new persistence/routes.
- Update `docs/process.md` (or relevant ops doc) for template store location and admin API
  surface.
- UNRELEASED patch notes: players (ephemeral co-building in Play Spaces), operators (admin
  templates tab, resync/archive), developers (store shape, API list).

Glossary in `worldcup/CONTEXT.md` already reflects grilled terms — verify alignment only.

## Acceptance criteria

- [ ] ADR merged with clear trade-offs and relationship to ADR 0003.
- [ ] `docs/features-checklist.md` updated.
- [ ] Operator/env documentation mentions template persistence path and admin endpoints.
- [ ] `patchnote/versions/UNRELEASED/public/*.md` updated for user-visible changes.
- [ ] No stale references claiming Play Spaces are read-only after seed.

## Blocked by

- [102-play-space-template-resync-archive](./102-play-space-template-resync-archive.md)
- [103-play-space-template-admin-picker](./103-play-space-template-admin-picker.md)
- [104-play-space-ephemeral-edits](./104-play-space-ephemeral-edits.md)
