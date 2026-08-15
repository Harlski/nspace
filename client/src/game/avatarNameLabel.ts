/**
 * Pure nameplate label text (username + admin Invisible / Frozen cues).
 * Player Level is drawn as a circle badge by the nameplate renderer, not in this string.
 */

export function formatAvatarNameLabel(args: {
  displayName: string;
  adminInvisible?: boolean;
  frozen?: boolean;
}): string {
  let label = args.displayName.trim() || "Player";
  if (args.adminInvisible) {
    label = `${label} · Invisible`;
  }
  if (args.frozen) {
    label = `${label} · Frozen`;
  }
  return label;
}

/** Normalized Player Level for the nameplate badge, or null when none. */
export function nameplatePlayerLevel(
  playerLevel?: number | null
): number | null {
  if (
    typeof playerLevel !== "number" ||
    !Number.isFinite(playerLevel) ||
    playerLevel < 1
  ) {
    return null;
  }
  return Math.floor(playerLevel);
}
