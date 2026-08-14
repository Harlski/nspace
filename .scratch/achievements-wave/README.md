# Achievements wave — local issue tracker

Parent PRD: [PRD.md](./PRD.md).

Grill captured **Temporarily unavailable** and **Cosmetics** (achievement Category) in
[CONTEXT.md](../../CONTEXT.md).

## Status legend

| Triage role | Meaning |
|-------------|---------|
| `needs-triage` | Not yet evaluated |
| `needs-info` | Waiting on reporter |
| `ready-for-agent` | Agent brief attached — pick up with `/implement` |
| `ready-for-human` | Needs human judgment |
| `wontfix` | Closed |
| `done` | Shipped |

## Queue

| # | File | Triage | Blocked by | Summary |
|---|------|--------|------------|---------|
| 01 | [issues/01-shop-admin-runtime-gate.md](issues/01-shop-admin-runtime-gate.md) | `done` | — | Shop checkbox on `/admin/settings`; live COMING SOON |
| 02 | [issues/02-temporarily-unavailable.md](issues/02-temporarily-unavailable.md) | `done` | — | Availability state + Progress Overview fractions |
| 03 | [issues/03-level-ladder-reward-catalog.md](issues/03-level-ladder-reward-catalog.md) | `done` | — | Level 5/10/15 + `ach-*` nameplate/chat bubble SKUs |
| 04 | [issues/04-worldcraft-rooms-pack.md](issues/04-worldcraft-rooms-pack.md) | `done` | 03 | Open House, Room to Room, visitors, Two Keys, Extra Hands |
| 05 | [issues/05-social-play-space-pack.md](issues/05-social-play-space-pack.md) | `done` | 03 | Whisper, Other Player Menu, Play Space, Direct Invite |
| 06 | [issues/06-cosmetics-category-pack.md](issues/06-cosmetics-category-pack.md) | `done` | 01, 02, 03 | Cosmetics Category; Shop/Shaper Temporarily unavailable |
| 07 | [issues/07-exploration-pack.md](issues/07-exploration-pack.md) | `done` | — | Knock Knock, Toll Crossed |

All seven issues completed via `/implement` (2026-08-14).

## Pick up work

```bash
cat .scratch/achievements-wave/PRD.md
cat .scratch/achievements-wave/issues/01-shop-admin-runtime-gate.md
```

Update each issue’s `triage:` / `status:` frontmatter and append outcomes under
`## Comments` when done.
