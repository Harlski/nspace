import assert from "node:assert/strict";
import test from "node:test";
import { prevUtcCalendarDay, utcCalendarDay } from "../src/loginStreakStore.js";

test("utcCalendarDay matches UTC date", () => {
  const d = new Date(Date.UTC(2026, 0, 15, 12, 0, 0));
  assert.equal(utcCalendarDay(d), "2026-01-15");
});

test("prevUtcCalendarDay steps back one UTC day", () => {
  assert.equal(prevUtcCalendarDay("2026-01-15"), "2026-01-14");
  assert.equal(prevUtcCalendarDay("2026-03-01"), "2026-02-28");
});
