"use strict";

/**
 * Freezes patch notes: renames patchnote/versions/UNRELEASED → patchnote/versions/<next>,
 * bumps root package.json semver, seeds a fresh UNRELEASED tree.
 *
 * Usage: npm run prepare-merge -- [--major|--minor] [--dry-run]
 * Default bump: patch.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PKG = path.join(ROOT, "package.json");
const VERSIONS = path.join(ROOT, "patchnote", "versions");
const UNRELEASED = path.join(VERSIONS, "UNRELEASED");

const REASONS_TEMPLATE = `# Reasons — UNRELEASED (patch-notes version)

**Patch-notes version:** \`UNRELEASED\` (working bucket). Before merging to \`main\`, run \`npm run prepare-merge\` so this folder is frozen under a semver that matches [package.json](../../../package.json) (see [patchnote/README.md](../../README.md)).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

_Add a one-line roll-up here when the buffer gets long._

---

## By area

### Repo / docs

- _(none yet)_

### Client

- _(none in this change set)_

### Server

- _(none in this change set)_

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- _(none in this change set)_
`;

const PUBLIC = {
  "00-brief.md": `# Public patch notes — brief (\`UNRELEASED\`)

**Audience:** widest reach — social posts, in-app one-liner, “what changed at a glance.”  
**Depth:** minimal; no jargon; link to longer tiers if published.

---

_(Draft — not published.)_
`,
  "01-players.md": `# Public patch notes — players (\`UNRELEASED\`)

**Audience:** people who play or explore Nimiq Space — features, fixes, and feel; not implementation detail.  
**Depth:** short bullets or short paragraphs; avoid file paths and internal names unless they help (e.g. a renamed control).

---

_(Draft — not published.)_
`,
  "02-operators.md": `# Public patch notes — operators (\`UNRELEASED\`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

_(Draft — not published.)_

- _Deploy / config deltas vs previous patch-notes version._
`,
  "03-developers.md": `# Public patch notes — developers (\`UNRELEASED\`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

_(Draft — not published.)_
`,
};

function parseArgs(argv) {
  let bump = "patch";
  let dryRun = false;
  for (const a of argv) {
    if (a === "--major") bump = "major";
    else if (a === "--minor") bump = "minor";
    else if (a === "--patch") bump = "patch";
    else if (a === "--dry-run") dryRun = true;
    else if (a === "-h" || a === "--help") {
      console.log(`Usage: node scripts/prepare-merge.cjs [--patch|--minor|--major] [--dry-run]
Default: patch bump from root package.json version.`);
      process.exit(0);
    }
  }
  return { bump, dryRun };
}

function bumpSemver(version, level) {
  const parts = String(version).trim().split(".").map((p) => parseInt(p, 10));
  const major = Number.isFinite(parts[0]) ? parts[0] : 0;
  const minor = Number.isFinite(parts[1]) ? parts[1] : 0;
  const patch = Number.isFinite(parts[2]) ? parts[2] : 0;
  if (level === "major") return `${major + 1}.0.0`;
  if (level === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function rewriteFrozenMarkdown(content, nextVersion) {
  let out = content;
  out = out.replaceAll("patchnote/versions/UNRELEASED/", `patchnote/versions/${nextVersion}/`);
  out = out.replaceAll("versions/UNRELEASED/", `versions/${nextVersion}/`);
  out = out.replace(/^# Reasons — UNRELEASED/m, `# Reasons — ${nextVersion}`);
  out = out.replace(
    /^\*\*Patch-notes version:\*\* `UNRELEASED`.*$/m,
    `**Patch-notes version:** \`${nextVersion}\` (frozen via \`npm run prepare-merge\`).`
  );
  out = out.replace(/\(`UNRELEASED`\)/g, `(\`${nextVersion}\`)`);
  return out;
}

function walkMarkdownFiles(dir, out = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name);
    if (name.isDirectory()) walkMarkdownFiles(p, out);
    else if (name.isFile() && name.name.endsWith(".md")) out.push(p);
  }
  return out;
}

function main() {
  const { bump, dryRun } = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(UNRELEASED)) {
    console.error(`prepare-merge: missing ${path.relative(ROOT, UNRELEASED)}`);
    process.exit(1);
  }

  const pkgRaw = fs.readFileSync(PKG, "utf8");
  const pkg = JSON.parse(pkgRaw);
  const current = pkg.version;
  if (!current || typeof current !== "string") {
    console.error("prepare-merge: root package.json has no string version");
    process.exit(1);
  }

  const nextVersion = bumpSemver(current, bump);
  const dest = path.join(VERSIONS, nextVersion);

  if (fs.existsSync(dest)) {
    console.error(`prepare-merge: target already exists: ${path.relative(ROOT, dest)}`);
    process.exit(1);
  }

  console.log(
    dryRun
      ? `[dry-run] would bump ${current} → ${nextVersion}, rename UNRELEASED → ${nextVersion}, recreate UNRELEASED`
      : `Bumping ${current} → ${nextVersion}, freezing UNRELEASED → ${nextVersion}, seeding fresh UNRELEASED`
  );

  if (dryRun) process.exit(0);

  fs.renameSync(UNRELEASED, dest);

  for (const file of walkMarkdownFiles(dest)) {
    const text = fs.readFileSync(file, "utf8");
    fs.writeFileSync(file, rewriteFrozenMarkdown(text, nextVersion), "utf8");
  }

  pkg.version = nextVersion;
  fs.writeFileSync(PKG, JSON.stringify(pkg, null, 2) + "\n", "utf8");

  // `renameSync` above should leave no `UNRELEASED` path; still remove first so a
  // partial/interrupted run or stray tree cannot merge with freshly written files
  // (e.g. extra `public/*.md` tiers carrying over into the next buffer).
  fs.rmSync(UNRELEASED, { recursive: true, force: true });
  fs.mkdirSync(path.join(UNRELEASED, "public"), { recursive: true });
  fs.writeFileSync(path.join(UNRELEASED, "reasons.md"), REASONS_TEMPLATE, "utf8");
  for (const [name, body] of Object.entries(PUBLIC)) {
    fs.writeFileSync(path.join(UNRELEASED, "public", name), body, "utf8");
  }

  console.log(`Done. Next: review, git add, commit, push (version ${nextVersion} is now in the tree).`);
}

main();
