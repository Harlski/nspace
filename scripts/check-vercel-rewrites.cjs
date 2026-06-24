#!/usr/bin/env node
/**
 * Guard split-host routing: server HTML routes must appear in both vercel.json files.
 * Run: node scripts/check-vercel-rewrites.cjs
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const rootVercel = JSON.parse(
  fs.readFileSync(path.join(root, "vercel.json"), "utf8")
);
const clientVercel = JSON.parse(
  fs.readFileSync(path.join(root, "client/vercel.json"), "utf8")
);
const serverIndex = fs.readFileSync(
  path.join(root, "server/src/index.ts"),
  "utf8"
);

function rewriteSources(config) {
  return (config.rewrites ?? []).map((r) => r.source).sort();
}

const rootSources = rewriteSources(rootVercel);
const clientSources = rewriteSources(clientVercel);

const missingInClient = rootSources.filter((s) => !clientSources.includes(s));
const missingInRoot = clientSources.filter((s) => !rootSources.includes(s));

if (missingInClient.length || missingInRoot.length) {
  console.error("vercel.json rewrite sources are out of sync:");
  if (missingInClient.length) {
    console.error("  in root but not client/vercel.json:", missingInClient);
  }
  if (missingInRoot.length) {
    console.error("  in client/vercel.json but not root:", missingInRoot);
  }
  process.exit(1);
}

/** Server GET routes that are not JSON APIs and need explicit Vercel rewrites. */
const serverGetPaths = [
  ...serverIndex.matchAll(/app\.get\("(\/[^"?]+)"/g),
]
  .map((m) => m[1])
  .filter(
    (p) =>
      !p.startsWith("/api/") &&
      !p.startsWith("/nim-chart-api/") &&
      !p.includes(":") &&
      p !== "/analytics/admin"
  );

const rewritePatterns = rootSources.map((s) => {
  let pat = s;
  pat = pat.replace(/:path\*/g, "__PATH_SPLAT__");
  pat = pat.replace(/:slug/g, "__SLUG__");
  pat = pat.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  pat = pat.replace(/__PATH_SPLAT__/g, ".*");
  pat = pat.replace(/__SLUG__/g, "[^/]+");
  return { source: s, re: new RegExp("^" + pat + "$") };
});

function isCovered(route) {
  return rewritePatterns.some(({ re }) => re.test(route));
}

const uncovered = [...new Set(serverGetPaths)].filter((p) => !isCovered(p));

if (uncovered.length) {
  console.error(
    "Server HTML/static GET routes missing from vercel.json rewrites:"
  );
  for (const p of uncovered.sort()) console.error("  ", p);
  process.exit(1);
}

if (!rootSources.some((s) => s === "/admin/:path*")) {
  console.error('Expected "/admin/:path*" wildcard rewrite for admin pages.');
  process.exit(1);
}

console.log(
  `check-vercel-rewrites: ${rootSources.length} rewrites in sync; ${serverGetPaths.length} server GET routes covered.`
);
