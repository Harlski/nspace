# Sale Displays — local issue tracker

Parent PRD: [PRD.md](./PRD.md). ADR: [docs/adr/0015-sale-displays.md](../../docs/adr/0015-sale-displays.md).

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
| 01 | [issues/01-sale-display-store.md](issues/01-sale-display-store.md) | `done` | — | Store + Published bind + wire projection |
| 02 | [issues/02-place-unbound-shaper.md](issues/02-place-unbound-shaper.md) | `done` | 01 | Place unbound in The Shaper + live sync |
| 03 | [issues/03-bind-edit-modal.md](issues/03-bind-edit-modal.md) | `ready-for-agent` | 02 | Edit modal bind + slot-aware show |
| 04 | [issues/04-try-buy-panel.md](issues/04-try-buy-panel.md) | `ready-for-agent` | 03 | Click → try + buy (Cosmetic Unlock) |
| 05 | [issues/05-retire-auto-gallery.md](issues/05-retire-auto-gallery.md) | `ready-for-agent` | 03 | Retire auto Preset gallery |
| 06 | [issues/06-kiosks-and-archive.md](issues/06-kiosks-and-archive.md) | `ready-for-agent` | 04 | Outside-Shaper kiosks + Archived hide |

Work the frontier: start at **01**. After 03, **04** and **05** can run in parallel.
Each `/implement` should start in a **fresh** context from the ticket file only.

## Pick up work

```bash
cat .scratch/sale-displays/PRD.md
cat .scratch/sale-displays/issues/01-sale-display-store.md
```
