import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

async function withCosmeticStore(
  fn: (mod: typeof import("../src/cosmeticStore.js")) => void | Promise<void>
): Promise<void> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nspace-cosmetic-"));
  const sqlitePath = path.join(dir, "campaigns.sqlite");
  process.env.CAMPAIGN_STORE_SQLITE_PATH = sqlitePath;
  process.env.COSMETIC_STORE_TEST_PRESETS = "1";
  const mod = await import("../src/cosmeticStore.js");
  mod._resetCosmeticStoreForTests();
  mod.initCosmeticStore();
  try {
    await fn(mod);
  } finally {
    mod._resetCosmeticStoreForTests();
    fs.rmSync(dir, { recursive: true, force: true });
    delete process.env.CAMPAIGN_STORE_SQLITE_PATH;
    delete process.env.COSMETIC_STORE_TEST_PRESETS;
  }
}

const ACTOR = "NQ07 ADMIN000000000000000000000000001";
const WALLET = "NQ07 TEST000000000000000000000000000001";

test("create draft catalog entry and list in admin", async () => {
  await withCosmeticStore(async ({ createCatalogEntry, listAdminCatalog }) => {
    const created = createCatalogEntry(
      {
        cosmeticSku: "aura-blue-v1",
        presetId: "test-aura",
        displayName: "Blue Glow",
        description: "A calm blue aura.",
        collection: "Starter",
        sortOrder: 10,
        priceLuna: 500_000n,
      },
      ACTOR
    );
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.equal(created.entry.status, "draft");
    assert.equal(created.entry.slot, "aura");
    assert.equal(created.entry.presetId, "test-aura");

    const all = listAdminCatalog();
    assert.equal(all.length, 1);
    assert.equal(all[0]!.cosmeticSku, "aura-blue-v1");
  });
});

test("published shop excludes draft and archived entries", async () => {
  await withCosmeticStore(async ({
    createCatalogEntry,
    publishCatalogEntry,
    archiveCatalogEntry,
    listPublishedShop,
  }) => {
    createCatalogEntry(
      {
        cosmeticSku: "draft-item",
        presetId: "test-aura",
        displayName: "Draft",
        description: "",
        collection: "A",
        sortOrder: 1,
        priceLuna: 100_000n,
      },
      ACTOR
    );
    createCatalogEntry(
      {
        cosmeticSku: "live-item",
        presetId: "test-aura-gold",
        displayName: "Gold",
        description: "",
        collection: "A",
        sortOrder: 2,
        priceLuna: 200_000n,
      },
      ACTOR
    );
    publishCatalogEntry("live-item", ACTOR);
    createCatalogEntry(
      {
        cosmeticSku: "old-item",
        presetId: "test-trail",
        displayName: "Old",
        description: "",
        collection: "B",
        sortOrder: 1,
        priceLuna: 50_000n,
      },
      ACTOR
    );
    publishCatalogEntry("old-item", ACTOR);
    archiveCatalogEntry("old-item", ACTOR);

    const shop = listPublishedShop();
    assert.equal(shop.length, 1);
    assert.equal(shop[0]!.cosmeticSku, "live-item");
  });
});

test("slug uniqueness enforced", async () => {
  await withCosmeticStore(async ({ createCatalogEntry }) => {
    const first = createCatalogEntry(
      {
        cosmeticSku: "unique-sku",
        presetId: "test-aura",
        displayName: "One",
        description: "",
        collection: "X",
        sortOrder: 0,
        priceLuna: 1n,
      },
      ACTOR
    );
    assert.equal(first.ok, true);
    const dup = createCatalogEntry(
      {
        cosmeticSku: "unique-sku",
        presetId: "test-aura-gold",
        displayName: "Two",
        description: "",
        collection: "X",
        sortOrder: 1,
        priceLuna: 1n,
      },
      ACTOR
    );
    assert.equal(dup.ok, false);
    if (!dup.ok) assert.equal(dup.error, "sku_exists");
  });
});

