# Click Interval is stamped on the Movement Watch click event

Operators watching bot-like click timing need the elapsed time between a player's consecutive
**Click Markers**. Measuring that on each watching admin's client would disagree across
watchers (receive jitter) and would blank the first marker after *that* admin enabled Watch,
even when another admin was already subscribed.

**Decision:** **Click Interval** is a property of the player's shown Click Marker stream.
The server records last-shown time per address in the room and includes optional
`clickIntervalSec` (seconds to hundredths) on `movementWatchClick` when a prior marker
exists. Every subscribed admin sees the same number. The field is omitted on the first
marker and after a stream break (player leave / disconnect, or the room has no Movement
Watch subscribers). Throttled intents that do not show a marker do not move the clock.
Display is small text stacked above the identity label; no automatic bot verdict.

**Considered options:** compute the gap from event arrival on the watching client — simpler
wire, but two admins can read different intervals and enabling Watch mid-stream always
starts blank; stamp a client-reported click timestamp — spoofable and unnecessary for an
admin overlay.

Future readers should not move Click Interval onto the public room stream or treat it as a
bot detector.
