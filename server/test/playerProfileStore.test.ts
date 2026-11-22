import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("admin clear resets login prompt deferrals and allows immediate re-set", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nspace-profile-"));
  const storeFile = path.join(dir, "player-profiles.json");
  process.env.PLAYER_PROFILE_STORE_FILE = storeFile;

  const {
    adminClearPlayerUsername,
    getUsernamePromptStatus,
    recordUsernamePromptDeferral,
    trySetPlayerUsername,
    walletRequiresUsername,
  } = await import("../src/playerProfileStore.js");

  const wallet = "NQ07 TEST000000000000000000000000000001";

  let prompt = getUsernamePromptStatus(wallet);
  assert.equal(prompt.needsPrompt, true);
  assert.equal(prompt.mustSetUsername, true);
  assert.equal(prompt.deferralsRemaining, 0);
  assert.equal(walletRequiresUsername(wallet), true);
  const deferred = recordUsernamePromptDeferral(wallet);
  assert.equal(deferred.ok, false);
  if (!deferred.ok) assert.equal(deferred.error, "username_prompt_required");

  const set1 = trySetPlayerUsername(wallet, "PlayerOne");
  assert.equal(set1.ok, true);
  prompt = getUsernamePromptStatus(wallet);
  assert.equal(prompt.needsPrompt, false);
  assert.equal(walletRequiresUsername(wallet), false);

  adminClearPlayerUsername(wallet);
  prompt = getUsernamePromptStatus(wallet);
  assert.equal(prompt.needsPrompt, true);
  assert.equal(prompt.deferCount, 0);
  assert.equal(prompt.deferralsRemaining, 0);
  assert.equal(prompt.mustSetUsername, true);
  assert.equal(walletRequiresUsername(wallet), true);

  const set2 = trySetPlayerUsername(wallet, "PlayerTwo");
  assert.equal(set2.ok, true);
  if (set2.ok) assert.equal(set2.customUsername, "PlayerTwo");

  const compact = "NQ07TEST0000000000000000000000000999";
  const spaced = compact.replace(/(.{4})/g, "$1 ").trim();
  assert.notEqual(spaced, compact);
  const setSpaced = trySetPlayerUsername(compact, "Creator");
  assert.equal(setSpaced.ok, true);
  assert.equal(getUsernamePromptStatus(spaced).needsPrompt, false);
  assert.equal(walletRequiresUsername(spaced), false);
  assert.equal(walletRequiresUsername(compact), false);

  fs.rmSync(dir, { recursive: true, force: true });
  delete process.env.PLAYER_PROFILE_STORE_FILE;
});

test("username cooldown blocks change while custom username is set", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nspace-profile-"));
  const storeFile = path.join(dir, "player-profiles.json");
  process.env.PLAYER_PROFILE_STORE_FILE = storeFile;

  const { trySetPlayerUsername } = await import("../src/playerProfileStore.js");
  const wallet = "NQ07 TEST000000000000000000000000000002";

  const first = trySetPlayerUsername(wallet, "Alpha");
  assert.equal(first.ok, true);

  const second = trySetPlayerUsername(wallet, "Beta");
  assert.equal(second.ok, false);
  if (!second.ok) assert.equal(second.error, "username_cooldown");

  fs.rmSync(dir, { recursive: true, force: true });
  delete process.env.PLAYER_PROFILE_STORE_FILE;
});
