# nspace

Prototype isometric room: **Nimiq wallet** login, **WebSocket** multiplayer, **Three.js** orthographic view, and a desktop-focused “game shell” (fullscreen, reduced accidental browser navigation).

## Documentation

| Resource | Description |
|----------|-------------|
| [docs/README.md](docs/README.md) | Index of project docs (architecture, checklist, process) |
| [docs/build.md](docs/build.md) | Stack, authority, world model, message flow |
| [docs/features-checklist.md](docs/features-checklist.md) | What’s implemented (checkbox inventory) |
| [docs/process.md](docs/process.md) | Extending synced features, env, tick loop, dev workflow |
| [docs/deploy-github-docker.md](docs/deploy-github-docker.md) | CI: GitHub Actions SSH + Docker on VPS; SSH / deploy-key setup |
| [tile.md](tile.md) | Tile art / mesh design spec (grid units, camera, seams) |

## Requirements

- Node.js 20+

## Development

```bash
npm install
npm run dev
```

This runs the Vite client and the API/WebSocket server together. Open [http://127.0.0.1:5173](http://127.0.0.1:5173). The dev client proxies `/api` and `/ws` to port `3001`.

**Phone or another PC on the same network:** Vite listens on all interfaces (`host: true`). From the terminal where Vite starts, note the “Network” URL (e.g. `http://192.168.x.x:5173`) and open that on the other device. Ensure the host firewall allows incoming TCP **5173** (dev) and **3001** (API/WebSocket backend). The game uses relative `/api` and `/ws` URLs, so the correct host is used automatically.

**Production-style test on LAN:** After `npm run build`, run `npm run start -w server` and open `http://<this-machine-LAN-IP>:3001` (the server logs “Network” lines on startup). Set `HOST=127.0.0.1` if you need local-only binding.

The server `dev` script sets `DEV_AUTH_BYPASS=1` and a fixed `JWT_SECRET` so you can use **Dev login** without a real wallet signature. The client’s [client/.env.development](client/.env.development) enables the dev login button (and optional admin UI flags).

To run server and client in separate terminals with the same behaviour:

```bash
export DEV_AUTH_BYPASS=1
export JWT_SECRET=dev-insecure-change-me
npm run dev -w server
npm run dev -w client
```

- Use **Dev login** when `DEV_AUTH_BYPASS=1` is set on the server (never use this in production).
- Use **Connect wallet** to sign in with the real Nimiq Hub (`signMessage`).

## Production build

```bash
export JWT_SECRET=<long-random-secret>
# Do not set DEV_AUTH_BYPASS
npm run build
npm run start -w server
```

The server serves `client/dist` when present. Set `PORT` if needed.

**Docker (VPS):** `docker compose build && docker compose up -d` from the repo root; see [docs/deploy-github-docker.md](docs/deploy-github-docker.md) for automated deploys from `main`.

## Environment

| Variable | Where | Purpose |
|----------|--------|---------|
| `JWT_SECRET` | server | Signing session tokens for WebSocket auth |
| `DEV_AUTH_BYPASS` | server | `1` only in development: skips Nimiq signature verification |
| `PORT` | server | HTTP listen port (default `3001`) |
| `FAKE_PLAYER_COUNT` | server | `0`–`32` wandering NPCs per room (default **`2`**; names like `[NPC] Marie Curie`; set `0` to disable) |
| `VITE_HUB_URL` | client | Nimiq Hub URL (default `https://hub.nimiq.com`) |
| `VITE_DEV_AUTH_BYPASS` | client | `1` shows the dev login button |
| `VITE_ADMIN_ENABLED` | client | `true` shows in-game Admin overlay (layout / fog / camera tools) |

See [docs/process.md](docs/process.md) for notes on admin HTTP routes and production hardening.

## Controls

- **Click a walkable floor tile**: walk there (server pathfinding). Base room size depends on the room (e.g. hub **50×50** tiles on the core grid; chamber **25×25**). Extra floor can extend walkable space beyond the core rectangle (**F** — expand mode; Shift+click removes an extra tile where allowed).
- **B**: toggle **build mode** — place blocks on empty tiles; click a block to edit (pass-through, height, hex shape, color). **Esc** cancels reposition or closes panels.
- **Enter**: focus chat; **Enter** again sends and blurs.
- **Fullscreen**: top-right button. **Return to hub** appears when not in the hub room.

## Limitations

- Browser back/forward and some shortcuts are only **best-effort** blocked; OS-level shortcuts cannot be fully disabled.
- Mobile is usable on the same LAN via the dev “Network” URL or by serving the built client from the server; touch UX is not polished.
