import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

async function withCampaignStore(
  fn: (mod: typeof import("../src/campaignStore.js")) => void | Promise<void>
): Promise<void> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nspace-campaign-"));
  const sqlitePath = path.join(dir, "campaigns.sqlite");
  process.env.CAMPAIGN_STORE_SQLITE_PATH = sqlitePath;
  const mod = await import("../src/campaignStore.js");
  mod._resetCampaignStoreForTests();
  mod.initCampaignStore();
  try {
    await fn(mod);
  } finally {
    mod._resetCampaignStoreForTests();
    fs.rmSync(dir, { recursive: true, force: true });
    delete process.env.CAMPAIGN_STORE_SQLITE_PATH;
  }
}

const WALLET = "NQ07 TEST000000000000000000000000000001";
const UPLOAD_PATH =
  "/advertise/uploads/11111111-1111-1111-1111-111111111111.png";
const REPLACEMENT_PATH =
  "/advertise/uploads/22222222-2222-2222-2222-222222222222.jpg";

const CAMPAIGN_INPUT = {
  projectName: "Test Advert",
  miniappTargetUrl: "https://example.com",
  imageUrl: UPLOAD_PATH,
  displayIntervalSec: 30,
};

test("createCampaign rejects a remote image URL", async () => {
  await withCampaignStore(({ createCampaign, validateCampaignInput }) => {
    const v = validateCampaignInput({
      projectName: "Remote",
      miniappTargetUrl: "https://example.com",
      imageUrl: "https://example.com/ad.png",
    });
    assert.equal(v.ok, false);
    if (!v.ok) assert.equal(v.error, "invalid_image_url");
    const created = createCampaign(WALLET, {
      ...CAMPAIGN_INPUT,
      imageUrl: "https://example.com/ad.png",
    });
    assert.equal(created, null);
  });
});

test("createCampaign accepts a Campaign Creative upload path", async () => {
  await withCampaignStore(({ createCampaign }) => {
    const created = createCampaign(WALLET, CAMPAIGN_INPUT);
    assert.ok(created);
    assert.equal(created!.imageUrl, UPLOAD_PATH);
  });
});

test("admin can replace a campaign's Campaign Creative", async () => {
  await withCampaignStore(({ createCampaign, adminUpdateCampaignFields }) => {
    const draft = createCampaign(WALLET, CAMPAIGN_INPUT);
    assert.ok(draft);
    const updated = adminUpdateCampaignFields(draft!.id, {
      imageUrl: REPLACEMENT_PATH,
    });
    assert.ok(updated);
    assert.equal(updated!.imageUrl, REPLACEMENT_PATH);
    assert.equal(updated!.projectName, "Test Advert");
    assert.equal(updated!.miniappTargetUrl, "https://example.com");
  });
});

test("admin creative patch keeps Project URL when only the image changes", async () => {
  await withCampaignStore(({ createCampaign, adminUpdateCampaignFields }) => {
    const draft = createCampaign(WALLET, CAMPAIGN_INPUT);
    const updated = adminUpdateCampaignFields(draft!.id, {
      projectName: "Renamed",
      miniappTargetUrl: "https://example.com/app",
      imageUrl: REPLACEMENT_PATH,
    });
    assert.ok(updated);
    assert.equal(updated!.projectName, "Renamed");
    assert.equal(updated!.miniappTargetUrl, "https://example.com/app");
    assert.equal(updated!.imageUrl, REPLACEMENT_PATH);
  });
});

test("admin creative patch refuses a remote image URL", async () => {
  await withCampaignStore(({ createCampaign, adminUpdateCampaignFields }) => {
    const draft = createCampaign(WALLET, CAMPAIGN_INPUT);
    const updated = adminUpdateCampaignFields(draft!.id, {
      imageUrl: "https://evil.example/swap.png",
    });
    assert.equal(updated, null);
  });
});

test("owner draft update keeps an existing remote creative until replaced", async () => {
  await withCampaignStore(
    ({
      createCampaign,
      updateCampaignDraft,
      getCampaignDatabase,
    }) => {
      const draft = createCampaign(WALLET, CAMPAIGN_INPUT);
      assert.ok(draft);
      getCampaignDatabase()
        .prepare(`UPDATE campaigns SET image_url = ? WHERE id = ?`)
        .run("https://example.com/ad.png", draft!.id);
      const updated = updateCampaignDraft(draft!.id, WALLET, {
        projectName: "Renamed",
      });
      assert.ok(updated);
      assert.equal(updated!.projectName, "Renamed");
      assert.equal(updated!.imageUrl, "https://example.com/ad.png");
    }
  );
});

test("owner draft update refuses a newly pasted remote image URL", async () => {
  await withCampaignStore(({ createCampaign, updateCampaignDraft }) => {
    const draft = createCampaign(WALLET, CAMPAIGN_INPUT);
    const updated = updateCampaignDraft(draft!.id, WALLET, {
      imageUrl: "https://evil.example/swap.png",
    });
    assert.equal(updated, null);
  });
});
