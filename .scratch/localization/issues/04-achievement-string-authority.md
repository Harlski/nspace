---
Type: grilling
Status: resolved
Blocked by: 01
---

# Achievement and server-owned display strings

## Question

Achievements (and similar) today store English `title` / `description` in server definitions. How should localized display work end-to-end?

Agent recommendation to lock unless overridden: definitions expose **stable ids**; Message Catalog keys are derived from those ids (e.g. `achievements.<id>.title`); the **client** (and any non-admin HTML that shows them) calls `t(...)` for display. Wire/API may keep English for logs/admin or send ids only — player-visible paths must not depend on English fields when a Locale Preference is set. Same pattern for other server-owned player-visible labels discovered in the inventory.

## Answer

Definitions expose **stable ids**; Message Catalog keys derive from those ids (e.g. `achievements.<id>.title`). The **client** (and any non-admin HTML that shows them) calls `t(...)` for display. Wire/API may keep English for logs/admin or send ids only; player-visible paths must not depend on English fields when a Locale Preference is set. Same pattern for other server-owned player-visible labels from the inventory.
