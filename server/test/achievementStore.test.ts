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

function seedLoginStreak(wallet: string, streakDays: number): void {
  const file = process.env.LOGIN_STREAK_STORE_FILE;
  if (!file) throw new Error("LOGIN_STREAK_STORE_FILE not set");
  const normalized = wallet.replace(/\s+/g, "").toUpperCase();
  fs.writeFileSync(
    file,
    JSON.stringify({
      streaks: {
        [normalized]: {
          streakDays,
          lastLoginDayUtc: "2026-06-30",
          updatedAt: Date.now(),
        },
      },
    })
  );
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
      ( _wallet, u) => unlocks.push(...u)
    );
    assert.equal(streakProgress(), 0);
    assert.ok(unlocks.some((u) => u.achievementId === "match-first-draw"));

    setMatchWinStreak(WALLET, false);
    assert.equal(streakProgress(), 0);
  });
});

test("first chat message unlocks hello world", async () => {
  const wallet = "NQ07 TEST000000000000000000000000000018";
  await withAchievementStore(async ({
    recordChatMessageSent,
    getAchievementsForWallet,
  }) => {
    const unlocks: Array<{ achievementId: string }> = [];
    recordChatMessageSent(wallet, (u) => unlocks.push(...u));
    assert.ok(unlocks.some((u) => u.achievementId === "social-chatter-first"));
    const row = getAchievementsForWallet(wallet).achievements.find(
      (a) => a.achievementId === "social-chatter-first"
    );
    assert.equal(row?.completed, true);
    assert.equal(row?.title, "Hello World");
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
    seedLoginStreak(wallet, 11);
    evaluateLoginStreakAchievements(wallet);
    const at11 = getAchievementsForWallet(wallet).achievements.find(
      (a) => a.achievementId === "social-login-top"
    );
    assert.equal(at11?.completed, false);
    assert.equal(at11?.progress, 11);
    assert.equal(at11?.threshold, 12);
    assert.match(at11?.description ?? "", /12 consecutive UTC calendar days/);

    const unlocks: Array<{ achievementId: string }> = [];
    seedLoginStreak(wallet, 12);
    evaluateLoginStreakAchievements(wallet, (u) => unlocks.push(...u));
    assert.ok(unlocks.some((u) => u.achievementId === "social-login-top"));
  });
  delete process.env.ACHIEVEMENT_LOGIN_STREAK_TOP;
});

test("login streak achievements show live streak progress on all tiers", async () => {
  const wallet = "NQ07 TEST000000000000000000000000000013";
  await withAchievementStore(async ({ getAchievementsForWallet }) => {
    seedLoginStreak(wallet, 3);
    const rows = getAchievementsForWallet(wallet).achievements;
    const week = rows.find((a) => a.achievementId === "social-login-7");
    const month = rows.find((a) => a.achievementId === "social-login-30");
    const top = rows.find((a) => a.achievementId === "social-login-top");
    assert.equal(week?.progress, 3);
    assert.equal(week?.threshold, 7);
    assert.equal(month?.progress, 3);
    assert.equal(month?.threshold, 30);
    assert.equal(top?.progress, 3);
    assert.equal(top?.threshold, 60);
  });
});

test("earned login streak achievements stay complete when streak drops", async () => {
  const wallet = "NQ07 TEST000000000000000000000000000015";
  await withAchievementStore(async ({
    evaluateLoginStreakAchievements,
    getAchievementsForWallet,
  }) => {
    seedLoginStreak(wallet, 7);
    evaluateLoginStreakAchievements(wallet);
    seedLoginStreak(wallet, 2);
    const rows = getAchievementsForWallet(wallet).achievements;
    const week = rows.find((a) => a.achievementId === "social-login-7");
    const month = rows.find((a) => a.achievementId === "social-login-30");
    assert.equal(week?.completed, true);
    assert.equal(month?.progress, 2);
    assert.equal(month?.threshold, 30);
  });
});

