# Nimiq Space — Domain Language

Canonical names for cross-cutting concepts in the social space. Use these in code, UI
copy, and discussion. This file is a glossary only — no implementation details. The
seasonal soccer feature keeps its own glossary in [worldcup/CONTEXT.md](worldcup/CONTEXT.md).

## Self Interaction

**Action Wheel**:
The hexagonal menu that opens around your own avatar when you right-click (desktop) or
long-press (touch) yourself. The single entry point for self-actions. Its root level
offers Sectors; drilling into one opens a sub-wheel.
_Avoid_: radial menu, donut, self-menu, emote menu, pie menu, context menu,
shortcut menu.

**Player Menu**:
The persistent bottom-right circular identicon button that opens player-level navigation
and account options, such as Wardrobe, Shop, Rooms, Return to Hub, and Logout. Distinct
from the Action Wheel: it is for navigating the app/session, not performing in-world
self-actions.
_Avoid_: character window, account menu, navigation menu.

**Sector**:
One of the six fixed edges of the Action Wheel hexagon. Each holds at most one action;
edges with nothing to show today are drawn as dim, non-interactive **reserved** Sectors
so the hexagon always reads whole.
_Avoid_: slice, wedge, segment, item.

**Emote Wheel**:
The sub-wheel reached by selecting the Emotes Sector — a ring of emote choices. Replaces
the old quick-emoji strip.
_Avoid_: emoji strip, emote menu.

**Items Sector**:
A root-level Action Wheel edge that opens the **Items Wheel** — owned Deployables with
cooldown state. Selecting one arms tile deployment; distinct from the Emote Wheel.
_Avoid_: consumables menu, effects menu, gadgets.

**Items Wheel**:
The sub-wheel reached by selecting the Items Sector — a ring of owned Deployables the player
can arm and use on a walkable tile.
_Avoid_: deployables menu, toolkit wheel.

**Flag Emote**:
The viewer's own chosen country flag, surfaced as the first (top, most prominent) choice on
the first page of their Emote Wheel so they can broadcast it like any other emote. Present
only when the viewer has chosen a country; it reuses the single per-player Country (the same
value the World Cup uses) and is selected from the Country Picker, now also reachable from
the player's own profile.
_Avoid_: nationality emote, country emoji.

**Games Wheel**:
The sub-wheel reached by selecting the Games Sector — a list of games (today: Soccer).
Selecting a game drills further: Soccer → Free Play (join the Free Play Field) or 1v1 →
**This room** (raise a Challenge where you stand) / **Invite** (open your Play Space).
_Avoid_: games menu, play menu.

**1v1 Wheel**:
The root-level shortcut Sector that skips straight to 1v1: it lists games and jumps to that
game's 1v1 options (Soccer → This room / Invite), the same leaf the Games Wheel reaches the
long way. A fast path, not a separate flow.
_Avoid_: match menu, versus menu.

**Home Wheel**:
The sub-wheel reached by selecting the Home Sector — **My Rooms** (opens the Rooms browser)
and **Private Room** (opens or returns to your Play Space and its Share Panel).
_Avoid_: rooms menu, lobby menu.

**Avatar Frame**:
The transparent hexagonal center hole of the Action Wheel. A non-interactive window that
always frames your own avatar so the wheel reads as belonging to you.
_Avoid_: hub, core, center button.

**Nav Sector**:
The dedicated bottom (6 o'clock) edge of the Action Wheel hexagon. Shows Close at the root
level and Back inside a sub-wheel; reused rather than adding a second nav Sector.
_Avoid_: close button, back button, hub button.

**Other Player Menu**:
The nested drill-in menu opened by right-click (desktop) or long-press (touch) on another
player's avatar — not yourself. The root shows their identicon and **View {username}**,
and may add a second root row to Accept 1v1 when that player has a Challenge raised.
Choosing View opens a header+Back panel of available actions (today: View Profile, Whisper,
and More only when More has children). More drills to Administrative for allowlisted
admins; Administrative drills to Freeze / Unfreeze. Empty branches are omitted (no placeholder
Future Options). Copy Wallet is not on this menu — it lives on the profile. Distinct from
the Action Wheel (self) and Player Menu (app/session navigation).
_Avoid_: context menu (too easy to confuse with the Action Wheel), avatar menu, player
actions menu, radial.

**Focused Sector**:
The single Sector whose name is currently surfaced — focused by pointer hover or keyboard on
pointer devices, or by a first tap on touch. Sectors carry no inline text, so focusing one is
how its name is read. On touch a second tap on the Focused Sector activates it (the Nav Sector
is exempt: a single tap always activates Close/Back).
_Avoid_: hovered Sector, selected slice, active wedge.

**Sector Title**:
The name of the Focused Sector, shown above the Action Wheel. It replaces the per-Sector inline
text labels (now removed); absent when no Sector is focused.
_Avoid_: tooltip, sector label, caption.

**Wheel Title**:
The name of the sub-wheel you are currently inside (Emote Wheel, Items Wheel, Home Wheel, Games
Wheel, 1v1…), shown below the Nav Sector. Present only inside a sub-wheel; absent at the root.
_Avoid_: breadcrumb, context label, menu heading.

## Rooms

**Hub**:
The central social home room where players spawn, resume, and return from elsewhere.
_Avoid_: chamber, lobby, main room.

**Commons**:
The open communal build room where all full players can freely build within room rules.
It is the shared frontier outside the Hub.
_Avoid_: wildlands, free-build room, public build room.

**Return to Hub**:
A navigation action that teleports the player back to the Hub default spawn while staying
signed in.
_Avoid_: go home, return home, go to chamber.

**Tutorial Room**:
The shared runtime room where Nimiq Pay first-contact learners receive and send 0.01 NIM before
entering the Hub. Concurrent players share the space; each wallet gets its own mine slot and
Unlock Pad state. Lesson complete is Entering the path's **Exit Teleporter** to the Hub — not
Pay ack alone.
_Avoid_: tutorial instance, lesson room, onboarding room.

**Tutorial Path**:
The south-to-north walkable progression through the Tutorial Room — Mine band, then Pay via
Unlock Pad with **Unlock Aftermath** = walkable crossing, then Exit via a separate preplaced
Teleporter further north along the corridor to the Hub (**Exit Teleporter**). Unlock does not
place or swap a Teleporter onto the pad tile.
_Avoid_: tutorial corridor, lesson route, onboarding path.

**Exit Teleporter**:
On the Tutorial Path, the authored Teleporter north of the Unlock Pad that sends the learner
to the Hub. Lesson complete is Entering this Teleporter (not Pay ack, not the Unlock Pad tile).
_Avoid_: tutorial exit door, north Hub door, pad teleporter.

**Tutorial Staging**:
The admin/builder authoring room for Tutorial Template layout before publish to the live Tutorial
Room.
_Avoid_: tutorial editor, draft tutorial.

**Tutorial Template**:
The versioned layout record (Build Shell + metadata) that seeds the Tutorial Room, mirroring Play
Space Template authoring.
_Avoid_: tutorial map file, lesson JSON.

**Tutorial Mine Slot**:
A marked mineable block in the Tutorial Template assigned to one wallet for the faucet payout
during lesson mode.
_Avoid_: tutorial block, lesson mine.

**Tutorial Pay Ack**:
Optimistic Unlock Pad unlock when Nimiq Pay reports send success for the door quote; no on-chain
verify on the critical path for v1 tutorial. Grants Unlock Aftermath = crossing for that wallet
on the Tutorial Path pad; does not by itself complete the lesson.
_Avoid_: door payment confirmation, pay verify.

**Tutorial Escape**:
Client timer while a Pay send promise is pending; after a silent wait and visible countdown,
grants the learner's Unlock Pad unlock without marking the lesson complete, and forces them
to the Hub. Distinct from voluntarily Entering the path's Exit Teleporter (that path can
complete the lesson).
_Avoid_: pay timeout, stuck handler.

