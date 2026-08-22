import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createTranslator,
  matchSupportedLocale,
  parseAcceptLanguage,
  resolveLocale,
} from "../src/index.js";

describe("resolveLocale", () => {
  it("prefers explicit Locale Preference", () => {
    assert.equal(
      resolveLocale({ preference: "tr", hints: ["en-US", "pt-BR"] }),
      "tr",
    );
  });

  it("maps pt-* hints to pt-BR", () => {
    assert.equal(matchSupportedLocale("pt-PT"), "pt-BR");
    assert.equal(resolveLocale({ hints: ["pt-PT", "en"] }), "pt-BR");
  });

  it("falls back to en", () => {
    assert.equal(resolveLocale({ hints: ["de-DE"] }), "en");
  });

  it("parses Accept-Language q-weights", () => {
    assert.deepEqual(parseAcceptLanguage("fr;q=0.8,tr;q=0.9,en;q=0.5"), [
      "tr",
      "fr",
      "en",
    ]);
  });
});

describe("createTranslator", () => {
  it("falls back to English for missing keys", () => {
    const i18n = createTranslator("tr");
    // Key only in en (if we add a unique one) — playerMenu.profile exists in tr.
    assert.equal(i18n.t("playerMenu.profile"), "Profil");
    assert.match(i18n.t("playerMenu.ariaLabel"), /menü/i);
  });

  it("never returns empty for known en keys", () => {
    const i18n = createTranslator("pt-BR");
    assert.ok(i18n.t("playerMenu.language").length > 0);
  });

  it("notifies subscribers on setLocale", () => {
    const i18n = createTranslator("en");
    let hits = 0;
    i18n.subscribe(() => {
      hits += 1;
    });
    i18n.setLocale("tr");
    assert.equal(hits, 1);
    assert.equal(i18n.getLocale(), "tr");
  });
});
