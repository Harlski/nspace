---
title: Cosmetic Shop — catalog, entitlements, Wardrobe & Deployables
status: ready-for-agent
glossary: CONTEXT.md (Cosmetics, Wardrobe, Wardrobe Preview, Items Sector, Items Wheel)
depends_on_grill: CONTEXT.md § Cosmetics; Wardrobe UX grill session (2026-06)
---

# Cosmetic Shop — catalog, entitlements, Wardrobe & Deployables

> Vocabulary follows [CONTEXT.md](../../CONTEXT.md): **Catalog Entry**, **Preset**,
> **Cosmetic SKU**, **Slot**, **Entitlement**, **Loadout**, **Wardrobe**, **Deployable**,
> **Cosmetic Unlock**, **Grant**, **Catalog Changelog**, **Catalog Preview**, **Wardrobe Preview**,
> **Items Sector**, **Items Wheel**, **Deployables Allowed**, **Cosmetic Store**.

## Problem Statement

Players cannot personalize their in-world presence beyond username, profile message, and
country flag. Nimiq Space has no way to sell optional, non-gameplay cosmetics for NIM, no
operator tooling to manage a shop catalog, and no path for players to express identity through
auras, nameplates, chat bubble styling, movement trails, or short-lived tile effects.

Operators need to create and tune shop listings (name, price, collections, deploy rules)
without redeploying the server for every price change, preview how items look on any wallet,
audit who changed what, grant items for events, and retire listings without revoking
ownership from existing buyers.

## Solution

Introduce a **Cosmetic Shop** backed by the **Cosmetic Store** (SQLite tables in the
existing campaign database on the game server):

- Operators manage **Catalog Entries** from **`/admin/cosmetics`**: pick a dev **Preset**,
  set metadata and (for Deployables) cooldown/duration/room cap/range, preview on any wallet
  via **Catalog Preview**, lifecycle **Draft → Published → Archive**, and view **Catalog
  Changelog** on each edit screen. Operators may **Grant** Entitlements without payment.
- Players buy **Published** entries once with NIM via **Cosmetic Unlock** (Payment Intent
  Service, price locked at intent create).
- Players manage owned items in **Wardrobe** (profile): a paper-doll equip UI for **Loadout**
  passives (one per **Slot**), plus a **Shop** tab to browse by **Collection**.
- Players **use** **Deployables** from a new **Items Sector** on the **Action Wheel** (arm →
  tap walkable tile); server validates rules from the Catalog Entry. Room owners may disable
  deployables per room (**Deployables Allowed**, default on).

Visual rendering stays client-side per Preset; v1 is metadata-only in admin (no VFX editor).

## User Stories

### Operator — catalog management

1. As a system admin, I want a **`/admin/cosmetics`** page in the admin hub, so that I can manage the cosmetic catalog without editing the database by hand.
2. As a system admin, I want to **create a Catalog Entry** by choosing a **Preset** from a server-exposed registry, so that new shop items do not require a server deploy.
3. As a system admin, I want to assign an immutable **Cosmetic SKU** slug when creating an entry, so that entitlements and payment intents have a stable key even when display names change.
4. As a system admin, I want the **Slot** to be read-only and inherited from the chosen Preset, so that I cannot accidentally sell an aura Preset as a deployable.
5. As a system admin, I want to set **display name**, **description**, **price in NIM**, **collection** (free text), and **sort order** on a Catalog Entry, so that the player shop is presentable and organized.
6. As a system admin, I want new Catalog Entries to start as **Draft**, so that unfinished listings are not purchasable.
7. As a system admin, I want to **Publish** a Draft entry, so that it appears in the player shop and accepts Cosmetic Unlocks.
8. As a system admin, I want to **Archive** a Published entry, so that new purchases stop while existing owners keep their Entitlements.
9. As a system admin, I want **Archived** entries to remain visible in admin (not hard-deleted), so that history and Entitlements stay coherent.
10. As a system admin, I want to edit Published entries (name, price, deploy rules, etc.) without changing the Cosmetic SKU, so that marketing and tuning do not break ownership records.
11. As a system admin, I want a **Catalog Changelog** timeline on each SKU edit screen, so that I can see who changed what and when.
12. As a system admin, I want each changelog row to record **actor wallet**, **timestamp**, **action** (`created`, `updated`, `published`, `archived`, `granted`), and **before/after** snapshots of admin-editable fields, so that support and audits are tractable.
13. As a system admin, I want **Catalog Preview** on the edit/browse UI with a wallet address field (defaulting to my own), so that I can see how a Preset or Catalog Entry renders on any identicon without that player being online.
14. As a system admin, I want the preset registry list to show **presetId**, human label, and **Slot**, so that I pick the correct effect type.
15. As a system admin, I want unauthenticated or non-system-admin access denied on the page and admin APIs, so that catalog and grant tools stay restricted.

