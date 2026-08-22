---
Type: grilling
Status: resolved
Blocked by: 03, 04, 05, 06
---

# Ongoing localization rule for new features

## Question

What durable process rule do we adopt so every new user-facing feature ships with localization in mind (and does not reintroduce hard-coded English in product chrome)?

Agent recommendation to lock unless overridden: record a short principle in `docs/THE-LARGER-SYSTEM.md` + a checklist bullet in `docs/process.md` / features workflow: new player-visible strings go through Message Catalog keys in the same change as the UI; `en` complete required; `tr`/`pt-BR` may lag with English fallback; `/admin/*` exempt; user-authored and third-party exempt. Optional CI later: fail on missing `en` keys referenced in code; warn (not fail) on missing alternate-locale keys. Patch-note / agent handbook pointers when the rule is normative.

## Answer

Record a short principle in **`docs/THE-LARGER-SYSTEM.md`** plus a checklist bullet in **`docs/process.md`** / features workflow: new player-visible strings go through Message Catalog keys in the same change as the UI; `en` complete required; `tr`/`pt-BR` may lag with English fallback; `/admin/*` exempt; user-authored and third-party exempt. Optional CI later: fail on missing `en` keys; warn (not fail) on missing alternate-locale keys. Patch-note / agent handbook pointers when the rule is normative.
