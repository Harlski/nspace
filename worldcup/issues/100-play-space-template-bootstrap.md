---
id: "100-play-space-template-bootstrap"
milestone: M8
depends_on: []
triage: ready-for-agent
status: done
acceptance:
  - build shell can be extracted from a persisted room and applied to an invite-lobby room id
  - empty template store bootstraps a default play space template from the current hardcoded lounge
  - new play spaces seed from the default template instead of inline hardcoded blocks
  - invite record stores templateId for traceability
verify:
  - "npm run build"
  - "npm test -w server"
  - "manual: fresh/empty template store, open private room, layout matches today's lounge"
---

# 100 — Play Space template store, bootstrap & seeding

## Parent

[worldcup/PRD-play-space-templates.md](../PRD-play-space-templates.md)

## What to build

Introduce the **play space template store** and **Build Shell** transform as the single deep
module seam: extract sanitized geometry from any persisted room, apply into an in-memory
invite-lobby room, persist templates to versioned JSON.

On first run with an empty store, auto-create one **Default Play Space Template** from the
current hardcoded Play Space lounge so deploy behavior is unchanged.

Wire Play Space creation so the server seeds from the resolved default template (replacing
the inline hardcoded `ensurePlaySpaceLayout` path). Record `templateId` on the
**Direct Invite** / Play Space record at create time.

Unit tests: extract strips teleporters/gates/claimables; apply produces passable join spawn;
default template resolution; bootstrap idempotency on restart when store already populated.

## Acceptance criteria

- [ ] **Build Shell** extract/apply module exists with tests (sanitization, bounds, spawn).
- [ ] Versioned `play-space-templates.json` (or equivalent) persists templates across restarts.
- [ ] Empty store bootstraps exactly one default template equivalent to today's hardcoded lounge.
- [ ] New Play Spaces receive a copy of the default template at first entry (not hardcoded blocks).
- [ ] `templateId` is stored on the invite/Play Space record when created.
- [ ] Existing join link / QR / guest confinement behavior unchanged aside from seed source.

## Blocked by

None — can start immediately.
