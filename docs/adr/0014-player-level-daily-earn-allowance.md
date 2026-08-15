# Player Level gates Daily Earn Allowance from Achievement Points

Nimiq Space needs a player-visible progression signal next to the username and a way to stop
low-engagement wallets from draining gameplay NIM. We derive **Player Level** solely from
lifetime **Achievement Points** (Level = floor(points / 100) + 1) and use that Level as the
wallet's **Daily Earn Allowance** for all gameplay NIM (mining, Free Play goals, and future
earn paths), with tutorial faucet and admin grants outside the allowance. Level 1 starts near
10 NIM/day; the L1–L10 amounts are an explicit tunable table ending around 100 NIM/day; from
Level 11 (1000+ points) the Level ceiling is uncapped while Level keeps climbing for status.
Payouts that would exceed the remaining allowance partial-fill; a mid-day Level-up raises the
same day's ceiling immediately. Per-activity emergency env brakes (e.g. Free Play) may still
apply on top. We rejected playtime/XP Level and separate vanity vs earn tiers so status and
treasury pressure stay the same number, and so farmers must unlock achievements rather than
farm a single uncapped loop.

## Claimable-block mines when remaining is 0

When remaining Daily Earn Allowance is 0, claimable-block claims are refused on begin (with a
complete-time safety net) so capped wallets cannot cool down / remove gold blocks other players
could still earn from. Partial-fill when remaining is positive but below the proposed reward is
unchanged. Tutorial faucet mines stay outside this gate.

