import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const ACTOR = "NQ07 ADMIN000000000000000000000000001";

async function withSaleDisplays(
  fn: (
    mod: typeof import("../src/saleDisplays.js"),
    dataPath: string
  ) => void | Promise<void>
): Promise<void> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nspace-sale-displays-"));
  const dataPath = path.join(dir, "sale-displays.json");
  const mod = await import("../src/saleDisplays.js");
  mod._resetSaleDisplaysForTests({ dataPath });
  try {
    await fn(mod, dataPath);
  } finally {
    mod._resetSaleDisplaysForTests();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

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

test("create unbound Sale Display round-trips in memory", async () => {
  await withSaleDisplays(async ({ createSaleDisplay, getSaleDisplayById }) => {
    const created = createSaleDisplay({
      roomId: "cosmetic-gallery",
      x: 2,
      z: -3,
      createdBy: ACTOR,
    });
    assert.ok(created.id);
    assert.equal(created.roomId, "cosmetic-gallery");
    assert.equal(created.x, 2);
    assert.equal(created.z, -3);
    assert.equal(created.cosmeticSku, null);

    const got = getSaleDisplayById(created.id);
    assert.ok(got);
    assert.equal(got.cosmeticSku, null);
    assert.equal(got.x, 2);
  });
});

test("move and delete Sale Display", async () => {
  await withSaleDisplays(async ({
    createSaleDisplay,
    moveSaleDisplay,
    deleteSaleDisplay,
    getSaleDisplayById,
  }) => {
    const created = createSaleDisplay({
      roomId: "hub",
      x: 0,
      z: 0,
      createdBy: ACTOR,
    });
    const moved = moveSaleDisplay(created.id, 4, 5);
    assert.ok(moved);
    assert.equal(moved.x, 4);
    assert.equal(moved.z, 5);
    assert.equal(getSaleDisplayById(created.id)?.x, 4);

    assert.equal(deleteSaleDisplay(created.id), true);
    assert.equal(getSaleDisplayById(created.id), undefined);
    assert.equal(deleteSaleDisplay(created.id), false);
  });
});

test("persist Sale Displays across load", async () => {
  await withSaleDisplays(async (mod, dataPath) => {
    const created = mod.createSaleDisplay({
      roomId: "hub",
      x: 1,
      z: 2,
      createdBy: ACTOR,
    });
    mod.flushSaleDisplaysSync();
    mod._resetSaleDisplaysForTests({ dataPath });
    mod.loadSaleDisplays();
    const got = mod.getSaleDisplayById(created.id);
    assert.ok(got);
    assert.equal(got.roomId, "hub");
    assert.equal(got.x, 1);
    assert.equal(got.z, 2);
    assert.equal(got.cosmeticSku, null);
  });
});

test("player wire omits unbound; admin wire includes unbound", async () => {
  await withSaleDisplays(async ({ createSaleDisplay, listSaleDisplaysWire }) => {
    createSaleDisplay({
      roomId: "hub",
      x: 0,
      z: 0,
      createdBy: ACTOR,
    });
    assert.equal(listSaleDisplaysWire("hub", { isAdmin: false }).length, 0);
    const admin = listSaleDisplaysWire("hub", { isAdmin: true });
    assert.equal(admin.length, 1);
    assert.equal(admin[0]!.cosmeticSku, null);
  });
});

test("bind Published shop Catalog Entry; reject draft archived achievement", async () => {
  await withCosmeticStore(async (cosmetics) => {
    await withSaleDisplays(async (sd) => {
      cosmetics.createCatalogEntry(
        {
          cosmeticSku: "live-badge",
          presetId: "test-aura",
          displayName: "Live Badge",
          description: "",
          collection: "Starter",
          sortOrder: 1,
          priceLuna: 100_000n,
        },
        ACTOR
      );
      cosmetics.publishCatalogEntry("live-badge", ACTOR);

      cosmetics.createCatalogEntry(
        {
          cosmeticSku: "draft-badge",
          presetId: "test-aura-gold",
          displayName: "Draft",
          description: "",
          collection: "Starter",
          sortOrder: 2,
          priceLuna: 100_000n,
        },
        ACTOR
      );

      cosmetics.createCatalogEntry(
        {
          cosmeticSku: "old-badge",
          presetId: "test-trail",
          displayName: "Old",
          description: "",
          collection: "Starter",
          sortOrder: 3,
          priceLuna: 100_000n,
        },
        ACTOR
      );
      cosmetics.publishCatalogEntry("old-badge", ACTOR);
      cosmetics.archiveCatalogEntry("old-badge", ACTOR);

      cosmetics.createCatalogEntry(
        {
          cosmeticSku: "ach-badge",
          presetId: "test-trail-alt",
          displayName: "Achieve",
          description: "",
          collection: "Achievements",
          sortOrder: 4,
          priceLuna: 0n,
        },
        ACTOR
      );
      cosmetics.publishCatalogEntry("ach-badge", ACTOR);

      const display = sd.createSaleDisplay({
        roomId: "hub",
        x: 1,
        z: 1,
        createdBy: ACTOR,
      });

      const ok = sd.bindSaleDisplay(display.id, "live-badge");
      assert.equal(ok.ok, true);
      assert.equal(sd.getSaleDisplayById(display.id)?.cosmeticSku, "live-badge");

      const draft = sd.bindSaleDisplay(display.id, "draft-badge");
      assert.equal(draft.ok, false);
      if (!draft.ok) assert.equal(draft.error, "not_published");
      assert.equal(sd.getSaleDisplayById(display.id)?.cosmeticSku, "live-badge");

      const archived = sd.bindSaleDisplay(display.id, "old-badge");
      assert.equal(archived.ok, false);
      if (!archived.ok) assert.equal(archived.error, "not_published");

      const ach = sd.bindSaleDisplay(display.id, "ach-badge");
      assert.equal(ach.ok, false);
      if (!ach.ok) assert.equal(ach.error, "achievement_only");
    });
  });
});

test("player wire includes active bind with slot-aware kind; inactive bind admin-only", async () => {
  await withCosmeticStore(async (cosmetics) => {
    await withSaleDisplays(async (sd) => {
      cosmetics.createCatalogEntry(
        {
          cosmeticSku: "trail-sku",
          presetId: "test-trail",
          displayName: "Spark",
          description: "",
          collection: "Trails",
          sortOrder: 1,
          priceLuna: 200_000n,
        },
        ACTOR
      );
      cosmetics.publishCatalogEntry("trail-sku", ACTOR);

      cosmetics.createCatalogEntry(
        {
          cosmeticSku: "deploy-sku",
          presetId: "test-deployable",
          displayName: "Boom",
          description: "",
          collection: "Gear",
          sortOrder: 2,
          priceLuna: 300_000n,
        },
        ACTOR
      );
      cosmetics.publishCatalogEntry("deploy-sku", ACTOR);

      cosmetics.createCatalogEntry(
        {
          cosmeticSku: "later-archived",
          presetId: "test-aura",
          displayName: "Gone",
          description: "",
          collection: "A",
          sortOrder: 3,
          priceLuna: 50_000n,
        },
        ACTOR
      );
      cosmetics.publishCatalogEntry("later-archived", ACTOR);

      const trail = sd.createSaleDisplay({
        roomId: "hub",
        x: 0,
        z: 0,
        createdBy: ACTOR,
      });
      const deploy = sd.createSaleDisplay({
        roomId: "hub",
        x: 1,
        z: 0,
        createdBy: ACTOR,
      });
      const soonGone = sd.createSaleDisplay({
        roomId: "hub",
        x: 2,
        z: 0,
        createdBy: ACTOR,
      });
      assert.equal(sd.bindSaleDisplay(trail.id, "trail-sku").ok, true);
      assert.equal(sd.bindSaleDisplay(deploy.id, "deploy-sku").ok, true);
      assert.equal(sd.bindSaleDisplay(soonGone.id, "later-archived").ok, true);
      cosmetics.archiveCatalogEntry("later-archived", ACTOR);

      const player = sd.listSaleDisplaysWire("hub", { isAdmin: false });
      assert.equal(player.length, 2);
      const trailWire = player.find((w) => w.id === trail.id);
      const deployWire = player.find((w) => w.id === deploy.id);
      assert.ok(trailWire);
      assert.equal(trailWire.cosmeticSku, "trail-sku");
      assert.equal(trailWire.presetId, "test-trail");
      assert.equal(trailWire.slot, "trail");
      assert.equal(trailWire.kind, "mannequin");
      assert.equal(trailWire.label, "Spark");
      assert.ok(deployWire);
      assert.equal(deployWire.kind, "floor");
      assert.equal(deployWire.slot, "deployable");

      const admin = sd.listSaleDisplaysWire("hub", { isAdmin: true });
      assert.equal(admin.length, 3);
      const inactive = admin.find((w) => w.id === soonGone.id);
      assert.ok(inactive);
      assert.equal(inactive.bindInactive, true);
      assert.equal(inactive.cosmeticSku, "later-archived");
      assert.equal(inactive.kind, undefined);
    });
  });
});

test("clear bind returns display to unbound for players", async () => {
  await withCosmeticStore(async (cosmetics) => {
    await withSaleDisplays(async (sd) => {
      cosmetics.createCatalogEntry(
        {
          cosmeticSku: "clear-me",
          presetId: "test-aura",
          displayName: "Clear",
          description: "",
          collection: "A",
          sortOrder: 1,
          priceLuna: 1n,
        },
        ACTOR
      );
      cosmetics.publishCatalogEntry("clear-me", ACTOR);
      const d = sd.createSaleDisplay({
        roomId: "hub",
        x: 0,
        z: 0,
        createdBy: ACTOR,
      });
      assert.equal(sd.bindSaleDisplay(d.id, "clear-me").ok, true);
      assert.equal(sd.listSaleDisplaysWire("hub", { isAdmin: false }).length, 1);
      sd.clearSaleDisplayBind(d.id);
      assert.equal(sd.listSaleDisplaysWire("hub", { isAdmin: false }).length, 0);
      assert.equal(sd.getSaleDisplayById(d.id)?.cosmeticSku, null);
    });
  });
});
