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

const CAMPAIGN_INPUT = {
  projectName: "Test Advert",
  miniappTargetUrl: "https://example.com",
  imageUrl: "https://example.com/ad.png",
  displayIntervalSec: 30,
};

test("crediting a draft campaign funds it and queues for approval", async () => {
  await withCampaignStore(
    ({ createCampaign, grantCampaignAdminCredit, listCampaignTransactions }) => {
      const draft = createCampaign(WALLET, CAMPAIGN_INPUT);
      assert.ok(draft);
      assert.equal(draft!.status, "draft");
      assert.equal(draft!.txHash, null);

      const credited = grantCampaignAdminCredit(draft!.id, 1_000_000n);
      assert.ok(credited);
      assert.equal(credited!.status, "pending_approval");
      assert.equal(credited!.balanceLuna, "1000000");
      assert.equal(credited!.intentId, null);
      // A synthetic tx hash is required so the campaign can later be approved.
      assert.ok(credited!.txHash && credited!.txHash.startsWith("admin-credit:"));

      const txs = listCampaignTransactions(draft!.id);
      assert.equal(txs.length, 1);
      assert.equal(txs[0]!.amountLuna, "1000000");
    }
  );
});

test("credited draft can then be approved (has a tx hash)", async () => {
  await withCampaignStore(
    ({ createCampaign, grantCampaignAdminCredit, approveCampaign }) => {
      const draft = createCampaign(WALLET, CAMPAIGN_INPUT);
      const credited = grantCampaignAdminCredit(draft!.id, 500_000n);
      assert.equal(credited!.status, "pending_approval");

      const approved = approveCampaign(credited!.id, null);
      assert.ok(approved);
      assert.equal(approved!.status, "approved");
    }
  );
});

test("crediting a pending_payment campaign funds it and queues for approval", async () => {
  await withCampaignStore(
    ({
      createCampaign,
      setCampaignPendingPayment,
      grantCampaignAdminCredit,
    }) => {
      const draft = createCampaign(WALLET, CAMPAIGN_INPUT);
      const pending = setCampaignPendingPayment(draft!.id, WALLET, "intent-123");
      assert.ok(pending);
      assert.equal(pending!.status, "pending_payment");
      assert.equal(pending!.intentId, "intent-123");

      const credited = grantCampaignAdminCredit(draft!.id, 2_000_000n);
      assert.ok(credited);
      assert.equal(credited!.status, "pending_approval");
      assert.equal(credited!.balanceLuna, "2000000");
      assert.equal(credited!.intentId, null);
      assert.ok(credited!.txHash && credited!.txHash.startsWith("admin-credit:"));
    }
  );
});

test("crediting a funded (pending_approval) campaign tops up without changing status or tx hash", async () => {
  await withCampaignStore(
    ({ createCampaign, setCampaignPendingPayment, markCampaignPendingApproval, grantCampaignAdminCredit }) => {
      const draft = createCampaign(WALLET, CAMPAIGN_INPUT);
      setCampaignPendingPayment(draft!.id, WALLET, "intent-abc");
      const funded = markCampaignPendingApproval(draft!.id, "0xrealtxhash", 1_000_000n);
      assert.ok(funded);
      assert.equal(funded!.status, "pending_approval");

      const credited = grantCampaignAdminCredit(draft!.id, 500_000n);
      assert.ok(credited);
      assert.equal(credited!.status, "pending_approval");
      assert.equal(credited!.balanceLuna, "1500000");
      // The real on-chain hash must be preserved for funded campaigns.
      assert.equal(credited!.txHash, "0xrealtxhash");
    }
  );
});

test("crediting a rejected campaign is refused", async () => {
  await withCampaignStore(
    ({
      createCampaign,
      setCampaignPendingPayment,
      markCampaignPendingApproval,
      rejectCampaign,
      grantCampaignAdminCredit,
    }) => {
      const draft = createCampaign(WALLET, CAMPAIGN_INPUT);
      setCampaignPendingPayment(draft!.id, WALLET, "intent-xyz");
      markCampaignPendingApproval(draft!.id, "0xhash2", 1_000_000n);
      const rejected = rejectCampaign(draft!.id, "not allowed");
      assert.equal(rejected!.status, "rejected");

      const credited = grantCampaignAdminCredit(draft!.id, 500_000n);
      assert.equal(credited, null);
    }
  );
});