test("grant entitlement and loadout equip one per passive slot", async () => {
  await withCosmeticStore(async ({
    createCatalogEntry,
    publishCatalogEntry,
    grantEntitlement,
    listEntitlements,
    setLoadoutSlot,
    getLoadout,
  }) => {
    createCatalogEntry(
      {
        cosmeticSku: "aura-a",
        presetId: "test-aura",
        displayName: "A",
        description: "",
        collection: "C",
        sortOrder: 0,
        priceLuna: 1n,
      },
      ACTOR
    );
    createCatalogEntry(
      {
        cosmeticSku: "aura-b",
        presetId: "test-aura-gold",
        displayName: "B",
        description: "",
        collection: "C",
        sortOrder: 1,
        priceLuna: 1n,
      },
      ACTOR
    );
    publishCatalogEntry("aura-a", ACTOR);
    publishCatalogEntry("aura-b", ACTOR);
    grantEntitlement(WALLET, "aura-a", ACTOR, "grant");
    grantEntitlement(WALLET, "aura-b", ACTOR, "grant");

    const owned = listEntitlements(WALLET);
    assert.equal(owned.length, 2);

    const eq1 = setLoadoutSlot(WALLET, "aura", "aura-a");
    assert.equal(eq1.ok, true);
    let loadout = getLoadout(WALLET);
    assert.equal(loadout.auraSku, "aura-a");

    const eq2 = setLoadoutSlot(WALLET, "aura", "aura-b");
    assert.equal(eq2.ok, true);
    loadout = getLoadout(WALLET);
    assert.equal(loadout.auraSku, "aura-b");

    const clear = setLoadoutSlot(WALLET, "aura", null);
    assert.equal(clear.ok, true);
    loadout = getLoadout(WALLET);
    assert.equal(loadout.auraSku, null);
  });
});

test("loadout rejects unowned or wrong slot", async () => {
  await withCosmeticStore(async ({
    createCatalogEntry,
    publishCatalogEntry,
    setLoadoutSlot,
  }) => {
    createCatalogEntry(
      {
        cosmeticSku: "trail-only",
        presetId: "test-trail",
        displayName: "Trail",
        description: "",
        collection: "C",
        sortOrder: 0,
        priceLuna: 1n,
      },
      ACTOR
    );
    publishCatalogEntry("trail-only", ACTOR);

    const unowned = setLoadoutSlot(WALLET, "trail", "trail-only");
    assert.equal(unowned.ok, false);
    if (!unowned.ok) assert.equal(unowned.error, "not_owned");

    createCatalogEntry(
      {
        cosmeticSku: "bubble-one",
        presetId: "test-bubble",
        displayName: "Bubble",
        description: "",
        collection: "C",
        sortOrder: 1,
        priceLuna: 1n,
      },
      ACTOR
    );
    publishCatalogEntry("bubble-one", ACTOR);
    const { grantEntitlement } = await import("../src/cosmeticStore.js");
    grantEntitlement(WALLET, "bubble-one", ACTOR, "grant");

    const wrongSlot = setLoadoutSlot(WALLET, "aura", "bubble-one");
    assert.equal(wrongSlot.ok, false);
    if (!wrongSlot.ok) assert.equal(wrongSlot.error, "slot_mismatch");
  });
});

test("purchase grant is idempotent", async () => {
  const BUYER = "NQ07 TEST000000000000000000000000000099";
  await withCosmeticStore(async ({
    createCatalogEntry,
    publishCatalogEntry,
    grantEntitlementFromPurchase,
    listEntitlements,
  }) => {
    createCatalogEntry(
      {
        cosmeticSku: "buy-me",
        presetId: "test-nameplate",
        displayName: "Plate",
        description: "",
        collection: "Shop",
        sortOrder: 0,
        priceLuna: 1_000_000n,
      },
      ACTOR
    );
    publishCatalogEntry("buy-me", ACTOR);

    const first = grantEntitlementFromPurchase(BUYER, "buy-me", {
      intentId: "intent-1",
      txHash: "0xabc",
    });
    assert.equal(first.ok, true);
    assert.equal(first.granted, true);

    const second = grantEntitlementFromPurchase(BUYER, "buy-me", {
      intentId: "intent-1",
      txHash: "0xabc",
    });
    assert.equal(second.ok, true);
    assert.equal(second.granted, false);

    assert.equal(listEntitlements(BUYER).length, 1);
  });
});