test("getAchievementsForWallet silently completes missed login streak tiers", async () => {
  const wallet = "NQ07 TEST000000000000000000000000000016";
  await withAchievementStore(async ({ getAchievementsForWallet }) => {
    seedLoginStreak(wallet, 7);
    const week = getAchievementsForWallet(wallet).achievements.find(
      (a) => a.achievementId === "social-login-7"
    );
    assert.equal(week?.completed, true);
  });
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

test("pixel paint counter unlocks pixel room tiers", async () => {
  const wallet = "NQ07 TEST000000000000000000000000000015";
  await withAchievementStore(async ({
    recordPixelPainted,
    getAchievementsForWallet,
  }) => {
    recordPixelPainted(wallet, 1);
    const afterFirst = getAchievementsForWallet(wallet).achievements.find(
      (a) => a.achievementId === "pixel-we-made-this"
    );
    assert.equal(afterFirst?.completed, true);

    recordPixelPainted(wallet, 63);
    const after64 = getAchievementsForWallet(wallet).achievements.find(
      (a) => a.achievementId === "pixel-64bit"
    );
    assert.equal(after64?.completed, true);
    assert.equal(after64?.progress, 64);
  });
});

test("sunny side up respects ACHIEVEMENT_SUNNY_BUILD_COUNT", async () => {
  process.env.ACHIEVEMENT_SUNNY_BUILD_COUNT = "5000";
  const wallet = "NQ07 TEST000000000000000000000000000016";
  await withAchievementStore(async ({
    bumpAchievementCounter,
    getAchievementsForWallet,
  }) => {
    const row = () =>
      getAchievementsForWallet(wallet).achievements.find(
        (a) => a.achievementId === "build-sunny-side-up"
      );
    bumpAchievementCounter(wallet, "blocks_placed", 4999);
    assert.equal(row()?.completed, false);
    assert.equal(row()?.threshold, 5000);
    bumpAchievementCounter(wallet, "blocks_placed", 1);
    assert.equal(row()?.completed, true);
  });
});

test("field goal scored records contested and solo events", async () => {
  const wallet = "NQ07 TEST000000000000000000000000000017";
  await withAchievementStore(async ({
    recordFieldGoalScored,
    getAchievementsForWallet,
  }) => {
    recordFieldGoalScored(wallet, { solo: true });
    const solo = getAchievementsForWallet(wallet).achievements.find(
      (a) => a.achievementId === "field-solo"
    );
    assert.equal(solo?.completed, true);

    recordFieldGoalScored(wallet, { contested: true });
    const contested = getAchievementsForWallet(wallet).achievements.find(
      (a) => a.achievementId === "field-contested"
    );
    assert.equal(contested?.completed, true);
    const goals = getAchievementsForWallet(wallet).achievements.find(
      (a) => a.achievementId === "field-goals-10"
    );
    assert.equal(goals?.progress, 2);
  });
});

test("match streak five is titled Unstoppaball", async () => {
  await withAchievementStore(async ({ getAchievementsForWallet }) => {
    const row = getAchievementsForWallet(WALLET).achievements.find(
      (a) => a.achievementId === "match-streak-5"
    );
    assert.equal(row?.title, "Unstoppaball");
    assert.match(row?.description ?? "", /1v1/);
  });
});

test("achievement_seen and achievement_daily_state tables exist on init", async () => {
  await withAchievementStore(async ({
    initAchievementStore,
    recordAchievementSeen,
    setAchievementDailyState,
    getAchievementDailyState,
  }) => {
    initAchievementStore();
    assert.equal(recordAchievementSeen(WALLET, "tile:hub:0,0"), true);
    assert.equal(recordAchievementSeen(WALLET, "tile:hub:0,0"), false);
    setAchievementDailyState(WALLET, "2026-07-01", "grand_tour", "hub");
    assert.equal(
      getAchievementDailyState(WALLET, "2026-07-01", "grand_tour"),
      "hub"
    );
  });
});

test("recordDistinctTileWalked dedupes tiles and rejects ineligible rooms", async () => {
  await withAchievementStore(async ({
    recordDistinctTileWalked,
    countAchievementSeenWithPrefix,
    getAchievementsForWallet,
  }) => {
    const inserted = recordDistinctTileWalked(WALLET, "hub", [
      { x: 1, z: 2 },
      { x: 1, z: 2 },
      { x: 3, z: 4 },
    ]);
    assert.equal(inserted, 2);
    assert.equal(
      recordDistinctTileWalked(WALLET, "hub", [{ x: 1, z: 2 }]),
      0
    );
    assert.equal(countAchievementSeenWithPrefix(WALLET, "tile:"), 2);

    assert.equal(
      recordDistinctTileWalked(WALLET, "field", [{ x: 0, z: 0 }]),
      0
    );
    assert.equal(
      recordDistinctTileWalked(WALLET, "cosmetic-gallery", [{ x: 0, z: 0 }]),
      0
    );
    assert.equal(
      recordDistinctTileWalked(WALLET, "canvas", [{ x: 0, z: 0 }]),
      0
    );

    const marathon = getAchievementsForWallet(WALLET).achievements.find(
      (a) => a.achievementId === "exploration-marathon-1"
    );
    assert.equal(marathon?.progress, 2);
    assert.equal(marathon?.threshold, 1000);
    assert.equal(marathon?.completed, false);
  });
});

test("Marathon I unlocks at 1000 distinct tiles", async () => {
  await withAchievementStore(async ({
    recordDistinctTileWalked,
    getAchievementsForWallet,
  }) => {
    const unlocks: Array<{ achievementId: string }> = [];
    for (let i = 0; i < 1000; i += 1) {
      recordDistinctTileWalked(
        WALLET,
        "hub",
        [{ x: i, z: 0 }],
        (u) => {
          unlocks.push(...u);
        }
      );
    }
    assert.ok(unlocks.some((u) => u.achievementId === "exploration-marathon-1"));
    const marathon = getAchievementsForWallet(WALLET).achievements.find(
      (a) => a.achievementId === "exploration-marathon-1"
    );
    assert.equal(marathon?.completed, true);
    assert.equal(marathon?.progress, 1000);
    assert.equal(marathon?.threshold, 1000);
  });
});

test("Room Tourist dedupes Play Space slugs and counts unique rooms", async () => {
  await withAchievementStore(async ({
    recordExplorationRoomEntry,
    getAchievementsForWallet,
  }) => {
    const rooms = [
      "chamber",
      "hub",
      "pixel",
      "field",
      "invite-lobby-ABC123",
      "invite-lobby-abc123",
    ];
    for (const room of rooms) {
      recordExplorationRoomEntry(WALLET, room);
    }
    const tourist = getAchievementsForWallet(WALLET).achievements.find(
      (a) => a.achievementId === "exploration-room-tourist-1"
    );
    assert.equal(tourist?.progress, 5);
    assert.equal(tourist?.threshold, 5);
    assert.equal(tourist?.completed, true);
  });
});

test("Grand Tour completes within one UTC day without revoking on rollover", async () => {
  await withAchievementStore(async ({
    recordExplorationRoomEntry,
    getAchievementsForWallet,
    tickExplorationDailyRollover,
  }) => {
    const utcDay = "2026-07-01";
    const stops = ["chamber", "hub", "pixel", "field", "cosmetic-gallery"];
    const unlocks: Array<{ achievementId: string }> = [];
    for (const room of stops) {
      recordExplorationRoomEntry(
        WALLET,
        room,
        (u) => {
          unlocks.push(...u);
        },
        utcDay
      );
    }
    assert.ok(unlocks.some((u) => u.achievementId === "exploration-grand-tour"));
    const grand = getAchievementsForWallet(WALLET).achievements.find(
      (a) => a.achievementId === "exploration-grand-tour"
    );
    assert.equal(grand?.completed, true);

    tickExplorationDailyRollover(
      Date.UTC(2026, 6, 2, 0, 0, 1),
      () => [{ wallet: WALLET, roomId: "chamber" }]
    );
    const afterRollover = getAchievementsForWallet(WALLET).achievements.find(
      (a) => a.achievementId === "exploration-grand-tour"
    );
    assert.equal(afterRollover?.completed, true);
    assert.equal(afterRollover?.progress, 5);
  });
});

test("Door Crasher and Teleporter Tourist dedupe stable keys", async () => {
  await withAchievementStore(async ({
    recordExplorationDoorUsed,
    recordTeleporterWarp,
    getAchievementsForWallet,
  }) => {
    recordExplorationDoorUsed(WALLET, "door:hub:12,0→chamber");
    recordExplorationDoorUsed(WALLET, "door:hub:12,0→chamber");
    recordTeleporterWarp(WALLET, "hub", 1, 2, "my-room");
    recordTeleporterWarp(WALLET, "hub", 1, 2, "my-room");
    recordTeleporterWarp(WALLET, "hub", 3, 4, "other-room");

    const door = getAchievementsForWallet(WALLET).achievements.find(
      (a) => a.achievementId === "exploration-door-crasher"
    );
    assert.equal(door?.progress, 3);

    const tp = getAchievementsForWallet(WALLET).achievements.find(
      (a) => a.achievementId === "exploration-teleporter-tourist"
    );
    assert.equal(tp?.progress, 2);
    assert.equal(tp?.threshold, 3);
  });
});

test("recordExplorationDoorFromSpawn credits built-in hub→chamber door", async () => {
  await withAchievementStore(async ({
    recordExplorationDoorFromSpawn,
    countAchievementSeenWithPrefix,
  }) => {
    recordExplorationDoorFromSpawn(WALLET, "chamber", -5, 0);
    assert.equal(countAchievementSeenWithPrefix(WALLET, "door:"), 1);
  });
});

test("Outfield Explorer counts margin tiles on the field only", async () => {
  await withAchievementStore(async ({
    recordOutfieldTilesWalked,
    getAchievementsForWallet,
  }) => {
    const outfieldTiles: Array<{ x: number; z: number }> = [];
    for (let z = -8; z <= 8; z += 1) {
      outfieldTiles.push({ x: -11, z }, { x: 11, z });
    }
    for (let x = -10; x <= 10; x += 1) {
      outfieldTiles.push({ x, z: -8 }, { x, z: 8 });
    }
    const unlocks: Array<{ achievementId: string }> = [];
    for (const tile of outfieldTiles.slice(0, 50)) {
      recordOutfieldTilesWalked(
        WALLET,
        "field",
        [tile],
        (u) => {
          unlocks.push(...u);
        }
      );
    }
    assert.ok(
      unlocks.some((u) => u.achievementId === "exploration-outfield-explorer")
    );
    const pitchTile = getAchievementsForWallet(WALLET).achievements.find(
      (a) => a.achievementId === "exploration-outfield-explorer"
    );
    assert.equal(pitchTile?.completed, true);
    assert.equal(
      recordOutfieldTilesWalked(WALLET, "field", [{ x: 0, z: 0 }]),
      0
    );
  });
});

test("worldcraft floor recolor dedupes palette painter and excludes pixel", async () => {
  await withAchievementStore(async ({
    recordFloorRecolored,
    getAchievementsForWallet,
  }) => {
    recordFloorRecolored(WALLET, "hub", 1, 2, 0xff0000);
    recordFloorRecolored(WALLET, "hub", 1, 2, 0x00ff00);
    recordFloorRecolored(WALLET, "pixel", 3, 4, 0x0000ff);
    const palette = getAchievementsForWallet(WALLET).achievements.find(
      (a) => a.achievementId === "worldcraft-palette-painter-1"
    );
    assert.equal(palette?.progress, 1);
    assert.equal(palette?.threshold, 50);
  });
});

test("worldcraft architect toolkit unlocks after five distinct shapes", async () => {
  await withAchievementStore(async ({
    recordTerrainShapePlaced,
    getAchievementsForWallet,
  }) => {
    const shapes = [
      { hex: false, pyramid: false, sphere: false, ramp: false },
      { hex: true, pyramid: false, sphere: false, ramp: false },
      { hex: false, pyramid: true, sphere: false, ramp: false },
      { hex: false, pyramid: false, sphere: true, ramp: false },
      { hex: false, pyramid: false, sphere: false, ramp: true },
    ] as const;
    const unlocks: Array<{ achievementId: string }> = [];
    for (const shape of shapes) {
      recordTerrainShapePlaced(WALLET, shape, (u) => unlocks.push(...u));
    }
    assert.ok(unlocks.some((u) => u.achievementId === "worldcraft-architect-toolkit"));
    const row = getAchievementsForWallet(WALLET).achievements.find(
      (a) => a.achievementId === "worldcraft-architect-toolkit"
    );
    assert.equal(row?.completed, true);
  });
});

test("worldcraft room maker deluxe composite unlocks once furnished", async () => {
  await withAchievementStore(async ({
    recordRoomCreatedForDeluxe,
    recordOwnedRoomBlockPlaced,
    recordRoomJoinSpawnForDeluxe,
    recordFloorRecolored,
    getAchievementsForWallet,
  }) => {
    const roomId = "my-test-room";
    const unlocks: Array<{ achievementId: string }> = [];
    recordRoomCreatedForDeluxe(WALLET, roomId, (u) => unlocks.push(...u));
    recordRoomJoinSpawnForDeluxe(WALLET, roomId, (u) => unlocks.push(...u));
    for (let i = 0; i < 25; i += 1) {
      recordOwnedRoomBlockPlaced(WALLET, roomId, (u) => unlocks.push(...u));
    }
    for (let i = 0; i < 5; i += 1) {
      recordFloorRecolored(
        WALLET,
        roomId,
        i,
        0,
        0xff0000 + (i << 8),
        (u) => unlocks.push(...u),
        { ownedRoomDeluxe: true }
      );
    }
    assert.ok(
      unlocks.some((u) => u.achievementId === "worldcraft-room-maker-deluxe")
    );
    const deluxe = getAchievementsForWallet(WALLET).achievements.find(
      (a) => a.achievementId === "worldcraft-room-maker-deluxe"
    );
    assert.equal(deluxe?.completed, true);
    assert.equal(deluxe?.progress, 4);
    assert.equal(deluxe?.threshold, 4);
  });
});

test("worldcraft signpost reader dedupes by signboard id", async () => {
  await withAchievementStore(async ({
    recordSignboardOpened,
    getAchievementsForWallet,
  }) => {
    const author = "NQ07 OTHER000000000000000000000000002";
    for (let i = 0; i < 10; i += 1) {
      recordSignboardOpened(WALLET, `sign-${i}`, author);
    }
    recordSignboardOpened(WALLET, "sign-0", author);
    const reader = getAchievementsForWallet(WALLET).achievements.find(
      (a) => a.achievementId === "worldcraft-signpost-reader"
    );
    assert.equal(reader?.completed, true);
    assert.equal(reader?.progress, 10);
  });
});
