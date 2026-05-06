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

## Security Checklist

Before deploying to production:

- [ ] Set a strong random `JWT_SECRET` in `.env`
- [ ] Never set `DEV_AUTH_BYPASS=1` in production
- [ ] Use a reverse proxy with SSL/TLS
- [ ] Restrict admin HTTP endpoints (or disable `VITE_ADMIN_ENABLED`)
- [ ] Keep `.env` file secure (never commit to git)
- [ ] Set up firewall rules
- [ ] Regular backups of `./data/` volume
- [ ] Monitor logs for suspicious activity

---

**Need help?** See [getting-started.md](getting-started.md) or open an issue.