test("validate unlock intent rejects draft archived and owned", async () => {
  const prevShopEnabled = process.env.SHOP_ENABLED;
  process.env.SHOP_ENABLED = "1";
  try {
  await withCosmeticStore(async ({
    createCatalogEntry,
    publishCatalogEntry,
    archiveCatalogEntry,
    grantEntitlement,
    validateUnlockIntent,
  }) => {
    createCatalogEntry(
      {
        cosmeticSku: "draft-sku",
        presetId: "test-aura",
        displayName: "D",
        description: "",
        collection: "X",
        sortOrder: 0,
        priceLuna: 1n,
      },
      ACTOR
    );
    let v = validateUnlockIntent(WALLET, "draft-sku");
    assert.equal(v.ok, false);
    if (!v.ok) assert.equal(v.error, "not_published");

    createCatalogEntry(
      {
        cosmeticSku: "pub-sku",
        presetId: "test-aura-gold",
        displayName: "P",
        description: "",
        collection: "X",
        sortOrder: 1,
        priceLuna: 1n,
      },
      ACTOR
    );
    publishCatalogEntry("pub-sku", ACTOR);
    v = validateUnlockIntent(WALLET, "pub-sku");
    assert.equal(v.ok, true);

    grantEntitlement(WALLET, "pub-sku", ACTOR, "grant");
    v = validateUnlockIntent(WALLET, "pub-sku");
    assert.equal(v.ok, false);
    if (!v.ok) assert.equal(v.error, "already_owned");

    createCatalogEntry(
      {
        cosmeticSku: "arch-sku",
        presetId: "test-trail-smoke",
        displayName: "A",
        description: "",
        collection: "X",
        sortOrder: 2,
        priceLuna: 1n,
      },
      ACTOR
    );
    publishCatalogEntry("arch-sku", ACTOR);
    archiveCatalogEntry("arch-sku", ACTOR);
    v = validateUnlockIntent(WALLET, "arch-sku");
    assert.equal(v.ok, false);
    if (!v.ok) assert.equal(v.error, "not_published");
  });
  } finally {
    if (prevShopEnabled === undefined) delete process.env.SHOP_ENABLED;
    else process.env.SHOP_ENABLED = prevShopEnabled;
  }
});

test("deploy rules use preset defaults and entry overrides with ceilings", async () => {
  await withCosmeticStore(async ({
    createCatalogEntry,
    getResolvedDeployRules,
    updateCatalogEntry,
  }) => {
    createCatalogEntry(
      {
        cosmeticSku: "confetti",
        presetId: "test-deployable",
        displayName: "Confetti",
        description: "",
        collection: "Fun",
        sortOrder: 0,
        priceLuna: 5_000_000n,
      },
      ACTOR
    );
    let rules = getResolvedDeployRules("confetti");
    assert.deepEqual(rules, {
      cooldownSec: 30,
      durationSec: 8,
      roomCap: 5,
      deployRange: 3,
    });

    const bad = updateCatalogEntry(
      "confetti",
      { cooldownSec: 2 },
      ACTOR
    );
    assert.equal(bad.ok, false);
    if (!bad.ok) assert.equal(bad.error, "invalid_deploy_param");

    const good = updateCatalogEntry(
      "confetti",
      { cooldownSec: 60, roomCap: 10 },
      ACTOR
    );
    assert.equal(good.ok, true);
    rules = getResolvedDeployRules("confetti");
    assert.equal(rules?.cooldownSec, 60);
    assert.equal(rules?.roomCap, 10);
    assert.equal(rules?.durationSec, 8);
  });
});

