import { afterEach, describe, expect, it } from "vitest";
import {
  LAST_SESSION_ROOM_HINT_MAX_AGE_MS,
  peekLastSessionRoomId,
  rememberLastSessionRoomId,
} from "./lastSessionRoom.js";
import { HUB_ROOM_ID } from "./roomLayouts.js";

describe("lastSessionRoom", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("returns the room remembered within the resume grace window", () => {
    const now = 1_700_000_000_000;
    rememberLastSessionRoomId(HUB_ROOM_ID, now);
    expect(peekLastSessionRoomId(now + 60_000)).toBe(HUB_ROOM_ID);
  });

  it("forgets the hint after the server resume grace window", () => {
    const now = 1_700_000_000_000;
    rememberLastSessionRoomId(HUB_ROOM_ID, now);
    expect(
      peekLastSessionRoomId(now + LAST_SESSION_ROOM_HINT_MAX_AGE_MS + 1)
    ).toBeNull();
  });
});
