/**
 * Pure ranking for the whisper recipient typeahead (the `/w` picker and `/r` fallback).
 *
 * Candidate pool = players in the current room unioned with people you have recently
 * whispered with. Results are grouped "recent partners first, then room-only players",
 * alphabetical within each group, and always resolve by wallet address so a pick is never
 * ambiguous between two players who share a display name.
 */

export type WhisperCandidate = {
  /** Compacted wallet address (no spaces, uppercase) - what we send as `toAddress`. */
  address: string;
  /** Display label shown in the row. */
  name: string;
};

export const WHISPER_PICKER_DEFAULT_LIMIT = 6;

/** Compact a wallet address to the canonical key used for matching/dedup (mirrors the server). */
export function compactWhisperAddress(addr: string): string {
  return String(addr ?? "").replace(/\s+/g, "").toUpperCase();
}

export type RankWhisperCandidatesInput = {
  roomPlayers: readonly WhisperCandidate[];
  /** Most-recent first is not required; intra-group order is alphabetical. */
  recentPartners: readonly WhisperCandidate[];
  /** Excluded from results in either group. */
  selfAddress: string;
  limit?: number;
};

/**
 * Rank recipients for a (possibly empty) prefix query. Empty query returns the seeded list
 * (all candidates). Matching is a case-insensitive prefix on the display name.
 */
export function rankWhisperCandidates(
  rawQuery: string,
  input: RankWhisperCandidatesInput
): WhisperCandidate[] {
  const limit = input.limit ?? WHISPER_PICKER_DEFAULT_LIMIT;
  const self = compactWhisperAddress(input.selfAddress);
  const query = String(rawQuery ?? "").trim().toLowerCase();

  const roomByKey = new Map<string, WhisperCandidate>();
  for (const c of input.roomPlayers) {
    const key = compactWhisperAddress(c.address);
    if (key && !roomByKey.has(key)) roomByKey.set(key, c);
  }
  const recentKeys = new Set(
    input.recentPartners.map((c) => compactWhisperAddress(c.address))
  );

  const matches = (name: string): boolean =>
    query === "" || name.trim().toLowerCase().startsWith(query);

  const seen = new Set<string>();
  const recentGroup: WhisperCandidate[] = [];
  const roomGroup: WhisperCandidate[] = [];

  for (const c of input.recentPartners) {
    const key = compactWhisperAddress(c.address);
    if (!key || key === self || seen.has(key)) continue;
    // Prefer the current room-roster name when this partner is present (freshest label).
    const name = (roomByKey.get(key)?.name ?? "").trim() || c.name.trim();
    if (!matches(name)) continue;
    seen.add(key);
    recentGroup.push({ address: key, name });
  }
  for (const c of input.roomPlayers) {
    const key = compactWhisperAddress(c.address);
    if (!key || key === self || seen.has(key) || recentKeys.has(key)) continue;
    const name = c.name.trim();
    if (!matches(name)) continue;
    seen.add(key);
    roomGroup.push({ address: key, name });
  }

  const byName = (a: WhisperCandidate, b: WhisperCandidate): number =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  recentGroup.sort(byName);
  roomGroup.sort(byName);

  return [...recentGroup, ...roomGroup].slice(0, Math.max(0, limit));
}

/** A chat destination: `null` is the public "Say" channel; otherwise a whisper target. */
export type WhisperDestination = WhisperCandidate | null;

/**
 * Tab-cycle the chat destination around the ring `[Say, ...recentPartners]` (most-recent
 * first). `delta` of +1 moves forward (Say -> first partner -> ... -> wrap to Say), -1 back.
 * If `current` isn't in the ring (e.g. a target you selected but never messaged), it is
 * treated as Say (index 0) so Tab still lands predictably.
 */
export function cycleWhisperDestination(
  current: WhisperDestination,
  recentPartners: readonly WhisperCandidate[],
  delta: number
): WhisperDestination {
  const ring: WhisperDestination[] = [null];
  const seen = new Set<string>();
  for (const c of recentPartners) {
    const key = compactWhisperAddress(c.address);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    ring.push({ address: key, name: c.name });
  }
  if (ring.length <= 1) return null;

  let idx = 0;
  if (current) {
    const key = compactWhisperAddress(current.address);
    const pos = ring.findIndex(
      (d) => d !== null && compactWhisperAddress(d.address) === key
    );
    idx = pos >= 0 ? pos : 0;
  }
  const n = ring.length;
  const next = (((idx + delta) % n) + n) % n;
  return ring[next] ?? null;
}

/**
 * Find a candidate whose display name exactly equals `name` (case-insensitive). Used by the
 * "/w name " fast path, where a trailing space means the typed username is complete - so we
 * resolve it to a known player rather than treating it as a prefix filter.
 */
export function findExactWhisperCandidate(
  name: string,
  candidates: readonly WhisperCandidate[]
): WhisperCandidate | null {
  const wanted = String(name ?? "").trim().toLowerCase();
  if (!wanted) return null;
  return candidates.find((c) => c.name.trim().toLowerCase() === wanted) ?? null;
}
