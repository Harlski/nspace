---
title: Play Space Templates — admin layouts & ephemeral session editing
status: ready-for-agent
glossary: worldcup/CONTEXT.md
adrs:
  - worldcup/adr/0003-guest-sessions-direct-invite.md
depends_on_grill: worldcup/CONTEXT.md (Play Space Template, Build Shell, Ephemeral Session Edits)
---

# Play Space Templates — admin layouts & ephemeral session editing

> Vocabulary follows [worldcup/CONTEXT.md](./CONTEXT.md): **Play Space**, **Play Space
> Template**, **Build Shell**, **Template Source Room**, **Default Play Space Template**,
> **Archived Play Space Template**, **Ephemeral Session Edits**.

## Problem Statement

Every **Play Space** today seeds from a single hardcoded lounge layout baked into the
server. Operators cannot curate starting environments from rooms players have already
built, cannot maintain a library of layouts, and cannot refresh a template when a source
room evolves. Creators always land in the same scenery regardless of context.

Meanwhile, **Play Spaces are fully read-only** after seeding — occupants cannot rearrange
the space together for the session, which limits the social “hang out and mess with the
room” use case.

## Solution

Introduce **Play Space Templates**: admin-managed **Build Shell** snapshots that seed new
Play Spaces when a player creates a **Private Room**. Templates are not joinable on their
own — players only experience them through a new join link.

Admins manage templates from a **Play Space templates** tab on **`/admin/rooms`**: create
from any room with a persisted build shell, bind a **Template Source Room**, **Resync**
future spaces from that source, set one **Default Play Space Template**, and **Archive**
retired layouts.

When a Play Space opens, it receives a **copy of the chosen template at creation time**.
**All occupants** may make **Ephemeral Session Edits** (full build within bounds for the
session); nothing writes back to the template, source room, or disk. Teleporters and gates
remain forbidden so **Guest** confinement holds.

## User Stories

### Admin — template library

1. As a system admin, I want a **Play Space templates** tab on the admin rooms page, so that
   template management lives alongside existing room tooling.
2. As a system admin, I want to **create a Play Space Template** by choosing any room with a
   persisted build shell (player-owned, official, or built-in), so that great community builds
   can become private-room starting layouts.
3. As a system admin, I want the create flow to **snapshot the Build Shell** at that moment,
   so that the template captures bounds, blocks, floor tints/removals, background, and join
   spawn without teleporters, gates, signboards, billboards, voxel text, or per-player spawns.
4. As a system admin, I want each new template to be **permanently bound** to its **Template
   Source Room**, so that I can resync later without re-picking the room every time.
5. As a system admin, I want to **name** a template and see a **thumbnail/preview** of its
   layout, so that I can recognize layouts in the library.
6. As a system admin, I want to **edit template metadata** (display name, optional description),
   so that the library stays organized.
7. As a system admin, I want to **set exactly one Default Play Space Template**, so that
   ordinary creators automatically get a curated starting layout.
8. As a system admin, I want changing the default to **clear the previous default**, so that
   there is never ambiguity about which template non-admins receive.
9. As a system admin, I want to **Resync** a template from its Template Source Room, so that
   the stored Build Shell matches the source room’s current build.
10. As a system admin, I want **Resync to affect only future Play Spaces**, so that open
    sessions are not rearranged under occupants’ feet.
11. As a system admin, I want **Resync disabled** when the Template Source Room is deleted or
    unavailable, while the template **keeps its last synced layout**, so that creation never
    breaks silently.
12. As a system admin, I want to **reassign** a new Template Source Room when the old one is
    gone, so that resync can work again.
13. As a system admin, I want to **Archive** a template, so that it cannot be chosen for new
    Play Spaces or set as default but remains in the library.
14. As a system admin, I want to **Unarchive** an archived template, so that retired layouts
    can return to active use.
15. As a system admin, I want archived templates **hidden from the admin create picker** for
    new Play Spaces, so that retired layouts are not accidentally selected.

### Admin — source room constraints

16. As a system admin, I want **Play Spaces and Match Pitches excluded** as template sources,
    so that ephemeral rooms are never long-lived binding targets.
17. As a system admin, I want to snapshot from **Hub, Chamber, Canvas, Pixel, official, and
    player rooms** when they have persisted geometry, so that any durable build shell qualifies.
18. As a system admin, I want the admin UI to reuse **existing room preview/thumbnail**
    infrastructure when picking a source room, so that template authoring feels consistent
    with the rooms manager.

