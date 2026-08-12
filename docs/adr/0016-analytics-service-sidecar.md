# Event Log scans run in a dedicated Analytics Service

Opening `/analytics` scanned `events-*.jsonl` (including a long first-time lookback) on the game Node process. That CPU/IO sat on the same event loop as the tick and WebSockets, so a cache miss stalled every player. Daily-stats aggregation used the same scan.

## Decision

A dedicated **Analytics Service** sidecar owns Event Log scans for overview snapshots and the daily-stats aggregate. The game keeps writing the Event Log, serves public `/analytics` HTTP (JWT, allowlist, HTML), and thin-proxies those two reads. The sidecar mounts the Event Log directory read-only. The game process never falls back to an in-process scan. Play continues if the sidecar is down; those reads fail until it returns.

## Considered options

- **`worker_thread` inside the game server** — would leave the event loop but share crash domain, heap, and deploys. Rejected; same isolation bar as ADR 0002.
- **Derived database in this change** — would make the dashboard itself fast, but delays decoupling. Deferred; the Analytics Service is the natural owner of a later store.
- **In-process fallback when the sidecar is down** — convenient, and how the stall returns in production. Rejected.

## Consequences

- `npm run dev` starts the Analytics Service beside the game. Compose runs it by default; `nspace` does not `depends_on` it.
- Telegram, payout flush, replay, and Event Log writes stay on the game.
- Service-to-service auth is a shared Bearer secret, matching other sidecars.
