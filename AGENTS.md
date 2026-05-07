# Agent handbook — Nimiq Space (`nspace`)

You are working on **Nimiq Space**, an open multiplayer isometric social space for the **Nimiq** ecosystem. The product name on the web is often “Nimiq Space”; the repository package name is **`nspace`**.

**Always consider [docs/THE-LARGER-SYSTEM.md](docs/THE-LARGER-SYSTEM.md)** when designing or implementing features that affect world model, sync, extensibility, or long-lived player expectations. It is the living place for cross-cutting design principles and notable decisions; update it when you solidify or discover something worth preserving. **Whenever you intentionally edit that file**, also add **`docs/reasons/reason_{unique_6digit_id}.md`** per its “How to use it” rules (why the update, how it serves the larger system). For a short pointer to that doc and this handbook, see [MEMORY.md](MEMORY.md).

## What this repo is

- **Monorepo** (npm workspaces): **`client`** — Vite, TypeScript, Three.js; **`server`** — Express, WebSocket (`ws`), TypeScript; optional **`payment-intent-service`** — HTTP API for incoming NIM payment intents (separate Docker image from the main game server).
- **Auth:** Nimiq wallet (Hub or mini-app) message signing → JWT session. Optional dev bypass for local work only.
- **Gameplay authority** lives on the **server** (`server/src/rooms.ts`). Clients send intents over the WebSocket; the server validates, mutates room state, and broadcasts snapshots.

## Where to read first

| Document | Use when you need |
|----------|-------------------|
| [MEMORY.md](MEMORY.md) | Anchor to durable design intent; points to **THE-LARGER-SYSTEM**, **patchnote/**, and this handbook |
| [patchnote/README.md](patchnote/README.md) | **Patch notes** — `patchnote/versions/<version>/` ([UNRELEASED/reasons.md](patchnote/versions/UNRELEASED/reasons.md) + [public/](patchnote/versions/UNRELEASED/public/) tiers) |
| [docs/THE-LARGER-SYSTEM.md](docs/THE-LARGER-SYSTEM.md) | Evolving **design principles** and important cross-cutting decisions — **consult before substantial work**; extend when principles are agreed or discovered |
| [docs/README.md](docs/README.md) | Index of all topical docs |
| [docs/build.md](docs/build.md) | Stack, world model, authority, rendering, message flow |
| [docs/process.md](docs/process.md) | Extending synced features, tick loop, env vars, local dev |
| [docs/features-checklist.md](docs/features-checklist.md) | What is implemented (keep in sync when shipping features) |
| [docs/getting-started.md](docs/getting-started.md) | Install, env, controls, structure |
| [docs/live-service-implementation.md](docs/live-service-implementation.md) | Split SPA + API deploy, Docker, persistence, replay **as implemented today** |
| [docs/deploy-github-docker.md](docs/deploy-github-docker.md) | GitHub Actions → VPS Docker |
| [docs/docker-deployment.md](docs/docker-deployment.md) | Compose-focused deployment |
| [docs/localization.md](docs/localization.md) | i18n status (not yet implemented end-to-end) |
| [docs/nim-payout-tracing.md](docs/nim-payout-tracing.md) | On-chain payout trace logging (`NIM_PAYOUT_TX_TRACE`) |
| [docs/brainstorm/README.md](docs/brainstorm/README.md) | **Non-normative** ideas, future phases, archived plans — do not treat as current behavior |
| [docs/toremove/README.md](docs/toremove/README.md) | **Local-only** folder (gitignored): incident log template; not shipped with the repo |

## Golden code paths

- **Room authority, tick, WS message handling:** [server/src/rooms.ts](server/src/rooms.ts)
- **HTTP server, auth routes, replay routes, static client:** [server/src/index.ts](server/src/index.ts)
- **Client WS types and commands:** [client/src/net/ws.ts](client/src/net/ws.ts)
- **API base URL resolution (split hosting):** [client/src/net/apiBase.ts](client/src/net/apiBase.ts)
- **Wallet login:** [client/src/auth/nimiq.ts](client/src/auth/nimiq.ts), [server/src/auth.ts](server/src/auth.ts)
- **Admin allowlist:** [server/src/config.ts](server/src/config.ts)
- **Event / replay logging:** [server/src/eventLog.ts](server/src/eventLog.ts)
- **Payment intents (optional sidecar):** [payment-intent-service/src/index.ts](payment-intent-service/src/index.ts) — quotes, SQLite ledger, Nimiq `getTransaction` verification; compose profile `payment` ([docker-compose.yml](docker-compose.yml)).
- **Payment intents (player HTTP on game server):** [server/src/paymentIntentRoutes.ts](server/src/paymentIntentRoutes.ts) — JWT **`/api/payment/*`** proxy to the sidecar ([server/src/paymentIntentClient.ts](server/src/paymentIntentClient.ts)).

## Maintenance expectations

When you change **any** of the following, update the matching **`docs/*.md`** (and [docs/features-checklist.md](docs/features-checklist.md) when behavior is user-visible):

- WebSocket message types or validation rules  
- Environment variables (client or server)  
- Deploy topology, Docker compose services, or CI deploy steps  
- Security-sensitive defaults (JWT, CORS, admin HTTP routes)

**Do not** record the new truth only under `docs/brainstorm/` — that folder is for exploration and archived write-ups.

If you remove or rename a doc, grep the repo for old links and fix them.

**Updates to [docs/THE-LARGER-SYSTEM.md](docs/THE-LARGER-SYSTEM.md)** (substantive content) must include a new **`docs/reasons/reason_XXXXXX.md`** rationale file; see **How to use it** in that document.

**Patch notes:** each **patch-notes version** has its own folder `patchnote/versions/<version>/`. Append technical detail to **`reasons.md`** and audience-specific public copy to **`public/*.md`** for the same version. While developing, use **`patchnote/versions/UNRELEASED/`**. When the user is **preparing to merge to `main`** (e.g. says **“Prepare for merge”**), run **`npm run prepare-merge`** from the repo root so **`UNRELEASED`** is frozen under the next semver and **`package.json`** stays aligned (see [docs/THE-LARGER-SYSTEM.md](docs/THE-LARGER-SYSTEM.md) and [patchnote/README.md](patchnote/README.md)). Stub: [patchnote/reasons_UNRELEASED.md](patchnote/reasons_UNRELEASED.md).

## After multi-iteration debugging

If a task took **several iterations** to get right (misleading logs, wrong first hypothesis, partial fixes), append a short dated section to **`docs/toremove/LEARNEDLESSONS.md`** (create the file if it does not exist). That path is **gitignored** — it will not be committed; see [docs/toremove/README.md](docs/toremove/README.md).

Each entry should capture:

1. **Assumptions** — what we believed at first and why it seemed reasonable  
2. **Root cause** — what was actually wrong once verified  
3. **Fix** — what changed (files, env flags, behavior), in plain language  

Keep **public** docs and comments aligned with the **final** behavior only; use `LEARNEDLESSONS.md` for the investigation trail so the next person avoids the same detours.