**Tutorial Sandbox**:
Post-complete revisit of the Tutorial Room via admin-placed Teleporter only - walk the layout with
normal chat/emotes, no faucet, door unlock sign, or guided overlays.
_Avoid_: tutorial replay, practice mode.

**Tutorial Step Coach**:
The persistent lesson strip (Mine → Pay → Exit plus a one-line next hint) that walks a
first-contact learner through the Tutorial Room. Exit means walk the unlocked crossing and
Enter the path's **Exit Teleporter** to the Hub. Client-local Attention Marker cues follow
the coach: all gold mines on Mine, all Unlock Pads on Pay, the Exit Teleporter on Exit.
Wrong-slot mine feedback is a redirect into this coach, not a permission lecture. Visible in
the Tutorial Room for lesson and Tutorial Sandbox revisits; Escape still counts as completing
Pay so the coach can show Exit.
_Avoid_: tutorial progress bar, quest tracker, onboarding wizard.

**Teleporter**:
A placed passable obstacle that warps a standing player to another Room at a preferred
floor tile.
_Avoid_: portal, warp pad, exit portal.

**Unlock Pad**:
A placed obstacle that is solid until a wallet unlocks it by payment — a metaphorical gate
that locks a path or section of a room. After unlock, that wallet may walk the pad tile
(**Unlock Aftermath** = crossing). It does not become a Teleporter; exits stay separate
placed Teleporters beyond the pad. Unlock is recorded as an **Unlock Pad Grant** for that
wallet and pad instance.
_Avoid_: toll pad, paid crossing, pass pad, unlock tile, paid gate, unlock gate,
Teleporter Aftermath.

**Unlock Pad Grant**:
Durable proof that a wallet has unlocked a specific Unlock Pad instance in a room. While the
grant exists, that wallet walks the pad's crossing; other wallets remain locked until they
have their own grant. Survives leave/rejoin; cleared by Tutorial Reset (for that wallet in
Tutorial Room) or when the pad/room is removed.
_Avoid_: unlock ticket, pad pass, unlock session.

**Unlock Aftermath**:
The post-unlock state of an Unlock Pad for a wallet that has unlocked it: the pad tile is a
walkable crossing for that wallet. Other wallets still see the locked pad until they unlock.
_Avoid_: unlock mode, after-unlock behavior, pad outcome, unlock result, Teleporter Aftermath.

**Unlock Pad Settings**:
The admin dialog for configuring an Unlock Pad's price (NIM), recipient, button label, and
proof mode. Opened from the build dock via summary + Edit; Save commits, Cancel discards.
Color stays in the dock. Distinct from the world-anchored orange Unlock control players use
to pay.
_Avoid_: unlock pad popover, unlock pad parameters form, pad config drawer.

**Attention Marker**:
A placeable, purely visual cue anchored to a floor tile — at most one per tile — that may
share the tile with a block, Unlock Pad, Gate, or empty floor. It draws the eye to where the
player should notice or act; it is never itself the thing they interact with. The glyph is a
fixed V with a continuous gentle hover bounce; authors set **Hover Height**, **Size**, and tint (default
white, glow matches). It is first-class room layout content (included in the Build Shell),
stays visible in build mode, and can be repositioned. Admin-only in v1. In build mode, with
the Attention Marker tool active, each marked floor tile shows a **selectability cue** so
authors can tell which tiles are pickable as Attention Markers (co-occupant pick otherwise).
_Avoid_: waypoint, beacon, hint, callout, marker alone, V (as the feature name).

**Attention Marker Selectability Cue**:
A build-only floor tint under tiles that already hold an Attention Marker, shown only while
the Attention Marker tool is active, so authors know those markers are the current pick
target. Distinct from the marker's own tint and from walk-mode chrome.
_Avoid_: selection outline (alone), placement ghost, marker glow.