### Operator — deployable tuning

16. As a system admin, when creating or editing a **Deployable** Catalog Entry, I want to set **cooldown seconds**, **effect duration seconds**, **room cap** (max simultaneous instances of this SKU in one room), and **deploy range** (max tile distance from player), so that I can tune spam and room clutter per listing.
17. As a system admin, I want Preset defaults to pre-fill those four fields on create, so that I start from sensible baselines.
18. As a system admin, I want changes to deploy rules logged in the Catalog Changelog like price and name changes, so that incident response can trace rule changes.

### Operator — grants

19. As a system admin, I want to **Grant** an Entitlement for a Cosmetic SKU to any wallet from admin without NIM payment, so that I can reward events, compensate players, or test listings.
20. As a system admin, I want Grant actions recorded in the Catalog Changelog with target wallet and actor, so that free awards are auditable.

### Player — shop & purchase

21. As a signed-in player with a wallet, I want to open the **shop** from **Wardrobe** on my profile, so that I can browse cosmetics without leaving the social flow.
22. As a player, I want the shop to show only **Published** Catalog Entries grouped by **Collection** (case-insensitive), so that the catalog is readable and hides Draft/Archived items.
23. As a player, I want to see price in NIM and a short description for each listing, so that I can decide before paying.
24. As a player, I want **Wardrobe Preview** on shop listings before purchase, so that I do not buy blind.
25. As a player, I want to buy a cosmetic with a **one-off NIM payment** (Cosmetic Unlock), so that I own it permanently without subscriptions or repurchase.
26. As a player, I want a successful payment to grant an **Entitlement** immediately, so that the item appears in Wardrobe right away.
27. As a player, I want checkout to use the same Hub / Nimiq Pay flow as other in-app NIM payments, so that the experience is familiar.
28. As a player, I want the amount I pay to match the price quoted when I started checkout, even if the operator reprices before my transaction confirms, so that I am not surprised at verify time.
29. As a player, I want checkout to fail clearly if the listing was **Archived** before my payment completes, so that I do not pay for something no longer sold.
30. As a player, I want to be blocked from buying a Cosmetic SKU I already own, so that I do not double-pay for the same Entitlement.
31. As a guest without a wallet, I want shop purchase disabled, so that cosmetics remain wallet-gated (I may still see others’ Loadouts).

### Player — Wardrobe & Loadout

32. As a player, I want **Wardrobe** on my profile to show my passive **Slots** in a paper-doll layout (identicon center, aura / nameplate / chat bubble / trail around it), so that equipping feels like a character sheet rather than a flat list.
33. As a player, I want each **Slot** to open a dropdown listing owned **Entitlements** for that **Slot** plus **Published** shop listings I do not own, so that I can equip or shop in one place.
34. As a player, I want to **select** a row in a slot dropdown to **Wardrobe Preview** it on the center identicon (live passive VFX) before committing, then press **Equip** to save **Loadout**, so that I do not equip by accident while browsing.
35. As a player, I want **Unequip** available per **Slot** (clear **Loadout** for that **Slot**), so that I can return to default appearance.
36. As a player, I want at most **one equipped item per Slot**, equipping a new one to replace the previous in that Slot, so that visuals stay readable.
37. As a player, I want equipping to be free and instant after I own the **Entitlement**, so that **Loadout** changes do not cost NIM.
38. As a player, I want my **Loadout** persisted server-side across sessions, so that I do not re-equip every login.
39. As a player, I want only **one slot dropdown open at a time**; opening another closes the previous and reverts its uncommitted **Wardrobe Preview**, so that the panel stays focused.
40. As a player, I want closing my profile to revert any uncommitted **Wardrobe Preview** without a prompt, so that **Loadout** in the room always matches what I equipped.
41. As a player in a room, I want to see other players’ equipped passive cosmetics (auras, nameplates, bubble skins on their messages, trails), so that cosmetics are social signals.
42. As a player viewing another player’s profile, I want a read-only paper doll (equipped passives + deployables they own shown in an **Items** strip), so that I see their style without their full owned list.

