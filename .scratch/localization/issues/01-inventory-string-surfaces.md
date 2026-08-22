---
Type: research
Status: resolved
Blocked by:
---

# Inventory user-facing string surfaces

## Question

What are all **user-facing** string surfaces in this repo that v1 localization must cover (and which are clearly admin-only or otherwise out of map scope)?

Produce a cited inventory grouped by: game client UI modules, achievements / feedback / other player-visible client features, non-admin server HTML pages, static client HTML (terms/privacy), and explicitly **out of scope** (admin pages, user-authored, third-party).

Estimate rough scale (file count / notable large modules) to inform sequencing in a later spec — do not propose the implementation plan here.

## Answer

v1 covers player UI (esp. `hud.ts` / `main.ts`), achievements + feedback chrome, World Cup/invite/tutorial/wardrobe chrome, non-admin SSR (`/payouts`, `/advertise`, guide; `/analytics` allowlisted), and terms/privacy shells; out are `/admin/*`, authored content, and Hub/Pay UI. Scale: ~41 UI modules (~18.6k-line `hud.ts`), ~127 achievement titles, multi-k-line advertise/analytics pages.

Full inventory: [research/01-inventory-string-surfaces.md](../research/01-inventory-string-surfaces.md)
