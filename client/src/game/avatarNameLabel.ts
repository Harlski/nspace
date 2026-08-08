/**
 * Pure nameplate label text (username + Player Level + admin Invisible cue).
 */

export function formatAvatarNameLabel(args: {
  displayName: string;
  /** Omit for guests. */
  playerLevel?: number | null;
  adminInvisible?: boolean;
}): string {
  const name = args.displayName.trim() || "Player";
  const level =
    typeof args.playerLevel === "number" &&
    Number.isFinite(args.playerLevel) &&
    args.playerLevel >= 1
      ? Math.floor(args.playerLevel)
      : null;
  let label = level !== null ? `${name} · Lv ${level}` : name;
  if (args.adminInvisible) {
    label = `${label} · Invisible`;
  }
  return label;
}
