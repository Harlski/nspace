---
title: Ambient Main Menu Cast
status: ready-for-agent
glossary: CONTEXT.md
adrs: []
depends_on_grill: CONTEXT.md (Main Menu, Ambient Cast, Face Token, Soft Density)
---

# Ambient Main Menu Cast

> Vocabulary follows [CONTEXT.md](../../CONTEXT.md): **Main Menu**, **Ambient Cast**,
> **Face Token**, **Soft Density**, **Hub**, **Commons**, **Tutorial Room**, **Play Space**,
> **Event Log**.

## Problem Statement

The Main Menu feels static and empty. Visitors get little sense that Nimiq Space is an active
multiplayer place before they connect. Shipping a live room behind the menu is the wrong tool;
what is needed is a lightweight “people were here today” atmosphere that still respects a lean
public payload (no wallet address list dumped to the homepage).

## Solution

Behind the Main Menu only, show an Ambient Cast: a flat abstract plane with isometric-flavored
identicon walkers (bare faces, light walk/idle motion, occasional generic emotes). Eligibility is
unique wallets that joined a public/shared room during the current UTC calendar day (Play Spaces
excluded). Faces are the exact public identicons; the public API returns Face Tokens only (opaque
collide-strings the client renders with `@nimiq/identicons`), never wallet IDs or display names.
Soft Density keeps ~8–12 on stage while cycling a larger unique set. Snapshot on load and about
every five minutes. Decoration only; quiet days stay sparse; no opt-out.

## User Stories

### Main Menu presence

1. As a visitor on the Main Menu, I want to see identicon figures walking on a shallow isometric
   plane behind the connect UI, so that the product feels inhabited before I sign in.
2. As a visitor, I want that cast to disappear once I leave the Main Menu for the real world, so
   that it never competes with gameplay.
3. As a visitor, I want the cast to be non-interactive (no hover identity, no click), so that it
   stays decoration and does not fight the connect CTA.
4. As a visitor on a quiet UTC day, I want to see only the few real faces that exist (including
   a single walker), so that the page does not fake a crowd.
5. As a visitor on a busy UTC day, I want at most about 8–12 walkers visible at once, so that the
   menu stays readable.
6. As a visitor who keeps the Main Menu open, I want new Face Tokens to appear over time via Soft
   Density cycling and a ~5 minute snapshot refresh, so that a long visit still feels alive.
7. As a visitor, I want occasional generic emotes (wave, heart, etc.) that are not claimed as that
   person’s real in-room emotes, so that the scene has life without becoming an activity feed.
8. As a visitor, I want walkers to use bare identicons only (no Loadout/cosmetics), so that the
   cast stays light and does not leak wardrobe state.
9. As a mobile visitor, I want the Ambient Cast to remain a background effect that does not block
   taps on connect controls, so that sign-in stays usable.
10. As a visitor with reduced motion preferences (if the client already respects them elsewhere),
    I want the Ambient Cast to degrade gracefully (slower or static faces) rather than break the
    menu, so that accessibility is not ignored.

### Eligibility and day bounds

11. As a player who joined the Hub (or another public/shared room) today UTC, I want my exact
    public identicon to be eligible for the Ambient Cast, so that real presence feeds the menu.
12. As a player who only visited a Play Space today, I do not want that join alone to put my face
    on the Main Menu, so that private hangs stay off the marketing shell.
13. As a player who only authenticated but never entered a public/shared room, I do not want to
    appear, so that bounce logins do not inflate the cast.
14. As a visitor, I want “today” to mean the UTC calendar day, so that the cast resets on a clear
    global boundary.
15. As a player, I accept there is no opt-out from Ambient Cast eligibility, so that the system
    stays simple (public shared presence is public).

### Privacy and payload

16. As a visitor inspecting the Ambient Cast network response, I want no wallet addresses and no
    display names in the snapshot, so that the homepage does not hand out a machine-readable
    visitor roster.
17. As a visitor, I still understand that exact faces are recognizable to anyone who knows those
    identicons, so that “address-free” is not mistaken for anonymity.
18. As a client, I want each face as a Face Token string I can pass to `@nimiq/identicons` without
    wallet address formatting, so that the snapshot stays tiny and rendering stays local.
19. As an operator, I want Face Tokens to be stable for a given wallet within a UTC day (same
    token for the same person in refreshes that day), so that Soft Density cycling does not
    thrash identities mid-visit without reason.

### Freshness and performance

20. As a visitor, I want a snapshot when the Main Menu opens, so that something appears quickly.
21. As a visitor who leaves the tab open, I want the snapshot to refresh about every five minutes,
    so that newcomers can appear without a live game connection.
22. As a visitor on a slow link, I want the first snapshot JSON to stay on the order of kilobytes
    even on busy days, so that the Main Menu stays lean.
23. As a visitor, I want Soft Density to fetch/render only the staged Face Tokens, so that a large
    unique set does not mean rendering everyone at once.

