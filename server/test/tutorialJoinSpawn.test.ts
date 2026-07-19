import assert from "node:assert/strict";
import test from "node:test";

import {
  clearPlaySpaceRoomRuntime,
  getPlaySpaceRoomRuntime,
  registerPlaySpaceRoomRuntime,
  setPlaySpaceBackground,
  setPlaySpaceJoinSpawn,
} from "../src/roomLayouts.js";
import { TUTORIAL_ROOM_ID } from "../src/tutorial/roomIds.js";
import {
  _resetTutorialTemplateStoreForTests,
  applyDefaultTutorialTemplateToRuntimeShell,
  bootstrapDefaultTutorialTemplateIfEmpty,
  getDefaultTutorialTemplate,
  patchDefaultTutorialTemplateJoinSpawn,
} from "../src/tutorialTemplate/store.js";
import { TUTORIAL_DEFAULT_BOUNDS } from "../src/tutorialTemplate/bootstrapShell.js";

test("setPlaySpaceJoinSpawn updates tutorial runtime Join Spawn", () => {
  clearPlaySpaceRoomRuntime(TUTORIAL_ROOM_ID);
  registerPlaySpaceRoomRuntime(TUTORIAL_ROOM_ID, {
    bounds: { ...TUTORIAL_DEFAULT_BOUNDS },
    backgroundHueDeg: 165,
    backgroundNeutral: null,
    joinSpawn: { x: 0, z: -6 },
  });
  assert.equal(setPlaySpaceJoinSpawn(TUTORIAL_ROOM_ID, { x: 1, z: -4 }), true);
  assert.deepEqual(getPlaySpaceRoomRuntime(TUTORIAL_ROOM_ID)?.joinSpawn, {
    x: 1,
    z: -4,
  });
  assert.equal(setPlaySpaceJoinSpawn(TUTORIAL_ROOM_ID, null), true);
  assert.equal(getPlaySpaceRoomRuntime(TUTORIAL_ROOM_ID)?.joinSpawn, null);
  clearPlaySpaceRoomRuntime(TUTORIAL_ROOM_ID);
});

test("patchDefaultTutorialTemplateJoinSpawn persists for restart seeding", () => {
  _resetTutorialTemplateStoreForTests();
  bootstrapDefaultTutorialTemplateIfEmpty();
  const before = getDefaultTutorialTemplate();
  assert.ok(before);
  assert.deepEqual(before.buildShell.joinSpawn, { x: 0, z: -6 });

  const patched = patchDefaultTutorialTemplateJoinSpawn({ x: 0, z: 3 });
  assert.equal(patched.ok, true);
  const after = getDefaultTutorialTemplate();
  assert.ok(after);
  assert.deepEqual(after.buildShell.joinSpawn, { x: 0, z: 3 });

  const shell = applyDefaultTutorialTemplateToRuntimeShell();
  assert.deepEqual(shell.joinSpawn, { x: 0, z: 3 });

  _resetTutorialTemplateStoreForTests();
});

test("setPlaySpaceBackground updates tutorial sky runtime", () => {
  clearPlaySpaceRoomRuntime(TUTORIAL_ROOM_ID);
  registerPlaySpaceRoomRuntime(TUTORIAL_ROOM_ID, {
    bounds: { ...TUTORIAL_DEFAULT_BOUNDS },
    backgroundHueDeg: 165,
    backgroundNeutral: null,
    joinSpawn: { x: 0, z: -6 },
  });
  assert.equal(
    setPlaySpaceBackground(TUTORIAL_ROOM_ID, { hueDeg: 210 }),
    true
  );
  assert.deepEqual(getPlaySpaceRoomRuntime(TUTORIAL_ROOM_ID), {
    backgroundHueDeg: 210,
    backgroundNeutral: null,
    joinSpawn: { x: 0, z: -6 },
  });
  clearPlaySpaceRoomRuntime(TUTORIAL_ROOM_ID);
});
