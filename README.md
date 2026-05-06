# Nimiq Space (`nspace`)

**Nimiq Space** is a browser multiplayer hangout for the [Nimiq](https://nimiq.com) community: walk an isometric grid with other players, chat, build with blocks, use portals between rooms, and (in the canvas room) claim tiles on a shared leaderboard. You sign in with a **Nimiq wallet** (or a local **dev login** on your machine only).

**Play live:** [nimiq.space](https://nimiq.space)

## Quick start

1. Clone the repo, install dependencies, copy env examples — **[docs/getting-started.md](docs/getting-started.md)**  
2. Run `npm run dev` and open the URL Vite prints (usually port **5173**).

Docker and production-style hosting are covered in the same guide and in **[docs/docker-deployment.md](docs/docker-deployment.md)**.

## What’s in this repo

| Area | Notes |
|------|--------|
| **`client/`** | Vite + TypeScript + Three.js — 3D view, HUD, WebSocket client |
| **`server/`** | Express + WebSocket — room state, auth, persistence under `server/data/` |
| **`docs/`** | Human-facing docs for setup, architecture, deploy, and styling |

Deeper topics (architecture, message flow, ops, styling for contributors) live under **`docs/`** — start at **[docs/README.md](docs/README.md)**.

## Contributing & automation

- **[docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)** — branches, testing expectations, where code usually lives  
- **[AGENTS.md](AGENTS.md)** — short map for tools/agents: key files and which doc to open next  

## License

[MIT](LICENSE)
