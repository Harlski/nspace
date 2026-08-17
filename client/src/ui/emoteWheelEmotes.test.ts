import { describe, expect, it } from "vitest";
import { ACTION_WHEEL_EMOTES, MOSQUITO_EMOJI } from "./emoteWheelEmotes.js";

describe("ACTION_WHEEL_EMOTES", () => {
  it("includes mosquito as a selectable Emote Wheel reaction", () => {
    expect(ACTION_WHEEL_EMOTES).toContain(MOSQUITO_EMOJI);
  });
});
