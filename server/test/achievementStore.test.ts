process.env.WORLDCUP_ENABLED = "1";

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

test("commons placement counter completes without cosmetic grant before v2 catalog", async () => {
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
    assert.equal(firstCommons?.rewardPresetId, null);
    assert.equal(listEntitlements(wallet).length, 0);
  });
});

test("ensureAchievementRewardEntitlements is a no-op without reward catalog entries", async () => {
  const wallet = "NQ07TEST000000000000000000000000000004";
  await withAchievementStore(async ({
    ensureAchievementRewardEntitlements,
    getAchievementsForWallet,
  }) => {
    const { getCampaignDatabase } = await import("../src/campaignStore.js");
    const { listEntitlements } = await import("../src/cosmeticStore.js");
    const db = getCampaignDatabase();
    const now = Date.now();
    db.prepare(
      `INSERT INTO achievement_completions
        (wallet, achievement_id, completed_at_ms, points_awarded, reward_sku)
       VALUES (?, ?, ?, ?, ?)`
    ).run(wallet, "commons-first-block", now, 15, "ach-trail-commons-starter");

    ensureAchievementRewardEntitlements(wallet);

    assert.equal(listEntitlements(wallet).length, 0);
    assert.equal(
      getAchievementsForWallet(wallet).achievements.find(
        (a) => a.achievementId === "commons-first-block"
      )?.completed,
      true
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

test("match win streak increments on win and resets on loss or draw", async () => {
  const opponent = "NQ07 TEST000000000000000000000000000010";
  await withAchievementStore(async ({
    recordMatchEnd,
    setMatchWinStreak,
    getAchievementsForWallet,
  }) => {
    const streakProgress = () =>
      getAchievementsForWallet(WALLET).achievements.find(
        (a) => a.achievementId === "match-streak-3"
      )?.progress ?? 0;

    recordMatchEnd(
      {
        wallet: WALLET,
        result: "win",
        winReason: "score",
        goalsScored: 1,
        priorWinStreak: 0,
      },
      {
        wallet: opponent,
        result: "loss",
        winReason: "score",
        goalsScored: 0,
        priorWinStreak: 0,
      }
    );
    assert.equal(streakProgress(), 1);

    setMatchWinStreak(WALLET, true);
    setMatchWinStreak(WALLET, true);
    assert.equal(streakProgress(), 3);

    const unlocks: Array<{ achievementId: string }> = [];
    recordMatchEnd(
      {
        wallet: WALLET,
        result: "draw",
        goalsScored: 0,
        priorWinStreak: 3,
      },
      {
        wallet: opponent,
        result: "draw",
        goalsScored: 0,
        priorWinStreak: 0,
      },
      (u) => unlocks.push(...u)
    );
    assert.equal(streakProgress(), 0);
    assert.ok(unlocks.some((u) => u.achievementId === "match-first-draw"));

    setMatchWinStreak(WALLET, false);
    assert.equal(streakProgress(), 0);
  });
});

test("chat message counter unlocks chatterbox tiers", async () => {
  const wallet = "NQ07 TEST000000000000000000000000000011";
  await withAchievementStore(async ({
    recordChatMessageSent,
    getAchievementsForWallet,
  }) => {
    const unlocks: Array<{ achievementId: string }> = [];
    for (let i = 0; i < 100; i++) {
      recordChatMessageSent(wallet, (u) => unlocks.push(...u));
    }
    assert.ok(unlocks.some((u) => u.achievementId === "social-chatter-100"));
    const row = getAchievementsForWallet(wallet).achievements.find(
      (a) => a.achievementId === "social-chatter-100"
    );
    assert.equal(row?.completed, true);
    assert.equal(row?.progress, 100);
  });
});

test("feedback submitted event unlocks voice heard once", async () => {
  const wallet = "NQ07 TEST000000000000000000000000000013";
  await withAchievementStore(async ({
    fireAchievementEvent,
    getAchievementsForWallet,
  }) => {
    const unlocks: Array<{ achievementId: string }> = [];
    fireAchievementEvent(wallet, "feedback_submitted", (u) => unlocks.push(...u));
    assert.ok(unlocks.some((u) => u.achievementId === "social-feedback-first"));
    const row = getAchievementsForWallet(wallet).achievements.find(
      (a) => a.achievementId === "social-feedback-first"
    );
    assert.equal(row?.completed, true);
    assert.equal(row?.category, "social");
    assert.equal(row?.categoryGroup, null);

    const again: Array<{ achievementId: string }> = [];
    fireAchievementEvent(wallet, "feedback_submitted", (u) => again.push(...u));
    assert.equal(again.length, 0);
  });
});

test("football achievements expose minigames category group", async () => {
  const wallet = "NQ07 TEST000000000000000000000000000014";
  await withAchievementStore(async ({ getAchievementsForWallet }) => {
    const match = getAchievementsForWallet(wallet).achievements.find(
      (a) => a.achievementId === "match-first-win"
    );
    assert.equal(match?.category, "football_match");
    assert.equal(match?.categoryGroup, "minigames");
  });
});

test("login streak top tier respects ACHIEVEMENT_LOGIN_STREAK_TOP", async () => {
  process.env.ACHIEVEMENT_LOGIN_STREAK_TOP = "12";
  const wallet = "NQ07 TEST000000000000000000000000000012";
  await withAchievementStore(async ({
    evaluateLoginStreakAchievements,
    getAchievementsForWallet,
  }) => {
    evaluateLoginStreakAchievements(wallet, 11);
    assert.equal(
      getAchievementsForWallet(wallet).achievements.find(
        (a) => a.achievementId === "social-login-top"
      )?.completed,
      false
    );

    const unlocks: Array<{ achievementId: string }> = [];
    evaluateLoginStreakAchievements(wallet, 12, (u) => unlocks.push(...u));
    assert.ok(unlocks.some((u) => u.achievementId === "social-login-top"));
  });
  delete process.env.ACHIEVEMENT_LOGIN_STREAK_TOP;
});

test("world cup gating skips progress but preserves completions", async () => {
  const prevWorldCup = process.env.WORLDCUP_ENABLED;
  process.env.WORLDCUP_ENABLED = "0";
  const wallet = "NQ07TEST000000000000000000000000000099";
  try {
    await withAchievementStore(async ({
      recordMatchEnd,
      getAchievementsForWallet,
    }) => {
      const { getCampaignDatabase } = await import("../src/campaignStore.js");
      const db = getCampaignDatabase();
      const now = Date.now();
      db.prepare(
        `INSERT INTO achievement_completions
          (wallet, achievement_id, completed_at_ms, points_awarded, reward_sku)
         VALUES (?, ?, ?, ?, ?)`
      ).run(wallet, "match-first-win", now, 15, null);

      recordMatchEnd(
        {
          wallet,
          result: "win",
          winReason: "score",
          goalsScored: 3,
          priorWinStreak: 0,
        },
        {
          wallet: "NQ07TEST000000000000000000000000000098",
          result: "loss",
          winReason: "score",
          goalsScored: 0,
          priorWinStreak: 0,
        }
      );

      const after = getAchievementsForWallet(wallet);
      assert.equal(after.totalPoints, 15);
      assert.equal(
        after.achievements.find((a) => a.achievementId === "match-first-win")
          ?.completed,
        true
      );
      assert.equal(
        after.achievements.find((a) => a.achievementId === "match-goals-hattrick")
          ?.completed,
        false
      );
    });
  } finally {
    if (prevWorldCup === undefined) delete process.env.WORLDCUP_ENABLED;
    else process.env.WORLDCUP_ENABLED = prevWorldCup;
  }
});

async function completeAllOnboardingPrerequisites(
  wallet: string,
  mod: Pick<
    typeof import("../src/achievementStore.js"),
    "fireAchievementEvent" | "bumpAchievementCounter"
  >
): Promise<Array<{ achievementId: string }>> {
  const unlocks: Array<{ achievementId: string }> = [];
  const onUnlock = (u: Array<{ achievementId: string }>) => {
    unlocks.push(...u);
  };
  mod.fireAchievementEvent(wallet, "enter_commons", onUnlock);
  mod.fireAchievementEvent(wallet, "open_profile", onUnlock);
  mod.fireAchievementEvent(wallet, "open_wardrobe", onUnlock);
  mod.fireAchievementEvent(wallet, "equip_cosmetic", onUnlock);
  mod.bumpAchievementCounter(wallet, "blocks_placed", 1, onUnlock);
  mod.bumpAchievementCounter(wallet, "blocks_mined", 1, onUnlock);
  mod.fireAchievementEvent(wallet, "send_emote", onUnlock);
  mod.fireAchievementEvent(wallet, "visit_room", onUnlock);
  mod.fireAchievementEvent(wallet, "create_room", onUnlock);
  return unlocks;
}

test("completing all getting started achievements unlocks telescope", async () => {
  await withAchievementStore(async (mod) => {
    const { getAchievementsForWallet, isTelescopeUnlockedForWallet } = mod;
    const unlocks = await completeAllOnboardingPrerequisites(WALLET, mod);
    assert.ok(unlocks.some((u) => u.achievementId === "telescope"));

    const payload = getAchievementsForWallet(WALLET);
    const telescope = payload.achievements.find(
      (a) => a.achievementId === "telescope"
    );
    assert.equal(telescope?.completed, true);
    assert.equal(telescope?.progress, telescope?.threshold);
    assert.equal(payload.telescopeUnlocked, true);
    assert.equal(isTelescopeUnlockedForWallet(WALLET), true);
  });
});

test("telescope stays locked until every getting started achievement is done", async () => {
  const wallet = "NQ07 TEST000000000000000000000000000099";
  await withAchievementStore(async (mod) => {
    const { fireAchievementEvent, getAchievementsForWallet } = mod;
    fireAchievementEvent(wallet, "enter_commons");
    fireAchievementEvent(wallet, "open_profile");
    const payload = getAchievementsForWallet(wallet);
    const telescope = payload.achievements.find(
      (a) => a.achievementId === "telescope"
    );
    assert.equal(telescope?.completed, false);
    assert.equal(payload.telescopeUnlocked, false);
    assert.ok((telescope?.progress ?? 0) < (telescope?.threshold ?? 1));
  });
});
