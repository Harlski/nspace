---
Type: grilling
Status: resolved
Blocked by:
---

# Locale Preference apply semantics

## Question

When the player changes language in the Player Menu, what exactly happens on the client and how do non-admin HTML pages pick it up?

Agent recommendation to lock unless overridden: write Locale Preference to `localStorage` + cookie; set `document.documentElement.lang`; re-render (or rebuild) all mounted localized chrome **without** a full page reload when practical; incomplete hot-swap for a surface may fall back to reload for that session. Server-rendered pages read the cookie (else `Accept-Language`, else `en`) per request. Optional `?lang=` override for support/debug only.

## Answer

Write Locale Preference to **`localStorage` + cookie** (same value); set `document.documentElement.lang`; **immediate re-render** (or rebuild) of mounted localized chrome without a full page reload when practical (incomplete hot-swap may reload that session). SSR / non-admin HTML reads the **cookie** (else `Accept-Language`, else `en`) per request. Optional `?lang=` for support/debug only.
