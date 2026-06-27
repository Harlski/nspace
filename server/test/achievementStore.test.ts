import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

async function withAchievementStore(
  fn: (mod: typeof import("../src/achievementStore.js")) => void | Promise<void>
): Promise<void> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nspace-ach-"));
  const sqlitePath = path.join(dir, "campaigns.sqlite");
  process.env.CAMPAIGN_STORE_SQLITE_PATH = sqlitePath;
  const mod = await import("../src/achievementStore.js");
  mod.initAchievementStore();
  try {
    await fn(mod);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    delete process.env.CAMPAIGN_STORE_SQLITE_PATH;
  }
}

const WALLET = "NQ07 TEST000000000000000000000000000001";

test("counter increments unlock threshold achievements idempotently", async () => {
  await withAchievementStore(async ({
    bumpAchievementCounter,
    getAchievementsForWallet,
    fireAchievementEvent,
  }) => {
    const unlocks: Array<{ achievementId: string }> = [];
    bumpAchievementCounter(WALLET, "blocks_mined", 10, (u) => {
      unlocks.push(...u);
    });
    assert.equal(unlocks.length, 2);
    assert.ok(unlocks.some((u) => u.achievementId === "first-mine"));
    assert.ok(unlocks.some((u) => u.achievementId === "mine-10"));

    const second: Array<{ achievementId: string }> = [];
    bumpAchievementCounter(WALLET, "blocks_mined", 1, (u) => {
      second.push(...u);
    });
    assert.equal(second.length, 0);

    const payload = getAchievementsForWallet(WALLET);
    assert.equal(payload.totalPoints, 35);
    const mine10 = payload.achievements.find((a) => a.achievementId === "mine-10");
    assert.equal(mine10?.completed, true);
    assert.equal(mine10?.progress, 10);

    fireAchievementEvent(WALLET, "open_profile");
    assert.equal(getAchievementsForWallet(WALLET).totalPoints, 40);
  });
});

test("commons placement counter and reward grant", async () => {
  const wallet = "NQ07 TEST000000000000000000000000000002";
  await withAchievementStore(async ({
    recordBlockPlaced,
    getAchievementsForWallet,
  }) => {
    const { listEntitlements } = await import("../src/cosmeticStore.js");
    recordBlockPlaced(wallet, "hub");
    const payload = getAchievementsForWallet(wallet);
    const firstCommons = payload.achievements.find(
      (a) => a.achievementId === "commons-first-block"
    );
    assert.equal(firstCommons?.completed, true);
    assert.equal(firstCommons?.rewardPresetId, "trail-sparkle");
    const owned = listEntitlements(wallet);
    assert.ok(
      owned.some(
        (e) => e.cosmeticSku === "ach-trail-commons-starter" && e.source === "achievement"
      )
    );
  });
});

test("public summary exposes points and recent highlights", async () => {
  const wallet = "NQ07 TEST000000000000000000000000000003";
  await withAchievementStore(async ({
    fireAchievementEvent,
    getPublicAchievementSummary,
  }) => {
    fireAchievementEvent(wallet, "open_profile");
    fireAchievementEvent(wallet, "open_wardrobe");
    const summary = getPublicAchievementSummary(wallet);
    assert.equal(summary.totalPoints, 10);
    assert.equal(summary.recentHighlights.length, 2);
    const titles = summary.recentHighlights.map((h) => h.title).sort();
    assert.deepEqual(titles, ["Dress the Part", "Know Thyself"]);
  });
});

test("guest wallets are ignored", async () => {
  await withAchievementStore(async ({
    fireAchievementEvent,
    getAchievementsForWallet,
  }) => {
    fireAchievementEvent("guest:abc", "open_profile");
    assert.equal(getAchievementsForWallet("guest:abc").totalPoints, 0);
  });
});
