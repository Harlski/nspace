# Admin measures — local issue tracker

Ops tools from the Admin Invisibility + Freeze grill. Parent PRD:
[PRD.md](./PRD.md).

**Feature 3** (player reports + movement playback) is out of scope here — grill later.

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

| # | File | Triage | Summary |
|---|------|--------|---------|
| 01 | [issues/01-admin-invisibility.md](issues/01-admin-invisibility.md) | `done` | Admin Invisibility (overlay toggle, presence filter, cues) |
| 02 | [issues/02-freeze.md](issues/02-freeze.md) | `wontfix` | **Superseded** by [`.scratch/other-player-menu/PRD.md`](../other-player-menu/PRD.md) — do not `/implement`; re-split via `/to-issues` there |

## Pick up work

Admin Invisibility is `done`. Fresh Freeze work lives under
[`.scratch/other-player-menu/`](../other-player-menu/) — do not `/implement`
`issues/02-freeze.md`.

```bash
cat .scratch/admin-measures/PRD.md
cat .scratch/admin-measures/issues/01-admin-invisibility.md
```

Update each issue’s `triage:` / `status:` frontmatter and append outcomes under
`## Comments` when done.
