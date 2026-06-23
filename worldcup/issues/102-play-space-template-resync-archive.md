---
id: "102-play-space-template-resync-archive"
milestone: M8
depends_on: ["101-play-space-template-admin-library"]
triage: ready-for-agent
status: done
acceptance:
  - admin can resync a template from its bound template source room; stored build shell updates
  - resync does not mutate already-open play spaces
  - resync fails clearly when source room is deleted/unavailable; template keeps last synced shell
  - admin can archive/unarchive templates and reassign template source room
verify:
  - "npm run build"
  - "npm test -w server"
  - "manual: edit source room, resync, new play space differs; open play space unchanged; archive hides from default/picker"
---

# 102 — Resync, archive & reassign source

## Parent

[worldcup/PRD-play-space-templates.md](../PRD-play-space-templates.md)

## What to build

Extend admin template management with lifecycle operations:

**HTTP:**

- `POST /api/admin/play-space-templates/:id/resync` — pull fresh **Build Shell** from bound
  **Template Source Room**; `409` when source deleted/unavailable.
- `PATCH` extensions: `archived: true/false`, `reassignSourceRoomId` (optional immediate
  resync after reassign is acceptable but not required).

**Rules:**

- **Resync** updates stored template only — **future** Play Spaces; already-open spaces
  unchanged.
- Archived templates cannot be set default or chosen for new Play Spaces.
- When source room is gone, template retains last synced layout; resync disabled in UI until
  source reassigned.

**Admin UI:** Resync button (disabled + reason when source unavailable), Archive/Unarchive,
Reassign source (room picker).

## Acceptance criteria

- [ ] Resync updates stored build shell from bound source room.
- [ ] Open Play Space geometry unchanged after resync (manual or test hook).
- [ ] Resync returns error when source unavailable; template data preserved.
- [ ] Reassign source enables resync again.
- [ ] Archive prevents default + new Play Space selection; unarchive restores.
- [ ] Admin UI exposes all actions with clear disabled states.

## Blocked by

- [101-play-space-template-admin-library](./101-play-space-template-admin-library.md)
