# 09 — Locale plumbing for vi, es, fil

**What to build:** Players can pick **Tiếng Việt**, **Español**, or **Filipino** in the Player Menu Language chooser. Browser `Accept-Language` hints for `vi`, `es`, and `fil` (and `tl`) resolve correctly. Until catalogs land, strings fall back to English — never raw keys.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] `vi`, `es`, and `fil` are Supported Locales with display names, flag codes (`VN`, `CR`, `PH`), and resolver rules (`es-*` → `es`, `tl-*` → `fil`)
- [ ] `@nspace/i18n` tests cover the new resolver paths
- [ ] Language modal lists all six locales
