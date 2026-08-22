import fs from "fs";

const defs = JSON.parse(
  fs.readFileSync(".scratch/localization/achievements-extract.json", "utf8"),
);
const T = JSON.parse(
  fs.readFileSync(".scratch/localization/achievement-drafts.json", "utf8"),
);

const missing = defs.filter((d) => !T[d.id]);
if (missing.length) {
  console.error(
    "Missing translations for:",
    missing.map((d) => d.id),
  );
  process.exit(1);
}

function mergeLocale(path, localeAdds) {
  const existing = JSON.parse(fs.readFileSync(path, "utf8"));
  const ordered = { ...existing };
  let added = 0;
  for (const k of Object.keys(localeAdds).sort()) {
    if (!(k in existing)) added++;
    ordered[k] = localeAdds[k];
  }
  fs.writeFileSync(path, JSON.stringify(ordered, null, 2) + "\n");
  return added;
}

const enAdds = {};
const trAdds = {};
const ptAdds = {};
for (const d of defs) {
  const row = T[d.id];
  enAdds[`achievements.${d.id}.title`] = d.title;
  enAdds[`achievements.${d.id}.description`] = d.description;
  trAdds[`achievements.${d.id}.title`] = row.trTitle;
  trAdds[`achievements.${d.id}.description`] = row.trDesc;
  ptAdds[`achievements.${d.id}.title`] = row.ptTitle;
  ptAdds[`achievements.${d.id}.description`] = row.ptDesc;
}

const nEn = mergeLocale("packages/i18n/src/locales/en.json", enAdds);
const nTr = mergeLocale("packages/i18n/src/locales/tr.json", trAdds);
const nPt = mergeLocale("packages/i18n/src/locales/pt-BR.json", ptAdds);
console.log({
  achievements: defs.length,
  keysPerLocale: defs.length * 2,
  newEn: nEn,
  newTr: nTr,
  newPt: nPt,
  trSize: fs.statSync("packages/i18n/src/locales/tr.json").size,
  ptSize: fs.statSync("packages/i18n/src/locales/pt-BR.json").size,
});
