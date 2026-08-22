import {
  achievementDescriptionKey,
  achievementTitleKey,
  t,
} from "@nspace/i18n";

/**
 * Resolve an achievement title from the Message Catalog.
 * Falls back to the English wire/API `title` when the key is absent from `en`.
 */
export function localizedAchievementTitle(id: string, fallback: string): string {
  const key = achievementTitleKey(id);
  const translated = t(key);
  return translated === key ? fallback : translated;
}

/**
 * Resolve an achievement description from the Message Catalog.
 * Falls back to the English wire/API `description` when the key is absent from `en`.
 */
export function localizedAchievementDescription(
  id: string,
  fallback: string
): string {
  const key = achievementDescriptionKey(id);
  const translated = t(key);
  return translated === key ? fallback : translated;
}
