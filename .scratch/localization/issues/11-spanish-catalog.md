# 11 — Spanish message catalog

**What to build:** A player who selects **Español** (Latin American neutral; Costa Rica flag as visual cue) sees catalog-backed product chrome in Spanish wherever keys exist, with English fallback for gaps.

**Blocked by:** 09 — Locale plumbing for vi, es, fil

**Status:** ready-for-agent

- [ ] `es.json` mirrors every key in `en.json`
- [ ] Browser tags `es-CR`, `es-MX`, `es-ES`, etc. resolve to `es`
