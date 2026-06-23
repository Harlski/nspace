---
id: "103-play-space-template-admin-picker"
milestone: M8
depends_on: ["101-play-space-template-admin-library"]
triage: ready-for-agent
status: done
acceptance:
  - system admin can pass templateId when creating a play space
  - admin client shows template picker on private room create flows; non-admins do not
  - archived templates cannot be selected
verify:
  - "npm run build"
  - "manual: admin picks non-default template, opens play space with that layout; non-admin still gets default"
---

# 103 — Admin template picker at Play Space create

## Parent

[worldcup/PRD-play-space-templates.md](../PRD-play-space-templates.md)

## What to build

Allow **system admins** to choose any **active** (non-archived) **Play Space Template** when
opening a new Play Space, without changing the global default.

**Server:** `POST /api/invite/create` (and any parallel WS create paths) accept optional
`templateId`; validate admin caller, template exists, not archived. Non-admins ignore client
supplied id and receive default server-side.

**Client:** Admin-only template picker in both Private Room entry paths (Home → Private Room,
Games → Soccer → 1v1 → Invite). List active templates with name (+ thumbnail if available).
Non-admin UX unchanged (no picker).

Shared template pool across creation paths — no activity filtering.

## Acceptance criteria

- [ ] Admin can create Play Space with a specific `templateId`; layout matches that template.
- [ ] Non-admin create ignores `templateId` and uses default.
- [ ] Archived templates rejected server-side.
- [ ] Admin picker visible only to system admins.
- [ ] Both Play Space creation entry paths use the same picker/pool.

## Blocked by

- [101-play-space-template-admin-library](./101-play-space-template-admin-library.md)
