# Reasons — UNRELEASED (patch-notes version)

**Patch-notes version:** `UNRELEASED` (working bucket). Before merging to `main`, run `npm run prepare-merge` so this folder is frozen under a semver that matches [package.json](../../../package.json) (see [patchnote/README.md](../../README.md)).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

_Add a one-line roll-up here when the buffer gets long._

---

## By area

### Repo / docs

- [docs/features-checklist.md](../../../docs/features-checklist.md), [docs/process.md](../../../docs/process.md), [CONTEXT.md](../../../CONTEXT.md) — Chat substitution glossary + admin/env notes.

### Client

- _(none in this change set)_

### Server

- [server/src/chatSubstitutionStore.ts](../../../server/src/chatSubstitutionStore.ts) — exact public-chat substitutions; JSON store; seed three I-variant triggers; CRUD.
- [server/src/rooms.ts](../../../server/src/rooms.ts) — apply substitutions on public `chat` after trim, before profanity censor; log typed trigger as `textOriginal`.
- [server/src/index.ts](../../../server/src/index.ts) — `GET`/`POST /api/admin/chat/substitutions`, `PUT`/`DELETE /api/admin/chat/substitutions/:id`.
- [server/src/adminChatPage.ts](../../../server/src/adminChatPage.ts) — substitutions panel on `/admin/chat`.
- [server/test/chatSubstitutionStore.test.ts](../../../server/test/chatSubstitutionStore.test.ts)
- [server/.env.example](../../../server/.env.example) — `CHAT_SUBSTITUTION_STORE_FILE`.

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- Default store path is under the existing `server/data` volume (`chat-substitutions.json`). Optional `CHAT_SUBSTITUTION_STORE_FILE`. No new HTML route (Vercel `/api/:path*` already covers the JSON APIs).