### Player — Shop (Wardrobe tab)

43. As a signed-in player, I want a **Shop** tab on my profile alongside **Wardrobe**, grouped by **Collection**, with a compact identicon preview above the grid, so that I can discover cosmetics by collection while still seeing **Wardrobe Preview** on my avatar.
44. As a player, I want shop rows to support **Wardrobe Preview**, **Buy** (when not owned), and **Equip** (when owned), consistent with slot dropdowns, so that behavior is predictable across tabs.
45. As a player, I want row thumbnails to use **Preset** swatches in v1 (with optional live thumb on focus later), so that dropdowns stay fast on mobile.

### Player — Deployables & Action Wheel

46. As a player who owns **Deployables**, I want an **Items** strip below the paper doll listing owned deployables (view-only; “use from Action Wheel”), so that passives and deployables stay mentally separate.
47. As a player who owns Deployables, I want an **Items Sector** on the root **Action Wheel**, so that using a deployable is a deliberate in-world action separate from emotes.
48. As a player, I want the **Items Wheel** to list only Deployables I own, with cooldown indication when I cannot reuse one yet, so that I know what is available.
49. As a player, I want selecting a Deployable to **arm** deployment (clear cursor/hover state), then tap a **walkable floor tile** in range to fire it, so that the interaction matches “use item on tile.”
50. As a player, I want the effect to appear for everyone in the room for the configured **duration**, so that deployables are shared spectacle.
51. As a player, I want the server to enforce **cooldown**, **room cap**, **range**, and **Deployables Allowed** on the room, so that spam and griefing are bounded.
52. As a player, I want a clear system or HUD message when deployment fails (cooldown, cap, room disabled, out of range, not walkable), so that I understand why nothing happened.

### Room owner

53. As a room owner, I want a **Deployables Allowed** toggle in **Room settings** (default on), so that I can disable tile effects in rooms where they would clutter builds or events.
54. As a room owner, I want Loadout passives to still work when deployables are disabled, so that personal expression remains while room effects are off.
55. As a room owner, I want the setting persisted on the room and enforced by the server, so that clients cannot bypass it.

### Developer / payment integration

56. As a developer, I want Cosmetic Unlocks to use the **Payment Intent Service** with feature kind **`nspace.cosmetic.unlock`** and payload `{ cosmeticSku }`, so that incoming NIM verification stays centralized.
57. As a developer, I want the game server to grant Entitlements idempotently when an intent confirms, so that duplicate verify calls do not double-grant.
58. As a developer, I want intent creation to reject Draft/Archived SKUs and already-owned SKUs, so that invalid checkout fails early.
59. As a developer, I want a public read API for the Published catalog and authenticated APIs for Wardrobe (owned + Loadout), so that client and admin stay in sync with the Cosmetic Store.

### Regression / platform

60. As a developer shipping **`/admin/cosmetics`**, I want Vercel rewrites added for both root and client `vercel.json` in the same change, so that split SPA hosting does not 404 the new admin route.
61. As a player, I want cosmetic VFX to use **client-only visuals** on avatars (decorative, no block pick hijacking), consistent with existing identicon/nameplate/chat bubble conventions, so that cosmetics do not break build or profile interactions.
62. As an operator, I want the Cosmetic Store in the **same SQLite file** as the campaign store, so that backup and ops match existing advertise DB practices.
63. As a developer, I want the Wardrobe paper-doll UI to use **WoW-inspired chrome** (ornate slot frames, equipped-state emphasis) with CSS hooks reserved for future **rarity** tiers, so that quality tiers can ship without a layout rewrite.

