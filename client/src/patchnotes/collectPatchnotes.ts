import { patchnoteMdToHtml, stripPatchnoteAudienceDepth } from "./mdToHtml.js";

export const PATCHNOTE_TIER_ORDER = [
  "00-brief",
  "01-players",
  "02-operators",
  "03-developers",
] as const;

const TIER_LABEL: Record<(typeof PATCHNOTE_TIER_ORDER)[number], string> = {
  "00-brief": "Brief",
  "01-players": "Players",
  "02-operators": "Operators",
  "03-developers": "Developers",
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

function semverParts(v: string): [number, number, number] | null {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Sort highest release first (only `x.y.z` folders). */
export function compareSemverDesc(a: string, b: string): number {
  const pa = semverParts(a);
  const pb = semverParts(b);
  if (pa && pb) {
    for (let i = 0; i < 3; i++) {
      if (pa[i] !== pb[i]) return pb[i]! - pa[i]!;
    }
    return 0;
  }
  return b.localeCompare(a);
}

const GLOB_RE =
  /[/\\]versions[/\\](\d+\.\d+\.\d+)[/\\]public[/\\](\d{2})-([^/\\]+)\.md$/;

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
