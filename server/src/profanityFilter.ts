import { Filter } from "bad-words";

/** Extra terms beyond the default library (lowercase). Shared by usernames and chat. */
const CUSTOM_PROFANITY_WORDS = [
  "nimslut",
  "nimporn",
];

const profanityFilter = new Filter();
if (CUSTOM_PROFANITY_WORDS.length > 0) {
  profanityFilter.addWords(...CUSTOM_PROFANITY_WORDS);
}

export type CensorChatResult = {
  censored: string;
  wasFiltered: boolean;
  original?: string;
};

export function isProfane(text: string): boolean {
  return profanityFilter.isProfane(String(text ?? ""));
}

/** True when censored output has no meaningful characters (empty or asterisks only). */
export function isEmptyAfterCensor(censored: string): boolean {
  const trimmed = String(censored ?? "").trim();
  if (!trimmed) return true;
  return trimmed.replace(/\*+/g, "").trim().length === 0;
}

export function censorChat(raw: string): CensorChatResult {
  const input = String(raw ?? "");
  if (!profanityFilter.isProfane(input)) {
    return { censored: input, wasFiltered: false };
  }
  const censored = profanityFilter.clean(input).trim();
  return {
    censored,
    wasFiltered: true,
    original: input,
  };
}