### Trust and non-goals visible to users

24. As a visitor, I do not want Ambient Cast figures to open profiles or whisper targets, so that
    decoration does not become social graph UI.
25. As a visitor, I do not want the abstract plane to look like a joinable live Hub layout, so that
    I am not misled into thinking it is the real world.

## Implementation Decisions

### Seams (testing)

1. **Primary seam — Ambient Cast snapshot API (public, unauthenticated).**  
   Input: UTC “today” Event Log (or equivalent join records) + public/shared vs Play Space
   classifier + Face Token resolver.  
   Output shape:

   ```json
   {
     "day": "2026-08-21",
     "refreshedAt": 1755748800000,
     "faces": [{ "token": "penou418vpz" }]
   }
   ```

   Tests assert: UTC day bounds; Play Space joins excluded; public/shared joins included;
   response never contains wallet addresses or display names; tokens are non-empty strings;
   empty day returns `faces: []`.

2. **Secondary seam — Soft Density selector (pure).**  
   Given `faces[]` and a visible cap (~8–12), decide the staged subset and cycling. Unit-tested
   without canvas.

3. **Visual layer (thin).**  
   Main Menu mounts an Ambient Cast canvas/WebGL-or-2D layer behind chrome. Manual/smoke only;
   no brittle pixel tests.

### Domain / product rules

- Exact public identicons (decision A from grill): Face Tokens are collide-strings that produce
  the **same** `@nimiq/identicons` image as the wallet’s user-friendly address hash.
- Face Tokens are **not** anonymity; they only keep addresses out of the public JSON and keep
  the payload lean.
- Eligibility: at least one join / `session_start` (or equivalent room-enter record) into a
  non–Play Space room during the UTC day. Hub, Commons, Tutorial Room, and other non–Play Space
  rooms count; Play Spaces (invite lobbies) do not.
- No opt-out; no Loadout; cosmetic-noise emotes only; decoration only; Main Menu only.
- Soft Density ~8–12 visible; refresh ~5 minutes; sparse days OK.
- Stage: flat abstract plane, isometric-flavored motion (not live tiles).

### Face Token generation

- Server derives the wallet’s identicon feature fingerprint via the same `makeHash` / part-index
  rules as `@nimiq/identicons`, then encodes those features as an opaque `ac1_…` Face Token
  (deterministic; memoized in-process). This keeps the wire lean without a multi-minute collide
  preimage search while still matching exact public pixels via `Identicons._svgTemplate`.
- Client **must not** run Face Tokens through wallet address chunk formatting; rendering uses the
  feature decode path (or a dedicated helper that skips `toNimiqUserFriendlyForIdenticon`).
- Token alphabet/length should avoid looking like `NQ…` addresses.

### Client integration

- Ambient Cast lives behind Main Menu chrome only; pointer-events none on the cast layer.
- Snapshot fetch uses the existing API base URL resolution.
- Soft Density and emote timers are client-side; server returns the unique Face Token set for the
  day (or a generous capped unique set if an operator safety cap is needed later — default is
  full unique set because tokens are tiny).

### Caching

- Snapshot responses should be cache-friendly for short TTL (aligned with ~5 minute freshness),
  without requiring auth.

## Testing Decisions

- Prefer external behavior at the snapshot API: fixtures of Event Log lines (or join records)
  → JSON body assertions (eligibility, exclusions, absence of `NQ` / address-shaped fields).
- Face Token resolver: given a wallet address, token’s rendered normalized SVG equals the
  wallet’s normalized SVG (strip random clipPath ids).
- Soft Density: deterministic unit tests for cap, empty input, and cycling when unique count
  exceeds cap.
- Do not snapshot-test canvas frames.
- Prior art: server Event Log day-file helpers; `identiconTexture` / `nimiqIdenticonServer` tests;
  Main Menu is existing UI mount point.

## Out of Scope

- Ghost / salted faces that differ from the public wallet identicon.
- Opt-in or opt-out settings.
- Echoing real in-room emotes or chat.
- Equipped cosmetics / Loadout on Ambient Cast walkers.
- Live room geometry, synced presence, or WebSocket on the Main Menu.
- Ambient Cast on surfaces other than the Main Menu.
- Publishing wallet addresses or display names on the Ambient Cast API.
- Embedding SVG/base64 identicons in the snapshot JSON.
- Privacy-policy legal copy rewrite (call out separately if product wants it).

## Further Notes

- Exact faces on a public marketing shell are an intentional recognition risk; Face Tokens only
  remove the easy roster scrape and keep the wire lean (~bytes per face vs ~4–9 KB data URLs).
- Preimage search for Face Tokens is CPU-heavy cold (~minutes per new wallet at current rates);
  a durable cache is part of making the feature production-safe.
- Tutorial Room counts as public/shared for eligibility unless a later decision excludes it;
  Play Space exclusion is the hard privacy line from the grill.
