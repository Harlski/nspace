# Deploy with GitHub Actions + Docker on your VPS

Pushing to `main` runs [.github/workflows/deploy-docker.yml](../.github/workflows/deploy-docker.yml): SSH into the server, `git pull` (fast-forward), `docker compose build`, `docker compose up -d`.

The workflow assumes the repository is cloned at **`/opt/nspace`** on the host. Change the `cd` path in the workflow if you use a different directory.

## What you need on the server

- Docker Engine + Docker Compose plugin (`docker compose version`).
- Git.
- A directory containing:
  - This repo (full clone).
  - A `.env` file next to `docker-compose.yml` (see [Environment](#environment) below).
  - A persistent data directory: create `data/` so the compose file can mount `./data` → world + event logs.

```bash
sudo mkdir -p /opt/nspace/data
sudo chown -R "$USER:$USER" /opt/nspace
cd /opt/nspace
# clone (after GitHub deploy key is set up — next section)
git clone git@github.com:YOUR_ORG/nspace.git .
```

## Two different SSH keys (do not mix them up)

| Purpose | Private key lives on | Public key goes on |
|--------|----------------------|---------------------|
| **GitHub Actions → your VPS** | GitHub Secret `DEPLOY_SSH_KEY` | VPS: `~/.ssh/authorized_keys` for the SSH user |
| **VPS → GitHub (`git pull`)** | VPS: e.g. `~/.ssh/nspace_git_ed25519` | GitHub: repo **Deploy keys** (read-only) |

### A) VPS → GitHub: deploy key (so the server can `git pull`)

On the **VPS**, generate a key used only for this repository:

```bash
ssh-keygen -t ed25519 -C "nspace-git-pull" -f ~/.ssh/nspace_git_ed25519 -N ""
chmod 600 ~/.ssh/nspace_git_ed25519
```

Show the **public** key and add it in GitHub:

**Repository → Settings → Deploy keys → Add deploy key**

- Title: e.g. `nspace production pull`
- Key: contents of `~/.ssh/nspace_git_ed25519.pub`
- Leave **Allow write** unchecked (read-only is enough).

Configure SSH to use this key for GitHub:

```bash
nano ~/.ssh/config
```

```sshconfig
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/nspace_git_ed25519
  IdentitiesOnly yes
```

```bash
chmod 600 ~/.ssh/config
ssh -T git@github.com
# expect: "Hi YOUR_ORG/nspace! You've successfully authenticated..."
```

Clone or set remote with SSH:

```bash
cd /opt/nspace
git clone git@github.com:YOUR_ORG/nspace.git .
```

### B) GitHub Actions → VPS: deploy SSH key

Generate a **separate** key pair on a trusted machine (not the server’s git key):

```bash
ssh-keygen -t ed25519 -C "gha-deploy-nspace" -f ./gha_nspace_deploy_ed25519 -N ""
```

1. **Private key** (`gha_nspace_deploy_ed25519`, full file including `BEGIN/END`): add as repo secret  
   **Settings → Secrets and variables → Actions → New repository secret**

   - Name: `DEPLOY_SSH_KEY`
   - Value: paste entire private key

2. **Public key** (`gha_nspace_deploy_ed25519.pub`): append to the **deployment user** on the VPS:

```bash
# on VPS, as the user that will run docker (e.g. your login or `deploy`)
mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo 'ssh-ed25519 AAAA...your-public-key... gha-deploy-nspace' >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

That user must be able to run Docker:

```bash
sudo usermod -aG docker "$USER"
# log out and back in
```

3. Add repo secrets for the workflow:

| Secret | Example | Purpose |
|--------|---------|---------|
| `DEPLOY_HOST` | `203.0.113.50` or `vps.example.com` | SSH target |
| `DEPLOY_USER` | `ubuntu` or `deploy` | SSH login |
| `DEPLOY_SSH_KEY` | *(private key PEM)* | Auth from Actions |

If the private key has a passphrase, the `appleboy/ssh-action` step can take `passphrase: ${{ secrets.DEPLOY_SSH_PASSPHRASE }}` (add that secret). Prefer **no passphrase** on this deploy key and restrict by `authorized_keys` + firewall.

**SSH not on port 22?** Add `port: YOUR_PORT` under `with:` in the workflow (see [appleboy/ssh-action](https://github.com/appleboy/ssh-action)).

## Environment

On the server, next to `docker-compose.yml`:

```bash
nano /opt/nspace/.env
```

At minimum (adjust for production):

```env
JWT_SECRET=use-a-long-random-secret
NODE_ENV=production
# Optional overrides:
# HOST=0.0.0.0
# PORT=3001
# EVENT_LOG_DIR=/app/server/data/events
# WORLD_STATE_DIR=/app/server/data
```

Do **not** commit `.env`. The compose file binds `127.0.0.1:3001:3001`; put **Nginx/Caddy** in front for TLS and proxy `/`, `/api`, `/ws`.

## First deploy (manual)

```bash
cd /opt/nspace
docker compose build
docker compose up -d
curl -sS http://127.0.0.1:3001/api/health
```

After GitHub secrets are set, merging or pushing to `main` will run the workflow and refresh the container.

## Troubleshooting

- **Permission denied (publickey)** from Actions: check `DEPLOY_USER`, `DEPLOY_HOST`, and that the matching **public** key is in that user’s `authorized_keys`.
- **`git fetch` fails on server**: test `ssh -T git@github.com` on the VPS; fix deploy key / `~/.ssh/config`.
- **Docker permission denied**: user must be in `docker` group or use `sudo` (if you use `sudo`, update the workflow script to prefix `docker` with `sudo`).
