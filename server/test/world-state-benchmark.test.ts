import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { collectWorldStateMetrics } from "../scripts/worldStateBenchmarkLib.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.resolve(__dirname, "fixtures/world-state-baseline");
const baselinePath = path.resolve(__dirname, "baselines/world-state-metrics.json");

type StableMetrics = {
  roomId: string;
  roomCount: number;
  obstacleCount: number;
  extraFloorCount: number;
  spawnCount: number;
  signboardCount: number;
  voxelTextCount: number;
  fileBytes: number;
  welcomePayloadBytes: number;
  obstacleBroadcastBytes: number;
  extraFloorBroadcastBytes: number;
  obstacleDeltaBroadcastBytes: number;
  extraFloorDeltaBroadcastBytes: number;
};

test("collectWorldStateMetrics produces stable baseline for fixture", async () => {
  const metrics = await collectWorldStateMetrics(fixtureDir, "hub");
  const baseline = JSON.parse(
    await import("node:fs/promises").then((fs) => fs.readFile(baselinePath, "utf8"))
  ) as StableMetrics;

  assert.equal(metrics.roomId, baseline.roomId);
  assert.equal(metrics.roomCount, baseline.roomCount);
  assert.equal(metrics.obstacleCount, baseline.obstacleCount);
  assert.equal(metrics.extraFloorCount, baseline.extraFloorCount);
  assert.equal(metrics.spawnCount, baseline.spawnCount);
  assert.equal(metrics.signboardCount, baseline.signboardCount);
  assert.equal(metrics.voxelTextCount, baseline.voxelTextCount);
  assert.equal(metrics.fileBytes, baseline.fileBytes);
  assert.equal(metrics.welcomePayloadBytes, baseline.welcomePayloadBytes);
  assert.equal(metrics.obstacleBroadcastBytes, baseline.obstacleBroadcastBytes);
  assert.equal(metrics.extraFloorBroadcastBytes, baseline.extraFloorBroadcastBytes);
  assert.equal(
    metrics.obstacleDeltaBroadcastBytes,
    baseline.obstacleDeltaBroadcastBytes
  );
  assert.equal(
    metrics.extraFloorDeltaBroadcastBytes,
    baseline.extraFloorDeltaBroadcastBytes
  );

  assert.ok(metrics.loadMs >= 0, "loadMs must be non-negative");
  assert.ok(metrics.persistMs >= 0, "persistMs must be non-negative");
});
