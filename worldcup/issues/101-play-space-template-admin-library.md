---
id: "101-play-space-template-admin-library"
milestone: M8
depends_on: ["100-play-space-template-bootstrap"]
triage: ready-for-agent
status: done
acceptance:
  - system admin can list play space templates from admin rooms page tab
  - admin can create a template by picking a source room and naming it; build shell snapshots and source room is bound
  - admin can edit template display name/description and set exactly one active default
  - ephemeral rooms cannot be used as template sources
verify:
  - "npm run build"
  - "npm test -w server"
  - "manual: admin snapshots hub, sets default, new private room uses hub build shell"
---

# 101 — Admin template library (create, list, set default)

## Parent

[worldcup/PRD-play-space-templates.md](../PRD-play-space-templates.md)

## What to build

End-to-end admin workflow for **Play Space Template** library v1:

**HTTP (system-admin JWT):**

- `GET /api/admin/play-space-templates` — list active templates (archived may be omitted or
  in a separate section in a follow-up issue).
- `POST /api/admin/play-space-templates` — `sourceRoomId`, `displayName`; snapshots **Build
  Shell**, permanently binds **Template Source Room**.
- `PATCH /api/admin/play-space-templates/:id` — metadata (`displayName`, optional
  `description`), `setDefault: true` (clears previous default).

Reject ephemeral rooms (Play Spaces, Match Pitches) as sources. Allow player, official, and
built-in rooms with persisted geometry.

**Admin UI:** new **Play Space templates** tab on `/admin/rooms` — template cards with name,
source room label, default badge, thumbnail/preview reusing existing room preview
infrastructure. Create flow: room picker → name → save. Set-default action on a card.

Non-admin Play Space creation continues to use the default template only (no picker yet).

## Acceptance criteria

- [ ] Admin API routes exist and require system-admin wallet auth.
- [ ] Create template snapshots build shell and binds source room id.
- [ ] Ephemeral room ids rejected as source with a clear error.
- [ ] Exactly one active template may be default; setting a new default clears the old one.
- [ ] Admin tab lists templates and supports create + set default.
- [ ] Thumbnail or preview visible on template cards (reuse existing admin preview plumbing).
- [ ] New private room by non-admin uses whichever template is marked default (including a newly
      created one).

## Blocked by

- [100-play-space-template-bootstrap](./100-play-space-template-bootstrap.md)
