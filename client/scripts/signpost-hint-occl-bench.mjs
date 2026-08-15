/**
 * Phase-1 feedback loop for commons FPS: walk mode vs build mode cost of
 * signpost-hint foreground occlusion (Game.updateSignpostHintSprites).
 *
 * naive (default legacy): for each hint, Raycaster.intersectObjects(all roots)
 * narrow: tile-bucket candidates along camera→hint (post-fix path)
 * build: skip raycasts
 *
 * Exit 1 (red) when walk median frame cost exceeds a playable budget.
 *
 * Usage:
 *   node client/scripts/signpost-hint-occl-bench.mjs
 *   MODE=narrow node client/scripts/signpost-hint-occl-bench.mjs
 */
import * as THREE from "three";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { forEachPaddedTileOnSegment } from "../src/game/signpostHintOcclusion.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const MODE = (process.env.MODE ?? "narrow").toLowerCase();

function hubCountsFromDisk() {
  try {
    const room = JSON.parse(
      readFileSync(join(root, "server/data/rooms/hub.json"), "utf8")
    );
    const sb = JSON.parse(
      readFileSync(join(root, "server/data/signboards.json"), "utf8")
    );
    const blocks = Array.isArray(room.obstacles) ? room.obstacles.length : 0;
    const hints = (sb.signboards ?? []).filter((s) => s.roomId === "hub").length;
    return { blocks, hints };
  } catch {
    return { blocks: 9301, hints: 49 };
  }
}

const disk = hubCountsFromDisk();
const BLOCKS = Number(process.env.BLOCKS ?? disk.blocks);
const HINTS = Number(process.env.HINTS ?? disk.hints);
const FRAMES = Number(process.env.FRAMES ?? 20);
const WALK_BUDGET_MS = Number(process.env.WALK_BUDGET_MS ?? 16);
const PAD = 1;

const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
camera.position.set(40, 50, 40);
camera.lookAt(0, 0, 0);
camera.updateMatrixWorld(true);

const roots = [];
const byTile = new Map();
const box = new THREE.BoxGeometry(1, 1, 1);
const mat = new THREE.MeshBasicMaterial();
for (let i = 0; i < BLOCKS; i++) {
  const mesh = new THREE.Mesh(box, mat);
  const x = (i % 100) - 50;
  const z = Math.floor(i / 100) - 50;
  mesh.position.set(x, 0.5, z);
  mesh.updateMatrixWorld(true);
  roots.push(mesh);
  const k = `${x},${z}`;
  let arr = byTile.get(k);
  if (!arr) {
    arr = [];
    byTile.set(k, arr);
  }
  arr.push(mesh);
}

const hintWorlds = [];
for (let i = 0; i < HINTS; i++) {
  hintWorlds.push(new THREE.Vector3((i % 10) - 5, 1.2, Math.floor(i / 10) - 5));
}

const ray = new THREE.Raycaster();
const camW = new THREE.Vector3();
const dirW = new THREE.Vector3();
const candSet = new Set();
const candBuf = [];

function collectNarrow(hintWorld) {
  candSet.clear();
  forEachPaddedTileOnSegment(
    camW.x,
    camW.z,
    hintWorld.x,
    hintWorld.z,
    PAD,
    (tx, tz) => {
      const arr = byTile.get(`${tx},${tz}`);
      if (!arr) return;
      for (const o of arr) candSet.add(o);
    }
  );
  candBuf.length = 0;
  for (const o of candSet) candBuf.push(o);
  return candBuf;
}

function walkFrameMs() {
  const t0 = performance.now();
  camera.getWorldPosition(camW);
  for (const hintWorld of hintWorlds) {
    dirW.copy(hintWorld).sub(camW);
    const dist = dirW.length();
    if (dist < 0.2) continue;
    dirW.multiplyScalar(1 / dist);
    ray.set(camW, dirW);
    ray.near = 0.12;
    ray.far = Math.max(0.13, dist - 0.085);
    const targets = MODE === "narrow" ? collectNarrow(hintWorld) : roots;
    ray.intersectObjects(targets, true);
  }
  return performance.now() - t0;
}

function buildFrameMs() {
  const t0 = performance.now();
  void HINTS;
  return performance.now() - t0;
}

for (let i = 0; i < 3; i++) walkFrameMs();

const walkSamples = [];
const buildSamples = [];
for (let i = 0; i < FRAMES; i++) {
  walkSamples.push(walkFrameMs());
  buildSamples.push(buildFrameMs());
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const walkMed = median(walkSamples);
const buildMed = median(buildSamples);
const ratio = buildMed > 1e-6 ? walkMed / buildMed : Infinity;

const report = {
  mode: MODE,
  source: { blocks: BLOCKS, hints: HINTS, frames: FRAMES },
  walkMedianMs: Number(walkMed.toFixed(3)),
  buildMedianMs: Number(buildMed.toFixed(3)),
  walkOverBuildRatio: Number(ratio.toFixed(1)),
  walkBudgetMs: WALK_BUDGET_MS,
  red: walkMed > WALK_BUDGET_MS,
};

console.log(JSON.stringify(report, null, 2));

if (report.red) {
  console.error(
    `\nRED: ${MODE} walk-mode occlusion ~${report.walkMedianMs}ms/frame ` +
      `(budget ${WALK_BUDGET_MS}ms); build-mode ~${report.buildMedianMs}ms.`
  );
  process.exit(1);
}

console.error(
  `\nGREEN: ${MODE} walk-mode occlusion within budget (${report.walkMedianMs}ms <= ${WALK_BUDGET_MS}ms).`
);
process.exit(0);
