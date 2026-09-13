/**
 * Operator catalog: Live Event type maps to one of these interactions.
 * Unavailable kinds can be saved; they do not apply a World Effect yet.
 */

export const LIVE_EVENT_ROOM_TARGETS = ["current", "hub", "other"] as const;
export type LiveEventRoomTarget = (typeof LIVE_EVENT_ROOM_TARGETS)[number];

export type LiveEventInteractionDef = {
  kind: string;
  label: string;
  available: boolean;
  description: string;
};

export const LIVE_EVENT_INTERACTIONS: readonly LiveEventInteractionDef[] = [
  {
    kind: "live_boost",
    label: "Live Boost",
    available: true,
    description:
      "2× gameplay NIM and a gold banner. World-wide today; the room target is stored for room-scoped effects later.",
  },
  {
    kind: "gold_blocks",
    label: "Gold blocks",
    available: false,
    description:
      "Turn some claimable blocks gold for a duration. Not built yet; saving a rule is safe and will no-op until it ships.",
  },
];

const INTERACTION_BY_KIND = new Map(
  LIVE_EVENT_INTERACTIONS.map((row) => [row.kind, row])
);

export function liveEventInteraction(kind: string): LiveEventInteractionDef | null {
  return INTERACTION_BY_KIND.get(kind) ?? null;
}

export function isKnownLiveEventInteraction(kind: string): boolean {
  return INTERACTION_BY_KIND.has(kind);
}

export function isAvailableLiveEventInteraction(kind: string): boolean {
  return INTERACTION_BY_KIND.get(kind)?.available === true;
}

export function isLiveEventRoomTarget(value: string): value is LiveEventRoomTarget {
  return (LIVE_EVENT_ROOM_TARGETS as readonly string[]).includes(value);
}