test("changelog records create publish archive grant", async () => {
  await withCosmeticStore(async ({
    createCatalogEntry,
    publishCatalogEntry,
    archiveCatalogEntry,
    grantEntitlement,
    getCatalogChangelog,
  }) => {
    createCatalogEntry(
      {
        cosmeticSku: "log-sku",
        presetId: "test-bubble",
        displayName: "Bubble",
        description: "Hi",
        collection: "Log",
        sortOrder: 0,
        priceLuna: 1n,
      },
      ACTOR
    );
    publishCatalogEntry("log-sku", ACTOR);
    grantEntitlement(WALLET, "log-sku", ACTOR, "grant");
    archiveCatalogEntry("log-sku", ACTOR);

    const log = getCatalogChangelog("log-sku");
    const actions = log.map((r) => r.action);
    assert.ok(actions.includes("created"));
    assert.ok(actions.includes("published"));
    assert.ok(actions.includes("granted"));
    assert.ok(actions.includes("archived"));
  });
});

test("fresh store starts empty after cosmetics v2 hard reset", async () => {
  await withCosmeticStore(async ({
    listAdminCatalog,
    listEntitlements,
    listPublishedShop,
    getLoadout,
  }) => {
    assert.equal(listAdminCatalog().length, 0);
    assert.equal(listEntitlements(WALLET).length, 0);
    assert.equal(listPublishedShop().length, 0);
    const loadout = getLoadout(WALLET);
    assert.equal(loadout.auraSku, null);
    assert.equal(loadout.trailSku, null);
  });
});

