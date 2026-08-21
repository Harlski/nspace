import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nspace-admin-player-"));
const profileFile = path.join(dir, "player-profiles.json");
const modFile = path.join(dir, "moderation.json");
const adminSettingsFile = path.join(dir, "admin-runtime-settings.json");
process.env.PLAYER_PROFILE_STORE_FILE = profileFile;
process.env.MODERATION_STORE_FILE = modFile;
process.env.ADMIN_RUNTIME_SETTINGS_FILE = adminSettingsFile;
process.env.TUTORIAL_ENABLED = "1";

before(async () => {
  await import("../src/playerProfileStore.js");
  await import("../src/moderationStore.js");
  const { patchAdminRuntimeSettings } = await import(
    "../src/adminRuntimeSettingsStore.js"
  );
  patchAdminRuntimeSettings({ tutorialEnabled: true });
});

after(() => {
  fs.rmSync(dir, { recursive: true, force: true });
  delete process.env.PLAYER_PROFILE_STORE_FILE;
  delete process.env.MODERATION_STORE_FILE;
  delete process.env.ADMIN_RUNTIME_SETTINGS_FILE;
  delete process.env.TUTORIAL_ENABLED;
});

/** Compact NQ + 34 alnum (36 total). */
const W1 = "NQ07ADMINPLAYER000000000000000000001";
const W2 = "NQ07ADMINPLAYER000000000000000000002";
const W3 = "NQ07ADMINPLAYER000000000000000000003";

test("resolveAdminPlayerTarget accepts wallet or username", async () => {
  const { trySetPlayerUsername } = await import("../src/playerProfileStore.js");
  const { resolveAdminPlayerTarget } = await import("../src/adminPlayerOps.js");

  const set = trySetPlayerUsername(W1, "ModTarget");
  assert.equal(set.ok, true, String((set as { error?: string }).error));

  const byWallet = resolveAdminPlayerTarget(W1);
  assert.equal(byWallet.ok, true);
  if (byWallet.ok) {
    assert.equal(byWallet.matchedBy, "wallet");
    assert.equal(byWallet.wallet, W1);
    assert.equal(byWallet.username, "ModTarget");
  }

  const byName = resolveAdminPlayerTarget("modtarget");
  assert.equal(byName.ok, true);
  if (byName.ok) {
    assert.equal(byName.matchedBy, "username");
    assert.equal(byName.wallet, W1);
  }

  assert.equal(resolveAdminPlayerTarget("nobody-here").ok, false);
  assert.equal(resolveAdminPlayerTarget("NQ07 SHORT").ok, false);
});

test("lookup + tutorial reset clears steps so Pay needs lesson again", async () => {
  const {
    completeTutorial,
    markTutorialMineComplete,
    ackTutorialDoorSent,
    computeNeedsTutorial,
  } = await import("../src/tutorialSessionService.js");
  const {
    lookupAdminPlayer,
    adminResetPlayerTutorial,
  } = await import("../src/adminPlayerOps.js");
  const { setMiningBanned } = await import("../src/moderationStore.js");

  markTutorialMineComplete(W2, 1_000);
  ackTutorialDoorSent(W2, 2_000);
  completeTutorial(W2, 3_000);
  setMiningBanned(W2, true, "ADMIN", "farm");

  assert.equal(computeNeedsTutorial(true, W2), false);

  const view = lookupAdminPlayer(W2);
  assert.equal(view.ok, true);
  if (view.ok) {
    assert.equal(view.player.tutorial.steps.mine, true);
    assert.equal(view.player.tutorial.steps.pay, true);
    assert.equal(view.player.tutorial.steps.exit, true);
    assert.equal(view.player.tutorial.needsTutorialWhenPay, false);
    assert.equal(view.player.moderation.miningRestricted, true);
    assert.equal(view.player.moderation.miningNote, "farm");
  }

  const reset = adminResetPlayerTutorial(W2);
  assert.equal(reset.ok, true);
  assert.equal(computeNeedsTutorial(true, W2), true);
  if (reset.ok) {
    assert.equal(reset.player.tutorial.needsTutorialWhenPay, true);
    assert.equal(reset.player.tutorial.steps.mine, false);
    assert.equal(reset.player.tutorial.steps.pay, false);
    assert.equal(reset.player.tutorial.steps.exit, false);
  }
});

test("adminPlayerIdentity prefers username for label and profile path", async () => {
  const { trySetPlayerUsername } = await import("../src/playerProfileStore.js");
  const { adminPlayerIdentity, adminUserProfilePath } = await import(
    "../src/adminPlayerOps.js"
  );
  const w = "NQ07ADMINPLAYER000000000000000000099";

  assert.equal(trySetPlayerUsername(w, "LinkMe").ok, true);
  const withName = adminPlayerIdentity(w);
  assert.equal(withName.username, "LinkMe");
  assert.equal(withName.displayName, "LinkMe");
  assert.equal(withName.profilePath, "/admin/user/LinkMe");
  assert.equal(adminUserProfilePath(w, "LinkMe"), "/admin/user/LinkMe");

  const bare = adminPlayerIdentity(W2);
  assert.equal(bare.username, null);
  assert.ok(bare.displayName.length > 0);
  assert.equal(bare.profilePath, `/admin/user/${W2}`);
});

test("adminResetPlayerTutorial resolves by username", async () => {
  const { trySetPlayerUsername } = await import("../src/playerProfileStore.js");
  const { completeTutorial } = await import("../src/tutorialSessionService.js");
  const { adminResetPlayerTutorial } = await import("../src/adminPlayerOps.js");

  assert.equal(trySetPlayerUsername(W3, "ResetMe").ok, true);
  completeTutorial(W3, 9_000);

  const out = adminResetPlayerTutorial("ResetMe");
  assert.equal(out.ok, true);
  if (out.ok) {
    assert.equal(out.wallet, W3);
    assert.equal(out.player.tutorial.needsTutorialWhenPay, true);
  }
});
