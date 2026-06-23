# Public patch notes — developers (`UNRELEASED`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- New module `server/src/playSpaceTemplate/` — Build Shell type, JSON store, admin routes; bootstrap default from legacy `playSpaceLayout`.
- `DirectInviteRecord.templateId`; `ensurePlaySpaceLayout()` applies template shell per invite-lobby room.
- Ephemeral edits: `canEditRoomContent` / block placement enabled in invite-lobby; teleporter/gate placement blocked; `worldPersistence` skips invite-lobby ids.
- Client: admin template picker on Play Space create when multiple active templates; `createDirectInvite(token, { templateId? })`.
- ADR: [worldcup/adr/0004-play-space-templates.md](../../../worldcup/adr/0004-play-space-templates.md).
