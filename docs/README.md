# nspace documentation

Project reference for architecture, shipped features, and how we extend the game. The root [README](../README.md) covers install and run; start there if you are new.

| Document | Contents |
|----------|----------|
| [build.md](build.md) | Stack, runtime shape, world model, authority, rendering — **what the build is** |
| [features-checklist.md](features-checklist.md) | Checkbox-style inventory of implemented areas and a short “future” stub |
| [live-service-implementation.md](live-service-implementation.md) | Split hosting (Vercel + Docker backend), launch policy, logging and replay plan |
| [deploy-github-docker.md](deploy-github-docker.md) | GitHub Actions → VPS Docker deploy; SSH and deploy-key setup |
| [process.md](process.md) | Sync patterns, tick loop, env vars, rate limits, local dev workflow |
| [tile.md](../tile.md) | **Tile design spec** for floor art / meshes (ortho camera, grid units, seams) |

These files are maintained manually; cite source paths in code when details drift.
