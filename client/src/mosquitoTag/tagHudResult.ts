import { t } from "@nspace/i18n";

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

/** Caption shown beside the Stung identicon. */
export function tagHudStungCaption(displayName: string): string {
  return t("mosquitoTag.stungCaption", { name: displayName.trim() });
}

