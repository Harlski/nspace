---
title: Mining Challenge
status: ready-for-agent
glossary: CONTEXT.md
adrs:
  - docs/adr/0024-unanswered-mining-challenge-becomes-restriction.md
  - docs/adr/0025-mining-challenge-uses-client-ip.md
  - docs/adr/0026-mining-challenge-trip-and-grant.md
  - docs/adr/0027-mining-challenge-tutorial-grant-and-outage.md
---

# Mining Challenge

> Vocabulary follows [CONTEXT.md](../../CONTEXT.md): **Mining Challenge**, **Challenge Grant**,
> **Mining Restriction**, **Click Interval**, **Movement Watch**, **Daily Earn Allowance**,
> **Payout Service**, **Pay-Intent**, **Player Level**.
> ADRs: [0024](../../docs/adr/0024-unanswered-mining-challenge-becomes-restriction.md),
> [0025](../../docs/adr/0025-mining-challenge-uses-client-ip.md),
> [0026](../../docs/adr/0026-mining-challenge-trip-and-grant.md),
> [0027](../../docs/adr/0027-mining-challenge-tutorial-grant-and-outage.md).

## Problem Statement

People take claimable-block NIM with wallets that do not stay long enough for an admin to watch. Some clients walk and mine unattended. Others sign in, take one to three blocks, sign out, and continue on another wallet. Each new wallet has its own Daily Earn Allowance, so the per-wallet ceiling does not stop the farm. Movement Watch and Click Interval can show a fast click pattern to an admin who is already looking, and they do not stop mining. Mining Restriction can stop one wallet and hold its queued block-claim payouts, and it is applied by hand after the NIM is often already sent.

## Solution

A **Mining Challenge** is a 15-minute hold on one wallet. Claimable-block mining is disabled, queued block-claim payouts stay held, and a visible Cloudflare Turnstile captcha is offered when they try to mine. The server decides whether it passed. Passing restores mining for that wallet, releases those held payouts, and keeps that wallet out of another Mining Challenge for 30 minutes. If the 15 minutes end without a pass, the wallet is under **Mining Restriction** until an admin lifts it.

The hold opens in two ways. Automatically, when three distinct wallets each have an accepted gameplay claimable-block begin from the same client IP inside a rolling 24 hours. By a person, when a game admin or a **Challenge Grant** holder opens one on another wallet.

Begin claim, complete claim, and block-claim payout release all ask one decision: this wallet is allowed to mine, in a Mining Challenge, or under Mining Restriction. The IP count, the pull-in, the clocks, the grant list, the tutorial exemption, and Turnstile feed that decision. They do not each become a separate check on the claim path.

## User Stories

### Seeing the hold

1. As a player who tries to mine while a Mining Challenge is open, I want to see that mining is disabled on this account and be offered the captcha, so that I know there is an action I can still take.
2. As a player who tries to mine after the Mining Challenge window has ended, I want to see that mining is restricted on this account and be offered no captcha, so that I know mining stays off.
3. As a player in a Mining Challenge, I want to keep walking, chatting, and using the rest of the world, so that the hold stops claimable-block mining and does not freeze me.
4. As a player who is signed out while the window runs, I want the next mine attempt to show the state the window is already in, so that clicking a block does not start the 15 minutes over.
5. As a player who passes the captcha, I want claimable-block mining to work again on that wallet, so that a person at the keyboard can continue.
6. As a player who passes the captcha, I want that wallet left alone by a new Mining Challenge for 30 minutes, so that I am not immediately challenged again.
7. As a player who does not pass before the 15 minutes end, I want mining to stay disabled with no captcha, so that leaving the session does not clear the hold.
8. As a player under Mining Restriction, I want no captcha and no 30-minute gap, so that an unanswered challenge and an admin sanction feel like the same lasting stop.
9. As a player whose block-claim NIM was already sent, I want that transfer left on-chain, so that the hold does not pretend to claw back a finished payout.
10. As a player with queued block-claim payouts when a Mining Challenge opens, I want those payouts held, so that NIM still in the backlog does not send during the hold.
11. As a player who passes the captcha, I want those held block-claim payouts to become payable again, so that a passed challenge does not leave my NIM stuck.
12. As a player who fails the window, I want those held block-claim payouts to stay held under Mining Restriction, so that expiry does not release them.
13. As a player earning maze, World Cup, or admin feedback NIM, I want those payouts to keep sending during a Mining Challenge or Mining Restriction, so that the hold stays on claimable-block mining.
14. As a guest, I want claimable-block mining to stay unavailable, so that this feature does not create a guest mining path.

