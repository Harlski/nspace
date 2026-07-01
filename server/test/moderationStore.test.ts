import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("setMiningBanned persists note and isMiningBanned reflects state", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nspace-mod-"));
  const storeFile = path.join(dir, "moderation.json");
  process.env.MODERATION_STORE_FILE = storeFile;

  const {
    isMiningBanned,
    listModerationSnapshot,
    setMiningBanned,
  } = await import("../src/moderationStore.js");

  const wallet = "NQ07TEST000000000000000000000000000001";

  assert.equal(isMiningBanned(wallet), false);

  setMiningBanned(wallet, true, "ADMIN1", "  bot farm  ");
  assert.equal(isMiningBanned(wallet), true);

  const snap = listModerationSnapshot();
  assert.equal(snap.miningRestrictions.length, 1);
  assert.equal(snap.miningRestrictions[0]?.address, wallet);
  assert.equal(snap.miningRestrictions[0]?.note, "bot farm");
  assert.equal(snap.miningRestrictions[0]?.by, "ADMIN1");

  setMiningBanned(wallet, false);
  assert.equal(isMiningBanned(wallet), false);
  assert.equal(listModerationSnapshot().miningRestrictions.length, 0);

  fs.rmSync(dir, { recursive: true, force: true });
  delete process.env.MODERATION_STORE_FILE;
});

test("blockClaimAccessDeniedReason: guest then mining restriction", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nspace-mod-"));
  process.env.MODERATION_STORE_FILE = path.join(dir, "moderation.json");

  const { setMiningBanned } = await import("../src/moderationStore.js");
  const {
    blockClaimAccessDeniedReason,
    BLOCK_CLAIM_MSG_GUEST,
    BLOCK_CLAIM_MSG_MINING_RESTRICTED,
  } = await import("../src/blockClaimAccess.js");

  assert.equal(
    blockClaimAccessDeniedReason("guest:abc123"),
    BLOCK_CLAIM_MSG_GUEST
  );

  const wallet = "NQ07TEST000000000000000000000000000002";
  assert.equal(blockClaimAccessDeniedReason(wallet), null);

  setMiningBanned(wallet, true);
  assert.equal(
    blockClaimAccessDeniedReason(wallet),
    BLOCK_CLAIM_MSG_MINING_RESTRICTED
  );

  fs.rmSync(dir, { recursive: true, force: true });
  delete process.env.MODERATION_STORE_FILE;
});
