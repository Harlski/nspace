import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

describe("design catalog manage", () => {
  let tmpDir: string;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nspace-designs-"));
    process.chdir(tmpDir);
    fs.mkdirSync(path.join(tmpDir, "server", "data"), { recursive: true });
  });

  after(() => {
    process.chdir(path.join(tmpDir, "..", ".."));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("delete and update visibility are creator-only", async () => {
    const {
      loadDesigns,
      publishDesign,
      deleteDesign,
      updateDesignVisibility,
      getDesignById,
      listPlaceableDesigns,
    } = await import("../src/designs.js");

    loadDesigns();

    const placed = new Map<string, { x: number; z: number; y: number; style: object }>();
    placed.set("0,0,0", { x: 0, z: 0, y: 0, style: { colorRgb: 0xff0000 } });

    const tooLong = publishDesign({
      kind: "object",
      creatorWallet: "NQ1CREATOR",
      sourceRoomId: "hub",
      minX: 0,
      maxX: 0,
      minZ: 0,
      maxZ: 0,
      name: "abcdefghijklm",
      visibility: "private",
      placed,
    });
    assert.equal(tooLong.ok, false);
    if (tooLong.ok) return;
    assert.equal(tooLong.code, "name_too_long");

    const pub = publishDesign({
      kind: "object",
      creatorWallet: "NQ1CREATOR",
      sourceRoomId: "hub",
      minX: 0,
      maxX: 0,
      minZ: 0,
      maxZ: 0,
      name: "Test",
      visibility: "private",
      placed,
    });
    assert.equal(pub.ok, true);
    if (!pub.ok) return;
    const id = pub.design.id;

    const denied = deleteDesign("NQ1OTHER", id);
    assert.equal(denied.ok, false);
    if (denied.ok) return;
    assert.equal(denied.code, "forbidden");

    const vis = updateDesignVisibility("NQ1CREATOR", id, "public");
    assert.equal(vis.ok, true);
    if (!vis.ok) return;
    assert.equal(vis.design.visibility, "public");

    const row = getDesignById(id);
    assert.equal(row?.visibility, "public");
    assert.ok(listPlaceableDesigns("NQ1OTHER", { kind: "object" }).some((d) => d.id === id));

    const del = deleteDesign("NQ1CREATOR", id);
    assert.equal(del.ok, true);
    assert.equal(getDesignById(id), undefined);
  });
});
