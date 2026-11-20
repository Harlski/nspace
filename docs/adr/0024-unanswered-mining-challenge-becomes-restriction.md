# An unanswered Mining Challenge becomes a Mining Restriction

Short-lived wallets and unattended clients can take claimable-block NIM before an admin is watching. A person at the keyboard should have a way to show they can continue mining. A 24-hour ban, a player unblock request, and a usage log that left mining running were all on the table.

A **Mining Challenge** is the hold we open for that abuse. The window starts when mining is disabled and keeps running while the wallet is signed out. A later mine attempt shows the state the window is already in and does not restart it. During the window, claimable-block mining stays disabled and queued block-claim payouts stay held. Passing the captcha restores mining for that wallet and releases those payouts. If the window ends without a pass, the wallet is under **Mining Restriction** until an admin lifts it. Both unattended clients and wallets that rotate through short mining sessions can be placed in a Mining Challenge. A script-only check that leaves wallet rotation alone is out of scope.

## Considered Options

Lift the hold automatically after 24 hours. Rejected: the same wallets wait out the timer and mine again.

Ask the player to request an unblock. Rejected for this version: the stop has to hold without a new support queue.

Start the window when they next try to mine. Rejected: a signed-out session would choose its own moment to solve the captcha.

Record sessions and decide a block rule later, without stopping mining. Rejected: short sessions would keep extracting NIM while we watched.

## Consequences

A false positive stays in Mining Restriction until an admin lifts it. Maze, World Cup, and admin feedback payouts stay payable, as they do under Mining Restriction today. NIM already sent on-chain is not pulled back. The hold covers queued block-claim payouts and later claims.
