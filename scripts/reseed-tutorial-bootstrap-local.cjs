#!/usr/bin/env node
/**
 * Offline / local: write the code Tutorial Path bootstrap into
 * server/data/tutorial-templates.json AND clear persisted Tutorial Room
 * geometry so the next server start seeds from the template.
 *
 * Important: ensureTutorialRoomLayout keeps existing room files if they have
 * any obstacles/floors — template reseed alone is not enough.
 *
 * Usage (repo root):
 *   npm run tutorial:reseed-bootstrap:local
 *   # then restart the game server
 *
 * Join path: Tutorial is hidden from the Rooms / teleport catalog. Use Player
 * Menu → Finish tutorial (incomplete learners), Start over while already in
 * tutorial, or open with ?room=tutorial as admin/local.
 */
"use strict";

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const dataDir = process.env.WORLD_STATE_DIR
  ? path.resolve(process.env.WORLD_STATE_DIR)
  : path.join(root, "server", "data");
const roomsDir = path.join(dataDir, "rooms");

const CLEAR_ROOM_IDS = ["tutorial", "tutorial-staging"];

const runner = `
import { initTutorialTemplateStore, reseedDefaultTutorialTemplateFromBootstrap } from "./src/tutorialTemplate/store.ts";
initTutorialTemplateStore();
const result = reseedDefaultTutorialTemplateFromBootstrap();
const shell = result.template.buildShell;
console.log(JSON.stringify({
  ok: true,
  mode: "local",
  templateId: result.template.id,
  created: result.created,
  obstacles: shell.obstacles.length,
  baseFloorColors: shell.baseFloorColors.length,
  extraFloor: shell.extraFloor.length,
}, null, 2));
`;

const r = spawnSync(
  "npx",
  ["tsx", "-e", runner],
  {
    cwd: path.join(root, "server"),
    encoding: "utf8",
    env: process.env,
    shell: false,
  }
);

if (r.stdout) process.stdout.write(r.stdout);
if (r.stderr) process.stderr.write(r.stderr);
if ((r.status ?? 1) !== 0) process.exit(r.status ?? 1);

const cleared = [];
for (const roomId of CLEAR_ROOM_IDS) {
  const filePath = path.join(roomsDir, `${encodeURIComponent(roomId)}.json`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    cleared.push(roomId);
  }
}

console.log(
  JSON.stringify(
    {
      clearedRoomFiles: cleared,
      hint:
        "Restart the game server, then join Tutorial via Finish tutorial / Start over, or ?room=tutorial (not the Rooms teleporter list — tutorial is hidden there).",
    },
    null,
    2
  )
);
