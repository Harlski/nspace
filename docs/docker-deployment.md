# Docker Deployment Guide

## Quick Start with Docker Compose

### Prerequisites

- Docker and Docker Compose installed
- A secure JWT secret

### Setup

1. **Create environment file**
   
   ```bash
   # Generate a secure JWT secret
   echo "JWT_SECRET=$(openssl rand -base64 32)" > .env
   
   # Or copy from example and edit
   cp .env.example .env
   # Then edit .env and replace CHANGE_ME_TO_A_SECURE_RANDOM_STRING
   ```

2. **Build and start**
   
   ```bash
   docker compose build
   docker compose up -d
   ```

3. **View logs**
   
   ```bash
   docker compose logs -f
   ```

4. **Stop**
   
   ```bash
   docker compose down
   ```

### Configuration

Edit the `.env` file in the **repository root** (next to `docker-compose.yml`). The compose file also loads optional **`./server/.env`** if present — later keys override earlier ones on duplicates. Use one or both files; do not commit real secrets.

Example root `.env` entries:

```bash
# REQUIRED: Secure JWT secret
JWT_SECRET=<your-secure-random-string>

# Optional: Number of NPCs per room (0-32)
FAKE_PLAYER_COUNT=2

# DO NOT set these in production:
# DEV_AUTH_BYPASS=1
```

### Data Persistence

World state is persisted to `./data/` on your host machine (mapped to `/app/server/data` in container):

- `world-state.json` - Placed blocks, extra floors, spawn positions
- `signboards.json` - Player-created signposts
- `canvas-claims.json` - Canvas room tile claims
- `events/` - Gameplay event logs

This volume ensures your data survives container restarts.

### Payment intent sidecar (optional)

The **`payment-intent`** service is a **separate** Node container from `nspace` (and from the Nim payout worker inside the game server). It implements a small **payment intent ledger** plus **on-chain verification** for incoming NIM, so future product features (exclusive username, billboard slots, land, teleporters) can share one flow: quote → pay with memo → verify transaction.

- **Enable:** `docker compose --profile payment up -d` (the profile is required; the service is off by default).
- **Build context:** repository root; Dockerfile [`payment-intent-service/Dockerfile`](../payment-intent-service/Dockerfile).
- **Port:** `127.0.0.1:3090` → `3090` in the container.
- **Persistence:** host directory `./data/payment-intent` → `/data` (SQLite file `payment-intents.sqlite` via `PAYMENT_INTENT_SQLITE_PATH`).
- **Required env:** `PAYMENT_INTENT_API_SECRET`, `PAYMENT_INTENT_RECIPIENT_ADDRESS`, and `NIM_NETWORK` (place in root `.env` or `server/.env` like the main app). See [`payment-intent-service/.env.example`](../payment-intent-service/.env.example).

**HTTP API** (all `/v1/*` routes require `Authorization: Bearer <PAYMENT_INTENT_API_SECRET>`):

| Method | Path | Purpose |
|--------|------|--------|
| `GET` | `/health` | Liveness (no auth) |
| `GET` | `/v1/meta/features` | Lists registered `featureKind` strings |
| `POST` | `/v1/intents` | Create intent: `featureKind`, `payerWallet`, optional `featurePayload`, optional `idempotencyKey` → `{ intent: { intentId, amountLuna, recipient, memo, … } }` |
| `GET` | `/v1/intents/:intentId` | Read status |
| `POST` | `/v1/intents/:intentId/verify` | Body `{ "txHash": "…" }` → `{ ok, intent, chainMessage? }`; checks recipient, sender = payer, value ≥ quoted amount, memo matches, confirmations |

**Extending:** register new `PaymentFeatureHandler` modules (see `payment-intent-service/src/features/`). Built-in kinds include `nspace.test.min` (integration tests) and reserved stubs `nspace.username.exclusive`, `nspace.billboard.slot`, `nspace.teleporter.purchase`, `nspace.land.grant`.

**Local dev without Docker:** `npm run dev:payment-intent` from the repo root (set the same env vars first).

**Game server (`nspace` container) wiring:** `docker-compose.yml` passes through `PAYMENT_INTENT_SERVICE_URL` and `PAYMENT_INTENT_API_SECRET` from your `.env`. When you run `docker compose --profile payment up -d`, set e.g. `PAYMENT_INTENT_SERVICE_URL=http://payment-intent:3090` so `/admin/system` can reach the sidecar on the default Docker network.

### Production Deployment

**For VPS deployment:**

1. Clone repository to your server
2. Create `.env` with secure values
3. Update `docker-compose.yml` if needed (ports, bind address)
4. Set up nginx/Caddy reverse proxy with SSL (recommended)
5. Run `docker compose up -d`

**Example nginx config:**
```nginx
server {
    listen 80;
    server_name nimiq.space;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name nimiq.space;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Troubleshooting

**Container won't start:**
```bash
# Check logs
docker compose logs

# Common issues:
# - JWT_SECRET not set in .env
# - Port 3001 already in use
# - Permissions on ./data/ volume
```

**`nspace` keeps restarting with profile `payment`:** `NODE_ENV=production` rejects `JWT_SECRET=dev-insecure-change-me` from `server/.env`. Set a real secret (e.g. `openssl rand -base64 32`) in `./.env` and/or `./server/.env`, then `docker compose --profile payment up -d --force-recreate`.

**`payment-intent` keeps restarting:** The sidecar requires `PAYMENT_INTENT_API_SECRET` and `PAYMENT_INTENT_RECIPIENT_ADDRESS` (and usually `NIM_NETWORK`). Put them in the **repository root** `.env` so Compose can substitute them into the service, or define them in `server/.env` (loaded via `env_file`). Check: `docker compose logs payment-intent --tail 30`.

**Update to latest code:**
```bash
git pull
docker compose build
docker compose up -d
```

**Reset world state:**
```bash
# Stop containers
docker compose down

# Backup (optional)
mv data data.backup

# Start fresh
docker compose up -d
```

### CI/CD Integration

See [docs/deploy-github-docker.md](../docs/deploy-github-docker.md) for GitHub Actions automated deployment setup.

## Manual Docker Build (without Compose)

```bash
# Build image
docker build -t nspace:latest .

# Generate JWT secret
JWT_SECRET=$(openssl rand -base64 32)

# Run container
docker run -d \
  --name nspace \
  -p 127.0.0.1:3001:3001 \
  -e NODE_ENV=production \
  -e JWT_SECRET="$JWT_SECRET" \
  -e FAKE_PLAYER_COUNT=2 \
  -v $(pwd)/data:/app/server/data \
  nspace:latest

# View logs
docker logs -f nspace

# Stop
docker stop nspace
docker rm nspace
```

Payment intent image (from repo root):

```bash
docker build -f payment-intent-service/Dockerfile -t nspace-payment-intent:latest .
```

## Security Checklist

Before deploying to production:

- [ ] Set a strong random `JWT_SECRET` in `.env`
- [ ] Never set `DEV_AUTH_BYPASS=1` in production
- [ ] Use a reverse proxy with SSL/TLS
- [ ] Restrict admin HTTP endpoints (or disable `VITE_ADMIN_ENABLED`)
- [ ] Keep `.env` file secure (never commit to git)
- [ ] Set up firewall rules
- [ ] Regular backups of `./data/` volume (include `./data/payment-intent/` if you use the payment sidecar)
- [ ] Monitor logs for suspicious activity

---

**Need help?** See [getting-started.md](getting-started.md) or open an issue.
