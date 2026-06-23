# Nimiq Space (`nspace`)

**Nimiq Space** is a browser multiplayer hangout for the [Nimiq](https://nimiq.com) community: walk an isometric grid with other players, chat, build with blocks, use portals between rooms, and (in the canvas room) claim tiles on a shared leaderboard. You sign in with a **Nimiq wallet** (or a local **dev login** on your machine only).

**Play live:** [nimiq.space](https://nimiq.space)

## Run locally (end to end)

**Prerequisites:** [Node.js 20+](https://nodejs.org/) (LTS recommended) and npm.

1. **Clone and install**

   ```bash
   git clone https://github.com/Harlski/nspace.git
   cd nspace
   npm install
   ```

2. **Configure the server**

   ```bash
   cp server/.env.example server/.env
   ```

   The example already sets `JWT_SECRET=dev-insecure-change-me` and `DEV_AUTH_BYPASS=1` for local work. Do not use those values in production.

3. **Configure the client**

   Create `client/.env.development` so the UI shows **Dev login** (the server must also have `DEV_AUTH_BYPASS=1`):

   ```bash
   cat > client/.env.development <<'EOF'
   VITE_DEV_AUTH_BYPASS=1
   EOF
   ```

4. **Start dev**

   ```bash
   npm run dev
   ```

   This runs the Vite client and Express/WebSocket server together. You should see both **client** (port **5173**) and **server** (port **3001**) in the terminal.

5. **Open the game**

   Visit [http://localhost:5173](http://localhost:5173), click **Dev login**, and you should land in the hub with other players (including a couple of NPC bots by default).

   To sign in with a real wallet instead, leave dev bypass off and use **Connect wallet** with the [Nimiq Hub](https://hub.nimiq.com).

### If something fails

| Symptom | Check |
|---------|--------|
| Server exits on start | `server/.env` exists and includes `JWT_SECRET` |
| No **Dev login** button | `DEV_AUTH_BYPASS=1` in `server/.env` and `VITE_DEV_AUTH_BYPASS=1` in `client/.env.development`; restart `npm run dev` |
| Page loads but cannot connect | Server terminal shows port **3001** listening; nothing else bound to 5173/3001 |
| Test on phone/LAN | Use the Vite **Network** URL from the terminal; allow firewall ports **5173** and **3001** |

**More detail** (controls, split terminals, production build, Docker): **[docs/getting-started.md](docs/getting-started.md)**.

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
