# Other Player Menu + Freeze — local issue tracker

Parent PRD: [PRD.md](./PRD.md). Status: **`ready-for-agent`** (issues filed 2026-08-08).

Confirmed seams: `otherPlayerMenuModel` (client menu shape) + `adminFreeze` (server
policy / room wiring + admin-only Frozen cue). Supersedes the unfinished Freeze brief
under [`.scratch/admin-measures/issues/02-freeze.md`](../admin-measures/issues/02-freeze.md)
— Admin Invisibility there remains `done`.

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
| 01 | [issues/01-nested-other-player-menu.md](issues/01-nested-other-player-menu.md) | `done` | Nested Other Player Menu (`otherPlayerMenuModel`) |
| 02 | [issues/02-admin-freeze.md](issues/02-admin-freeze.md) | `done` | Admin Freeze (`adminFreeze` + cue) |

## Pick up work

```bash
cat .scratch/other-player-menu/PRD.md
cat .scratch/other-player-menu/issues/01-nested-other-player-menu.md
# then
cat .scratch/other-player-menu/issues/02-admin-freeze.md
```

Update each issue’s `triage:` / `status:` frontmatter and append outcomes under
`## Comments` when done.
