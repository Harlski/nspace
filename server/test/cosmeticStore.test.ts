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
  const mod = await import("../src/cosmeticStore.js");
  mod.initCosmeticStore();
  try {
    await fn(mod);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    delete process.env.CAMPAIGN_STORE_SQLITE_PATH;
  }
}

const ACTOR = "NQ07 ADMIN000000000000000000000000001";
const WALLET = "NQ07 TEST000000000000000000000000000001";

test("create draft catalog entry and list in admin", async () => {
  await withCosmeticStore(async ({ createCatalogEntry, listAdminCatalog }) => {
    const created = createCatalogEntry(
      {
        cosmeticSku: "aura-blue-v1",
        presetId: "aura-glow-blue",
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
    assert.equal(created.entry.presetId, "aura-glow-blue");

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
        presetId: "aura-glow-blue",
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
        presetId: "aura-glow-gold",
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
        presetId: "trail-sparkle",
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
        presetId: "aura-glow-blue",
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
        presetId: "aura-glow-gold",
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
        presetId: "aura-glow-blue",
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
        presetId: "aura-glow-gold",
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
        presetId: "trail-sparkle",
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
        presetId: "bubble-rounded-pastel",
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
        presetId: "nameplate-frame-simple",
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
        presetId: "aura-glow-blue",
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
        presetId: "aura-glow-gold",
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
        presetId: "trail-smoke",
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
        presetId: "deployable-confetti-burst",
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
        presetId: "bubble-sharp-dark",
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
