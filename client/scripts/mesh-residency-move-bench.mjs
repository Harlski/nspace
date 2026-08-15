/**
 * Move-vs-idle residency cost harness.
 *
 * Symptom: FPS fine while still; drops while moving; freezes after a few seconds.
 * Cause shape: refreshMeshResidency runs full floor sync when the camera pans
 * even if the resident chunk set is unchanged (e.g. while mesh build queue drains).
 *
 * MODE=legacy — mirrors buggy Game gate → expect RED
 * MODE=fixed (default) — side-effects only on chunk-set change → expect GREEN
 *
 * Usage: npx tsx client/scripts/mesh-residency-move-bench.mjs
 */
import { interestChunksFromRect } from "../src/game/interestChunks.ts";
import { nextResidentChunks } from "../src/game/meshResidency.ts";

function simulateLegacy(rects, opts) {
  let resident = new Set();
  let lastRectSig = "";
  let floorSyncs = 0;
  let chunkChanges = 0;
  let queueLen = 0;

  for (let i = 0; i < rects.length; i++) {
    const rect = rects[i];
    const rectSig = `${rect.centerX.toFixed(2)},${rect.centerZ.toFixed(2)},${rect.halfW.toFixed(2)},${rect.halfH.toFixed(2)}`;
    const next = nextResidentChunks(resident, rect);
    const sameChunks =
      next.size === resident.size && [...next].every((c) => resident.has(c));

    if (rectSig === lastRectSig && sameChunks) continue;

    lastRectSig = rectSig;
    const changed = !sameChunks;
    resident = next;
    if (changed) chunkChanges++;

    if (i === 0) {
      queueLen = opts.queueNonEmptyAfterSettle ? 500 : 0;
    } else if (queueLen > 0) {
      queueLen = Math.max(0, queueLen - 48);
    }

    // Buggy gate: side-effects unless (!changed && queue empty)
    if (!changed && queueLen === 0) continue;
    floorSyncs++;
  }
  return { floorSyncs, chunkChanges };
}

function simulateFixed(rects) {
  let resident = new Set();
  let floorSyncs = 0;
  let chunkChanges = 0;

  for (let i = 0; i < rects.length; i++) {
    const rect = rects[i];
    const next = nextResidentChunks(resident, rect);
    const changed =
      next.size !== resident.size || ![...next].every((c) => resident.has(c));
    resident = next;
    if (!changed) continue;
    chunkChanges++;
    floorSyncs++;
  }
  return { floorSyncs, chunkChanges };
}

function panRects(start, steps, dxPerStep) {
  const out = [];
  for (let i = 0; i < steps; i++) {
    out.push({
      ...start,
      centerX: start.centerX + dxPerStep * i,
      centerZ: start.centerZ,
    });
  }
  return out;
}

const base = { centerX: 0, centerZ: 0, halfW: 20, halfH: 14 };
const rects = panRects(base, 60, 0.05);
const legacy = simulateLegacy(rects, { queueNonEmptyAfterSettle: true });
const fixed = simulateFixed(rects);
const load = interestChunksFromRect(base, 0);

const mode = (process.env.MODE ?? "fixed").toLowerCase();
const active = mode === "fixed" ? fixed : legacy;

const report = {
  mode,
  residentChunksAtStart: load.size,
  floorSyncs: active.floorSyncs,
  chunkChanges: active.chunkChanges,
  legacyFloorSyncs: legacy.floorSyncs,
  fixedFloorSyncs: fixed.floorSyncs,
  red: active.floorSyncs > 2 && active.chunkChanges <= 1,
};

console.log(JSON.stringify(report, null, 2));

if (report.red) {
  console.error(
    `\nRED (${mode}): pan-within-chunks triggered ${report.floorSyncs} floor syncs ` +
      `(chunkChanges=${report.chunkChanges}). Matches move-only FPS collapse.`
  );
  process.exit(1);
}

console.error(`\nGREEN (${mode}): pan-within-chunks does not spam floor syncs.`);
process.exit(0);
