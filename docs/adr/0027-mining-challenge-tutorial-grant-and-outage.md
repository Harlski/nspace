# Tutorial mines stay out of the trip count, and a Turnstile outage opens nothing new

A tutorial faucet mine is a one-time first-contact payout, not the claimable-block farming this hold is for. Counting it would put three people doing the tutorial from one cafe into a **Mining Challenge**.

A tutorial faucet mine does not count toward the three-wallet trip, does not open a Mining Challenge, and does not pass one. While a hold is already open, that faucet mine is disabled along with other claimable-block mining.

A **Challenge Grant** holder opens a Mining Challenge from the other player's profile. They do not gain Ban mining, Freeze, or `/admin`. They cannot target themselves or a game admin. Game admins keep their existing moderation surfaces.

When the server cannot reach Cloudflare Turnstile, the IP rule and a person do not open a new Mining Challenge. A challenge that is already open keeps its 15-minute clock. An unanswered clock still becomes a **Mining Restriction**. Mining does not resume because the provider is down.

## Considered Options

Count tutorial mines toward the three wallets. Rejected: a shared network of new players would be swept in for the faucet, which is not the farming pattern.

Fail open when Turnstile is down, and let mining continue. Rejected: the hold would disappear whenever the provider failed. Fail closed on new opens, and leave an open clock running, limits the damage without clearing a challenge that already started.
