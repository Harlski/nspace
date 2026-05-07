# Project memory (`nspace`)

This file is a **lightweight anchor** for humans and automation: where to look for durable intent that is not fully captured in code or the feature checklist alone.

- **[docs/THE-LARGER-SYSTEM.md](docs/THE-LARGER-SYSTEM.md)** — evolving **design principles** and notable cross-cutting decisions for Nimiq Space. Consult it when designing or changing behavior that could paint the project into a corner; **extend it** when you lock in or discover an important principle worth remembering. Intentional edits there require a new **`docs/reasons/reason_{unique_6digit_id}.md`** (see that file).
- **[AGENTS.md](AGENTS.md)** — repo map, golden paths, and maintenance expectations for contributors and agents.
- **[patchnote/README.md](patchnote/README.md)** — **patch notes** are **version-scoped** under `patchnote/versions/<version>/`: [reasons.md](patchnote/versions/UNRELEASED/reasons.md) (technical, attached to that version) and [public/](patchnote/versions/UNRELEASED/public/) (tiered public summaries). Work in `UNRELEASED`; rename the folder to freeze (see README).

Normative “what ships today” detail still lives in **`docs/*.md`**, [docs/features-checklist.md](docs/features-checklist.md), and code. `THE-LARGER-SYSTEM` is complementary: it optimizes for the **best long-term system**, even when it is incomplete.
