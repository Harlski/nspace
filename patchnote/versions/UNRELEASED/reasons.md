# Reasons — UNRELEASED (patch-notes version)

**Patch-notes version:** `UNRELEASED` (working bucket). Before merging to `main`, run `npm run prepare-merge` so this folder is frozen under a semver that matches [package.json](../../../package.json) (see [patchnote/README.md](../../README.md)).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

_Add a one-line roll-up here when the buffer gets long._

---

## By area

### Repo / docs

- Advertise glossary: **Campaign**, **Project URL**, **Campaign Creative**, **Sign-in Gate** in [CONTEXT.md](../../../CONTEXT.md). ADR [0023](../../../docs/adr/0023-campaign-creatives-are-uploads.md). THE-LARGER-SYSTEM login-gated page principle + campaign creatives decision + [reason_847615](../../../docs/reasons/reason_847615.md). [docs/advertise-guide.md](../../../docs/advertise-guide.md) and [docs/features-checklist.md](../../../docs/features-checklist.md) advertise/admin bullets.

### Client

- _(none in this change set)_

### Server

- **Advertise Sign-in Gate:** `/advertise` (dashboard load, transactions, create/save/duration, image upload) shows "You must be signed in to perform this action." on missing/expired session instead of "Could not load campaigns." (`server/src/signedInRequired.ts`, `server/src/advertisePage.ts`).
- **Campaign Creative upload-only:** owner create rejects remote image URLs; only `/advertise/uploads/{uuid}.{ext}` from `POST /api/advertise/campaigns/upload-image`. Draft update may keep a legacy remote creative until replaced. Admin `PATCH /api/admin/advertise/campaigns/:id` accepts `imageUrl` the same way and rebuilds live rotation billboards. (`server/src/campaignImageUpload.ts`, `server/src/campaignStore.ts`, `server/src/campaignFulfill.ts`, `server/src/adminCampaignPage.ts`). See [adr/0023-campaign-creatives-are-uploads.md](../../../docs/adr/0023-campaign-creatives-are-uploads.md).

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- _(none in this change set)_
