import path from "node:path";
import { collectWorldStateMetrics } from "./worldStateBenchmarkLib.ts";

function readArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx < 0) return undefined;
  return process.argv[idx + 1];
}

async function main(): Promise<void> {
  const dataDir = readArg("--data-dir") ?? path.resolve("data");
  const roomId = readArg("--room-id") ?? "hub";
  const metrics = await collectWorldStateMetrics(dataDir, roomId);
  console.log(JSON.stringify(metrics, null, 2));
}

main().catch((err: unknown) => {
  console.error("[bench:world-state] failed", err);
  process.exitCode = 1;
});
