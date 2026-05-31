import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_PIXEL_CANVAS_COLOR_RGB } from "./blockColors.js";
import { compactWalletKey, formatWalletAddressGrouped } from "./walletAddresses.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LOG_FILE = process.env.PIXEL_PAINT_LOG_FILE
  ? path.resolve(process.env.PIXEL_PAINT_LOG_FILE)
  : path.join(__dirname, "..", "data", "pixel", "paint-log.jsonl");

const BASELINE_FLAG = path.join(path.dirname(LOG_FILE), ".baseline-v1");

export type PixelPaintBaselineRecord = {
  ts: number;
  kind: "baseline";
  defaultColorRgb: number;
  tiles: Array<{ x: number; z: number; colorRgb: number }>;
};

export type PixelPaintRecord = {
  ts: number;
  kind: "paint";
  x: number;
  z: number;
  colorRgb: number;
  address: string;
};

export type PixelPaintLogRecord = PixelPaintBaselineRecord | PixelPaintRecord;

function ensureLogDir(): void {
  const dir = path.dirname(LOG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function appendRecord(record: PixelPaintLogRecord): void {
  ensureLogDir();
  fs.appendFileSync(LOG_FILE, `${JSON.stringify(record)}\n`, "utf8");
}

/** Append one successful Pixel room floor paint (forward-only timelapse log). */
export function logPixelPaint(
  x: number,
  z: number,
  colorRgb: number,
  address: string,
  ts = Date.now()
): void {
  const compact = compactWalletKey(address);
  appendRecord({
    ts,
    kind: "paint",
    x,
    z,
    colorRgb,
    address: compact ? formatWalletAddressGrouped(compact) : String(address || ""),
  });
}

/** One-time baseline snapshot of the current painted tiles (frame 0 for timelapse). */
export function ensurePixelPaintBaseline(
  tiles: ReadonlyArray<{ x: number; z: number; colorRgb: number }>
): void {
  if (fs.existsSync(BASELINE_FLAG)) return;
  const ts = Date.now();
  appendRecord({
    ts,
    kind: "baseline",
    defaultColorRgb: DEFAULT_PIXEL_CANVAS_COLOR_RGB,
    tiles: tiles.map((t) => ({ x: t.x, z: t.z, colorRgb: t.colorRgb })),
  });
  fs.writeFileSync(BASELINE_FLAG, `${ts}\n`, "utf8");
  console.log(`[pixel] paint log baseline written (${tiles.length} tiles)`);
}