## Wardrobe UX — paper-doll equip menu

> **Status:** Spec locked (grill session). Replaces the v1 flat Owned/Shop list UI in
> `client/src/cosmetics/wardrobePanel.ts` when implemented. Visual mockups: Cursor canvas
> `wardrobe-equip-style-picker` (variant **B** selected).

### Scope

- **Self profile only** (top-bar identicon / in-game profile overlay). Replaces the passive
  equip + shop experience; profile message, rooms, moderation, and NIM send stay as today.
- **Other players’ profiles:** read-only paper doll (equipped passives) + read-only **Items**
  strip (deployables they own). No dropdowns, shop, or owned-unEquipped lists.

### Tabs

| Tab | Purpose |
|-----|---------|
| **Wardrobe** | Paper doll + passive **Slot** ring + **Items** strip (deployables). Primary equip surface. |
| **Shop** | **Collection** grid + compact identicon **Wardrobe Preview** (mini doll). Discovery and purchase. |

The old **Owned** list tab is removed; ownership is expressed through per-**Slot** dropdowns
and the **Items** strip.

### Visual treatment (variant B)

- **WoW-inspired chrome:** ornate slot frames, corner accents, equipped-slot border emphasis,
  RPG-style panel framing. Palette stays Nimiq Space (dark panels, orange accent) — not a
  literal Blizzard asset clone.
- **Rarity (v1):** no catalog field or tier colors. Slot and row chrome use a single neutral
  “quality” frame; CSS/design tokens reserved so operator-set rarity (future) can swap border
  glow per tier without changing layout.

### Wardrobe tab — layout

**Desktop (wide):** WoW-analog slot positions around center identicon + live passive VFX:

```
        [ Nameplate ]
[ Aura ]  (identicon)  [ Chat bubble ]
        [ Trail     ]
─────────────────────────
      Items (deployables strip)
```

**Narrow (mobile / Nimiq Pay):** identicon + VFX centered on top; four **Slots** in a 2×2
grid below; slot dropdown **full width** under the grid. **Items** strip at bottom. (Shop tab
always uses grid + mini doll — no slot ring on narrow.)

**Center preview:** player identicon with **live passive VFX** (`loadoutVfx`) reflecting
current **Wardrobe Preview** state for all **Slots** (merged with saved **Loadout** for
slots without a pending preview).

### Slot dropdown (one open at a time)

Opening a **Slot** shows a dropdown anchored to that slot button:

1. **Owned** rows for that **Slot** (from **Entitlements**), including **Unequip** / empty.
2. Divider.
3. **Published** shop rows for that **Slot** not yet owned (price, **Buy**).

Each row includes a small square thumbnail:

- **v1:** static **Preset** swatch (slot-specific: aura color ring, nameplate border chip,
  bubble shape, trail dot, deployable icon).
- **Later:** optional live identicon thumb on hovered/focused row only (one WebGL thumb at a
  time).

**Interaction:**

| Action | Effect |
|--------|--------|
| Select row | **Wardrobe Preview** only — updates center (and mini doll on Shop tab if linked). |
| **Equip** | `PUT /api/cosmetics/loadout` for that **Slot**; persists **Loadout**. |
| **Cancel** | Revert preview for that **Slot** to last saved **Loadout**. |
| **Buy** | **Cosmetic Unlock** flow (Hub / Nimiq Pay); on grant, row moves to owned. |
| Open another **Slot** | Close current dropdown; **revert** uncommitted preview for the closed slot. |
| Close profile | Revert all uncommitted **Wardrobe Preview** silently (no prompt). |

Only one dropdown open at a time.

### Items strip (deployables)

Below the paper doll on **Wardrobe** tab:

- Horizontal row of owned **Deployable** **Entitlements** (swatch squares).
- No **Loadout** equip; tooltip/copy: use from **Action Wheel → Items Sector**.
- Same **B** chrome as slot buttons; rarity hooks apply when tiers exist.

### Shop tab

- **Top:** compact identicon + live VFX (**mini doll**) — same **Wardrobe Preview** state as
  Wardrobe tab.
