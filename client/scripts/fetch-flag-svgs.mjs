/**
 * Download Twemoji country-flag SVGs for every ISO alpha-2 code in `countries.ts` into
 * `client/public/flags/<cc>.svg` (served at `/flags/<cc>.svg`).
 *
 * Why: Windows ships no country-flag glyphs, so Chromium/Brave render flag emoji as the two
 * regional-indicator letters (e.g. "AT"). We render flags as Twemoji images instead. Self-host
 * the assets so there is no runtime CDN dependency and `drawImage` stays same-origin (untainted
 * canvas for the 3D crowd textures). Twemoji SVGs carry a viewBox but no width/height, which
 * Chromium needs for `drawImage`, so we inject them on save.
 *
 * Re-run after editing the country list:  node client/scripts/fetch-flag-svgs.mjs
 */
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const countriesPath = resolve(__dirname, "../src/worldcup/countries.ts");
const outDir = resolve(__dirname, "../public/flags");
const TWEMOJI_BASE =
  "https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg";

/** Twemoji flag filename: the two regional-indicator code points, lowercase hex, hyphenated. */
function twemojiFile(cc) {
  const A = 0x1f1e6;
  const a = (A + (cc.charCodeAt(0) - 65)).toString(16);
  const b = (A + (cc.charCodeAt(1) - 65)).toString(16);
  return `${a}-${b}.svg`;
}

function ensureSvgSize(svg) {
  if (/<svg[^>]*\bwidth=/.test(svg)) return svg;
  return svg.replace(/<svg\b/, '<svg width="36" height="36"');
}

const src = readFileSync(countriesPath, "utf8");
const codes = [...src.matchAll(/code:\s*"([A-Z]{2})"/g)].map((m) => m[1]);
const unique = [...new Set(codes)];
if (unique.length === 0) {
  console.error("No country codes found in", countriesPath);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

let ok = 0;
let skipped = 0;
const failures = [];

async function fetchOne(cc) {
  const dest = resolve(outDir, `${cc.toLowerCase()}.svg`);
  if (existsSync(dest)) {
    skipped += 1;
    return;
  }
  const url = `${TWEMOJI_BASE}/${twemojiFile(cc)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const svg = ensureSvgSize(await res.text());
    if (!svg.includes("<svg")) throw new Error("not an SVG");
    writeFileSync(dest, svg, "utf8");
    ok += 1;
  } catch (err) {
    failures.push(`${cc}: ${err.message}`);
  }
}

// Modest concurrency so we don't hammer the CDN.
const LIMIT = 12;
for (let i = 0; i < unique.length; i += LIMIT) {
  await Promise.all(unique.slice(i, i + LIMIT).map(fetchOne));
}

console.log(
  `flags: ${ok} downloaded, ${skipped} already present, ${failures.length} failed of ${unique.length}`
);
if (failures.length) {
  console.error("Failed:\n" + failures.join("\n"));
  process.exit(1);
}