**No-Walk Floor**:
A floor-layer flag on a tile that still looks like ordinary floor but forbids walking onto
it. Authors paint and erase it with a No-Walk brush in floor build mode; while that mode is
open, marked tiles show red X chrome; walk mode hides the chrome. Distinct from removing the
base floor (a hole) and from placing a solid block.
_Avoid_: invisible wall, walk ban, soft block, blocked floor, unwalkable paint (as the feature name).

**No-Walk Floor Cue**:
Build-only red X (or red-tint + X) drawn on each No-Walk Floor tile while floor build mode is
open, so authors can see soft-blocked regions. Never shown in walk mode or non-floor build modes.
_Avoid_: prohibition overlay, no-walk selection outline.

**Hover Height**:
The Attention Marker's visual lift above the top of its tile's current co-occupant (or the
floor if empty) — discrete steps `0..3`, default `1`. The baseline live-follows co-occupant
changes. Display only; it is not an obstacle stack level.
_Avoid_: layer, stack y, height (alone — that is the terrain block param).

**Size** (Attention Marker):
Uniform scale of the Attention Marker glyph as a percent of the default, discrete steps
`20%..100%` in increments of `10%`, default `100%`. Display only; does not change tile
footprint or pick bounds.
_Avoid_: scale (alone), zoom, font size.

**Teleporter Landing Hint**:
The floor `(X, Z)` stored on a Teleporter as the preferred arrival tile in the destination
Room; not a guarantee if that tile becomes unwalkable later.
_Avoid_: destination, exit tile, warp target.

**Join Spawn**:
The room owner's configured guest entry tile for a custom Room (Room settings); the fallback
when a Teleporter Landing Hint is no longer legal.
_Avoid_: spawn point, entry tile, door spawn.

**Enter**:
The walk-mode action on the proximity **Enter** pill when standing on a door, configured
Teleporter, or other walk-on portal offer; warps or opens the associated destination flow.
Cross-room Teleporters label the pill **Enter {Room name}**; same-room links and in-room
warps use plain **Enter** only. The locked Unlock control on an Unlock Pad stays a separate
orange affordance (not Enter); an unlocked Unlock Pad is walked through, not Entered.
_Avoid_: portal button, warp button.

**Set**:
The build-mode action to configure a pending or unsaved Teleporter - choose destination Room
and Landing Hint. Distinct from **Enter**, which warps through a configured Teleporter.
_Avoid_: configure button, SET link, coords pick.

**Teleporter Destination Picker**:
The editor dialog for **Set** - room chooser plus floor layout to pick a Landing Hint (or Hub
confirmation with no tile pick). Same flow for the current Room and other Rooms.
_Avoid_: dest preview modal, teleport menu, coords dialog.

## Sessions

**Connect Notice**:
An optional operator Telegram ping when a player **signs in** (fresh wallet auth or guest
invite claim) and enters the world. Not sent on mid-session reconnects, tab returns, door
crossings, or idle hub returns.
_Avoid_: door alarm, connect ping, login webhook.

**Guest**:
A player holding an ephemeral session without a connected Nimiq wallet. They receive a
server-assigned display name (a fun nickname, editable at entry) and can participate in
invited activities (e.g. a Match); connecting or creating a wallet on the invite splash upgrades the session in place (same
invite slot, richer identity); wallet is never required to finish that session.
_Avoid_: anonymous user, temp user, visitor.

**Direct Invite**:
A host-created share link at `nimiq.space/join/{slug}` (URL or QR) that reserves an
activity slot for one out-of-band guest — parallel to, not a replacement for, the World Cup
**Challenge** bubble. One guest claims the slot on first open; that same guest may reopen
the link until the activity starts or the invite expires (15 minutes from creation). First
use case: a 1v1 Match. While pending, host and guest wait together in a shared virtual
lobby (not the hub or Match Pitch) until the host starts the activity.
_Avoid_: invite (ambiguous with Challenge), guest link, deep link.

**Share Panel**:
The dismissible card shown inside a Play Space with its **Room Code**, full join link (copy),
and QR. It auto-opens once on entering the space and is re-opened anytime from the persistent
**Share Button** in the top toolbar — visible to every occupant (creator and Guests), since
anyone may pull in more friends. Replaces the old always-blocking lobby overlay.
_Avoid_: invite modal, lobby overlay, QR popup.