- **Below:** scrollable **Collection** grid (Published **Catalog Entries** only).
- Each card: swatch, name, description, price, **Wardrobe Preview**, **Buy** or **Equip**.
- Selecting preview on a card updates the **Slot** implied by the entry’s **Preset** on the
  mini doll (same select-then-**Equip** / **Buy** rules as slot dropdowns).

### Client modules (when implemented)

- Replace / supersede `wardrobePanel.ts` with paper-doll component(s) mounted from
  `client/src/ui/hud.ts` self-profile path (`oppProfileWardrobe`).
- Reuse existing APIs: `fetchWardrobe`, `updateLoadoutSlot`, unlock intent + sync.
- Reuse `Game.setSelfCosmeticPreviewSlot` / `clearSelfCosmeticPreview` /
  `refreshSelfCosmeticsFromState` for **Wardrobe Preview** until equip commits.
- Decorative children: existing `skipBlockPickAndBounds` convention unchanged.

### Supersedes (prior v1 list UI)

The following shipped list-based Wardrobe behavior is **deprecated by this spec** when the
paper doll ships:

- Separate **Owned** tab with flat equip rows.
- **Try on** / **Clear preview** on Shop tab without slot context.
- Shop-only preview that does not share the paper-doll preview model.

### Player — shop & purchase (unchanged intent)

Stories 21–31 (shop access, collection grouping, purchase, price lock, guest gating) remain;
UI moves into slot dropdowns + **Shop** tab per above.

### Player — Wardrobe & Loadout (legacy numbering)

_The following original stories are superseded by 32–45 above: flat owned list (32), generic
equip from list (33–37), other-profile chips-only (39), deployables in list without strip (46)._

## Implementation Decisions

### Primary module: Cosmetic Store

All durable cosmetic state lives behind one **Cosmetic Store** module on the game server (new tables migrated into the existing campaign SQLite database). This module is the **single seam** for:

- Catalog Entry CRUD and lifecycle (Draft / Published / Archived)
- Catalog Changelog append-only writes and per-SKU read
- Entitlement grant (purchase fulfill, admin Grant) and ownership checks
- Loadout read/write (one Entitlement per passive Slot)
- Published catalog reads for shop
- Deploy rule resolution for a Deployable SKU (Catalog Entry overrides with Preset defaults; code-enforced floors/ceilings on numeric fields)
- Admin preset registry (static list exported from server, sourced from same manifest the client uses or a shared constant package)

No parallel JSON files for catalog or entitlements.

**Catalog Entry fields (admin-editable):**

- `cosmeticSku` (immutable after create; unique)
- `presetId` (immutable after create recommended; if changed in v1, treat as breaking and log heavily — prefer immutable)
- `status`: `draft` | `published` | `archived`
- `displayName`, `description`, `collection`, `sortOrder`
- `priceLuna` (integer luna; display as NIM in UI)
- Deployable-only: `cooldownSec`, `durationSec`, `roomCap`, `deployRange` — nullable in DB with Preset defaults applied at read time when null

**Preset registry entry (code-defined, not admin-authored in v1):**

- `presetId`, `label`, `slot` (`aura` | `nameplate` | `chatBubble` | `trail` | `deployable`)
- Default deploy params for deployable presets
- Optional: `previewThumbnail` key for admin list (client renders preview)

**Catalog Changelog row:**

- `id`, `cosmeticSku`, `atMs`, `actorWallet`, `action`, `beforeJson`, `afterJson`

**Entitlement row:**

- `wallet`, `cosmeticSku`, `grantedAtMs`, `source` (`purchase` | `grant`), optional `intentId` / `txHash` for purchases

**Loadout row (per wallet):**

- `wallet`, `auraSku?`, `nameplateSku?`, `chatBubbleSku?`, `trailSku?` — each null or owned Entitlement matching Slot

### Payment Intent Service

Register handler **`nspace.cosmetic.unlock`**:

- `validatePayload`: `{ cosmeticSku: string }` required
- `quote`: read Published Catalog Entry price from game server or replicated quote endpoint; return `amountLuna` and metadata `{ cosmeticSku }`

