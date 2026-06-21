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

**Flag Emote**:
The viewer's own chosen country flag, surfaced as the first (top, most prominent) choice on
the first page of their Emote Wheel so they can broadcast it like any other emote. Present
only when the viewer has chosen a country; it reuses the single per-player Country (the same
value the World Cup uses) and is selected from the Country Picker, now also reachable from
the player's own profile.
_Avoid_: nationality emote, country emoji.

**Games Wheel**:
The sub-wheel reached by selecting the Games Sector — choices for starting or joining a
game (e.g. World Cup: join the Free Play Field, start a Match).
_Avoid_: games menu, play menu.

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

## Movement

**Touch Joystick**:
The on-screen left-thumb virtual stick on touch devices / the Nimiq Pay mini-app while on the
soccer pitch. It is *floating*: it has no fixed home — it materializes wherever the thumb presses
down and is dragged, anchored at that point. Held, it steers the player continuously in the pushed
direction; released, it stops. Coexists with tap-to-move: a quick stationary tap still walks, a
drag past a small threshold becomes the stick.
_Avoid_: d-pad, controller, analog stick, dpad, fixed stick.

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