**Room Code**:
The Play Space's shareable code — the `{slug}` from its `nimiq.space/join/{slug}` link —
surfaced on its own in the Share Panel so it can be read aloud or copied without the full URL.
_Avoid_: invite code, pin, join code (the Rooms feature's separate 6-char code is distinct).

**Get a Wallet Button**:
The guest-only top-toolbar button that takes the slot the Rooms button occupies for full
players. A Guest is confined to their Play Space, so room browsing is closed to them; this
button replaces Rooms and opens the Get a Wallet Prompt instead. Full players (wallet or
Nimiq Pay) keep the Rooms button unchanged.
_Avoid_: join button, sign-up button, upgrade button.

**Get a Wallet Prompt**:
The dismissible full-screen overlay (over the game world) a Guest reaches from the Get a
Wallet Button, encouraging them to create a real Nimiq wallet and become a full player.
Offers two routes: the **web wallet** (the standard Nimiq wallet sign-in — log in or create
a wallet — entered as a full player; this is a fresh full-player session, not an in-place
guest upgrade) and the **Nimiq Pay** mobile app (App Store / Google Play, plus a QR to
nimpay.app). Encouragement only — closeable, returning the Guest to play as a guest.
_Avoid_: paywall, wallet gate, sign-up modal, upsell.

## Client presentation

**Mobile Browser Play**:
The default presentation for playing Nimiq Space in a mobile browser outside the Nimiq Pay
WebView, applied from first page load — any mobile touch/coarse-pointer session regardless of
wallet or auth path. Distinct from **Nimiq Pay host** layout, which reuses some of the same
portrait/landscape HUD rules but is detected by the Pay WebView, not by “mobile browser” alone.
_Avoid_: mobile web, phone browser mode.

**Fallback Mobile Presentation**:
The temporary rollback presentation for mobile browsers if **Mobile Browser Play** proves unsafe
on a real device or browser; it preserves playability while the default mobile presentation is
fixed.
_Avoid_: legacy mobile mode, old landscape mode.

**Portrait Play**:
The default **Mobile Browser Play** presentation: the player arrives in portrait and the game
fills the visible browser viewport with a true portrait canvas, without forcing immersive
fullscreen or preserving the old 16:9 game frame.
_Avoid_: vertical mode, phone layout.

**Landscape Play**:
The optional **Mobile Browser Play** presentation entered by physically rotating the device to
a landscape viewport; the client may make a best-effort immersive fullscreen request but the
game remains playable when the browser denies it.
_Avoid_: horizontal mode, rotated layout.

**Orientation-Aware Immersive Layout**:
On **Mobile Browser Play**, immersive/fullscreen is tied to viewport orientation — off (or released)
in **Portrait Play**, engaged (or offered) in **Landscape Play** — not locked landscape on entry.
_Avoid_: auto-fullscreen, forced landscape.

**Curated Mobile HUD**:
The reduced-density HUD used for **Portrait Play**: play-critical controls stay available while
secondary surfaces are collapsed behind existing entry points instead of all desktop controls
remaining visible at once.
_Avoid_: stripped-down UI, mobile-lite UI.

**Shared Mobile Portrait Layout**:
The common portrait presentation used by both **Portrait Play** and Nimiq Pay portrait: true
portrait canvas, **Curated Mobile HUD**, and portrait resize behavior, with host-specific chrome
or immersive APIs layered separately.
_Avoid_: Pay portrait clone, separate mobile layout.

**Visible Viewport Fit**:
Mobile game presentation sizes to the currently visible browser viewport as it changes, including
browser chrome collapse/expansion and keyboard-driven viewport changes where the platform reports
them.
_Avoid_: screen fit, fixed mobile height.

**Mobile Gesture Vocabulary**:
The touch interaction meanings shared by **Portrait Play** and **Landscape Play**; rotation changes
layout and immersive/fullscreen behavior, not what taps, long-presses, pinches, or drags mean.
_Avoid_: portrait controls, landscape controls.

**Telescope**:
The achievement-gated temporary zoom-out the player holds to see more of the room; releasing
returns to the prior view. On desktop letterbox, **Shift** or the magnifying-glass control beside
**Player Menu**; on mobile-play layouts, hold the magnifying-glass control only.
_Avoid_: zoom mode, map overview toggle, binoculars.

**Main Menu**:
The pre-world connect shell (wallet sign-in and related chrome) shown before the player enters
a room. Distinct from in-world HUD and from the **Player Menu**.
_Avoid_: login screen, title screen, landing page, home screen (when meaning this shell).

**Ambient Cast**:
The decorative background on the **Main Menu**: today’s public/shared visitors as exact
public identicons hovering outside the login card (not a live room, not interactive, not a
roster). Soft Density keeps the cloud readable.
_Avoid_: lobby world, ghost players, home screen NPCs, visitor ticker.

**Face Token**:
An opaque short string in the Ambient Cast snapshot that is not a wallet address. It encodes
the same `@nimiq/identicons` feature indices as that day's eligible wallet so the client can
render the exact public face without shipping addresses or SVG payloads.
_Avoid_: anonymized identicon, ghost token, salted avatar (those imply a different face).

**Soft Density**:
Ambient Cast staging rule: only a modest number of walkers are on screen at once (~8–12), while
a larger unique Face Token set for the UTC day can cycle through over time.
_Avoid_: hard cap only, show everyone, crowd limit.

## Movement

**Touch Joystick**:
The on-screen left-thumb virtual stick on touch devices / the Nimiq Pay mini-app while on the
soccer pitch in **Joystick** Pitch Movement Mode. It is *floating*: it has no fixed home —
it materializes wherever the thumb presses down and is dragged, anchored at that point. Held,
it steers the player continuously in the pushed direction; released, it stops.
_Avoid_: d-pad, controller, analog stick, dpad, fixed stick.

**Path Playback**:
Animating an avatar along a server-accepted walk path at constant walk speed, so motion looks
continuous instead of continually correcting toward sparse pose snapshots. Used for click-to-walk
rooms (self and others); not the soccer pitch's free-move motion.
_Avoid_: prediction, client prediction, extrapolation, lerp (too vague), move order (wire name).

**Movement Watch**:
An admin-only overlay that shows players' click destinations, **Click Intervals**, and
authoritative movement paths so operators can debug pathfinding and visually spot bot-like
click patterns. Toggled from the Admin overlay Watch tab; not a player-facing feature.
Click Interval is on whenever this overlay is on — not a second toggle. While active in a
room, peers also report client-only clicks that never become walk intents (unwalkable goals
and mine-block clicks).
_Avoid_: move debug, path debug, admin path overlay, botting overlay.

**Click Marker**:
A short-lived marker on the tile a player targeted (accepted or rejected) while Movement Watch
is on. Carries a light identity label (username or truncated wallet) and lingers briefly after
the click so recent patterns stay visible. From the second click onward, also carries that
player's **Click Interval**.
_Avoid_: destination pin, click indicator, goal marker.

**Click Interval**:
The elapsed time between one player's consecutive Click Markers, accepted or rejected, on
that player's click stream — the same value for every watching admin. Present on the later marker, stacked above the identity label; absent on the first and after a stream
break (leave, disconnect, or Movement Watch idle). A displayed duration, not an automatic
bot verdict.
_Avoid_: second counter, click timer, click delta, interclick gap, cadence, cadence flag.

**Watch Path**:
The polyline of a player's current remaining authoritative path, drawn for admins while
Movement Watch is on. Distinct from the viewer's own local path-line preview.
_Avoid_: moveOrder line, admin path line, ghost path.

## Cosmetics

**Catalog Entry**:
An operator-managed row in the cosmetic shop — display name, description, price, collection,
sort order, on-sale flag, and which Preset it sells. Operators create and edit Catalog
Entries from admin; players never buy a Preset directly, they buy the Catalog Entry that
points at one.
_Avoid_: SKU row, shop item, product.

**Preset**:
A developer-defined visual or deployable effect identified by a stable `presetId` (e.g.
`aura.flame.v1`) and a fixed **Slot** (aura, nameplate, chat bubble, trail, or deployable).
Rendering and behavior live in the client; operators pick a Preset when creating or editing a
Catalog Entry but do not author Presets from admin in v1.
_Avoid_: effect, asset, VFX pack.

**Slot** (cosmetic):
Which passive or active channel a Preset uses — aura, nameplate, chat bubble, trail, or
deployable. Declared on the Preset; inherited read-only by every Catalog Entry that
references it.
_Avoid_: category, type, equip slot.

**Cosmetic SKU**:
The immutable identifier of a Catalog Entry — the key entitlements and payment intents bind to.
Chosen by the operator at create time (a unique slug); display name and price may change later;
the SKU does not.
_Avoid_: product id, item code.

**Catalog Preview**:
An operator-only view in `/admin/cosmetics` that renders a selected Preset or Catalog Entry
on a chosen wallet’s avatar (identicon, nameplate, etc.). The preview wallet defaults to the
signed-in admin; any `NQ…` address may be entered. The target player need not be online.
_Avoid_: try-on, fitting room, mannequin.

**The Shaper**:
The player-facing in-world showroom for cosmetics, laid out from **Sale Displays** (not an
auto grid of every Preset). Players visit to browse, try, and buy bound Catalog Entries.
Distinct from the **Wardrobe** shop shelf and from operator **Catalog Preview**. Sale Displays
may also exist outside The Shaper.
_Avoid_: preset gallery, mannequin room, SKU gallery.

**Sale Display**:
An admin-placed in-world fixture that starts unbound and, once configured, binds to one
**Catalog Entry**. Players interact with a bound Sale Display to try and buy that entry; admins
place, select, move, and rebind it via **Build → Buildings → Sale Display** like other building
placeables. Each display occupies one floor tile (no stacking other blocks on that column).
Optional per-display mannequin walk path (`walkEnabled` + ordered `walkTiles`, ≥2 tiles);
floor deployable binds stay put. Buy UI shows a WebGL self preview with the purchase Slot
overridden on a solid stock backdrop (Black / White / Dark green; click to cycle) — distinct
from **Wardrobe Preview Backdrop**. Distinct from the retired auto-laid Preset gallery and from
operator **Catalog Preview**.
_Avoid_: purchase item, shop pedestal, buyable tile, product placer, SKU pedestal.

**Draft** (Catalog Entry):
A Catalog Entry visible only in admin — not offered in the player shop and not payable via
payment intent until Published.
_Avoid_: hidden, staging, unpublished (prefer **Draft** or **Archived** by intent).

**Published** (Catalog Entry):
A Catalog Entry live in the player shop; new purchases are allowed at its current price.
_Avoid_: live, active, on-sale.

**Archived** (Catalog Entry):
A Catalog Entry retired from the shop; new purchases are blocked. Wallets that already own
the Cosmetic SKU keep their entitlement.
_Avoid_: deleted, removed, disabled.

**Catalog Changelog**:
The append-only history of operator edits to a Catalog Entry — who changed what, when, and
the before/after of admin-editable fields. Shown on the SKU edit screen in admin; not the
same as player purchase history.
_Avoid_: audit trail (too generic), version history.

**Cosmetic Unlock**:
A one-off NIM purchase that permanently grants a wallet ownership of a Cosmetic SKU. Routed
through the Payment Intent Service (`nspace.cosmetic.unlock`); the game server grants the
Entitlement after verify. The quoted price is fixed when the intent is created; verify matches
that amount even if the catalog price changes later. If the Catalog Entry is Archived before
payment completes, the intent fails. Client checkout auto-opens **Nimiq Pay**
(`sendBasicTransactionWithData`) when `shouldUseNimiqPaySend` is true, otherwise **Nimiq Hub**
checkout — same branch as Unlock Pad. Used by Wardrobe Shop Buy and Sale Display Buy.
_Avoid_: buy, purchase (use when speaking to players), microtransaction.

**Entitlement**:
Proof that a wallet owns a Cosmetic SKU — granted by a successful Cosmetic Unlock or by an
operator **Grant** from admin. Permanent in v1; revocation is out of scope unless added later.
_Avoid_: ownership record, inventory item.

**Grant** (cosmetic):
An operator action that awards an Entitlement to a wallet without NIM payment — for events,
compensation, or testing. Recorded in the Catalog Changelog on the affected SKU.
_Avoid_: comp, freebie, airdrop.

**Collection** (cosmetic):
A free-text shop grouping label on a Catalog Entry (e.g. “Elemental”, “Seasonal”). Grouped
case-insensitively in the player shop; not a separate admin-managed entity in v1.
_Avoid_: category, tag, series.

**Loadout**:
The wallet’s currently equipped passive cosmetics — at most one Entitlement per Slot (aura,
nameplate, chat bubble, trail). Equipping a new item in a Slot replaces the previous one;
both remain owned. Stored server-side and visible to other players in the room.
_Avoid_: outfit, equipped set, active cosmetics.

**Wardrobe**:
The profile surface where a player views owned Entitlements, equips Loadout passives, and
opens the shop to buy Published Catalog Entries. Self-only UI uses a paper-doll equip layout
(Slot ring around the identicon); Deployables are listed for ownership context but **used**
from the Action Wheel, not equipped as passives.
_Avoid_: inventory, closet, customization menu.

**Wardrobe Preview**:
A client-only preview of how a Preset or Catalog Entry would look on the signed-in player
before **Loadout** is saved — driven from the Wardrobe or Shop UI, not persisted until Equip.
Distinct from operator **Catalog Preview** (any wallet, admin-only).
_Avoid_: try-on, fitting room, mannequin.

**Wardrobe Preview Backdrop**:
The read-only miniature of the viewer's current **Room** behind the avatar in **Wardrobe
Preview** — the room's sky tint plus a 4×4 floor patch sampled around the tile the
viewer is standing on when the preview opens (avatar at row 3 / column 2 of the grid,
two rows behind and one toward the isometric camera; non-walkable cells in the patch
render as void). The patch is oriented to the viewer's current in-world isometric camera
corner, snapped to the nearest 90° view at open — "behind" and "toward camera" follow that
view, not a fixed default angle. Captured once per open; not a separate saved setting and not
live-synced while the panel stays open. Shown for both the signed-in player's Wardrobe and read-only
views of other players (their avatar, your room as the stage), including the Shop mini
preview doll. When the viewer's floor tile is not yet known, the patch anchors on the room
**Spawn** instead.
_Avoid_: studio backdrop, profile background, preview wallpaper.

**Style Line**:
A family of Presets that share one visual identity in the Wardrobe — one row in a Slot
dropdown (e.g. Spark Path, Sigil, Magic Ring). A Style Line has one or more **Style
Variants**; the player picks a variant inside a **Variant Picker** when the line has more
than one.
_Avoid_: cosmetic family, preset group, style bundle.

**Style Variant**:
One unlockable choice within a **Style Line** — a colour for Spark Path, a sigil shape for
Sigil, and so on. Each Style Variant maps to exactly one **Preset** and one **Cosmetic SKU**;
**Entitlements** and **Loadout** remain per SKU.
_Avoid_: colourway, skin, sub-preset.

**Variant Picker**:
The drill-in sub-view in **Wardrobe** where the player chooses a **Style Variant** from a
swatch grid after selecting a multi-variant **Style Line**. Locked variants show a padlock
and an unlock hint; selecting any variant updates **Wardrobe Preview**. At most one Variant
Picker open at a time within the open Slot dropdown.
_Avoid_: colour picker (too narrow — sigils pick shapes), style submenu.

**Deployable**:
A cosmetic whose Slot is deployable — owned like any Entitlement, **used** from the Action
Wheel by arming it and tapping a walkable tile. Server enforces cooldown, duration, and
room limits; operator-tunable fields on the Catalog Entry override Preset defaults in v1.
_Avoid_: consumable, throwable, placeable effect.

**Cosmetic Store**:
The durable SQLite tables on the game server (same file as the campaign store) holding Catalog
Entries, Catalog Changelog, Entitlements, and Loadouts.
_Avoid_: cosmetics DB, shop database.

**Deployables Allowed** (room):
A per-room setting (default on) controlled by the room owner in Room settings. When off,
Deployables cannot be used in that room; Loadout passives are unaffected.
_Avoid_: effects ban, no gadgets.

**Creator Catalog Entry** *(post-v1)*:
A future Catalog Entry whose Preset is derived from a player-authored prefab, sold by that
creator through the shop. Explicitly out of v1; operator-created Catalog Entries only at launch.
_Avoid_: UGC SKU, player shop listing.

## Achievements

**Achievements Window**:
The surface where a signed-in player browses their own achievements. On wide desktop viewports
it is a left-edge rail inset within the HUD band — below the top chrome, above the bottom
chat or build dock with a small gap — so chat stays visible and usable beside it. On narrow
or portrait viewports it is a bottom sheet. Opens on the Summary and uses the Category
Navigator to switch views. Distinct from the **Achievement Unlock Banner** and from the
read-only achievement highlights shown on a player profile.
_Avoid_: achievements panel, achievement modal, trophy window, trophy case.

**Achievement Unlock Banner**:
The non-blocking in-game notification when the player earns an achievement. Slides in below the
top header on desktop and landscape; on portrait mobile it sits near the bottom of the viewport
for thumb reach. No dimmed backdrop. Tap opens the Achievements Window; multiple unlocks queue.
_Avoid_: unlock toast, achievement toast, popup.

**Achievement Unlock Modal** *(reserved)*:
A future blocking dialog reserved for unlocks that grant a major achievement-only cosmetic
reward SKU. Not used for routine unlocks — those use the Achievement Unlock Banner.
_Avoid_: unlock popup (ambiguous with the Banner).

**Achievement Unlock Celebration**:
The brief in-world social signal when a player earns an achievement — the Nimiq starburst
icon with a static soft gold glow springs in above their avatar and hovers gently for eight
seconds, visible to everyone in the same room at unlock time (not retroactive on room enter). Keeps a constant on-screen size while
zooming, like chat bubbles and name labels. (not retroactive on
room enter). Generic starburst icon only; achievement title and points stay in the earner's
**Achievement Unlock Banner**. Multiple unlocks in one burst play staggered Celebrations (one
trophy per unlock, capped so overhead stays readable); the Banner still queues every unlock.
Silent fetch-time unlocks (self-healing streak catch-up) do not fire a Celebration — same rule
as the Banner. Hidden in stream cinema view (same overhead-clutter rule as chat bubbles).
Distinct from the Banner (private HUD) and from profile achievement highlights
(persistent, read-only).
_Avoid_: unlock toast, achievement pop, trophy bubble (alone).

**Category Navigator**:
The control inside the Achievements Window for choosing what fills the content area — the
Summary or a single achievement Category. It is a left sidebar when the window is wide and a
bottom drop-up list when narrow/portrait; both forms list the same entries (Summary first,
then one per Category present in the data).
_Avoid_: category tabs, sidebar (alone), filter, dropdown (alone).

**Summary** (achievements):
The Achievements Window's default landing view, showing Recent Achievements and the Progress
Overview instead of a single Category's list. Always the view shown when the window opens.
_Avoid_: overview, dashboard, home.

**Recent Achievements**:
The Summary section listing the player's most-recently-completed achievements, newest first.
Selecting one navigates to its Category.
_Avoid_: latest, history, feed.

**Progress Overview**:
The Summary section summarizing completion — an overall earned/total figure plus a per-Category
earned/total breakdown. Incomplete **Temporarily unavailable** rows are omitted from those
fractions; Complete still counts. Selecting a Category here navigates to it.
_Avoid_: stats, totals, progress bars.

**Temporarily unavailable**:
An achievement Availability state: the live feature the row depends on is currently off
(for example Shop closed). The row stays listed and is not Completable until that feature
returns. Already Complete stays Complete. Distinct from Football seasonal pause, which does
not use this label.
_Avoid_: locked, hidden, disabled, coming soon, seasonal pause.

**Category** (achievement):
The grouping each achievement declares (e.g. onboarding, commons build, mining). The Category
Navigator lists one entry per Category present in the player's data, labelled for display.
_Avoid_: section, group, type.

**Category Group** (achievement):
An optional display-only label that clusters related Categories in the Category Navigator (e.g.
**Minigames** groups Football Match and Football Free Play). Not stored on player progress;
achievements still declare a single leaf Category.
_Avoid_: parent category, section header (alone), nested category.

**Football** (achievement grouping):
The player-facing name for World Cup football minigame achievements in the **Category
Navigator** (under **Minigames**). Leaf categories use plain labels such as **Football Match**
and **Football Free Play** (no em dash). In-world feature copy may still say **World Cup**
where that is the established feature name.
_Avoid_: World Cup (as navigator group label), Soccer.

**Cosmetics** (achievement Category):
The Category Navigator group for Shop, The Shaper, Sale Display, Cosmetic Unlock, and
nameplate / chat bubble Slot equip milestones. Distinct from the cosmetics domain (Presets,
Catalog Entries, Wardrobe).
_Avoid_: shop (as Category), style, wardrobe (as Category).

**Feedback** (achievement):
Recognition for submitting product feedback (bug, feature, or suggestion ticket). Chat
**reports** (`source: "report"`) do not count. v1: one achievement on the player's first
eligible ticket only. Lives in the **Social** achievement Category (not a separate navigator
entry).
_Avoid_: report, player report, moderation ticket.

**Login Streak** (achievement progress):
The player's **current** count of consecutive UTC calendar days with at least one sign-in,
as tracked by the login-streak ledger. Drives progress display and unlock evaluation for the
four Social login-streak achievements (**Week Warrior**, **Monthly Devotee**, **Time of
Kaan**, **You Kaan Do It**). All four rows show the same live streak numerator capped at each
row's target denominator (e.g. day 3 → `3 / 7`, `3 / 30`, `3 / 54`, `3 / 100`). Resets when
the streak breaks. Criteria use a dedicated **`login_streak`** type (threshold per
achievement), not a binary **event** type. Unlock evaluation walks those definitions
(retired: `login_streak_7` / `login_streak_30` / `login_streak_top` event keys). Evaluation
runs **on login** (after the streak ledger updates) and **on achievements fetch**
(self-healing when the panel loads). Fetch-time unlocks are **silent** — they update
**Complete** state only; **Achievement Unlock Banners** fire on login evaluation, not when
the panel refetches. Once earned, a login-streak tier stays **Complete** permanently even if
the live streak later breaks.
_Avoid_: lifetime best streak, binary 0/1 progress, legacy login-streak event keys.

**Week Warrior** (achievement):
Social achievement for logging in on **7** consecutive UTC calendar days.
_Avoid_: login streak 7, daily login bronze.

**Monthly Devotee** (achievement):
Social achievement for logging in on **30** consecutive UTC calendar days.
_Avoid_: login streak 30, daily login silver.

**Time of Kaan** (achievement):
Social login-streak achievement at an operator-configured threshold (default **54**
consecutive UTC calendar days). Description copy names that threshold explicitly (same pattern
as **Week Warrior** and **Monthly Devotee**); the server supplies **N** so description and
progress denominator stay aligned when operators change `ACHIEVEMENT_LOGIN_STREAK_TOP`. Not
the top of the ladder — **You Kaan Do It** sits above it.
_Avoid_: Time of Khan, login streak top, daily login gold, vague "milestone" copy without **N**.

**You Kaan Do It** (achievement):
Social login-streak achievement for logging in on **100** consecutive UTC calendar days.
Fixed threshold (not env-tuned). Points-only reward (**150** Achievement Points); no cosmetic
SKU. Sits above **Time of Kaan** on the Social streak ladder.
_Avoid_: login streak 100, Kaan 100, Time of Kaan 100.

**Achievement Points**:
The lifetime sum of points from a player's completed achievements. The sole input to **Player
Level**.
_Avoid_: XP, experience, score, karma, AP (in player-facing copy).

## Player Level

**Player Level**:
An integer status derived from a signed-in wallet's lifetime **Achievement Points** (one Level
per 100 points, starting at Level 1 with 0 points). Shown as a circled number just outside the
username nameplate under the character. Continues rising after the Daily Earn Allowance becomes
uncapped. Guests have no Player Level.
_Avoid_: rank, tier, grade, XP level, prestige.