### Creator — opening a Play Space

19. As a wallet player creating a **Private Room**, I want the **Default Play Space Template**
    applied automatically with **no picker**, so that opening a space stays one tap as today.
20. As a system admin creating a **Private Room**, I want to **choose any active template**
    before the space opens, so that I can dogfood layouts before making one the default.
21. As a creator opening via **Home → Private Room** or **Games → Soccer → 1v1 → Invite**, I
    want **the same shared template pool**, so that layout choice is not fragmented by entry
    path.
22. As a creator, I want my Play Space join link and QR to work as today after creation, so
    that sharing behavior is unchanged aside from the starting layout.

### Occupants — ephemeral editing

23. As any **Play Space occupant** (creator or Guest), I want to **place, move, remove, and
    recolor** blocks and floor within room bounds during the session, so that the group can
    customize the hangout together.
24. As a Play Space occupant, I want my edits to **sync live** to everyone in the room, so
    that building feels cooperative.
25. As a Play Space occupant, I want session edits to **never persist** when the Play Space
    closes, so that templates and source rooms stay authoritative.
26. As a Guest, I want **Ephemeral Session Edits** in my Play Space, so that I am not a second-
    class builder compared to the creator.
27. As a Guest, I want **teleporters and gates unavailable** in Play Spaces even during
    ephemeral edits, so that I cannot leave the space I was invited into.
28. As a creator who leaves and returns, I want to see **the same ephemeral layout** the group
    built while I was away (until teardown), so that the session state is shared not personal.

### Play Space lifecycle

29. As the system, I want each new Play Space to store **which template id** seeded it (for
    debugging/support), so that operators can trace layout issues.
30. As the system, I want Play Space teardown to **discard all in-memory geometry** for that
    invite-lobby room id, so that ephemeral edits never leak into world persistence.
31. As the system, I want **template resync** to leave **already-open** Play Spaces unchanged,
    so that template versioning does not require migration of live rooms.
32. As the operator, I want a **migration path** from the current hardcoded lounge to a default
    template seeded from that layout (or equivalent), so that behavior is preserved on deploy.

### Guests & confinement (regression)

33. As a Guest, I want to remain **confined** to my Play Space and its Match Pitches, so that
    direct-invite security rules from ADR 0003 still hold.
34. As the system, I want world-state persistence to **skip invite-lobby room ids**, so that
    ephemeral session edits never write room geometry files.

### Documentation & ops

35. As an operator, I want env/docs updated for any new persistence location and admin routes,
    so that deploys are predictable.
36. As a developer reading patch notes, I want player-visible copy for new ephemeral editing
    and admin template management, so that releases are explainable.

## Implementation Decisions

### Primary module seam (single deep module)

Consolidate template persistence and build-shell transform in one server module (working
name: **play space template store**) that owns:

- **Build Shell** type: bounds, obstacles (sanitized), extra/base floor data, removed base
  tiles, background hue/neutral, join spawn tile.
- **Extract** build shell from a live room id (reuse sanitization rules aligned with the
  existing design-export path — teleporters, gates, claimables stripped).
- **Apply** build shell into an in-memory invite-lobby room (seed on first entry).
- **Template CRUD**: create (snapshot + bind source), read list/detail, patch metadata,
  archive/unarchive, set default (exclusive), reassign source, resync.
- **Validation**: source room must not be ephemeral; archived templates not defaultable;
  exactly one default among active templates.

`rooms.ts` and direct-invite create flow call thin wrappers (`seedPlaySpaceFromTemplate`,
`resolveTemplateForCreator`) rather than embedding layout logic inline. The hardcoded
`PLAY_SPACE_BLOCKS` array becomes the seed data for the initial default template or a
one-time bootstrap, not the runtime path.

### Persistence

- New versioned JSON store for templates (separate from `rooms.json` and per-room world
  files), e.g. `play-space-templates.json` with entries: id, displayName, optional
  description, archived flag, isDefault, sourceRoomId, sourceAvailable flag (derived),
  buildShell payload, createdAtMs, updatedAtMs, lastSyncedAtMs.
- Template ids: opaque stable strings (uuid or slug), unrelated to invite slugs.
- Play Space invite record (`DirectInviteRecord`) gains optional `templateId` field set at
  create time for traceability.

### Admin HTTP API

- `GET /api/admin/play-space-templates` — list (active + archived sections).
- `POST /api/admin/play-space-templates` — body: `sourceRoomId`, `displayName`; snapshots
  and binds source.
