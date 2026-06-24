# Nimiq Space — Domain Language

Canonical names for cross-cutting concepts in the social space. Use these in code, UI
copy, and discussion. This file is a glossary only — no implementation details. The
seasonal soccer feature keeps its own glossary in [worldcup/CONTEXT.md](worldcup/CONTEXT.md).

## Self Interaction

**Action Wheel**:
The hexagonal menu that opens around your own avatar when you right-click (desktop) or
long-press (touch) yourself. The single entry point for self-actions. Its root level
offers Sectors; drilling into one opens a sub-wheel.
_Avoid_: radial menu, donut, self-menu, emote menu, pie menu.

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

**Hub**:
The transparent hexagonal center hole of the Action Wheel. A non-interactive window that
always frames your own avatar so the wheel reads as belonging to you.
_Avoid_: core, center button.

**Nav Sector**:
The dedicated bottom (6 o'clock) edge of the Action Wheel hexagon. Shows Close at the root
level and Back inside a sub-wheel; reused rather than adding a second nav Sector.
_Avoid_: close button, back button, hub button.

## Sessions

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

## Movement

**Touch Joystick**:
The on-screen left-thumb virtual stick on touch devices / the Nimiq Pay mini-app while on the
soccer pitch in **Joystick** Pitch Movement Mode. It is *floating*: it has no fixed home —
it materializes wherever the thumb presses down and is dragged, anchored at that point. Held,
it steers the player continuously in the pushed direction; released, it stops.
_Avoid_: d-pad, controller, analog stick, dpad, fixed stick.

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
payment completes, the intent fails.
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
opens the shop to buy Published Catalog Entries. Deployables are owned here but **used**
from the Action Wheel, not equipped as passives.
_Avoid_: inventory, closet, customization menu.

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
the game server to the Payout Service. Idempotent by its `claimId`.
_Avoid_: payout job (that is the Payout Service's internal queue entry), payment intent (incoming).

**Outbox**:
The game server's minimal local, durable, append-only store of Pay-Intents not yet acknowledged
by the Payout Service. A delivery loop drains it with retries so no payout is lost across a
service outage or a game-server restart.
_Avoid_: queue (the durable queue lives in the Payout Service), buffer, spool.