**Daily Earn Allowance**:
The maximum gameplay NIM a wallet may receive in one UTC day from its current **Player Level**.
Mining, Free Play goal rewards, and other gameplay earns share this allowance; tutorial faucet
and admin grants sit outside it. From Level 11 upward there is no Level-based daily ceiling.
_Avoid_: daily cap (alone), farm limit, payout throttle, earn tier.

## Chat

**Chat substitution**:
An operator-owned rule that replaces an exact public chat line with different text before
the room hears it. The speaker and everyone else in the room see only the replacement.
Does not apply to whispers. Distinct from Channel mute (which blocks sending) and from
the profanity censor (which stars out words).
_Avoid_: replacement filter, chat alias, rewrite rule, chat filter (ambiguous with the
admin log search filters).

## Moderation

**Admin Invisibility**:
A self-applied, session-scoped admin presence state in which the admin is omitted from
non-admin room presence: no join announce, no avatar, no movement broadcasts, and no speech
bubble. World-mutating actions (build, mine, gates, edits, and so on) stay available while
invisible, the same as when visible. Stream cinema remains observation-only for those
connections. Toggling on or off mid-room is silent for non-admins (no join/leave announce).
Room chat still appears in the shared chat log with the admin's normal name. Stays on across
room changes and short reconnect resume; clears on logout / new auth session or explicit
toggle-off. Other allowlisted admins still see them as a translucent avatar with a small
Invisible nameplate tag. Stream cinema observers get the public (non-admin) view —
invisible admins are omitted from the broadcast — unless that connection is also a game
admin. No player-facing history or Telegram notice for toggles in v1. Distinct from
Movement Watch (observation overlay) and from Channel mute (sanction on another wallet).
_Avoid_: ghost mode (ghost is reposition-preview language), stealth, cloak, vanish.

