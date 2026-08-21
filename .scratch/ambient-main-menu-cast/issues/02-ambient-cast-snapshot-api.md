# 02 — Ambient Cast snapshot API

**What to build:** A public unauthenticated snapshot that lists today's UTC Ambient Cast as `{ day, refreshedAt, faces: [{ token }] }` for unique wallets that joined a public/shared room (not a Play Space). No wallet IDs or display names in the response.

**Blocked by:** 01 — Face Token resolver + cache

**Status:** done

- [x] UTC day bounds applied to eligibility
- [x] Play Space joins excluded; Hub / other non–Play Space joins included
- [x] Response contains Face Tokens only (no addresses / display names)
- [x] Empty day returns an empty faces array
- [x] Snapshot stays lean (tokens, not embedded SVG)