Game server flow:

1. Authenticated player `POST` create unlock intent for `cosmeticSku` → server validates Published + not owned → calls Payment Intent Service → returns intent to client
2. Client completes Hub/Pay send with memo
3. On verify (existing poll/webhook pattern used for billboards), game server grants Entitlement idempotently and records purchase linkage

**Price lock:** intent stores quoted `amountLuna` at create; verify matches stored amount, not live catalog price. If Catalog Entry is Archived before confirm, fail verify with clear reason.

### Admin HTTP API (system admin wallet JWT)

- `GET /api/admin/cosmetics/presets` — preset registry
- `GET /api/admin/cosmetics/catalog` — all entries (all statuses) for admin list
- `POST /api/admin/cosmetics/catalog` — create Draft (requires `cosmeticSku`, `presetId`, …)
- `GET /api/admin/cosmetics/catalog/:sku` — entry + changelog page
- `PUT /api/admin/cosmetics/catalog/:sku` — update metadata/deploy rules; append changelog on diff
- `POST /api/admin/cosmetics/catalog/:sku/publish` — Draft → Published
- `POST /api/admin/cosmetics/catalog/:sku/archive` — Published → Archived
- `POST /api/admin/cosmetics/catalog/:sku/grant` — body `{ wallet }` → Entitlement + changelog `granted`

Admin HTML shell **`/admin/cosmetics`**: list + edit form + Catalog Preview pane (wallet field + canvas/WebGL preview using shared preset ids) + changelog panel + grant panel. Nav link in admin hub.

### Player HTTP API (JWT where noted)

- `GET /api/cosmetics/shop` — Published entries only, grouped by collection
- `GET /api/cosmetics/wardrobe` — require JWT: owned Entitlements + Loadout
- `PUT /api/cosmetics/loadout` — require JWT: equip/unequip passive slots (validate ownership + Slot match)
- `POST /api/cosmetics/unlock-intent` — require JWT: create payment intent for `cosmeticSku`

Extend **`GET /api/player-profile/:address`** or **`welcome`** payload with public Loadout for passive slots (for other players to render). Self receives full Wardrobe via dedicated endpoint or welcome extras.

### WebSocket (room authority)

- Include others’ Loadout passive SKU ids (or resolved preset ids) in player snapshots / welcome as needed for client rendering — keep payload compact.
- New client intent: **`deployCosmetic`** `{ cosmeticSku, x, z }` — server validates Entitlement, Deployable Slot, room **Deployables Allowed**, walkable tile, range, cooldown per wallet, room cap per SKU, then broadcasts **`cosmeticDeployed`** event `{ cosmeticSku, presetId, x, z, by, expiresAt }` to room.
- Cooldown state: server-tracked per wallet per SKU (in-memory with optional short TTL persistence not required v1).

### Room settings

- Add **`deployablesAllowed: boolean`** (default `true`) to room persisted settings (same authority as room background / entry spawn).
- Expose in build dock **Room settings**; enforce in deploy intent handler.

### Client

- **Preset renderer**: map `presetId` + Slot to client VFX (start with a small shipped set, e.g. 2–3 presets per Slot including one deployable demo).
- **Wardrobe UI** on own profile: paper-doll equip menu per **Wardrobe UX** section (variant **B** chrome, slot dropdowns, **Wardrobe Preview**, **Shop** tab with mini doll + collection grid). Supersedes list-based `wardrobePanel.ts` when shipped.
- **Other-player profile**: read-only paper doll + **Items** strip (no shop/dropdowns).
- **Action Wheel**: new **Items Sector** → **Items Wheel**; arm state; tile pick defers to existing walkable pick path with armed overlay.
- Render passives on remote avatars from Loadout in player state; chat bubble skin when creating bubble for sender; trail on movement tick.
- Decorative avatar children: mark `skipBlockPickAndBounds` per existing convention.

### Code-enforced safety ceilings (deploy params)

Apply min/max when admin saves Deployable Catalog Entry (document defaults in implementation docs), e.g.:

- `cooldownSec`: 5–3600
- `durationSec`: 1–60
- `roomCap`: 1–20
- `deployRange`: 1–5 tiles