### Automatic open from one address

15. As an operator, I want the client IP to be the address reported by the trusted reverse proxy in front of the game server, so that a header the client can set is not the address we group on.
16. As an operator, I want two wallets on one address to mine without a Mining Challenge, so that a household of two is not treated as a farm.
17. As an operator, I want the third distinct wallet's accepted gameplay claimable-block begin from that address, inside a rolling 24 hours, to make the address hot, so that the pattern of hopping wallets is what trips the rule.
18. As an operator, I want a rejected mine click to leave the count unchanged, so that bumping an unmineable tile does not count as a begin.
19. As an operator, when an address becomes hot, I want every wallet that had an accepted gameplay begin from that address in the last 15 minutes to enter a Mining Challenge now, so that a burst of recent wallets is caught while the window can still be answered.
20. As an operator, I want wallets whose gameplay begins from that address are older than 15 minutes left as they are, so that a morning session is not turned into an offline Mining Restriction by an evening third wallet.
21. As a player on a hot address who tries a later gameplay begin, I want that begin refused and a Mining Challenge opened if I am eligible, so that wallets after the third do not get another paid claim first.
22. As a player whose accepted begin just made the address hot, I want that in-flight claim unable to complete, and its payout held if it was queued, so that the tripping claim does not pay out after the hold opens.
23. As an operator, I want an address to stop being hot when fewer than three distinct wallets still have an accepted gameplay begin inside the rolling 24 hours, so that the group expires with the window.
24. As an operator, I want a Mining Challenge that is already open, and a Mining Restriction already applied, to stay in force after the address cools, so that ageing begins do not quietly clear a hold.
25. As a player who passed a captcha in the last 30 minutes, I want a hot address not to put me in another Mining Challenge, so that the gap covers the automatic rule.
26. As a different wallet on that same address, I want to still be challengeable during someone else's 30 minutes, so that the gap is per wallet.
27. As a wallet already in a Mining Challenge or already under Mining Restriction, I want no second Mining Challenge, so that the states do not stack.
28. As a game admin who mines from a hot address, I want the IP rule to be able to put my wallet in a Mining Challenge, so that an admin wallet is not a free extra account.

### A person opens a challenge

29. As a game admin, I want to open a Mining Challenge on another wallet from the same profile and `/admin` surfaces I use for Mining Restriction, so that a single watched client can be challenged without a second wallet.
30. As a game admin, I want opening that challenge to ignore whether the address is hot, so that one bot still gets a captcha.
31. As a game admin, I want to apply Mining Restriction directly during someone's 30-minute gap, so that a passed captcha does not block a real sanction.
32. As an operator, I want `/admin` to edit the Challenge Grant list, empty by default, so that extra wallets can be allowed later without a new flow.
33. As a player at any Player Level, I want level alone not to let me open a Mining Challenge, so that the grant list is the only extra permission.
34. As a Challenge Grant holder, I want "Mining Challenge" on the other player's profile, so that I can open a hold without being a game admin.
35. As a Challenge Grant holder, I want no Ban mining, no Freeze, and no `/admin`, so that the grant is only the ability to open a Mining Challenge.
36. As a Challenge Grant holder, I want to be unable to target myself or a game admin, so that the grant cannot be turned on my own wallet or on staff.
37. As a Challenge Grant holder who targets a wallet that is immune, already in a Mining Challenge, or under Mining Restriction, I want a clear refusal, so that the click is not a silent no-op.
38. As an operator, I want a later Player Level rule to be another clause in the same permission check, so that enabling it does not create a second challenge flow.