test("cosmetics v2 hard reset clears legacy rows once and is idempotent", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nspace-cosmetic-migrate-"));
  const sqlitePath = path.join(dir, "campaigns.sqlite");
  process.env.CAMPAIGN_STORE_SQLITE_PATH = sqlitePath;
  process.env.COSMETIC_STORE_TEST_PRESETS = "1";
  try {
    const { _resetCosmeticStoreForTests, runCosmeticsV2HardResetIfNeeded, initCosmeticStore } =
      await import("../src/cosmeticStore.js");
    _resetCosmeticStoreForTests();
    const { initCampaignStore, getCampaignDatabase } = await import(
      "../src/campaignStore.js"
    );
    initCampaignStore();
    const db = getCampaignDatabase();
    db.exec(`
      CREATE TABLE IF NOT EXISTS cosmetic_catalog (
        cosmetic_sku TEXT PRIMARY KEY,
        preset_id TEXT NOT NULL,
        status TEXT NOT NULL,
        display_name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        collection TEXT NOT NULL DEFAULT '',
        sort_order INTEGER NOT NULL DEFAULT 0,
        price_luna TEXT NOT NULL,
        cooldown_sec INTEGER,
        duration_sec INTEGER,
        room_cap INTEGER,
        deploy_range INTEGER,
        created_at_ms INTEGER NOT NULL,
        updated_at_ms INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS cosmetic_entitlements (
        wallet TEXT NOT NULL,
        cosmetic_sku TEXT NOT NULL,
        granted_at_ms INTEGER NOT NULL,
        source TEXT NOT NULL,
        intent_id TEXT,
        tx_hash TEXT,
        PRIMARY KEY (wallet, cosmetic_sku)
      );
      CREATE TABLE IF NOT EXISTS cosmetic_loadouts (
        wallet TEXT PRIMARY KEY,
        aura_sku TEXT,
        nameplate_sku TEXT,
        chat_bubble_sku TEXT,
        trail_sku TEXT
      );
      CREATE TABLE IF NOT EXISTS cosmetic_changelog (
        id TEXT PRIMARY KEY,
        cosmetic_sku TEXT NOT NULL,
        at_ms INTEGER NOT NULL,
        actor_wallet TEXT NOT NULL,
        action TEXT NOT NULL,
        before_json TEXT,
        after_json TEXT
      );
    `);
    const now = Date.now();
    db.prepare(
      `INSERT INTO cosmetic_catalog
        (cosmetic_sku, preset_id, status, display_name, description, collection,
         sort_order, price_luna, created_at_ms, updated_at_ms)
       VALUES (?, ?, 'published', ?, '', 'Legacy', 0, '100000', ?, ?)`
    ).run("legacy-aura", "legacy-preset", "Legacy Aura", now, now);
    db.prepare(
      `INSERT INTO cosmetic_entitlements
        (wallet, cosmetic_sku, granted_at_ms, source, intent_id, tx_hash)
       VALUES (?, ?, ?, 'purchase', NULL, NULL)`
    ).run(WALLET, "legacy-aura", now);
    db.prepare(
      `INSERT INTO cosmetic_loadouts (wallet, aura_sku) VALUES (?, ?)`
    ).run(WALLET, "legacy-aura");

    runCosmeticsV2HardResetIfNeeded();
    assert.equal(
      (db.prepare(`SELECT COUNT(*) AS c FROM cosmetic_catalog`).get() as { c: number }).c,
      0
    );
    assert.equal(
      (db.prepare(`SELECT COUNT(*) AS c FROM cosmetic_entitlements`).get() as { c: number })
        .c,
      0
    );
    assert.equal(
      (db.prepare(`SELECT COUNT(*) AS c FROM cosmetic_loadouts`).get() as { c: number }).c,
      0
    );

    initCosmeticStore();
    const { createCatalogEntry, publishCatalogEntry, setLoadoutSlot } = await import(
      "../src/cosmeticStore.js"
    );
    createCatalogEntry(
      {
        cosmeticSku: "post-reset",
        presetId: "test-aura",
        displayName: "Post reset",
        description: "",
        collection: "Shop",
        sortOrder: 0,
        priceLuna: 1n,
      },
      ACTOR
    );
    publishCatalogEntry("post-reset", ACTOR);

    runCosmeticsV2HardResetIfNeeded();
    assert.equal(
      (db.prepare(`SELECT COUNT(*) AS c FROM cosmetic_catalog`).get() as { c: number }).c,
      1
    );

    const unowned = setLoadoutSlot(WALLET, "aura", "legacy-aura");
    assert.equal(unowned.ok, false);
    if (!unowned.ok) assert.equal(unowned.error, "not_found");
  } finally {
    const { _resetCosmeticStoreForTests } = await import("../src/cosmeticStore.js");
    _resetCosmeticStoreForTests();
    fs.rmSync(dir, { recursive: true, force: true });
    delete process.env.CAMPAIGN_STORE_SQLITE_PATH;
    delete process.env.COSMETIC_STORE_TEST_PRESETS;
  }
});

test("wardrobe shop includes owned achievement passives excluded from purchasable shop", async () => {
  await withCosmeticStore(async ({
    createCatalogEntry,
    publishCatalogEntry,
    grantEntitlement,
    listPublishedShop,
    listWardrobeShop,
  }) => {
    createCatalogEntry(
      {
        cosmeticSku: "ach-trail-spark-cyan",
        presetId: "test-trail",
        displayName: "Spark Path: Cyan",
        description: "Unlocked by Commons Builder I.",
        collection: "Achievements",
        sortOrder: 1,
        priceLuna: 0n,
      },
      ACTOR
    );
    publishCatalogEntry("ach-trail-spark-cyan", ACTOR);
    grantEntitlement(WALLET, "ach-trail-spark-cyan", ACTOR, "achievement");

    assert.equal(
      listPublishedShop().some((s) => s.cosmeticSku === "ach-trail-spark-cyan"),
      false
    );
    const wardrobe = listWardrobeShop(WALLET);
    const trail = wardrobe.find((s) => s.cosmeticSku === "ach-trail-spark-cyan");
    assert.ok(trail);
    assert.equal(trail?.slot, "trail");
    assert.equal(trail?.owned, true);
  });
});