Exact numbers are implementation constants, not admin-editable.

### Preset immutability on Catalog Entry

Recommend **`presetId` immutable** after Catalog Entry create (if wrong Preset chosen, Archive entry and create new SKU). Reduces changelog complexity and client cache keys.

## Testing Decisions

### Primary test seam: Cosmetic Store module

**Prefer one high seam:** all behavior tests hit the **Cosmetic Store** (and its thin HTTP/WS adapters) without rendering or chain details. This matches prior art: campaign/rotation set store tests and payment-intent probe tests — durable state + validation at the module boundary.

**What makes a good test here:**

- Exercise **observable outcomes**: row state, error codes, changelog rows, entitlement existence, loadout slots, deploy validation accept/reject.
- Do **not** assert internal SQL query strings or private helper names.
- Use isolated temp SQLite DB per test file (same pattern as campaign store tests).

**Modules tested:**

| Module / layer | Behavior |
|----------------|----------|
| Cosmetic Store | Catalog lifecycle; slug uniqueness; Published-only shop reads; Archive blocks new intents; changelog on create/update/publish/archive/grant; Entitlement grant idempotency; Loadout one-per-slot + ownership validation; deploy rule resolution (entry override vs preset default); safety ceiling rejection |
| Payment fulfill adapter | Given confirmed intent metadata `{ cosmeticSku }`, grants Entitlement once; skips if Archived at fulfill time |
| Deploy intent handler (via rooms test or store helper) | Cooldown, room cap, range, deployablesAllowed, non-walkable reject |

**Prior art:**

- Server store tests under `server/test/` (e.g. player profile store, campaign patterns)
- `paymentIntentProbe.test.ts` for payment sidecar URL normalization (reference only; cosmetic handler gets dedicated quote/validate tests if extracted)

**Out of test scope for v1 automated suite:**

- Admin HTML page rendering
- WebGL Catalog Preview pixels
- Client preset particle appearance (manual QA)
- End-to-end chain payment (manual or staging; unit-test fulfill path with mocked verify)

**Optional narrow second seam (only if needed):** Payment Intent Service `nspace.cosmetic.unlock` handler quote/validate unit tests in `payment-intent-service` — keep thin; game server remains source of truth for catalog price at quote time via API call or shared read.

## Out of Scope

- **Creator Catalog Entry** — player-authored prefab SKUs / UGC shop
- Admin-authored **Presets** or VFX editor (visuals ship with client releases)
- **Entitlement revocation** or refunds
- Managed **Collection** entities (v1: free text only)
- Hard **delete** of Catalog Entries
- Subscriptions, rentals, or consumable re-purchase
- Gameplay advantages (speed, build rights, moderation immunity)
- Operator-configurable safety ceilings from admin UI
- Trading or gifting Entitlements between wallets
- Cosmetic marketplace secondary sales

## Further Notes

### Suggested implementation phases

1. Cosmetic Store schema + preset registry + admin CRUD/changelog/grant + Catalog Preview shell
2. Payment Intent `nspace.cosmetic.unlock` + Entitlement on fulfill
3. Wardrobe + public shop APIs + list-based profile UI + purchase flow *(shipped baseline)*
3b. **Paper-doll Wardrobe UX** — replace list UI per **Wardrobe UX** section; variant **B** chrome; mobile layouts
4. Loadout sync on welcome + client passive rendering (minimum one Preset per passive Slot)
5. Items Sector + deploy intent + room **Deployables Allowed** + one demo Deployable Preset

### Future (post-v1)

- **Creator Catalog Entry** with moderation and prefab-derived Presets
- **Cosmetic rarity** — optional tier on **Catalog Entry** (operator-set); colored slot/row chrome using v1 CSS hooks
- Seasonal catalog operations (bulk Archive, collection landing pages)
- Entitlement revoke for abuse (needs policy)

### Related principles

- Client-only passive VFX on avatars — see `docs/THE-LARGER-SYSTEM.md` (client-only visuals; skip block pick)
- Player-adjacent persistence in bounded SQLite — see Cosmetic Store decision above
- New `/admin/*` route → both Vercel rewrite files in same change
