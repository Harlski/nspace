process.env.WORLDCUP_ENABLED = "1";

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { playerLevelFromPoints } from "../src/playerLevel.js";

async function withAchievementStore(
  fn: (mod: typeof import("../src/achievementStore.js")) => void | Promise<void>
): Promise<void> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nspace-level-ach-"));
  const sqlitePath = path.join(dir, "campaigns.sqlite");
  process.env.CAMPAIGN_STORE_SQLITE_PATH = sqlitePath;
  process.env.LOGIN_STREAK_STORE_FILE = path.join(dir, "login-streaks.json");
  const mod = await import("../src/achievementStore.js");
  mod.initAchievementStore();
  try {
    await fn(mod);
  } finally {
    mod._resetAchievementStoreForTests();
    fs.rmSync(dir, { recursive: true, force: true });
    delete process.env.CAMPAIGN_STORE_SQLITE_PATH;
    delete process.env.LOGIN_STREAK_STORE_FILE;
  }
}

async function seedAp(wallet: string, points: number): Promise<void> {
  const { getCampaignDatabase } = await import("../src/campaignStore.js");
  getCampaignDatabase()
    .prepare(
      `INSERT INTO achievement_completions
        (wallet, achievement_id, completed_at_ms, points_awarded, reward_sku)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      wallet.replace(/\s+/g, "").toUpperCase(),
      `seed-ap-${points}-${Date.now()}`,
      Date.now(),
      points,
      null
    );
}

const WALLET = "NQ07 TEST000000000000000000000000000031";

test("Player Level ladder Completes at Level 5 / 10 / 15; no Level 11 row", async () => {
  await withAchievementStore(async ({
    evaluatePlayerLevelAchievements,
    getAchievementsForWallet,
  }) => {
    const defs = getAchievementsForWallet(WALLET).achievements;
    assert.ok(defs.some((a) => a.achievementId === "meta-on-the-board"));
    assert.ok(defs.some((a) => a.achievementId === "meta-double-digits"));
    assert.ok(defs.some((a) => a.achievementId === "meta-established"));
    assert.equal(
      defs.some(
        (a) =>
          a.achievementId.includes("level-11") ||
          a.title.toLowerCase().includes("level 11")
      ),
      false
    );
    assert.ok(defs.some((a) => a.achievementId === "meta-point-hunter-1"));
    assert.ok(defs.some((a) => a.achievementId === "meta-point-hunter-2"));

    assert.equal(playerLevelFromPoints(400), 5);
    assert.equal(playerLevelFromPoints(900), 10);
    assert.equal(playerLevelFromPoints(1400), 15);
    assert.equal(playerLevelFromPoints(1000), 11);

    await seedAp(WALLET, 400);
    const unlocks: string[] = [];
    evaluatePlayerLevelAchievements(WALLET, (u) => {
      unlocks.push(...u.map((x) => x.achievementId));
    });
    assert.ok(unlocks.includes("meta-on-the-board"));
    assert.equal(
      getAchievementsForWallet(WALLET).achievements.find(
        (a) => a.achievementId === "meta-on-the-board"
      )?.completed,
      true
    );

    await seedAp(WALLET, 500); // total 900 → Level 10
    const unlocks10: string[] = [];
    evaluatePlayerLevelAchievements(WALLET, (u) => {
      unlocks10.push(...u.map((x) => x.achievementId));
    });
    assert.ok(unlocks10.includes("meta-double-digits"));

    await seedAp(WALLET, 500); // total 1400 → Level 15
    const unlocks15: string[] = [];
    evaluatePlayerLevelAchievements(WALLET, (u) => {
      unlocks15.push(...u.map((x) => x.achievementId));
    });
    assert.ok(unlocks15.includes("meta-established"));
  });
});

test("getAchievementsForWallet silently Completes Level ladder catch-up", async () => {
  await withAchievementStore(async ({ getAchievementsForWallet }) => {
    await seedAp(WALLET, 900);
    const payload = getAchievementsForWallet(WALLET);
    assert.ok(playerLevelFromPoints(payload.totalPoints) >= 10);
    assert.equal(
      payload.achievements.find((a) => a.achievementId === "meta-on-the-board")
        ?.completed,
      true
    );
    assert.equal(
      payload.achievements.find((a) => a.achievementId === "meta-double-digits")
        ?.completed,
      true
    );
  });
});

test("Double Digits grants Neon Frame ach-* SKU; achievement_only rejects purchase", async () => {
  await withAchievementStore(async ({
    getAchievementsForWallet,
    evaluatePlayerLevelAchievements,
  }) => {
    const { validateUnlockIntent, hasEntitlement, getCatalogEntry } =
      await import("../src/cosmeticStore.js");

    assert.ok(getCatalogEntry("ach-nameplate-frame-neon"));
    assert.ok(getCatalogEntry("ach-nameplate-frame-simple"));
    assert.ok(getCatalogEntry("ach-bubble-rounded-pastel"));
    assert.ok(getCatalogEntry("ach-bubble-sharp-dark"));

    await seedAp(WALLET, 900);
    evaluatePlayerLevelAchievements(WALLET);
    const after = getAchievementsForWallet(WALLET);
    assert.equal(
      after.achievements.find((a) => a.achievementId === "meta-double-digits")
        ?.rewardSku,
      "ach-nameplate-frame-neon"
    );
    assert.equal(hasEntitlement(WALLET, "ach-nameplate-frame-neon"), true);

    const purchase = validateUnlockIntent(WALLET, "ach-nameplate-frame-neon");
    assert.equal(purchase.ok, false);
    if (!purchase.ok) assert.equal(purchase.error, "achievement_only");
  });
});
