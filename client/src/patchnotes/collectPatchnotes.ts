import { patchnoteMdToHtml, stripPatchnoteAudienceDepth } from "./mdToHtml.js";

export const PATCHNOTE_TIER_ORDER = [
  "00-brief",
  "01-players",
  "02-operators",
  "03-developers",
  "04-hotfix",
] as const;

const TIER_LABEL: Record<(typeof PATCHNOTE_TIER_ORDER)[number], string> = {
  "00-brief": "Brief",
  "01-players": "Players",
  "02-operators": "Operators",
  "03-developers": "Developers",
  "04-hotfix": "Hotfix",
};

export const PATCHNOTE_TIER_LABEL = TIER_LABEL;

export type PatchnoteTier = {
  tierId: (typeof PATCHNOTE_TIER_ORDER)[number];
  label: string;
  html: string;
};

export type PatchnoteRelease = {
  version: string;
  tiers: PatchnoteTier[];
};

function semverParts(
  v: string
): { major: number; minor: number; patch: number; suffix: string } | null {
  const m = /^(\d+)\.(\d+)\.(\d+)([a-z]+)?$/i.exec(v);
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    suffix: (m[4] ?? "").toLowerCase(),
  };
}

/**
 * Sort highest release first.
 * Supports frozen folders `x.y.z` and letter appends `x.y.z` + suffix (e.g. `0.6.4a`).
 * Same numeric triple: longer / later suffix sorts first (`0.6.4b` > `0.6.4a` > `0.6.4`).
 */
export function compareSemverDesc(a: string, b: string): number {
  const pa = semverParts(a);
  const pb = semverParts(b);
  if (pa && pb) {
    if (pa.major !== pb.major) return pb.major - pa.major;
    if (pa.minor !== pb.minor) return pb.minor - pa.minor;
    if (pa.patch !== pb.patch) return pb.patch - pa.patch;
    if (pa.suffix === pb.suffix) return 0;
    if (!pa.suffix) return 1; // bare x.y.z older than lettered append
    if (!pb.suffix) return -1;
    return pb.suffix.localeCompare(pa.suffix);
  }
  return b.localeCompare(a);
}

const GLOB_RE =
  /[/\\]versions[/\\](\d+\.\d+\.\d+[a-z]*)[/\\]public[/\\](\d{2})-([^/\\]+)\.md$/i;

function parseGlobPath(path: string): { version: string; tierKey: string } | null {
  const m = GLOB_RE.exec(path.replace(/\\/g, "/"));
  if (!m) return null;
  const version = m[1]!;
  const tierKey = `${m[2]}-${m[3]}`;
  return { version, tierKey };
}

function isTierId(s: string): s is (typeof PATCHNOTE_TIER_ORDER)[number] {
  return (PATCHNOTE_TIER_ORDER as readonly string[]).includes(s);
}

/**
 * Eager-bundles `patchnote/versions/<semver>/public/*.md` at build time.
 * `UNRELEASED` and non-semver folders are omitted so the lobby only lists frozen releases.
 * Letter appends (`0.6.4a`) are included.
 */
export function collectPatchnotesFromGlob(
  modules: Record<string, string>
): PatchnoteRelease[] {
  const byVersion = new Map<string, Map<(typeof PATCHNOTE_TIER_ORDER)[number], string>>();

  for (const [path, raw] of Object.entries(modules)) {
    const parsed = parseGlobPath(path);
    if (!parsed || !isTierId(parsed.tierKey)) continue;
    const text = String(raw ?? "").trim();
    if (!text) continue;
    let m = byVersion.get(parsed.version);
    if (!m) {
      m = new Map();
      byVersion.set(parsed.version, m);
    }
    m.set(parsed.tierKey, text);
  }

  const versions = [...byVersion.keys()].sort(compareSemverDesc);
  const out: PatchnoteRelease[] = [];

  for (const version of versions) {
    const tierMap = byVersion.get(version)!;
    const tiers: PatchnoteTier[] = [];
    for (const tierId of PATCHNOTE_TIER_ORDER) {
      const md = tierMap.get(tierId);
      if (!md) continue;
      const cleaned = stripPatchnoteAudienceDepth(md);
      tiers.push({
        tierId,
        label: TIER_LABEL[tierId],
        html: patchnoteMdToHtml(cleaned),
      });
    }
    if (tiers.length > 0) out.push({ version, tiers });
  }

  return out;
}
