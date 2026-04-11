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

- **`docker: command not found`** (exit 127): Docker is not installed, or the **Compose v2** plugin is missing, or `deployer` was never added to the **`docker`** group (and did not start a new session after `usermod`). On the VPS as `deployer`, run `command -v docker && docker compose version`. Install example for Debian/Ubuntu: `sudo apt-get update && sudo apt-get install -y docker.io docker-compose-v2` then `sudo usermod -aG docker deployer` and **log out and back in** (or reboot) so group membership applies to SSH sessions.
- **Permission denied (publickey)** from Actions: check `DEPLOY_USER`, `DEPLOY_HOST`, and that the matching **public** key is in that user’s `authorized_keys`.
- **`git fetch` fails on server**: test `ssh -T git@github.com` on the VPS; fix deploy key / `~/.ssh/config`.
- **Docker permission denied** (`permission denied while trying to connect to the Docker daemon socket`): user must be in `docker` group and use a **new** login session; or prefix `docker` with `sudo` in the workflow (less ideal).
