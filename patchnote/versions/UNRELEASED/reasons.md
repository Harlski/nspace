# Reasons — UNRELEASED (patch-notes version)

**Patch-notes version:** `UNRELEASED` (working bucket). Before merging to `main`, run `npm run prepare-merge` so this folder is frozen under a semver that matches [package.json](../../../package.json) (see [patchnote/README.md](../../README.md)).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

A wallet must set a custom username before it can enter the world. The hourly activity digest shows that username on its own, with New and Nimiq Pay in separate columns.

---

## By area

### Repo / docs

- Recorded decision in [docs/THE-LARGER-SYSTEM.md](../../../docs/THE-LARGER-SYSTEM.md): a wallet enters only with a custom username. Rationale: [docs/reasons/reason_418276.md](../../../docs/reasons/reason_418276.md).
- [CONTEXT.md](../../../CONTEXT.md) **Username** term; username-set ban may still enter.
- [docs/features-checklist.md](../../../docs/features-checklist.md), [docs/process.md](../../../docs/process.md), [docs/adr/0028-hourly-activity-digest.md](../../../docs/adr/0028-hourly-activity-digest.md), [docs/PRD-nimiq-pay-tutorial.md](../../../docs/PRD-nimiq-pay-tutorial.md): no skip into play; Pay tutorial no longer postpones the picker; digest Player column is the username.

### Client

- [client/src/main.ts](../../../client/src/main.ts): every wallet login, including Nimiq Pay, runs the username gate before `enterGame`. Hub arrival no longer prompts later. Close code `4009` reopens the picker and reconnects after a name is saved.

### Server

- [server/src/playerProfileStore.ts](../../../server/src/playerProfileStore.ts): `getUsernamePromptStatus` sets `mustSetUsername` whenever there is no custom username and the wallet is not username-set banned. `recordUsernamePromptDeferral` always returns `username_prompt_required`. `walletRequiresUsername` is the socket check.
- [server/src/index.ts](../../../server/src/index.ts): wallet sessions without a custom username close `4009 username_required` before `addClient`. Guests and `?stream=1` observers are exempt.
- [server/src/hourlyActivityReport.ts](../../../server/src/hourlyActivityReport.ts): Player column prefers the stored username over a live shortened label. `*` and `+` moved to **New** and **Pay** columns.

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- No new env vars. Existing `player-profiles.json` rows without `customUsername` are prompted on the next wallet connection.
