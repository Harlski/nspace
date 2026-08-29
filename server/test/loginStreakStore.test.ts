import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

async function withLoginStreakStore(
  fn: (mod: typeof import("../src/loginStreakStore.js")) => void | Promise<void>
): Promise<void> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nspace-login-streak-"));
  const prev = process.env.LOGIN_STREAK_STORE_FILE;
  process.env.LOGIN_STREAK_STORE_FILE = path.join(dir, "login-streaks.json");
  const mod = await import("../src/loginStreakStore.js");
  mod._resetLoginStreakMemoryForTests();
  try {
    await fn(mod);
  } finally {
    mod._resetLoginStreakMemoryForTests();
    fs.rmSync(dir, { recursive: true, force: true });
    if (prev === undefined) delete process.env.LOGIN_STREAK_STORE_FILE;
    else process.env.LOGIN_STREAK_STORE_FILE = prev;
  }
}

test("utcCalendarDay matches UTC date", async () => {
  const { utcCalendarDay } = await import("../src/loginStreakStore.js");
  const d = new Date(Date.UTC(2026, 0, 15, 12, 0, 0));
  assert.equal(utcCalendarDay(d), "2026-01-15");
});

test("prevUtcCalendarDay steps back one UTC day", async () => {
  const { prevUtcCalendarDay } = await import("../src/loginStreakStore.js");
  assert.equal(prevUtcCalendarDay("2026-01-15"), "2026-01-14");
  assert.equal(prevUtcCalendarDay("2026-03-01"), "2026-02-28");
});

test("wallet presence on consecutive UTC days increments the streak", async () => {
  await withLoginStreakStore(async ({ recordLoginStreakForWallet, getLoginStreakDaysForWallet }) => {
    const wallet = "NQTESTCONSECUTIVE00000000000000000001";
    assert.equal(
      recordLoginStreakForWallet(wallet, new Date("2026-08-27T20:22:00Z")).streakDays,
      1
    );
    assert.equal(
      recordLoginStreakForWallet(wallet, new Date("2026-08-28T07:22:00Z")).streakDays,
      2
    );
    assert.equal(
      recordLoginStreakForWallet(wallet, new Date("2026-08-29T08:09:00Z")).streakDays,
      3
    );
    assert.equal(getLoginStreakDaysForWallet(wallet), 3);
  });
});

test("same UTC day does not increment or rewrite the ledger", async () => {
  await withLoginStreakStore(async ({ recordLoginStreakForWallet }) => {
    const wallet = "NQTESTSAMEDAY00000000000000000000002";
    const first = recordLoginStreakForWallet(
      wallet,
      new Date("2026-08-28T07:22:00Z")
    );
    const file = process.env.LOGIN_STREAK_STORE_FILE!;
    const before = fs.readFileSync(file, "utf8");
    const second = recordLoginStreakForWallet(
      wallet,
      new Date("2026-08-28T21:00:00Z")
    );
    assert.equal(first.streakDays, 1);
    assert.equal(second.streakDays, 1);
    assert.equal(fs.readFileSync(file, "utf8"), before);
  });
});

test("a skipped UTC day resets the streak to 1", async () => {
  await withLoginStreakStore(async ({ recordLoginStreakForWallet }) => {
    const wallet = "NQTESTGAPRESET0000000000000000000003";
    assert.equal(
      recordLoginStreakForWallet(wallet, new Date("2026-08-26T12:00:00Z")).streakDays,
      1
    );
    assert.equal(
      recordLoginStreakForWallet(wallet, new Date("2026-08-28T12:00:00Z")).streakDays,
      1
    );
  });
});

test("guest sessions do not enter the login-streak ledger", async () => {
  await withLoginStreakStore(async ({ recordLoginStreakForWallet, getLoginStreakDaysForWallet }) => {
    const out = recordLoginStreakForWallet(
      "guest:abc123",
      new Date("2026-08-29T08:00:00Z")
    );
    assert.equal(out.streakDays, 0);
    assert.equal(getLoginStreakDaysForWallet("guest:abc123"), 0);
    const file = process.env.LOGIN_STREAK_STORE_FILE!;
    assert.equal(fs.existsSync(file), false);
  });
});
