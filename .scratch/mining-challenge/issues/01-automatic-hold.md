# 01 - Automatic Mining Challenge from a shared address

**Status:** done

## What to build

A wallet that mines claimable blocks from the same client address as two other wallets, inside a rolling day, is put in a Mining Challenge. Mining stops, queued block-claim payouts stay held, and an older session from that address is left alone. A tutorial faucet mine does not count. When the captcha provider cannot be reached, no new hold opens.

## Acceptance criteria

- [x] Three distinct wallets with an accepted gameplay begin from one trusted client address inside 24 hours open a Mining Challenge for wallets that began in the last 15 minutes
- [x] The begin that makes the address hot cannot be completed, and a later gameplay begin on a hot address is refused
- [x] A rejected click, a tutorial faucet mine, and a begin older than 15 minutes do not pull a wallet in
- [x] Queued block-claim payouts for a challenged wallet are held; maze and other non-block payouts still send
- [x] An unanswered 15-minute clock becomes a Mining Restriction, including one that passed while the process was down
- [x] Two wallets on one address do not open a hold

## Blocked by

None (can start immediately).
