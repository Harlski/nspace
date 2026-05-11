# Deploy with GitHub Actions + Docker on your VPS

Pushing to `main` runs [.github/workflows/deploy-docker.yml](../.github/workflows/deploy-docker.yml): SSH into the server, optionally **POST `/api/hooks/pre-deploy-restart`** (60s countdown for connected players) and **`sleep 60`**, then **`docker compose stop`** (graceful shutdown so the game server flushes persistence), **archive `./data` into `./backups/nspace-data-<UTC-timestamp>.tar.gz`**, then `git fetch` + `git reset --hard origin/main` (not `git pull`), then `docker compose build`, `docker compose up -d`.

World state and logs already live on the **host** at `./data` (Compose bind mount); the backup step copies that tree from disk, not from inside a running container.

The workflow assumes the repository is cloned at **`/opt/nspace`** on the host. Change the `cd` path in the workflow if you use a different directory.

## What you need on the server

- Docker Engine + Docker Compose plugin (`docker compose version`).
- Git.
- A directory containing:
  - This repo (full clone).
  - A `.env` file next to `docker-compose.yml` (see [Environment](#environment) below).
  - A persistent data directory: create `data/` so the compose file can mount `./data` → world + event logs.

**Important:** The deploy script `cd`s to `/opt/nspace` and runs `git fetch`. That path must be a **full `git clone`**, not an empty folder. If you only `mkdir` without cloning, you get `fatal: not a git repository`.

```bash
sudo mkdir -p /opt/nspace
sudo chown -R deployer:deployer /opt/nspace
sudo -u deployer bash -c 'cd /opt/nspace && git clone git@github.com:YOUR_ORG/nspace.git .'
sudo -u deployer mkdir -p /opt/nspace/data
```

Replace `YOUR_ORG/nspace` with your repo (same as `github.com/<owner>/<name>`). After the [VPS → GitHub deploy key](#a-vps--github-deploy-key-so-the-server-can-git-pull) is configured, `git clone` must succeed.

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

3. Add repo **secrets** for the workflow (not “Variables”):

GitHub has two tabs: **Secrets** and **Variables**. This workflow reads **`secrets.DEPLOY_*`**. If you only create **Variables**, `secrets.DEPLOY_HOST` stays empty and the SSH step fails with **`Error: missing server host`**.

Go to **Repository → Settings → Secrets and variables → Actions → Secrets** (tab) → **New repository secret**.

| Secret | Example | Purpose |
|--------|---------|---------|
| `DEPLOY_HOST` | `203.0.113.50` or `vps.example.com` | SSH target |
| `DEPLOY_USER` | `ubuntu` or `deploy` | SSH login |
| `DEPLOY_SSH_KEY` | *(private key PEM)* | Auth from Actions |

**Spelling:** Names must be exactly `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY` (all caps, underscores as shown).

**Same repository as the workflow:** Secrets are tied to the repo that runs the workflow. If the run is on a **fork** (`youruser/nspace`), you must add secrets on **that fork**, not only on `upstream/nspace`. Organization secrets must explicitly **allow** this repository.

**Variables vs secrets (host/user):** The workflow accepts **`DEPLOY_HOST` / `DEPLOY_USER` as either repository Secrets *or* repository Variables** (`secrets.* || vars.*`). The **private key must stay a Secret** — never put it in Variables.

**Debug log shows `secrets.DEPLOY_HOST => null`:** Those values were not in scope for the job. Common cases: wrong repo/fork, typo in names, or values stored only under **Settings → Environments → *name*** while the workflow job did not set `environment: *matching name*`. This repo’s workflow uses `environment: Production` — put `DEPLOY_HOST`, `DEPLOY_USER`, and `DEPLOY_SSH_KEY` under **Environments → Production** (secrets + variables as appropriate), **or** under **Actions → Secrets / Variables** at the repository level.

**Never store `DEPLOY_SSH_KEY` under Environment *variables*** (they are visible in the UI and in logs more easily). Use **Environment secrets** or **repository Actions secrets** for the private key only.

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

Do **not** commit `.env`. The compose file binds `127.0.0.1:3001:3001`; put **Caddy or Nginx** in front for TLS and proxy `/`, `/api`, and **`/ws`** (WebSockets).

### Pre-stop player notice (optional, GitHub deploy)

When **`DEPLOY_RESTART_HOOK_SECRET`** is set in **`/opt/nspace/.env`** (same file Compose uses):

1. Generate a long random string (≥16 characters), e.g. `openssl rand -hex 24`.
2. Add a line: `DEPLOY_RESTART_HOOK_SECRET=<that value>` (no quotes unless your shell requires them for special characters).
3. Ensure the **`nspace`** container receives it: with the default `env_file: ./.env` in [docker-compose.yml](../docker-compose.yml), the key is passed into the Node process automatically after **`docker compose up -d`** (redeploy once after editing `.env`).

On each push to **`main`**, the deploy script **sources** `.env`, then **`curl`**s `http://127.0.0.1:3001/api/hooks/pre-deploy-restart` with **`Authorization: Bearer <DEPLOY_RESTART_HOOK_SECRET>`** and JSON **`{"etaSeconds":60,"message":"…"}`**. If the request succeeds, the workflow **waits 60 seconds** so clients can show the orange HUD banner before **`docker compose stop`**.

- If the secret is **unset**, the script skips the hook and proceeds immediately (same behavior as before this feature).
- If **`curl` fails** (game not running, wrong secret, or hook not configured in the running image yet), the script logs a warning, waits **5 seconds**, then continues so deploy does not hang forever.

The hook is also documented in [docs/process.md](process.md). Manual trigger (same as CI): `curl -fsS -X POST http://127.0.0.1:3001/api/hooks/pre-deploy-restart -H "Authorization: Bearer $DEPLOY_RESTART_HOOK_SECRET" -H "Content-Type: application/json" -d '{"etaSeconds":60}'`.

### Reverse proxy (Caddy)

**Prerequisites:** DNS **A** record for `api.nimiq.space` (or your API hostname) → VPS public IP; firewall allows **80** and **443** (this repo’s UFW example already does). Docker stack is up and `curl -sS http://127.0.0.1:3001/api/health` returns `200`.

1. **Install Caddy** (Debian/Ubuntu — see [Caddy install](https://caddyserver.com/docs/install#debian-ubuntu-raspbian) if your OS differs):

```bash
sudo apt-get update
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update
sudo apt-get install -y caddy
```

2. **Configure** — example file in the repo: [`deploy/caddy/Caddyfile.example`](../deploy/caddy/Caddyfile.example). Minimal site block:

```caddyfile
api.nimiq.space {
	handle_path /nim-chart-api/* {
		reverse_proxy 127.0.0.1:3080
	}
	reverse_proxy 127.0.0.1:3001
}
```

**nim-chart:** run `docker compose up -d nim-chart` so `:3080` is listening; the block above forwards `https://api.nimiq.space/nim-chart-api/...` to the chart service (path prefix stripped). The Vercel SPA uses [`vercel.json`](../vercel.json) (repo root) or [`client/vercel.json`](../client/vercel.json) (when Vercel Root Directory is `client`) to rewrite `/nim-chart-api/*` to the same URL on `api.nimiq.space`. Set **`VITE_NIM_CHART_API_URL=https://nimiq.space/nim-chart-api`** in the Vercel project (rebuild) and in repo **`.env`** before **`docker compose build`** so the Docker-served client bundle includes it.

Replace `api.nimiq.space` with your API hostname if different. Copy to the system Caddyfile:

```bash
sudo nano /etc/caddy/Caddyfile
# paste the block above (or copy from deploy/caddy/Caddyfile.example), save
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl enable --now caddy
sudo systemctl status caddy
```

3. **Verify** from your laptop (not only on the server):

```bash
curl -sS -w "\nhttp_code=%{http_code}\n" https://api.nimiq.space/api/health
dig +short api.nimiq.space A   # should show the VPS public IP
```

First request may take a few seconds while **Let’s Encrypt** issues the certificate. If issuance fails, check DNS propagation, that **ports 80/443** reach this host, and `journalctl -u caddy -e`.

**Why Caddy:** Automatic HTTPS, no separate Certbot step, and `reverse_proxy` forwards **WebSocket** upgrades for `wss://api.nimiq.space/ws` by default.

## First deploy (manual)

```bash
cd /opt/nspace
docker compose build
docker compose up -d
curl -sS http://127.0.0.1:3001/api/health
```

After GitHub secrets are set, merging or pushing to `main` will run the workflow and refresh the container.

## Pre-deploy backup (automated)

Each deploy creates **`/opt/nspace/backups/nspace-data-*.tar.gz`** (same `DEPLOY_ROOT` as above) **after** the stack is stopped, so the archive is not taken while containers are writing. The tarball includes the full `data/` tree (world state, `events/`, optional `data/payment-intent/` if you use that sidecar).

**Disk:** Monitor free space on the VPS; old archives are not pruned automatically. Remove or rotate archives on a schedule that fits your retention policy.

## Troubleshooting

- **`docker: command not found`** (exit 127): Docker is not installed, or the **Compose v2** plugin is missing, or `deployer` was never added to the **`docker`** group (and did not start a new session after `usermod`). On the VPS as `deployer`, run `command -v docker && docker compose version`. Install example for Debian/Ubuntu: `sudo apt-get update && sudo apt-get install -y docker.io docker-compose-v2` then `sudo usermod -aG docker deployer` and **log out and back in** (or reboot) so group membership applies to SSH sessions.
- **Permission denied (publickey)** from Actions: check `DEPLOY_USER`, `DEPLOY_HOST`, and that the matching **public** key is in that user’s `authorized_keys`.
- **`git fetch` fails on server**: test `ssh -T git@github.com` on the VPS; fix deploy key / `~/.ssh/config`.
- **Docker permission denied** (`permission denied while trying to connect to the Docker daemon socket`): user must be in `docker` group and use a **new** login session; or prefix `docker` with `sudo` in the workflow (less ideal).
- **`https://nimiq.space/nim-chart-api/...` returns 404** on Vercel: deploy the [`vercel.json`](../vercel.json) / [`client/vercel.json`](../client/vercel.json) rewrite and reload Caddy with `handle_path /nim-chart-api/*` → `127.0.0.1:3080`. On the VPS run `curl -sS http://127.0.0.1:3080/health` and `curl -sS "https://api.nimiq.space/nim-chart-api/health"` (both should be `200`).
- **`/assets/main-*.js` or `nimiq-*.js` 404** on the SPA host: almost always a Vercel **output directory** mismatch (HTML from a build whose `client/dist` was not published). Set Root Directory to **`client`** *or* use repo-root [`vercel.json`](../vercel.json) with **`outputDirectory`: `client/dist`**, then redeploy. Hard-refresh the site (or disable cache in DevTools) once so the browser does not keep an old `index.html` pointing at removed hashes.
- **`/patchnotes` 404 on Vercel:** the path is handled only in client JS; the static host must rewrite **`/patchnotes`** and **`/patchnotes/`** to **`/index.html`** (see [`vercel.json`](../vercel.json) / [`client/vercel.json`](../client/vercel.json)), then redeploy.
