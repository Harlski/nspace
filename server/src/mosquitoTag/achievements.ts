import type { AchievementEventKey } from "../achievementDefinitions.js";
import type { TagState } from "./engine.js";

/** Pass with this much Tag Round time left (or less) Completes Saved by the Bell. */
export const SAVED_BY_THE_BELL_REMAINING_MS = 3_000;

export type MosquitoTagAchievementFire = {
  playerId: string;
  event: AchievementEventKey;
};

function participantSet(ids: readonly string[]): Set<string> {
  return new Set(ids);
}

/**
 * Pure Tag-state delta → achievement events.
 * Wallet eligibility and Completing live in the achievement store.
 */
export function evaluateMosquitoTagAchievementEvents(
  prev: TagState,
  next: TagState,
  nowMs: number
): MosquitoTagAchievementFire[] {
  if (prev === next) return [];
  const out: MosquitoTagAchievementFire[] = [];

  if (prev.phase !== "calling" && next.phase === "calling" && next.callerId) {
    out.push({ playerId: next.callerId, event: "tag_call_raised" });
  }

  if (next.phase === "calling") {
    const before = new Set(prev.joinerIds);
    for (const id of next.joinerIds) {
      if (!before.has(id)) {
        out.push({ playerId: id, event: "tag_joined" });
      }
    }
  }

  if (prev.phase === "playing" && next.phase === "playing") {
    const prevHolder = prev.holderId;
    const nextHolder = next.holderId;
    if (
      prevHolder &&
      nextHolder &&
      prevHolder !== nextHolder &&
      participantSet(next.participantIds).has(prevHolder)
    ) {
      out.push({ playerId: prevHolder, event: "mosquito_passed" });
      const remaining = next.roundEndsAtMs - nowMs;
      if (remaining >= 0 && remaining <= SAVED_BY_THE_BELL_REMAINING_MS) {
        out.push({ playerId: prevHolder, event: "mosquito_passed_clutch" });
      }
    }
    if (
      next.holderId &&
      next.holderId === prev.holderId &&
      next.holderBoostUntilMs > prev.holderBoostUntilMs
    ) {
      out.push({ playerId: next.holderId, event: "tag_boost_pad" });
    }
  }

  if (
    prev.phase === "playing" &&
    next.phase === "result" &&
    next.outcome?.type === "stung"
  ) {
    out.push({ playerId: next.outcome.playerId, event: "tag_stung" });
  }

  return out;
}
