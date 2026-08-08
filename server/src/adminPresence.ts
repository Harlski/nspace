/** Admin Invisibility presence policy (pure helpers). */

export function canToggleAdminInvisible(isGameAdmin: boolean): boolean {
  return isGameAdmin;
}

export type PresenceViewer = {
  /** Allowlisted game admin (not merely stream cinema). */
  isGameAdmin: boolean;
};

export type PresenceSubject = {
  adminInvisible?: boolean;
};

/**
 * Whether a viewer receives this subject's avatar / movement / join presence.
 * Self is always handled by the caller (welcome.self); this is for peers.
 */
export function playerVisibleToViewer(
  viewer: PresenceViewer,
  subject: PresenceSubject
): boolean {
  if (!subject.adminInvisible) return true;
  return viewer.isGameAdmin;
}

export function playersVisibleToViewer<T extends PresenceSubject>(
  viewer: PresenceViewer,
  players: readonly T[]
): T[] {
  return players.filter((p) => playerVisibleToViewer(viewer, p));
}

/** Invisible senders: chat log yes, speech bubble no. */
export function shouldSuppressChatBubble(adminInvisible: boolean): boolean {
  return adminInvisible;
}

/** While invisible, world mutations are blocked (observation-only). */
export function worldMutationsBlockedByInvisibility(
  adminInvisible: boolean
): boolean {
  return adminInvisible;
}

/**
 * Fan-out when an admin toggles Admin Invisibility in a room.
 * The owning admin is included (`stateDelta`) so their local translucent cue updates.
 */
export function adminInvisibleToggleRecipientAction(args: {
  subjectAddress: string;
  recipientAddress: string;
  recipientIsGameAdmin: boolean;
  enabled: boolean;
}): "stateDelta" | "playerLeft" | "playerJoined" {
  if (
    args.recipientAddress === args.subjectAddress ||
    args.recipientIsGameAdmin
  ) {
    return "stateDelta";
  }
  return args.enabled ? "playerLeft" : "playerJoined";
}
