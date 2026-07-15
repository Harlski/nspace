# Unlock Pad Settings uses a centered admin dialog

Admins configure Unlock Pad price, recipient, button label, and proof mode via
**Unlock Pad Settings**: a centered Save/Cancel dialog opened from the build dock
(summary + Edit). Aftermath is not configured here — Unlock Aftermath is always a
crossing ([0012-unlock-pad-crossing-only.md](0012-unlock-pad-crossing-only.md)). The dock
stays color + compact summary so Parameters remain usable on desktop and mobile. Amount is
entered as NIM and stored as luna. Proof mode is read-only in the Tutorial Room (forced
optimistic) and editable elsewhere. Recipient is optional (server default when blank).

**Considered options:** dock-anchored popover (too cramped with the keyboard on mobile);
narrow-viewport bottom sheet (fights the build dock); inline four-field Parameters form
(unusable in the dock).

Future readers should not put Unlock Pad text fields back into the dock Parameters column
without revisiting this trade-off.