### Captcha and the tutorial

39. As a player in an open Mining Challenge, I want a visible Turnstile captcha, checked by the server, so that a script cannot grade itself against a puzzle we shipped.
40. As a player, I want the captcha offered when I try to mine, not as a block on signing in, so that the hold shows up at the action it stops.
41. As an operator, when the server cannot reach Turnstile, I want the IP rule and a person to open no new Mining Challenge, so that an outage does not mass-restrict people who never saw a widget.
42. As a player already in a Mining Challenge while Turnstile is down, I want the 15-minute clock to keep running, so that the provider being down does not pass the challenge or restart it.
43. As that player, if the clock ends with no verified pass, I want the wallet under Mining Restriction, so that an outage does not resume mining.
44. As a new player, I want a tutorial faucet mine not to count toward the three wallets, so that three people doing the tutorial from one cafe are not treated as a farm.
45. As a new player, I want a tutorial faucet mine not to open a Mining Challenge and not to pass one, so that the faucet is not a way through the hold.
46. As a player already in a Mining Challenge or under Mining Restriction, I want the tutorial faucet mine disabled with other claimable-block mining, so that the hold is not a hole in the tutorial room.
47. As an operator, I want Click Interval to stay an admin observation, so that fast human clicks do not open a Mining Challenge.

### Durability

48. As an operator, I want open Mining Challenges, 30-minute gaps, the 24-hour begin log, and Challenge Grants to survive a restart, so that a deploy does not clear the hold or the count.
49. As an operator, I want a deadline that passed while the process was down to become a Mining Restriction on startup, so that the clock is not paused by a restart.
50. As an operator, I want the begin log to forget an accepted begin after 24 hours, so that we are not keeping a general history of client addresses.

## Implementation Decisions

