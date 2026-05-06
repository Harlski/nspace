# nspace

> ## Alpha Notice
> This project is currently in **alpha** and is **100% vibe-coded with guidance**.  
> Expect rough edges: some implementations may be sub-optimal, and there may be security vulnerabilities, bugs/glitches, incomplete guides, or gaps in the codebase.
>
> nspace is open sourced so anyone can help improve Nimiq Space.  
> You only need a **Nimiq wallet** to log in, and the project is designed to avoid collecting user PII.

A multiplayer isometric social space built with **Nimiq wallet** authentication, **WebSocket** multiplayer, and **Three.js** 3D rendering. Walk around, build structures, place signposts, and claim tiles in the collaborative canvas room.

🌐 **Live Demo**: [https://nimiq.space](https://nimiq.space)

## ✨ Features

- **Wallet-based Authentication**: Sign in with Nimiq wallet (or dev mode for local testing)
- **Real-time Multiplayer**: WebSocket-powered synchronized player movement and interactions
- **Building System**: Place and customize blocks with various shapes (cubes, ramps, hexagons) and colors
- **Canvas Room**: Claim tiles with your identicon and compete on the leaderboard
- **Signposts**: Leave messages on tiles (hub / your rooms; rules vary by room — see signboards guide)
- **Admin Tools**: Lock objects, manage rooms, and moderate content
- **NPCs**: Server-side “fake players” that wander rooms when `FAKE_PLAYER_COUNT` is greater than 0 (random destinations, guest-style names — not LLM-driven)
- **Multiple Rooms**: Hub, chamber, and canvas rooms with portal teleportation

## 🚀 Quick Start

### Prerequisites

- **Node.js 20+** (LTS recommended)
- **npm** (comes with Node.js)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Harlski/nspace.git
   cd nspace
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   **Client:**
   ```bash
   cp client/.env.example client/.env.development
   ```
   
   **Server:**
   ```bash
   cp server/.env.example server/.env
   ```
   
   The default values are already configured for local development.

4. **Start the development server**
   ```bash
   npm run dev
   ```
   
   This runs both the client (Vite) and server concurrently. Open [http://localhost:5173](http://localhost:5173) in your browser.

5. **Login**
   
   Click **"Dev login"** to enter without a wallet. For production, use **"Connect wallet"** with the Nimiq Hub.

## 🎮 Controls

| Action | Key/Input |
|--------|-----------|
| Walk | Click on walkable floor tiles |
| Build Mode | `B` key |
| Floor Expand Mode | `F` key |
| Chat | `Enter` to focus, type message, `Enter` to send |
| Place Block | Click empty tile in build mode |
| Edit Block | Click existing block in build mode |
| Cancel/Close | `Esc` |
| Fullscreen | Button in top-right |

### Building

- **Build Mode (`B`)**: Place blocks, ramps, hexagons on empty tiles
- **Edit Blocks**: Click placed blocks to change color, shape, height, or make walkable
- **Lock Blocks** (Admin only): Prevent non-admins from editing specific objects
- **Signposts**: Create message signs that display on hover (hub / owner rooms; not on canvas; chamber is admin-only for placement)

## 🌐 Network/LAN Testing

Vite dev server binds to all interfaces. To test on your phone or another device:

1. Note the "Network" URL from the Vite startup logs (e.g., `http://192.168.x.x:5173`)
2. Ensure your firewall allows incoming connections on ports **5173** (dev client) and **3001** (API/WebSocket server)
3. Open the network URL on your other device

## 📦 Production Build

```bash
# Set a secure JWT secret
export JWT_SECRET=$(openssl rand -base64 32)

# DO NOT set DEV_AUTH_BYPASS in production

# Build client and server
npm run build

# Start the server (serves both API and built client)
npm run start
```

The server will serve the built client from `client/dist` and listen on port 3001 by default. Access at `http://your-server:3001`

### Docker Deployment

**Quick Start:**

```bash
# 1. Create .env file with secure JWT secret
echo "JWT_SECRET=$(openssl rand -base64 32)" > .env

# Or copy and edit the example
cp .env.example .env
# Edit .env and set a secure JWT_SECRET

# 2. Build and run
docker compose build
docker compose up -d

# 3. Check logs
docker compose logs -f
```

**Important:** The server requires `JWT_SECRET` to be set and will refuse to start without it in production mode.

See [docker-deployment.md](docker-deployment.md) for detailed Docker deployment guide, including automated CI/CD deployment with GitHub Actions.

## 🔧 Configuration

### Server Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | **Yes** | - | Secret for signing JWT session tokens |
| `DEV_AUTH_BYPASS` | No | `0` | Set to `1` to allow dev login (NEVER in production!) |
| `PORT` | No | `3001` | HTTP server port |
| `FAKE_PLAYER_COUNT` | No | `2` | Number of NPC bots per room (0-32) |

### Client Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_DEV_AUTH_BYPASS` | No | `0` | Set to `1` to show dev login button |
| `VITE_ADMIN_ENABLED` | No | `false` | Show admin overlay UI |
| `VITE_HUB_URL` | No | `https://hub.nimiq.com` | Nimiq Hub URL for wallet authentication |

## 🏗️ Project Structure

```
nspace/
├── client/              # Vite + Three.js frontend
│   ├── src/
│   │   ├── game/       # Game engine, rendering, physics
│   │   ├── ui/         # HUD, menus, overlays
│   │   ├── auth/       # Nimiq wallet integration
│   │   └── net/        # WebSocket client
│   └── .env.example    # Client environment template
├── server/              # Node.js + WebSocket backend
│   ├── src/
│   │   ├── rooms.ts    # Room state, multiplayer logic
│   │   ├── auth.ts     # JWT authentication
│   │   └── eventLog.ts # Gameplay event logging
│   ├── data/           # Persisted world state (gitignored)
│   └── .env.example    # Server environment template
├── docs/               # Project markdown (guides, specs, contributing)
└── README.md           # Short pointer into docs/
```

## 🛠️ Development

### Running Components Separately

**Terminal 1 - Server:**
```bash
export DEV_AUTH_BYPASS=1
export JWT_SECRET=dev-insecure-change-me
npm run dev -w server
```

**Terminal 2 - Client:**
```bash
npm run dev -w client
```

### Admin Configuration

To grant admin privileges, edit `server/src/config.ts`:

```typescript
export const ADMIN_ADDRESSES = new Set([
  "NQ97 4M1T 4TGD VC7F LHLQ Y2DY 425N 5CVH M02Y",  // Example address
  // Add your wallet addresses here
]);
```

Admins can:
- Lock/unlock objects to prevent editing
- Place signposts in the **chamber** (players can place in **hub** and in **rooms they own**, within build range; **canvas** disallows signpost placement)
- Update or remove **any** signboard’s message (`updateSignboard` / `removeSignboard`)
- Access admin overlay (if `VITE_ADMIN_ENABLED=true`)

See [signboards-admin-guide.md](signboards-admin-guide.md) for protocol details.

## 📚 Documentation

| Resource | Description |
|----------|-------------|
| [README.md](README.md) | Documentation index (this folder) |
| [build.md](build.md) | Architecture, tech stack, message flow |
| [features-checklist.md](features-checklist.md) | Implemented features |
| [process.md](process.md) | Development workflow, extending features |
| [deploy-github-docker.md](deploy-github-docker.md) | CI/CD deployment guide |
| [tile.md](tile.md) | Tile art and mesh design specifications |
| [localization.md](localization.md) | i18n status and entry point |
| [signboards-admin-guide.md](signboards-admin-guide.md) | Signboard placement and WS messages |

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Test multiplayer interactions thoroughly
- Update documentation for new features
- Keep server/client message contracts in sync

## ⚠️ Security Notes

- **Never commit** `.env` files or secrets to the repository
- **Never enable** `DEV_AUTH_BYPASS` in production
- Use a **strong random string** for `JWT_SECRET` in production
- The admin overlay exposes unauthenticated APIs - disable in production
- Review `server/src/config.ts` before making the repository public

## 🐛 Known Limitations

- Browser back/forward navigation blocking is best-effort
- Mobile touch UX needs polish
- Some OS-level shortcuts cannot be fully disabled
- Admin HTTP routes are currently unauthenticated (secure before public deployment)

## 📝 License

[MIT License](../LICENSE) — see LICENSE file in repository root

## 🙏 Acknowledgments

- Built with [Nimiq](https://nimiq.com) blockchain technology
- Powered by [Three.js](https://threejs.org) for 3D rendering
- Uses [Vite](https://vitejs.dev) for fast development builds

## 📧 Support

For issues, questions, or feature requests, please [open an issue](https://github.com/Harlski/nspace/issues).

---

Made with ❤️ for the Nimiq community
