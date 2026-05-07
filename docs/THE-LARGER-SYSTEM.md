# The larger system — Nimiq Space

This document collects **design principles** and **important design decisions** for Nimiq Space (`nspace`). It is intentionally allowed to be **incomplete**: the goal is to record what matters for a coherent, evolvable product and codebase, and to refine it over time.

**How to use it**

- Before substantial design or implementation work, **read this file** and check whether existing principles apply or conflict.
- When you make or confirm a cross-cutting decision (world model, sync, extensibility, UX philosophy, monetization boundaries, etc.), **update this document** with a short, durable note rather than relying only on chat or one-off PR descriptions.
- **Whenever you intentionally change this file** (add, remove, or materially reword principles or recorded decisions), you **must** also create a new companion file at **`docs/reasons/reason_{unique_6digit_id}.md`** (six digits, unique among existing `docs/reasons/reason_*.md` names). That file should explain **why** `THE-LARGER-SYSTEM` was updated and **how** the change better supports the goals of the larger system (coherence, evolvability, and clear direction). Typos and formatting-only fixes do not require a reason file.

**Relationship to other docs**

- [features-checklist.md](features-checklist.md) and implementation docs describe **current behavior**.
- [brainstorm/README.md](brainstorm/README.md) holds **non-normative** exploration; do not treat it as product truth.
- **This file** sits in between: it is **normative for direction and principles** where we have agreed them, without replacing detailed specs.

---

## Principles (living)

_Add sections here as the system matures. Keep each bullet concrete enough that a future implementer knows what “good” looks like._

- Prefer designs that **scale from simple to rich** without rewriting core contracts (e.g. identifiers, message shapes, room authority) unless there is a deliberate migration story.

- **Client-only visuals on authoritative world objects** — Sparkles, auras, and similar **non-gameplay** overlays on server-owned geometry (e.g. placed obstacles) stay **client render only**: they do not change server state. They must **not** participate in block ray picks or build-mode selection **bounds** unless they are intentionally part of the solid body. Mark decorative children explicitly (e.g. `userData.skipBlockPickAndBounds` in [client/src/game/Game.ts](../client/src/game/Game.ts)) and derive selection outlines from solid `THREE.Mesh` descendants only (`blockGroupWorldBoundsForSelectionOutline`).

---

## Recorded decisions & forward constraints

### Tiles: per-cell customization (future)

**Today:** floor presentation is largely limited to **color** (and the current tile mesh assumptions documented in [tile.md](tile.md)).

**Direction:** we want to be able to **customize individual tiles** with arbitrary content over time—not only a solid floor color. Nothing is required for this yet; when we implement it, favor:

- A clear split between **tile data** (what a cell *is*) and **rendering** (meshes, materials, decals, props).
- A path for **persistence and authority** if tile state is shared or player-owned (server as source of truth where gameplay or fairness matters).

Update this subsection when the data model or sync story is chosen.

### Release line: patch notes + semver on merge

**Intent:** One clear moment ties **shipping semver** (root `package.json`) to **frozen patch notes**, so `main` always carries a coherent “what we just released” folder without hand-renaming drift.

**Human / agent cue:** **“Prepare for merge”** (to `main`) means: run **`npm run prepare-merge`** first (default **patch** bump; use `--minor` or `--major` when the change set warrants it). That command:

1. Renames `patchnote/versions/UNRELEASED/` → `patchnote/versions/<next-semver>/` and rewrites `UNRELEASED` markers inside those markdown files to that version.
2. Bumps the **root** `package.json` `version` to the same `<next-semver>`.
3. Creates a fresh `patchnote/versions/UNRELEASED/` with empty starter `reasons.md` and `public/*.md` templates for the next cycle.

After that, the author **reviews diffs**, then **`git add`**, **`git commit`**, **`git push origin main`**. The version is **already in the commit**; there is no separate post-push versioning step unless you add release tagging in CI later.

**Norm:** Do not merge accumulated `UNRELEASED` work to `main` without running `prepare-merge` (or an equivalent manual freeze that keeps folder name and `package.json` in lockstep). Agents assisting with merges should run or insist on this script when the user says they are ready to merge.

### Monetization: incoming NIM payment intents (sidecar — partial ship)

