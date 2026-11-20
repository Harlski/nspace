# A Mining Challenge is opened from client IP, not from click timing

Wallet rotation still pays if each session is judged alone. **Click Interval** is an admin observation, and treating it as a verdict would punish fast human clicks without linking the wallets.

The automatic **Mining Challenge** uses the client IP address of the connection, as the game server sees it from the trusted reverse proxy in front of the process. Several wallets mining from one address can be placed in a Mining Challenge. An admin can also open a Mining Challenge on a single wallet. Click Interval does not open one. A client-supplied address header is not the source, because the client can set it.

## Considered Options

Open a challenge from click timing. Rejected: it does not survive a sign-out onto the next wallet, and [0017](0017-movement-watch-click-interval.md) already keeps Click Interval from being a bot verdict.

Challenge every wallet on its first claim. Rejected: that interrupts every new player, including a single honest wallet that never rotates.

## Consequences

A carrier, cafe, or household can share one address, so strangers can be grouped. The number of wallets that trips a challenge is what limits that, and it is chosen separately from this decision. The game has not stored client addresses before. Storing them is for this hold, and a proxy that is not the trusted edge must not become the source of the address.
