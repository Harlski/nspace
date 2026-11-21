# 02 - Pass a Mining Challenge with Turnstile

**Status:** done

## What to build

A player who tries to mine during an open Mining Challenge sees that mining is disabled and can complete a visible Turnstile captcha. The server decides the pass. Passing restores mining, releases held block-claim payouts, and keeps that wallet out of another Mining Challenge for 30 minutes. Other wallets on the address can still be challenged. An admin can still apply a Mining Restriction during those 30 minutes.

## Acceptance criteria

- [x] The mine attempt shows "Mining is disabled on this account." and a visible Turnstile widget when a site key is configured
- [x] A server-verified pass restores begin and complete and releases held block-claim payouts
- [x] For 30 minutes after a pass, the address rule and a person cannot open another Mining Challenge on that wallet
- [x] A failed or missing token does not pass, and an unreachable provider does not pass or restart the clock
- [x] After the clock ends with no pass, the player sees "Mining is restricted on this account." and no captcha

## Blocked by

- 01 - Automatic Mining Challenge from a shared address