**Shipped in-repo (infrastructure + player API proxy; product entitlements still TBD):**

- **`payment-intent-service`** (npm workspace): HTTP API with **SQLite** intent ledger, **pluggable `featureKind`** handlers ([`payment-intent-service/src/features/`](../payment-intent-service/src/features/)), working **`nspace.test.min`** quote path, **reserved stubs** for username / billboard slot / land / teleporter, and **on-chain verify** via Nimiq **`getTransaction`** (recipient, sender = payer, value ≥ quote, memo match, confirmations). **Read/verify** require a **`payerWallet`** scoped to the intent row (query param on `GET`, body field on `POST /verify`) so bearer-secret callers cannot iterate all intents by id alone.
- **`/health`** includes a trivial **SQLite** check (`db` / `ok` reflect reachability).
- **Deploy:** dedicated **Docker image**; Compose service **`payment-intent`** behind profile **`payment`**; host volume **`./data/payment-intent/`**; env and troubleshooting in [docker-deployment.md](docker-deployment.md) and [process.md](process.md).
- **Game server proxy (JWT):** when `PAYMENT_INTENT_SERVICE_URL` and `PAYMENT_INTENT_API_SECRET` are set, **`POST /api/payment/intents`**, **`GET /api/payment/intents/:intentId`**, **`POST /api/payment/intents/:intentId/verify`** forward to the sidecar with **`payerWallet` forced from JWT `sub`** ([`server/src/paymentIntentRoutes.ts`](../server/src/paymentIntentRoutes.ts), [`server/src/paymentIntentClient.ts`](../server/src/paymentIntentClient.ts)). If unset, these routes respond **`503`** `payment_intent_unavailable`.
- **Operations / admin:** **`GET /api/admin/system/snapshot`** optionally probes the sidecar (**`/health`**, **`/v1/meta/features`**); **`/admin/system`** renders that block ([`server/src/paymentIntentProbe.ts`](../server/src/paymentIntentProbe.ts), [`server/src/adminSystemPage.ts`](../server/src/adminSystemPage.ts)).
- **Quality:** automated tests (memo, SQLite + payer scope, sidecar config probe, world-state baseline); root **`npm test`**.

**Explicitly not shipped yet (intentional boundary for the next implementation phase):**

- **No** exclusive username registry, billboard slot ledger, land grant, or teleporter entitlement **written on the game server** after a verified intent — callers can complete **quote → pay → verify** via HTTP, but **nothing in `rooms.ts` / profile stores yet consumes** a confirmed intent automatically (see [brainstorm/monetized-features-username-teleporter-land-billboards.md](brainstorm/monetized-features-username-teleporter-land-billboards.md) for sketches only).

**Constraints to preserve:** keep **incoming** NIM verification (sidecar) **separate** from the **outgoing** Nim payout worker inside the main server; never expose **`PAYMENT_INTENT_API_SECRET`** to browsers; **`payerWallet` on proxy routes must always come from JWT `sub`**, never from unauthenticated client-only fields.

---

## Changelog (optional)

_Use brief dated entries if you want a paper trail without bloating the sections above._

- **2026-05-06** — Initial document: `MEMORY.md` anchor, tile customization forward constraint.
- **2026-05-06** — Mandatory companion rationale for intentional edits; see [reasons/reason_618503.md](reasons/reason_618503.md).
- **2026-05-07** — Principle: client-only decorative overlays on obstacles; picking/selection use solid mesh bounds only. See [reasons/reason_834162.md](reasons/reason_834162.md).
- **2026-05-07** — Release line: `prepare-merge` freezes `UNRELEASED` patch notes and bumps root semver before merge to `main`. See [reasons/reason_291847.md](reasons/reason_291847.md).
- **2026-05-07** — Companion rationales moved to **`docs/reasons/`** (see [reasons/reason_105892.md](reasons/reason_105892.md)).
- **2026-05-07** — Documented completed **payment-intent** sidecar scope vs. intentional “not wired to gameplay API yet” boundary. See [reasons/reason_472901.md](reasons/reason_472901.md).
- **2026-05-07** — Payment intents: **JWT proxy routes** on `nspace`, **payer-scoped** sidecar reads/verify, **`/health` + SQLite**. See [reasons/reason_519027.md](reasons/reason_519027.md).
