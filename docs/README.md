# nspace documentation

Start with **[getting-started.md](getting-started.md)** to install, run, and explore the game. The [root README](../README.md) is a short overview; **[AGENTS.md](../AGENTS.md)** maps this folder and key source files for contributors and automation.

---

## Using the game & the repo

| Document | Contents |
|----------|----------|
| [getting-started.md](getting-started.md) | Install, env vars, controls, Docker overview, project tree |
| [features-checklist.md](features-checklist.md) | What the server and client implement today (WebSocket, rooms, build, replay, etc.) |
| [build.md](build.md) | Stack, world model, authority, rendering, high-level message flow |
| [process.md](process.md) | How to extend synced features, tick loop, env vars, local dev, rate limits |
| [THE-LARGER-SYSTEM.md](THE-LARGER-SYSTEM.md) | Evolving design principles and cross-cutting decisions; substantive edits ship a companion file in [reasons/](reasons/) (see also [MEMORY.md](../MEMORY.md)) |
| [reasons/](reasons/) | `THE-LARGER-SYSTEM` edit rationales only: `reason_{six-digit-id}.md` |
| [signboards-admin-guide.md](signboards-admin-guide.md) | Signboard rules by room, WebSocket messages, persistence |

## Styling & assets

| Document | Contents |
|----------|----------|
| [ui-styling.md](ui-styling.md) | HUD, overlays, tokens, layout conventions |
| [tile.md](tile.md) | Grid, camera, and **current** floor/block mesh sizes (solid-color floors today) |
| [NIMIQDESIGN.md](NIMIQDESIGN.md) | How `@nimiq/identicons` is wired for avatars (client + server) |

## Deploy & operations

| Document | Contents |
|----------|----------|
| [live-service-implementation.md](live-service-implementation.md) | Split SPA + API, Docker services, env vars, persistence — **as run today** |
| [deploy-github-docker.md](deploy-github-docker.md) | GitHub Actions → VPS; SSH keys and secrets |
| [docker-deployment.md](docker-deployment.md) | Compose, volumes, optional **payment-intent** sidecar (profile `payment`), common operations |

## Security & payouts

| Document | Contents |
|----------|----------|
| [SECURITY-REVIEW.md](SECURITY-REVIEW.md) | Checklist before making the repo public; production reminders |
| [JWT-SECURITY-ISSUE.md](JWT-SECURITY-ISSUE.md) | JWT startup rules + link to archived audit |
| [nim-payout-tracing.md](nim-payout-tracing.md) | `NIM_PAYOUT_TX_TRACE` log reference |
| [toremove/README.md](toremove/README.md) | **Local-only** incident log (`LEARNEDLESSONS.md` next to it — not in git); see [AGENTS.md](../AGENTS.md) |

## Main-site HTML (analytics, admin, payouts UI)

| Document | Contents |
|----------|----------|
| [main-site-design.md](main-site-design.md) | Shell, tokens, and layout for server-rendered routes (`/analytics`, `/admin`, `/payouts`, …) |

## Localization

| Document | Contents |
|----------|----------|
| [localization.md](localization.md) | **Current:** English-only strings in code; no i18n framework yet |
| [localization-implementation-plan.md](localization-implementation-plan.md) | Redirect stub → `localization.md` + [brainstorm/localization-implementation-plan.md](brainstorm/localization-implementation-plan.md) |

## Contributing

| Document | Contents |
|----------|----------|
| [CONTRIBUTING.md](CONTRIBUTING.md) | Fork/PR workflow, conventions, important file paths |
| [patchnote/README.md](../patchnote/README.md) | **Patch notes** per version: `versions/<version>/reasons.md` + `public/` (brief, players, operators, developers); start from `versions/UNRELEASED/` |

---

## Brainstorm (not authoritative)

[brainstorm/README.md](brainstorm/README.md) — backlog, future protocols, archived plans, artist guides for **unshipped** art pipelines. These files **are** tracked in git for contributors; do not treat them as current product behavior. For **local-only** incident notes, use [toremove/README.md](toremove/README.md) instead.

These files are maintained manually; when code changes, update the relevant doc here or in `brainstorm/` as appropriate.
