/** Admin Freeze locomotion-lock policy (pure helpers). */

export function mayFreezeTarget(args: {
  actorIsGameAdmin: boolean;
  actorAddress: string;
  targetAddress: string;
  targetIsGameAdmin: boolean;
}): boolean {
  if (!args.actorIsGameAdmin) return false;
  const actor = args.actorAddress.replace(/\s+/g, "").toUpperCase();
  const target = args.targetAddress.replace(/\s+/g, "").toUpperCase();
  if (!actor || !target || actor === target) return false;
  if (args.targetIsGameAdmin) return false;
  return true;
}

export function movementBlockedByFreeze(frozen: boolean): boolean {
  return frozen;
}

/** Frozen tag / state field is ops-only (parallel to Admin Invisibility cue). */
export function frozenCueVisibleToViewer(viewerIsGameAdmin: boolean): boolean {
  return viewerIsGameAdmin;
}