- One mining-hold decision answers, for a wallet at a moment: allowed, Mining Challenge (with the time remaining and whether a captcha can be offered), or Mining Restriction. Claim begin, claim complete, and block-claim payout release call it. Nothing else on the claim path re-implements the IP count, the clocks, or the grant check.
- The decision's inputs are the wallet, whether this begin is a tutorial faucet mine, the trusted client IP, the time, the captcha result if any, and the actor if a person is trying to open a hold. A fake clock, a fake address source, and a fake captcha verifier are enough to test it.
- An accepted gameplay begin is a claimable-block begin the server accepts outside the tutorial faucet. A rejected click does not count. A tutorial faucet begin does not count and does not open or pass a hold.
- An address is hot while at least three distinct wallets have an accepted gameplay begin from that exact address inside the rolling 24 hours. Match the full address. Do not group a prefix. The address comes from the trusted reverse proxy in front of the game server. A header the browser can set is not the source.
- The accepted begin that makes an address hot opens a Mining Challenge immediately for every eligible wallet with an accepted gameplay begin from that address in the previous 15 minutes, including the wallet that just began. That in-flight claim cannot complete. A payout for it that is not yet sent is held.
- After the address is hot, a later gameplay begin attempt by an eligible wallet is refused, and that refusal opens the Mining Challenge. It is not an accepted begin and it does not pay.
- Eligible means: not inside the 30-minute gap, not already in a Mining Challenge, not under Mining Restriction. Game admin wallets are eligible for the IP rule. A tutorial faucet begin never opens a hold by itself.
- A person opens a Mining Challenge through the same permission check. Game admins pass it and use the existing Mining Restriction surfaces (the other player's profile and `/admin`). A Challenge Grant holder passes it only from the other player's profile, and only when the target is neither themselves nor a game admin. Player Level is not read. The check is one function so a later level clause does not add a second flow.
- Opening on an ineligible wallet refuses the actor with a clear result and does not change the target. Direct Mining Restriction ignores the 30-minute gap and stays the existing sanction.
- The captcha is Cloudflare Turnstile, visible, shown on the mine attempt while the hold is a Mining Challenge. The server verifies the token. The client does not decide the pass. Player-facing challenge copy is "Mining is disabled on this account." Restriction copy stays "Mining is restricted on this account."
- If the server cannot reach Turnstile, `open` from the IP rule and from a person does not create a hold. An existing hold keeps its deadline. Verification failure is not a pass. When the deadline passes, the hold is written as Mining Restriction.
- Passing clears the Mining Challenge, starts the 30-minute gap from the verification time, and releases held block-claim payouts for that wallet. It does not lift a Mining Restriction that was already in place, and it does not clear another wallet.
- Expiry writes Mining Restriction and leaves block-claim payouts held. Maze, World Cup, and admin feedback payouts stay payable, as they do under Mining Restriction today.
- Persist the open hold (wallet, opened-at, deadline), the gap (wallet, until), the begin log (address, wallet, time), and the Challenge Grant list. Drop begins older than 24 hours. On startup, convert deadlines that have already passed into Mining Restriction.
- The begin log exists for this hold. It is not a new analytics feed and not a Movement Watch record.

## Testing Decisions

Test the mining-hold decision from the outside: given wallets, addresses, times, captcha results, and actors, assert who may begin, who may complete, whether a new hold opened, whether a Mining Restriction was written, and whether a block-claim payout is held or released. Do not assert private counters or widget markup.

Prior art is the existing Mining Restriction access check and the payout test that holds a grid block-claim payout while a maze payout for the same wallet still sends. Follow that split.

Cover at least:

- Two wallets on one address do not open a hold. The third accepted gameplay begin does.
- A rejected click and a tutorial faucet begin do not change the count and do not open a hold.
- Wallets with a gameplay begin in the last 15 minutes are pulled in. A begin older than 15 minutes is not.
- The tripping begin cannot complete, and a queued block-claim payout for that wallet is held. A maze payout for that wallet still sends.
- A later gameplay begin on a hot address is refused and opens a hold. After the rolling 24 hours leaves fewer than three wallets, a new begin does not open one. An already-open hold and an existing Mining Restriction remain.
- A verified captcha pass restores begin and complete, releases held block-claim payouts, and blocks a new Mining Challenge from the IP rule and from a person for 30 minutes. Another wallet on the address can still be challenged. An admin Mining Restriction during the gap still sticks.
- Deadline expiry writes Mining Restriction, keeps block-claim payouts held, and offers no captcha. A second challenge is not created on a wallet already held.
- A grant holder can open a hold from the profile path and is refused for self, for a game admin, and for an ineligible target. A non-granted, non-admin wallet is refused. Player Level does not grant the action.
- When captcha verification cannot be reached, no new hold opens, an open deadline still expires into Mining Restriction, and mining does not resume.
- Restart keeps an open hold, a gap, a grant, and a recent begin. A deadline that passed while down is a Mining Restriction after startup.

## Out of Scope

- A usage dashboard that leaves mining running.
- Treating Click Interval or Movement Watch as a verdict.
- Challenging every wallet on its first claim.
- A 24-hour auto-lift, a player unblock request, or clawing back NIM already sent.
- Holding maze, World Cup, or admin feedback payouts.
- Player Level as a way to open a Mining Challenge. The permission check must leave room for a later clause. This version does not add one.
- Grouping addresses by prefix, account fingerprint, or device id.
- A puzzle we invent and grade.
- Giving a Challenge Grant holder Freeze, Ban mining, `/admin`, or a new branch on the Other Player Menu.
- Changing Daily Earn Allowance, guest mining, or the tutorial faucet amount.

## Further Notes

Shared carrier and cafe addresses will group strangers. The threshold of three and the 15-minute pull-in are the limits on that, not a promise that a shared address is safe. A household that uses a different address per device, which is common on IPv6, will not be grouped. A farm that rotates addresses will not be grouped either. Those holes are accepted.

Block-claim payouts are sent on a short interval, so claims that finished before the hold opened are usually already on-chain. The hold stops later claims and keeps what is still queued. It is not a refund.

The first provider is Cloudflare Turnstile. Swapping the verifier later stays behind the same mining-hold decision. The widget and the server check are the only provider-shaped pieces.