**Freeze**:
An admin-imposed, temporary locomotion lock on another player in the room: movement intents
are rejected until an admin unfreezes them. On apply, any in-flight path is cleared and the
player stops on their current tile. Targets any non-self presence in the room (wallet or
guest); cannot target another allowlisted admin or yourself. In the Other Player Menu, Freeze
appears under More → Administrative for allowlisted admins; when the target is another
allowlisted admin, Freeze is shown disabled rather than hidden. Usable while the acting admin
is under Admin Invisibility. Intended as a brief anti-macro desync — to the frozen player,
clicks while moving should feel like a short unresponsive hitch, with no toast, error, or
other cue that a sanction was applied; other players see only that they stopped moving; admins see a small Frozen tag or icon
above the target. Clears if the target leaves the room, disconnects,
or an admin Unfreezes — not a stored cross-session sanction. Chat, emotes, mining, and
build stay available. No player-facing history or Telegram notice in v1. Distinct from
Channel mute, Mining Restriction, and Admin Invisibility. Not a timed auto-unlock in v1 —
duration is however long the admin leaves it on.
_Avoid_: stun, root, immobilize, movement ban, lockdown (too broad).

**Mining Restriction**:
An admin-imposed sanction on a wallet that blocks claimable-block mining (starting and
completing a NIM block claim). Queued block-claim payouts stay in the Payout Service backlog
and are not sent on-chain until the restriction is lifted; they must not appear as payable
or processing while held. Maze, World Cup, and admin feedback payouts are unaffected. Distinct
from channel mute and username-set ban; toggled from another player's profile by a game admin
or from `/admin/user/{profile}` (and the `/admin/moderation` lists that link there). May carry
an optional operator note (not shown to the player).
_Avoid_: mining ban (use Restriction for the canonical sanction name), claim ban, payout block.

