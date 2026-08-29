export type TagHudResultView =
  | { kind: "stung_identicon"; playerId: string }
  | { kind: "last_remaining" }
  | { kind: "empty" };

/** Result overlay: identicon of the Stung player, not a Stung label for everyone. */
export function tagHudResultView(
  outcome: { type: string; playerId?: string } | null | undefined
): TagHudResultView {
  if (outcome?.type === "stung" && outcome.playerId) {
    return { kind: "stung_identicon", playerId: outcome.playerId };
  }
  if (outcome?.type === "last_remaining") {
    return { kind: "last_remaining" };
  }
  return { kind: "empty" };
}
