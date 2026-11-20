# Three wallets on one address open a Mining Challenge, and only recent ones are pulled in

A shared client IP groups strangers as well as farms. Reaching back across a full day would start a 15-minute **Mining Challenge** for people who already signed out, and an unanswered challenge becomes a **Mining Restriction**.

Three distinct wallets must each have an accepted claimable-block begin from the same client IP inside a rolling 24 hours. That third begin opens the challenge. Wallets from that IP that began a claim in the last 15 minutes are included. Every later accepted begin from that IP is included. Older sessions are left as they are. A rejected mine click does not count as a begin.

Passing the captcha keeps that wallet out of another Mining Challenge for 30 minutes. The IP rule and a person both wait. Other wallets on the same address can still be challenged. An admin can still apply a Mining Restriction during those 30 minutes. A wallet already in a Mining Challenge or under Mining Restriction is not given another.

The captcha is a visible Cloudflare Turnstile widget. The server verifies it. We do not grade our own puzzle.

A **Challenge Grant** is a wallet allowed to open a Mining Challenge on someone else. Game admins can open one without a grant. The list is edited from `/admin` and starts empty. Player Level does not confer a grant. The open action goes through that one check, so a later level rule is another clause in the check.

## Considered Options

Pull in every wallet that mined from that IP during the 24 hours. Rejected: a household that mined in the morning would time out into Mining Restriction when a third wallet appeared in the evening, and the NIM already sent would not come back.

Let Player Level open challenges. Rejected for this version: the grant list is the configuration path, and level can be added later inside the same check.

Invent an in-game puzzle. Rejected: a script can be written to solve a puzzle we also shipped the answers for. A hosted check stays outside the client.
