/**
 * Display names for server-driven NPCs (`FAKE_PLAYER_COUNT`).
 * Public figures / historical names only — not live users.
 * Shown in-game as `formatNpcDisplayName(name)` — e.g. `[NPC] Marie Curie`.
 */
/** Prefix for fake wanderer display names (human-readable, not wallet addresses). */
export const NPC_DISPLAY_PREFIX = "[NPC] ";

export function formatNpcDisplayName(base: string): string {
  return `${NPC_DISPLAY_PREFIX}${base}`;
}

/** Strip prefix for deduping with `pickGuestDisplayName` when reusing existing fakes. */
export function npcDisplayNameBase(full: string): string {
  return full.startsWith(NPC_DISPLAY_PREFIX)
    ? full.slice(NPC_DISPLAY_PREFIX.length)
    : full;
}
/** Adjective+noun pairs for Direct Invite guest nicknames (not NPC-prefixed). */
export const DIRECT_INVITE_GUEST_NAMES: readonly string[] = [
  "Swift Fox",
  "Bold Panda",
  "Calm Otter",
  "Keen Hawk",
  "Lucky Star",
  "Neon Comet",
  "Pixel Knight",
  "Cosmic Owl",
  "Turbo Turtle",
  "Mighty Finch",
  "Silent Wolf",
  "Happy Cloud",
  "Golden Sparrow",
  "Brave Maple",
  "Clever Lynx",
];

export const GUEST_DISPLAY_NAMES: readonly string[] = [
  "LearningNim",
  "ExploringSpace",
  "BuildingBlocks",
  "ExploringMaze",
  "BuildingPortals",
  "SpaceWanderer",
  "WatchingChat",
  "IdleVisitor",
  "JustBrowsing",
  "HangingOut",
];

export function pickDirectInviteGuestName(rng: () => number): string {
  const n = DIRECT_INVITE_GUEST_NAMES.length;
  if (n === 0) return "Guest";
  return DIRECT_INVITE_GUEST_NAMES[Math.floor(rng() * n)]!;
}

export function pickGuestDisplayName(
  rng: () => number,
  alreadyUsed: ReadonlySet<string>
): string {
  const n = GUEST_DISPLAY_NAMES.length;
  if (n === 0) return "Guest";

  for (let attempt = 0; attempt < n * 3; attempt++) {
    const i = Math.floor(rng() * n);
    const name = GUEST_DISPLAY_NAMES[i]!;
    if (!alreadyUsed.has(name)) return name;
  }

  const base = GUEST_DISPLAY_NAMES[Math.floor(rng() * n)]!;
  return `${base} ·${Math.floor(rng() * 900 + 100)}`;
}
