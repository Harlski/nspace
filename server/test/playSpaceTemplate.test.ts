import assert from "node:assert/strict";
import test from "node:test";

import {
  buildShellFromLegacyPlaySpaceLayout,
  buildShellFromLayoutSnapshot,
  joinSpawnIsPassable,
} from "../src/playSpaceTemplate/buildShell.js";
import {
  _resetPlaySpaceTemplateStoreForTests,
  bootstrapDefaultPlaySpaceTemplateIfEmpty,
  createPlaySpaceTemplate,
  getDefaultPlaySpaceTemplate,
  loadPlaySpaceTemplateStore,
  resolveTemplateIdForPlaySpaceCreate,
  setDefaultPlaySpaceTemplate,
  setPlaySpaceTemplateArchived,
  wireTemplateForTests,
} from "../src/playSpaceTemplate/store.js";

test("buildShellFromLegacyPlaySpaceLayout produces passable join spawn", () => {
  const shell = buildShellFromLegacyPlaySpaceLayout();
  assert.ok(joinSpawnIsPassable(shell));
  assert.ok(shell.obstacles.length >= 40);
  assert.equal(shell.backgroundHueDeg, 285);
});

test("buildShellFromLayoutSnapshot strips teleporters", () => {
  const shell = buildShellFromLayoutSnapshot(
    {
      roomBounds: { minX: -2, maxX: 2, minZ: -2, maxZ: 2 },
      obstacles: [
        {
          x: 0,
          z: 0,
          y: 0,
          passable: false,
          half: false,
          quarter: false,
          hex: false,
          pyramid: true,
          pyramidBaseScale: 1,
          hexRadiusScale: 1,
          sphere: false,
          sphereRadiusScale: 1,
          ramp: false,
          rampDir: 0,
          cubeRotX: 0,
          cubeRotY: 0,
          cubeRotZ: 0,
          colorRgb: 0xff0000,
          locked: true,
          teleporter: { pending: true },
        },
      ],
      extraFloorTiles: [],
      baseFloorColorTiles: [],
      removedBaseFloorTiles: [],
      roomBackgroundHueDeg: 120,
      roomBackgroundNeutral: null,
    },
    { x: 1, z: 1 }
  );
  assert.equal(shell.obstacles.length, 0);
  assert.deepEqual(shell.joinSpawn, { x: 1, z: 1 });
});

test("bootstrapDefaultPlaySpaceTemplateIfEmpty is idempotent", () => {
  _resetPlaySpaceTemplateStoreForTests();
  bootstrapDefaultPlaySpaceTemplateIfEmpty(1_000);
  const first = getDefaultPlaySpaceTemplate();
  assert.ok(first);
  bootstrapDefaultPlaySpaceTemplateIfEmpty(2_000);
  assert.equal(getDefaultPlaySpaceTemplate()?.id, first!.id);
});

test("resolveTemplateIdForPlaySpaceCreate uses default for non-admin", () => {
  _resetPlaySpaceTemplateStoreForTests();
  bootstrapDefaultPlaySpaceTemplateIfEmpty();
  const d = getDefaultPlaySpaceTemplate()!;
  const r = resolveTemplateIdForPlaySpaceCreate(false, undefined);
  assert.equal(r.ok && r.templateId, d.id);
});

test("admin may request a specific active template", () => {
  _resetPlaySpaceTemplateStoreForTests();
  bootstrapDefaultPlaySpaceTemplateIfEmpty();
  const altShell = buildShellFromLegacyPlaySpaceLayout();
  const created = createPlaySpaceTemplate({
    displayName: "Alt",
    sourceRoomId: "hub",
    buildShell: altShell,
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const r = resolveTemplateIdForPlaySpaceCreate(true, created.template.id);
  assert.equal(r.ok && r.templateId, created.template.id);
});

test("archived template cannot become default", () => {
  _resetPlaySpaceTemplateStoreForTests();
  const shell = buildShellFromLegacyPlaySpaceLayout();
  const created = createPlaySpaceTemplate({
    displayName: "Alt",
    sourceRoomId: "hub",
    buildShell: shell,
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  setPlaySpaceTemplateArchived(created.template.id, true);
  const set = setDefaultPlaySpaceTemplate(created.template.id);
  assert.equal(set.ok, false);
});

test("archived template rejected for admin create", () => {
  _resetPlaySpaceTemplateStoreForTests();
  bootstrapDefaultPlaySpaceTemplateIfEmpty();
  const shell = buildShellFromLegacyPlaySpaceLayout();
  const created = createPlaySpaceTemplate({
    displayName: "Alt",
    sourceRoomId: "hub",
    buildShell: shell,
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  setPlaySpaceTemplateArchived(created.template.id, true);
  const r = resolveTemplateIdForPlaySpaceCreate(true, created.template.id);
  assert.equal(r.ok, false);
});
