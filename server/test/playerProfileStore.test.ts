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
  } = await import("../src/playerProfileStore.js");

  const wallet = "NQ07 TEST000000000000000000000000000001";

  for (let i = 0; i < 5; i++) {
    const d = recordUsernamePromptDeferral(wallet);
    assert.equal(d.ok, true);
  }
  let prompt = getUsernamePromptStatus(wallet);
  assert.equal(prompt.mustSetUsername, true);

  const set1 = trySetPlayerUsername(wallet, "PlayerOne");
  assert.equal(set1.ok, true);
  prompt = getUsernamePromptStatus(wallet);
  assert.equal(prompt.needsPrompt, false);

  adminClearPlayerUsername(wallet);
  prompt = getUsernamePromptStatus(wallet);
  assert.equal(prompt.needsPrompt, true);
  assert.equal(prompt.deferCount, 0);
  assert.equal(prompt.deferralsRemaining, 5);
  assert.equal(prompt.mustSetUsername, false);

  const set2 = trySetPlayerUsername(wallet, "PlayerTwo");
  assert.equal(set2.ok, true);
  if (set2.ok) assert.equal(set2.customUsername, "PlayerTwo");

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
