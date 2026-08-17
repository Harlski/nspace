/**
 * Emote Wheel reaction glyphs. Mosquito is native system text when the font has
 * the glyph, and Twemoji when it does not.
 */
import { MOSQUITO_EMOJI } from "./flags.js";

export { MOSQUITO_EMOJI };

export const ACTION_WHEEL_EMOTES = [
  "👍",
  "❤️",
  "😂",
  "🎉",
  "😮",
  "😢",
  "🔥",
  "👏",
  "🙌",
  "🤔",
  "😎",
  "🙏",
  "🤓",
  "😍",
  "😭",
  "💀",
  "👀",
  "💯",
  "✨",
  "💪",
  MOSQUITO_EMOJI,
] as const;