- `GET /api/admin/play-space-templates/:id` — detail + preview payload.
- `PATCH /api/admin/play-space-templates/:id` — metadata, archive, unarchive, setDefault,
  reassignSourceRoomId.
- `POST /api/admin/play-space-templates/:id/resync` — pulls fresh build shell from bound
  source; 409 if source unavailable.

All routes: system-admin wallet JWT (same gate as `/api/admin/rooms`).

### Admin UI

- New tab on admin rooms page: template cards with name, source room label, default badge,
  archived badge, thumbnail (reuse layout snapshot endpoint or template-specific preview).
- Actions: Create (room picker → name), Edit metadata, Set default, Resync, Archive/Unarchive,
  Reassign source (room picker).

### Play Space creation

- `POST /api/invite/create` (and WS paths that open Play Spaces) accept optional `templateId`
  for admins; non-admins ignore and receive default template id server-side.
- Server validates template exists, not archived.
- On first player entering invite-lobby room: apply template build shell once (replace
  current `ensurePlaySpaceLayout` hardcoded path).

### Ephemeral session edits (behavior change)

- **Change** invite-lobby rooms from read-only to editable for all occupants (`canEditRoomContent`
  returns true for Play Spaces, with placement rules still forbidding teleporters/gates).
- Seeded blocks start **unlocked** (or editable) so full ephemeral edit includes removing
  template scenery.
- World persistence layer **excludes** invite-lobby room ids from save/load paths (defense in
  depth alongside existing teardown `clearPlaySpaceLayout`).
- Teardown on Play Space close continues to wipe in-memory maps for that room id.

### Default template bootstrap

- On first server start with empty template store: auto-create one template from the current
  hardcoded lounge (or equivalent build shell) marked default, with no source room (resync
  disabled until admin assigns source). Preserves today’s look without manual setup.

### Client

- Admin Play Space create: template picker UI (admins only) before/alongside existing invite
  create flows.
- No template picker for non-admin creators.
- Build HUD enabled in Play Spaces when server grants edit permission (may already hide based
  on server messages — align client gating with new server behavior).

### ADR

- Add **ADR 0004** (or next number) documenting ephemeral session edits + template store:
  reverses read-only Play Space seeding; documents guest confinement vs build permissions.

## Testing Decisions

### Proposed seam (confirm with implementer)

**One primary seam:** the **play space template store + build shell** module.

- Pure unit tests: extract sanitization (no teleporters/gates in shell), apply round-trip,
  default exclusivity, archive prevents selection, resync updates stored shell only,
  resync blocked when source missing, create binds source room id.
- Prior art: `server/test/directInvite.test.ts` (store/reducer), `server/test/design-snapshot.test.ts`
  (export sanitization), `server/test/playSpaceLayout.test.ts` (bounds/spawn invariants —
  retarget to template-driven shells).

**Secondary integration tests (minimal):**

- Play Space room id not present after persistence tick (ephemeral edits not saved).
- `seedPlaySpaceFromTemplate` leaves passable join spawn.

Avoid testing admin HTML directly; test HTTP JSON contracts.

Good tests assert **observable behavior** (shell contents, flags, HTTP status codes), not
internal map mutation order.

## Out of Scope

- Promoting user rooms to **Official rooms** or public catalog entries.
- Per-activity template pools or activity-tagged pickers (metadata tag optional later).
- Creator-facing template picker for non-admin players (v1: default only).
- Persisting ephemeral session edits beyond Play Space lifetime (“save my party layout”).
- Copying signboards, billboards, voxel text, teleporters, or gates into templates.
- Resyncing or mutating **already-open** Play Spaces.
- Match Pitch layout templates (Match Pitches keep field template).
- Player-authored templates or marketplace.
- Hard-delete templates (archive only in v1).

## Further Notes

- Grilling clarified “official room clone” was a misspeak — everything is Play Space
  Templates, not catalog promotion.
- Teleporters/gates forbidden for entire Play Space session (including ephemeral edits) to
  preserve Guest confinement per ADR 0003.
- Reuse `RoomLayoutSnapshot` / design-export sanitization where possible; Build Shell is a
  subset aligned with **Build Shell** glossary definition.
- Update `docs/features-checklist.md` and UNRELEASED patch notes when shipping.
- After `/to-issues`, split into independently implementable issues (suggested order: store +
  build shell → admin API/UI → seed on create → ephemeral edits → bootstrap/migration → docs).
