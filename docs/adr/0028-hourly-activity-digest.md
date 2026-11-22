# Hourly activity digest replaces per-connect Telegram

Operators were getting a Telegram message on every world entry. The useful question is who played, not who opened a socket.

## Decision

Send **one** Telegram message per UTC hour, about a minute past the hour, to `TELEGRAM_CHAT_ID` (override `HOURLY_ACTIVITY_TELEGRAM_CHAT_ID`). The window is the **rolling last 24 hours**, not just the last hour. A short "joined this hour" line keeps arrivals visible.

The table is ranked by capped-gap active play time. Each row shows the custom username (a shortened wallet only when none is stored), play time, gameplay NIM earned, current room if they are online, session count, and chat lines. New and Nimiq Pay are separate columns, not marks glued onto the name. A stored username wins over a live shortened label. The header adds online count, new / guest / Nimiq Pay counts, mines, blocks placed, the busiest rooms, and the pending payout queue.

NIM earned is gameplay credit (`claim_block.amountLuna` and `gameplay_nim_earned`), deduped by `claimId`. On-chain `nim_payout_sent` stays out of this table because those sends batch later (often at the UTC end-of-day flush) and would show near zero for most hours.

The Event Log scan runs in the Analytics Service (`GET /v1/activity-digest`). The game formats the message, adds live presence and sanction flags, and sends Telegram. If the sidecar is down, that hour is logged and retried once. A quiet world still sends a short message so silence means the job failed.

Per-connect Connect Notices stop. Username updates, feedback, campaign approval, and the end-of-day stats report stay.

## Considered options

Keep the per-connect ping and add the digest beside it. Rejected: the ping is the noise this change exists to remove.

Rank by NIM instead of play time. Rejected: the ask is the most active players, with NIM as a column. Earners who fall outside the table are listed on an "Also earned" line.

Use on-chain payouts as "NIM earned". Rejected: settlement lags the play that earned it, so an hourly table would not match what players just did.

Skip the message when nobody played. Rejected: operators then cannot tell a quiet world from a dead bot.

## Consequences

- New env: `HOURLY_ACTIVITY_TELEGRAM_ENABLED` (default on when Telegram is configured), `HOURLY_ACTIVITY_TELEGRAM_CHAT_ID`, `HOURLY_ACTIVITY_TOP_N`, `HOURLY_ACTIVITY_LOOKBACK_DAYS`.
- Goals and maze wins log `gameplay_nim_earned`. Mines keep `claim_block`.
- `/admin/system` can preview or send the digest immediately.
- A process restart does not send until the next hour boundary, so a crash loop does not repeat the message. The in-memory "already sent this hour" flag resets on restart, and the timer only fires in the first minute after each hour.