**Username-set ban**:
An admin-imposed sanction that prevents a wallet from setting or changing its custom username
and skips the login username prompt.
_Avoid_: name ban (ambiguous with profanity filter).

**Channel mute**:
An admin-imposed sanction that blocks a wallet from sending chat messages.
_Avoid_: chat ban, silence.

## Payouts

**Payout Service**:
The dedicated sidecar process that owns all outgoing NIM: the queue, the signer hot wallet,
retries, confirmation polling, balance, and the flush action. The game server never sends NIM
itself; it hands intents to this service.
_Avoid_: payout worker, nim service, tx service, payment service (that is the *incoming* one).

**Payment Intent Service**:
The pre-existing, separate sidecar for *incoming* NIM (advertise/campaign payment verification).
Read-only on-chain; holds no signer. Distinct from the Payout Service.
_Avoid_: payment service (ambiguous), payout service.

**Pay-Intent**:
A single "pay this claim N luna to this address" request produced by gameplay and handed from
the game server to the Payout Service. Idempotent by its `claimId`. Optional `priority: true`
puts it in the high lane (tutorial faucet today).
_Avoid_: payout job (that is the Payout Service's internal queue entry), payment intent (incoming).

**Priority Pay-Intent**:
A Pay-Intent with `priority: true`. The Outbox delivers it before normal intents, and the Payout
Service picks the oldest ready priority job before any normal job. Used for the tutorial faucet
so first-contact NIM is not stuck behind a large mining/goal backlog. Auto-bulk skips these jobs;
end-of-day flush and admin full payout still include them.
_Avoid_: VIP payout, urgent flag, queue boost (prefer the boolean field name).

**Outbox**:
The game server's minimal local, durable, append-only store of Pay-Intents not yet acknowledged
by the Payout Service. A delivery loop drains it with retries so no payout is lost across a
service outage or a game-server restart. Priority intents are delivered before normal ones.
_Avoid_: queue (the durable queue lives in the Payout Service), buffer, spool.

## Localization

**Locale Preference**:
The player's explicit UI language choice among the Supported Locales. Distinct from browser
language hints and from Country (flag / World Cup). When unset, the product may still pick a
locale from browser hints; once set, Locale Preference wins.
_Avoid_: language setting (too vague), country, locale cookie (storage detail).

**Supported Locale**:
A BCP 47 language tag the product ships catalogs for. v1 intent: `en`, `tr`, `pt-BR`.
_Avoid_: language pack, translation file (implementation).

**Message Catalog**:
The keyed set of product-owned UI strings for one Supported Locale. English is the source of
truth; other locales may omit keys and fall back to English. Does not hold user-authored text.
_Avoid_: translations dump, i18n file (implementation), copy deck.

## Analytics

**Event Log**:
The append-only record of gameplay events the game writes. The Analytics Service reads it;
the game does not scan it to serve `/analytics` or daily-stats.
_Avoid_: analytics log, replay log, event file.

**Analytics Service**:
The dedicated sidecar that scans the Event Log and returns overview snapshots and daily-stats
aggregates. It does not serve player HTTP, send Telegram, or flush payouts. The game stays the
public face of `/analytics` and fails those reads if this service is down; play continues.
_Avoid_: analytics worker, stats service, log service, event log service.