test("ensureDevWalletAllCosmeticEntitlements seeds catalog and grants dev login wallet", async () => {
  const prevNode = process.env.NODE_ENV;
  const prevDev = process.env.DEV_AUTH_BYPASS;
  process.env.NODE_ENV = "development";
  process.env.DEV_AUTH_BYPASS = "1";
  try {
    const { listCosmeticPresets } = await import("../src/cosmeticPresets.js");
    await withCosmeticStore(
      async ({
        DEV_LOGIN_WALLET,
        ensureDevWalletAllCosmeticEntitlements,
        isDevLoginWallet,
        listAdminCatalog,
        listEntitlements,
      }) => {
        assert.equal(
          isDevLoginWallet("NQ07 DEV0000000000000000000000000000000000"),
          true
        );
        ensureDevWalletAllCosmeticEntitlements(DEV_LOGIN_WALLET);
        const catalog = listAdminCatalog();
        assert.ok(catalog.length >= listCosmeticPresets().length);
        const owned = listEntitlements(DEV_LOGIN_WALLET);
        assert.equal(owned.length, catalog.length);
      }
    );
  } finally {
    if (prevNode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNode;
    if (prevDev === undefined) delete process.env.DEV_AUTH_BYPASS;
    else process.env.DEV_AUTH_BYPASS = prevDev;
  }
});

test("ensureDevWalletAllCosmeticEntitlements is a no-op without dev bypass", async () => {
  const prevNode = process.env.NODE_ENV;
  const prevDev = process.env.DEV_AUTH_BYPASS;
  process.env.NODE_ENV = "development";
  process.env.DEV_AUTH_BYPASS = "0";
  try {
    await withCosmeticStore(
      async ({
        DEV_LOGIN_WALLET,
        ensureDevWalletAllCosmeticEntitlements,
        listAdminCatalog,
        listEntitlements,
      }) => {
        ensureDevWalletAllCosmeticEntitlements(DEV_LOGIN_WALLET);
        assert.equal(listAdminCatalog().length, 0);
        assert.equal(listEntitlements(DEV_LOGIN_WALLET).length, 0);
      }
    );
  } finally {
    if (prevNode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNode;
    if (prevDev === undefined) delete process.env.DEV_AUTH_BYPASS;
    else process.env.DEV_AUTH_BYPASS = prevDev;
  }
});

test("daily featured selection is deterministic per day and bounded by count", async () => {
  const { selectDailyFeatured } = await import("../src/cosmeticStore.js");
  const pool = ["a", "b", "c", "d", "e", "f", "g"].map((cosmeticSku) => ({
    cosmeticSku,
  }));

  const monday = selectDailyFeatured(pool, "2026-06-29", 5);
  assert.equal(monday.length, 5);
  // Same day key => identical selection and order.
  assert.deepEqual(
    selectDailyFeatured(pool, "2026-06-29", 5).map((e) => e.cosmeticSku),
    monday.map((e) => e.cosmeticSku)
  );
  // No duplicates in a selection.
  assert.equal(new Set(monday.map((e) => e.cosmeticSku)).size, monday.length);

  // A different day key generally yields a different selection from the same pool.
  const tuesday = selectDailyFeatured(pool, "2026-06-30", 5);
  assert.notDeepEqual(
    tuesday.map((e) => e.cosmeticSku),
    monday.map((e) => e.cosmeticSku)
  );
});

test("daily featured returns all entries when pool is smaller than count", async () => {
  const { selectDailyFeatured } = await import("../src/cosmeticStore.js");
  const pool = ["x", "y", "z"].map((cosmeticSku) => ({ cosmeticSku }));
  const picked = selectDailyFeatured(pool, "2026-06-29", 5);
  assert.equal(picked.length, 3);
  assert.deepEqual(
    [...picked.map((e) => e.cosmeticSku)].sort(),
    ["x", "y", "z"]
  );
  assert.deepEqual(selectDailyFeatured([], "2026-06-29", 5), []);
});
