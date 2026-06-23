# ADR 0004 — Play Space Templates & ephemeral session edits

**Status:** Accepted  
**Date:** 2026-06-23  
**Context:** [PRD-play-space-templates.md](../PRD-play-space-templates.md), [CONTEXT.md](../CONTEXT.md), [ADR 0003](./0003-guest-sessions-direct-invite.md)

## Decision

1. **Play Space Templates** are admin-managed **Build Shell** snapshots stored in
   `play-space-templates.json` (under `WORLD_STATE_DIR` or `server/data/`). They are not
   joinable rooms; they seed new Play Spaces at create time only.
2. **Build Shell** captures bounds, blocks, floor tints/removals, background, and join spawn.
   Teleporters, gates, signboards, billboards, voxel text, and extra spawns are stripped at
   snapshot time and remain forbidden in Play Spaces at runtime.
3. **Default template** — one active default; normal creators always receive it. System admins
   may pass `templateId` on `POST /api/invite/create` to pick any non-archived template.
4. **Resync** updates the stored shell from the bound **Template Source Room** for **future**
   Play Spaces only; already-open spaces keep their session layout.
5. **Ephemeral session edits** — all occupants may build/recolor within bounds for the session;
   nothing persists to world state or templates. This is distinct from **guest confinement**
   (ADR 0003): guests still cannot leave their Play Space via teleporters/gates because those
   tools are unavailable, not because edits are read-only.

## Rationale

- Operators need curated lounge layouts without hardcoding blocks in code.
- Play Spaces stay disposable: session co-building is fun; persisting every private room would
  bloat world state and blur the product boundary with wallet-owned rooms.
- Future-only resync avoids mutating live sessions when an operator updates a template.

## Consequences

- `DirectInviteRecord` stores `templateId`; invite-lobby rooms register per-room bounds from
  the template shell.
- `worldPersistence` skips invite-lobby room ids.
- Admin UI: `/admin/rooms` → **Play Space templates** tab; admin client picker when multiple
  active templates exist.

## Relationship to ADR 0003

ADR 0003 guest confinement and multi-person Play Space lifecycle are unchanged. This ADR adds
**how layouts are seeded** and **in-session editing** without granting guests cross-room travel.
