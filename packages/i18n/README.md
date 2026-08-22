# `@nspace/i18n`

Shared Message Catalogs and ICU `t(key, values)` for the Nimiq Space client and server.

- **Stack:** `@formatjs/intl`
- **Locales:** `en` (source of truth), `tr`, `pt-BR`
- **Fallback:** missing alternate-locale strings use English
- **Locale Preference key:** `nspace_locale` (localStorage + cookie)

```ts
import { t, createTranslator, resolveLocale } from "@nspace/i18n";

t("playerMenu.language");
```

See [docs/localization.md](../../docs/localization.md) and [.scratch/localization/spec.md](../../.scratch/localization/spec.md).
